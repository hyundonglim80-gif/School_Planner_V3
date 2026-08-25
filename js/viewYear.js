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
    this.activeEventFilters = null;    // 🌟 뷰어 모드 전용(중복 선택)
    this.activeScheduleFilters = null; // 🌟 뷰어 모드 전용(중복 선택)
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

  async renderViewer() {
    this.renderId = Date.now();
    const currentRenderId = this.renderId;
    this.isRendering = true;

    this.showLoading('클라우드에서 연간 일정을 100% 불러오는 중입니다...'); 

    if (this.container) {
        this.container.style.overflow = 'visible'; // 🌟 스크롤 고정을 위해 visible 처리
    }

    if (!window.db) return;

    let allEvents = [];
    const maxP = store.periodNames ? store.periodNames.length : 6;
    
    try {
      const targetY = this.currentDate ? this.currentDate.getFullYear() : new Date().getFullYear();
      const startStr = `${targetY}-03-01`;
      const febLastDay = new Date(targetY + 1, 2, 0).getDate();
      const endStr = `${targetY + 1}-02-${febLastDay}`;

      const { eMap, sMap } = await this.fetchYearData(startStr, endStr);
      if (this.renderId !== currentRenderId) return;

      if (!this.activeEventFilters) this.activeEventFilters = ['personal', ...this.myGroups.map(g => g.id)];
      if (!this.activeScheduleFilters) this.activeScheduleFilters = ['personal'];

      const allDates = new Set([...Object.keys(eMap), ...Object.keys(sMap)]);

      allDates.forEach(dateStr => {
        let hasContent = false;
        let htmlOutput = '';
        let processedEvents = [];
        let boxesHtml = '';
        let hasClass = false;

        for (let p = 1; p <= maxP; p++) {
          let pTexts = [];
          this.activeScheduleFilters.forEach(filterId => {
              const pData = sMap[dateStr]?.[filterId]?.[p];
              if (!pData) return;
              const subj = pData.subject || '';
              const memo = pData.memo || '';
              const supplies = pData.supplies || '';
              
              if ((subj.trim() !== '' && subj.toUpperCase() !== 'X') || memo.trim() !== '' || supplies.trim() !== '') {
                  let prefix = this.activeScheduleFilters.length > 1 ? (filterId === 'personal' ? '🔒 ' : '👥 ') : '';
                  let text = subj.trim();
                  if (!text && (memo || supplies)) text = '(메모/준비물)';
                  pTexts.push(prefix + text);
              }
          });

          if (pTexts.length > 0) {
            hasClass = true;
            const text = pTexts.join(' / ');
            let fontSize = "0.75rem"; let letterSpacing = "normal";
            if (text.length === 3) { fontSize = "0.65rem"; letterSpacing = "-0.5px"; } 
            else if (text.length === 4) { fontSize = "0.55rem"; letterSpacing = "-1px"; } 
            else if (text.length >= 5) { fontSize = "0.45rem"; letterSpacing = "-1.5px"; }

            boxesHtml += `<div style="display:flex; align-items:center; justify-content:center; flex:1; min-width:0; height:22px; box-sizing:border-box; border:1px solid #6ee7b7; border-radius:4px; background:#ecfdf5; color:#047857; font-size:${fontSize}; font-weight:700; letter-spacing:${letterSpacing}; white-space:nowrap; overflow:hidden;" title="${text}">${text}</div>`;
          } else {
            boxesHtml += `<div style="display:flex; align-items:center; justify-content:center; flex:1; min-width:0; height:22px; box-sizing:border-box; border:1px solid #e2e8f0; border-radius:4px; background:#f8fafc; color:#94a3b8; font-size:0.75rem; font-weight:700;">&nbsp;</div>`;
          }
        }

        let scheduleHtml = (hasClass && store.showClass) ? `<div style="display:flex; flex-wrap:nowrap; gap:2px; margin-top:4px; margin-bottom:4px; width:100%;">${boxesHtml}</div>` : '';
        if (scheduleHtml) {
            htmlOutput += scheduleHtml;
            hasContent = true;
        }

        if (eMap[dateStr] && eMap[dateStr].eventList && eMap[dateStr].eventList.length > 0) {
          const filteredEvents = eMap[dateStr].eventList.filter(e => this.activeEventFilters.includes(e.sharedGroupId || 'personal'));
          
          if (filteredEvents.length > 0) {
              processedEvents = filteredEvents.map(e => ({ 
                  ...e, 
                  labelIds: e.labelIds || [],
                  content: (e.sharedGroupId ? `<span style="display:inline-block; padding:2px 6px; font-size:0.75rem; border-radius:4px; background:#e0f2fe; color:#0369a1; border:1px solid #bae6fd; margin-right:4px; vertical-align:middle; font-weight:bold;">👥 ${e.groupName}</span> ` : '') + e.content
              }));
              
              const badgedHtml = generateEventBadgesHTML(processedEvents, dateStr, 'compact');
              if (badgedHtml) {
                  htmlOutput += badgedHtml;
                  hasContent = true;
              }
          }
        }
        
        if (hasContent) {
          allEvents.push({ dateStr: dateStr, htmlOutput: htmlOutput, events: processedEvents }); 
        }
      });

      allEvents.sort((a, b) => a.dateStr.localeCompare(b.dateStr));

      const { orderedMonths, prioritizedMonths } = this.getPrioritizedMonths(targetY);
      const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
      const realTodayStr = formatDate(new Date());

      const allMonthsHtml = orderedMonths.map(mObj => {
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

          return `
            <div id="viewer-card-${mObj.year}-${mObj.month}" class="mini-month ${cardClass}" style="display:flex; flex-direction:column; gap:8px;">
              <h3 style="color:#1e40af; border-bottom:2px solid #bfdbfe; padding-bottom:4px; text-align:center;">${mObj.label}</h3>
              <div style="line-height:1.4;">${eventListHtml}</div>
            </div>`;
      }).join('');

      // 🌟 스크롤 시 화면 상단에 찰싹 붙는(sticky) 필터 컨테이너
      const filtersHtml = `
          <div id="sticky-filter-bar" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; flex-wrap:wrap; gap:10px; position:sticky; top:-1px; z-index:90; background:#fff; padding:8px 0; border-bottom:1px solid #e2e8f0;">
             ${this.getEventFilterHtml('yearViewInstance')}
             <div style="${store.showClass ? '' : 'display:none;'}">${this.getScheduleFilterHtml('yearViewInstance')}</div>
          </div>
      `;

      this.container.innerHTML = `
          ${filtersHtml}
          <div id="year-main-content">
              <div class="year-grid" id="year-grid-container">
                 ${allMonthsHtml}
              </div>
          </div>
      `;

      // 기존 분리형 슬롯 사용 중지
      const filterSlot = document.getElementById('global-unified-filter-slot');
      if (filterSlot) filterSlot.innerHTML = '';

      requestAnimationFrame(() => {
          const targetMonthObj = prioritizedMonths[0];
          const focusEl = document.getElementById(`viewer-card-${targetMonthObj.year}-${targetMonthObj.month}`);
          if (focusEl) {
              const header = document.querySelector('.app-header');
              const filterBar = document.getElementById('sticky-filter-bar');
              const fOffset = filterBar ? filterBar.offsetHeight : 50; // 스티키 영역 높이 보정
              const hOffset = (header ? header.offsetHeight : 0) + fOffset;
              const absoluteY = focusEl.getBoundingClientRect().top + window.scrollY;
              window.scrollTo({top: absoluteY - hOffset - 15, behavior: 'auto'});
          }
      });

    } catch (error) {}
    finally {
        this.isRendering = false;
    }
  }

  async renderEditor() {
    this.renderId = Date.now();
    const currentRenderId = this.renderId;
    this.isRendering = true;

    this.showLoading('연간 데이터를 100% 가져오는 중입니다...'); 

    if (this.container) {
        this.container.style.overflow = 'visible'; // 🌟 스크롤 고정을 위해 visible 처리
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

    if (!this.activeEventFilters) this.activeEventFilters = ['personal', ...this.myGroups.map(g => g.id)];
    if (!this.activeScheduleFilters) this.activeScheduleFilters = ['personal'];

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
    const maxP = store.periodNames ? store.periodNames.length : 6;

    const allEditorMonthsHtml = orderedMonths.map(mObj => {
        const chunk = monthChunksMap[`${mObj.year}-${mObj.month}`];
        const rowsHtml = chunk.map(item => {
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
              <td rowspan="${store.showClass ? 2 : 1}" style="padding:8px 4px; border:1px solid #cbd5e1; background:#f8fafc; vertical-align:middle; width:110px;">
                <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
                  <span onclick="window.goToDay('${item.dateStr}')" style="font-size:1.2rem; font-weight:900; color:${dateNumColor}; line-height:1.1; cursor:pointer;" title="${item.dateStr} 일 보기로 이동">${item.month}월 ${item.day}일</span>
                  <span style="font-size:0.95rem; font-weight:600; color:${dateColor}; line-height:1;">${dayOfWeek}</span>
                </div>
              </td>
              <td style="padding:4px; border:1px solid #cbd5e1; background:#f0f9ff; color:#0369a1; font-weight:bold; font-size:0.9rem; vertical-align:middle; width:60px; text-align:center;">
                  일정<br>
                  <button onclick="window.yearViewInstance.addCompactEvent('${item.dateStr}')" style="margin-top:6px; background:#e0f2fe; color:#0369a1; border:1px dashed #7dd3fc; border-radius:4px; padding:2px 8px; cursor:pointer; font-weight:bold; font-size:1.1rem; box-shadow:0 1px 2px rgba(0,0,0,0.05);" title="일정 추가">+</button>
              </td>
              <td colspan="${maxP}" style="text-align:left; padding:6px 10px; background:#f0f9ff; vertical-align:top;">${compactEditorHtml}</td>
            </tr>
            <tr data-year-sub="${item.dateStr}" style="${store.showClass ? '' : 'display:none;'}">
              <td style="padding:4px; border:1px solid #cbd5e1; background:#ecfdf5; color:#047857; font-weight:bold; font-size:0.9rem; vertical-align:middle; width:60px; text-align:center;">수업</td>
              ${periodCellsHtml}
            </tr>`;
        }).join('');

        return `<tbody id="editor-month-${mObj.year}-${mObj.month}">${rowsHtml}</tbody>`;
    }).join('');

    // 🌟 뷰어 페이지와 완벽히 통일된 디자인의 작업공간 버튼 생성 (글자 수정됨)
    const wsSelectHtml = `
        <div style="display:inline-flex; align-items:center; gap:6px; background:#f0fdf4; padding:4px 8px; border-radius:8px; border:1px solid #bbf7d0; flex-wrap:wrap;">
            <span style="font-size:0.85rem; font-weight:bold; color:#0f766e; margin-right:2px;">작업 공간:</span>
            <div onclick="window.yearViewInstance.changeScheduleWorkspace(null)" style="padding:4px 12px; font-size:0.8rem; border-radius:6px; cursor:pointer; font-weight:bold; transition:0.2s; ${!this.scheduleGroupId ? 'background:#10b981; color:#fff; box-shadow:0 1px 2px rgba(0,0,0,0.1);' : 'background:#e2e8f0; color:#94a3b8;'}">🔒 개인</div>
            ${this.myGroups.map(g => `<div onclick="window.yearViewInstance.changeScheduleWorkspace('${g.id}')" style="padding:4px 12px; font-size:0.8rem; border-radius:6px; cursor:pointer; font-weight:bold; transition:0.2s; ${this.scheduleGroupId === g.id ? 'background:#10b981; color:#fff; box-shadow:0 1px 2px rgba(0,0,0,0.1);' : 'background:#e2e8f0; color:#94a3b8;'}">👥 ${g.name}</div>`).join('')}
        </div>
    `;

    const editorFiltersHtml = `
        <div id="sticky-filter-bar" style="display:flex; justify-content:flex-start; align-items:center; margin-bottom:8px; flex-wrap:wrap; gap:10px; position:sticky; top:-1px; z-index:90; background:#fff; padding:8px 0; border-bottom:1px solid #e2e8f0;">
           ${wsSelectHtml}
        </div>
    `;

    this.container.innerHTML = `
      ${editorFiltersHtml}
      <div id="year-main-content" class="table-container" style="background:#fff; padding:12px; border-radius:8px; overflow:visible;">
        <table id="year-editor-table" style="width:100%; border-collapse:collapse; text-align:center;">
          <tbody style="border-bottom: 2px solid #cbd5e1;">
            <tr style="background:#f1f5f9;">
              <td style="width:110px; padding:8px; border:1px solid #cbd5e1; font-weight:bold; color:#1e293b;">날짜</td>
              <td style="width:60px; padding:8px; border:1px solid #cbd5e1; font-weight:bold; color:#1e293b;">구분</td>
              <td colspan="${maxP}" style="padding:8px; border:1px solid #cbd5e1; font-weight:bold; color:#1e293b;">📌 내용 (직접 수정)</td>
            </tr>
          </tbody>
          ${allEditorMonthsHtml}
        </table>
      </div>`;

    // 기존 분리형 슬롯 사용 중지
    const filterSlot = document.getElementById('global-unified-filter-slot');
    if (filterSlot) filterSlot.innerHTML = '';

    requestAnimationFrame(() => {
        const targetMonthObj = prioritizedMonths[0];
        const firstRow = document.querySelector(`tr[data-year-date^="${targetMonthObj.year}-${String(targetMonthObj.month).padStart(2, '0')}"]`);
        if (firstRow) {
            const header = document.querySelector('.app-header');
            const filterBar = document.getElementById('sticky-filter-bar');
            const fOffset = filterBar ? filterBar.offsetHeight : 50; // 스티키 영역 높이 보정
            const hOffset = (header ? header.offsetHeight : 0) + fOffset;
            const absoluteY = firstRow.getBoundingClientRect().top + window.scrollY;
            window.scrollTo({top: absoluteY - hOffset - 15, behavior: 'auto'});
            
            setTimeout(() => {
                document.querySelectorAll('textarea.modal-input-text').forEach(ta => {
                    ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px';
                });
            }, 100);
        }
    });

    this.isRendering = false;
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
              : this.activeEventFilters.includes(e.sharedGroupId || 'personal');
              
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
        alert('화면을 로딩 중입니다. 렌더링이 완료된 후 저장해 주세요.');
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
