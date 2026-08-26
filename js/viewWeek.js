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

    if (this.container) {
        this.container.style.overflow = 'visible';
        this.container.style.overflowX = 'visible';
        this.container.style.overflowY = 'visible';
    }

    const weekDates = this.getWeekDates();
    const { eMap, sMap } = await this.fetchWeekData(weekDates[0].dateStr, weekDates[weekDates.length - 1].dateStr);
    const realTodayStr = formatDate(new Date());

    window.currentMyGroups = this.myGroups;
    if (!window.activeUnifiedFilters) window.activeUnifiedFilters = ['personal', ...this.myGroups.map(g => g.id)];
    if (window.FilterUI) window.FilterUI.renderUnifiedFilter(this.myGroups);

    const filters = window.activeUnifiedFilters;
    const filterCount = filters.length;
    const totalRows = filterCount + (store.showClass ? 1 + filterCount : 0);

    const rowsHtml = weekDates.map(d => {
      const isToday = (d.dateStr === realTodayStr);
      const isRed = isRedDay(d.dateStr, eMap[d.dateStr]?.eventList || []);
      const isSat = d.dayOfWeekNum === 6;
      const dateColor = isRed ? '#ef4444' : (isSat ? '#3b82f6' : '#1e40af');
      const dateNumColor = isRed ? '#ef4444' : (isSat ? '#3b82f6' : '#475569');
      const holidayName = getHolidayName(d.dateStr);

      let rowsHtmlForDate = '';

      // 1. 일정(Events) 영역 분리 렌더링
      filters.forEach((fId, idx) => {
          const isPersonal = fId === 'personal';
          const gIcon = isPersonal ? '🔒' : '👥'; 
          const badgeColor = isPersonal ? '#2563eb' : '#059669';
          const badgeBg = isPersonal ? '#eff6ff' : '#ecfdf5';
          const badgeHtml = filterCount > 1 ? `<div style="font-size:1.1rem; color:${badgeColor}; background:${badgeBg}; padding:2px 6px; border-radius:6px; display:inline-block; margin-top:4px; cursor:help;" title="${isPersonal ? '개인' : (this.myGroups.find(g => g.id === fId)?.name || '그룹')}">${gIcon}</div>` : '';

          const fEvents = (eMap[d.dateStr]?.eventList || []).filter(e => (e.sharedGroupId || 'personal') === fId);
          const processedEvents = fEvents.map(e => ({
              ...e, labelIds: e.labelIds || [], content: e.content
          }));
          const eventContent = processedEvents.length > 0 
              ? generateEventBadgesHTML(processedEvents, d.dateStr) 
              : '<span style="color:#94a3b8;">-</span>';

          if (idx === 0) {
              rowsHtmlForDate += `
              <tr data-week-date="${d.dateStr}" class="week-row-${d.dateStr}">
                <td rowspan="${totalRows}" class="${isToday ? 'week-today-cell' : ''}" style="width: 70px; vertical-align: middle; text-align: center; padding: 8px 4px; border: 1px solid #cbd5e1; position: static !important; z-index: auto !important; transform: none !important;">
                  <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
                    <span onclick="window.goToDay('${d.dateStr}')" style="font-size:1.8rem; font-weight:900; color:${dateColor}; line-height:1; cursor: pointer;" title="${d.dateStr} 일 보기로 이동">${d.day}</span>
                    <span style="font-size:0.95rem; font-weight:600; color:${dateNumColor}; line-height:1;">${d.dateDisplay}</span>
                    ${holidayName ? `<span style="font-size:0.75rem; color:#ef4444; font-weight:bold; margin-top:2px;">${holidayName}</span>` : ''}
                  </div>
                </td>
                <td style="width: 50px; font-weight: bold; background: #eff6ff; color: #1e40af; vertical-align: middle; text-align: center; border: 1px solid #cbd5e1; position: static !important; z-index: auto !important; transform: none !important;">
                    일정${badgeHtml}
                </td>
                <td colspan="${this.maxPeriod}" style="text-align: left; padding: 8px 10px; background: #f8fafc; border: 1px solid #cbd5e1;">${eventContent}</td>
              </tr>`;
          } else {
              rowsHtmlForDate += `
              <tr class="week-row-${d.dateStr}">
                <td style="width: 50px; font-weight: bold; background: #eff6ff; color: #1e40af; vertical-align: middle; text-align: center; border: 1px solid #cbd5e1; position: static !important; z-index: auto !important; transform: none !important;">
                    일정${badgeHtml}
                </td>
                <td colspan="${this.maxPeriod}" style="text-align: left; padding: 8px 10px; background: #f8fafc; border: 1px solid #cbd5e1;">${eventContent}</td>
              </tr>`;
          }
      });

      // 2. 수업(Schedules) 영역 분리 렌더링
      if (store.showClass) {
          const pNamesHtml = (store.periodNames || ["1","2","3","4","5","6"]).map(name => `<td style="font-weight: bold; background: #f8fafc; color: #334155; width: ${100 / this.maxPeriod}%; text-align: center; border: 1px solid #cbd5e1; position: static !important; z-index: auto !important; transform: none !important;">${name}</td>`).join('');
          
          rowsHtmlForDate += `
          <tr class="week-row-${d.dateStr}">
            <td style="font-weight: bold; background: #f1f5f9; color: #475569; vertical-align: middle; text-align: center; border: 1px solid #cbd5e1; position: static !important; z-index: auto !important; transform: none !important;">교시</td>
            ${pNamesHtml}
          </tr>`;

          filters.forEach((fId) => {
              const isPersonal = fId === 'personal';
              const gIcon = isPersonal ? '🔒' : '👥'; 
              const badgeColor = isPersonal ? '#2563eb' : '#059669';
              const badgeBg = isPersonal ? '#eff6ff' : '#ecfdf5';
              const badgeHtml = filterCount > 1 ? `<div style="font-size:1.1rem; color:${badgeColor}; background:${badgeBg}; padding:2px 6px; border-radius:6px; display:inline-block; margin-top:4px; cursor:help;" title="${isPersonal ? '개인' : (this.myGroups.find(g => g.id === fId)?.name || '그룹')}">${gIcon}</div>` : '';
              
              const periods = sMap[d.dateStr]?.[fId] || {};
              const periodCellsHtml = Array.from({ length: this.maxPeriod }).map((_, i) => {
                  const p = i + 1;
                  const pObj = periods[p] || {};
                  let content = '';
                  
                  if (pObj.subject && pObj.subject.toUpperCase() !== 'X') {
                      content += `<div style="margin-bottom: 4px; font-weight:bold; color:#0f172a;"><span class="badge-tag">${pObj.subject}</span></div>`;
                  }
                  if (pObj.memo) content += `<div class="clean-cell-memo" style="font-size:0.95rem; color:#334155; white-space:pre-wrap;">${pObj.memo}</div>`;
                  if (pObj.supplies) content += `<div style="margin-top:4px; font-size:0.85rem; color:#b91c1c; font-weight:bold; background:#fef2f2; padding:2px 4px; border-radius:4px; white-space:pre-wrap;">${pObj.supplies}</div>`;
                  
                  return `<td style="vertical-align: top; text-align: left; padding: 8px; height: var(--week-cell-height); border: 1px solid #cbd5e1;">${content}</td>`;
              }).join('');

              rowsHtmlForDate += `
              <tr data-week-schedule-date="${d.dateStr}" data-fid="${fId}" class="week-row-${d.dateStr}">
                <td style="padding:4px; border:1px solid #cbd5e1; background:#ecfdf5; color:#047857; font-weight:bold; font-size:0.9rem; vertical-align:middle; text-align:center; position: static !important; z-index: auto !important; transform: none !important;">
                    수업${badgeHtml}
                </td>
                ${periodCellsHtml}
              </tr>`;
          });
      }
      return rowsHtmlForDate;
    }).join('');

    this.container.innerHTML = `
      <div class="clean-viewer-board" style="overflow: visible; margin-top: 15px;">
        <table style="width:100%; border-collapse:collapse; text-align:center;"><tbody>${rowsHtml}</tbody></table>
      </div>`;
  }

  async renderEditor() {
    this.showLoading('편집 화면을 준비 중...');

    if (this.container) {
        this.container.style.overflow = 'visible';
        this.container.style.overflowX = 'visible';
        this.container.style.overflowY = 'visible';
    }

    const weekDates = this.getWeekDates();
    const { eMap, sMap } = await this.fetchWeekData(weekDates[0].dateStr, weekDates[weekDates.length - 1].dateStr);
    
    const realTodayStr = formatDate(new Date());
    const masterLabels = getEventLabels(); 

    window.currentMyGroups = this.myGroups;
    if (!window.activeUnifiedFilters) window.activeUnifiedFilters = ['personal', ...this.myGroups.map(g => g.id)];
    if (window.FilterUI) window.FilterUI.renderUnifiedFilter(this.myGroups);

    const filters = window.activeUnifiedFilters;
    const filterCount = filters.length;
    const maxP = store.periodNames ? store.periodNames.length : 6;
    const totalRows = filterCount + (store.showClass ? 1 + filterCount : 0);

    const rowsHtml = weekDates.map(d => {
      window[`tempEvents_${d.dateStr}`] = [];
      window[`tempSchedules_${d.dateStr}`] = {};

      filters.forEach(fId => {
          const periods = sMap[d.dateStr]?.[fId] || {};
          window[`tempSchedules_${d.dateStr}`][fId] = periods;

          const fEvents = (eMap[d.dateStr]?.eventList || []).filter(e => (e.sharedGroupId || 'personal') === fId);
          fEvents.forEach(e => {
              let labelIds = e.labelIds || [];
              if (labelIds.length === 0 && (e.labels || e.label)) {
                  (e.labels || [e.label]).forEach(name => {
                      const match = masterLabels.find(l => l.name === name);
                      if (match && match.id && !labelIds.includes(match.id)) labelIds.push(match.id);
                  });
              }
              window[`tempEvents_${d.dateStr}`].push({ ...e, labelIds, sharedGroupId: fId === 'personal' ? null : fId });
          });
      });

      const isToday = (d.dateStr === realTodayStr);
      const isRed = isRedDay(d.dateStr, window[`tempEvents_${d.dateStr}`]);
      const isSat = d.dayOfWeekNum === 6;
      const dateColor = isRed ? '#ef4444' : (isSat ? '#3b82f6' : '#1e40af');
      const dateNumColor = isRed ? '#ef4444' : (isSat ? '#3b82f6' : '#475569');
      const holidayName = getHolidayName(d.dateStr);

      let rowsHtmlForDate = '';

      // 1. 일정(Events) 영역 분리 렌더링
      filters.forEach((fId, idx) => {
          const isPersonal = fId === 'personal';
          const gIcon = isPersonal ? '🔒' : '👥'; 
          const badgeColor = isPersonal ? '#2563eb' : '#059669';
          const badgeBg = isPersonal ? '#eff6ff' : '#ecfdf5';
          const badgeHtml = filterCount > 1 ? `<div style="font-size:1.1rem; color:${badgeColor}; background:${badgeBg}; padding:2px 6px; border-radius:6px; display:inline-block; margin-top:4px; cursor:help;" title="${isPersonal ? '개인' : (this.myGroups.find(g => g.id === fId)?.name || '그룹')}">${gIcon}</div>` : '';

          const eventContent = `<div id="compact-events-${d.dateStr}-${fId}" style="display:flex; flex-direction:column; gap:4px;">${this.generateCompactEventEditor(d.dateStr, fId)}</div>`;
          const addBtnHtml = `<button onclick="window.weekViewInstance.addCompactEvent('${d.dateStr}', '${fId}')" style="margin-top:6px; background:#e0f2fe; color:#0369a1; border:1px dashed #7dd3fc; border-radius:4px; padding:2px 8px; cursor:pointer; font-weight:bold; font-size:1.1rem; box-shadow:0 1px 2px rgba(0,0,0,0.05);" title="일정 추가">+</button>`;

          if (idx === 0) {
              rowsHtmlForDate += `
              <tr data-week-date="${d.dateStr}" class="week-row-${d.dateStr}">
                <td rowspan="${totalRows}" class="${isToday ? 'week-today-cell' : ''}" style="padding:8px 4px; border:1px solid #cbd5e1; background:#f8fafc; vertical-align:middle; width:110px;">
                  <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
                    <span onclick="window.goToDay('${d.dateStr}')" style="font-size:1.2rem; font-weight:900; color:${dateNumColor}; line-height:1.1; cursor: pointer;" title="${d.dateStr} 일 보기로 이동">${d.dateDisplay}</span>
                    <span style="font-size:0.95rem; font-weight:600; color:${dateColor}; line-height:1;">${d.day}</span>
                    ${holidayName ? `<span style="font-size:0.75rem; color:#ef4444; font-weight:bold; margin-top:2px;">${holidayName}</span>` : ''}
                  </div>
                </td>
                <td style="padding:4px; border:1px solid #cbd5e1; background:#f0f9ff; color:#0369a1; font-weight:bold; font-size:0.9rem; vertical-align:middle; width:60px; text-align:center;">
                    일정${badgeHtml}<br>${addBtnHtml}
                </td>
                <td colspan="${this.maxPeriod}" style="text-align: left; padding: 6px 10px; background: #f0f9ff; vertical-align:top; border:1px solid #cbd5e1;">${eventContent}</td>
              </tr>`;
          } else {
              rowsHtmlForDate += `
              <tr class="week-row-${d.dateStr}">
                <td style="padding:4px; border:1px solid #cbd5e1; background:#f0f9ff; color:#0369a1; font-weight:bold; font-size:0.9rem; vertical-align:middle; width:60px; text-align:center;">
                    일정${badgeHtml}<br>${addBtnHtml}
                </td>
                <td colspan="${this.maxPeriod}" style="text-align: left; padding: 6px 10px; background: #f0f9ff; vertical-align:top; border:1px solid #cbd5e1;">${eventContent}</td>
              </tr>`;
          }
      });

      // 2. 수업(Schedules) 영역 분리 렌더링
      if (store.showClass) {
          const pNamesHtml = (store.periodNames || ["1","2","3","4","5","6"]).map(name => `<td style="font-weight: bold; background: #f8fafc; color: #334155; width: ${100 / this.maxPeriod}%; text-align: center; border: 1px solid #cbd5e1;">${name}</td>`).join('');
          
          rowsHtmlForDate += `
          <tr class="week-row-${d.dateStr}">
            <td style="font-weight: bold; background: #f1f5f9; color: #475569; vertical-align: middle; text-align: center; border: 1px solid #cbd5e1;">교시</td>
            ${pNamesHtml}
          </tr>`;

          filters.forEach((fId) => {
              const isPersonal = fId === 'personal';
              const gIcon = isPersonal ? '🔒' : '👥'; 
              const badgeColor = isPersonal ? '#2563eb' : '#059669';
              const badgeBg = isPersonal ? '#eff6ff' : '#ecfdf5';
              const badgeHtml = filterCount > 1 ? `<div style="font-size:1.1rem; color:${badgeColor}; background:${badgeBg}; padding:2px 6px; border-radius:6px; display:inline-block; margin-top:4px; cursor:help;" title="${isPersonal ? '개인' : (this.myGroups.find(g => g.id === fId)?.name || '그룹')}">${gIcon}</div>` : '';
              
              const periods = window[`tempSchedules_${d.dateStr}`][fId];
              const periodCellsHtml = Array.from({ length: this.maxPeriod }).map((_, i) => {
                  const p = i + 1;
                  const pObj = periods[p] || {};
                  let cellText = "";
                  if (pObj.subject && pObj.subject.toUpperCase() !== 'X') cellText += `[${pObj.subject}] `;
                  if (pObj.memo) cellText += pObj.memo + " ";
                  if (pObj.supplies) cellText += `[${pObj.supplies}]`;
                  
                  return `<td class="editable-cell week-period-cell" data-p="${p}" data-fid="${fId}" contenteditable="true" style="vertical-align: top; height: var(--week-cell-height); text-align: left; padding: 6px 8px; white-space: pre-wrap; border:1px solid #cbd5e1; font-size:1rem; color:#047857; background:#ecfdf5;" oninput="window.weekViewInstance.syncScheduleInputs()">${cellText.trim()}</td>`;
              }).join('');

              rowsHtmlForDate += `
              <tr data-week-schedule-date="${d.dateStr}" data-fid="${fId}" class="week-row-${d.dateStr}">
                <td style="padding:4px; border:1px solid #cbd5e1; background:#ecfdf5; color:#047857; font-weight:bold; font-size:0.9rem; vertical-align:middle; text-align:center;">
                    수업${badgeHtml}
                </td>
                ${periodCellsHtml}
              </tr>`;
          });
      }
      return rowsHtmlForDate;
    }).join('');

    const colgroupHtml = `
        <colgroup>
            <col style="width: 110px;">
            <col style="width: 60px;">
            ${Array.from({length: maxP}).map(() => `<col>`).join('')}
        </colgroup>
    `;

    this.container.innerHTML = `
      <div class="table-container" style="background:#fff; padding:12px; border-radius:8px; overflow:visible; margin-top: 15px;">
        <table id="week-editor-table" style="width:100%; border-collapse:collapse; text-align:center; table-layout:fixed;">
          ${colgroupHtml}
          <tbody style="border-bottom: 2px solid #cbd5e1;">
            <tr style="background:#f1f5f9;">
              <td style="padding:8px; border:1px solid #cbd5e1; font-weight:bold; color:#1e293b;">날짜</td>
              <td style="padding:8px; border:1px solid #cbd5e1; font-weight:bold; color:#1e293b;">구분</td>
              <td colspan="${maxP}" style="padding:8px; border:1px solid #cbd5e1; font-weight:bold; color:#1e293b;">📌 내용 (직접 수정)</td>
            </tr>
          </tbody>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>`;
  }

  generateCompactEventEditor(dateStr, fId) {
      const allEvents = window[`tempEvents_${dateStr}`] || [];
      const list = allEvents.filter(e => (e.sharedGroupId || 'personal') === fId);
      
      const labelObjs = getEventLabels();
      const realTodayStr = formatDate(new Date());
      const uid = window.auth?.currentUser?.uid;
      const inst = 'window.weekViewInstance';
      
      return list.map((e) => {
          // 🌟 안전장치: 혹시라도 ID가 없는 데이터면 즉시 생성
          if (!e.id) e.id = 'ev_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2,5);

          const isAuthor = !e.authorId || !uid || e.authorId === uid;
          const eLabelIds = e.labelIds || [];
          const isCompleted = !!e.completed;
          const canComplete = eLabelIds.some(id => labelObjs.find(l => l.id === id)?.isForward);

          let warningIcon = '';
          if (canComplete) {
              if (!isCompleted && dateStr < realTodayStr) warningIcon = `<span style="color:#ef4444; font-weight:bold; font-size:0.8rem; margin-left:8px; align-self:center;">➡️ (미완료)</span>`;
              else if (e.originalDate && e.originalDate < dateStr) warningIcon = `<span style="color:#2563eb; font-weight:bold; font-size:0.8rem; margin-left:8px; align-self:center;">↪️ (이월됨)</span>`;
          }

          const chipsHtml = labelObjs.map(lObj => {
              // 🌟 순서번호(idx) 대신 고유 ID(e.id) 사용
              const chipClickAttr = isAuthor ? `onclick="window.handleCompactLabelClick('${dateStr}', '${e.id}', '${lObj.id}', '${fId}')"` : '';
              const chipCursorStyle = isAuthor ? 'cursor:pointer;' : 'cursor:not-allowed; opacity:0.8;';
              return `<div class="label-chip ${eLabelIds.includes(lObj.id) ? 'active' : ''}" ${chipClickAttr} style="padding:2px 8px; font-size:0.8rem; min-width:auto; ${chipCursorStyle}">${lObj.name}</div>`;
          }).join('') + warningIcon;

          const checkboxHtml = canComplete 
              ? `<input type="checkbox" ${isCompleted ? 'checked' : ''} ${!isAuthor ? 'disabled' : ''} onchange="${inst}.updateCompactEvent('${dateStr}', '${e.id}', 'completed', this.checked); document.getElementById('compact-events-${dateStr}-${fId}').innerHTML = ${inst}.generateCompactEventEditor('${dateStr}', '${fId}');" style="width:18px; height:18px; cursor:pointer; accent-color:#059669;" title="완료 체크">`
              : '';

          const textBaseStyle = (isCompleted && canComplete) ? 'text-decoration:line-through; color:#94a3b8; background:#e2e8f0;' : 'background:#fff; color:#1e293b;';
          const textStyle = !isAuthor ? 'background:#f1f5f9; color:#64748b; cursor:not-allowed;' : textBaseStyle;
          const pureContent = (e.content || '').replace(/➡️\s*\(미완료\)/g, '').replace(/➡️\s*\(다음 날로 이월됨\)/g, '').replace(/↪️\s*/g, '').trim();

          const deleteBtnHtml = isAuthor 
                ? `<button onclick="${inst}.requestRemoveCompactEvent('${dateStr}', '${e.id}', '${fId}')" style="background:none; border:none; color:#ef4444; font-size:1.1rem; cursor:pointer; padding:0; line-height:1;" title="삭제">✖</button>`
                : '';

          return `
          <div class="compact-event-row" style="display:flex; border:1px solid #cbd5e1; border-radius:6px; padding:8px; margin-bottom:8px; background:#f8fafc; flex-direction:column; gap:6px; transition:0.2s;">
              <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                  <div class="label-chip-container" style="margin:0; display:flex; flex-wrap:wrap; gap:4px; align-items:center; flex:1;">
                      ${chipsHtml}
                  </div>
                  <div style="display:flex; align-items:center; gap:8px; flex-shrink:0;">
                      ${deleteBtnHtml}
                  </div>
              </div>
              <div style="display:flex; align-items:flex-start; gap:8px; width:100%;">
                  ${checkboxHtml}
                  <textarea data-id="${e.id}" ${!isAuthor ? 'readonly' : ''} placeholder="${isAuthor ? '일정 내용을 입력하세요.' : '권한이 없습니다.'}" style="flex:1; padding:6px 8px; font-size:0.95rem; border:1px solid #cbd5e1; border-radius:4px; outline:none; resize:none; min-height:40px; box-sizing:border-box; ${textStyle}" onfocus="this.style.height = this.scrollHeight + 'px';" oninput="this.style.height = '40px'; this.style.height = this.scrollHeight + 'px'; ${inst}.updateCompactEvent('${dateStr}', '${e.id}', 'content', this.value)">${pureContent}</textarea>
              </div>
          </div>`;
      }).join('');
  }

  syncCompactEventInputs(dateStr) {
      window.activeUnifiedFilters.forEach(fId => {
          const container = document.getElementById(`compact-events-${dateStr}-${fId}`);
          if (!container) return;
          container.querySelectorAll('textarea').forEach(ta => {
              const eventId = ta.getAttribute('data-id');
              const ev = window[`tempEvents_${dateStr}`]?.find(e => e.id === eventId);
              if (ev) ev.content = ta.value;
          });
      });
  }

  syncAllCompactEventInputs() {
      this.getWeekDates().forEach(d => this.syncCompactEventInputs(d.dateStr));
  }

  syncScheduleInputs() {
      document.querySelectorAll(`tr[data-week-schedule-date]`).forEach(row => {
          const dateStr = row.getAttribute('data-week-schedule-date');
          const fId = row.getAttribute('data-fid');
          
          window[`tempSchedules_${dateStr}`] = window[`tempSchedules_${dateStr}`] || {};
          window[`tempSchedules_${dateStr}`][fId] = window[`tempSchedules_${dateStr}`][fId] || {};

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
              window[`tempSchedules_${dateStr}`][fId][p] = { subject: subject.toUpperCase() === 'X' ? '' : subject, memo, supplies };
          });
      });
  }

  updateCompactEvent(dateStr, eventId, field, value) {
      store.hasUnsavedChanges = true;
      const ev = window[`tempEvents_${dateStr}`]?.find(e => e.id === eventId);
      if (ev) ev[field] = value;
  }

  addCompactEvent(dateStr, fId) {
      this.syncCompactEventInputs(dateStr); 
      store.hasUnsavedChanges = true;
      window[`tempEvents_${dateStr}`] = window[`tempEvents_${dateStr}`] || [];
      window[`tempEvents_${dateStr}`].push({ 
          id: 'ev_' + Date.now() + Math.random().toString(36).substr(2,5),
          authorId: window.auth?.currentUser?.uid,
          labelIds: [], content: '', completed: false, sharedGroupId: fId === 'personal' ? null : fId 
      });
      document.getElementById(`compact-events-${dateStr}-${fId}`).innerHTML = this.generateCompactEventEditor(dateStr, fId);
  }

  requestRemoveCompactEvent(dateStr, eventId, fId) {
      this.syncCompactEventInputs(dateStr); 
      const evList = window[`tempEvents_${dateStr}`];
      const ev = evList?.find(e => e.id === eventId);
      if (!ev) return;

      const isGrouped = !!ev.groupId; 
      
      const labelObjs = getEventLabels();
      const forwardLabelId = (ev.labelIds || []).find(id => labelObjs.find(l => l.id === id)?.isForward);
      const forwardLabelName = forwardLabelId ? labelObjs.find(l=>l.id===forwardLabelId).name : '';

      if (isGrouped && ev.groupId.startsWith('group_')) {
          window.showGroupDeleteModal(dateStr, ev.labelIds[0] || '', ev.content, ev.groupId, 
              () => window.render(), 
              () => this.removeCompactEvent(dateStr, eventId, fId)
          );
      } else if (forwardLabelId && ev.forwardChainId) {
          window.showForwardDeleteModal(dateStr, forwardLabelName, ev.content, ev.forwardChainId, () => window.render());
      } else {
          this.removeCompactEvent(dateStr, eventId, fId);
      }
  }

  removeCompactEvent(dateStr, eventId, fId) {
      store.hasUnsavedChanges = true;
      const evList = window[`tempEvents_${dateStr}`];
      const evIndex = evList.findIndex(e => e.id === eventId);
      if (evIndex !== -1) {
          evList.splice(evIndex, 1);
      }
      
      window.activeUnifiedFilters.forEach(filterId => {
          const container = document.getElementById(`compact-events-${dateStr}-${filterId}`);
          if (container) {
              container.innerHTML = this.generateCompactEventEditor(dateStr, filterId);
          }
      });
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
                authorId: e.authorId || window.auth?.currentUser?.uid,
                sharedGroupId: e.sharedGroupId || 'personal'
            }));
        return { 
            dateStr, 
            validEvents, 
            schedulesData: JSON.parse(JSON.stringify(window[`tempSchedules_${dateStr}`] || {})) 
        };
    });

    const masterLabels = getEventLabels();
    
    snapshot.forEach(item => {
        const eventsByGroup = { 'personal': [] };
        this.myGroups.forEach(g => eventsByGroup[g.id] = []);

        item.validEvents.forEach(e => {
            const gId = e.sharedGroupId === 'personal' ? 'personal' : (e.sharedGroupId || 'personal');
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

        window.activeUnifiedFilters.forEach(fId => {
            const periods = item.schedulesData[fId] || {};
            const scheduleCol = fId === 'personal' ? getUserCol('schedules') : getGroupCol(fId, 'schedules');
            
            const isSkipDay = item.validEvents.some(e => (e.sharedGroupId || 'personal') === fId && e.labelIds?.some(id => masterLabels.find(l => l.id === id)?.isSkip));
            if (isSkipDay) {
                Object.values(periods).forEach(p => p.subject = '');
            }
            
            setDoc(doc(scheduleCol, item.dateStr), { 
                periods: periods, updatedAt: Date.now() 
            }, { merge: true }).catch(e => console.warn(e));
        });
    });
  }
}

const instance = new WeekView(document.getElementById("main-view"));

Object.assign(window, {
    weekViewInstance: instance,
    renderWeekViewer: (c) => { instance.container = c; instance.renderViewer(); },
    renderWeekEditor: (c) => { instance.container = c; instance.renderEditor(); },
    saveWeekDataFromEditor: () => instance.save(),
    
    handleCompactLabelClick: async (dateStr, eventId, labelId, fId) => {
        const scopeInstance = window[`${store.scope}ViewInstance`];
        if (scopeInstance) scopeInstance.syncCompactEventInputs(dateStr);
        store.hasUnsavedChanges = true;
        
        const evList = window[`tempEvents_${dateStr}`];
        const ev = evList?.find(e => e.id === eventId);
        if (!ev) return;
        ev.labelIds = ev.labelIds || [];
        
        const isActive = ev.labelIds.includes(labelId);
        const labelObj = getEventLabels().find(l => l.id === labelId);

        if (isActive) {
            ev.labelIds = ev.labelIds.filter(id => id !== labelId);
        } else {
            if (labelObj?.isPeriod || labelObj?.isRecur) {
                const evContent = ev.content || '';
                
                if (scopeInstance && typeof scopeInstance.syncScheduleInputs === 'function') {
                    scopeInstance.syncScheduleInputs();
                }

                // 🌟 [버그 픽스] 하루 페이지처럼 팝업에서 "저장(성공)" 했을 때만 일정을 삭제
                const callback = (success) => { 
                    if (success) {
                        const currentIdx = window[`tempEvents_${dateStr}`].findIndex(e => e.id === eventId);
                        if (currentIdx !== -1) {
                            window[`tempEvents_${dateStr}`].splice(currentIdx, 1);
                            window.saveCurrentViewData(true);
                            window.render();
                        }
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
        
        if (scopeInstance) {
            window.activeUnifiedFilters.forEach(filterId => {
                const container = document.getElementById(`compact-events-${dateStr}-${filterId}`);
                if (container) {
                    container.innerHTML = scopeInstance.generateCompactEventEditor(dateStr, filterId);
                }
            });
        }
    }
});
