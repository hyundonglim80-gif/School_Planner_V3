// js/viewWeek.js

import { BaseView } from './components/BaseView.js';
import { store } from './core/store.js';
import { formatDate, getEventLabels, isRedDay, getHolidayName } from './core/utils.js';
import { getUserCol, getGroupCol, dbAPI } from './firebase.js'; 
import { generateEventBadgesHTML, formatEventListToText } from './core/eventUtils.js';
import { query, where, documentId, getDocs, doc, setDoc } from "firebase/firestore";

export class WeekView extends BaseView {
  constructor(container) {
    super(container); 
    this.myGroups = [];
    this.scheduleGroupId = null; 
  }

  async changeScheduleWorkspace(newGroupId) {
      if (store.hasUnsavedChanges) {
          this.save(); 
      }
      this.scheduleGroupId = newGroupId || null;
      
      if (store.mode === 'editor') this.renderEditor();
      else this.renderViewer();
  }

  getWeekDates() {
    const tempDate = new Date(store.currentDate);
    tempDate.setDate(tempDate.getDate() - tempDate.getDay()); 
    const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
    return Array.from({ length: 7 }).reduce((acc, _, i) => {
      if (store.showWeekend || (i !== 0 && i !== 6)) {
        acc.push({
          day: dayNames[i], 
          dayOfWeekNum: i,
          dateStr: formatDate(tempDate),
          dateDisplay: `${tempDate.getDate()}일`
        });
      }
      tempDate.setDate(tempDate.getDate() + 1);
      return acc;
    }, []);
  }

  async fetchWeekData(startStr, endStr) {
    try { this.myGroups = await dbAPI.loadMyGroups(); } catch(e) { this.myGroups = []; }

    const eMap = {}, sMap = {};

    const pEventsSnap = await getDocs(query(getUserCol('events'), where(documentId(), '>=', startStr), where(documentId(), '<=', endStr)));
    pEventsSnap.forEach(docSnap => {
        const data = docSnap.data();
        if (!eMap[docSnap.id]) eMap[docSnap.id] = { eventList: [] };
        let pList = data.eventList || (data.eventText ? window.parseRawEventTextToEventList(data.eventText) : []);
        pList.forEach(e => { e.sharedGroupId = null; eMap[docSnap.id].eventList.push(e); });
    });

    for (const g of this.myGroups) {
        const gEventsSnap = await getDocs(query(getGroupCol(g.id, 'events'), where(documentId(), '>=', startStr), where(documentId(), '<=', endStr)));
        gEventsSnap.forEach(docSnap => {
            const data = docSnap.data();
            if (!eMap[docSnap.id]) eMap[docSnap.id] = { eventList: [] };
            let gList = data.eventList || [];
            gList.forEach(e => { e.sharedGroupId = g.id; e.groupName = g.name; eMap[docSnap.id].eventList.push(e); });
        });
    }

    const scheduleCol = this.scheduleGroupId ? getGroupCol(this.scheduleGroupId, 'schedules') : getUserCol('schedules');
    const schedulesSnap = await getDocs(query(scheduleCol, where(documentId(), '>=', startStr), where(documentId(), '<=', endStr)));
    schedulesSnap.forEach(docSnap => { sMap[docSnap.id] = docSnap.data().periods || {}; });

    return { eMap, sMap };
  }

  async renderViewer() {
    this.showLoading('클라우드에서 주간 데이터를 불러오는 중...'); 

    const weekDates = this.getWeekDates();
    const { eMap, sMap } = await this.fetchWeekData(weekDates[0].dateStr, weekDates[weekDates.length - 1].dateStr);
    const realTodayStr = formatDate(new Date());

    const wsSelectHtml = `
        <div style="display:inline-flex; background:#f0fdf4; padding:3px; border-radius:8px; border:1px solid #bbf7d0; align-items:center;">
            <div onclick="window.weekViewInstance.changeScheduleWorkspace(null)" style="padding:4px 12px; font-size:0.85rem; border-radius:6px; cursor:pointer; font-weight:bold; transition:0.2s; ${!this.scheduleGroupId ? 'background:#fff; color:#0f766e; box-shadow:0 1px 3px rgba(0,0,0,0.1);' : 'color:#94a3b8;'}">🔒 개인 시간표</div>
            ${this.myGroups.map(g => `<div onclick="window.weekViewInstance.changeScheduleWorkspace('${g.id}')" style="padding:4px 12px; font-size:0.85rem; border-radius:6px; cursor:pointer; font-weight:bold; transition:0.2s; ${this.scheduleGroupId === g.id ? 'background:#fff; color:#0f766e; box-shadow:0 1px 3px rgba(0,0,0,0.1);' : 'color:#94a3b8;'}">👥 ${g.name} 시간표</div>`).join('')}
        </div>
    `;

    const rowsHtml = weekDates.map(d => {
      const periods = sMap[d.dateStr] || {};
      const finalEvents = eMap[d.dateStr]?.eventList || [];
      
      const processedEvents = finalEvents.length > 0 ? finalEvents.map(e => ({ 
          ...e, 
          labelIds: e.labelIds || [],
          content: (e.sharedGroupId ? `[👥 ${e.groupName}] ` : '') + e.content
      })) : [];
      
      const eventHtml = processedEvents.length > 0 
          ? generateEventBadgesHTML(processedEvents, d.dateStr) 
          : '<span style="color:#94a3b8;">-</span>';

      const isToday = (d.dateStr === realTodayStr);
      const isRed = isRedDay(d.dateStr, processedEvents);
      const isSat = d.dayOfWeekNum === 6;

      const dateColor = isRed ? '#ef4444' : (isSat ? '#3b82f6' : '#1e40af');
      const dateNumColor = isRed ? '#ef4444' : (isSat ? '#3b82f6' : '#475569');
      const holidayName = getHolidayName(d.dateStr);

      const periodCellsHtml = Array.from({ length: this.maxPeriod }).map((_, i) => {
        const pObj = periods[i + 1] || {};
        let content = '';
        if (pObj.subject && pObj.subject.toUpperCase() !== 'X') content += `<div style="margin-bottom: 6px;"><span class="badge-tag">${pObj.subject}</span></div>`;
        if (pObj.memo) content += `<div class="clean-cell-memo" style="font-size:0.95rem; color:#334155;">${pObj.memo}</div>`;
        if (pObj.supplies) content += `<div style="margin-top:6px; font-size:0.85rem; color:#b91c1c; font-weight:bold; background:#fef2f2; padding:4px; border-radius:4px;">${pObj.supplies}</div>`;
        
        return `<td style="vertical-align: top; text-align: left; padding: 8px; height: var(--week-cell-height);">${content}</td>`;
      }).join('');

      return `
        <tr>
          <td rowspan="${store.showClass ? 3 : 1}" class="${isToday ? 'week-today-cell' : ''}" style="width: 70px; vertical-align: middle; text-align: center; padding: 8px 4px;">
            <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
              <span onclick="window.goToDay('${d.dateStr}')" style="font-size:1.8rem; font-weight:900; color:${dateColor}; line-height:1; cursor: pointer;" title="${d.dateStr} 일 보기로 이동">${d.day}</span>
              <span style="font-size:0.95rem; font-weight:600; color:${dateNumColor}; line-height:1;">${d.dateDisplay}</span>
              ${holidayName ? `<span style="font-size:0.75rem; color:#ef4444; font-weight:bold; margin-top:2px;">${holidayName}</span>` : ''}
            </div>
          </td>
          <td style="width: 50px; font-weight: bold; background: #eff6ff; color: #1e40af; vertical-align: middle; text-align: center;">일정</td>
          <td colspan="${this.maxPeriod}" style="text-align: left; padding: 8px 10px; background: #f8fafc;">${eventHtml}</td>
        </tr>
        <tr style="${store.showClass ? '' : 'display:none;'}">
          <td rowspan="2" style="font-weight: bold; background: #f1f5f9; color: #475569; vertical-align: middle; text-align: center;">수업</td>
          ${(store.periodNames || ["1","2","3","4","5","6"]).map(name => `<td style="font-weight: bold; background: #f8fafc; color: #334155; width: ${100 / this.maxPeriod}%; text-align: center;">${name}</td>`).join('')}
        </tr>
        <tr style="${store.showClass ? '' : 'display:none;'}">${periodCellsHtml}</tr>
      `;
    }).join('');

    this.container.innerHTML = `
      <div class="clean-viewer-board">
        <div style="display:flex; justify-content:flex-end; align-items:center; margin-bottom:8px; ${store.showClass ? '' : 'display:none;'}">
           ${wsSelectHtml}
        </div>
        <table><tbody>${rowsHtml}</tbody></table>
      </div>`;
  }

  async renderEditor() {
    this.showLoading('편집 화면을 준비 중...');

    const weekDates = this.getWeekDates();
    const { eMap, sMap } = await this.fetchWeekData(weekDates[0].dateStr, weekDates[weekDates.length - 1].dateStr);
    
    const realTodayStr = formatDate(new Date());
    const masterLabels = getEventLabels(); 

    const wsSelectHtml = `
        <div style="display:inline-flex; background:#f0fdf4; padding:3px; border-radius:8px; border:1px solid #bbf7d0; align-items:center;">
            <div onclick="window.weekViewInstance.changeScheduleWorkspace(null)" style="padding:4px 12px; font-size:0.85rem; border-radius:6px; cursor:pointer; font-weight:bold; transition:0.2s; ${!this.scheduleGroupId ? 'background:#fff; color:#0f766e; box-shadow:0 1px 3px rgba(0,0,0,0.1);' : 'color:#94a3b8;'}">🔒 개인 시간표</div>
            ${this.myGroups.map(g => `<div onclick="window.weekViewInstance.changeScheduleWorkspace('${g.id}')" style="padding:4px 12px; font-size:0.85rem; border-radius:6px; cursor:pointer; font-weight:bold; transition:0.2s; ${this.scheduleGroupId === g.id ? 'background:#fff; color:#0f766e; box-shadow:0 1px 3px rgba(0,0,0,0.1);' : 'color:#94a3b8;'}">👥 ${g.name} 시간표</div>`).join('')}
        </div>
    `;

    const rowsHtml = weekDates.map(d => {
      const periods = sMap[d.dateStr] || {};
      const eventList = eMap[d.dateStr]?.eventList || [];
      
      window[`tempEvents_${d.dateStr}`] = eventList.map(e => {
          let labelIds = e.labelIds || [];
          if (labelIds.length === 0 && (e.labels || e.label)) {
              (e.labels || [e.label]).forEach(name => {
                  const match = masterLabels.find(l => l.name === name);
                  if (match && match.id && !labelIds.includes(match.id)) labelIds.push(match.id);
              });
          }
          return { ...e, labelIds, sharedGroupId: e.sharedGroupId || null, groupName: e.groupName || '' };
      });
      window[`tempSchedules_${d.dateStr}`] = periods;
      
      const compactEditorHtml = `<div id="compact-events-${d.dateStr}" style="display:flex; flex-direction:column; gap:4px;">${this.generateCompactEventEditor(d.dateStr)}</div>`; 

      const isToday = (d.dateStr === realTodayStr);
      const isRed = isRedDay(d.dateStr, window[`tempEvents_${d.dateStr}`]);
      const isSat = d.dayOfWeekNum === 6;

      const dateColor = isRed ? '#ef4444' : (isSat ? '#3b82f6' : '#1e40af');
      const dateNumColor = isRed ? '#ef4444' : (isSat ? '#3b82f6' : '#475569');
      const holidayName = getHolidayName(d.dateStr);

      const periodCellsHtml = Array.from({ length: this.maxPeriod }).map((_, i) => {
        const pObj = periods[i + 1] || {};
        let cellText = "";
        if (pObj.subject && pObj.subject.toUpperCase() !== 'X') cellText += `[${pObj.subject}] `;
        if (pObj.memo) cellText += pObj.memo + " ";
        if (pObj.supplies) cellText += `[${pObj.supplies}]`;
        
        return `<td class="editable-cell week-period-cell" data-p="${i + 1}" contenteditable="true" style="vertical-align: top; height: var(--week-cell-height); text-align: left; padding: 6px 8px; white-space: pre-wrap;" oninput="window.weekViewInstance.syncScheduleInputs()">${cellText.trim()}</td>`;
      }).join('');

      return `
        <tr data-week-date="${d.dateStr}">
          <td rowspan="${store.showClass ? 3 : 1}" class="${isToday ? 'week-today-cell' : ''}" style="width: 70px; vertical-align: middle; text-align: center; padding: 8px 4px;">
            <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
              <span onclick="window.goToDay('${d.dateStr}')" style="font-size:1.8rem; font-weight:900; color:${dateColor}; line-height:1; cursor: pointer;" title="${d.dateStr} 일 보기로 이동">${d.day}</span>
              <span style="font-size:0.95rem; font-weight:600; color:${dateNumColor}; line-height:1;">${d.dateDisplay}</span>
              ${holidayName ? `<span style="font-size:0.75rem; color:#ef4444; font-weight:bold; margin-top:2px;">${holidayName}</span>` : ''}
            </div>
          </td>
          <td style="width: 50px; font-weight: bold; background: #eff6ff; color: #1e40af; vertical-align: middle; text-align: center;">
              일정<br>
              <button onclick="window.weekViewInstance.addCompactEvent('${d.dateStr}')" style="margin-top:6px; background:#dbeafe; color:#2563eb; border:1px dashed #93c5fd; border-radius:4px; padding:2px 8px; cursor:pointer; font-weight:bold; font-size:1.1rem; box-shadow:0 1px 2px rgba(0,0,0,0.05);" title="일정 추가">+</button>
          </td>
          <td colspan="${this.maxPeriod}" style="text-align: left; padding: 8px 10px; background: #f8fafc;">${compactEditorHtml}</td>
        </tr>
        <tr style="${store.showClass ? '' : 'display:none;'}">
          <td rowspan="2" style="font-weight: bold; background: #f1f5f9; color: #475569; vertical-align: middle; text-align: center;">수업</td>
          ${(store.periodNames || ["1","2","3","4","5","6"]).map(name => `<td style="font-weight: bold; background: #f8fafc; color: #334155; width: ${100 / this.maxPeriod}%; text-align: center;">${name}</td>`).join('')}
        </tr>
        <tr data-week-schedule-date="${d.dateStr}" style="${store.showClass ? '' : 'display:none;'}">${periodCellsHtml}</tr>
      `;
    }).join('');

    this.container.innerHTML = `
      <div class="table-container">
        <div style="display:flex; justify-content:flex-end; align-items:center; margin-bottom:8px; ${store.showClass ? '' : 'display:none;'}">
           ${wsSelectHtml}
        </div>
        <table><tbody>${rowsHtml}</tbody></table>
      </div>`;
  }

  changeEventGroup(dateStr, idx, newGroupId) {
      this.syncCompactEventInputs(dateStr); 
      store.hasUnsavedChanges = true;
      if (window[`tempEvents_${dateStr}`]?.[idx]) {
          window[`tempEvents_${dateStr}`][idx].sharedGroupId = newGroupId || null;
          const g = (this.myGroups || []).find(x => x.id === newGroupId);
          window[`tempEvents_${dateStr}`][idx].groupName = g ? g.name : '';
          
          const container = document.getElementById(`compact-events-${dateStr}`);
          if (container) {
              container.innerHTML = this.generateCompactEventEditor(dateStr);
          }
      }
  }

  generateCompactEventEditor(dateStr) {
      const list = window[`tempEvents_${dateStr}`] || [];
      const labelObjs = getEventLabels();
      const realTodayStr = formatDate(new Date());
      
      return list.map((e, idx) => {
          const eLabelIds = e.labelIds || [];
          const isCompleted = !!e.completed;
          const canComplete = eLabelIds.some(id => labelObjs.find(l => l.id === id)?.isForward);
          
          const groupButtonsHtml = `
              <div style="display:inline-flex; background:#f1f5f9; padding:2px; border-radius:6px; border:1px solid #cbd5e1; align-items:center;">
                  <div onclick="(window.weekViewInstance || window.monthViewInstance || window.yearViewInstance).changeEventGroup('${dateStr}', ${idx}, null)" style="padding:3px 8px; font-size:0.75rem; border-radius:4px; cursor:pointer; font-weight:bold; transition:0.2s; ${!e.sharedGroupId ? 'background:#fff; color:#2563eb; box-shadow:0 1px 3px rgba(0,0,0,0.1);' : 'color:#64748b;'}">🔒 개인</div>
                  ${(this.myGroups || []).map(g => `<div onclick="(window.weekViewInstance || window.monthViewInstance || window.yearViewInstance).changeEventGroup('${dateStr}', ${idx}, '${g.id}')" style="padding:3px 8px; font-size:0.75rem; border-radius:4px; cursor:pointer; font-weight:bold; transition:0.2s; ${e.sharedGroupId === g.id ? 'background:#fff; color:#2563eb; box-shadow:0 1px 3px rgba(0,0,0,0.1);' : 'color:#64748b;'}">👥 ${g.name}</div>`).join('')}
              </div>
          `;

          let warningIcon = '';
          if (canComplete) {
              if (!isCompleted && dateStr < realTodayStr) warningIcon = `<span style="color:#ef4444; font-weight:bold; font-size:0.8rem; margin-left:8px; align-self:center;">➡️ (미완료)</span>`;
              else if (e.originalDate && e.originalDate < dateStr) warningIcon = `<span style="color:#2563eb; font-weight:bold; font-size:0.8rem; margin-left:8px; align-self:center;">↪️ (이월됨)</span>`;
          }

          const chipsHtml = labelObjs.map(lObj => 
              `<div class="label-chip ${eLabelIds.includes(lObj.id) ? 'active' : ''}" onclick="window.handleCompactLabelClick('${dateStr}', ${idx}, '${lObj.id}')" style="padding:2px 8px; font-size:0.8rem; min-width:auto; cursor:pointer;">${lObj.name}</div>`
          ).join('') + warningIcon;

          const checkboxHtml = canComplete 
              ? `<div style="padding-top:8px;"><input type="checkbox" ${isCompleted ? 'checked' : ''} onchange="(window.weekViewInstance || window.monthViewInstance || window.yearViewInstance).updateCompactEvent('${dateStr}', ${idx}, 'completed', this.checked); document.getElementById('compact-events-${dateStr}').innerHTML = (window.weekViewInstance || window.monthViewInstance || window.yearViewInstance).generateCompactEventEditor('${dateStr}');" style="width:18px; height:18px; cursor:pointer; accent-color:#059669;" title="완료 체크"></div>`
              : '';

          const inputStyle = (isCompleted && canComplete) ? 'text-decoration:line-through; color:#94a3b8; background:#e2e8f0;' : 'background:#fff; color:#1e293b;';
          const pureContent = (e.content || '').replace(/➡️\s*\(미완료\)/g, '').replace(/➡️\s*\(다음 날로 이월됨\)/g, '').replace(/↪️\s*/g, '').trim();

          return `
          <div class="compact-event-row" data-idx="${idx}" style="border:1px solid #cbd5e1; border-radius:6px; padding:8px; margin-bottom:8px; background:#f8fafc; display:flex; flex-direction:column; gap:6px; transition:0.2s;">
              <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                  <div class="label-chip-container" style="margin:0; display:flex; flex-wrap:wrap; gap:4px; align-items:center; flex:1;">
                      ${chipsHtml}
                  </div>
                  <div style="display:flex; align-items:center; gap:8px; flex-shrink:0;">
                      ${groupButtonsHtml}
                      <button onclick="(window.weekViewInstance || window.monthViewInstance || window.yearViewInstance).requestRemoveCompactEvent('${dateStr}', ${idx})" style="background:none; border:none; color:#ef4444; font-size:1.1rem; cursor:pointer; padding:0; line-height:1;" title="삭제">✖</button>
                  </div>
              </div>
              <div style="display:flex; align-items:flex-start; gap:8px; width:100%;">
                  ${checkboxHtml}
                  <textarea placeholder="일정 내용을 입력하세요." style="flex:1; padding:6px 8px; font-size:0.95rem; border:1px solid #cbd5e1; border-radius:4px; outline:none; resize:none; min-height:40px; box-sizing:border-box; ${inputStyle}" onfocus="this.style.height = this.scrollHeight + 'px';" oninput="this.style.height = '40px'; this.style.height = this.scrollHeight + 'px'; (window.weekViewInstance || window.monthViewInstance || window.yearViewInstance).updateCompactEvent('${dateStr}', ${idx}, 'content', this.value)">${pureContent}</textarea>
              </div>
          </div>`;
      }).join('');
  }

  syncCompactEventInputs(dateStr) {
      const container = document.getElementById(`compact-events-${dateStr}`);
      if (!container) return;
      container.querySelectorAll('textarea').forEach((ta, idx) => {
          if (window[`tempEvents_${dateStr}`]?.[idx]) window[`tempEvents_${dateStr}`][idx].content = ta.value;
      });
  }

  syncAllCompactEventInputs() {
      this.getWeekDates().forEach(d => this.syncCompactEventInputs(d.dateStr));
  }

  syncScheduleInputs() {
      document.querySelectorAll(`tr[data-week-schedule-date]`).forEach(row => {
          const dateStr = row.getAttribute('data-week-schedule-date');
          window[`tempSchedules_${dateStr}`] = window[`tempSchedules_${dateStr}`] || {};

          row.querySelectorAll('.week-period-cell').forEach(cell => {
              const p = cell.getAttribute('data-p');
              let text = cell.innerText?.trim() || '';
              let subject = '', memo = '', supplies = '';

              if (text !== '') {
                  const allBrackets = text.match(/\[.*?\]/g);
                  if (allBrackets && allBrackets.length >= 2) {
                      const lastMatch = text.match(/\[([^\]]+)\]\s*$/);
                      supplies = lastMatch ? lastMatch[1].trim() : "";
                      text = text.replace(/\[([^\]]+)\]\s*$/, '').trim(); 
                  }
                  const firstMatch = text.match(/^\[(.*?)\]/);
                  if (firstMatch) {
                      subject = firstMatch[1].trim();
                      memo = text.replace(/^\[(.*?)\]\s*/, '').trim();
                  } else {
                      memo = text;
                  }
              }
              window[`tempSchedules_${dateStr}`][p] = { subject: subject.toUpperCase() === 'X' ? '' : subject, memo, supplies };
          });
      });
  }

  toggleCompactEventLabel(dateStr, idx, labelId) {
      this.syncCompactEventInputs(dateStr);
      store.hasUnsavedChanges = true;
      const ev = window[`tempEvents_${dateStr}`][idx];
      if (!ev) return;
      
      ev.labelIds = ev.labelIds || [];
      ev.labelIds = ev.labelIds.includes(labelId) ? ev.labelIds.filter(id => id !== labelId) : [...ev.labelIds, labelId];
      
      document.getElementById(`compact-events-${dateStr}`).innerHTML = this.generateCompactEventEditor(dateStr);
  }

  updateCompactEvent(dateStr, idx, field, value) {
      store.hasUnsavedChanges = true;
      if (window[`tempEvents_${dateStr}`]?.[idx]) window[`tempEvents_${dateStr}`][idx][field] = value;
  }

  addCompactEvent(dateStr) {
      this.syncCompactEventInputs(dateStr); 
      store.hasUnsavedChanges = true;
      window[`tempEvents_${dateStr}`] = window[`tempEvents_${dateStr}`] || [];
      window[`tempEvents_${dateStr}`].push({ labelIds: [], content: '', completed: false, sharedGroupId: null });
      document.getElementById(`compact-events-${dateStr}`).innerHTML = this.generateCompactEventEditor(dateStr);
  }

  requestRemoveCompactEvent(dateStr, idx) {
      this.syncCompactEventInputs(dateStr); 
      const ev = window[`tempEvents_${dateStr}`][idx];
      const isGrouped = !!ev.groupId; 
      
      const labelObjs = getEventLabels();
      const forwardLabelId = (ev.labelIds || []).find(id => labelObjs.find(l => l.id === id)?.isForward);
      const forwardLabelName = forwardLabelId ? labelObjs.find(l=>l.id===forwardLabelId).name : '';

      if (isGrouped && ev.groupId.startsWith('group_')) {
          window.showGroupDeleteModal(dateStr, ev.labelIds[0] || '', ev.content, ev.groupId, 
              () => window.render(), 
              () => this.removeCompactEvent(dateStr, idx)
          );
      } else if (forwardLabelId && ev.forwardChainId) {
          window.showForwardDeleteModal(dateStr, forwardLabelName, ev.content, ev.forwardChainId, () => window.render());
      } else {
          this.removeCompactEvent(dateStr, idx);
      }
  }

  removeCompactEvent(dateStr, idx) {
      store.hasUnsavedChanges = true;
      window[`tempEvents_${dateStr}`].splice(idx, 1);
      document.getElementById(`compact-events-${dateStr}`).innerHTML = this.generateCompactEventEditor(dateStr);
  }

  save() {
    this.syncScheduleInputs();
    this.syncAllCompactEventInputs(); 
    
    const snapshot = this.getWeekDates().map(d => {
        const dateStr = d.dateStr;
        const validEvents = (window[`tempEvents_${dateStr}`] || [])
            .filter(e => e.content?.trim() || e.labelIds?.length > 0)
            .map(e => ({...e}));
        return { 
            dateStr, 
            validEvents, 
            periodsData: JSON.parse(JSON.stringify(window[`tempSchedules_${dateStr}`] || {})) 
        };
    });

    const masterLabels = getEventLabels();
    
    snapshot.forEach(item => {
        const eventsByGroup = { 'personal': [] };
        this.myGroups.forEach(g => eventsByGroup[g.id] = []);

        item.validEvents.forEach(e => {
            const gId = e.sharedGroupId || 'personal';
            if (eventsByGroup[gId]) eventsByGroup[gId].push(e);
        });

        const pEvents = eventsByGroup['personal'];
        setDoc(doc(getUserCol('events'), item.dateStr), {
            eventList: pEvents,
            eventText: window.formatEventListToText ? window.formatEventListToText(pEvents) : '', 
            updatedAt: Date.now()
        }, { merge: true }).catch(e => console.warn(e));

        this.myGroups.forEach(g => {
            const gEvents = eventsByGroup[g.id];
            setDoc(doc(getGroupCol(g.id, 'events'), item.dateStr), {
                eventList: gEvents,
                eventText: window.formatEventListToText ? window.formatEventListToText(gEvents) : '',
                updatedAt: Date.now()
            }, { merge: true }).catch(e => console.warn(e));
        });

        const scheduleCol = this.scheduleGroupId ? getGroupCol(this.scheduleGroupId, 'schedules') : getUserCol('schedules');
        const isSkipDay = item.validEvents.some(e => e.labelIds?.some(id => masterLabels.find(l => l.id === id)?.isSkip));
        if (isSkipDay) {
            Object.values(item.periodsData).forEach(p => p.subject = '');
        }
        
        setDoc(doc(scheduleCol, item.dateStr), { 
            periods: item.periodsData, updatedAt: Date.now() 
        }, { merge: true }).catch(e => console.warn(e));
    });
  }
}

const instance = new WeekView(document.getElementById("main-view"));

Object.assign(window, {
    weekViewInstance: instance,
    renderWeekViewer: (c) => { instance.container = c; instance.renderViewer(); },
    renderWeekEditor: (c) => { instance.container = c; instance.renderEditor(); },
    saveWeekDataFromEditor: () => instance.save(),
    
    handleCompactLabelClick: async (dateStr, idx, labelId) => {
        if (window.weekViewInstance) window.weekViewInstance.syncCompactEventInputs(dateStr);
        store.hasUnsavedChanges = true;
        
        const ev = window[`tempEvents_${dateStr}`]?.[idx];
        if (!ev) return;
        ev.labelIds = ev.labelIds || [];
        
        const isActive = ev.labelIds.includes(labelId);
        const labelObj = getEventLabels().find(l => l.id === labelId);

        if (isActive) {
            ev.labelIds = ev.labelIds.filter(id => id !== labelId);
        } else {
            if (labelObj?.isPeriod || labelObj?.isRecur) {
                const evContent = ev.content || '';
                const backupEvent = { ...ev };
                
                if(window.weekViewInstance) window.weekViewInstance.syncScheduleInputs();
                if(window.monthViewInstance) window.monthViewInstance.syncScheduleInputs();

                window[`tempEvents_${dateStr}`].splice(idx, 1);
                window.saveCurrentViewData(true);
                
                const callback = (isSaved) => { 
                    if(isSaved) window.render(); 
                    else {
                        window[`tempEvents_${dateStr}`] = window[`tempEvents_${dateStr}`] || [];
                        window[`tempEvents_${dateStr}`].push(backupEvent);
                        window.saveCurrentViewData(true);
                        setTimeout(() => window.render(), 100);
                    }
                };

                labelObj.isPeriod 
                    ? window.openPeriodModal(dateStr, labelObj.name, evContent, callback, labelId)
                    : window.openRecurringModal(dateStr, labelObj.name, evContent, callback, labelId);
                return; 
            }
            
            if (labelObj?.isForward) {
                ev.labelIds = ev.labelIds.filter(id => {
                    const lObj = getEventLabels().find(x => x.id === id);
                    return !(lObj && (lObj.isPeriod || lObj.isRecur));
                });
            }
            ev.labelIds.push(labelId);
        }
        
        const container = document.getElementById(`compact-events-${dateStr}`);
        if (container) {
            container.innerHTML = window.weekViewInstance 
                ? window.weekViewInstance.generateCompactEventEditor(dateStr) 
                : (window.monthViewInstance ? window.monthViewInstance.generateCompactEventEditor(dateStr) : window.yearViewInstance.generateCompactEventEditor(dateStr));
        }
    }
});