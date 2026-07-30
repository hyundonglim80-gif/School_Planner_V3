// js/viewYear.js

class YearView extends window.BaseView {
  constructor(container) {
    super(container); // BaseView(부모) 상속
  }

  // ==========================================================================
  // 👁️ 1. 연간 뷰어 렌더링
  // ==========================================================================
  async renderViewer() {
    this.showLoading('클라우드에서 연간 일정을 분석하여 불러오는 중...'); // BaseView 상속 기능

    if (!window.db) return;

    let allEvents = [];
    try {
      const snapshot = await window.getUserCol('events').get();
      snapshot.forEach(doc => {
        const data = doc.data();
        let hasContent = false;
        let htmlOutput = '';

        if (data.eventList && data.eventList.length > 0) {
          htmlOutput = window.generateEventBadgesHTML(data.eventList);
          hasContent = true;
        } else if (data.eventText && data.eventText.trim() !== '') {
          const parsed = window.parseRawEventTextToEventList(data.eventText);
          htmlOutput = window.generateEventBadgesHTML(parsed);
          hasContent = true;
        }
        
        if (hasContent) {
          allEvents.push({ dateStr: doc.id, htmlOutput: htmlOutput });
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
    const realTodayStr = window.formatDate(new Date());

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

          return `<div onclick="window.goToDay('${e.dateStr}')" style="${eventStyle} cursor:pointer;" title="${e.dateStr} 일 보기로 이동">
                    <div style="color:#2563eb; font-weight:700;">${dayNum}일(${dayOfWeek})${isTodayEvent ? '🎯 오늘' : ''}</div>
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

  // ==========================================================================
  // ✏️ 2. 연간 에디터 렌더링
  // ==========================================================================
  async renderEditor() {
    this.showLoading('연간 일정 편집 시트를 불러오는 중...'); // BaseView 상속 기능

    if (!window.db) return;

    const currentYear = this.currentDate ? this.currentDate.getFullYear() : new Date().getFullYear();
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

    const dayPromises = [];
    for (let month = 2; month <= 11; month++) {
      const year = currentYear;
      const lastDay = new Date(year, month + 1, 0).getDate();
      for (let d = 1; d <= lastDay; d++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        dayPromises.push(Promise.all([
          window.dbAPI.loadDayData(dateStr),
          window.getUserCol('events').doc(dateStr).get()
        ]).then(([data, eventDoc]) => ({ year, month: month + 1, day: d, dateStr, data, eventData: eventDoc.exists ? eventDoc.data() : {} })));
      }
    }
    for (let month = 0; month <= 1; month++) {
      const year = currentYear + 1;
      const lastDay = new Date(year, month + 1, 0).getDate();
      for (let d = 1; d <= lastDay; d++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        dayPromises.push(Promise.all([
          window.dbAPI.loadDayData(dateStr),
          window.getUserCol('events').doc(dateStr).get()
        ]).then(([data, eventDoc]) => ({ year, month: month + 1, day: d, dateStr, data, eventData: eventDoc.exists ? eventDoc.data() : {} })));
      }
    }

    const yearData = await Promise.all(dayPromises);

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

    yearData.forEach(item => {
      const dateObj = new Date(item.year, item.month - 1, item.day);
      const dayOfWeekNum = dateObj.getDay();
      const dayOfWeek = dayNames[dayOfWeekNum];

      if (!this.isWeekendVisible && (dayOfWeekNum === 0 || dayOfWeekNum === 6)) return;

      let eventList = [];
      if (item.eventData.eventList && item.eventData.eventList.length > 0) {
        eventList = item.eventData.eventList;
      } else if (item.eventData.eventText) {
        eventList = window.parseRawEventTextToEventList(item.eventData.eventText);
      }
      
      window[`tempEvents_${item.dateStr}`] = eventList;
      
      let compactEditorHtml = `<div id="compact-events-${item.dateStr}" style="display:flex; flex-direction:column; gap:4px;">`;
      compactEditorHtml += window.weekViewInstance ? window.weekViewInstance.generateCompactEventEditor(item.dateStr) : window.generateCompactEventEditor(item.dateStr); 
      compactEditorHtml += `</div>`; 

      const periods = item.data.periods || {};

      let dateColor = '#1e40af';
      if (dayOfWeekNum === 0) dateColor = '#ef4444';
      else if (dayOfWeekNum === 6) dateColor = '#3b82f6';

      html += `<tr data-year-date="${item.dateStr}">` +
        `<td rowspan="${window.showClass ? 2 : 1}" onclick="window.goToDay('${item.dateStr}')" style="padding:8px 4px; border:1px solid #cbd5e1; background:#f8fafc; vertical-align:middle; width:110px; cursor:pointer;" title="${item.dateStr} 일 보기로 이동">` +
          `<div style="display:flex; flex-direction:column; align-items:center; gap:4px;">` +
            `<span style="font-size:1.2rem; font-weight:900; color:${dateColor}; line-height:1.1;">${item.month}월 ${item.day}일</span>` +
            `<span style="font-size:0.95rem; font-weight:600; color:${dateColor}; line-height:1;">${dayOfWeek}</span>` +
          `</div>` +
        `</td>` +
        `<td style="padding:4px; border:1px solid #cbd5e1; background:#f0f9ff; color:#0369a1; font-weight:bold; font-size:0.9rem; vertical-align:middle; width:60px;">` +
            `일정<br>` +
            `<button onclick="window.weekViewInstance ? window.weekViewInstance.addCompactEvent('${item.dateStr}') : window.addCompactEvent('${item.dateStr}')" style="margin-top:6px; background:#e0f2fe; color:#0369a1; border:1px dashed #7dd3fc; border-radius:4px; padding:2px 8px; cursor:pointer; font-weight:bold; font-size:1.1rem; box-shadow:0 1px 2px rgba(0,0,0,0.05);" title="일정 추가">+</button>` +
        `</td>` +
            `<td colspan="${this.maxPeriod}" style="text-align:left; padding:6px 10px; background:#f0f9ff; vertical-align:top;">${compactEditorHtml}</td>` +
      `</tr>` +
      `<tr data-year-sub="${item.dateStr}" style="${window.showClass ? '' : 'display:none;'}">` +
        `<td style="padding:4px; border:1px solid #cbd5e1; background:#ecfdf5; color:#047857; font-weight:bold; font-size:0.9rem; vertical-align:middle; width:60px;">수업</td>`;

        for (let p = 1; p <= this.maxPeriod; p++) {
           const subjText = periods[p] && periods[p].subject && periods[p].subject.toUpperCase() !== 'X' ? periods[p].subject.trim() : '';
           html += `<td class="editable-cell edit-class-cell" data-p="${p}" contenteditable="true" style="padding:6px; border:1px solid #cbd5e1; font-size:1rem; color:#047857; background:#ecfdf5; vertical-align:middle;">${subjText}</td>`;
        }

      html += `</tr>`;
    });

    html += `</tbody></table></div>`;
    this.container.innerHTML = html;
  }

  // ==========================================================================
  // 💾 3. 연간 일괄 저장 처리 (부모의 save 메서드 구현)
  // ==========================================================================
  async save() {
    const rows = document.querySelectorAll("tr[data-year-date]");
    for (const row of rows) {
      const dateStr = row.getAttribute("data-year-date");
      
      const rawList = window[`tempEvents_${dateStr}`] || [];
      const validEvents = rawList.filter(e => e.content.trim() !== '');
      const cleanEventText = window.formatEventListToText(validEvents);

      await window.getUserCol('events').doc(dateStr).set({
          eventList: validEvents,
          eventText: cleanEventText,
          updatedAt: Date.now()
      });

      let isSkipDay = false;
      for (const e of validEvents) {
          if (window.isSkipLabel(e.label)) {
              isSkipDay = true;
              break;
          }
      }

      let existingPeriods = {};
      try {
        const existingData = await window.dbAPI.loadDayData(dateStr);
        existingPeriods = existingData.periods || {};
      } catch(e) {}

      const subRow = document.querySelector(`tr[data-year-sub="${dateStr}"]`);
      if (subRow) {
        const classCells = subRow.querySelectorAll(".edit-class-cell");
        const periodsData = {};
        
        classCells.forEach(cell => {
           const p = cell.getAttribute("data-p");
           const subjRaw = (cell.innerText || cell.textContent || "").trim();
           let subjText = (subjRaw.toUpperCase() === 'X' || subjRaw === '') ? '' : subjRaw;

           if (isSkipDay) subjText = '';

           periodsData[p] = {
              subject: subjText,
              supplies: existingPeriods[p] ? existingPeriods[p].supplies : '',
              memo: existingPeriods[p] ? existingPeriods[p].memo : ''
           };
        });

        await window.dbAPI.saveSchedule(dateStr, periodsData);
      }
    }
  }
}

// ==========================================================================
// 🔌 하위 호환성 유지 브릿지 (app.js 연동)
// ==========================================================================
window.yearViewInstance = new YearView(document.getElementById("main-view"));

window.renderYearViewer = (container) => {
  window.yearViewInstance.container = container;
  window.yearViewInstance.renderViewer();
};

window.renderYearEditor = (container) => {
  window.yearViewInstance.container = container;
  window.yearViewInstance.renderEditor();
};

window.saveYearDataFromEditor = () => window.yearViewInstance.save();
