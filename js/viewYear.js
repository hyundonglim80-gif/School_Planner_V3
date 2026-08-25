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
    this.scheduleGroupId = null; // 에디터 모드 전용(단일 선택)
    this.renderId = 0; 
    this.isRendering = false; 
    this.activeFilters = null; // 🌟 뷰어/에디터 통합 필터
    this.renderedDateStrings = [];
  }

  getUnifiedFilterHtml() {
      let isPersonalActive = false;
      let activeGroupIds = [];

      if (store.mode === 'editor') {
          isPersonalActive = (this.scheduleGroupId === null || this.scheduleGroupId === 'personal');
          if (this.scheduleGroupId && this.scheduleGroupId !== 'personal') activeGroupIds.push(this.scheduleGroupId);
      } else {
          if (!this.activeFilters) this.activeFilters = ['personal', ...this.myGroups.map(g => g.id)];
          isPersonalActive = this.activeFilters.includes('personal');
          activeGroupIds = this.activeFilters;
      }

      let html = `<div style="display:inline-flex; align-items:center; gap:4px; background:#f8fafc; padding:3px 6px; border-radius:8px; border:1px solid #e2e8f0;">`;
      html += `<div onclick="window.toggleUnifiedFilter('personal')" style="padding:4px 10px; font-size:0.8rem; border-radius:6px; cursor:pointer; font-weight:bold; transition:0.2s; ${isPersonalActive ? 'background:#3b82f6; color:#fff; box-shadow:0 1px 2px rgba(0,0,0,0.1);' : 'background:transparent; color:#64748b;'}">🔒 개인</div>`;

      this.myGroups.forEach(g => {
          const isActive = activeGroupIds.includes(g.id);
          html += `<div onclick="window.toggleUnifiedFilter('${g.id}')" style="padding:4px 10px; font-size:0.8rem; border-radius:6px; cursor:pointer; font-weight:bold; transition:0.2s; ${isActive ? 'background:#10b981; color:#fff; box-shadow:0 1px 2px rgba(0,0,0,0.1);' : 'background:transparent; color:#64748b;'}">👥 ${g.name}</div>`;
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

  // 🌟 [최적화 1] 1년 치가 아닌, 요청한 특정 기간(1개월)의 데이터만 조회하는 함수로 변경
  async fetchDataForRange(startStr, endStr) {
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

  async loadSingleMonthData(mObj) {
      const y = mObj.year;
      const m = mObj.month;
      const lastDate = new Date(y, m, 0).getDate();
      const startStr = `${y}-${String(m).padStart(2, '0')}-01`;
      const endStr = `${y}-${String(m).padStart(2, '0')}-${String(lastDate).padStart(2, '0')}`;
      return await this.fetchDataForRange(startStr, endStr);
  }

  // ==============================================================================
  // 👁️ [뷰어 모드]
  // ==============================================================================
  async renderViewer() {
    this.renderId = Date.now();
    const currentRenderId = this.renderId;
    this.isRendering = true;

    this.showLoading('이번 달 일정을 불러오는 중입니다...'); 

    if (this.container) this.container.style.overflow = 'visible';
    if (!window.db) return;

    if (!this.activeFilters) this.activeFilters = ['personal', ...this.myGroups.map(g => g.id)];
    
    const targetY = this.currentDate ? this.currentDate.getFullYear() : new Date().getFullYear();
    const { orderedMonths, prioritizedMonths } = this.getPrioritizedMonths(targetY);
    
    // 🌟 1. 12개월의 빈 껍데기(Skeleton) UI를 즉시 생성
    const cardHtmlMap = {};
    for (const m of orderedMonths) {
        cardHtmlMap[`${m.year}-${m.month}`] = `<div id="viewer-month-${m.year}-${m.month}" style="height:600px; background:#f8fafc; border-radius:8px; border:1px dashed #cbd5e1; display:flex; align-items:center; justify-content:center; color:#94a3b8; font-weight:bold;">${m.label} 로딩 중...</div>`;
    }

    const progressHtml = `
        <div id="year-render-progress" style="display:flex; justify-content:center; align-items:center; padding:12px; margin-bottom:15px; background:#eff6ff; color:#2563eb; border-radius:8px; font-weight:bold; font-size:1rem; gap:10px; border:1px solid #bfdbfe;">
            <div style="width:20px; height:20px; border:3px solid #bfdbfe; border-top-color:#2563eb; border-radius:50%; animation:spin 1s linear infinite;"></div>
            나머지 월의 데이터를 백그라운드에서 불러오는 중...
        </div>
        <style>@keyframes spin { 100% { transform:rotate(360deg); } }</style>
    `;

    this.container.innerHTML = `
        <div id="year-main-content">
            ${progressHtml}
            <div class="year-grid" id="year-grid-container">
               ${orderedMonths.map(m => cardHtmlMap[`${m.year}-${m.month}`]).join('')}
            </div>
        </div>
    `;

    const filterSlot = document.getElementById('global-unified-filter-slot');
    if (filterSlot) filterSlot.innerHTML = this.getUnifiedFilterHtml();

    // 🌟 2. 1순위(현재 월)의 데이터만 즉시 Firebase에서 요청하여 렌더링
    const targetMonthObj = prioritizedMonths[0];
    const firstMonthData = await this.loadSingleMonthData(targetMonthObj);
    if (this.renderId !== currentRenderId) return;

    this.renderMonthToViewerCard(targetMonthObj, firstMonthData.eMap, firstMonthData.sMap);
    
    // 🌟 3. 현재 월이 그려지자마자 그 위치로 부드럽지 않게(auto) 즉각 스크롤
    requestAnimationFrame(() => {
        const focusEl = document.getElementById(`viewer-card-${targetMonthObj.year}-${targetMonthObj.month}`);
        if (focusEl) {
            const header = document.querySelector('.app-header');
            const hOffset = header ? header.offsetHeight : 0;
            const absoluteY = focusEl.getBoundingClientRect().top + window.scrollY;
            window.scrollTo({top: absoluteY - hOffset - 15, behavior: 'auto'});
        }
    });

    // 🌟 4. 나머지 11개월은 사용자가 눈치채지 못하게 백그라운드에서 조용히 불러옵니다.
    this.loadRemainingMonthsViewer(prioritizedMonths.slice(1), currentRenderId);
  }

  renderMonthToViewerCard(mObj, eMap, sMap) {
      const y = mObj.year; const m = mObj.month;
      const lastDate = new Date(y, m, 0).getDate();
      const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
      const realTodayStr = formatDate(new Date());
      const maxP = store.periodNames ? store.periodNames.length : 6;
      
      let allEvents = [];
      for (let d = 1; d <= lastDate; d++) {
          const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          let htmlOutput = ''; let processedEvents = []; let boxesHtml = ''; let hasClass = false;

          for (let p = 1; p <= maxP; p++) {
              let pTexts = [];
              this.activeFilters.forEach(filterId => {
                  const subj = sMap[dateStr]?.[filterId]?.[p]?.subject;
                  if (subj && subj.trim() !== '' && subj.toUpperCase() !== 'X') {
                      let prefix = this.activeFilters.length > 1 ? (filterId === 'personal' ? '🔒 ' : '👥 ') : '';
                      pTexts.push(prefix + subj.trim());
                  }
              });

              if (pTexts.length > 0) {
                  hasClass = true;
                  const text = pTexts.join(' / ');
                  let fontSize = text.length >= 5 ? "0.45rem" : (text.length === 4 ? "0.55rem" : (text.length === 3 ? "0.65rem" : "0.75rem"));
                  let letterSpacing = text.length >= 5 ? "-1.5px" : (text.length === 4 ? "-1px" : (text.length === 3 ? "-0.5px" : "normal"));
                  boxesHtml += `<div style="display:flex; align-items:center; justify-content:center; flex:1; min-width:0; height:22px; box-sizing:border-box; border:1px solid #6ee7b7; border-radius:4px; background:#ecfdf5; color:#047857; font-size:${fontSize}; font-weight:700; letter-spacing:${letterSpacing}; white-space:nowrap; overflow:hidden;" title="${text}">${text}</div>`;
              } else {
                  boxesHtml += `<div style="display:flex; align-items:center; justify-content:center; flex:1; min-width:0; height:22px; box-sizing:border-box; border:1px solid #e2e8f0; border-radius:4px; background:#f8fafc; color:#94a3b8; font-size:0.75rem; font-weight:700;">&nbsp;</div>`;
              }
          }

          let scheduleHtml = (hasClass && store.showClass) ? `<div style="display:flex; flex-wrap:nowrap; gap:2px; margin-top:4px; margin-bottom:4px; width:100%;">${boxesHtml}</div>` : '';
          if (scheduleHtml) htmlOutput += scheduleHtml;

          if (eMap[dateStr] && eMap[dateStr].eventList && eMap[dateStr].eventList.length > 0) {
              const filteredEvents = eMap[dateStr].eventList.filter(e => this.activeFilters.includes(e.sharedGroupId || 'personal'));
              processedEvents = filteredEvents.map(e => ({ 
                  ...e, labelIds: e.labelIds || [],
                  content: (e.sharedGroupId ? `<span style="display:inline-block; padding:2px 6px; font-size:0.75rem; border-radius:4px; background:#e0f2fe; color:#0369a1; border:1px solid #bae6fd; margin-right:4px; vertical-align:middle; font-weight:bold;">👥 ${e.groupName}</span> ` : '') + e.content
              }));
              if(processedEvents.length > 0) htmlOutput += generateEventBadgesHTML(processedEvents, dateStr, 'compact');
          }

          if (htmlOutput) allEvents.push({ dateStr, htmlOutput, events: processedEvents }); 
      }

      let eventListHtml = '';
      if (allEvents.length > 0) {
          eventListHtml = allEvents.map(e => {
              const parts = e.dateStr.split('-');
              const dayNum = parseInt(parts[2], 10);
              const dateObj = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, dayNum);
              const dayOfWeek = dayNames[dateObj.getDay()];
              
              const isTodayEvent = (e.dateStr === realTodayStr);
              const eventStyle = isTodayEvent ? 'background-color:#eff6ff; padding:8px; border-radius:6px; border:2px solid #3b82f6; margin-bottom:10px;' : 'margin-bottom:10px; border-bottom:1px dashed #e2e8f0; padding-bottom:6px;';
              
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

      const cardHtml = `
        <div id="viewer-card-${mObj.year}-${mObj.month}" class="mini-month ${cardClass}" style="display:flex; flex-direction:column; gap:8px;">
          <h3 style="color:#1e40af; border-bottom:2px solid #bfdbfe; padding-bottom:4px; text-align:center;">${mObj.label}</h3>
          <div style="line-height:1.4;">${eventListHtml}</div>
        </div>`;
      
      const containerEl = document.getElementById(`viewer-month-${mObj.year}-${mObj.month}`);
      if (containerEl) containerEl.outerHTML = cardHtml;
  }

  async loadRemainingMonthsViewer(remainingMonths, currentRenderId) {
      for (const mObj of remainingMonths) {
          if (this.renderId !== currentRenderId) return;
          const data = await this.loadSingleMonthData(mObj);
          if (this.renderId !== currentRenderId) return;
          this.renderMonthToViewerCard(mObj, data.eMap, data.sMap);
          // 브라우저가 숨을 돌리도록 아주 짧은 휴식 부여 (화면 멈춤 방지)
          await new Promise(r => setTimeout(r, 50)); 
      }
      const progressEl = document.getElementById('year-render-progress');
      if (progressEl) progressEl.remove();
      this.isRendering = false;
  }


  // ==============================================================================
  // ✏️ [에디터 모드]
  // ==============================================================================
  async renderEditor() {
    this.renderId = Date.now();
    const currentRenderId = this.renderId;
    this.isRendering = true;

    this.showLoading('이번 달 편집 시트를 불러오는 중입니다...'); 

    if (this.container) this.container.style.overflow = 'visible';
    if (!window.db) return;

    if (!this.activeFilters) this.activeFilters = ['personal', ...this.myGroups.map(g => g.id)];
    
    const currentYear = this.currentDate ? this.currentDate.getFullYear() : new Date().getFullYear();
    const { orderedMonths, prioritizedMonths } = this.getPrioritizedMonths(currentYear);
    
    this.renderedDateStrings = []; 
    const maxP = store.periodNames ? store.periodNames.length : 6;
    const totalCols = maxP + 2; // 🌟 날짜(1) + 구분(1) + 일정내용(maxP) => 정확한 colspan 값 적용

    const progressHtml = `
        <div id="year-render-progress" style="display:flex; justify-content:center; align-items:center; padding:12px; margin-bottom:15px; background:#eff6ff; color:#2563eb; border-radius:8px; font-weight:bold; font-size:1rem; gap:10px; border:1px solid #bfdbfe;">
            <div style="width:20px; height:20px; border:3px solid #bfdbfe; border-top-color:#2563eb; border-radius:50%; animation:spin 1s linear infinite;"></div>
            나머지 월의 데이터를 백그라운드에서 불러오는 중...
        </div>
        <style>@keyframes spin { 100% { transform:rotate(360deg); } }</style>
    `;

    // 🌟 1. 12개월 <tbody> 껍데기 즉시 생성 (colspan 값 자동 동기화로 표 찌그러짐 원천 차단)
    const tbodyHtmlMap = {};
    for (const m of orderedMonths) {
        tbodyHtmlMap[`${m.year}-${m.month}`] = `<tr><td colspan="${totalCols}" style="height:600px; padding:40px; color:#94a3b8; font-weight:bold; background:#f8fafc; border:1px solid #e2e8f0; text-align:center; vertical-align:middle;">${m.label} 로딩 중...</td></tr>`;
    }

    // 🌟 table-layout: fixed; 적용하여 너비를 고정하고 깜빡임 방지
    this.container.innerHTML = `
      <div id="year-main-content" class="table-container" style="background:#fff; padding:12px; border-radius:8px; overflow:visible;">
        ${progressHtml}
        <table id="year-editor-table" style="width:100%; border-collapse:collapse; text-align:center; table-layout:fixed; word-break:break-all;">
          <tbody style="border-bottom: 2px solid #cbd5e1;">
            <tr style="background:#f1f5f9; position: static !important; transform: none !important;">
              <td style="width:110px; padding:8px; border:1px solid #cbd5e1; font-weight:bold; color:#1e293b; position: static !important; top: auto !important; z-index: auto !important;">날짜</td>
              <td style="width:60px; padding:8px; border:1px solid #cbd5e1; font-weight:bold; color:#1e293b; position: static !important; top: auto !important; z-index: auto !important;">구분</td>
              <td colspan="${maxP}" style="padding:8px; border:1px solid #cbd5e1; font-weight:bold; color:#1e293b; position: static !important; top: auto !important; z-index: auto !important;">📌 내용 (직접 수정)</td>
            </tr>
          </tbody>
          ${orderedMonths.map(m => `<tbody id="editor-month-${m.year}-${m.month}">${tbodyHtmlMap[`${m.year}-${m.month}`]}</tbody>`).join('')}
        </table>
      </div>`;

    const filterSlot = document.getElementById('global-unified-filter-slot');
    if (filterSlot) filterSlot.innerHTML = this.getUnifiedFilterHtml();

    // 🌟 2. 1순위(현재 월)의 데이터만 요청하여 HTML 테이블로 변환
    const targetMonthObj = prioritizedMonths[0];
    const firstMonthData = await this.loadSingleMonthData(targetMonthObj);
    if (this.renderId !== currentRenderId) return;

    this.renderMonthToEditorTbody(targetMonthObj, firstMonthData.eMap, firstMonthData.sMap, maxP);

    // 🌟 3. 현재 월이 화면에 렌더링되자마자 즉시(auto) 스크롤
    requestAnimationFrame(() => {
        const firstRow = document.querySelector(`tr[data-year-date^="${targetMonthObj.year}-${String(targetMonthObj.month).padStart(2, '0')}"]`);
        if (firstRow) {
            const header = document.querySelector('.app-header');
            const hOffset = header ? header.offsetHeight : 0;
            const absoluteY = firstRow.getBoundingClientRect().top + window.scrollY;
            window.scrollTo({top: absoluteY - hOffset - 15, behavior: 'auto'});
            
            setTimeout(() => {
                document.querySelectorAll('textarea.modal-input-text').forEach(ta => {
                    ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px';
                });
            }, 10);
        }
    });

    // 🌟 4. 나머지 월 백그라운드 렌더링 시작
    this.loadRemainingMonthsEditor(prioritizedMonths.slice(1), currentRenderId, maxP);
  }

  renderMonthToEditorTbody(mObj, eMap, sMap, maxP) {
      const y = mObj.year; const m = mObj.month;
      const lastDate = new Date(y, m, 0).getDate();
      const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
      const masterLabels = getEventLabels(); 

      const chunk = [];
      for (let d = 1; d <= lastDate; d++) {
          const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          chunk.push({ year: y, month: m, day: d, dateStr, data: { periods: sMap[dateStr] || {} }, eventData: eMap[dateStr] || {} });
      }

      let rowsHtml = chunk.map(item => {
          const dateObj = new Date(item.year, item.month - 1, item.day);
          const dayOfWeekNum = dateObj.getDay();
          const dayOfWeek = dayNames[dayOfWeekNum];

          if (!this.isWeekendVisible && (dayOfWeekNum === 0 || dayOfWeekNum === 6)) return '';

          this.renderedDateStrings.push(item.dateStr);

          let eventList = item.eventData.eventList || [];
          window[`tempEvents_${item.dateStr}`] = eventList.map(e => {
              let labelIds = e.labelIds || [];
              if (labelIds.length === 0 && (e.labels || e.label)) {
                  (e.labels || [e.label]).forEach(name => {
                      const match = masterLabels.find(l => l.name === name);
                      if (match && match.id && !labelIds.includes(match.id)) labelIds.push(match.id);
                  });
              }
              return { ...e, labelIds, sharedGroupId: e.sharedGroupId || null, groupName: e.groupName || '' };
          });
          
          const periods = item.data.periods?.[this.scheduleGroupId || 'personal'] || {};
          window[`tempSchedules_${item.dateStr}`] = periods;
          
          const compactEditorHtml = `<div id="compact-events-${item.dateStr}" style="display:flex; flex-direction:column; gap:4px;">${this.generateCompactEventEditor(item.dateStr)}</div>`; 

          const isRed = isRedDay(item.dateStr, window[`tempEvents_${item.dateStr}`]);
          const dateColor = isRed ? '#ef4444' : (dayOfWeekNum === 6 ? '#3b82f6' : '#1e40af');
          const dateNumColor = isRed ? '#ef4444' : (dayOfWeekNum === 6 ? '#3b82f6' : '#475569');

          const periodCellsHtml = Array.from({ length: maxP }).map((_, pi) => {
               const pObj = periods[pi + 1] || {};
               let cellText = "";
               if (pObj.subject && pObj.subject.toUpperCase() !== 'X') cellText += `[${pObj.subject}] `;
               if (pObj.memo) cellText += pObj.memo + " ";
               if (pObj.supplies) cellText += `[${pObj.supplies}]`;
               
               return `<td class="editable-cell edit-class-cell" data-p="${pi + 1}" contenteditable="true" style="padding:6px; border:1px solid #cbd5e1; font-size:1rem; color:#047857; background:#ecfdf5; vertical-align:top; white-space:pre-wrap; text-align:left;" oninput="window.yearViewInstance.syncScheduleInputs()">${cellText.trim()}</td>`;
          }).join('');

          return `
            <tr data-year-date="${item.dateStr}">
              <td rowspan="${store.showClass ? 2 : 1}" style="padding:8px 4px; border:1px solid #cbd5e1; background:#f8fafc; vertical-align:middle; width:110px; position: static !important; z-index: auto !important; transform: none !important;">
                <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
                  <span onclick="window.goToDay('${item.dateStr}')" style="font-size:1.2rem; font-weight:900; color:${dateNumColor}; line-height:1.1; cursor:pointer;" title="${item.dateStr} 일 보기로 이동">${item.month}월 ${item.day}일</span>
                  <span style="font-size:0.95rem; font-weight:600; color:${dateColor}; line-height:1;">${dayOfWeek}</span>
                </div>
              </td>
              <td style="padding:4px; border:1px solid #cbd5e1; background:#f0f9ff; color:#0369a1; font-weight:bold; font-size:0.9rem; vertical-align:middle; width:60px; text-align:center; position: static !important; z-index: auto !important; transform: none !important;">
                  일정<br>
                  <button onclick="window.yearViewInstance.addCompactEvent('${item.dateStr}')" style="margin-top:6px; background:#e0f2fe; color:#0369a1; border:1px dashed #7dd3fc; border-radius:4px; padding:2px 8px; cursor:pointer; font-weight:bold; font-size:1.1rem; box-shadow:0 1px 2px rgba(0,0,0,0.05);" title="일정 추가">+</button>
              </td>
              <td colspan="${maxP}" style="text-align:left; padding:6px 10px; background:#f0f9ff; vertical-align:top; position: static !important; z-index: auto !important; transform: none !important;">${compactEditorHtml}</td>
            </tr>
            <tr data-year-sub="${item.dateStr}" style="${store.showClass ? '' : 'display:none;'}">
              <td style="padding:4px; border:1px solid #cbd5e1; background:#ecfdf5; color:#047857; font-weight:bold; font-size:0.9rem; vertical-align:middle; width:60px; text-align:center; position: static !important; z-index: auto !important; transform: none !important;">수업</td>
              ${periodCellsHtml}
            </tr>`;
      }).join('');

      const targetTbody = document.getElementById(`editor-month-${y}-${m}`);
      if (targetTbody) targetTbody.innerHTML = rowsHtml;
  }

  async loadRemainingMonthsEditor(remainingMonths, currentRenderId, maxP) {
      for (const mObj of remainingMonths) {
          if (this.renderId !== currentRenderId) return;
          const data = await this.loadSingleMonthData(mObj);
          if (this.renderId !== currentRenderId) return;
          this.renderMonthToEditorTbody(mObj, data.eMap, data.sMap, maxP);
          await new Promise(r => setTimeout(r, 50)); 
      }
      
      const progressEl = document.getElementById('year-render-progress');
      if (progressEl) progressEl.remove();
      this.isRendering = false;

      setTimeout(() => {
          document.querySelectorAll('textarea.modal-input-text').forEach(ta => {
              ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px';
          });
      }, 500);
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
              setTimeout(() => {
                  container.querySelectorAll('textarea.modal-input-text').forEach(ta => {
                      ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px';
                  });
              }, 10);
          }
      }
  }

  generateCompactEventEditor(dateStr) {
      const list = window[`tempEvents_${dateStr}`] || [];
      const labelObjs = getEventLabels();
      const realTodayStr = formatDate(new Date());
      const uid = window.auth?.currentUser?.uid;
      const inst = 'window.yearViewInstance';
      
      const currentFilter = store.mode === 'editor' ? (this.scheduleGroupId || 'personal') : null;

      return list.map((e, idx) => {
          const isVisible = store.mode === 'editor' 
              ? ((e.sharedGroupId || 'personal') === currentFilter) 
              : this.activeFilters.includes(e.sharedGroupId || 'personal');
              
          const displayStyle = isVisible ? 'display:flex;' : 'display:none;';
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
              const chipClickAttr = isAuthor ? `onclick="window.handleCompactLabelClick('${dateStr}', ${idx}, '${lObj.id}')"` : '';
              const chipCursorStyle = isAuthor ? 'cursor:pointer;' : 'cursor:not-allowed; opacity:0.8;';
              return `<div class="label-chip ${eLabelIds.includes(lObj.id) ? 'active' : ''}" ${chipClickAttr} style="padding:2px 8px; font-size:0.8rem; min-width:auto; ${chipCursorStyle}">${lObj.name}</div>`;
          }).join('') + warningIcon;

          const checkboxHtml = canComplete 
              ? `<input type="checkbox" ${isCompleted ? 'checked' : ''} ${!isAuthor ? 'disabled' : ''} onchange="${inst}.updateCompactEvent('${dateStr}', ${idx}, 'completed', this.checked); document.getElementById('compact-events-${dateStr}').innerHTML = ${inst}.generateCompactEventEditor('${dateStr}');" style="width:18px; height:18px; cursor:pointer; accent-color:#059669;" title="완료 체크">`
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
                      ${deleteBtnHtml}
                  </div>
              </div>
              <div style="display:flex; align-items:flex-start; gap:8px; width:100%;">
                  ${checkboxHtml}
                  <textarea class="modal-input-text" ${!isAuthor ? 'readonly' : ''} placeholder="${isAuthor ? '일정 내용을 입력하세요.' : '권한이 없습니다.'}" style="flex:1; padding:6px 8px; font-size:0.95rem; border:1px solid #cbd5e1; border-radius:4px; outline:none; resize:none; min-height:40px; box-sizing:border-box; ${textStyle}" onfocus="this.style.height='auto'; this.style.height = this.scrollHeight + 'px';" oninput="this.style.height='auto'; this.style.height = this.scrollHeight + 'px'; ${inst}.updateCompactEvent('${dateStr}', ${idx}, 'content', this.value)">${pureContent}</textarea>
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
      if (this.renderedDateStrings) {
          this.renderedDateStrings.forEach(dateStr => this.syncCompactEventInputs(dateStr));
      }
  }

  syncScheduleInputs() {
      document.querySelectorAll(`tr[data-year-sub]`).forEach(row => {
          const dateStr = row.getAttribute('data-year-sub');
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

  updateCompactEvent(dateStr, idx, field, value) {
      store.hasUnsavedChanges = true;
      if (window[`tempEvents_${dateStr}`]?.[idx]) window[`tempEvents_${dateStr}`][idx][field] = value;
  }

  addCompactEvent(dateStr) {
      this.syncCompactEventInputs(dateStr); 
      store.hasUnsavedChanges = true;
      window[`tempEvents_${dateStr}`] = window[`tempEvents_${dateStr}`] || [];

      let newGroupId = null;
      let newGroupName = '';
      if (store.mode === 'editor' && this.scheduleGroupId && this.scheduleGroupId !== 'personal') {
          newGroupId = this.scheduleGroupId;
          const g = this.myGroups.find(x => x.id === newGroupId);
          if (g) newGroupName = g.name;
      }

      window[`tempEvents_${dateStr}`].push({ 
          id: 'ev_' + Date.now() + Math.random().toString(36).substr(2,5),
          authorId: window.auth?.currentUser?.uid,
          labelIds: [], content: '', completed: false, 
          sharedGroupId: newGroupId,
          groupName: newGroupName 
      });
      
      const container = document.getElementById(`compact-events-${dateStr}`);
      container.innerHTML = this.generateCompactEventEditor(dateStr);
      
      setTimeout(() => {
          container.querySelectorAll('textarea.modal-input-text').forEach(ta => {
              ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px';
          });
      }, 10);
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
    if (this.isRendering) {
        alert('화면을 100% 로딩 중입니다. 잠시 후 저장해 주세요.');
        return;
    }

    if (!this.renderedDateStrings || this.renderedDateStrings.length === 0) return;
    this.syncScheduleInputs(); 
    this.syncAllCompactEventInputs();

    const snapshot = this.renderedDateStrings.map(dateStr => {
        const rawList = window[`tempEvents_${dateStr}`] || [];
        const validEvents = rawList
            .filter(e => e.content?.trim() || e.labelIds?.length > 0)
            .map(e => ({
                ...e,
                id: e.id || 'ev_' + Date.now() + Math.random().toString(36).substr(2,5),
                authorId: e.authorId || window.auth?.currentUser?.uid
            }));
        const periodsData = JSON.parse(JSON.stringify(window[`tempSchedules_${dateStr}`] || {}));
        return { dateStr, validEvents, periodsData };
    });

    const masterLabels = getEventLabels();
    let batch = writeBatch(window.db);
    let opCount = 0;
    let batchPromises = [];
    
    snapshot.forEach(item => {
        const eventsByGroup = { 'personal': [] };
        this.myGroups.forEach(g => eventsByGroup[g.id] = []);

        item.validEvents.forEach(e => {
            const gId = e.sharedGroupId || 'personal';
            if (eventsByGroup[gId]) eventsByGroup[gId].push(e);
        });

        const pEvents = eventsByGroup['personal'];
        batch.set(doc(getUserCol('events'), item.dateStr), {
            eventList: pEvents,
            eventText: formatEventListToText(pEvents),
            updatedAt: Date.now()
        }, { merge: true });
        opCount++;
        if (opCount >= 400) { batchPromises.push(batch.commit()); batch = writeBatch(window.db); opCount = 0; }

        this.myGroups.forEach(g => {
            const gEvents = eventsByGroup[g.id];
            batch.set(doc(getGroupCol(g.id, 'events'), item.dateStr), {
                eventList: gEvents,
                eventText: formatEventListToText(gEvents),
                updatedAt: Date.now()
            }, { merge: true });
            opCount++;
            if (opCount >= 400) { batchPromises.push(batch.commit()); batch = writeBatch(window.db); opCount = 0; }
        });

        const isSkipDay = item.validEvents.some(e => e.labelIds?.some(id => masterLabels.find(l => l.id === id)?.isSkip));
        if (isSkipDay) {
            Object.values(item.periodsData).forEach(p => p.subject = '');
        }

        const scheduleCol = this.scheduleGroupId ? getGroupCol(this.scheduleGroupId, 'schedules') : getUserCol('schedules');
        batch.set(doc(scheduleCol, item.dateStr), {
            periods: item.periodsData,
            updatedAt: Date.now()
        }, { merge: true });
        opCount++;
        if (opCount >= 400) { batchPromises.push(batch.commit()); batch = writeBatch(window.db); opCount = 0; }
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
    saveYearDataFromEditor: () => instance.save()
});
