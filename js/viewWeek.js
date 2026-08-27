// js/viewWeek.js

import { BaseView } from './components/BaseView.js';
import { store } from './core/store.js';
import { formatDate, getEventLabels, isRedDay, getHolidayName } from './core/utils.js';
import { getUserCol, getGroupCol, dbAPI } from './api/database.js';
import { auth, db } from './api/firebaseInit.js'; 
import { generateEventBadgesHTML, formatEventListToText } from './core/eventUtils.js';
import { query, where, documentId, getDocs, doc, setDoc } from "firebase/firestore";
import { CompactEventHelper } from './ui/templateHelpers.js';

export class WeekView extends BaseView {
  constructor(container) {
    super(container); 
    this.myGroups = [];
    this.scheduleGroupId = null; 
    this.isRendering = false; 
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
    this.isRendering = true;
    try {
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
    } finally {
        this.isRendering = false;
    }
  }

  async renderEditor() {
    this.isRendering = true;
    try {
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

          filters.forEach((fId, idx) => {
              const isPersonal = fId === 'personal';
              const gIcon = isPersonal ? '🔒' : '👥'; 
              const badgeColor = isPersonal ? '#2563eb' : '#059669';
              const badgeBg = isPersonal ? '#eff6ff' : '#ecfdf5';
              const badgeHtml = filterCount > 1 ? `<div style="font-size:1.1rem; color:${badgeColor}; background:${badgeBg}; padding:2px 6px; border-radius:6px; display:inline-block; margin-top:4px; cursor:help;" title="${isPersonal ? '개인' : (this.myGroups.find(g => g.id === fId)?.name || '그룹')}">${gIcon}</div>` : '';

              const eventContent = `<div id="compact-events-${d.dateStr}-${fId}" style="display:flex; flex-direction:column; gap:4px;">${CompactEventHelper.generateCompactEventEditor(d.dateStr, fId)}</div>`;
              const addBtnHtml = `<button onclick="window.CompactEventHelper.addCompactEvent('${d.dateStr}', '${fId}')" style="margin-top:6px; background:#e0f2fe; color:#0369a1; border:1px dashed #7dd3fc; border-radius:4px; padding:2px 8px; cursor:pointer; font-weight:bold; font-size:1.1rem; box-shadow:0 1px 2px rgba(0,0,0,0.05);" title="일정 추가">+</button>`;

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
    } finally {
        this.isRendering = false;
    }
  }

  syncCompactEventInputs(dateStr) {
      CompactEventHelper.syncCompactEventInputs(dateStr);
  }

  syncAllCompactEventInputs() {
      if (this.renderedDateStrings) {
          this.renderedDateStrings.forEach(dateStr => this.syncCompactEventInputs(dateStr));
      } else {
          this.getWeekDates().forEach(d => this.syncCompactEventInputs(d.dateStr));
      }
  }

  syncScheduleInputs() {
      CompactEventHelper.syncScheduleInputs('data-week-schedule-date', 'week-period-cell');
  }

  save() {
    if (this.isRendering) return; 
    
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
    saveWeekDataFromEditor: () => instance.save()
});