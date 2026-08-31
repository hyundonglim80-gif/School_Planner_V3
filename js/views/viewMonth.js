// js/views/viewMonth.js
import { BaseView } from '../components/BaseView.js';
import { store } from '../core/store.js';
import { formatDate, parseLocalDate, getEventLabels, getJournalLabels, getLabelStyle, isRedDay, getHolidayName } from '../core/utils.js';
import { dbAPI, getUserCol, getGroupCol } from '../api/database.js'; 
import { auth, db } from '../api/firebaseInit.js';
import { generateEventBadgesHTML, formatEventListToText, parseRawEventTextToEventList } from '../core/eventManager.js';
import { doc, getDoc, setDoc, query, where, documentId, getDocs, writeBatch } from "firebase/firestore";
import { CompactEventHelper } from '../ui/templateHelpers.js';
import { fetchCalendarData, saveCalendarData } from '../core/calendarDataManager.js';

export class MonthView extends BaseView {
  constructor(container) {
    super(container); 
    this.myGroups = [];
    this.scheduleGroupId = null; 
    this.isRendering = false; 
    this.renderId = 0; 
    
    // 무한 스크롤 관련 상태
    this.isInfiniteMode = localStorage.getItem('workCalendar_infiniteScroll') === 'true';
    window.isInfiniteScrollActive = this.isInfiniteMode; 
    this.loadedMonths = []; // [{y, m}]
    this.observer = null;
    this.chunkObserver = null;
    this.isLoadingMore = false;
    this.renderedDateStrings = []; 

    // '오늘'로 부드럽게 스크롤 시 무한 스크롤 센서 간섭 방지
    if (typeof window.scrollToTodayIfExist === 'function' && !window.originalScrollToToday) {
        window.originalScrollToToday = window.scrollToTodayIfExist;
        window.scrollToTodayIfExist = () => {
            window.isAutoScrollingMonth = true;
            window.originalScrollToToday();
            setTimeout(() => { window.isAutoScrollingMonth = false; }, 1500);
        };
    }
  }

  async changeScheduleWorkspace(newGroupId) {
      if (store.hasUnsavedChanges) this.save(); 
      this.scheduleGroupId = newGroupId || null;
      if (store.mode === 'editor') this.renderEditor();
      else this.renderViewer();
  }

  injectInfiniteToggleBtn() {
      let btn = document.getElementById('btn-toggle-infinite');
      if (!btn) {
          const classBtn = document.getElementById('btn-toggle-class');
          if (classBtn) {
              btn = document.createElement('button');
              btn.id = 'btn-toggle-infinite';
              btn.className = 'nav-btn';
              btn.title = '월간/주간 페이지를 스크롤로 연속해서 봅니다.';
              btn.style.marginLeft = '8px';
              btn.style.fontWeight = 'bold';
              btn.style.transition = '0.2s';
              classBtn.parentNode.insertBefore(btn, classBtn.nextSibling);
          }
      }
      if (btn) {
          btn.innerHTML = `📜 스크롤 ${this.isInfiniteMode ? '끄기' : '켜기'}`;
          btn.style.backgroundColor = this.isInfiniteMode ? '#fef2f2' : '#f8fafc';
          btn.style.color = this.isInfiniteMode ? '#ef4444' : '#475569';
          btn.style.borderColor = this.isInfiniteMode ? '#fca5a5' : '#cbd5e1';
          
          btn.onclick = () => {
              this.isInfiniteMode = !this.isInfiniteMode;
              localStorage.setItem('workCalendar_infiniteScroll', this.isInfiniteMode);
              window.isInfiniteScrollActive = this.isInfiniteMode;
              this.injectInfiniteToggleBtn();
              store.mode === 'editor' ? this.renderEditor() : this.renderViewer();
          };
      }
  }

  setupChunkObserver() {
      if (this.chunkObserver) this.chunkObserver.disconnect();
      this.chunkObserver = new IntersectionObserver((entries) => {
          if (window.isAutoScrollingMonth) return;
          
          entries.forEach(entry => {
              if (entry.isIntersecting) {
                  const y = parseInt(entry.target.getAttribute('data-y'));
                  const m = parseInt(entry.target.getAttribute('data-m'));
                  if (!isNaN(y) && !isNaN(m)) {
                      if (store.currentDate.getFullYear() !== y || store.currentDate.getMonth() !== m) {
                          store.currentDate = new Date(y, m, 1);
                          if (window.updateTitle) window.updateTitle();
                      }
                  }
              }
          });
      }, { rootMargin: '-40% 0px -40% 0px' }); 
      
      document.querySelectorAll('.month-chunk').forEach(chunk => {
          this.chunkObserver.observe(chunk);
      });
  }

  setupInfiniteObserver(mode) {
      if (this.observer) this.observer.disconnect();
      const currentRenderId = this.renderId; 
      
      this.observer = new IntersectionObserver(async (entries) => {
          if (window.isAutoScrollingMonth || window.activeModalCount > 0) return; 

          for (let entry of entries) {
              if (entry.isIntersecting && !this.isLoadingMore) {
                  this.isLoadingMore = true;
                  try {
                      if (entry.target.id === 'month-bottom-sentinel') {
                          const last = this.loadedMonths[this.loadedMonths.length - 1];
                          let ny = last.y, nm = last.m + 1;
                          if (nm > 11) { ny++; nm = 0; }
                          
                          const html = mode === 'editor' ? await this.buildEditorChunk(ny, nm) : await this.buildViewerChunk(ny, nm);
                          if (this.renderId !== currentRenderId) return;
                          
                          this.insertChunkToDOM(html, mode, 'bottom', ny, nm);
                      } 
                      else if (entry.target.id === 'month-top-sentinel') {
                          const first = this.loadedMonths[0];
                          let py = first.y, pm = first.m - 1;
                          if (pm < 0) { py--; pm = 11; }
                          
                          const html = mode === 'editor' ? await this.buildEditorChunk(py, pm) : await this.buildViewerChunk(py, pm);
                          if (this.renderId !== currentRenderId) return;
                          
                          const oldScrollHeight = document.documentElement.scrollHeight;
                          const oldScrollTop = window.scrollY || document.documentElement.scrollTop;
                          
                          this.insertChunkToDOM(html, mode, 'top', py, pm);
                          
                          const newScrollHeight = document.documentElement.scrollHeight;
                          const diff = newScrollHeight - oldScrollHeight;
                          window.scrollTo({ top: oldScrollTop + diff, behavior: 'instant' });
                      }
                  } finally {
                      setTimeout(() => { this.isLoadingMore = false; }, 100);
                  }
              }
          }
      }, { rootMargin: '600px' }); 

      const topSentinel = document.getElementById('month-top-sentinel');
      const bottomSentinel = document.getElementById('month-bottom-sentinel');
      if (topSentinel) this.observer.observe(topSentinel);
      if (bottomSentinel) this.observer.observe(bottomSentinel);
  }

  insertChunkToDOM(html, mode, position, y, m) {
      const container = document.getElementById(mode === 'editor' ? 'month-editor-table' : 'infinite-viewer-container');
      if (!container) return;
      
      if (mode === 'editor') {
          if (position === 'bottom') {
              container.insertAdjacentHTML('beforeend', html);
              this.loadedMonths.push({y, m});
          } else {
              const thead = container.querySelector('thead');
              if (thead) thead.insertAdjacentHTML('afterend', html);
              else container.insertAdjacentHTML('afterbegin', html);
              this.loadedMonths.unshift({y, m});
          }
          setTimeout(() => { this.syncAllCompactEventInputs(); }, 100);
      } else {
          if (position === 'bottom') {
              container.insertAdjacentHTML('beforeend', html);
              this.loadedMonths.push({y, m});
          } else {
              const colgroup = container.querySelector('colgroup');
              if (colgroup) colgroup.insertAdjacentHTML('afterend', html);
              else container.insertAdjacentHTML('afterbegin', html);
              this.loadedMonths.unshift({y, m});
          }
      }
      this.setupChunkObserver(); 
  }

  async fetchMonthData(y, m) {
      const firstDayOfMonth = new Date(y, m, 1);
      const lastDayOfMonth = new Date(y, m + 1, 0);
      
      const firstDayOfWeek = firstDayOfMonth.getDay(); 
      const lastDayOfWeek = lastDayOfMonth.getDay();
      
      let paddingStart = this.isWeekendVisible ? firstDayOfWeek : (firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1);
      let paddingEnd = this.isWeekendVisible ? (6 - lastDayOfWeek) : (lastDayOfWeek === 0 ? 0 : 5 - lastDayOfWeek);
      if (paddingEnd < 0) paddingEnd = 0;

      const calendarStartDate = new Date(firstDayOfMonth);
      calendarStartDate.setDate(calendarStartDate.getDate() - paddingStart);
      
      const calendarEndDate = new Date(lastDayOfMonth);
      calendarEndDate.setDate(calendarEndDate.getDate() + paddingEnd);

      const startStr = formatDate(calendarStartDate);
      const endStr = formatDate(calendarEndDate);

      try { this.myGroups = await dbAPI.loadMyGroups(); } catch(e) { this.myGroups = []; } 
      
      let eMap = {}, sMap = {}, jMap = {}, vMap = {};
      try {
          const res = await fetchCalendarData(startStr, endStr, this.myGroups);
          eMap = res.eMap; sMap = res.sMap; jMap = res.jMap; vMap = res.vMap;
      } catch (e) {
          console.warn("데이터 로드 실패:", e);
      }
      return { eMap, sMap, jMap, vMap, calendarStartDate, calendarEndDate };
  }

  async buildViewerChunk(y, m) {
      const { eMap, sMap, jMap, vMap, calendarStartDate, calendarEndDate } = await this.fetchMonthData(y, m);
      
      const filters = window.activeUnifiedFilters || ['personal'];
      const filterCount = filters.length;
      const realTodayStr = formatDate(new Date());
      const maxP = store.periodNames ? store.periodNames.length : 6;

      const masterEventLabels = getEventLabels();
      const masterJournalLabels = getJournalLabels();

      const daysList = this.isWeekendVisible ? ['일','월','화','수','목','금','토'] : ['월','화','수','목','금'];
      const daysHeaderHtml = daysList.map(d => {
          let color = d === '일' ? 'color:#ef4444;' : (d === '토' ? 'color:#3b82f6;' : '');
          return `<div class="cal-header" style="${color}">${d}</div>`;
      }).join('');
      
      let renderDays = [];
      let currIterDate = new Date(calendarStartDate);
      while (currIterDate <= calendarEndDate) {
          const dayOfWeekNum = currIterDate.getDay();
          if (this.isWeekendVisible || (dayOfWeekNum !== 0 && dayOfWeekNum !== 6)) renderDays.push(new Date(currIterDate));
          currIterDate.setDate(currIterDate.getDate() + 1);
      }

      const daysHtml = renderDays.map(dateObj => {
          const dateStr = formatDate(dateObj);
          const d = dateObj.getDate();
          const dayOfWeekNum = dateObj.getDay();

          const finalEvents = eMap[dateStr]?.eventList || [];
          const filteredEvents = finalEvents.filter(e => filters.includes(e.sharedGroupId || 'personal'));
          
          let contentHtml = '';
          
          filters.forEach((fId) => {
              const isPersonal = fId === 'personal';
              const gIcon = isPersonal ? '🔒' : '👥';
              const gName = isPersonal ? '개인' : (this.myGroups.find(g => g.id === fId)?.name || '그룹');
              const iconColor = isPersonal ? '#2563eb' : '#059669';
              const badgeBg = isPersonal ? '#eff6ff' : '#ecfdf5';

              const fEvents = filteredEvents.filter(e => (e.sharedGroupId || 'personal') === fId);
              const processedEvents = fEvents.map(e => ({ ...e, labelIds: e.labelIds || [] }));
              
              processedEvents.sort((a, b) => {
                  let aRank = 9999, bRank = 9999;
                  (a.labelIds || []).forEach(id => {
                      const r = masterEventLabels.findIndex(l => l.id === id);
                      if (r !== -1 && r < aRank) aRank = r;
                  });
                  (b.labelIds || []).forEach(id => {
                      const r = masterEventLabels.findIndex(l => l.id === id);
                      if (r !== -1 && r < bRank) bRank = r;
                  });
                  if (aRank !== bRank) return aRank - bRank;
                  return (a.id || '').localeCompare(b.id || '');
              });
              
              let eventHtml = processedEvents.length > 0 ? `<div style="margin-top:2px;">${generateEventBadgesHTML(processedEvents, dateStr, 'compact')}</div>` : '';

              const jList = jMap[dateStr]?.[fId] || [];
              const validJournals = jList.filter(j => (j.content && j.content.trim() !== '') || (j.attachments && j.attachments.length > 0));
              
              validJournals.sort((a, b) => {
                  let aRank = 9999, bRank = 9999;
                  (a.labelIds || []).forEach(id => {
                      const r = masterJournalLabels.findIndex(l => l.id === id);
                      if (r !== -1 && r < aRank) aRank = r;
                  });
                  (b.labelIds || []).forEach(id => {
                      const r = masterJournalLabels.findIndex(l => l.id === id);
                      if (r !== -1 && r < bRank) bRank = r;
                  });
                  if (aRank !== bRank) return aRank - bRank;
                  return (a.id || '').localeCompare(b.id || '');
              });
              
              const vList = vMap[dateStr]?.[fId] || [];

              let attachmentCount = 0;
              validJournals.forEach(j => { if (j.attachments) attachmentCount += j.attachments.length; });

              let metaBadges = '';
              if (validJournals.length > 0) metaBadges += `<span style="display:inline-flex; align-items:center; background:#fdf2f8; color:#be185d; padding:1px 4px; border-radius:4px; font-size:0.7rem; font-weight:bold; margin-right:2px; line-height:1;" title="기록">📔${validJournals.length}</span>`;
              if (vList.length > 0) metaBadges += `<span style="display:inline-flex; align-items:center; background:#eff6ff; color:#1e40af; padding:1px 4px; border-radius:4px; font-size:0.7rem; font-weight:bold; margin-right:2px; line-height:1;" title="조사표">📊${vList.length}</span>`;
              if (attachmentCount > 0) metaBadges += `<span style="display:inline-flex; align-items:center; background:#f8fafc; color:#475569; padding:0 3px; border-radius:4px; font-size:0.7rem; font-weight:bold; margin-right:2px; line-height:1.2; border:1px solid #cbd5e1;" title="첨부파일">📎${attachmentCount}</span>`;

              if (metaBadges) {
                  eventHtml += `<div style="margin-top:4px; display:flex; flex-wrap:wrap;">${metaBadges}</div>`;
              }

              let scheduleHtml = '';
              if (store.showClass) {
                  let hasClass = false;
                  let boxesHtml = Array.from({ length: maxP }).map((_, pi) => {
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
                  const topBorder = contentHtml !== '' ? 'border-top: 1px dashed #cbd5e1; padding-top: 6px; margin-top: 4px;' : 'margin-top: 4px;';
                  const iconBadge = filterCount > 1 ? `<div style="display:inline-flex; align-items:center; justify-content:center; width:20px; height:20px; font-size:0.85rem; border-radius:4px; background:${badgeBg}; color:${iconColor}; border:1px solid ${iconColor}; margin-bottom:4px; cursor:help;" title="${gName}">${gIcon}</div>` : '';
                  contentHtml += `<div style="${topBorder} display:flex; flex-direction:column; align-items:stretch; width:100%;">${iconBadge}${scheduleHtml}${eventHtml}</div>`;
              }
          });

          const isRed = isRedDay(dateStr, filteredEvents);
          const dateColor = isRed ? '#ef4444' : (dayOfWeekNum === 6 ? '#3b82f6' : '#334155');
          const holidayName = getHolidayName(dateStr);
          const holidayHtml = holidayName ? `<div style="font-size:0.65rem; color:#ef4444; margin-top:1px; line-height:1;">${holidayName}</div>` : '';
          const todayClass = (dateStr === realTodayStr) ? 'month-today-cell' : '';

          return `
          <div class="cal-day ${todayClass}" data-date="${dateStr}">
              <div style="font-weight:700; color:${dateColor}; font-size:1.1rem; display:inline-block; cursor:pointer;" onclick="window.goToDay('${dateStr}')" title="${dateStr} 일 보기로 이동">${d}${holidayHtml}</div>
              ${contentHtml}
          </div>`;
      }).join('');

      let headerBanner = this.isInfiniteMode ? `<div style="padding:10px; background:#eff6ff; color:#1e40af; font-size:1.2rem; font-weight:900; border-radius:8px 8px 0 0; text-align:center; border:1px solid #bfdbfe; border-bottom:none;">${y}년 ${m + 1}월</div>` : '';
      return `<div class="month-chunk" data-y="${y}" data-m="${m}" style="margin-bottom:30px;">
                ${headerBanner}
                <div class="calendar-grid" style="grid-template-columns: repeat(${this.isWeekendVisible ? 7 : 5}, 1fr); margin-top:0;">${daysHeaderHtml}${daysHtml}</div>
              </div>`;
  }

  async buildEditorChunk(y, m) {
      const startStr = `${y}-${String(m+1).padStart(2, '0')}-01`;
      const lastDate = new Date(y, m + 1, 0).getDate();
      const endStr = `${y}-${String(m+1).padStart(2, '0')}-${String(lastDate).padStart(2, '0')}`;
      
      const { eMap, sMap, jMap, vMap } = await this.fetchMonthData(y, m);

      const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
      const realTodayStr = formatDate(new Date());
      const filters = window.activeUnifiedFilters || ['personal'];
      const filterCount = filters.length;
      const maxP = store.periodNames ? store.periodNames.length : 6;
      const totalRows = filterCount + (store.showClass ? 1 + filterCount : 0);

      const rowsHtml = Array.from({ length: lastDate }).map((_, i) => {
          const d = i + 1;
          const dateStr = `${y}-${String(m+1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          const dayOfWeekNum = new Date(y, m, d).getDay();
          const dayOfWeek = dayNames[dayOfWeekNum];

          if (!this.isWeekendVisible && (dayOfWeekNum === 0 || dayOfWeekNum === 6)) return '';

          if (!this.renderedDateStrings.includes(dateStr)) this.renderedDateStrings.push(dateStr);
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
                          const match = getEventLabels().find(l => l.name === name);
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
              const badgeColor = isPersonal ? '#2563eb' : '#059669';
              const badgeBg = isPersonal ? '#eff6ff' : '#ecfdf5';
              const badgeHtml = filterCount > 1 ? `<div style="font-size:1.1rem; color:${badgeColor}; background:${badgeBg}; padding:2px 6px; border-radius:6px; display:inline-block; margin-top:4px; cursor:help;" title="${isPersonal ? '개인' : (this.myGroups.find(g => g.id === fId)?.name || '그룹')}">${gIcon}</div>` : '';

              let eventContent = `<div id="compact-events-${dateStr}-${fId}" style="display:flex; flex-direction:column; gap:4px;">${CompactEventHelper.generateCompactEventEditor(dateStr, fId)}</div>`;
              
              const jList = jMap[dateStr]?.[fId] || [];
              const validJournals = jList.filter(j => (j.content && j.content.trim() !== '') || (j.attachments && j.attachments.length > 0));
              const vList = vMap[dateStr]?.[fId] || [];

              let attachmentCount = 0;
              validJournals.forEach(j => { if (j.attachments) attachmentCount += j.attachments.length; });

              let metaBadges = '';
              if (validJournals.length > 0) metaBadges += `<span style="display:inline-flex; align-items:center; background:#fdf2f8; color:#be185d; padding:1px 4px; border-radius:4px; font-size:0.65rem; font-weight:bold; margin-right:2px; line-height:1;" title="기록">📔${validJournals.length}</span>`;
              if (vList.length > 0) metaBadges += `<span style="display:inline-flex; align-items:center; background:#eff6ff; color:#1e40af; padding:1px 4px; border-radius:4px; font-size:0.65rem; font-weight:bold; margin-right:2px; line-height:1;" title="조사표">📊${vList.length}</span>`;
              if (attachmentCount > 0) metaBadges += `<span style="display:inline-flex; align-items:center; background:#f8fafc; color:#475569; padding:0 3px; border-radius:4px; font-size:0.65rem; font-weight:bold; margin-right:2px; line-height:1.2; border:1px solid #cbd5e1;" title="첨부파일">📎${attachmentCount}</span>`;

              if (metaBadges) {
                  eventContent += `<div style="margin-top:6px; display:flex; flex-wrap:wrap;">${metaBadges}</div>`;
              }

              const addBtnHtml = `<button onclick="window.CompactEventHelper.addCompactEvent('${dateStr}', '${fId}')" style="margin-top:6px; background:#e0f2fe; color:#0369a1; border:1px dashed #7dd3fc; border-radius:4px; padding:2px 8px; cursor:pointer; font-weight:bold; font-size:1.1rem; box-shadow:0 1px 2px rgba(0,0,0,0.05);" title="일정 추가">+</button>`;

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
                    <td style="padding:4px; border:1px solid #cbd5e1; background:#f0f9ff; color:#0369a1; font-weight:bold; font-size:0.9rem; vertical-align:middle; width:60px; text-align:center;">일정<br>${badgeHtml}<br>${addBtnHtml}</td>
                    <td colspan="${maxP}" style="text-align:left; padding:6px 10px; background:#f0f9ff; vertical-align:top; border:1px solid #cbd5e1;">${eventContent}</td>
                  </tr>`;
              } else {
                  rowsHtmlForDate += `
                  <tr class="month-row-${dateStr}">
                    <td style="padding:4px; border:1px solid #cbd5e1; background:#f0f9ff; color:#0369a1; font-weight:bold; font-size:0.9rem; vertical-align:middle; width:60px; text-align:center;">일정<br>${badgeHtml}<br>${addBtnHtml}</td>
                    <td colspan="${maxP}" style="text-align:left; padding:6px 10px; background:#f0f9ff; vertical-align:top; border:1px solid #cbd5e1;">${eventContent}</td>
                  </tr>`;
              }
          });

          if (store.showClass) {
              const pNamesHtml = (store.periodNames || ["1","2","3","4","5","6"]).map(name => `<td style="font-weight: bold; background: #f8fafc; color: #334155; width: ${100 / maxP}%; text-align: center; border: 1px solid #cbd5e1;">${name}</td>`).join('');
              rowsHtmlForDate += `<tr class="month-row-${dateStr}"><td style="font-weight: bold; background: #f1f5f9; color: #475569; vertical-align: middle; text-align: center; border: 1px solid #cbd5e1;">교시</td>${pNamesHtml}</tr>`;

              filters.forEach((fId) => {
                  const isPersonal = fId === 'personal';
                  const gIcon = isPersonal ? '🔒' : '👥';
                  const badgeColor = isPersonal ? '#2563eb' : '#059669';
                  const badgeBg = isPersonal ? '#eff6ff' : '#ecfdf5';
                  const badgeHtml = filterCount > 1 ? `<div style="font-size:1.1rem; color:${badgeColor}; background:${badgeBg}; padding:2px 6px; border-radius:6px; display:inline-block; margin-top:4px; cursor:help;" title="${isPersonal ? '개인' : (this.myGroups.find(g => g.id === fId)?.name || '그룹')}">${gIcon}</div>` : '';

                  const periods = window[`tempSchedules_${dateStr}`][fId];
                  const periodCellsHtml = Array.from({ length: maxP }).map((_, i) => {
                      const p = i + 1; const pObj = periods[p] || {}; let cellText = "";
                      if (pObj.subject && pObj.subject.toUpperCase() !== 'X') cellText += `[${pObj.subject}] `;
                      if (pObj.memo) cellText += pObj.memo + " ";
                      if (pObj.supplies) cellText += `[${pObj.supplies}]`;
                      // 🌟 [오타 완벽 교체됨] 
                      return `<td class="editable-cell edit-class-cell" data-p="${p}" data-fid="${fId}" contenteditable="true" style="vertical-align: top; text-align: left; padding: 6px 8px; white-space: pre-wrap; border:1px solid #cbd5e1; font-size:1rem; color:#047857; background:#ecfdf5;" oninput="window.monthViewInstance.syncScheduleInputs()">${cellText.trim()}</td>`;
                  }).join('');

                  rowsHtmlForDate += `<tr data-month-schedule-date="${dateStr}" data-fid="${fId}" class="month-row-${dateStr}"><td style="padding:4px; border:1px solid #cbd5e1; background:#ecfdf5; color:#047857; font-weight:bold; font-size:0.9rem; vertical-align:middle; text-align:center;">수업<br>${badgeHtml}</td>${periodCellsHtml}</tr>`;
              });
          }
          return rowsHtmlForDate;
      }).join('');

      let headerBanner = this.isInfiniteMode ? `<tr class="month-separator"><td colspan="${maxP + 2}" style="padding:15px; background:#eff6ff; color:#1e40af; font-size:1.2rem; font-weight:900; text-align:center; border:1px solid #bfdbfe;">${y}년 ${m + 1}월</td></tr>` : '';
      return `<tbody class="month-chunk" data-y="${y}" data-m="${m}">${headerBanner}${rowsHtml}</tbody>`;
  }

  async renderViewer() {
    this.isRendering = true;
    this.renderId = Date.now();
    try {
        this.showLoading('클라우드에서 월간 일정을 불러오는 중...'); 
        this.injectInfiniteToggleBtn();
        window.currentMyGroups = await dbAPI.loadMyGroups().catch(() => []);
        this.myGroups = window.currentMyGroups;
        if (!window.activeUnifiedFilters) window.activeUnifiedFilters = ['personal', ...this.myGroups.map(g => g.id)];
        if (window.FilterUI) window.FilterUI.renderUnifiedFilter(this.myGroups);

        const maxP = store.periodNames ? store.periodNames.length : 6;
        const colgroupHtml = `<colgroup><col style="width: 110px;"><col style="width: 60px;">${Array.from({length: maxP}).map(() => `<col>`).join('')}</colgroup>`;

        if (this.isInfiniteMode) {
            const y = store.currentDate.getFullYear();
            const m = store.currentDate.getMonth();
            this.renderedDateStrings = [];
            this.loadedMonths = [{y, m}];
            
            const chunkHtml = await this.buildViewerChunk(y, m);
            this.container.innerHTML = `
                <div id="month-top-sentinel" style="height:20px; width:100%;"></div>
                <div class="table-container" style="background:#fff; padding:12px; border-radius:8px; overflow:visible;">
                    <table style="width:100%; border-collapse:collapse; text-align:center; table-layout:fixed;" id="infinite-viewer-container">
                        ${colgroupHtml}
                        ${chunkHtml}
                    </table>
                </div>
                <div id="month-bottom-sentinel" style="height:20px; width:100%;"></div>
            `;
            this.setupInfiniteObserver('viewer');
            this.setupChunkObserver();
        } else {
            const y = store.currentDate.getFullYear();
            const m = store.currentDate.getMonth();
            const chunkHtml = await this.buildViewerChunk(y, m);
            this.container.innerHTML = `
              <div class="table-container" style="background:#fff; padding:12px; border-radius:8px; overflow:visible; margin-top:15px;">
                <table style="width:100%; border-collapse:collapse; text-align:center; table-layout:fixed;">
                    ${colgroupHtml}
                    ${chunkHtml}
                </table>
              </div>`;
        }
    } finally {
        this.isRendering = false;
    }
  }

  async renderEditor() {
    this.isRendering = true;
    this.renderId = Date.now();
    try {
        this.showLoading('월간 편집 시트를 불러오는 중...');
        this.injectInfiniteToggleBtn();
        window.currentMyGroups = await dbAPI.loadMyGroups().catch(() => []);
        this.myGroups = window.currentMyGroups;
        if (!window.activeUnifiedFilters) window.activeUnifiedFilters = ['personal', ...this.myGroups.map(g => g.id)];
        if (window.FilterUI) window.FilterUI.renderUnifiedFilter(this.myGroups);

        const y = store.currentDate.getFullYear();
        const m = store.currentDate.getMonth();
        const maxP = store.periodNames ? store.periodNames.length : 6;
        const colgroupHtml = `<colgroup><col style="width: 110px;"><col style="width: 60px;">${Array.from({length: maxP}).map(() => `<col>`).join('')}</colgroup>`;
        const headerTr = `<tr style="background:#f1f5f9;"><th style="padding:8px; border:1px solid #cbd5e1; font-weight:bold; color:#1e293b;">날짜</th><th style="padding:8px; border:1px solid #cbd5e1; font-weight:bold; color:#1e293b;">구분</th><th colspan="${maxP}" style="padding:8px; border:1px solid #cbd5e1; font-weight:bold; color:#1e293b;">📌 내용 (직접 수정)</th></tr>`;

        this.renderedDateStrings = [];

        if (this.isInfiniteMode) {
            this.loadedMonths = [{y, m}];
            const chunkHtml = await this.buildEditorChunk(y, m);
            
            this.container.innerHTML = `
              <div id="month-top-sentinel" style="height:20px; width:100%;"></div>
              <div class="table-container" style="background:#fff; padding:12px; border-radius:8px; overflow:visible;">
                <table id="month-editor-table" style="width:100%; border-collapse:collapse; text-align:center; table-layout:fixed;">
                  ${colgroupHtml}
                  <thead style="position: sticky; top: 0; z-index: 100; box-shadow: 0 2px 4px rgba(0,0,0,0.1); background: #fff;">${headerTr}</thead>
                  <tbody id="infinite-editor-container" style="display:contents;">${chunkHtml}</tbody>
                </table>
              </div>
              <div id="month-bottom-sentinel" style="height:20px; width:100%;"></div>`;
            this.setupInfiniteObserver('editor');
            this.setupChunkObserver();
        } else {
            const chunkHtml = await this.buildEditorChunk(y, m);
            this.container.innerHTML = `
              <div class="table-container" style="background:#fff; padding:12px; border-radius:8px; overflow:visible; margin-top:15px;">
                <table id="month-editor-table" style="width:100%; border-collapse:collapse; text-align:center; table-layout:fixed;">
                  ${colgroupHtml}
                  <thead style="border-bottom: 2px solid #cbd5e1;">${headerTr}</thead>
                  ${chunkHtml}
                </table>
              </div>`;
        }
    } finally {
        this.isRendering = false;
    }
  }

  syncCompactEventInputs(dateStr) { CompactEventHelper.syncCompactEventInputs(dateStr); }
  
  syncAllCompactEventInputs() { 
      if (this.renderedDateStrings) {
          this.renderedDateStrings.forEach(dateStr => this.syncCompactEventInputs(dateStr)); 
      }
  }
  
  syncScheduleInputs() { CompactEventHelper.syncScheduleInputs('data-month-schedule-date', 'edit-class-cell'); }

  async save() {
    if (this.isRendering) return; 
    this.syncScheduleInputs(); 
    this.syncAllCompactEventInputs();

    const snapshot = [];
    const datesToSave = this.renderedDateStrings || [];
    
    for(const dateStr of datesToSave) {
        const rawList = window[`tempEvents_${dateStr}`];
        if (rawList !== undefined) {
            const validEvents = rawList.filter(e => e.content?.trim() || e.labelIds?.length > 0).map(e => ({
                ...e, 
                id: e.id || 'ev_' + Date.now() + Math.random().toString(36).substr(2,5),
                authorId: e.authorId || auth?.currentUser?.uid, 
                sharedGroupId: e.sharedGroupId || 'personal'
            }));
            snapshot.push({ dateStr, validEvents, schedulesData: JSON.parse(JSON.stringify(window[`tempSchedules_${dateStr}`] || {})) });
        }
    }

    await saveCalendarData(snapshot, this.myGroups, window.activeUnifiedFilters);
    store.hasUnsavedChanges = false;
  }
}

const instance = new MonthView(document.getElementById("main-view"));
Object.assign(window, {
    monthViewInstance: instance,
    renderMonthViewer: (c) => { instance.container = c; instance.renderViewer(); },
    renderMonthEditor: (c) => { instance.container = c; instance.renderEditor(); },
    saveMonthDataFromEditor: () => instance.save()
});
