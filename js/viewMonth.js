// js/viewMonth.js

import { BaseView } from './components/BaseView.js';
import { store } from './core/store.js';
import { formatDate, getEventLabels, isRedDay, getHolidayName } from './core/utils.js';
import { dbAPI, getUserCol } from './firebase.js';
import { generateEventBadgesHTML, formatEventListToText } from './core/eventUtils.js';

export class MonthView extends BaseView {
  constructor(container) {
    super(container); 
  }

  static setupGoToDay() {
    if (!window.goToDay) {
      window.goToDay = function(dateStr) {
        if (!dateStr) return;
        const parts = dateStr.split('-');
        if (parts.length === 3) {
          store.currentDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
          window.setScope('day');
        }
      };
    }
  }

  async renderViewer() {
    this.showLoading('클라우드에서 월간 일정을 불러오는 중...'); 

    if (!window.db) return;

    let html = `<div class="calendar-grid" style="grid-template-columns: repeat(${this.isWeekendVisible ? 7 : 5}, 1fr);">`;
    
    const days = this.isWeekendVisible ? ['일','월','화','수','목','금','토'] : ['월','화','수','목','금'];
    days.forEach(d => {
      let colorStyle = '';
      if (d === '일') colorStyle = 'color:#ef4444;';
      else if (d === '토') colorStyle = 'color:#3b82f6;';
      html += `<div class="cal-header" style="${colorStyle}">${d}</div>`;
    });
    
    const y = this.currentDate.getFullYear();
    const m = this.currentDate.getMonth();
    const firstDay = new Date(y, m, 1).getDay(); 
    const lastDate = new Date(y, m + 1, 0).getDate(); 
    
    let padding = 0;
    if (this.isWeekendVisible) { padding = firstDay; } 
    else { if (firstDay >= 1 && firstDay <= 5) padding = firstDay - 1; }
    
    for(let i=0; i<padding; i++) {
      html += `<div class="cal-day" style="background:#f8fafc;"></div>`;
    }

    // [최적화] 시작일과 종료일 계산 후 범위 쿼리로 한 번에 가져오기
    const startStr = `${y}-${String(m+1).padStart(2, '0')}-01`;
    const endStr = `${y}-${String(m+1).padStart(2, '0')}-${String(lastDate).padStart(2, '0')}`;

    const [eventsSnap, schedulesSnap] = await Promise.all([
      getUserCol('events').where(firebase.firestore.FieldPath.documentId(), '>=', startStr)
                          .where(firebase.firestore.FieldPath.documentId(), '<=', endStr).get(),
      getUserCol('schedules').where(firebase.firestore.FieldPath.documentId(), '>=', startStr)
                             .where(firebase.firestore.FieldPath.documentId(), '<=', endStr).get()
    ]);

    const eventsMap = {};
    eventsSnap.forEach(doc => { eventsMap[doc.id] = doc.data(); });
    
    let scheduleMap = {};
    schedulesSnap.forEach(doc => { scheduleMap[doc.id] = doc.data().periods || {}; });

    const monthData = [];
    for(let i=1; i<=lastDate; i++) {
      const dateStr = `${y}-${String(m+1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      monthData.push({
        day: i, dateStr, eventData: eventsMap[dateStr] || {}
      });
    }

    const realTodayStr = formatDate(new Date());

    monthData.forEach(item => {
      const d = item.day;
      const dateStr = item.dateStr;
      
      let eventHtml = '';
      let finalEvents = item.eventData.eventList || [];
      let processedEvents = []; 
      
      if (finalEvents.length > 0) {
        processedEvents = finalEvents.map(e => ({ ...e, labelIds: e.labelIds || [] }));
        eventHtml = generateEventBadgesHTML(processedEvents, dateStr, 'compact');
      }
      
      const dateObj = new Date(y, m, d);
      const dayOfWeekNum = dateObj.getDay();
      
      if (!this.isWeekendVisible && (dayOfWeekNum === 0 || dayOfWeekNum === 6)) return;

      const dayPeriods = scheduleMap[dateStr] || {};
      let boxesHtml = '';
      let hasClass = false;

      for (let p = 1; p <= this.maxPeriod; p++) {
        const subject = dayPeriods[p] ? dayPeriods[p].subject : null;
        if (subject && subject.trim() !== '' && subject.toUpperCase() !== 'X') {
          const text = subject.trim();
          let fontSize = "0.75rem"; let letterSpacing = "normal";
          if (text.length === 3) { fontSize = "0.65rem"; letterSpacing = "-0.5px"; } 
          else if (text.length === 4) { fontSize = "0.55rem"; letterSpacing = "-1px"; } 
          else if (text.length >= 5) { fontSize = "0.45rem"; letterSpacing = "-1.5px"; }

          boxesHtml += `<div style="display:flex; align-items:center; justify-content:center; flex:1; min-width:0; height:22px; box-sizing:border-box; border:1px solid #6ee7b7; border-radius:4px; background:#ecfdf5; color:#047857; font-size:${fontSize}; font-weight:700; letter-spacing:${letterSpacing}; white-space:nowrap; overflow:hidden;" title="메모: ${dayPeriods[p].memo || '없음'}, 비고: ${dayPeriods[p].supplies || '없음'}">${text}</div>`;
          hasClass = true;
        } else {
          boxesHtml += `<div style="display:flex; align-items:center; justify-content:center; flex:1; min-width:0; height:22px; box-sizing:border-box; border:1px solid #e2e8f0; border-radius:4px; background:#f8fafc; color:#94a3b8; font-size:0.75rem; font-weight:700;">&nbsp;</div>`;
        }
      }

      let scheduleHtml = (hasClass && store.showClass) ? `<div style="display:flex; flex-wrap:nowrap; gap:2px; margin-top:4px; margin-bottom:4px; width:100%;">${boxesHtml}</div>` : '';

      let dateColor = '#334155';
      const holidayName = getHolidayName(dateStr);
      
      if (isRedDay(dateStr, processedEvents)) {
          dateColor = '#ef4444';
      } else if (dayOfWeekNum === 6) {
          dateColor = '#3b82f6';
      }

      const holidayHtml = holidayName ? `<div style="font-size:0.65rem; color:#ef4444; margin-top:1px; line-height:1;">${holidayName}</div>` : '';

      let dayNumHtml = `<div style="font-weight:700; color:${dateColor}; font-size:1.1rem; display:inline-block; cursor:pointer;" onclick="window.goToDay('${dateStr}')" title="${dateStr} 일 보기로 이동">${d}${holidayHtml}</div>`;
      let finalEventOutput = eventHtml ? `<div style="margin-top:4px;">${eventHtml}</div>` : '';
      const todayClass = (dateStr === realTodayStr) ? 'month-today-cell' : '';

      html += `<div class="cal-day ${todayClass}">${dayNumHtml}${scheduleHtml}${finalEventOutput}</div>`;
    });

    html += `</div>`;
    this.container.innerHTML = html;
  }

  async renderEditor() {
    this.showLoading('월간 편집 시트를 불러오는 중...');

    if (!window.db) return;

    const y = this.currentDate.getFullYear();
    const m = this.currentDate.getMonth();
    const lastDate = new Date(y, m + 1, 0).getDate();

    // [최적화] 62번의 개별 Read 요청을 단 2번의 일괄 범위 쿼리로 대체
    const startStr = `${y}-${String(m+1).padStart(2, '0')}-01`;
    const endStr = `${y}-${String(m+1).padStart(2, '0')}-${String(lastDate).padStart(2, '0')}`;

    const [eventsSnap, schedulesSnap] = await Promise.all([
      getUserCol('events').where(firebase.firestore.FieldPath.documentId(), '>=', startStr)
                          .where(firebase.firestore.FieldPath.documentId(), '<=', endStr).get(),
      getUserCol('schedules').where(firebase.firestore.FieldPath.documentId(), '>=', startStr)
                             .where(firebase.firestore.FieldPath.documentId(), '<=', endStr).get()
    ]);

    const eventsMap = {};
    eventsSnap.forEach(doc => { eventsMap[doc.id] = doc.data(); });
    
    const scheduleMap = {};
    schedulesSnap.forEach(doc => { scheduleMap[doc.id] = doc.data().periods || {}; });

    const monthData = [];
    for(let i=1; i<=lastDate; i++) {
      const dateStr = `${y}-${String(m+1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      monthData.push({
        day: i, 
        dateStr, 
        data: { periods: scheduleMap[dateStr] || {} }, 
        eventData: eventsMap[dateStr] || {}
      });
    }
	
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

    let html = `
      <div class="table-container" style="background:#fff; padding:12px; border-radius:8px;">
        <h3 style="margin-bottom:12px; color:#1e293b; font-size:var(--font-header-title);">📅 ${y}년 ${m+1}월 일정/수업 편집 시트</h3>
        <table style="width:100%; border-collapse:collapse; text-align:center;">
          <thead>
            <tr style="background:#f1f5f9;">
              <th style="width:80px; padding:8px; border:1px solid #cbd5e1;">날짜</th>
              <th style="width:60px; padding:8px; border:1px solid #cbd5e1;">구분</th>
              <th colspan="${this.maxPeriod}" style="padding:8px; border:1px solid #cbd5e1;">📌 내용 (직접 수정)</th>
            </tr>
          </thead>
          <tbody>
    `;

    monthData.forEach(item => {
      const parts = item.dateStr.split('-');
      const dayNum = parseInt(parts[2], 10);
      const dateObj = new Date(y, m, dayNum);
      const dayOfWeekNum = dateObj.getDay();
      const dayOfWeek = dayNames[dayOfWeekNum];

      if (!this.isWeekendVisible && (dayOfWeekNum === 0 || dayOfWeekNum === 6)) return;

      let eventList = item.eventData.eventList || [];
      const masterLabels = getEventLabels(); 

      window[`tempEvents_${item.dateStr}`] = eventList.map(e => {
          let labelIds = e.labelIds || [];
          if (labelIds.length === 0 && (e.labels || e.label)) {
              let legacyNames = e.labels || [e.label];
              legacyNames.forEach(name => {
                  const match = masterLabels.find(l => l.name === name);
                  if (match && match.id && !labelIds.includes(match.id)) labelIds.push(match.id);
              });
          }
          return { ...e, labelIds: labelIds };
      });
      window[`tempSchedules_${item.dateStr}`] = item.data.periods || {};
      
      let compactEditorHtml = `<div id="compact-events-${item.dateStr}" style="display:flex; flex-direction:column; gap:4px;">`;
      compactEditorHtml += window.weekViewInstance ? window.weekViewInstance.generateCompactEventEditor(item.dateStr) : window.generateCompactEventEditor(item.dateStr); 
      compactEditorHtml += `</div>`; 

      const periods = window[`tempSchedules_${item.dateStr}`];

      let dateColor = '#1e40af';
      let dateNumColor = '#475569'; 
      const holidayName = getHolidayName(item.dateStr);
      
      if (isRedDay(item.dateStr, window[`tempEvents_${item.dateStr}`])) {
          dateColor = '#ef4444';
          dateNumColor = '#ef4444'; 
      } else if (dayOfWeekNum === 6) {
          dateColor = '#3b82f6';
          dateNumColor = '#3b82f6';
      }

      const holidayHtml = holidayName ? `<span style="font-size:0.75rem; color:#ef4444; font-weight:bold; margin-top:2px;">${holidayName}</span>` : '';

      html += `<tr data-month-date="${item.dateStr}">` +
        `<td rowspan="${store.showClass ? 2 : 1}" style="padding:8px 4px; border:1px solid #cbd5e1; background:#f8fafc; vertical-align:middle; width:80px;">` +
          `<div style="display:flex; flex-direction:column; align-items:center; gap:4px;">` +
            `<span onclick="window.goToDay('${item.dateStr}')" style="font-size:1.8rem; font-weight:900; color:${dateNumColor}; line-height:1; cursor:pointer;" title="${item.dateStr} 일 보기로 이동">${dayNum}</span>` +
            `<span style="font-size:1rem; font-weight:600; color:${dateColor}; line-height:1;">${dayOfWeek}</span>` +
            `${holidayHtml}` +
          `</div>` +
        `</td>` +
        `<td style="padding:4px; border:1px solid #cbd5e1; background:#f0f9ff; color:#0369a1; font-weight:bold; font-size:0.9rem; vertical-align:middle; width:60px; text-align:center;">` +
            `일정<br>` +
            `<button onclick="window.weekViewInstance ? window.weekViewInstance.addCompactEvent('${item.dateStr}') : window.addCompactEvent('${item.dateStr}')" style="margin-top:6px; background:#e0f2fe; color:#0369a1; border:1px dashed #7dd3fc; border-radius:4px; padding:2px 8px; cursor:pointer; font-weight:bold; font-size:1.1rem; box-shadow:0 1px 2px rgba(0,0,0,0.05);" title="일정 추가">+</button>` +
        `</td>` +
        `<td colspan="${this.maxPeriod}" style="text-align:left; padding:6px 10px; background:#f0f9ff; vertical-align:top;">${compactEditorHtml}</td>` +
      `</tr>` +
      `<tr data-month-sub="${item.dateStr}" style="${store.showClass ? '' : 'display:none;'}">` +
        `<td style="padding:4px; border:1px solid #cbd5e1; background:#ecfdf5; color:#047857; font-weight:bold; font-size:0.9rem; vertical-align:middle; width:60px;">수업</td>`;
        
        for(let p=1; p<=this.maxPeriod; p++) {
           const pObj = periods[p] || {};
           
           let cellText = "";
           if (pObj.subject && pObj.subject.toUpperCase() !== 'X') cellText += `[${pObj.subject}] `;
           if (pObj.memo) cellText += pObj.memo + " ";
           if (pObj.supplies) cellText += `[${pObj.supplies}]`;
           
           html += `<td class="editable-cell edit-class-cell" data-p="${p}" contenteditable="true" style="padding:6px; border:1px solid #cbd5e1; font-size:1rem; color:#047857; background:#ecfdf5; vertical-align:top; white-space:pre-wrap; text-align:left;" oninput="window.monthViewInstance.syncScheduleInputs()">${cellText.trim()}</td>`;
        }
        
      html += `</tr>`;
    });

    html += `</tbody></table></div>`;
    this.container.innerHTML = html;
  }

  syncScheduleInputs() {
      const scheduleRows = document.querySelectorAll(`tr[data-month-sub]`);
      scheduleRows.forEach(row => {
          const dateStr = row.getAttribute('data-month-sub');
          const classCells = row.querySelectorAll('.edit-class-cell');
          
          if (!window[`tempSchedules_${dateStr}`]) {
              window[`tempSchedules_${dateStr}`] = {};
          }

          classCells.forEach(cell => {
              const p = cell.getAttribute("data-p");
              let text = (cell.innerText || cell.textContent || "").trim();
              
              let subject = '', memo = '', supplies = '';

              if (text !== '') {
                  const lastMatch = text.match(/\[([^\]]+)\]\s*$/);
                  const allBrackets = text.match(/\[.*?\]/g);
                  if (allBrackets && allBrackets.length >= 2) {
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

              let subjText = (subject.toUpperCase() === 'X') ? '' : subject;
              window[`tempSchedules_${dateStr}`][p] = { subject: subjText, memo: memo, supplies: supplies };
          });
      });
  }

  toggleCompactEventLabel(dateStr, idx, labelId) {
      if(window.weekViewInstance) window.weekViewInstance.toggleCompactEventLabel(dateStr, idx, labelId);
  }
  updateCompactEvent(dateStr, idx, field, value) {
      if(window.weekViewInstance) window.weekViewInstance.updateCompactEvent(dateStr, idx, field, value);
  }
  
  requestRemoveCompactEvent(dateStr, idx) {
      if(window.weekViewInstance) {
          window.weekViewInstance.requestRemoveCompactEvent(dateStr, idx);
      } else {
          const ev = window[`tempEvents_${dateStr}`][idx];
          const isGrouped = !!ev.groupId;
          const labelObjs = getEventLabels();
          const forwardLabelId = (ev.labelIds || []).find(id => {
              const match = labelObjs.find(l => l.id === id);
              return match && match.isForward;
          });
          const forwardLabelName = forwardLabelId ? labelObjs.find(l=>l.id===forwardLabelId).name : '';

          if (isGrouped) {
              window.showGroupDeleteModal(dateStr, ev.labelIds[0]||'', ev.content, ev.groupId, 
                  () => { window.render(); }, 
                  () => { this.removeCompactEvent(dateStr, idx); }
              );
          } else if (forwardLabelId && ev.forwardChainId) {
              window.showForwardDeleteModal(dateStr, forwardLabelName, ev.content, ev.forwardChainId, 
                  () => { window.render(); }
              );
          } else {
              this.removeCompactEvent(dateStr, idx);
          }
      }
  }
  removeCompactEvent(dateStr, idx) {
      if(window.weekViewInstance) {
          window.weekViewInstance.removeCompactEvent(dateStr, idx);
      } else {
          store.hasUnsavedChanges = true;
          window[`tempEvents_${dateStr}`].splice(idx, 1);
          window.render();
      }
  }

  save() {
    this.syncScheduleInputs(); 
    const y = this.currentDate.getFullYear();
    const m = this.currentDate.getMonth();
    const lastDate = new Date(y, m + 1, 0).getDate();

    const snapshot = [];
    for(let i=1; i<=lastDate; i++) {
        const dateStr = `${y}-${String(m+1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        const rawList = window[`tempEvents_${dateStr}`];
        if (rawList !== undefined) {
            const validEvents = rawList
                .filter(e => (e.content || '').trim() !== '' || (e.labelIds && e.labelIds.length > 0))
                .map(e => ({...e}));
            const periodsData = JSON.parse(JSON.stringify(window[`tempSchedules_${dateStr}`] || {}));
            snapshot.push({ dateStr, validEvents, periodsData });
        }
    }

    return (async () => {
        const masterLabels = getEventLabels();
        for (const item of snapshot) {
            const cleanEventText = formatEventListToText(item.validEvents);
            await getUserCol('events').doc(item.dateStr).set({
                eventList: item.validEvents,
                eventText: cleanEventText,
                updatedAt: Date.now()
            });

            let isSkipDay = false;
            for (const e of item.validEvents) {
                if (e.labelIds && e.labelIds.some(id => {
                    const match = masterLabels.find(l => l.id === id);
                    return match && match.isSkip;
                })) {
                    isSkipDay = true; break;
                }
            }

            if (isSkipDay) {
                for (const p in item.periodsData) { item.periodsData[p].subject = ''; }
            }

            await dbAPI.saveSchedule(item.dateStr, item.periodsData);
        }
    })();
  }
}

MonthView.setupGoToDay();

// ==========================================================================
// 🌉 과도기 호환성 레이어 
// ==========================================================================
window.monthViewInstance = new MonthView(document.getElementById("main-view"));
window.renderMonthViewer = (container) => { window.monthViewInstance.container = container; window.monthViewInstance.renderViewer(); };
window.renderMonthEditor = (container) => { window.monthViewInstance.container = container; window.monthViewInstance.renderEditor(); };
window.saveMonthDataFromEditor = () => window.monthViewInstance.save();
