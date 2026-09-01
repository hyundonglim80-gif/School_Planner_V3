// js/views/viewYear.js
import { BaseView } from '../components/BaseView.js';
import { store } from '../core/store.js';
import { formatDate, isRedDay, getHolidayName } from '../core/utils.js';
import { dbAPI } from '../api/database.js'; 
import { auth } from '../api/firebaseInit.js'; 
import { generateEventBadgesHTML } from '../core/eventManager.js';
import { CompactEventHelper } from '../ui/templateHelpers.js';
import { fetchCalendarData, saveCalendarData } from '../core/calendarDataManager.js';

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

  getPrioritizedMonths(targetY) {
    const nextYear = targetY + 1;
    const monthsInfo = [
      { year: targetY, month: 3, label: "3월" }, { year: targetY, month: 4, label: "4월" }, { year: targetY, month: 5, label: "5월" }, { year: targetY, month: 6, label: "6월" },
      { year: targetY, month: 7, label: "7월" }, { year: targetY, month: 8, label: "8월" }, { year: targetY, month: 9, label: "9월" }, { year: targetY, month: 10, label: "10월" },
      { year: targetY, month: 11, label: "11월" }, { year: targetY, month: 12, label: "12월" }, { year: nextYear, month: 1, label: "1월" }, { year: nextYear, month: 2, label: "2월" }
    ];

    const targetDate = store.currentDate || new Date();
    const currentYearVal = targetDate.getFullYear();
    const currentMonthVal = targetDate.getMonth() + 1;

    let currentIndex = monthsInfo.findIndex(m => m.year === currentYearVal && m.month === currentMonthVal);
    if (currentIndex === -1) currentIndex = 0; 

    const prioritizedMonths = monthsInfo.map((m, idx) => ({
      ...m, distance: Math.abs(idx - currentIndex), match: `${m.year}-${String(m.month).padStart(2, '0')}-` 
    })).sort((a, b) => a.distance - b.distance);

    return { orderedMonths: monthsInfo, prioritizedMonths };
  }

  async renderViewer() {
    this.renderId = Date.now();
    const currentRenderId = this.renderId;
    this.isRendering = true;

    try {
        this.showLoading('클라우드에서 연간 일정을 가져오는 중입니다...'); 

        if (this.container) {
            this.container.style.overflow = 'visible';
            this.container.style.overflowX = 'visible';
            this.container.style.overflowY = 'visible';
        }

        if (!window.db) return;

        let allEvents = [];
        const targetY = this.currentDate ? this.currentDate.getFullYear() : new Date().getFullYear();
        const startStr = `${targetY}-03-01`;
        const febLastDay = new Date(targetY + 1, 2, 0).getDate();
        const endStr = `${targetY + 1}-02-${febLastDay}`;

        try { this.myGroups = await dbAPI.loadMyGroups(); } catch(e) { this.myGroups = []; }
        
        let eMap = {}, sMap = {}, jMap = {}, vMap = {};
        try {
            const res = await fetchCalendarData(startStr, endStr, this.myGroups);
            eMap = res.eMap; sMap = res.sMap; jMap = res.jMap; vMap = res.vMap;
        } catch (e) {
            if (window.promptOfflineSync && await window.promptOfflineSync(this, 'renderViewer')) return;
        }

        if (this.renderId !== currentRenderId) return;

        window.currentMyGroups = this.myGroups;
        if (!window.activeUnifiedFilters) window.activeUnifiedFilters = ['personal', ...this.myGroups.map(g => g.id)];
        if (window.FilterUI) window.FilterUI.renderUnifiedFilter(this.myGroups);
        if (store.mode === 'editor') this.scheduleGroupId = window.activeUnifiedFilters.includes('personal') ? null : window.activeUnifiedFilters[0];

        const allDates = new Set([...Object.keys(eMap), ...Object.keys(sMap), ...Object.keys(jMap), ...Object.keys(vMap)]);
        const filters = window.activeUnifiedFilters;
        const filterCount = filters.length;

        allDates.forEach(dateStr => {
            let hasContent = false; let contentHtml = ''; let allProcessedEventsForDate = [];

            filters.forEach((fId, idx) => {
                const isPersonal = fId === 'personal';
                const gIcon = isPersonal ? '🔒' : '👥';
                const gName = isPersonal ? '개인' : (this.myGroups.find(g => g.id === fId)?.name || '그룹');
                const iconColor = isPersonal ? '#2563eb' : '#059669';
                const badgeBg = isPersonal ? '#eff6ff' : '#ecfdf5';

                const fEvents = (eMap[dateStr]?.eventList || []).filter(e => (e.sharedGroupId || 'personal') === fId);
                const processedEvents = fEvents.map(e => ({ ...e, labelIds: e.labelIds || [] }));
                allProcessedEventsForDate.push(...processedEvents);
                let eventHtml = processedEvents.length > 0 ? `<div style="margin-top:2px;">${generateEventBadgesHTML(processedEvents, dateStr, 'compact')}</div>` : '';

                const jList = jMap[dateStr]?.[fId] || [];
                const validJournals = jList.filter(j => (j.content && j.content.trim() !== '') || (j.attachments && j.attachments.length > 0));
                const vList = vMap[dateStr]?.[fId] || [];

                let attachmentCount = 0;
                validJournals.forEach(j => { if (j.attachments) attachmentCount += j.attachments.length; });

                let metaBadges = '';
                if (validJournals.length > 0) metaBadges += `<span style="display:inline-flex; align-items:center; background:#fdf2f8; color:#be185d; padding:1px 4px; border-radius:4px; font-size:0.65rem; font-weight:bold; margin-right:2px;" title="기록">📔${validJournals.length}</span>`;
                if (vList.length > 0) metaBadges += `<span style="display:inline-flex; align-items:center; background:#eff6ff; color:#1e40af; padding:1px 4px; border-radius:4px; font-size:0.65rem; font-weight:bold; margin-right:2px;" title="조사표">📊${vList.length}</span>`;
                if (attachmentCount > 0) metaBadges += `<span style="display:inline-flex; align-items:center; background:#f8fafc; color:#475569; padding:0 3px; border-radius:4px; font-size:0.65rem; font-weight:bold; margin-right:2px; border:1px solid #cbd5e1;" title="첨부파일">📎${attachmentCount}</span>`;

                if (metaBadges) {
                    eventHtml += `<div style="margin-top:4px; display:flex; flex-wrap:wrap;">${metaBadges}</div>`;
                }

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
                    if (hasClass) scheduleHtml = `<div style="display:flex; flex-wrap:nowrap; gap:2px; width:100%; margin-top:2px; margin-bottom:2px;">${boxesHtml}</div>`;
                }

                if (eventHtml || scheduleHtml) {
                    hasContent = true;
                    const topBorder = contentHtml !== '' ? 'border-top: 1px dashed #cbd5e1; padding-top: 6px; margin-top: 4px;' : 'margin-top: 4px;';
                    const iconBadge = filterCount > 1 ? `<div style="display:inline-flex; align-items:center; justify-content:center; width:20px; height:20px; font-size:0.85rem; border-radius:4px; background:${badgeBg}; color:${iconColor}; border:1px solid ${iconColor}; margin-bottom:4px; cursor:help;" title="${gName}">${gIcon}</div>` : '';
                    contentHtml += `<div style="${topBorder} display:flex; flex-direction:column; align-items:stretch; width:100%;">${iconBadge}${scheduleHtml}${eventHtml}</div>`;
                }
            });

            if (hasContent) allEvents.push({ dateStr: dateStr, htmlOutput: contentHtml, events: allProcessedEventsForDate }); 
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
        
        const realTodayStr = formatDate(new Date());

        for (const mObj of prioritizedMonths) {
            if (this.renderId !== currentRenderId) return;

            const monthEvents = allEvents.filter(e => e.dateStr.startsWith(mObj.match));
            let eventListHtml = '';
            
            if (monthEvents.length > 0) {
            eventListHtml = monthEvents.map(e => {
                const parts = e.dateStr.split('-'); const dayNum = parseInt(parts[2], 10);
                const dateObj = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, dayNum);
                const dayOfWeek = dayNames[dateObj.getDay()];
                
                const isTodayEvent = (e.dateStr === realTodayStr);
                const eventStyle = isTodayEvent 
                    ? 'background-color:#eff6ff; padding:8px; border-radius:6px; border:2px solid #3b82f6; margin-bottom:10px;' 
                    : 'margin-bottom:10px; border-bottom:1px dashed #e2e8f0; padding-bottom:6px;';

                let dateColor = '#2563eb'; 
                if (isRedDay(e.dateStr, e.events)) dateColor = '#ef4444';
                else if (dateObj.getDay() === 6) dateColor = '#3b82f6';

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

            const cardHtml = `<div id="viewer-card-${mObj.year}-${mObj.month}" class="mini-month ${cardClass}" style="display:flex; flex-direction:column; gap:8px;"><h3 style="color:#1e40af; border-bottom:2px solid #bfdbfe; padding-bottom:4px; text-align:center;">${mObj.label}</h3><div style="line-height:1.4;">${eventListHtml}</div></div>`;
            
            const containerEl = document.getElementById(`viewer-month-${mObj.year}-${mObj.month}`);
            if (containerEl) {
                containerEl.outerHTML = cardHtml;
                if (mObj.distance === 0) {
                    setTimeout(() => {
                        const focusEl = document.getElementById(`viewer-card-${mObj.year}-${mObj.month}`);
                        if (focusEl) {
                            const header = document.querySelector('.app-header');
                            const absoluteY = focusEl.getBoundingClientRect().top + window.pageYOffset;
                            window.scrollTo({top: absoluteY - (header ? header.offsetHeight : 0) - 10, behavior: 'auto'});
                        }
                    }, 300);
                }
            }
            await new Promise(r => setTimeout(r, 40)); 
        }
        document.getElementById('year-render-progress')?.remove();
    } finally { this.isRendering = false; }
  }

  async renderEditor() {
    this.renderId = Date.now();
    const currentRenderId = this.renderId;
    this.isRendering = true;

    try {
        this.showLoading('연간 데이터를 가져오는 중입니다...'); 
        if (this.container) { this.container.style.overflow = 'visible'; this.container.style.overflowX = 'visible'; this.container.style.overflowY = 'visible'; }
        if (!window.db) return;

        const currentYear = this.currentDate ? this.currentDate.getFullYear() : new Date().getFullYear();
        const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

        const startStr = `${currentYear}-03-01`; const nextYear = currentYear + 1;
        const febLastDay = new Date(nextYear, 2, 0).getDate(); const endStr = `${nextYear}-02-${febLastDay}`;

        try { this.myGroups = await dbAPI.loadMyGroups(); } catch(e) { this.myGroups = []; } 
        
        let eMap = {}, sMap = {}, jMap = {}, vMap = {};
        try {
            const res = await fetchCalendarData(startStr, endStr, this.myGroups);
            eMap = res.eMap; sMap = res.sMap; jMap = res.jMap; vMap = res.vMap;
        } catch (e) {
            if (window.promptOfflineSync && await window.promptOfflineSync(this, 'renderEditor')) return;
        }

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
                chunk.push({ 
                    year: mObj.year, month: mObj.month, day: d, dateStr, 
                    data: { periods: sMap[dateStr] || {} }, 
                    eventData: eMap[dateStr] || {},
                    journalData: jMap[dateStr] || {},
                    evalData: vMap[dateStr] || {}
                });
            }
            monthChunksMap[`${mObj.year}-${mObj.month}`] = chunk;
        }

        this.renderedDateStrings = [];
        const realTodayStr = formatDate(new Date());

        const progressHtml = `
            <div id="year-render-progress" style="display:flex; justify-content:center; align-items:center; padding:12px; margin-bottom:15px; background:#eff6ff; color:#2563eb; border-radius:8px; font-weight:bold; font-size:1rem; gap:10px; border:1px solid #bfdbfe;">
                <div style="width:20px; height:20px; border:3px solid #bfdbfe; border-top-color:#2563eb; border-radius:50%; animation:spin 1s linear infinite;"></div>
                현재 월부터 순차적으로 화면을 부드럽게 구성하고 있습니다...
            </div>
            <style>@keyframes spin { 100% { transform:rotate(360deg); } }</style>
        `;

        const colgroupHtml = `<colgroup><col style="width: 110px;"><col style="width: 60px;">${Array.from({length: maxP}).map(() => `<col>`).join('')}</colgroup>`;

        this.container.innerHTML = `
        <div id="year-main-content" class="table-container" style="background:#fff; padding:12px; border-radius:8px; margin-top:15px; overflow:visible;">
            ${progressHtml}
            <table id="year-editor-table" style="width:100%; border-collapse:collapse; text-align:center; table-layout:fixed;">
            ${colgroupHtml}
            <tbody style="border-bottom: 2px solid #cbd5e1;"><tr style="background:#f1f5f9;"><td style="padding:8px; border:1px solid #cbd5e1; font-weight:bold; color:#1e293b;">날짜</td><td style="padding:8px; border:1px solid #cbd5e1; font-weight:bold; color:#1e293b;">구분</td><td colspan="${maxP}" style="padding:8px; border:1px solid #cbd5e1; font-weight:bold; color:#1e293b;">📌 내용 (직접 수정)</td></tr></tbody>
            ${orderedMonths.map(m => `<tbody id="editor-month-${m.year}-${m.month}"><tr><td colspan="${maxP + 2}" style="padding:40px; color:#94a3b8; font-weight:bold; background:#f8fafc; border:1px solid #e2e8f0;">${m.label} 로딩 중...</td></tr></tbody>`).join('')}
            </table>
        </div>`;

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
                window[`tempSchedules_${item.dateStr}`][fId] = item.data.periods?.[fId] || {};
                (item.eventData.eventList || []).filter(e => (e.sharedGroupId || 'personal') === fId).forEach(e => {
                    window[`tempEvents_${item.dateStr}`].push({ ...e, labelIds: e.labelIds || [], sharedGroupId: fId === 'personal' ? null : fId });
                });
            });

            const isToday = (item.dateStr === realTodayStr);
            const isRed = isRedDay(item.dateStr, window[`tempEvents_${item.dateStr}`]);
            const dateColor = isRed ? '#ef4444' : (dayOfWeekNum === 6 ? '#3b82f6' : '#1e40af');
            const dateNumColor = isRed ? '#ef4444' : (dayOfWeekNum === 6 ? '#3b82f6' : '#475569');
            const holidayName = getHolidayName(item.dateStr);
            const holidayHtml = holidayName ? `<span style="font-size:0.75rem; color:#ef4444; font-weight:bold; margin-top:2px;">${holidayName}</span>` : '';

            let rowsHtmlForDate = '';

            filters.forEach((fId, idx) => {
                const isPersonal = fId === 'personal';
                const gIcon = isPersonal ? '🔒' : '👥';
                const badgeColor = isPersonal ? '#2563eb' : '#059669';
                const badgeBg = isPersonal ? '#eff6ff' : '#ecfdf5';
                const badgeHtml = filterCount > 1 ? `<div style="font-size:1.1rem; color:${badgeColor}; background:${badgeBg}; padding:2px 6px; border-radius:6px; display:inline-block; margin-top:4px; cursor:help;" title="${isPersonal ? '개인' : (this.myGroups.find(g => g.id === fId)?.name || '그룹')}">${gIcon}</div>` : '';

                let eventContent = `<div id="compact-events-${item.dateStr}-${fId}" style="display:flex; flex-direction:column; gap:4px;">${CompactEventHelper.generateCompactEventEditor(item.dateStr, fId)}</div>`;
                
                // 💡 [기록, 조사표, 첨부파일 아이콘 추가]
                const jList = item.journalData[fId] || [];
                const validJournals = jList.filter(j => (j.content && j.content.trim() !== '') || (j.attachments && j.attachments.length > 0));
                const vList = item.evalData[fId] || [];

                let attachmentCount = 0;
                validJournals.forEach(j => { if (j.attachments) attachmentCount += j.attachments.length; });

                let metaBadges = '';
                if (validJournals.length > 0) metaBadges += `<span style="display:inline-flex; align-items:center; background:#fdf2f8; color:#be185d; padding:1px 4px; border-radius:4px; font-size:0.65rem; font-weight:bold; margin-right:2px;" title="기록">📔${validJournals.length}</span>`;
                if (vList.length > 0) metaBadges += `<span style="display:inline-flex; align-items:center; background:#eff6ff; color:#1e40af; padding:1px 4px; border-radius:4px; font-size:0.65rem; font-weight:bold; margin-right:2px;" title="조사표">📊${vList.length}</span>`;
                if (attachmentCount > 0) metaBadges += `<span style="display:inline-flex; align-items:center; background:#f8fafc; color:#475569; padding:0 3px; border-radius:4px; font-size:0.65rem; font-weight:bold; margin-right:2px; border:1px solid #cbd5e1;" title="첨부파일">📎${attachmentCount}</span>`;

                if (metaBadges) {
                    eventContent += `<div style="margin-top:6px; display:flex; flex-wrap:wrap;">${metaBadges}</div>`;
                }

                const addBtnHtml = `<button onclick="window.CompactEventHelper.addCompactEvent('${item.dateStr}', '${fId}')" style="margin-top:6px; background:#e0f2fe; color:#0369a1; border:1px dashed #7dd3fc; border-radius:4px; padding:2px 8px; cursor:pointer; font-weight:bold; font-size:1.1rem; box-shadow:0 1px 2px rgba(0,0,0,0.05);" title="일정 추가">+</button>`;

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
                        <td style="padding:4px; border:1px solid #cbd5e1; background:#f0f9ff; color:#0369a1; font-weight:bold; font-size:0.9rem; vertical-align:middle; width:60px; text-align:center;">일정<br>${badgeHtml}<br>${addBtnHtml}</td>
                        <td colspan="${maxP}" style="text-align:left; padding:6px 10px; background:#f0f9ff; vertical-align:top; border:1px solid #cbd5e1;">${eventContent}</td>
                    </tr>`;
                } else {
                    rowsHtmlForDate += `
                    <tr class="year-row-${item.dateStr}">
                        <td style="padding:4px; border:1px solid #cbd5e1; background:#f0f9ff; color:#0369a1; font-weight:bold; font-size:0.9rem; vertical-align:middle; width:60px; text-align:center;">일정<br>${badgeHtml}<br>${addBtnHtml}</td>
                        <td colspan="${maxP}" style="text-align:left; padding:6px 10px; background:#f0f9ff; vertical-align:top; border:1px solid #cbd5e1;">${eventContent}</td>
                    </tr>`;
                }
            });

            if (store.showClass) {
                const pNamesHtml = (store.periodNames || ["1","2","3","4","5","6"]).map(name => `<td style="font-weight: bold; background: #f8fafc; color: #334155; width: ${100 / maxP}%; text-align: center; border: 1px solid #cbd5e1;">${name}</td>`).join('');
                rowsHtmlForDate += `<tr class="year-row-${item.dateStr}"><td style="font-weight: bold; background: #f1f5f9; color: #475569; vertical-align: middle; text-align: center; border: 1px solid #cbd5e1;">교시</td>${pNamesHtml}</tr>`;

                filters.forEach((fId) => {
                    const isPersonal = fId === 'personal';
                    const gIcon = isPersonal ? '🔒' : '👥';
                    const badgeColor = isPersonal ? '#2563eb' : '#059669';
                    const badgeBg = isPersonal ? '#eff6ff' : '#ecfdf5';
                    const badgeHtml = filterCount > 1 ? `<div style="font-size:1.1rem; color:${badgeColor}; background:${badgeBg}; padding:2px 6px; border-radius:6px; display:inline-block; margin-top:4px; cursor:help;" title="${isPersonal ? '개인' : (this.myGroups.find(g => g.id === fId)?.name || '그룹')}">${gIcon}</div>` : '';

                    const periods = window[`tempSchedules_${item.dateStr}`][fId];
                    const periodCellsHtml = Array.from({ length: maxP }).map((_, i) => {
                        const p = i + 1; const pObj = periods[p] || {}; let cellText = "";
                        if (pObj.subject && pObj.subject.toUpperCase() !== 'X') cellText += `[${pObj.subject}] `;
                        if (pObj.memo) cellText += pObj.memo + " ";
                        if (pObj.supplies) cellText += `[${pObj.supplies}]`;
                        return `<td class="editable-cell edit-class-cell" data-p="${p}" data-fid="${fId}" contenteditable="true" style="vertical-align: top; text-align: left; padding: 6px 8px; white-space: pre-wrap; border:1px solid #cbd5e1; font-size:1rem; color:#047857; background:#ecfdf5;" oninput="window.yearViewInstance.syncScheduleInputs()">${cellText.trim()}</td>`;
                    }).join('');

                    rowsHtmlForDate += `<tr data-year-schedule-date="${item.dateStr}" data-fid="${fId}" class="year-row-${item.dateStr}"><td style="padding:4px; border:1px solid #cbd5e1; background:#ecfdf5; color:#047857; font-weight:bold; font-size:0.9rem; vertical-align:middle; text-align:center;">수업<br>${badgeHtml}</td>${periodCellsHtml}</tr>`;
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
                        let targetRow = document.querySelector(`tr[data-year-date="${todayStr}"]`) || document.querySelector(`tr[data-year-date^="${mObj.year}-${String(mObj.month).padStart(2, '0')}"]`);
                        if (targetRow) {
                            const header = document.querySelector('.app-header');
                            const absoluteY = targetRow.getBoundingClientRect().top + window.pageYOffset;
                            window.scrollTo({top: absoluteY - (header ? header.offsetHeight : 0) - 15, behavior: 'auto'});
                        }
                    }, 300);
                }
            }
            await new Promise(r => setTimeout(r, 40)); 
        }
        document.getElementById('year-render-progress')?.remove();
    } finally { this.isRendering = false; }
  }

  syncCompactEventInputs(dateStr) { CompactEventHelper.syncCompactEventInputs(dateStr); }
  syncAllCompactEventInputs() { if (this.renderedDateStrings) this.renderedDateStrings.forEach(dateStr => this.syncCompactEventInputs(dateStr)); }
  syncScheduleInputs() { CompactEventHelper.syncScheduleInputs('data-year-schedule-date', 'edit-class-cell'); }

  async save() {
    if (this.isRendering) return; 
    this.syncScheduleInputs(); 
    this.syncAllCompactEventInputs();

    const snapshot = this.renderedDateStrings.map(dateStr => {
        const rawList = window[`tempEvents_${dateStr}`] || [];
        const validEvents = rawList.filter(e => e.content?.trim() || e.labelIds?.length > 0).map(e => ({
                ...e, 
                // 💡 [버그 해결] 라벨 ID 등 기존 메타데이터 보존 처리
                id: e.id || 'ev_' + Date.now() + Math.random().toString(36).substr(2,5),
                authorId: e.authorId || auth?.currentUser?.uid, 
                sharedGroupId: e.sharedGroupId || 'personal'
            }));
        return { dateStr, validEvents, schedulesData: JSON.parse(JSON.stringify(window[`tempSchedules_${dateStr}`] || {})) };
    });

    await saveCalendarData(snapshot, this.myGroups, window.activeUnifiedFilters);
    store.hasUnsavedChanges = false;
  }
}

const instance = new YearView(document.getElementById("main-view"));
Object.assign(window, {
    yearViewInstance: instance,
    renderYearViewer: (c) => { instance.container = c; instance.renderViewer(); },
    renderYearEditor: (c) => { instance.container = c; instance.renderEditor(); },
    saveYearDataFromEditor: () => instance.save()
});
