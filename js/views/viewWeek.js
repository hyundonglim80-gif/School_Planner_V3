<<<<<<< HEAD
// js/views/viewWeek.js
import { BaseView } from '../components/BaseView.js';
import { store } from '../core/store.js';
import { formatDate, getEventLabels, getJournalLabels, getLabelStyle, isRedDay, getHolidayName } from '../core/utils.js';
import { dbAPI } from '../api/database.js'; 
import { auth, db } from '../api/firebaseInit.js';
import { generateEventBadgesHTML } from '../core/eventManager.js';
import { CompactEventHelper } from '../ui/templateHelpers.js';
import { fetchCalendarData, saveCalendarData } from '../core/calendarDataManager.js';

export class WeekView extends BaseView {
  constructor(container) {
    super(container); 
    this.myGroups = [];
    this.scheduleGroupId = null; 
    this.isRendering = false; 
    this.renderId = 0; 

    this.isInfiniteMode = localStorage.getItem('workCalendar_infiniteScroll') === 'true';
    window.isInfiniteScrollActive = this.isInfiniteMode; 
    this.loadedWeeks = []; 
    this.observer = null;
    this.chunkObserver = null;
    this.isLoadingMore = false;
    this.renderedDateStrings = []; 

    if (typeof window.scrollToTodayIfExist === 'function' && !window.originalScrollToTodayWeek) {
        window.originalScrollToTodayWeek = window.scrollToTodayIfExist;
        window.scrollToTodayIfExist = () => {
            window.isAutoScrollingWeek = true;
            window.originalScrollToTodayWeek();
            setTimeout(() => { window.isAutoScrollingWeek = false; }, 1500);
        };
    }
  }

  async changeScheduleWorkspace(newGroupId) {
      if (store.hasUnsavedChanges) this.save(); 
      this.scheduleGroupId = newGroupId || null;
      if (store.mode === 'editor') this.renderEditor();
      else this.renderViewer();
  }

  getWeekDates(baseDateStr = null) {
    const tempDate = baseDateStr ? new Date(baseDateStr) : new Date(store.currentDate);
    tempDate.setDate(tempDate.getDate() - tempDate.getDay()); 
    const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
    return Array.from({ length: 7 }).reduce((acc, _, i) => {
      if (store.showWeekend || (i !== 0 && i !== 6)) {
        acc.push({ day: dayNames[i], dayOfWeekNum: i, dateStr: formatDate(tempDate), dateDisplay: `${tempDate.getDate()}일` });
      }
      tempDate.setDate(tempDate.getDate() + 1);
      return acc;
    }, []);
  }

  getWeekTitle(dateStr) {
      if (!dateStr) return '';
      const parts = dateStr.split('-');
      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      d.setDate(d.getDate() + 4); 
      const m = d.getMonth() + 1;
      const firstDay = new Date(d.getFullYear(), d.getMonth(), 1).getDay();
      const weekNum = Math.ceil((d.getDate() + firstDay) / 7);
      return `${d.getFullYear()}년 ${m}월 ${weekNum}주차`;
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
          btn.style.display = ''; // 🌟 하루 페이지에서 숨겨졌던 버튼을 다시 표시 (복구)
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
          if (window.isAutoScrollingWeek) return;
          entries.forEach(entry => {
              if (entry.isIntersecting) {
                  const chunkDateStr = entry.target.getAttribute('data-date');
                  if (chunkDateStr) {
                      const parts = chunkDateStr.split('-');
                      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
                      d.setDate(d.getDate() + 3); 
                      store.currentDate = d;
                      if (window.updateTitle) window.updateTitle();
                  }
              }
          });
      }, { rootMargin: '-40% 0px -40% 0px' }); 
      
      document.querySelectorAll('.week-chunk').forEach(chunk => {
          this.chunkObserver.observe(chunk);
      });
  }

  setupInfiniteObserver(mode) {
      if (this.observer) this.observer.disconnect();
      const currentRenderId = this.renderId; 
      
      this.observer = new IntersectionObserver(async (entries) => {
          if (window.isAutoScrollingWeek || window.activeModalCount > 0) return; 

          for (let entry of entries) {
              if (entry.isIntersecting && !this.isLoadingMore) {
                  this.isLoadingMore = true;
                  try {
                      if (entry.target.id === 'week-bottom-sentinel') {
                          const lastDateStr = this.loadedWeeks[this.loadedWeeks.length - 1].dateStr;
                          const parts = lastDateStr.split('-');
                          const nextDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
                          nextDate.setDate(nextDate.getDate() + 7);
                          const nyStr = formatDate(nextDate);
                          
                          const html = mode === 'editor' ? await this.buildEditorChunk(nyStr) : await this.buildViewerChunk(nyStr);
                          
                          if (this.renderId !== currentRenderId) return;
                          
                          this.insertChunkToDOM(html, mode, 'bottom', nyStr);
                      } 
                      else if (entry.target.id === 'week-top-sentinel') {
                          const firstDateStr = this.loadedWeeks[0].dateStr;
                          const parts = firstDateStr.split('-');
                          const prevDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
                          prevDate.setDate(prevDate.getDate() - 7);
                          const pyStr = formatDate(prevDate);
                          
                          const html = mode === 'editor' ? await this.buildEditorChunk(pyStr) : await this.buildViewerChunk(pyStr);
                          
                          if (this.renderId !== currentRenderId) return;
                          
                          const oldScrollHeight = document.documentElement.scrollHeight;
                          const oldScrollTop = window.scrollY || document.documentElement.scrollTop;
                          
                          this.insertChunkToDOM(html, mode, 'top', pyStr);
                          
                          const newScrollHeight = document.documentElement.scrollHeight;
                          const diff = newScrollHeight - oldScrollHeight;
                          window.scrollTo({ top: oldScrollTop + diff, behavior: 'instant' });
                      }
                  } finally {
                    setTimeout(() => { 
                        this.isLoadingMore = false; 
                        
                        // 🌟 추가된 부분: 불러온 청크의 세로 길이가 짧아 감지선이 여전히 감지 영역(600px) 안에 남아있을 경우,
                        // 옵저버 상태를 강제로 재평가하여 스크롤이 먹통이 되는 현상을 막습니다.
                        if (entry.target) {
                            this.observer.unobserve(entry.target);
                            this.observer.observe(entry.target);
                        }
                    }, 100);
                }
            }
        }
    }, { rootMargin: '600px' });

      const topSentinel = document.getElementById('week-top-sentinel');
      const bottomSentinel = document.getElementById('week-bottom-sentinel');
      if (topSentinel) this.observer.observe(topSentinel);
      if (bottomSentinel) this.observer.observe(bottomSentinel);
  }

  insertChunkToDOM(html, mode, position, startOfWeekStr) {
      const container = document.getElementById(mode === 'editor' ? 'week-editor-table' : 'infinite-viewer-container');
      if (!container) return;
      
      if (mode === 'editor') {
          if (position === 'bottom') {
              container.insertAdjacentHTML('beforeend', html);
              this.loadedWeeks.push({ dateStr: startOfWeekStr });
          } else {
              const thead = container.querySelector('thead');
              if (thead) thead.insertAdjacentHTML('afterend', html);
              else container.insertAdjacentHTML('afterbegin', html);
              this.loadedWeeks.unshift({ dateStr: startOfWeekStr });
          }
          setTimeout(() => { this.syncAllCompactEventInputs(); }, 100);
      } else {
          if (position === 'bottom') {
              container.insertAdjacentHTML('beforeend', html);
              this.loadedWeeks.push({ dateStr: startOfWeekStr });
          } else {
              const colgroup = container.querySelector('colgroup');
              if (colgroup) colgroup.insertAdjacentHTML('afterend', html);
              else container.insertAdjacentHTML('afterbegin', html);
              this.loadedWeeks.unshift({ dateStr: startOfWeekStr });
          }
      }
      this.setupChunkObserver(); 
  }

  async fetchWeekData(baseDateStr) {
      const weekDates = this.getWeekDates(baseDateStr);
      try { this.myGroups = await dbAPI.loadMyGroups(); } catch(e) { this.myGroups = []; } 
      
      let eMap = {}, sMap = {}, jMap = {}, vMap = {};
      try {
          const res = await fetchCalendarData(weekDates[0].dateStr, weekDates[weekDates.length - 1].dateStr, this.myGroups);
          eMap = res.eMap; sMap = res.sMap; jMap = res.jMap; vMap = res.vMap;
      } catch (e) {
          console.warn("데이터 로드 실패:", e);
      }
      return { eMap, sMap, jMap, vMap, weekDates };
  }

  async buildViewerChunk(baseDateStr) {
      const { eMap, sMap, jMap, vMap, weekDates } = await this.fetchWeekData(baseDateStr);
      const realTodayStr = formatDate(new Date());
      const filters = window.activeUnifiedFilters || ['personal'];
      const filterCount = filters.length;
      const totalRows = filterCount + (store.showClass ? 1 + filterCount : 0);
      const startOfWeekStr = weekDates[0].dateStr;
      
      const masterEventLabels = getEventLabels();
      const masterJournalLabels = getJournalLabels();

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
              const groupTitle = isPersonal ? '개인' : (this.myGroups.find(g => g.id === fId)?.name || '그룹');
              const badgeHtml = filterCount > 1 ? `<div style="font-size:1.1rem; color:${badgeColor}; background:${badgeBg}; padding:2px 6px; border-radius:6px; display:inline-block; margin-top:4px; cursor:help;" title="${groupTitle}">${gIcon}</div>` : '';

              const fEvents = (eMap[d.dateStr]?.eventList || []).filter(e => (e.sharedGroupId || 'personal') === fId);
              const processedEvents = fEvents.map(e => ({ ...e, labelIds: e.labelIds || [], content: e.content }));
              
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
              
              let eventContent = processedEvents.length > 0 ? generateEventBadgesHTML(processedEvents, d.dateStr) : '<span style="color:#94a3b8;">-</span>';

              const jList = jMap[d.dateStr]?.[fId] || [];
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
              
              const vList = vMap[d.dateStr]?.[fId] || [];

              let attachmentCount = 0;
              validJournals.forEach(j => { if (j.attachments) attachmentCount += j.attachments.length; });

              let metaBadges = '';
              if (validJournals.length > 0) metaBadges += `<span style="display:inline-flex; align-items:center; background:#fdf2f8; color:#be185d; padding:2px 5px; border-radius:4px; font-size:0.75rem; font-weight:bold; margin-right:4px; box-shadow:0 1px 2px rgba(0,0,0,0.05);" title="기록 ${validJournals.length}개">📔 ${validJournals.length}</span>`;
              if (vList.length > 0) metaBadges += `<span style="display:inline-flex; align-items:center; background:#eff6ff; color:#1e40af; padding:2px 5px; border-radius:4px; font-size:0.75rem; font-weight:bold; margin-right:4px; box-shadow:0 1px 2px rgba(0,0,0,0.05);" title="조사표 ${vList.length}개">📊 ${vList.length}</span>`;
              if (attachmentCount > 0) metaBadges += `<span style="display:inline-flex; align-items:center; background:#f1f5f9; color:#475569; padding:2px 5px; border-radius:4px; font-size:0.75rem; font-weight:bold; margin-right:4px; box-shadow:0 1px 2px rgba(0,0,0,0.05); border:1px solid #cbd5e1;" title="첨부파일 ${attachmentCount}개">📎 ${attachmentCount}</span>`;

              if (metaBadges) {
                  if (processedEvents.length === 0) eventContent = '';
                  eventContent += `<div style="margin-top:6px; display:flex; flex-wrap:wrap;">${metaBadges}</div>`;
              }
              if (!eventContent) eventContent = '<span style="color:#94a3b8;">-</span>';

              const holidayHtml = holidayName ? `<span style="font-size:0.75rem; color:#ef4444; font-weight:bold; margin-top:2px;">${holidayName}</span>` : '';
              const todayClass = isToday ? 'week-today-cell' : '';

              if (idx === 0) {
                  rowsHtmlForDate += `
                  <tr data-week-date="${d.dateStr}" class="week-row-${d.dateStr}">
                    <td rowspan="${totalRows}" class="${todayClass}" style="width: 70px; vertical-align: middle; text-align: center; padding: 8px 4px; border: 1px solid #cbd5e1; position: static !important; z-index: auto !important; transform: none !important;">
                      <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
                        <span onclick="window.goToDay('${d.dateStr}')" style="font-size:1.8rem; font-weight:900; color:${dateColor}; line-height:1; cursor: pointer;" title="${d.dateStr} 일 보기로 이동">${d.day}</span>
                        <span style="font-size:0.95rem; font-weight:600; color:${dateNumColor}; line-height:1;">${d.dateDisplay}</span>
                        ${holidayHtml}
                      </div>
                    </td>
                    <td style="width: 50px; font-weight: bold; background: #eff6ff; color: #1e40af; vertical-align: middle; text-align: center; border: 1px solid #cbd5e1; position: static !important; z-index: auto !important; transform: none !important;">일정${badgeHtml}</td>
                    <td colspan="${this.maxPeriod}" style="text-align: left; padding: 8px 10px; background: #f8fafc; border: 1px solid #cbd5e1;">${eventContent}</td>
                  </tr>`;
              } else {
                  rowsHtmlForDate += `
                  <tr class="week-row-${d.dateStr}">
                    <td style="width: 50px; font-weight: bold; background: #eff6ff; color: #1e40af; vertical-align: middle; text-align: center; border: 1px solid #cbd5e1; position: static !important; z-index: auto !important; transform: none !important;">일정${badgeHtml}</td>
                    <td colspan="${this.maxPeriod}" style="text-align: left; padding: 8px 10px; background: #f8fafc; border: 1px solid #cbd5e1;">${eventContent}</td>
                  </tr>`;
              }
          });

          if (store.showClass) {
              const pNamesHtml = (store.periodNames || ["1","2","3","4","5","6"]).map(name => `<td style="font-weight: bold; background: #f8fafc; color: #334155; width: ${100 / this.maxPeriod}%; text-align: center; border: 1px solid #cbd5e1; position: static !important; z-index: auto !important; transform: none !important;">${name}</td>`).join('');
              
              rowsHtmlForDate += `<tr class="week-row-${d.dateStr}"><td style="font-weight: bold; background: #f1f5f9; color: #475569; vertical-align: middle; text-align: center; border: 1px solid #cbd5e1; position: static !important; z-index: auto !important; transform: none !important;">교시</td>${pNamesHtml}</tr>`;

              filters.forEach((fId) => {
                  const isPersonal = fId === 'personal';
                  const gIcon = isPersonal ? '🔒' : '👥'; 
                  const badgeColor = isPersonal ? '#2563eb' : '#059669';
                  const badgeBg = isPersonal ? '#eff6ff' : '#ecfdf5';
                  const groupTitle = isPersonal ? '개인' : (this.myGroups.find(g => g.id === fId)?.name || '그룹');
                  const badgeHtml = filterCount > 1 ? `<div style="font-size:1.1rem; color:${badgeColor}; background:${badgeBg}; padding:2px 6px; border-radius:6px; display:inline-block; margin-top:4px; cursor:help;" title="${groupTitle}">${gIcon}</div>` : '';
                  
                  const periods = sMap[d.dateStr]?.[fId] || {};
                  const periodCellsHtml = Array.from({ length: this.maxPeriod }).map((_, i) => {
                      const p = i + 1; const pObj = periods[p] || {}; let content = '';
                      if (pObj.subject && pObj.subject.toUpperCase() !== 'X') content += `<div style="margin-bottom: 4px; font-weight:bold; color:#0f172a;"><span class="badge-tag">${pObj.subject}</span></div>`;
                      if (pObj.memo) content += `<div class="clean-cell-memo" style="font-size:0.95rem; color:#334155; white-space:pre-wrap;">${pObj.memo}</div>`;
                      if (pObj.supplies) content += `<div style="margin-top:4px; font-size:0.85rem; color:#b91c1c; font-weight:bold; background:#fef2f2; padding:2px 4px; border-radius:4px; white-space:pre-wrap;">${pObj.supplies}</div>`;
                      return `<td style="vertical-align: top; text-align: left; padding: 8px; height: var(--week-cell-height); border: 1px solid #cbd5e1;">${content}</td>`;
                  }).join('');

                  rowsHtmlForDate += `
                  <tr data-week-schedule-date="${d.dateStr}" data-fid="${fId}" class="week-row-${d.dateStr}">
                    <td style="padding:4px; border:1px solid #cbd5e1; background:#ecfdf5; color:#047857; font-weight:bold; font-size:0.9rem; vertical-align:middle; text-align:center; position: static !important; z-index: auto !important; transform: none !important;">수업${badgeHtml}</td>
                    ${periodCellsHtml}
                  </tr>`;
              });
          }
          return rowsHtmlForDate;
      }).join('');

      let headerBanner = this.isInfiniteMode ? `<tr class="month-separator"><td colspan="${this.maxPeriod + 2}" style="padding:10px; background:#f8fafc; color:#475569; font-size:1rem; font-weight:900; text-align:center; border:1px dashed #cbd5e1;">${this.getWeekTitle(startOfWeekStr)}</td></tr>` : '';
      return `<tbody class="week-chunk" data-date="${startOfWeekStr}">${headerBanner}${rowsHtml}</tbody>`;
  }

  async buildEditorChunk(baseDateStr) {
      const { eMap, sMap, jMap, vMap, weekDates } = await this.fetchWeekData(baseDateStr);
      const realTodayStr = formatDate(new Date());
      const filters = window.activeUnifiedFilters || ['personal'];
      const filterCount = filters.length;
      const totalRows = filterCount + (store.showClass ? 1 + filterCount : 0);
      const startOfWeekStr = weekDates[0].dateStr;

      const maxP = store.periodNames ? store.periodNames.length : 6;

      const rowsHtml = weekDates.map(d => {
          if (!this.renderedDateStrings.includes(d.dateStr)) this.renderedDateStrings.push(d.dateStr);
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
                          const match = getEventLabels().find(l => l.name === name);
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
          
          const holidayHtml = holidayName ? `<span style="font-size:0.75rem; color:#ef4444; font-weight:bold; margin-top:2px;">${holidayName}</span>` : '';
          const todayClass = isToday ? 'week-today-cell' : '';

          let rowsHtmlForDate = '';

          filters.forEach((fId, idx) => {
              const isPersonal = fId === 'personal';
              const gIcon = isPersonal ? '🔒' : '👥'; 
              const badgeColor = isPersonal ? '#2563eb' : '#059669';
              const badgeBg = isPersonal ? '#eff6ff' : '#ecfdf5';
              const groupTitle = isPersonal ? '개인' : (this.myGroups.find(g => g.id === fId)?.name || '그룹');
              const badgeHtml = filterCount > 1 ? `<div style="font-size:1.1rem; color:${badgeColor}; background:${badgeBg}; padding:2px 6px; border-radius:6px; display:inline-block; margin-top:4px; cursor:help;" title="${groupTitle}">${gIcon}</div>` : '';

              let eventContent = `<div id="compact-events-${d.dateStr}-${fId}" style="display:flex; flex-direction:column; gap:4px;">${CompactEventHelper.generateCompactEventEditor(d.dateStr, fId)}</div>`;
              
              if (idx === 0) {
                  rowsHtmlForDate += `
                  <tr data-week-date="${d.dateStr}" class="week-row-${d.dateStr}">
                    <td rowspan="${totalRows}" class="${todayClass}" style="width: 70px; vertical-align: middle; text-align: center; padding: 8px 4px; border: 1px solid #cbd5e1; position: static !important; z-index: auto !important; transform: none !important;">
                      <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
                        <span onclick="window.goToDay('${d.dateStr}')" style="font-size:1.2rem; font-weight:900; color:${dateNumColor}; line-height:1.1; cursor: pointer;" title="${d.dateStr} 일 보기로 이동">${d.dateDisplay}</span>
                        <span style="font-size:0.95rem; font-weight:600; color:${dateColor}; line-height:1;">${d.day}</span>
                        ${holidayHtml}
                      </div>
                    </td>
                    <td style="padding:4px; border:1px solid #cbd5e1; background:#f0f9ff; color:#0369a1; font-weight:bold; font-size:0.9rem; vertical-align:middle; width:60px; text-align:center;">일정${badgeHtml}</td>
                    <td colspan="${maxP}" style="text-align: left; padding: 6px 10px; background: #f0f9ff; vertical-align:top; border:1px solid #cbd5e1;">${eventContent}</td>
                  </tr>`;
              } else {
                  rowsHtmlForDate += `
                  <tr class="week-row-${d.dateStr}">
                    <td style="padding:4px; border:1px solid #cbd5e1; background:#f0f9ff; color:#0369a1; font-weight:bold; font-size:0.9rem; vertical-align:middle; width:60px; text-align:center;">일정${badgeHtml}</td>
                    <td colspan="${maxP}" style="text-align: left; padding: 6px 10px; background: #f0f9ff; vertical-align:top; border:1px solid #cbd5e1;">${eventContent}</td>
                  </tr>`;
              }
          });

          if (store.showClass) {
              const pNamesHtml = (store.periodNames || ["1","2","3","4","5","6"]).map(name => `<td style="font-weight: bold; background: #f8fafc; color: #334155; width: ${100 / maxP}%; text-align: center; border: 1px solid #cbd5e1; position: static !important; z-index: auto !important; transform: none !important;">${name}</td>`).join('');
              
              rowsHtmlForDate += `<tr class="week-row-${d.dateStr}"><td style="font-weight: bold; background: #f1f5f9; color: #475569; vertical-align: middle; text-align: center; border: 1px solid #cbd5e1; position: static !important; z-index: auto !important; transform: none !important;">교시</td>${pNamesHtml}</tr>`;

              filters.forEach((fId) => {
                  const isPersonal = fId === 'personal';
                  const gIcon = isPersonal ? '🔒' : '👥'; 
                  const badgeColor = isPersonal ? '#2563eb' : '#059669';
                  const badgeBg = isPersonal ? '#eff6ff' : '#ecfdf5';
                  const groupTitle = isPersonal ? '개인' : (this.myGroups.find(g => g.id === fId)?.name || '그룹');
                  const badgeHtml = filterCount > 1 ? `<div style="font-size:1.1rem; color:${badgeColor}; background:${badgeBg}; padding:2px 6px; border-radius:6px; display:inline-block; margin-top:4px; cursor:help;" title="${groupTitle}">${gIcon}</div>` : '';
                  
                  const periods = window[`tempSchedules_${d.dateStr}`][fId];
                  const periodCellsHtml = Array.from({ length: maxP }).map((_, i) => {
                      const p = i + 1; const pObj = periods[p] || {}; let cellText = "";
                      if (pObj.subject && pObj.subject.toUpperCase() !== 'X') cellText += `[${pObj.subject}] `;
                      if (pObj.memo) cellText += pObj.memo + " ";
                      if (pObj.supplies) cellText += `[${pObj.supplies}]`;
                      return `<td class="editable-cell week-period-cell" data-p="${p}" data-fid="${fId}" contenteditable="true" style="vertical-align: top; height: var(--week-cell-height); text-align: left; padding: 6px 8px; white-space: pre-wrap; border:1px solid #cbd5e1; font-size:1rem; color:#047857; background:#ecfdf5;" oninput="window.weekViewInstance.syncScheduleInputs()">${cellText.trim()}</td>`;
                  }).join('');

                  rowsHtmlForDate += `
                  <tr data-week-schedule-date="${d.dateStr}" data-fid="${fId}" class="week-row-${d.dateStr}">
                    <td style="padding:4px; border:1px solid #cbd5e1; background:#ecfdf5; color:#047857; font-weight:bold; font-size:0.9rem; vertical-align:middle; text-align:center; position: static !important; z-index: auto !important; transform: none !important;">수업${badgeHtml}</td>
                    ${periodCellsHtml}
                  </tr>`;
              });
          }
          return rowsHtmlForDate;
      }).join('');

      let headerBanner = this.isInfiniteMode ? `<tr class="month-separator"><td colspan="${maxP + 2}" style="padding:10px; background:#f8fafc; color:#475569; font-size:1rem; font-weight:900; text-align:center; border:1px dashed #cbd5e1;">${this.getWeekTitle(startOfWeekStr)}</td></tr>` : '';
      return `<tbody class="week-chunk" data-date="${startOfWeekStr}">${headerBanner}${rowsHtml}</tbody>`;
  }

  async renderViewer() {
    this.isRendering = true;
    this.renderId = Date.now(); 
    try {
        this.showLoading('클라우드에서 주간 데이터를 불러오는 중...'); 
        this.injectInfiniteToggleBtn();
        window.currentMyGroups = await dbAPI.loadMyGroups().catch(() => []);
        this.myGroups = window.currentMyGroups;
        if (!window.activeUnifiedFilters) window.activeUnifiedFilters = ['personal', ...this.myGroups.map(g => g.id)];
        if (window.FilterUI) window.FilterUI.renderUnifiedFilter(this.myGroups);

        const maxP = store.periodNames ? store.periodNames.length : 6;
        const colgroupHtml = `<colgroup><col style="width: 70px;"><col style="width: 50px;">${Array.from({length: maxP}).map(() => `<col>`).join('')}</colgroup>`;

        if (this.isInfiniteMode) {
            const tempDateStr = formatDate(store.currentDate);
            const startOfWeekStr = this.getWeekDates(tempDateStr)[0].dateStr;
            this.renderedDateStrings = [];
            this.loadedWeeks = [{ dateStr: startOfWeekStr }];
            
            const chunkHtml = await this.buildViewerChunk(startOfWeekStr);
            this.container.innerHTML = `
                <div id="week-top-sentinel" style="height:20px; width:100%;"></div>
                <div class="clean-viewer-board" style="overflow: visible; margin-top: 15px;">
                    <table style="width:100%; border-collapse:collapse; text-align:center; table-layout:fixed;" id="infinite-viewer-container">
                        ${colgroupHtml}
                        ${chunkHtml}
                    </table>
                </div>
                <div id="week-bottom-sentinel" style="height:20px; width:100%;"></div>
            `;
            this.setupInfiniteObserver('viewer');
            this.setupChunkObserver();
        } else {
            const startOfWeekStr = this.getWeekDates()[0].dateStr;
            const chunkHtml = await this.buildViewerChunk(startOfWeekStr);
            this.container.innerHTML = `
                <div class="clean-viewer-board" style="overflow: visible; margin-top: 15px;">
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
        this.showLoading('편집 화면을 준비 중...');
        this.injectInfiniteToggleBtn();
        window.currentMyGroups = await dbAPI.loadMyGroups().catch(() => []);
        this.myGroups = window.currentMyGroups;
        if (!window.activeUnifiedFilters) window.activeUnifiedFilters = ['personal', ...this.myGroups.map(g => g.id)];
        if (window.FilterUI) window.FilterUI.renderUnifiedFilter(this.myGroups);

        const maxP = store.periodNames ? store.periodNames.length : 6;
        const colgroupHtml = `<colgroup><col style="width: 110px;"><col style="width: 60px;">${Array.from({length: maxP}).map(() => `<col>`).join('')}</colgroup>`;
        const headerTr = `<tr style="background:#f1f5f9;"><th style="padding:8px; border:1px solid #cbd5e1; font-weight:bold; color:#1e293b; background:#f1f5f9;">날짜</th><th style="padding:8px; border:1px solid #cbd5e1; font-weight:bold; color:#1e293b; background:#f1f5f9;">구분</th><th colspan="${maxP}" style="padding:8px; border:1px solid #cbd5e1; font-weight:bold; color:#1e293b; background:#f1f5f9;">📌 내용 (직접 수정)</th></tr>`;

        this.renderedDateStrings = [];

        if (this.isInfiniteMode) {
            const tempDateStr = formatDate(store.currentDate);
            const startOfWeekStr = this.getWeekDates(tempDateStr)[0].dateStr;
            this.loadedWeeks = [{ dateStr: startOfWeekStr }];
            const chunkHtml = await this.buildEditorChunk(startOfWeekStr);
            
            this.container.innerHTML = `
              <div id="week-top-sentinel" style="height:20px; width:100%;"></div>
              <div class="table-container" style="background:#fff; padding:12px; border-radius:8px; overflow:visible;">
                <table id="week-editor-table" style="width:100%; border-collapse:collapse; text-align:center; table-layout:fixed;">
                  ${colgroupHtml}
                  <thead style="position: sticky; top: 0; z-index: 100; box-shadow: 0 2px 4px rgba(0,0,0,0.1); background: #fff;">${headerTr}</thead>
                  <tbody id="infinite-editor-container" style="display:contents;">${chunkHtml}</tbody>
                </table>
              </div>
              <div id="week-bottom-sentinel" style="height:20px; width:100%;"></div>`;
            this.setupInfiniteObserver('editor');
            this.setupChunkObserver();
        } else {
            const startOfWeekStr = this.getWeekDates()[0].dateStr;
            const chunkHtml = await this.buildEditorChunk(startOfWeekStr);
            this.container.innerHTML = `
              <div class="table-container" style="background:#fff; padding:12px; border-radius:8px; overflow:visible; margin-top: 15px;">
                <table id="week-editor-table" style="width:100%; border-collapse:collapse; text-align:center; table-layout:fixed;">
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
      if (this.renderedDateStrings) this.renderedDateStrings.forEach(dateStr => this.syncCompactEventInputs(dateStr));
  }
  syncScheduleInputs() { CompactEventHelper.syncScheduleInputs('data-week-schedule-date', 'week-period-cell'); }

  async save() {
    if (this.isRendering) return; 
    this.syncScheduleInputs();
    this.syncAllCompactEventInputs(); 
    
    const datesToSave = this.renderedDateStrings || [];
    const snapshot = datesToSave.map(dateStr => {
        const validEvents = (window[`tempEvents_${dateStr}`] || [])
            .filter(e => e.content?.trim() || e.labelIds?.length > 0)
            .map(e => ({
                ...e, 
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

const instance = new WeekView(document.getElementById("main-view"));

Object.assign(window, {
    weekViewInstance: instance,
    renderWeekViewer: (c) => { instance.container = c; instance.renderViewer(); },
    renderWeekEditor: (c) => { instance.container = c; instance.renderEditor(); },
    saveWeekDataFromEditor: () => instance.save()
});
=======
// js/views/viewWeek.js
import { BaseView } from '../components/BaseView.js';
import { store } from '../core/store.js';
import { formatDate, getEventLabels, getJournalLabels, getLabelStyle, isRedDay, getHolidayName } from '../core/utils.js';
import { dbAPI } from '../api/database.js'; 
import { auth, db } from '../api/firebaseInit.js';
import { generateEventBadgesHTML } from '../core/eventManager.js';
import { CompactEventHelper } from '../ui/templateHelpers.js';
import { fetchCalendarData, saveCalendarData } from '../core/calendarDataManager.js';

export class WeekView extends BaseView {
  constructor(container) {
    super(container); 
    this.myGroups = [];
    this.scheduleGroupId = null; 
    this.isRendering = false; 
    this.renderId = 0; 

    this.isInfiniteMode = localStorage.getItem('workCalendar_infiniteScroll') === 'true';
    window.isInfiniteScrollActive = this.isInfiniteMode; 
    this.loadedWeeks = []; 
    this.observer = null;
    this.chunkObserver = null;
    this.isLoadingMore = false;
    this.renderedDateStrings = []; 

    if (typeof window.scrollToTodayIfExist === 'function' && !window.originalScrollToTodayWeek) {
        window.originalScrollToTodayWeek = window.scrollToTodayIfExist;
        window.scrollToTodayIfExist = () => {
            window.isAutoScrollingWeek = true;
            window.originalScrollToTodayWeek();
            setTimeout(() => { window.isAutoScrollingWeek = false; }, 1500);
        };
    }
  }

  async changeScheduleWorkspace(newGroupId) {
      if (store.hasUnsavedChanges) this.save(); 
      this.scheduleGroupId = newGroupId || null;
      if (store.mode === 'editor') this.renderEditor();
      else this.renderViewer();
  }

  getWeekDates(baseDateStr = null) {
    const tempDate = baseDateStr ? new Date(baseDateStr) : new Date(store.currentDate);
    tempDate.setDate(tempDate.getDate() - tempDate.getDay()); 
    const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
    return Array.from({ length: 7 }).reduce((acc, _, i) => {
      if (store.showWeekend || (i !== 0 && i !== 6)) {
        acc.push({ day: dayNames[i], dayOfWeekNum: i, dateStr: formatDate(tempDate), dateDisplay: `${tempDate.getDate()}일` });
      }
      tempDate.setDate(tempDate.getDate() + 1);
      return acc;
    }, []);
  }

  getWeekTitle(dateStr) {
      if (!dateStr) return '';
      const parts = dateStr.split('-');
      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      d.setDate(d.getDate() + 4); 
      const m = d.getMonth() + 1;
      const firstDay = new Date(d.getFullYear(), d.getMonth(), 1).getDay();
      const weekNum = Math.ceil((d.getDate() + firstDay) / 7);
      return `${d.getFullYear()}년 ${m}월 ${weekNum}주차`;
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
          btn.style.display = ''; // 🌟 하루 페이지에서 숨겨졌던 버튼을 다시 표시 (복구)
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
          if (window.isAutoScrollingWeek) return;
          entries.forEach(entry => {
              if (entry.isIntersecting) {
                  const chunkDateStr = entry.target.getAttribute('data-date');
                  if (chunkDateStr) {
                      const parts = chunkDateStr.split('-');
                      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
                      d.setDate(d.getDate() + 3); 
                      store.currentDate = d;
                      if (window.updateTitle) window.updateTitle();
                  }
              }
          });
      }, { rootMargin: '-40% 0px -40% 0px' }); 
      
      document.querySelectorAll('.week-chunk').forEach(chunk => {
          this.chunkObserver.observe(chunk);
      });
  }

  setupInfiniteObserver(mode) {
      if (this.observer) this.observer.disconnect();
      const currentRenderId = this.renderId; 
      
      this.observer = new IntersectionObserver(async (entries) => {
          if (window.isAutoScrollingWeek || window.activeModalCount > 0) return; 

          for (let entry of entries) {
              if (entry.isIntersecting && !this.isLoadingMore) {
                  this.isLoadingMore = true;
                  try {
                      if (entry.target.id === 'week-bottom-sentinel') {
                          const lastDateStr = this.loadedWeeks[this.loadedWeeks.length - 1].dateStr;
                          const parts = lastDateStr.split('-');
                          const nextDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
                          nextDate.setDate(nextDate.getDate() + 7);
                          const nyStr = formatDate(nextDate);
                          
                          const html = mode === 'editor' ? await this.buildEditorChunk(nyStr) : await this.buildViewerChunk(nyStr);
                          
                          if (this.renderId !== currentRenderId) return;
                          
                          this.insertChunkToDOM(html, mode, 'bottom', nyStr);
                      } 
                      else if (entry.target.id === 'week-top-sentinel') {
                          const firstDateStr = this.loadedWeeks[0].dateStr;
                          const parts = firstDateStr.split('-');
                          const prevDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
                          prevDate.setDate(prevDate.getDate() - 7);
                          const pyStr = formatDate(prevDate);
                          
                          const html = mode === 'editor' ? await this.buildEditorChunk(pyStr) : await this.buildViewerChunk(pyStr);
                          
                          if (this.renderId !== currentRenderId) return;
                          
                          const oldScrollHeight = document.documentElement.scrollHeight;
                          const oldScrollTop = window.scrollY || document.documentElement.scrollTop;
                          
                          this.insertChunkToDOM(html, mode, 'top', pyStr);
                          
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

      const topSentinel = document.getElementById('week-top-sentinel');
      const bottomSentinel = document.getElementById('week-bottom-sentinel');
      if (topSentinel) this.observer.observe(topSentinel);
      if (bottomSentinel) this.observer.observe(bottomSentinel);
  }

  insertChunkToDOM(html, mode, position, startOfWeekStr) {
      const container = document.getElementById(mode === 'editor' ? 'week-editor-table' : 'infinite-viewer-container');
      if (!container) return;
      
      if (mode === 'editor') {
          if (position === 'bottom') {
              container.insertAdjacentHTML('beforeend', html);
              this.loadedWeeks.push({ dateStr: startOfWeekStr });
          } else {
              const thead = container.querySelector('thead');
              if (thead) thead.insertAdjacentHTML('afterend', html);
              else container.insertAdjacentHTML('afterbegin', html);
              this.loadedWeeks.unshift({ dateStr: startOfWeekStr });
          }
          setTimeout(() => { this.syncAllCompactEventInputs(); }, 100);
      } else {
            // 🌟 수정된 부분: 뷰어 모드에서도 table을 정확히 찾아 안전하게 삽입
            const table = container.querySelector('table') || container;
            if (position === 'bottom') {
                table.insertAdjacentHTML('beforeend', html);
                this.loadedWeeks.push({ dateStr: startOfWeekStr });
            } else {
                const colgroup = table.querySelector('colgroup');
                if (colgroup) colgroup.insertAdjacentHTML('afterend', html);
                else table.insertAdjacentHTML('afterbegin', html);
                this.loadedWeeks.unshift({ dateStr: startOfWeekStr });
            }
        }
        this.setupChunkObserver(); 
    }

  async fetchWeekData(baseDateStr) {
      const weekDates = this.getWeekDates(baseDateStr);
      try { this.myGroups = await dbAPI.loadMyGroups(); } catch(e) { this.myGroups = []; } 
      
      let eMap = {}, sMap = {}, jMap = {}, vMap = {};
      try {
          const res = await fetchCalendarData(weekDates[0].dateStr, weekDates[weekDates.length - 1].dateStr, this.myGroups);
          eMap = res.eMap; sMap = res.sMap; jMap = res.jMap; vMap = res.vMap;
      } catch (e) {
          console.warn("데이터 로드 실패:", e);
      }
      return { eMap, sMap, jMap, vMap, weekDates };
  }

  async buildViewerChunk(baseDateStr) {
      const { eMap, sMap, jMap, vMap, weekDates } = await this.fetchWeekData(baseDateStr);
      const realTodayStr = formatDate(new Date());
      const filters = window.activeUnifiedFilters || ['personal'];
      const filterCount = filters.length;
      const totalRows = filterCount + (store.showClass ? 1 + filterCount : 0);
      const startOfWeekStr = weekDates[0].dateStr;
      
      const masterEventLabels = getEventLabels();
      const masterJournalLabels = getJournalLabels();

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
              const groupTitle = isPersonal ? '개인' : (this.myGroups.find(g => g.id === fId)?.name || '그룹');
              const badgeHtml = filterCount > 1 ? `<div style="font-size:1.1rem; color:${badgeColor}; background:${badgeBg}; padding:2px 6px; border-radius:6px; display:inline-block; margin-top:4px; cursor:help;" title="${groupTitle}">${gIcon}</div>` : '';

              const fEvents = (eMap[d.dateStr]?.eventList || []).filter(e => (e.sharedGroupId || 'personal') === fId);
              const processedEvents = fEvents.map(e => ({ ...e, labelIds: e.labelIds || [], content: e.content }));
              
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
              
              let eventContent = processedEvents.length > 0 ? generateEventBadgesHTML(processedEvents, d.dateStr) : '<span style="color:#94a3b8;">-</span>';

              const jList = jMap[d.dateStr]?.[fId] || [];
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
              
              const vList = vMap[d.dateStr]?.[fId] || [];

              let attachmentCount = 0;
              validJournals.forEach(j => { if (j.attachments) attachmentCount += j.attachments.length; });

              let metaBadges = '';
              if (validJournals.length > 0) metaBadges += `<span style="display:inline-flex; align-items:center; background:#fdf2f8; color:#be185d; padding:2px 5px; border-radius:4px; font-size:0.75rem; font-weight:bold; margin-right:4px; box-shadow:0 1px 2px rgba(0,0,0,0.05);" title="기록 ${validJournals.length}개">📔 ${validJournals.length}</span>`;
              if (vList.length > 0) metaBadges += `<span style="display:inline-flex; align-items:center; background:#eff6ff; color:#1e40af; padding:2px 5px; border-radius:4px; font-size:0.75rem; font-weight:bold; margin-right:4px; box-shadow:0 1px 2px rgba(0,0,0,0.05);" title="조사표 ${vList.length}개">📊 ${vList.length}</span>`;
              if (attachmentCount > 0) metaBadges += `<span style="display:inline-flex; align-items:center; background:#f1f5f9; color:#475569; padding:2px 5px; border-radius:4px; font-size:0.75rem; font-weight:bold; margin-right:4px; box-shadow:0 1px 2px rgba(0,0,0,0.05); border:1px solid #cbd5e1;" title="첨부파일 ${attachmentCount}개">📎 ${attachmentCount}</span>`;

              if (metaBadges) {
                  if (processedEvents.length === 0) eventContent = '';
                  eventContent += `<div style="margin-top:6px; display:flex; flex-wrap:wrap;">${metaBadges}</div>`;
              }
              if (!eventContent) eventContent = '<span style="color:#94a3b8;">-</span>';

              const holidayHtml = holidayName ? `<span style="font-size:0.75rem; color:#ef4444; font-weight:bold; margin-top:2px;">${holidayName}</span>` : '';
              const todayClass = isToday ? 'week-today-cell' : '';

              if (idx === 0) {
                  rowsHtmlForDate += `
                  <tr data-week-date="${d.dateStr}" class="week-row-${d.dateStr}">
                    <td rowspan="${totalRows}" class="${todayClass}" style="width: 70px; vertical-align: middle; text-align: center; padding: 8px 4px; border: 1px solid #cbd5e1; position: static !important; z-index: auto !important; transform: none !important;">
                      <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
                        <span onclick="window.goToDay('${d.dateStr}')" style="font-size:1.8rem; font-weight:900; color:${dateColor}; line-height:1; cursor: pointer;" title="${d.dateStr} 일 보기로 이동">${d.day}</span>
                        <span style="font-size:0.95rem; font-weight:600; color:${dateNumColor}; line-height:1;">${d.dateDisplay}</span>
                        ${holidayHtml}
                      </div>
                    </td>
                    <td style="width: 50px; font-weight: bold; background: #eff6ff; color: #1e40af; vertical-align: middle; text-align: center; border: 1px solid #cbd5e1; position: static !important; z-index: auto !important; transform: none !important;">일정${badgeHtml}</td>
                    <td colspan="${this.maxPeriod}" style="text-align: left; padding: 8px 10px; background: #f8fafc; border: 1px solid #cbd5e1;">${eventContent}</td>
                  </tr>`;
              } else {
                  rowsHtmlForDate += `
                  <tr class="week-row-${d.dateStr}">
                    <td style="width: 50px; font-weight: bold; background: #eff6ff; color: #1e40af; vertical-align: middle; text-align: center; border: 1px solid #cbd5e1; position: static !important; z-index: auto !important; transform: none !important;">일정${badgeHtml}</td>
                    <td colspan="${this.maxPeriod}" style="text-align: left; padding: 8px 10px; background: #f8fafc; border: 1px solid #cbd5e1;">${eventContent}</td>
                  </tr>`;
              }
          });

          if (store.showClass) {
              const pNamesHtml = (store.periodNames || ["1","2","3","4","5","6"]).map(name => `<td style="font-weight: bold; background: #f8fafc; color: #334155; width: ${100 / this.maxPeriod}%; text-align: center; border: 1px solid #cbd5e1; position: static !important; z-index: auto !important; transform: none !important;">${name}</td>`).join('');
              
              rowsHtmlForDate += `<tr class="week-row-${d.dateStr}"><td style="font-weight: bold; background: #f1f5f9; color: #475569; vertical-align: middle; text-align: center; border: 1px solid #cbd5e1; position: static !important; z-index: auto !important; transform: none !important;">교시</td>${pNamesHtml}</tr>`;

              filters.forEach((fId) => {
                  const isPersonal = fId === 'personal';
                  const gIcon = isPersonal ? '🔒' : '👥'; 
                  const badgeColor = isPersonal ? '#2563eb' : '#059669';
                  const badgeBg = isPersonal ? '#eff6ff' : '#ecfdf5';
                  const groupTitle = isPersonal ? '개인' : (this.myGroups.find(g => g.id === fId)?.name || '그룹');
                  const badgeHtml = filterCount > 1 ? `<div style="font-size:1.1rem; color:${badgeColor}; background:${badgeBg}; padding:2px 6px; border-radius:6px; display:inline-block; margin-top:4px; cursor:help;" title="${groupTitle}">${gIcon}</div>` : '';
                  
                  const periods = sMap[d.dateStr]?.[fId] || {};
                  const periodCellsHtml = Array.from({ length: this.maxPeriod }).map((_, i) => {
                      const p = i + 1; const pObj = periods[p] || {}; let content = '';
                      if (pObj.subject && pObj.subject.toUpperCase() !== 'X') content += `<div style="margin-bottom: 4px; font-weight:bold; color:#0f172a;"><span class="badge-tag">${pObj.subject}</span></div>`;
                      if (pObj.memo) content += `<div class="clean-cell-memo" style="font-size:0.95rem; color:#334155; white-space:pre-wrap;">${pObj.memo}</div>`;
                      if (pObj.supplies) content += `<div style="margin-top:4px; font-size:0.85rem; color:#b91c1c; font-weight:bold; background:#fef2f2; padding:2px 4px; border-radius:4px; white-space:pre-wrap;">${pObj.supplies}</div>`;
                      return `<td style="vertical-align: top; text-align: left; padding: 8px; height: var(--week-cell-height); border: 1px solid #cbd5e1;">${content}</td>`;
                  }).join('');

                  rowsHtmlForDate += `
                  <tr data-week-schedule-date="${d.dateStr}" data-fid="${fId}" class="week-row-${d.dateStr}">
                    <td style="padding:4px; border:1px solid #cbd5e1; background:#ecfdf5; color:#047857; font-weight:bold; font-size:0.9rem; vertical-align:middle; text-align:center; position: static !important; z-index: auto !important; transform: none !important;">수업${badgeHtml}</td>
                    ${periodCellsHtml}
                  </tr>`;
              });
          }
          return rowsHtmlForDate;
      }).join('');

      let headerBanner = this.isInfiniteMode ? `<tr class="month-separator"><td colspan="${this.maxPeriod + 2}" style="padding:10px; background:#f8fafc; color:#475569; font-size:1rem; font-weight:900; text-align:center; border:1px dashed #cbd5e1;">${this.getWeekTitle(startOfWeekStr)}</td></tr>` : '';
      return `<tbody class="week-chunk" data-date="${startOfWeekStr}">${headerBanner}${rowsHtml}</tbody>`;
  }

  async buildEditorChunk(baseDateStr) {
      const { eMap, sMap, jMap, vMap, weekDates } = await this.fetchWeekData(baseDateStr);
      const realTodayStr = formatDate(new Date());
      const filters = window.activeUnifiedFilters || ['personal'];
      const filterCount = filters.length;
      const totalRows = filterCount + (store.showClass ? 1 + filterCount : 0);
      const startOfWeekStr = weekDates[0].dateStr;

      const maxP = store.periodNames ? store.periodNames.length : 6;

      const rowsHtml = weekDates.map(d => {
          if (!this.renderedDateStrings.includes(d.dateStr)) this.renderedDateStrings.push(d.dateStr);
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
                          const match = getEventLabels().find(l => l.name === name);
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
          
          const holidayHtml = holidayName ? `<span style="font-size:0.75rem; color:#ef4444; font-weight:bold; margin-top:2px;">${holidayName}</span>` : '';
          const todayClass = isToday ? 'week-today-cell' : '';

          let rowsHtmlForDate = '';

          filters.forEach((fId, idx) => {
              const isPersonal = fId === 'personal';
              const gIcon = isPersonal ? '🔒' : '👥'; 
              const badgeColor = isPersonal ? '#2563eb' : '#059669';
              const badgeBg = isPersonal ? '#eff6ff' : '#ecfdf5';
              const groupTitle = isPersonal ? '개인' : (this.myGroups.find(g => g.id === fId)?.name || '그룹');
              const badgeHtml = filterCount > 1 ? `<div style="font-size:1.1rem; color:${badgeColor}; background:${badgeBg}; padding:2px 6px; border-radius:6px; display:inline-block; margin-top:4px; cursor:help;" title="${groupTitle}">${gIcon}</div>` : '';

              let eventContent = `<div id="compact-events-${d.dateStr}-${fId}" style="display:flex; flex-direction:column; gap:4px;">${CompactEventHelper.generateCompactEventEditor(d.dateStr, fId)}</div>`;
              
              if (idx === 0) {
                  rowsHtmlForDate += `
                  <tr data-week-date="${d.dateStr}" class="week-row-${d.dateStr}">
                    <td rowspan="${totalRows}" class="${todayClass}" style="width: 70px; vertical-align: middle; text-align: center; padding: 8px 4px; border: 1px solid #cbd5e1; position: static !important; z-index: auto !important; transform: none !important;">
                      <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
                        <span onclick="window.goToDay('${d.dateStr}')" style="font-size:1.2rem; font-weight:900; color:${dateNumColor}; line-height:1.1; cursor: pointer;" title="${d.dateStr} 일 보기로 이동">${d.dateDisplay}</span>
                        <span style="font-size:0.95rem; font-weight:600; color:${dateColor}; line-height:1;">${d.day}</span>
                        ${holidayHtml}
                      </div>
                    </td>
                    <td style="padding:4px; border:1px solid #cbd5e1; background:#f0f9ff; color:#0369a1; font-weight:bold; font-size:0.9rem; vertical-align:middle; width:60px; text-align:center;">일정${badgeHtml}</td>
                    <td colspan="${maxP}" style="text-align: left; padding: 6px 10px; background: #f0f9ff; vertical-align:top; border:1px solid #cbd5e1;">${eventContent}</td>
                  </tr>`;
              } else {
                  rowsHtmlForDate += `
                  <tr class="week-row-${d.dateStr}">
                    <td style="padding:4px; border:1px solid #cbd5e1; background:#f0f9ff; color:#0369a1; font-weight:bold; font-size:0.9rem; vertical-align:middle; width:60px; text-align:center;">일정${badgeHtml}</td>
                    <td colspan="${maxP}" style="text-align: left; padding: 6px 10px; background: #f0f9ff; vertical-align:top; border:1px solid #cbd5e1;">${eventContent}</td>
                  </tr>`;
              }
          });

          if (store.showClass) {
              const pNamesHtml = (store.periodNames || ["1","2","3","4","5","6"]).map(name => `<td style="font-weight: bold; background: #f8fafc; color: #334155; width: ${100 / maxP}%; text-align: center; border: 1px solid #cbd5e1; position: static !important; z-index: auto !important; transform: none !important;">${name}</td>`).join('');
              
              rowsHtmlForDate += `<tr class="week-row-${d.dateStr}"><td style="font-weight: bold; background: #f1f5f9; color: #475569; vertical-align: middle; text-align: center; border: 1px solid #cbd5e1; position: static !important; z-index: auto !important; transform: none !important;">교시</td>${pNamesHtml}</tr>`;

              filters.forEach((fId) => {
                  const isPersonal = fId === 'personal';
                  const gIcon = isPersonal ? '🔒' : '👥'; 
                  const badgeColor = isPersonal ? '#2563eb' : '#059669';
                  const badgeBg = isPersonal ? '#eff6ff' : '#ecfdf5';
                  const groupTitle = isPersonal ? '개인' : (this.myGroups.find(g => g.id === fId)?.name || '그룹');
                  const badgeHtml = filterCount > 1 ? `<div style="font-size:1.1rem; color:${badgeColor}; background:${badgeBg}; padding:2px 6px; border-radius:6px; display:inline-block; margin-top:4px; cursor:help;" title="${groupTitle}">${gIcon}</div>` : '';
                  
                  const periods = window[`tempSchedules_${d.dateStr}`][fId];
                  const periodCellsHtml = Array.from({ length: maxP }).map((_, i) => {
                      const p = i + 1; const pObj = periods[p] || {}; let cellText = "";
                      if (pObj.subject && pObj.subject.toUpperCase() !== 'X') cellText += `[${pObj.subject}] `;
                      if (pObj.memo) cellText += pObj.memo + " ";
                      if (pObj.supplies) cellText += `[${pObj.supplies}]`;
                      return `<td class="editable-cell week-period-cell" data-p="${p}" data-fid="${fId}" contenteditable="true" style="vertical-align: top; height: var(--week-cell-height); text-align: left; padding: 6px 8px; white-space: pre-wrap; border:1px solid #cbd5e1; font-size:1rem; color:#047857; background:#ecfdf5;" oninput="window.weekViewInstance.syncScheduleInputs()">${cellText.trim()}</td>`;
                  }).join('');

                  rowsHtmlForDate += `
                  <tr data-week-schedule-date="${d.dateStr}" data-fid="${fId}" class="week-row-${d.dateStr}">
                    <td style="padding:4px; border:1px solid #cbd5e1; background:#ecfdf5; color:#047857; font-weight:bold; font-size:0.9rem; vertical-align:middle; text-align:center; position: static !important; z-index: auto !important; transform: none !important;">수업${badgeHtml}</td>
                    ${periodCellsHtml}
                  </tr>`;
              });
          }
          return rowsHtmlForDate;
      }).join('');

      let headerBanner = this.isInfiniteMode ? `<tr class="month-separator"><td colspan="${maxP + 2}" style="padding:10px; background:#f8fafc; color:#475569; font-size:1rem; font-weight:900; text-align:center; border:1px dashed #cbd5e1;">${this.getWeekTitle(startOfWeekStr)}</td></tr>` : '';
      return `<tbody class="week-chunk" data-date="${startOfWeekStr}">${headerBanner}${rowsHtml}</tbody>`;
  }

  async renderViewer() {
    this.isRendering = true;
    this.renderId = Date.now(); 
    try {
        this.showLoading('클라우드에서 주간 데이터를 불러오는 중...'); 
        this.injectInfiniteToggleBtn();
        window.currentMyGroups = await dbAPI.loadMyGroups().catch(() => []);
        this.myGroups = window.currentMyGroups;
        if (!window.activeUnifiedFilters) window.activeUnifiedFilters = ['personal', ...this.myGroups.map(g => g.id)];
        if (window.FilterUI) window.FilterUI.renderUnifiedFilter(this.myGroups);

        const maxP = store.periodNames ? store.periodNames.length : 6;
        const colgroupHtml = `<colgroup><col style="width: 70px;"><col style="width: 50px;">${Array.from({length: maxP}).map(() => `<col>`).join('')}</colgroup>`;

        if (this.isInfiniteMode) {
            const tempDateStr = formatDate(store.currentDate);
            const startOfWeekStr = this.getWeekDates(tempDateStr)[0].dateStr;
            this.renderedDateStrings = [];
            this.loadedWeeks = [{ dateStr: startOfWeekStr }];
            
            const chunkHtml = await this.buildViewerChunk(startOfWeekStr);
            this.container.innerHTML = `
                <div id="week-top-sentinel" style="height:20px; width:100%;"></div>
                <div class="clean-viewer-board" style="overflow: visible; margin-top: 15px;">
                    <table style="width:100%; border-collapse:collapse; text-align:center; table-layout:fixed;" id="infinite-viewer-container">
                        ${colgroupHtml}
                        ${chunkHtml}
                    </table>
                </div>
                <div id="week-bottom-sentinel" style="height:20px; width:100%;"></div>
            `;
            this.setupInfiniteObserver('viewer');
            this.setupChunkObserver();
        } else {
            const startOfWeekStr = this.getWeekDates()[0].dateStr;
            const chunkHtml = await this.buildViewerChunk(startOfWeekStr);
            this.container.innerHTML = `
                <div class="clean-viewer-board" style="overflow: visible; margin-top: 15px;">
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
        this.showLoading('편집 화면을 준비 중...');
        this.injectInfiniteToggleBtn();
        window.currentMyGroups = await dbAPI.loadMyGroups().catch(() => []);
        this.myGroups = window.currentMyGroups;
        if (!window.activeUnifiedFilters) window.activeUnifiedFilters = ['personal', ...this.myGroups.map(g => g.id)];
        if (window.FilterUI) window.FilterUI.renderUnifiedFilter(this.myGroups);

        const maxP = store.periodNames ? store.periodNames.length : 6;
        const colgroupHtml = `<colgroup><col style="width: 110px;"><col style="width: 60px;">${Array.from({length: maxP}).map(() => `<col>`).join('')}</colgroup>`;
        const headerTr = `<tr style="background:#f1f5f9;"><th style="padding:8px; border:1px solid #cbd5e1; font-weight:bold; color:#1e293b; background:#f1f5f9;">날짜</th><th style="padding:8px; border:1px solid #cbd5e1; font-weight:bold; color:#1e293b; background:#f1f5f9;">구분</th><th colspan="${maxP}" style="padding:8px; border:1px solid #cbd5e1; font-weight:bold; color:#1e293b; background:#f1f5f9;">📌 내용 (직접 수정)</th></tr>`;

        this.renderedDateStrings = [];

        if (this.isInfiniteMode) {
            const tempDateStr = formatDate(store.currentDate);
            const startOfWeekStr = this.getWeekDates(tempDateStr)[0].dateStr;
            this.loadedWeeks = [{ dateStr: startOfWeekStr }];
            const chunkHtml = await this.buildEditorChunk(startOfWeekStr);
            
            this.container.innerHTML = `
              <div id="week-top-sentinel" style="height:20px; width:100%;"></div>
              <div class="table-container" style="background:#fff; padding:12px; border-radius:8px; overflow:visible;">
                <table id="week-editor-table" style="width:100%; border-collapse:collapse; text-align:center; table-layout:fixed;">
                  ${colgroupHtml}
                  <thead style="position: sticky; top: 0; z-index: 100; box-shadow: 0 2px 4px rgba(0,0,0,0.1); background: #fff;">${headerTr}</thead>
                  <tbody id="infinite-editor-container" style="display:contents;">${chunkHtml}</tbody>
                </table>
              </div>
              <div id="week-bottom-sentinel" style="height:20px; width:100%;"></div>`;
            this.setupInfiniteObserver('editor');
            this.setupChunkObserver();
        } else {
            const startOfWeekStr = this.getWeekDates()[0].dateStr;
            const chunkHtml = await this.buildEditorChunk(startOfWeekStr);
            this.container.innerHTML = `
              <div class="table-container" style="background:#fff; padding:12px; border-radius:8px; overflow:visible; margin-top: 15px;">
                <table id="week-editor-table" style="width:100%; border-collapse:collapse; text-align:center; table-layout:fixed;">
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
      if (this.renderedDateStrings) this.renderedDateStrings.forEach(dateStr => this.syncCompactEventInputs(dateStr));
  }
  syncScheduleInputs() { CompactEventHelper.syncScheduleInputs('data-week-schedule-date', 'week-period-cell'); }

  async save() {
    if (this.isRendering) return; 
    this.syncScheduleInputs();
    this.syncAllCompactEventInputs(); 
    
    const datesToSave = this.renderedDateStrings || [];
    const snapshot = datesToSave.map(dateStr => {
        const validEvents = (window[`tempEvents_${dateStr}`] || [])
            .filter(e => e.content?.trim() || e.labelIds?.length > 0)
            .map(e => ({
                ...e, 
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

const instance = new WeekView(document.getElementById("main-view"));

Object.assign(window, {
    weekViewInstance: instance,
    renderWeekViewer: (c) => { instance.container = c; instance.renderViewer(); },
    renderWeekEditor: (c) => { instance.container = c; instance.renderEditor(); },
    saveWeekDataFromEditor: () => instance.save()
});
>>>>>>> d1348ae5447b87f69a849130f4f6a30f4c5cc4fe
