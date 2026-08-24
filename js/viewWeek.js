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
    this.scheduleGroupId = null; // 에디터 모드 전용 (단일 선택)
    this.activeEventFilters = null;
    this.activeScheduleFilters = null; // 🌟 뷰어 모드 전용 (중복 선택)
  }

  getEventFilterHtml(instanceName) {
      if (!this.activeEventFilters) {
          this.activeEventFilters = ['personal', ...this.myGroups.map(g => g.id)];
      }
      const isPersonalActive = this.activeEventFilters.includes('personal');
      let html = `
          <div style="display:inline-flex; align-items:center; gap:6px; background:#f8fafc; padding:4px 8px; border-radius:8px; border:1px solid #e2e8f0; flex-wrap:wrap;">
              <span style="font-size:0.85rem; font-weight:bold; color:#64748b; margin-right:2px;">일정 보기:</span>
              <div onclick="window.toggleEventFilter('${instanceName}', 'personal')" style="padding:4px 12px; font-size:0.8rem; border-radius:6px; cursor:pointer; font-weight:bold; transition:0.2s; ${isPersonalActive ? 'background:#3b82f6; color:#fff; box-shadow:0 1px 2px rgba(0,0,0,0.1);' : 'background:#e2e8f0; color:#94a3b8;'}">🔒 개인</div>
      `;
      this.myGroups.forEach(g => {
          const isActive = this.activeEventFilters.includes(g.id);
          html += `<div onclick="window.toggleEventFilter('${instanceName}', '${g.id}')" style="padding:4px 12px; font-size:0.8rem; border-radius:6px; cursor:pointer; font-weight:bold; transition:0.2s; ${isActive ? 'background:#10b981; color:#fff; box-shadow:0 1px 2px rgba(0,0,0,0.1);' : 'background:#e2e8f0; color:#94a3b8;'}">👥 ${g.name}</div>`;
      });
      html += `</div>`;
      return html;
  }

  getScheduleFilterHtml(instanceName) {
      if (!this.activeScheduleFilters) {
          this.activeScheduleFilters = ['personal'];
      }
      const isPersonalActive = this.activeScheduleFilters.includes('personal');
      let html = `
          <div style="display:inline-flex; align-items:center; gap:6px; background:#f0fdf4; padding:4px 8px; border-radius:8px; border:1px solid #bbf7d0; flex-wrap:wrap;">
              <span style="font-size:0.85rem; font-weight:bold; color:#0f766e; margin-right:2px;">시간표 보기:</span>
              <div onclick="window.toggleScheduleFilter('${instanceName}', 'personal')" style="padding:4px 12px; font-size:0.8rem; border-radius:6px; cursor:pointer; font-weight:bold; transition:0.2s; ${isPersonalActive ? 'background:#10b981; color:#fff; box-shadow:0 1px 2px rgba(0,0,0,0.1);' : 'background:#e2e8f0; color:#94a3b8;'}">🔒 개인</div>
      `;
      this.myGroups.forEach(g => {
          const isActive = this.activeScheduleFilters.includes(g.id);
          html += `<div onclick="window.toggleScheduleFilter('${instanceName}', '${g.id}')" style="padding:4px 12px; font-size:0.8rem; border-radius:6px; cursor:pointer; font-weight:bold; transition:0.2s; ${isActive ? 'background:#10b981; color:#fff; box-shadow:0 1px 2px rgba(0,0,0,0.1);' : 'background:#e2e8f0; color:#94a3b8;'}">👥 ${g.name}</div>`;
      });
      html += `</div>`;
      return html;
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

    const pSchedSnap = await getDocs(query(getUserCol('schedules'), where(documentId(), '>=', startStr), where(documentId(), '<=', endStr)));
    pSchedSnap.forEach(docSnap => {
        if (!sMap[docSnap.id]) sMap[docSnap.id] = {};
        sMap[docSnap.id]['personal'] = docSnap.data().periods || {};
    });

    for (const g of this.myGroups) {
        const gSchedSnap = await getDocs(query(getGroupCol(g.id, 'schedules'), where(documentId(), '>=', startStr), where(documentId(), '<=', endStr)));
        gSchedSnap.forEach(docSnap => {
            if (!sMap[docSnap.id]) sMap[docSnap.id] = {};
            sMap[docSnap.id][g.id] = docSnap.data().periods || {};
        });
    }

    return { eMap, sMap };
  }

  async renderViewer() {
    this.showLoading('클라우드에서 주간 데이터를 불러오는 중...'); 

    const weekDates = this.getWeekDates();
    const { eMap, sMap } = await this.fetchWeekData(weekDates[0].dateStr, weekDates[weekDates.length - 1].dateStr);
    const realTodayStr = formatDate(new Date());

    if (!this.activeEventFilters) this.activeEventFilters = ['personal', ...this.myGroups.map(g => g.id)];
    if (!this.activeScheduleFilters) this.activeScheduleFilters = ['personal'];

    const rowsHtml = weekDates.map(d => {
      const finalEvents = eMap[d.dateStr]?.eventList || [];
      
      const filteredEvents = finalEvents.filter(e => this.activeEventFilters.includes(e.sharedGroupId || 'personal'));
      const processedEvents = filteredEvents.length > 0 ? filteredEvents.map(e => ({ 
          ...e, 
          labelIds: e.labelIds || [],
          content: (e.sharedGroupId ? `<span style="display:inline-block; padding:2px 6px; font-size:0.75rem; border-radius:4px; background:#e0f2fe; color:#0369a1; border:1px solid #bae6fd; margin-right:4px; vertical-align:middle; font-weight:bold;">👥 ${e.groupName}</span> ` : '') + e.content
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
        const p = i + 1;
        let cellContentHtml = '';

        this.activeScheduleFilters.forEach((filterId, idx) => {
            const periods = sMap[d.dateStr]?.[filterId] || {};
            const pObj = periods[p] || {};
            
            let badge = '';
            if (this.activeScheduleFilters.length > 1) {
                const groupName = filterId === 'personal' ? '🔒 개인' : '👥 ' + (this.myGroups.find(g => g.id === filterId)?.name || '');
                const badgeColor = filterId === 'personal' ? '#2563eb' : '#059669';
                const badgeBg = filterId === 'personal' ? '#eff6ff' : '#ecfdf5';
                badge = `<span style="font-size:0.65rem; color:${badgeColor}; background:${badgeBg}; padding:1px 3px; border-radius:3px; margin-right:4px;">${groupName}</span>`;
            }

            const isLast = idx === this.activeScheduleFilters.length - 1;
            const borderStyle = isLast ? '' : 'border-bottom: 1px dashed #cbd5e1; padding-bottom:6px; margin-bottom:6px;';

            let content = '';
            if (pObj.subject && pObj.subject.toUpperCase() !== 'X') {
                content += `<div style="margin-bottom: 4px; font-weight:bold; color:#0f172a;">${badge}<span class="badge-tag">${pObj.subject}</span></div>`;
            } else if (badge && (pObj.memo || pObj.supplies)) {
                content += `<div style="margin-bottom: 4px;">${badge}</div>`;
            }

            if (pObj.memo) content += `<div class="clean-cell-memo" style="font-size:0.95rem; color:#334155; white-space:pre-wrap;">${pObj.memo}</div>`;
            if (pObj.supplies) content += `<div style="margin-top:4px; font-size:0.85rem; color:#b91c1c; font-weight:bold; background:#fef2f2; padding:2px 4px; border-radius:4px; white-space:pre-wrap;">${pObj.supplies}</div>`;
            
            if(content || badge) {
                cellContentHtml += `<div style="${borderStyle}">${content}</div>`;
            } else if (!isLast) {
                cellContentHtml += `<div style="${borderStyle} min-height:10px;"></div>`;
            }
        });

        return `<td style="vertical-align: top; text-align: left; padding: 8px; height: var(--week-cell-height);">${cellContentHtml}</td>`;
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
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; gap:10px; flex-wrap:wrap;">
           ${this.getEventFilterHtml('weekViewInstance')}
           <div style="${store.showClass ? '' : 'display:none;'}">${this.getScheduleFilterHtml('weekViewInstance')}</div>
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

    if (!this.activeEventFilters) {
        this.activeEventFilters = ['personal', ...this.myGroups.map(g => g.id)];
    }

    const wsSelectHtml = `
        <div style="display:inline-flex; background:#f0fdf4; padding:3px; border-radius:8px; border:1px solid #bbf7d0; align-items:center;">
            <div onclick="window.weekViewInstance.changeScheduleWorkspace(null)" style="padding:4px 12px; font-size:0.85rem; border-radius:6px; cursor:pointer; font-weight:bold; transition:0.2s; ${!this.scheduleGroupId ? 'background:#fff; color:#0f766e; box-shadow:0 1px 3px rgba(0,0,0,0.1);' : 'color:#94a3b8;'}">🔒 개인 시간표 작업공간</div>
            ${this.myGroups.map(g => `<div onclick="window.weekViewInstance.changeScheduleWorkspace('${g.id}')" style="padding:4px 12px; font-size:0.85rem; border-radius:6px; cursor:pointer; font-weight:bold; transition:0.2s; ${this.scheduleGroupId === g.id ? 'background:#fff; color:#0f766e; box-shadow:0 1px 3px rgba(0,0,0,0.1);' : 'color:#94a3b8;'}">👥 ${g.name} 편집</div>`).join('')}
        </div>
    `;

    const rowsHtml = weekDates.map(d => {
      const periods = sMap[d.dateStr]?.[this.scheduleGroupId || 'personal'] || {};
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
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; gap:10px; flex-wrap:wrap;">
           ${this.getEventFilterHtml('weekViewInstance')}
           <div style="${store.showClass ? '' : 'display:none;'}">${wsSelectHtml}</div>
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
      const uid = window.auth?.currentUser?.uid;
      const inst = 'window.weekViewInstance';
      
      return list.map((e, idx) => {
          const isVisible = this.activeEventFilters.includes(e.sharedGroupId || 'personal');
          const displayStyle = isVisible ? 'display:flex;' : 'display:none;';
          const isAuthor = !e.authorId || !uid || e.authorId === uid;

          const eLabelIds = e.labelIds || [];
          const isCompleted = !!e.completed;
          const canComplete = eLabelIds.some(id => labelObjs.find(l => l.id === id)?.isForward);
          
          let groupButtonsHtml = '';
          if (isAuthor) {
              groupButtonsHtml = `
                  <div style="display:inline-flex; background:#f1f5f9; padding:2px; border-radius:6px; border:1px solid #cbd5e1; align-items:center;">
                      <div onclick="${inst}.changeEventGroup('${dateStr}', ${idx}, null)" style="padding:3px 8px; font-size:0.75rem; border-radius:4px; cursor:pointer; font-weight:bold; transition:0.2s; ${!e.sharedGroupId ? 'background:#fff; color:#2563eb; box-shadow:0 1px 3px rgba(0,0,0,0.1);' : 'color:#64748b;'}">🔒 개인</div>
                      ${(this.myGroups || []).map(g => `<div onclick="${inst}.changeEventGroup('${dateStr}', ${idx}, '${g.id}')" style="padding:3px 8px; font-size:0.75rem; border-radius:4px; cursor:pointer; font-weight:bold; transition:0.2s; ${e.sharedGroupId === g.id ? 'background:#fff; color:#2563eb; box-shadow:0 1px 3px rgba(0,0,0,0.1);' : 'color:#64748b;'}">👥 ${g.name}</div>`).join('')}
                  </div>
              `;
          } else {
              groupButtonsHtml = `<div style="padding:3px 8px; font-size:0.75rem; border-radius:4px; font-weight:bold; background:#e0f2fe; color:#0369a1; border:1px solid #bae6fd;">👥 ${e.groupName} (읽기전용)</div>`;
          }

          let warningIcon = '';
          if (canComplete) {
              if (!isCompleted && dateStr < realTodayStr) warningIcon = `<span style="color:#ef4444; font-weight:bold; font-size:0.8rem; margin-left:8px; align-self:center;">➡️ (미완료)</span>`;
              else if (e.originalDate && e.originalDate < dateStr) warningIcon = `<span style="color:#2563eb; font-weight:bold; font-size:0.8rem; margin-left:8px; align-self:center;">↪️ (이월됨)</span>`;
          }

          const chipsHtml = labelObjs.map(lObj => {
              const chipClickAttr = isAuthor ? `onclick="window.handleCompactLabelClick('${dateStr}', ${idx}, '${lObj.id}')"` : '';
              const chipCursorStyle = isAuthor ? 'cursor:pointer;' : 'cursor:not-allowed; opacity:0.8;';
              return `<div class="label-chip ${eLabelIds.includes(lObj.id) ? 'active' : ''}" ${chipClickAttr} style="padding:2px 8px; font-size:0.8rem; min-width:auto; ${chipCursorStyle}">${lObj.name}</div>`;
          }).join('') + warningIcon;

          const checkboxHtml = canComplete 
              ? `<div style="padding-top:8px;"><input type="checkbox" ${isCompleted ? 'checked' : ''} ${!isAuthor ? 'disabled' : ''} onchange="${inst}.updateCompactEvent('${dateStr}', ${idx}, 'completed', this.checked); document.getElementById('compact-events-${dateStr}').innerHTML = ${inst}.generateCompactEventEditor('${dateStr}');" style="width:18px; height:18px; cursor:pointer; accent-color:#059669;" title="완료 체크"></div>`
              : '';

          const textBaseStyle = (isCompleted && canComplete) ? 'text-decoration:line-through; color:#94a3b8; background:#e2e8f0;' : 'background:#fff; color:#1e293b;';
          const textStyle = !isAuthor ? 'background:#f1f5f9; color:#64748b; cursor:not-allowed;' : textBaseStyle;
          const pureContent = (e.content || '').replace(/➡️\s*\(미완료\)/g, '').replace(/➡️\s*\(다음 날로 이월됨\)/g, '').replace(/↪️\s*/g, '').trim();

          const deleteBtnHtml = isAuthor 
                ? `<button onclick="${inst}.requestRemoveCompactEvent('${dateStr}', ${idx})" style="background:none; border:none; color:#ef4444; font-size:1.1rem; cursor:pointer; padding:0; line-height:1;" title="삭제">✖</button>`
                : '';

          return `
          <div class="compact-event-row" data-idx="${idx}" style="${displayStyle} border:1px solid #cbd5e1; border-radius:6px; padding:8px; margin-bottom:8px; background:#f8fafc; flex-direction:column; gap:6px; transition:0.2s;">
              <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                  <div class="label-chip-container" style="margin:0; display:flex; flex-wrap:wrap; gap:4px; align-items:center; flex:1;">
                      ${chipsHtml}
                  </div>
                  <div style="display:flex; align-items:center; gap:8px; flex-shrink:0;">
                      ${groupButtonsHtml}
                      ${deleteBtnHtml}
                  </div>
              </div>
              <div style="display:flex; align-items:flex-start; gap:8px; width:100%;">
                  ${checkboxHtml}
                  <textarea ${!isAuthor ? 'readonly' : ''} placeholder="${isAuthor ? '일정 내용을 입력하세요.' : '권한이 없습니다.'}" style="flex:1; padding:6px 8px; font-size:0.95rem; border:1px solid #cbd5e1; border-radius:4px; outline:none; resize:none; min-height:40px; box-sizing:border-box; ${textStyle}" onfocus="this.style.height = this.scrollHeight + 'px';" oninput="this.style.height = '40px'; this.style.height = this.scrollHeight + 'px'; ${inst}.updateCompactEvent('${dateStr}', ${idx}, 'content', this.value)">${pureContent}</textarea>
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

  updateCompactEvent(dateStr, idx, field, value) {
      store.hasUnsavedChanges = true;
      if (window[`tempEvents_${dateStr}`]?.[idx]) window[`tempEvents_${dateStr}`][idx][field] = value;
  }

  addCompactEvent(dateStr) {
      this.syncCompactEventInputs(dateStr); 
      store.hasUnsavedChanges = true;
      window[`tempEvents_${dateStr}`] = window[`tempEvents_${dateStr}`] || [];
      window[`tempEvents_${dateStr}`].push({ 
          id: 'ev_' + Date.now() + Math.random().toString(36).substr(2,5),
          authorId: window.auth?.currentUser?.uid,
          labelIds: [], content: '', completed: false, sharedGroupId: null 
      });
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
            .map(e => ({
                ...e,
                id: e.id || 'ev_' + Date.now() + Math.random().toString(36).substr(2,5),
                authorId: e.authorId || window.auth?.currentUser?.uid
            }));
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
        const scopeInstance = window[`${store.scope}ViewInstance`];
        if (scopeInstance) scopeInstance.syncCompactEventInputs(dateStr);
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
                
                if (scopeInstance && typeof scopeInstance.syncScheduleInputs === 'function') {
                    scopeInstance.syncScheduleInputs();
                }

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
        if (container && scopeInstance) {
            container.innerHTML = scopeInstance.generateCompactEventEditor(dateStr);
        }
    }
});
