// js/viewYear.js

import { BaseView } from './components/BaseView.js';
import { store } from './core/store.js';
import { formatDate, getEventLabels, isRedDay, getHolidayName } from './core/utils.js';
import { dbAPI, getUserCol } from './firebase.js';
import { generateEventBadgesHTML, formatEventListToText } from './core/eventUtils.js';

export class YearView extends BaseView {
  constructor(container) {
    super(container); 
  }

  async renderViewer() {
    this.showLoading('클라우드에서 연간 일정을 분석하여 불러오는 중...'); 

    if (!window.db) return;

    let allEvents = [];
    try {
      // [최적화] 전체 데이터 다운로드 방지 (해당 학년도만 가져오기)
      const targetY = this.currentDate ? this.currentDate.getFullYear() : new Date().getFullYear();
      const startStr = `${targetY}-03-01`;
      const febLastDay = new Date(targetY + 1, 2, 0).getDate();
      const endStr = `${targetY + 1}-02-${febLastDay}`;

      const [eventsSnap, schedulesSnap] = await Promise.all([
        getUserCol('events').where(firebase.firestore.FieldPath.documentId(), '>=', startStr)
                            .where(firebase.firestore.FieldPath.documentId(), '<=', endStr).get(),
        getUserCol('schedules').where(firebase.firestore.FieldPath.documentId(), '>=', startStr)
                               .where(firebase.firestore.FieldPath.documentId(), '<=', endStr).get()
      ]);
      
      const eMap = {};
      eventsSnap.forEach(doc => { eMap[doc.id] = doc.data(); });
      const sMap = {};
      schedulesSnap.forEach(doc => { sMap[doc.id] = doc.data().periods || {}; });

      const allDates = new Set([...Object.keys(eMap), ...Object.keys(sMap)]);

      allDates.forEach(dateStr => {
        let hasContent = false;
        let htmlOutput = '';
        let processedEvents = [];

        const dayPeriods = sMap[dateStr] || {};
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
        if (scheduleHtml) {
            htmlOutput += scheduleHtml;
            hasContent = true;
        }

        if (eMap[dateStr] && eMap[dateStr].eventList && eMap[dateStr].eventList.length > 0) {
          processedEvents = eMap[dateStr].eventList.map(e => ({ ...e, labelIds: e.labelIds || [] }));
          htmlOutput += generateEventBadgesHTML(processedEvents, dateStr, 'compact');
          hasContent = true;
        }
        
        if (hasContent) {
          allEvents.push({ dateStr: dateStr, htmlOutput: htmlOutput, events: processedEvents }); 
        }
      });
    } catch (error) {}

    allEvents.sort((a, b) => a.dateStr.localeCompare(b.dateStr));

    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const targetYear = this.currentDate ? this.currentDate.getFullYear() : new Date().getFullYear();
    const nextYear = targetYear + 1;

    const months = [
      { label: "3월", match: `${targetYear}-03-` }, { label: "4월", match: `${targetYear}-04-` },
      { label: "5월", match: `${targetYear}-05-` }, { label: "6월", match: `${targetYear}-06-` },
      { label: "7월", match: `${targetYear}-07-` }, { label: "8월", match: `${targetYear}-08-` },
      { label: "9월", match: `${targetYear}-09-` }, { label: "10월", match: `${targetYear}-10-` },
      { label: "11월", match: `${targetYear}-11-` }, { label: "12월", match: `${targetYear}-12-` },
      { label: "1월", match: `${nextYear}-01-` }, { label: "2월", match: `${nextYear}-02-` }
    ];

    let html = `<div class="year-grid">`;
    const realTodayStr = formatDate(new Date());

    months.forEach(mObj => {
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

      html += `
        <div class="mini-month ${cardClass}" style="display:flex; flex-direction:column; gap:8px;">
          <h3 style="color:#1e40af; border-bottom:2px solid #bfdbfe; padding-bottom:4px; text-align:center;">${mObj.label}</h3>
          <div style="line-height:1.4;">${eventListHtml}</div>
        </div>`;
    });

    html += `</div>`;
    this.container.innerHTML = html;
  }

  async renderEditor() {
    this.showLoading('연간 일정 편집 시트를 불러오는 중...'); 

    if (!window.db) return;

    const currentYear = this.currentDate ? this.currentDate.getFullYear() : new Date().getFullYear();
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

    // [최적화] 730번의 개별 호출을 2번의 범위 쿼리로 압축
    const startStr = `${currentYear}-03-01`;
    const nextYear = currentYear + 1;
    const febLastDay = new Date(nextYear, 2, 0).getDate();
    const endStr = `${nextYear}-02-${febLastDay}`;

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

    const yearData = [];
    // 3월 ~ 12월
    for (let month = 2; month <= 11; month++) {
      const year = currentYear;
      const lastDay = new Date(year, month + 1, 0).getDate();
      for (let d = 1; d <= lastDay; d++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        yearData.push({ year, month: month + 1, day: d, dateStr, data: { periods: scheduleMap[dateStr] || {} }, eventData: eventsMap[dateStr] || {} });
      }
    }
    // 1월 ~ 2월
    for (let month = 0; month <= 1; month++) {
      const year = currentYear + 1;
      const lastDay = new Date(year, month + 1, 0).getDate();
      for (let d = 1; d <= lastDay; d++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        yearData.push({ year, month: month + 1, day: d, dateStr, data: { periods: scheduleMap[dateStr] || {} }, eventData: eventsMap[dateStr] || {} });
      }
    }

    let html = `
      <div class="table-container" style="background:#fff; padding:12px; border-radius:8px;">
        <h3 style="margin-bottom:12px; color:#1e293b; font-size:var(--font-header-title);">📅 ${currentYear}학년도 연간 일정/수업 편집 시트</h3>
        <table style="width:100%; border-collapse:collapse; text-align:center;">
          <thead>
            <tr style="background:#f1f5f9;">
              <th style="width:110px; padding:8px; border:1px solid #cbd5e1;">날짜</th>
              <th style="width:60px; padding:8px; border:1px solid #cbd5e1;">구분</th>
              <th colspan="${this.maxPeriod}" style="padding:8px; border:1px solid #cbd5e1;">📌 내용 (직접 수정)</th>
            </tr>
          </thead>
          <tbody>
    `;

    this.renderedDateStrings = [];

    yearData.forEach(item => {
      const dateObj = new Date(item.year, item.month - 1, item.day);
      const dayOfWeekNum = dateObj.getDay();
      const dayOfWeek = dayNames[dayOfWeekNum];

      if (!this.isWeekendVisible && (dayOfWeekNum === 0 || dayOfWeekNum === 6)) return;

      this.renderedDateStrings.push(item.dateStr);

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
      
      if (isRedDay(item.dateStr, window[`tempEvents_${item.dateStr}`])) {
          dateColor = '#ef4444';
          dateNumColor = '#ef4444';
      } else if (dayOfWeekNum === 6) {
          dateColor = '#3b82f6';
          dateNumColor = '#3b82f6';
      }

      html += `<tr data-year-date="${item.dateStr}">` +
        `<td rowspan="${store.showClass ? 2 : 1}" style="padding:8px 4px; border:1px solid #cbd5e1; background:#f8fafc; vertical-align:middle; width:110px;">` +
          `<div style="display:flex; flex-direction:column; align-items:center; gap:4px;">` +
            `<span onclick="window.goToDay('${item.dateStr}')" style="font-size:1.2rem; font-weight:900; color:${dateNumColor}; line-height:1.1; cursor:pointer;" title="${item.dateStr} 일 보기로 이동">${item.month}월 ${item.day}일</span>` +
            `<span style="font-size:0.95rem; font-weight:600; color:${dateColor}; line-height:1;">${dayOfWeek}</span>` +
          `</div>` +
        `</td>` +
        `<td style="padding:4px; border:1px solid #cbd5e1; background:#f0f9ff; color:#0369a1; font-weight:bold; font-size:0.9rem; vertical-align:middle; width:60px;">` +
            `일정<br>` +
            `<button onclick="window.weekViewInstance ? window.weekViewInstance.addCompactEvent('${item.dateStr}') : window.addCompactEvent('${item.dateStr}')" style="margin-top:6px; background:#e0f2fe; color:#0369a1; border:1px dashed #7dd3fc; border-radius:4px; padding:2px 8px; cursor:pointer; font-weight:bold; font-size:1.1rem; box-shadow:0 1px 2px rgba(0,0,0,0.05);" title="일정 추가">+</button>` +
        `</td>` +
            `<td colspan="${this.maxPeriod}" style="text-align:left; padding:6px 10px; background:#f0f9ff; vertical-align:top;">${compactEditorHtml}</td>` +
      `</tr>` +
      `<tr data-year-sub="${item.dateStr}" style="${store.showClass ? '' : 'display:none;'}">` +
        `<td style="padding:4px; border:1px solid #cbd5e1; background:#ecfdf5; color:#047857; font-weight:bold; font-size:0.9rem; vertical-align:middle; width:60px;">수업</td>`;

        for (let p = 1; p <= this.maxPeriod; p++) {
           const pObj = periods[p] || {};
           
           let cellText = "";
           if (pObj.subject && pObj.subject.toUpperCase() !== 'X') cellText += `[${pObj.subject}] `;
           if (pObj.memo) cellText += pObj.memo + " ";
           if (pObj.supplies) cellText += `[${pObj.supplies}]`;
           
           html += `<td class="editable-cell edit-class-cell" data-p="${p}" contenteditable="true" style="padding:6px; border:1px solid #cbd5e1; font-size:1rem; color:#047857; background:#ecfdf5; vertical-align:top; white-space:pre-wrap; text-align:left;" oninput="window.yearViewInstance.syncScheduleInputs()">${cellText.trim()}</td>`;
        }

      html += `</tr>`;
    });

    html += `</tbody></table></div>`;
    this.container.innerHTML = html;
  }

  syncScheduleInputs() {
      const scheduleRows = document.querySelectorAll(`tr[data-year-sub]`);
      scheduleRows.forEach(row => {
          const dateStr = row.getAttribute('data-year-sub');
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

  save() {
    if (!this.renderedDateStrings) return Promise.resolve();
    this.syncScheduleInputs(); 

    const snapshot = [];
    for (const dateStr of this.renderedDateStrings) {
        const rawList = window[`tempEvents_${dateStr}`] || [];
        const validEvents = rawList
            .filter(e => (e.content || '').trim() !== '' || (e.labelIds && e.labelIds.length > 0))
            .map(e => ({...e}));
        const periodsData = JSON.parse(JSON.stringify(window[`tempSchedules_${dateStr}`] || {}));
        snapshot.push({ dateStr, validEvents, periodsData });
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

// ==========================================================================
// 🌉 과도기 호환성 레이어 
// ==========================================================================
window.yearViewInstance = new YearView(document.getElementById("main-view"));
window.renderYearViewer = (container) => { window.yearViewInstance.container = container; window.yearViewInstance.renderViewer(); };
window.renderYearEditor = (container) => { window.yearViewInstance.container = container; window.yearViewInstance.renderEditor(); };
window.saveYearDataFromEditor = () => window.yearViewInstance.save();
