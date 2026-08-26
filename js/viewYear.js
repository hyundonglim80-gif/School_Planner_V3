// js/viewYear.js

import { BaseView } from './components/BaseView.js';
import { store } from './core/store.js';
import { formatDate, getEventLabels, isRedDay, getHolidayName } from './core/utils.js';
import { dbAPI, getUserCol, getGroupCol } from './firebase.js'; 
import { generateEventBadgesHTML, formatEventListToText } from './core/eventUtils.js';
import { query, where, documentId, getDocs, doc, setDoc, writeBatch } from "firebase/firestore";

export class YearView extends BaseView {
  constructor(container) {
    super(container); 
    this.myGroups = [];
    this.scheduleGroupId = null; 
    this.renderId = 0; 
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

  async fetchYearData(startStr, endStr) {
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

  getPrioritizedMonths(targetY) {
    const nextYear = targetY + 1;
    const monthsInfo = [
      { year: targetY, month: 3, label: "3월" },
      { year: targetY, month: 4, label: "4월" },
      { year: targetY, month: 5, label: "5월" },
      { year: targetY, month: 6, label: "6월" },
      { year: targetY, month: 7, label: "7월" },
      { year: targetY, month: 8, label: "8월" },
      { year: targetY, month: 9, label: "9월" },
      { year: targetY, month: 10, label: "10월" },
      { year: targetY, month: 11, label: "11월" },
      { year: targetY, month: 12, label: "12월" },
      { year: nextYear, month: 1, label: "1월" },
      { year: nextYear, month: 2, label: "2월" }
    ];

    const targetDate = store.currentDate || new Date();
    const currentYearVal = targetDate.getFullYear();
    const currentMonthVal = targetDate.getMonth() + 1;

    let currentIndex = monthsInfo.findIndex(m => m.year === currentYearVal && m.month === currentMonthVal);
    if (currentIndex === -1) currentIndex = 0; 

    const prioritizedMonths = monthsInfo.map((m, idx) => ({
      ...m,
      distance: Math.abs(idx - currentIndex),
      match: `${m.year}-${String(m.month).padStart(2, '0')}-` 
    })).sort((a, b) => a.distance - b.distance);

    return { orderedMonths: monthsInfo, prioritizedMonths };
  }

  applyStickyHeaderFix() {
      const appHeader = document.querySelector('.app-header');
      if (appHeader) {
          appHeader.style.setProperty('position', 'fixed', 'important');
          appHeader.style.setProperty('top', '0', 'important');
          appHeader.style.setProperty('left', '0', 'important');
          appHeader.style.setProperty('right', '0', 'important');
          appHeader.style.setProperty('z-index', '2000', 'important');
          appHeader.style.setProperty('box-sizing', 'border-box', 'important');
          const headerHeight = appHeader.offsetHeight;
          document.body.style.setProperty('padding-top', (headerHeight + 15) + 'px', 'important');
      }
  }

  async renderViewer() {
    this.renderId = Date.now();
    const currentRenderId = this.renderId;
    this.isRendering = true;

    this.showLoading('클라우드에서 연간 일정을 가져오는 중입니다...'); 

    if (this.container) {
        this.container.style.overflow = 'visible';
        this.container.style.overflowX = 'visible';
        this.container.style.overflowY = 'visible';
    }

    if (!window.db) return;

    let allEvents = [];
    
    try {
      const targetY = this.currentDate ? this.currentDate.getFullYear() : new Date().getFullYear();
      const startStr = `${targetY}-03-01`;
      const febLastDay = new Date(targetY + 1, 2, 0).getDate();
      const endStr = `${targetY + 1}-02-${febLastDay}`;

      const { eMap, sMap } = await this.fetchYearData(startStr, endStr);
      if (this.renderId !== currentRenderId) return;

      window.currentMyGroups = this.myGroups;
      if (!window.activeUnifiedFilters) window.activeUnifiedFilters = ['personal', ...this.myGroups.map(g => g.id)];
      if (window.FilterUI) window.FilterUI.renderUnifiedFilter(this.myGroups);
      if (store.mode === 'editor') this.scheduleGroupId = window.activeUnifiedFilters.includes('personal') ? null : window.activeUnifiedFilters[0];

      const allDates = new Set([...Object.keys(eMap), ...Object.keys(sMap)]);
      const filters = window.activeUnifiedFilters;
      const filterCount = filters.length;

      allDates.forEach(dateStr => {
        let hasContent = false;
        let contentHtml = '';
        let allProcessedEventsForDate = [];

        filters.forEach((fId, idx) => {
            const isPersonal = fId === 'personal';
            const gIcon = isPersonal ? '🔒' : '👥';
            const gName = isPersonal ? '개인' : (this.myGroups.find(g => g.id === fId)?.name || '그룹');
            const iconColor = isPersonal ? '#2563eb' : '#059669';
            const badgeBg = isPersonal ? '#eff6ff' : '#ecfdf5';

            const fEvents = (eMap[dateStr]?.eventList || []).filter(e => (e.sharedGroupId || 'personal') === fId);
            const processedEvents = fEvents.map(e => ({ ...e, labelIds: e.labelIds || [] }));
            allProcessedEventsForDate.push(...processedEvents);
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
                hasContent = true;
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

        if (hasContent) {
            allEvents.push({ dateStr: dateStr, htmlOutput: contentHtml, events: allProcessedEventsForDate }); 
        }
      });

      allEvents.sort((a, b) => a.dateStr.localeCompare(b.dateStr));

      const { orderedMonths, prioritizedMonths } = this.getPrioritizedMonths(targetY);
      const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
      
      const progressHtml = `
          <div id="year-render-progress" style="display:flex; justify-content:center; align-items:center; padding:12px; margin-bottom:15px; background:#eff6ff; color:#2563eb; border-radius:8px; font-weight:bold; font-size:1rem; gap:10px; border:1px solid #bfdbfe;">
              <div style="width:20px; height:20px; border:3px solid #bfdbfe; border-top-color:#2563eb; border-radius:50%; animation:spin 1s linear infinite;"></div>
              현재 월부터 순차적으로 화면을 부드럽게 구성하고 있습니다...
          </div>
          <style>@keyframes spin { 100% { transform:rotate(360deg); } }</style>
      `;

      this.container.innerHTML = `
          <div id="year-main-content" style="margin-top:15px;">
              ${progressHtml}
              <div class="year-grid" id="year-grid-container">
                 ${orderedMonths.map(m => `<div id="viewer-month-${m.year}-${m.month}" style="min-height:300px; background:#f8fafc; border-radius:8px; border:1px dashed #cbd5e1; display:flex; align-items:center; justify-content:center; color:#94a3b8; font-weight:bold;">${m.label} 로딩 중...</div>`).join('')}
              </div>
          </div>
      `;
      
      setTimeout(() => this.applyStickyHeaderFix(), 0);
      window.addEventListener('resize', () => this.applyStickyHeaderFix());
      
      const realTodayStr = formatDate(new Date());

      for (const mObj of prioritizedMonths) {
        if (this.renderId !== currentRenderId) return;

        const monthEvents = allEvents.filter(e => e.dateStr.startsWith(mObj.match));
        let eventListHtml = '';
        
        if (monthEvents.length > 0) {
          eventListHtml = monthEvents.map(e => {
            const parts = e.dateStr.split('-');
            const dayNum = parseInt(parts[2], 10);
            const dateObj = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, dayNum);
            const dayOfWeek = dayNames[dateObj.getDay()];
            
            const isTodayEvent = (e.dateStr === realTodayStr);
            const eventStyle = isTodayEvent 
                ? 'background-color:#eff6ff; padding:8px; border-radius:6px; border:2px solid #3b82f6; margin-bottom:10px;' 
                : 'margin-bottom:10px; border-bottom:1px dashed #e2e8f0; padding-bottom:6px;';

            let dateColor = '#2563eb'; 
            if (isRedDay(e.dateStr, e.events)) {
                dateColor = '#ef4444';
            } else if (dateObj.getDay() === 6) {
                dateColor = '#3b82f6';
            }

            return `<div style="${eventStyle}">
                      <div style="color:${dateColor}; font-weight:700; display:inline-block; cursor:pointer;" onclick="window.goToDay('${e.dateStr}')" title="${e.dateStr} 일 보기로 이동">${dayNum}일(${dayOfWeek})${isTodayEvent ? '🎯 오늘' : ''}</div>
                      <div style="margin-top:2px;">${e.htmlOutput}</div>
                    </div>`;
          }).join('');
        } else {
          eventListHtml = `<div style="text-align:center; color:#94a3b8; font-size:0.9rem; padding-top:10px;">일정 없음</div>`;
        }

        const isCurrentMonthCard = (mObj.match === `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-`);
        const cardClass = isCurrentMonthCard ? 'year-today-card' : '';

        const cardHtml = `
          <div id="viewer-card-${mObj.year}-${mObj.month}" class="mini-month ${cardClass}" style="display:flex; flex-direction:column; gap:8px;">
            <h3 style="color:#1e40af; border-bottom:2px solid #bfdbfe; padding-bottom:4px; text-align:center;">${mObj.label}</h3>
            <div style="line-height:1.4;">${eventListHtml}</div>
          </div>`;
        
        const containerEl = document.getElementById(`viewer-month-${mObj.year}-${mObj.month}`);
        if (containerEl) {
            containerEl.outerHTML = cardHtml;
            if (mObj.distance === 0) {
                setTimeout(() => {
                    const focusEl = document.getElementById(`viewer-card-${mObj.year}-${mObj.month}`);
                    if (focusEl) {
                        const header = document.querySelector('.app-header');
                        const hOffset = header ? header.offsetHeight : 0;
                        const absoluteY = focusEl.getBoundingClientRect().top + window.pageYOffset;
                        
                        window.scrollTo({top: absoluteY - hOffset - 10, behavior: 'auto'});
                    }
                }, 300);
            }
        }
        await new Promise(r => setTimeout(r, 40)); 
      }

      const progressEl = document.getElementById('year-render-progress');
      if (progressEl) progressEl.remove();

    } catch (error) {}
    finally {
        this.isRendering = false;
    }
  }

  async renderEditor() {
    this.renderId = Date.now();
    const currentRenderId = this.renderId;
    this.isRendering = true;

    this.showLoading('연간 데이터를 가져오는 중입니다...'); 

    if (this.container) {
        this.container.style.overflow = 'visible';
        this.container.style.overflowX = 'visible';
        this.container.style.overflowY = 'visible';
    }

    if (!window.db) return;

    const currentYear = this.currentDate ? this.currentDate.getFullYear() : new Date().getFullYear();
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

    const startStr = `${currentYear}-03-01`;
    const nextYear = currentYear + 1;
    const febLastDay = new Date(nextYear, 2, 0).getDate();
    const endStr = `${nextYear}-02-${febLastDay}`;

    const { eMap, sMap } = await this.fetchYearData(startStr, endStr);
    if (this.renderId !== currentRenderId) return;

    window.currentMyGroups = this.myGroups;
    if (!window.activeUnifiedFilters) window.activeUnifiedFilters = ['personal', ...this.myGroups.map(g => g.id)];
    if (window.FilterUI) window.FilterUI.renderUnifiedFilter(this.myGroups);

    const filters = window.activeUnifiedFilters;
    const filterCount = filters.length;
    const maxP = store.periodNames ? store.periodNames.length : 6;
    const totalRows = filterCount + (store.showClass ? 1 + filterCount : 0);

    const { orderedMonths, prioritizedMonths } = this.getPrioritizedMonths(currentYear);
    
    const monthChunksMap = {};
    for (const mObj of orderedMonths) {
        const lastDay = new Date(mObj.year, mObj.month, 0).getDate();
        const chunk = [];
        for (let d = 1; d <= lastDay; d++) {
            const dateStr = `${mObj.year}-${String(mObj.month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            chunk.push({ year: mObj.year, month: mObj.month, day: d, dateStr, data: { periods: sMap[dateStr] || {} }, eventData: eMap[dateStr] || {} });
        }
        monthChunksMap[`${mObj.year}-${mObj.month}`] = chunk;
    }

    this.renderedDateStrings = [];
    const masterLabels = getEventLabels(); 
    const realTodayStr = formatDate(new Date());

    const progressHtml = `
        <div id="year-render-progress" style="display:flex; justify-content:center; align-items:center; padding:12px; margin-bottom:15px; background:#eff6ff; color:#2563eb; border-radius:8px; font-weight:bold; font-size:1rem; gap:10px; border:1px solid #bfdbfe;">
            <div style="width:20px; height:20px; border:3px solid #bfdbfe; border-top-color:#2563eb; border-radius:50%; animation:spin 1s linear infinite;"></div>
            현재 월부터 순차적으로 화면을 부드럽게 구성하고 있습니다...
        </div>
        <style>@keyframes spin { 100% { transform:rotate(360deg); } }</style>
    `;

    const colgroupHtml = `
        <colgroup>
            <col style="width: 110px;">
            <col style="width: 60px;">
            ${Array.from({length: maxP}).map(() => `<col>`).join('')}
        </colgroup>
    `;

    this.container.innerHTML = `
      <div id="year-main-content" class="table-container" style="background:#fff; padding:12px; border-radius:8px; margin-top:15px; overflow:visible;">
        ${progressHtml}
        <table id="year-editor-table" style="width:100%; border-collapse:collapse; text-align:center; table-layout:fixed;">
          ${colgroupHtml}
          <tbody style="border-bottom: 2px solid #cbd5e1;">
            <tr style="background:#f1f5f9;">
              <td style="padding:8px; border:1px solid #cbd5e1; font-weight:bold; color:#1e293b;">날짜</td>
              <td style="padding:8px; border:1px solid #cbd5e1; font-weight:bold; color:#1e293b;">구분</td>
              <td colspan="${maxP}" style="padding:8px; border:1px solid #cbd5e1; font-weight:bold; color:#1e293b;">📌 내용 (직접 수정)</td>
            </tr>
          </tbody>
          ${orderedMonths.map(m => `<tbody id="editor-month-${m.year}-${m.month}"><tr><td colspan="${maxP + 2}" style="padding:40px; color:#94a3b8; font-weight:bold; background:#f8fafc; border:1px solid #e2e8f0;">${m.label} 로딩 중...</td></tr></tbody>`).join('')}
        </table>
      </div>`;

    setTimeout(() => this.applyStickyHeaderFix(), 0);
    window.addEventListener('resize', () => this.applyStickyHeaderFix());

    for (const mObj of prioritizedMonths) {
        if (this.renderId !== currentRenderId) return;
        const chunk = monthChunksMap[`${mObj.year}-${mObj.month}`];

        let rowsHtml = chunk.map(item => {
          const dateObj = new Date(item.year, item.month - 1, item.day);
          const dayOfWeekNum = dateObj.getDay();
          const dayOfWeek = dayNames[dayOfWeekNum];

          if (!this.isWeekendVisible && (dayOfWeekNum === 0 || dayOfWeekNum === 6)) return '';
          this.renderedDateStrings.push(item.dateStr);

          window[`tempEvents_${item.dateStr}`] = [];
          window[`tempSchedules_${item.dateStr}`] = {};

          filters.forEach(fId => {
              const periods = item.data.periods?.[fId] || {};
              window[`tempSchedules_${item.dateStr}`][fId] = periods;

              const fEvents = (item.eventData.eventList || []).filter(e => (e.sharedGroupId || 'personal') === fId);
              fEvents.forEach(e => {
                  let labelIds = e.labelIds || [];
                  if (labelIds.length === 0 && (e.labels || e.label)) {
                      (e.labels || [e.label]).forEach(name => {
                          const match = masterLabels.find(l => l.name === name);
                          if (match && match.id && !labelIds.includes(match.id)) labelIds.push(match.id);
                      });
                  }
                  window[`tempEvents_${item.dateStr}`].push({ ...e, labelIds, sharedGroupId: fId === 'personal' ? null : fId });
              });
          });

          const isToday = (item.dateStr === realTodayStr);
          const isRed = isRedDay(item.dateStr, window[`tempEvents_${item.dateStr}`]);
          const dateColor = isRed ? '#ef4444' : (dayOfWeekNum === 6 ? '#3b82f6' : '#1e40af');
          const dateNumColor = isRed ? '#ef4444' : (dayOfWeekNum === 6 ? '#3b82f6' : '#475569');
          const holidayName = getHolidayName(item.dateStr);
          const holidayHtml = holidayName ? `<span style="font-size:0.75rem; color:#ef4444; font-weight:bold; margin-top:2px;">${holidayName}</span>` : '';

          let rowsHtmlForDate = '';

          // 🌟 1. 일정(Events) 영역 분리 렌더링
          filters.forEach((fId, idx) => {
              const isPersonal = fId === 'personal';
              const gIcon = isPersonal ? '🔒' : '👥';
              const gName = isPersonal ? '개인' : (this.myGroups.find(g => g.id === fId)?.name || '그룹');
              const badgeColor = isPersonal ? '#2563eb' : '#059669';
              const badgeBg = isPersonal ? '#eff6ff' : '#ecfdf5';
              const badgeHtml = filterCount > 1 ? `<div style="font-size:1.1rem; color:${badgeColor}; background:${badgeBg}; padding:2px 6px; border-radius:6px; display:inline-block; margin-top:4px; cursor:help;" title="${gName}">${gIcon}</div>` : '';

              const eventContent = `<div id="compact-events-${item.dateStr}-${fId}" style="display:flex; flex-direction:column; gap:4px;">${this.generateCompactEventEditor(item.dateStr, fId)}</div>`;
              const addBtnHtml = `<button onclick="window.yearViewInstance.addCompactEvent('${item.dateStr}', '${fId}')" style="margin-top:6px; background:#e0f2fe; color:#0369a1; border:1px dashed #7dd3fc; border-radius:4px; padding:2px 8px; cursor:pointer; font-weight:bold; font-size:1.1rem; box-shadow:0 1px 2px rgba(0,0,0,0.05);" title="일정 추가">+</button>`;

              if (idx === 0) {
                  rowsHtmlForDate += `
                  <tr data-year-date="${item.dateStr}" class="year-row-${item.dateStr}">
                    <td rowspan="${totalRows}" class="${isToday ? 'year-today-cell' : ''}" style="padding:8px 4px; border:1px solid #cbd5e1; background:#f8fafc; vertical-align:middle; width:110px;">
                      <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
                        <span onclick="window.goToDay('${item.dateStr}')" style="font-size:1.2rem; font-weight:900; color:${dateNumColor}; line-height:1.1; cursor:pointer;" title="${item.dateStr} 일 보기로 이동">${item.month}월 ${item.day}일</span>
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
                  <tr class="year-row-${item.dateStr}">
                    <td style="padding:4px; border:1px solid #cbd5e1; background:#f0f9ff; color:#0369a1; font-weight:bold; font-size:0.9rem; vertical-align:middle; width:60px; text-align:center;">
                        일정<br>${badgeHtml}<br>${addBtnHtml}
                    </td>
                    <td colspan="${maxP}" style="text-align:left; padding:6px 10px; background:#f0f9ff; vertical-align:top; border:1px solid #cbd5e1;">${eventContent}</td>
                  </tr>`;
              }
          });

          // 🌟 2. 수업(Schedules) 영역 분리 렌더링
          if (store.showClass) {
              const pNamesHtml = (store.periodNames || ["1","2","3","4","5","6"]).map(name => `<td style="font-weight: bold; background: #f8fafc; color: #334155; width: ${100 / maxP}%; text-align: center; border: 1px solid #cbd5e1;">${name}</td>`).join('');
              
              rowsHtmlForDate += `
              <tr class="year-row-${item.dateStr}">
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

                  const periods = window[`tempSchedules_${item.dateStr}`][fId];
                  const periodCellsHtml = Array.from({ length: maxP }).map((_, i) => {
                      const p = i + 1;
                      const pObj = periods[p] || {};
                      let cellText = "";
                      if (pObj.subject && pObj.subject.toUpperCase() !== 'X') cellText += `[${pObj.subject}] `;
                      if (pObj.memo) cellText += pObj.memo + " ";
                      if (pObj.supplies) cellText += `[${pObj.supplies}]`;
                      
                      return `<td class="editable-cell edit-class-cell" data-p="${p}" data-fid="${fId}" contenteditable="true" style="vertical-align: top; text-align: left; padding: 6px 8px; white-space: pre-wrap; border:1px solid #cbd5e1; font-size:1rem; color:#047857; background:#ecfdf5;" oninput="window.yearViewInstance.syncScheduleInputs()">${cellText.trim()}</td>`;
                  }).join('');

                  rowsHtmlForDate += `
                  <tr data-year-schedule-date="${item.dateStr}" data-fid="${fId}" class="year-row-${item.dateStr}">
                    <td style="padding:4px; border:1px solid #cbd5e1; background:#ecfdf5; color:#047857; font-weight:bold; font-size:0.9rem; vertical-align:middle; text-align:center;">
                        수업<br>${badgeHtml}
                    </td>
                    ${periodCellsHtml}
                  </tr>`;
              });
          }
          return rowsHtmlForDate;
        }).join('');

        const targetTbody = document.getElementById(`editor-month-${mObj.year}-${mObj.month}`);
        if (targetTbody) {
            targetTbody.innerHTML = rowsHtml;
            if (mObj.distance === 0) {
                setTimeout(() => {
                    const todayStr = formatDate(new Date());
                    let targetRow = document.querySelector(`tr[data-year-date="${todayStr}"]`);
                    
                    if (!targetRow) {
                        targetRow = document.querySelector(`tr[data-year-date^="${mObj.year}-${String(mObj.month).padStart(2, '0')}"]`);
                    }
                    
                    if (targetRow) {
                        const header = document.querySelector('.app-header');
                        const hOffset = header ? header.offsetHeight : 0;
                        const absoluteY = targetRow.getBoundingClientRect().top + window.pageYOffset;
                        
                        window.scrollTo({top: absoluteY - hOffset - 15, behavior: 'auto'});
                    }
                }, 300);
            }
        }
        await new Promise(r => setTimeout(r, 40)); 
    }

    const progressEl = document.getElementById('year-render-progress');
    if (progressEl) progressEl.remove();

    this.isRendering = false;
  }

  generateCompactEventEditor(dateStr, fId) {
      const allEvents = window[`tempEvents_${dateStr}`] || [];
      const list = allEvents.filter(e => (e.sharedGroupId || 'personal') === fId);
      
      const labelObjs = getEventLabels();
      const realTodayStr = formatDate(new Date());
      const uid = window.auth?.currentUser?.uid;
      const inst = 'window.yearViewInstance';
      
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
      if (this.renderedDateStrings) {
          this.renderedDateStrings.forEach(dateStr => this.syncCompactEventInputs(dateStr));
      }
  }

  syncScheduleInputs() {
      document.querySelectorAll(`tr[data-year-schedule-date]`).forEach(row => {
          const dateStr = row.getAttribute('data-year-schedule-date');
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
    if (this.isRendering) return alert('화면을 로딩 중입니다. 렌더링이 완료된 후 저장해 주세요.');
    
    this.syncScheduleInputs(); 
    this.syncAllCompactEventInputs();

    const snapshot = this.renderedDateStrings.map(dateStr => {
        const rawList = window[`tempEvents_${dateStr}`] || [];
        const validEvents = rawList
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
    let batch = writeBatch(window.db);
    let opCount = 0;
    let batchPromises = [];
    
    snapshot.forEach(item => {
        const eventsByGroup = { 'personal': [] };
        this.myGroups.forEach(g => eventsByGroup[g.id] = []);

        item.validEvents.forEach(e => {
            const gId = e.sharedGroupId === 'personal' ? 'personal' : (e.sharedGroupId || 'personal');
            if (eventsByGroup[gId]) eventsByGroup[gId].push(e);
        });

        const pEvents = eventsByGroup['personal'];
        batch.set(doc(getUserCol('events'), item.dateStr), {
            eventList: pEvents,
            eventText: window.formatEventListToText ? window.formatEventListToText(pEvents) : '',
            updatedAt: Date.now()
        }, { merge: true });
        opCount++;
        if (opCount >= 400) { batchPromises.push(batch.commit()); batch = writeBatch(window.db); opCount = 0; }

        this.myGroups.forEach(g => {
            const gEvents = eventsByGroup[g.id];
            batch.set(doc(getGroupCol(g.id, 'events'), item.dateStr), {
                eventList: gEvents,
                eventText: window.formatEventListToText ? window.formatEventListToText(gEvents) : '',
                updatedAt: Date.now()
            }, { merge: true });
            opCount++;
            if (opCount >= 400) { batchPromises.push(batch.commit()); batch = writeBatch(window.db); opCount = 0; }
        });

        window.activeUnifiedFilters.forEach(fId => {
            const periods = item.schedulesData[fId] || {};
            const scheduleCol = fId === 'personal' ? getUserCol('schedules') : getGroupCol(fId, 'schedules');
            
            const isSkipDay = item.validEvents.some(e => (e.sharedGroupId || 'personal') === fId && e.labelIds?.some(id => masterLabels.find(l => l.id === id)?.isSkip));
            if (isSkipDay) {
                Object.values(periods).forEach(p => p.subject = '');
            }
            
            batch.set(doc(scheduleCol, item.dateStr), { 
                periods: periods, updatedAt: Date.now() 
            }, { merge: true });
            opCount++;
            if (opCount >= 400) { batchPromises.push(batch.commit()); batch = writeBatch(window.db); opCount = 0; }
        });
    });

    if (opCount > 0) batchPromises.push(batch.commit());
    Promise.all(batchPromises).catch(e => console.warn(e));
    
    store.hasUnsavedChanges = false;
  }
}

const instance = new YearView(document.getElementById("main-view"));
Object.assign(window, {
    yearViewInstance: instance,
    renderYearViewer: (c) => { instance.container = c; instance.renderViewer(); },
    renderYearEditor: (c) => { instance.container = c; instance.renderEditor(); },
    saveYearDataFromEditor: () => instance.save(),

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
