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
    this.isRendering = false; // 🌟 렌더링 중 덮어쓰기 방지 변수 추가
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
    const promises = [];

    promises.push(
        getDocs(query(getUserCol('events'), where(documentId(), '>=', startStr), where(documentId(), '<=', endStr))).then(snap => {
            snap.forEach(docSnap => {
                const data = docSnap.data();
                if (!eMap[docSnap.id]) eMap[docSnap.id] = { eventList: [] };
                let pList = data.eventList || (data.eventText ? window.parseRawEventTextToEventList(data.eventText) : []);
                pList.forEach(e => { e.sharedGroupId = null; eMap[docSnap.id].eventList.push(e); });
            });
        }).catch(e => console.warn(e))
    );

    for (const g of this.myGroups) {
        promises.push(
            getDocs(query(getGroupCol(g.id, 'events'), where(documentId(), '>=', startStr), where(documentId(), '<=', endStr))).then(snap => {
                snap.forEach(docSnap => {
                    const data = docSnap.data();
                    if (!eMap[docSnap.id]) eMap[docSnap.id] = { eventList: [] };
                    let gList = data.eventList || [];
                    gList.forEach(e => { e.sharedGroupId = g.id; e.groupName = g.name; eMap[docSnap.id].eventList.push(e); });
                });
            }).catch(e => console.warn(e))
        );
    }

    promises.push(
        getDocs(query(getUserCol('schedules'), where(documentId(), '>=', startStr), where(documentId(), '<=', endStr))).then(snap => {
            snap.forEach(docSnap => {
                if (!sMap[docSnap.id]) sMap[docSnap.id] = {};
                sMap[docSnap.id]['personal'] = docSnap.data().periods || {};
            });
        }).catch(e => console.warn(e))
    );

    for (const g of this.myGroups) {
        promises.push(
            getDocs(query(getGroupCol(g.id, 'schedules'), where(documentId(), '>=', startStr), where(documentId(), '<=', endStr))).then(snap => {
                snap.forEach(docSnap => {
                    if (!sMap[docSnap.id]) sMap[docSnap.id] = {};
                    sMap[docSnap.id][g.id] = docSnap.data().periods || {};
                });
            }).catch(e => console.warn(e))
        );
    }

    await Promise.all(promises);
    return { eMap, sMap };
  }

  async renderViewer() {
    this.isRendering = true;
    try {
        this.showLoading('클라우드에서 월간 일정을 불러오는 중...'); 

        if (this.container) {
            this.container.style.overflow = 'visible';
            this.container.style.overflowX = 'visible';
            this.container.style.overflowY = 'visible';
        }

        const y = store.currentDate.getFullYear();
        const m = store.currentDate.getMonth();
        const lastDate = new Date(y, m + 1, 0).getDate();
        const startStr = `${y}-${String(m+1).padStart(2, '0')}-01`;
        const endStr = `${y}-${String(m+1).padStart(2, '0')}-${String(lastDate).padStart(2, '0')}`;

        const { eMap, sMap } = await this.fetchMonthData(startStr, endStr);

        window.currentMyGroups = this.myGroups;
        if (!window.activeUnifiedFilters) window.activeUnifiedFilters = ['personal', ...this.myGroups.map(g => g.id)];
        if (window.FilterUI) window.FilterUI.renderUnifiedFilter(this.myGroups);
        if (store.mode === 'editor') this.scheduleGroupId = window.activeUnifiedFilters.includes('personal') ? null : window.activeUnifiedFilters[0];

        const filters = window.activeUnifiedFilters;
        const filterCount = filters.length;

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
            const filteredEvents = finalEvents.filter(e => window.activeUnifiedFilters.includes(e.sharedGroupId || 'personal'));
            
            let contentHtml = '';
            
            filters.forEach((fId, idx) => {
                const isPersonal = fId === 'personal';
                const gIcon = isPersonal ? '🔒' : '👥';
                const gName = isPersonal ? '개인' : (this.myGroups.find(g => g.id === fId)?.name || '그룹');
                const iconColor = isPersonal ? '#2563eb' : '#059669';
                const badgeBg = isPersonal ? '#eff6ff' : '#ecfdf5';

                const fEvents = filteredEvents.filter(e => (e.sharedGroupId || 'personal') === fId);
                const processedEvents = fEvents.map(e => ({ ...e, labelIds: e.labelIds || [] }));
                const eventHtml = processedEvents.length > 0 ? `<div style="margin-top:2px;">${generateEventBadgesHTML(processedEvents, dateStr, 'compact')}</div>` : '';

                let scheduleHtml = '';
                if (store.showClass) {
                    let hasClass = false;
                    let boxesHtml = Array.from({ length: this.maxPeriod }).map((_, pi) => {
                        const p = pi + 1;
                        const subj = sMap[dateStr]?.[fId]?.[p]?.subject;
                        if (subj && subj.trim() !== '' && subj.toUpperCase() !== 'X') {
                            hasClass = true;
                            const text = subj.trim();
                            let fontSize = text.length >= 5 ? "0.45rem" : (text.length === 4 ? "0.55rem" : (text.length === 3 ? "0.65rem" : "0.75rem"));
                            let letterSpacing = text.length >= 5 ? "-1.5px" : (text.length === 4 ? "-1px" : (text.length === 3 ? "-0.5px" : "normal"));
                            return `<div style="display:flex; align-items:center; justify-content:center; flex:1; min-width:0; height:22px; box-sizing:border-box; border:1px solid #6ee7b7; border-radius:4px; background:#ecfdf5; color:#047857; font-size:${fontSize}; font-weight:700; letter-spacing:${letterSpacing}; white-space:nowrap; overflow:hidden;" title="${text}">${text}</div>`;
                        }
                        return `<div style="display:flex; align-items:center; justify-content:center; flex:1; min-width:0; height:22px; box-sizing:border-box; border:1px solid #e2e8f0; border-radius:4px; background:#f8fafc; color:#94a3b8; font-size:0.75rem; font-weight:700;">&nbsp;</div>`;
                    }).join('');

                    if (hasClass) {
                        scheduleHtml = `<div style="display:flex; flex-wrap:nowrap; gap:2px; width:100%; margin-top:2px; margin-bottom:2px;">${boxesHtml}</div>`;
                    }
                }

                if (eventHtml || scheduleHtml) {
                    const topBorder = contentHtml !== '' ? 'border-top: 1px dashed #cbd5e1; padding-top: 6px; margin-top: 4px;' : 'margin-top: 4px;';
                    const iconBadge = filterCount > 1 ? `<div style="display:inline-flex; align-items:center; justify-content:center; width:20px; height:20px; font-size:0.85rem; border-radius:4px; background:${badgeBg}; color:${iconColor}; border:1px solid ${iconColor}; margin-bottom:4px; cursor:help;" title="${gName}">${gIcon}</div>` : '';
                    
                    contentHtml += `
                    <div style="${topBorder} display:flex; flex-direction:column; align-items:stretch; width:100%;">
                        ${iconBadge}
                        ${scheduleHtml}
                        ${eventHtml}
                    </div>`;
                }
            });

            const isRed = isRedDay(dateStr, filteredEvents);
            const dateColor = isRed ? '#ef4444' : (dayOfWeekNum === 6 ? '#3b82f6' : '#334155');
            const holidayName = getHolidayName(dateStr);
            const holidayHtml = holidayName ? `<div style="font-size:0.65rem; color:#ef4444; margin-top:1px; line-height:1;">${holidayName}</div>` : '';
            const todayClass = (dateStr === realTodayStr) ? 'month-today-cell' : '';

            return `
            <div class="cal-day ${todayClass}">
                <div style="font-weight:700; color:${dateColor}; font-size:1.1rem; display:inline-block; cursor:pointer;" onclick="window.goToDay('${dateStr}')" title="${dateStr} 일 보기로 이동">${d}${holidayHtml}</div>
                ${contentHtml}
            </div>`;
        }).join('');

        this.container.innerHTML = `
            <div class="calendar-grid" style="grid-template-columns: repeat(${this.isWeekendVisible ? 7 : 5}, 1fr); margin-top:15px;">${daysHeaderHtml}${paddingHtml}${daysHtml}</div>
        `;
    } finally {
        this.isRendering = false;
    }
  }

  async renderEditor() {
    this.isRendering = true;
    try {
        this.showLoading('월간 편집 시트를 불러오는 중...');

        if (this.container) {
            this.container.style.overflow = 'visible';
            this.container.style.overflowX = 'visible';
            this.container.style.overflowY = 'visible';
        }

        const y = store.currentDate.getFullYear();
        const m = store.currentDate.getMonth();
        const lastDate = new Date(y, m + 1, 0).getDate();
        const startStr = `${y}-${String(m+1).padStart(2, '0')}-01`;
        const endStr = `${y}-${String(m+1).padStart(2, '0')}-${String(lastDate).padStart(2, '0')}`;

        const { eMap, sMap } = await this.fetchMonthData(startStr, endStr);
        const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
        const masterLabels = getEventLabels(); 
        const realTodayStr = formatDate(new Date());

        window.currentMyGroups = this.myGroups;
        if (!window.activeUnifiedFilters) window.activeUnifiedFilters = ['personal', ...this.myGroups.map(g => g.id)];
        if (window.FilterUI) window.FilterUI.renderUnifiedFilter(this.myGroups);

        const filters = window.activeUnifiedFilters;
        const filterCount = filters.length;
        const maxP = store.periodNames ? store.periodNames.length : 6;
        const totalRows = filterCount + (store.showClass ? 1 + filterCount : 0);

        const rowsHtml = Array.from({ length: lastDate }).map((_, i) => {
            const d = i + 1;
            const dateStr = `${y}-${String(m+1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const dayOfWeekNum = new Date(y, m, d).getDay();
            const dayOfWeek = dayNames[dayOfWeekNum];

            if (!this.isWeekendVisible && (dayOfWeekNum === 0 || dayOfWeekNum === 6)) return '';

            window[`tempEvents_${dateStr}`] = [];
            window[`tempSchedules_${dateStr}`] = {};

            filters.forEach(fId => {
                const periods = sMap[dateStr]?.[fId] || {};
                window[`tempSchedules_${dateStr}`][fId] = periods;

                const fEvents = (eMap[dateStr]?.eventList || []).filter(e => (e.sharedGroupId || 'personal') === fId);
                fEvents.forEach(e => {
                    let labelIds = e.labelIds || [];
                    if (labelIds.length === 0 && (e.labels || e.label)) {
                        (e.labels || [e.label]).forEach(name => {
                            const match = masterLabels.find(l => l.name === name);
                            if (match && match.id && !labelIds.includes(match.id)) labelIds.push(match.id);
                        });
                    }
                    window[`tempEvents_${dateStr}`].push({ ...e, labelIds, sharedGroupId: fId === 'personal' ? null : fId });
                });
            });

            const isToday = (dateStr === realTodayStr);
            const isRed = isRedDay(dateStr, window[`tempEvents_${dateStr}`]);
            const dateColor = isRed ? '#ef4444' : (dayOfWeekNum === 6 ? '#3b82f6' : '#1e40af');
            const dateNumColor = isRed ? '#ef4444' : (dayOfWeekNum === 6 ? '#3b82f6' : '#475569');
            const holidayName = getHolidayName(dateStr);
            const holidayHtml = holidayName ? `<span style="font-size:0.75rem; color:#ef4444; font-weight:bold; margin-top:2px;">${holidayName}</span>` : '';

            let rowsHtmlForDate = '';

            filters.forEach((fId, idx) => {
                const isPersonal = fId === 'personal';
                const gIcon = isPersonal ? '🔒' : '👥';
                const gName = isPersonal ? '개인' : (this.myGroups.find(g => g.id === fId)?.name || '그룹');
                const badgeColor = isPersonal ? '#2563eb' : '#059669';
                const badgeBg = isPersonal ? '#eff6ff' : '#ecfdf5';
                const badgeHtml = filterCount > 1 ? `<div style="font-size:1.1rem; color:${badgeColor}; background:${badgeBg}; padding:2px 6px; border-radius:6px; display:inline-block; margin-top:4px; cursor:help;" title="${gName}">${gIcon}</div>` : '';

                const eventContent = `<div id="compact-events-${dateStr}-${fId}" style="display:flex; flex-direction:column; gap:4px;">${this.generateCompactEventEditor(dateStr, fId)}</div>`;
                const addBtnHtml = `<button onclick="window.monthViewInstance.addCompactEvent('${dateStr}', '${fId}')" style="margin-top:6px; background:#e0f2fe; color:#0369a1; border:1px dashed #7dd3fc; border-radius:4px; padding:2px 8px; cursor:pointer; font-weight:bold; font-size:1.1rem; box-shadow:0 1px 2px rgba(0,0,0,0.05);" title="일정 추가">+</button>`;

                if (idx === 0) {
                    rowsHtmlForDate += `
                    <tr data-month-date="${dateStr}" class="month-row-${dateStr}">
                      <td rowspan="${totalRows}" class="${isToday ? 'month-today-cell' : ''}" style="padding:8px 4px; border:1px solid #cbd5e1; background:#f8fafc; vertical-align:middle; width:110px;">
                        <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
                          <span onclick="window.goToDay('${dateStr}')" style="font-size:1.2rem; font-weight:900; color:${dateNumColor}; line-height:1.1; cursor:pointer;" title="${dateStr} 일 보기로 이동">${d}일</span>
                          <span style="font-size:0.95rem; font-weight:600; color:${dateColor}; line-height:1;">${dayOfWeek}</span>
                          ${holidayHtml}
                        </div>
                      </td>
                      <td style="padding:4px; border:1px solid #cbd5e1; background:#f0f9ff; color:#0369a1; font-weight:bold; font-size:0.9rem; vertical-align:middle; width:60px; text-align:center;">
                          일정<br>${badgeHtml}<br>${addBtnHtml}
                      </td>
                      <td colspan="${maxP}" style="text-align:left; padding:6px 10px; background:#f0f9ff; vertical-align:top; border:1px solid #cbd5e1;">${eventContent}</td>
                    </tr>`;
                } else {
                    rowsHtmlForDate += `
                    <tr class="month-row-${dateStr}">
                      <td style="padding:4px; border:1px solid #cbd5e1; background:#f0f9ff; color:#0369a1; font-weight:bold; font-size:0.9rem; vertical-align:middle; width:60px; text-align:center;">
                          일정<br>${badgeHtml}<br>${addBtnHtml}
                      </td>
                      <td colspan="${maxP}" style="text-align:left; padding:6px 10px; background:#f0f9ff; vertical-align:top; border:1px solid #cbd5e1;">${eventContent}</td>
                    </tr>`;
                }
            });

            if (store.showClass) {
                const pNamesHtml = (store.periodNames || ["1","2","3","4","5","6"]).map(name => `<td style="font-weight: bold; background: #f8fafc; color: #334155; width: ${100 / maxP}%; text-align: center; border: 1px solid #cbd5e1;">${name}</td>`).join('');
                
                rowsHtmlForDate += `
                <tr class="month-row-${dateStr}">
                  <td style="font-weight: bold; background: #f1f5f9; color: #475569; vertical-align: middle; text-align: center; border: 1px solid #cbd5e1;">교시</td>
                  ${pNamesHtml}
                </tr>`;

                filters.forEach((fId) => {
                    const isPersonal = fId === 'personal';
                    const gIcon = isPersonal ? '🔒' : '👥';
                    const gName = isPersonal ? '개인' : (this.myGroups.find(g => g.id === fId)?.name || '그룹');
                    const badgeColor = isPersonal ? '#2563eb' : '#059669';
                    const badgeBg = isPersonal ? '#eff6ff' : '#ecfdf5';
                    const badgeHtml = filterCount > 1 ? `<div style="font-size:1.1rem; color:${badgeColor}; background:${badgeBg}; padding:2px 6px; border-radius:6px; display:inline-block; margin-top:4px; cursor:help;" title="${gName}">${gIcon}</div>` : '';

                    const periods = window[`tempSchedules_${dateStr}`][fId];
                    const periodCellsHtml = Array.from({ length: maxP }).map((_, i) => {
                        const p = i + 1;
                        const pObj = periods[p] || {};
                        let cellText = "";
                        if (pObj.subject && pObj.subject.toUpperCase() !== 'X') cellText += `[${pObj.subject}] `;
                        if (pObj.memo) cellText += pObj.memo + " ";
                        if (pObj.supplies) cellText += `[${pObj.supplies}]`;
                        
                        return `<td class="editable-cell edit-class-cell" data-p="${p}" data-fid="${fId}" contenteditable="true" style="vertical-align: top; text-align: left; padding: 6px 8px; white-space: pre-wrap; border:1px solid #cbd5e1; font-size:1rem; color:#047857; background:#ecfdf5;" oninput="window.monthViewInstance.syncScheduleInputs()">${cellText.trim()}</td>`;
                    }).join('');

                    rowsHtmlForDate += `
                    <tr data-month-schedule-date="${dateStr}" data-fid="${fId}" class="month-row-${dateStr}">
                      <td style="padding:4px; border:1px solid #cbd5e1; background:#ecfdf5; color:#047857; font-weight:bold; font-size:0.9rem; vertical-align:middle; text-align:center;">
                          수업<br>${badgeHtml}
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
          <div class="table-container" style="background:#fff; padding:12px; border-radius:8px; overflow:visible; margin-top:15px;">
            <table id="month-editor-table" style="width:100%; border-collapse:collapse; text-align:center; table-layout:fixed;">
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

  generateCompactEventEditor(dateStr, fId) {
      const allEvents = window[`tempEvents_${dateStr}`] || [];
      const list = allEvents.filter(e => (e.sharedGroupId || 'personal') === fId);
      
      const labelObjs = getEventLabels();
      const realTodayStr = formatDate(new Date());
      const uid = window.auth?.currentUser?.uid;
      const inst = 'window.monthViewInstance';
      
      return list.map((e) => {
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
      if (this.renderedDateStrings) {
          this.renderedDateStrings.forEach(dateStr => this.syncCompactEventInputs(dateStr));
      }
  }

  syncScheduleInputs() {
      document.querySelectorAll(`tr[data-month-schedule-date]`).forEach(row => {
          const dateStr = row.getAttribute('data-month-schedule-date');
          const fId = row.getAttribute('data-fid');
          
          window[`tempSchedules_${dateStr}`] = window[`tempSchedules_${dateStr}`] || {};
          window[`tempSchedules_${dateStr}`][fId] = window[`tempSchedules_${dateStr}`][fId] || {};

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
    if (this.isRendering) return; // 🌟 렌더링 도중 백그라운드 저장 시도 완전 차단
    
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
                .map(e => ({
                    ...e,
                    id: e.id || 'ev_' + Date.now() + Math.random().toString(36).substr(2,5),
                    authorId: e.authorId || window.auth?.currentUser?.uid,
                    sharedGroupId: e.sharedGroupId || 'personal'
                }));
            snapshot.push({ 
                dateStr, 
                validEvents, 
                schedulesData: JSON.parse(JSON.stringify(window[`tempSchedules_${dateStr}`] || {})) 
            });
        }
    }

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
    
    store.hasUnsavedChanges = false;
  }
}

const instance = new MonthView(document.getElementById("main-view"));
Object.assign(window, {
    monthViewInstance: instance,
    renderMonthViewer: (c) => { instance.container = c; instance.renderViewer(); },
    renderMonthEditor: (c) => { instance.container = c; instance.renderEditor(); },
    saveMonthDataFromEditor: () => instance.save(),

    handleCompactLabelClick: async (dateStr, eventId, labelId, fId) => {
        const scopeInstance = window[`${store.scope}ViewInstance`];
        if (scopeInstance && typeof scopeInstance.syncCompactEventInputs === 'function') {
            scopeInstance.syncCompactEventInputs(dateStr);
        }
        
        const evList = window[`tempEvents_${dateStr}`];
        const ev = evList?.find(e => e.id === eventId);
        if (!ev) return;
        ev.labelIds = ev.labelIds || [];
        
        const isActive = ev.labelIds.includes(labelId);
        const labelObj = getEventLabels().find(l => l.id === labelId);

        if (isActive) {
            ev.labelIds = ev.labelIds.filter(id => id !== labelId);
            store.hasUnsavedChanges = true;
            if (scopeInstance) {
                window.activeUnifiedFilters.forEach(filterId => {
                    const container = document.getElementById(`compact-events-${dateStr}-${filterId}`);
                    if (container) container.innerHTML = scopeInstance.generateCompactEventEditor(dateStr, filterId);
                });
            }
        } else {
            if (labelObj?.isPeriod || labelObj?.isRecur) {
                const evContent = ev.content || '';
                
                if (scopeInstance && typeof scopeInstance.syncScheduleInputs === 'function') {
                    scopeInstance.syncScheduleInputs();
                }

                // 1. 임시로 이벤트를 삭제하고, 취소 시 복구할 수 있도록 백업
                const currentIdx = window[`tempEvents_${dateStr}`].findIndex(e => e.id === eventId);
                let removedEvent = null;
                if (currentIdx !== -1) {
                    removedEvent = window[`tempEvents_${dateStr}`].splice(currentIdx, 1)[0];
                }

                // 2. DOM 업데이트 (화면에서 제거)
                if (scopeInstance) {
                    window.activeUnifiedFilters.forEach(filterId => {
                        const container = document.getElementById(`compact-events-${dateStr}-${filterId}`);
                        if (container) container.innerHTML = scopeInstance.generateCompactEventEditor(dateStr, filterId);
                    });
                }

                // 3. 현재 뷰(삭제된 상태)를 DB에 먼저 저장하여 덮어쓰기 방지
                if (scopeInstance && typeof scopeInstance.save === 'function') {
                    await scopeInstance.save();
                }
                store.hasUnsavedChanges = false; // 팝업 중 자동 저장 방지

                const callback = async (success) => { 
                    store.hasUnsavedChanges = false;
                    if (!success && removedEvent) {
                        // 취소 시 삭제했던 이벤트를 다시 복구하고 저장
                        window[`tempEvents_${dateStr}`].push(removedEvent);
                        if (scopeInstance && typeof scopeInstance.save === 'function') {
                            await scopeInstance.save();
                        }
                    }
                    // 성공/취소 무관하게 화면 새로고침 (최신 DB 반영)
                    if (typeof window.render === 'function') window.render(true);
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
            store.hasUnsavedChanges = true;
            
            if (scopeInstance) {
                window.activeUnifiedFilters.forEach(filterId => {
                    const container = document.getElementById(`compact-events-${dateStr}-${filterId}`);
                    if (container) container.innerHTML = scopeInstance.generateCompactEventEditor(dateStr, filterId);
                });
            }
        }
    }
});