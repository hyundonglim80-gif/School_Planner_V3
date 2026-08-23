// js/viewMonth.js

import { BaseView } from './components/BaseView.js';
import { store } from './core/store.js';
import { formatDate, getEventLabels, isRedDay, getHolidayName } from './core/utils.js';
import { dbAPI, getUserCol, getGroupCol } from './firebase.js'; 
import { generateEventBadgesHTML, formatEventListToText } from './core/eventUtils.js';
import { query, where, documentId, getDocs, doc, setDoc } from "firebase/firestore";

export class MonthView extends BaseView {
  constructor(container) {
    super(container); 
    this.myGroups = [];
    this.scheduleGroupId = null; 
  }

  static setupGoToDay() {
    if (!window.goToDay) {
      window.goToDay = function(dateStr) {
        if (!dateStr) return;
        const parts = dateStr.split('-');
        if (parts.length === 3) {
          store.currentDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
          window.setScope('day');
        }
      };
    }
  }

  async changeScheduleWorkspace(newGroupId) {
      if (store.hasUnsavedChanges) {
          this.save(); 
      }
      this.scheduleGroupId = newGroupId || null;
      
      if (store.mode === 'editor') this.renderEditor();
      else this.renderViewer();
  }

  async fetchMonthData(startStr, endStr) {
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
    this.showLoading('클라우드에서 월간 일정을 불러오는 중...'); 

    const y = store.currentDate.getFullYear();
    const m = store.currentDate.getMonth();
    const lastDate = new Date(y, m + 1, 0).getDate();
    const startStr = `${y}-${String(m+1).padStart(2, '0')}-01`;
    const endStr = `${y}-${String(m+1).padStart(2, '0')}-${String(lastDate).padStart(2, '0')}`;

    const { eMap, sMap } = await this.fetchMonthData(startStr, endStr);

    const wsOptions = `<option value="">🔒 내 개인 시간표</option>` +
        this.myGroups.map(g => `<option value="${g.id}" ${this.scheduleGroupId === g.id ? 'selected' : ''}>👥 [${g.name}] 공유 시간표</option>`).join('');
    const wsSelectHtml = `<select onchange="window.monthViewInstance.changeScheduleWorkspace(this.value)" style="padding:4px 8px; border-radius:6px; border:1px solid #cbd5e1; font-weight:bold; color:#0f766e; background:#f0fdf4; outline:none; cursor:pointer;">${wsOptions}</select>`;

    const daysList = this.isWeekendVisible ? ['일','월','화','수','목','금','토'] : ['월','화','수','목','금'];
    const daysHeaderHtml = daysList.map(d => {
        let color = d === '일' ? 'color:#ef4444;' : (d === '토' ? 'color:#3b82f6;' : '');
        return `<div class="cal-header" style="${color}">${d}</div>`;
    }).join('');
    
    const firstDay = new Date(y, m, 1).getDay(); 
    let padding = this.isWeekendVisible ? firstDay : (firstDay >= 1 && firstDay <= 5 ? firstDay - 1 : 0);
    const paddingHtml = Array.from({ length: padding }).map(() => `<div class="cal-day" style="background:#f8fafc;"></div>`).join('');

    const realTodayStr = formatDate(new Date());

    const daysHtml = Array.from({ length: lastDate }).map((_, i) => {
        const d = i + 1;
        const dateStr = `${y}-${String(m+1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const dayOfWeekNum = new Date(y, m, d).getDay();
        
        if (!this.isWeekendVisible && (dayOfWeekNum === 0 || dayOfWeekNum === 6)) return '';

        const finalEvents = eMap[dateStr]?.eventList || [];
        
        const processedEvents = finalEvents.length > 0 ? finalEvents.map(e => ({ 
            ...e, 
            labelIds: e.labelIds || [],
            content: (e.sharedGroupId ? `[👥 ${e.groupName}] ` : '') + e.content
        })) : [];
        
        const eventHtml = processedEvents.length > 0 ? `<div style="margin-top:4px;">${generateEventBadgesHTML(processedEvents, dateStr, 'compact')}</div>` : '';

        const dayPeriods = sMap[dateStr] || {};
        let hasClass = false;
        
        const boxesHtml = Array.from({ length: this.maxPeriod }).map((_, pi) => {
            const p = pi + 1;
            const subject = dayPeriods[p]?.subject;
            if (subject && subject.trim() !== '' && subject.toUpperCase() !== 'X') {
                hasClass = true;
                const text = subject.trim();
                let fontSize = text.length >= 5 ? "0.45rem" : (text.length === 4 ? "0.55rem" : (text.length === 3 ? "0.65rem" : "0.75rem"));
                let letterSpacing = text.length >= 5 ? "-1.5px" : (text.length === 4 ? "-1px" : (text.length === 3 ? "-0.5px" : "normal"));
                return `<div style="display:flex; align-items:center; justify-content:center; flex:1; min-width:0; height:22px; box-sizing:border-box; border:1px solid #6ee7b7; border-radius:4px; background:#ecfdf5; color:#047857; font-size:${fontSize}; font-weight:700; letter-spacing:${letterSpacing}; white-space:nowrap; overflow:hidden;" title="메모: ${dayPeriods[p].memo || '없음'}, 비고: ${dayPeriods[p].supplies || '없음'}">${text}</div>`;
            }
            return `<div style="display:flex; align-items:center; justify-content:center; flex:1; min-width:0; height:22px; box-sizing:border-box; border:1px solid #e2e8f0; border-radius:4px; background:#f8fafc; color:#94a3b8; font-size:0.75rem; font-weight:700;">&nbsp;</div>`;
        }).join('');

        const scheduleHtml = (hasClass && store.showClass) ? `<div style="display:flex; flex-wrap:nowrap; gap:2px; margin-top:4px; margin-bottom:4px; width:100%;">${boxesHtml}</div>` : '';

        const isRed = isRedDay(dateStr, processedEvents);
        const dateColor = isRed ? '#ef4444' : (dayOfWeekNum === 6 ? '#3b82f6' : '#334155');
        const holidayName = getHolidayName(dateStr);
        const holidayHtml = holidayName ? `<div style="font-size:0.65rem; color:#ef4444; margin-top:1px; line-height:1;">${holidayName}</div>` : '';
        const todayClass = (dateStr === realTodayStr) ? 'month-today-cell' : '';

        return `
          <div class="cal-day ${todayClass}">
              <div style="font-weight:700; color:${dateColor}; font-size:1.1rem; display:inline-block; cursor:pointer;" onclick="window.goToDay('${dateStr}')" title="${dateStr} 일 보기로 이동">${d}${holidayHtml}</div>
              ${scheduleHtml}
              ${eventHtml}
          </div>`;
    }).join('');

    this.container.innerHTML = `
        <div style="display:flex; justify-content:flex-end; align-items:center; margin-bottom:8px; ${store.showClass ? '' : 'display:none;'}">
           <span style="font-size:0.85rem; color:#64748b; margin-right:8px; font-weight:bold;">작업 공간:</span> ${wsSelectHtml}
        </div>
        <div class="calendar-grid" style="grid-template-columns: repeat(${this.isWeekendVisible ? 7 : 5}, 1fr);">${daysHeaderHtml}${paddingHtml}${daysHtml}</div>
    `;
  }

  async renderEditor() {
    this.showLoading('월간 편집 시트를 불러오는 중...');

    const y = store.currentDate.getFullYear();
    const m = store.currentDate.getMonth();
    const lastDate = new Date(y, m + 1, 0).getDate();
    const startStr = `${y}-${String(m+1).padStart(2, '0')}-01`;
    const endStr = `${y}-${String(m+1).padStart(2, '0')}-${String(lastDate).padStart(2, '0')}`;

    const { eMap, sMap } = await this.fetchMonthData(startStr, endStr);
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const masterLabels = getEventLabels(); 

    const wsOptions = `<option value="">🔒 내 개인 시간표</option>` +
        this.myGroups.map(g => `<option value="${g.id}" ${this.scheduleGroupId === g.id ? 'selected' : ''}>👥 [${g.name}] 공유 시간표</option>`).join('');
    const wsSelectHtml = `<select onchange="window.monthViewInstance.changeScheduleWorkspace(this.value)" style="padding:4px 8px; border-radius:6px; border:1px solid #cbd5e1; font-weight:bold; color:#0f766e; background:#f0fdf4; outline:none; cursor:pointer;">${wsOptions}</select>`;

    const rowsHtml = Array.from({ length: lastDate }).map((_, i) => {
        const d = i + 1;
        const dateStr = `${y}-${String(m+1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const dayOfWeekNum = new Date(y, m, d).getDay();
        const dayOfWeek = dayNames[dayOfWeekNum];

        if (!this.isWeekendVisible && (dayOfWeekNum === 0 || dayOfWeekNum === 6)) return '';

        const eventList = eMap[dateStr]?.eventList || [];
        const periods = sMap[dateStr] || {};

        window[`tempEvents_${dateStr}`] = eventList.map(e => {
            let labelIds = e.labelIds || [];
            if (labelIds.length === 0 && (e.labels || e.label)) {
                (e.labels || [e.label]).forEach(name => {
                    const match = masterLabels.find(l => l.name === name);
                    if (match && match.id && !labelIds.includes(match.id)) labelIds.push(match.id);
                });
            }
            return { ...e, labelIds, sharedGroupId: e.sharedGroupId || null, groupName: e.groupName || '' };
        });
        window[`tempSchedules_${dateStr}`] = periods;
        
        const compactEditorHtml = `<div id="compact-events-${dateStr}" style="display:flex; flex-direction:column; gap:4px;">` + 
            this.generateCompactEventEditor(dateStr) + 
            `</div>`; 

        const isRed = isRedDay(dateStr, window[`tempEvents_${dateStr}`]);
        const dateColor = isRed ? '#ef4444' : (dayOfWeekNum === 6 ? '#3b82f6' : '#1e40af');
        const dateNumColor = isRed ? '#ef4444' : (dayOfWeekNum === 6 ? '#3b82f6' : '#475569');
        const holidayName = getHolidayName(dateStr);
        const holidayHtml = holidayName ? `<span style="font-size:0.75rem; color:#ef4444; font-weight:bold; margin-top:2px;">${holidayName}</span>` : '';

        const periodCellsHtml = Array.from({ length: this.maxPeriod }).map((_, pi) => {
            const pObj = periods[pi + 1] || {};
            let cellText = "";
            if (pObj.subject && pObj.subject.toUpperCase() !== 'X') cellText += `[${pObj.subject}] `;
            if (pObj.memo) cellText += pObj.memo + " ";
            if (pObj.supplies) cellText += `[${pObj.supplies}]`;
            
            return `<td class="editable-cell edit-class-cell" data-p="${pi + 1}" contenteditable="true" style="padding:6px; border:1px solid #cbd5e1; font-size:1rem; color:#047857; background:#ecfdf5; vertical-align:top; white-space:pre-wrap; text-align:left;" oninput="window.monthViewInstance.syncScheduleInputs()">${cellText.trim()}</td>`;
        }).join('');

        return `
        <tr data-month-date="${dateStr}">
          <td rowspan="${store.showClass ? 2 : 1}" style="padding:8px 4px; border:1px solid #cbd5e1; background:#f8fafc; vertical-align:middle; width:80px;">
            <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
              <span onclick="window.goToDay('${dateStr}')" style="font-size:1.8rem; font-weight:900; color:${dateNumColor}; line-height:1; cursor:pointer;" title="${dateStr} 일 보기로 이동">${d}</span>
              <span style="font-size:1rem; font-weight:600; color:${dateColor}; line-height:1;">${dayOfWeek}</span>
              ${holidayHtml}
            </div>
          </td>
          <td style="padding:4px; border:1px solid #cbd5e1; background:#f0f9ff; color:#0369a1; font-weight:bold; font-size:0.9rem; vertical-align:middle; width:60px; text-align:center;">
              일정<br>
              <button onclick="window.monthViewInstance.addCompactEvent('${dateStr}')" style="margin-top:6px; background:#e0f2fe; color:#0369a1; border:1px dashed #7dd3fc; border-radius:4px; padding:2px 8px; cursor:pointer; font-weight:bold; font-size:1.1rem; box-shadow:0 1px 2px rgba(0,0,0,0.05);" title="일정 추가">+</button>
          </td>
          <td colspan="${this.maxPeriod}" style="text-align:left; padding:6px 10px; background:#f0f9ff; vertical-align:top;">${compactEditorHtml}</td>
        </tr>
        <tr data-month-sub="${dateStr}" style="${store.showClass ? '' : 'display:none;'}">
          <td style="padding:4px; border:1px solid #cbd5e1; background:#ecfdf5; color:#047857; font-weight:bold; font-size:0.9rem; vertical-align:middle; width:60px; text-align:center;">수업</td>
          ${periodCellsHtml}
        </tr>`;
    }).join('');

    this.container.innerHTML = `
      <div class="table-container" style="background:#fff; padding:12px; border-radius:8px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <h3 style="margin:0; color:#1e293b; font-size:var(--font-header-title);">📅 ${y}년 ${m+1}월 일정/수업 편집 시트</h3>
            <div style="${store.showClass ? '' : 'display:none;'}">
                <span style="font-size:0.85rem; color:#64748b; margin-right:8px; font-weight:bold;">작업 공간:</span>
                ${wsSelectHtml}
            </div>
        </div>
        <table style="width:100%; border-collapse:collapse; text-align:center;">
          <thead>
            <tr style="background:#f1f5f9;">
              <th style="width:80px; padding:8px; border:1px solid #cbd5e1;">날짜</th>
              <th style="width:60px; padding:8px; border:1px solid #cbd5e1;">구분</th>
              <th colspan="${this.maxPeriod}" style="padding:8px; border:1px solid #cbd5e1;">📌 내용 (직접 수정)</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>`;
  }

  changeEventGroup(dateStr, idx, newGroupId) {
      store.hasUnsavedChanges = true;
      if (window[`tempEvents_${dateStr}`]?.[idx]) {
          window[`tempEvents_${dateStr}`][idx].sharedGroupId = newGroupId || null;
          const g = (this.myGroups || []).find(x => x.id === newGroupId);
          window[`tempEvents_${dateStr}`][idx].groupName = g ? g.name : '';
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
          
          // 🌟 [V3.6 우측 정렬 버튼] 공유 대상을 칩 버튼 형태로 변경
          const groupButtonsHtml = `
              <div style="display:inline-flex; background:#f1f5f9; padding:2px; border-radius:6px; border:1px solid #cbd5e1; align-items:center;">
                  <div onclick="window.monthViewInstance.changeEventGroup('${dateStr}', ${idx}, null)" style="padding:3px 8px; font-size:0.75rem; border-radius:4px; cursor:pointer; font-weight:bold; transition:0.2s; ${e.sharedGroupId === null ? 'background:#fff; color:#2563eb; box-shadow:0 1px 3px rgba(0,0,0,0.1);' : 'color:#64748b;'}">🔒 개인</div>
                  ${(this.myGroups || []).map(g => `<div onclick="window.monthViewInstance.changeEventGroup('${dateStr}', ${idx}, '${g.id}')" style="padding:3px 8px; font-size:0.75rem; border-radius:4px; cursor:pointer; font-weight:bold; transition:0.2s; ${e.sharedGroupId === g.id ? 'background:#fff; color:#2563eb; box-shadow:0 1px 3px rgba(0,0,0,0.1);' : 'color:#64748b;'}">👥 ${g.name}</div>`).join('')}
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
              ? `<input type="checkbox" ${isCompleted ? 'checked' : ''} onchange="window.monthViewInstance.updateCompactEvent('${dateStr}', ${idx}, 'completed', this.checked); document.getElementById('compact-events-${dateStr}').innerHTML = window.monthViewInstance.generateCompactEventEditor('${dateStr}');" style="width:18px; height:18px; cursor:pointer; accent-color:#059669;" title="완료 체크">`
              : '';

          const inputStyle = (isCompleted && canComplete) ? 'text-decoration:line-through; color:#94a3b8; background:#e2e8f0;' : 'background:#fff; color:#1e293b;';
          const pureContent = (e.content || '').replace(/➡️\s*\(미완료\)/g, '').replace(/➡️\s*\(다음 날로 이월됨\)/g, '').replace(/↪️\s*/g, '').trim();

          return `
          <div class="compact-event-row" data-idx="${idx}" style="border:1px solid #cbd5e1; border-radius:6px; padding:8px; margin-bottom:8px; background:#f8fafc; display:flex; flex-direction:column; gap:6px; transition:0.2s;">
              <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                  <div class="label-chip-container" style="margin:0; display:flex; flex-wrap:wrap; gap:4px; align-items:center; flex:1;">
                      ${chipsHtml}
                  </div>
                  <!-- 🌟 우측에 공유 칩들과 삭제 버튼 나란히 배치 -->
                  <div style="display:flex; align-items:center; gap:8px; flex-shrink:0;">
                      ${groupButtonsHtml}
                      <button onclick="window.monthViewInstance.requestRemoveCompactEvent('${dateStr}', ${idx})" style="background:none; border:none; color:#ef4444; font-size:1.1rem; cursor:pointer; padding:0; line-height:1;" title="삭제">✖</button>
                  </div>
              </div>
              <div style="display:flex; align-items:flex-start; gap:8px; width:100%;">
                  ${canComplete ? `<div style="padding-top:8px;">${checkboxHtml}</div>` : ''}
                  <textarea placeholder="일정 내용을 입력하세요." style="flex:1; padding:6px 8px; font-size:0.95rem; border:1px solid #cbd5e1; border-radius:4px; outline:none; resize:none; min-height:40px; box-sizing:border-box; ${inputStyle}" onfocus="this.style.height = this.scrollHeight + 'px';" oninput="this.style.height = '40px'; this.style.height = this.scrollHeight + 'px'; window.monthViewInstance.updateCompactEvent('${dateStr}', ${idx}, 'content', this.value)">${pureContent}</textarea>
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
      document.querySelectorAll('[id^="compact-events-"]').forEach(el => {
          const dateStr = el.id.replace('compact-events-', '');
          this.syncCompactEventInputs(dateStr);
      });
  }

  syncScheduleInputs() {
      document.querySelectorAll(`tr[data-month-sub]`).forEach(row => {
          const dateStr = row.getAttribute('data-month-sub');
          window[`tempSchedules_${dateStr}`] = window[`tempSchedules_${dateStr}`] || {};

          row.querySelectorAll('.edit-class-cell').forEach(cell => {
              const p = cell.getAttribute("data-p");
              let text = cell.innerText?.trim() || "";
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
      if(window.weekViewInstance) window.weekViewInstance.toggleCompactEventLabel(dateStr, idx, labelId);
  }
  updateCompactEvent(dateStr, idx, field, value) {
      store.hasUnsavedChanges = true;
      if (window[`tempEvents_${dateStr}`]?.[idx]) window[`tempEvents_${dateStr}`][idx][field] = value;
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

  addCompactEvent(dateStr) {
      this.syncCompactEventInputs(dateStr); 
      store.hasUnsavedChanges = true;
      window[`tempEvents_${dateStr}`] = window[`tempEvents_${dateStr}`] || [];
      window[`tempEvents_${dateStr}`].push({ labelIds: [], content: '', completed: false, sharedGroupId: null });
      document.getElementById(`compact-events-${dateStr}`).innerHTML = this.generateCompactEventEditor(dateStr);
  }

  save() {
    this.syncScheduleInputs(); 
    this.syncAllCompactEventInputs();

    const y = store.currentDate.getFullYear();
    const m = store.currentDate.getMonth();
    const lastDate = new Date(y, m + 1, 0).getDate();

    const snapshot = [];
    for(let i=1; i<=lastDate; i++) {
        const dateStr = `${y}-${String(m+1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        const rawList = window[`tempEvents_${dateStr}`];
        if (rawList !== undefined) {
            const validEvents = rawList
                .filter(e => e.content?.trim() || e.labelIds?.length > 0)
                .map(e => ({...e}));
            const periodsData = JSON.parse(JSON.stringify(window[`tempSchedules_${dateStr}`] || {}));
            snapshot.push({ dateStr, validEvents, periodsData });
        }
    }

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
            eventText: formatEventListToText(pEvents),
            updatedAt: Date.now()
        }, { merge: true }).catch(e => console.warn(e));

        this.myGroups.forEach(g => {
            const gEvents = eventsByGroup[g.id];
            setDoc(doc(getGroupCol(g.id, 'events'), item.dateStr), {
                eventList: gEvents,
                eventText: formatEventListToText(gEvents),
                updatedAt: Date.now()
            }, { merge: true }).catch(e => console.warn(e));
        });

        const isSkipDay = item.validEvents.some(e => e.labelIds?.some(id => masterLabels.find(l => l.id === id)?.isSkip));
        if (isSkipDay) {
            Object.values(item.periodsData).forEach(p => p.subject = '');
        }

        const scheduleCol = this.scheduleGroupId ? getGroupCol(this.scheduleGroupId, 'schedules') : getUserCol('schedules');
        setDoc(doc(scheduleCol, item.dateStr), {
            periods: item.periodsData,
            updatedAt: Date.now()
        }, { merge: true }).catch(e => console.warn(e));
    });
  }
}

MonthView.setupGoToDay();

const instance = new MonthView(document.getElementById("main-view"));
Object.assign(window, {
    monthViewInstance: instance,
    renderMonthViewer: (c) => { instance.container = c; instance.renderViewer(); },
    renderMonthEditor: (c) => { instance.container = c; instance.renderEditor(); },
    saveMonthDataFromEditor: () => instance.save()
});