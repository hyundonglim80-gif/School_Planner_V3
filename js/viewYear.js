// js/viewYear.js

class YearView extends window.BaseView {
  constructor(container) {
    super(container); 
  }

  async renderViewer() {
    this.showLoading('클라우드에서 연간 일정을 분석하여 불러오는 중...'); 

    if (!window.db) return;

    let allEvents = [];
    try {
      const snapshot = await window.getUserCol('events').get();
      snapshot.forEach(doc => {
        const data = doc.data();
        let hasContent = false;
        let htmlOutput = '';

        if (data.eventList && data.eventList.length > 0) {
          let processed = data.eventList.map(e => ({
              ...e,
              labels: e.labels || (e.label ? [e.label] : [])
          }));
          htmlOutput = window.generateEventBadgesHTML(processed, doc.id, 'compact');
          hasContent = true;
        } else if (data.eventText && data.eventText.trim() !== '') {
          const parsed = window.parseRawEventTextToEventList(data.eventText);
          let processed = parsed.map(e => ({
              ...e,
              labels: e.labels || (e.label ? [e.label] : [])
          }));
          htmlOutput = window.generateEventBadgesHTML(processed, doc.id, 'compact');
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

          return `<div style="${eventStyle}">
                    <div style="color:#2563eb; font-weight:700; display:inline-block; cursor:pointer;" onclick="window.goToDay('${e.dateStr}')" title="${e.dateStr} 일 보기로 이동">${dayNum}일(${dayOfWeek})${isTodayEvent ? '🎯 오늘' : ''}</div>
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

    // 💡 [초기화] 연간 뷰 렌더링 시 기존 메모리 변수 목록을 초기화 (데이터 중복 방지)
    this.renderedDateStrings = [];

    yearData.forEach(item => {
      const dateObj = new Date(item.year, item.month - 1, item.day);
      const dayOfWeekNum = dateObj.getDay();
      const dayOfWeek = dayNames[dayOfWeekNum];

      if (!this.isWeekendVisible && (dayOfWeekNum === 0 || dayOfWeekNum === 6)) return;

      this.renderedDateStrings.push(item.dateStr);

      let eventList = [];
      if (item.eventData.eventList && item.eventData.eventList.length > 0) {
        eventList = item.eventData.eventList;
      } else if (item.eventData.eventText) {
        eventList = window.parseRawEventTextToEventList(item.eventData.eventText);
      }
      
      window[`tempEvents_${item.dateStr}`] = eventList;
      window[`tempSchedules_${item.dateStr}`] = item.data.periods || {};
      
      let compactEditorHtml = `<div id="compact-events-${item.dateStr}" style="display:flex; flex-direction:column; gap:4px;">`;
      compactEditorHtml += window.weekViewInstance ? window.weekViewInstance.generateCompactEventEditor(item.dateStr) : window.generateCompactEventEditor(item.dateStr); 
      compactEditorHtml += `</div>`; 

      const periods = window[`tempSchedules_${item.dateStr}`];

      let dateColor = '#1e40af';
      if (dayOfWeekNum === 0) dateColor = '#ef4444';
      else if (dayOfWeekNum === 6) dateColor = '#3b82f6';

      html += `<tr data-year-date="${item.dateStr}">` +
        `<td rowspan="${window.showClass ? 2 : 1}" style="padding:8px 4px; border:1px solid #cbd5e1; background:#f8fafc; vertical-align:middle; width:110px;">` +
          `<div style="display:flex; flex-direction:column; align-items:center; gap:4px;">` +
            `<span onclick="window.goToDay('${item.dateStr}')" style="font-size:1.2rem; font-weight:900; color:${dateColor}; line-height:1.1; cursor:pointer;" title="${item.dateStr} 일 보기로 이동">${item.month}월 ${item.day}일</span>` +
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
           html += `<td class="editable-cell edit-class-cell" data-p="${p}" contenteditable="true" style="padding:6px; border:1px solid #cbd5e1; font-size:1rem; color:#047857; background:#ecfdf5; vertical-align:middle;" oninput="window.yearViewInstance.syncScheduleInputs()">${subjText}</td>`;
        }

      html += `</tr>`;
    });

    html += `</tbody></table></div>`;
    this.container.innerHTML = html;
  }

  // 💡 [핵심 추가] 입력 중인 수업 데이터를 즉시 전역 변수에 백업
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
              const subjRaw = (cell.innerText || cell.textContent || "").trim();
              let subjText = (subjRaw.toUpperCase() === 'X' || subjRaw === '') ? '' : subjRaw;

              const existingSupplies = window[`tempSchedules_${dateStr}`][p] ? window[`tempSchedules_${dateStr}`][p].supplies : '';
              const existingMemo = window[`tempSchedules_${dateStr}`][p] ? window[`tempSchedules_${dateStr}`][p].memo : '';

              window[`tempSchedules_${dateStr}`][p] = { subject: subjText, supplies: existingSupplies, memo: existingMemo };
          });
      });
  }

  // 💡 [핵심 수정] DOM 탐색 없이 동기화된 메모리 배열 기반으로 DB 비동기 전송
  // 💡 [핵심 수정] 스냅샷 캡처 및 백그라운드 비동기 처리
  save() {
    // [1단계: 동기적 데이터 캡처]
    if (!this.renderedDateStrings) return Promise.resolve();
    this.syncScheduleInputs(); 

    const snapshot = [];
    for (const dateStr of this.renderedDateStrings) {
        const rawList = window[`tempEvents_${dateStr}`] || [];
        const validEvents = rawList
            .filter(e => (e.content || '').trim() !== '' || (e.labels && e.labels.length > 0))
            .map(e => ({...e}));
        const periodsData = JSON.parse(JSON.stringify(window[`tempSchedules_${dateStr}`] || {}));
        snapshot.push({ dateStr, validEvents, periodsData });
    }

    // [2단계: 비동기 클라우드 저장]
    return (async () => {
        for (const item of snapshot) {
            const cleanEventText = window.formatEventListToText ? window.formatEventListToText(item.validEvents) : '';
            await window.getUserCol('events').doc(item.dateStr).set({
                eventList: item.validEvents,
                eventText: cleanEventText,
                updatedAt: Date.now()
            });

            let isSkipDay = false;
            for (const e of item.validEvents) {
                if (e.labels && e.labels.some(l => typeof window.isSkipLabel === 'function' && window.isSkipLabel(l))) {
                    isSkipDay = true; break;
                }
            }

            if (isSkipDay) {
                for (const p in item.periodsData) { item.periodsData[p].subject = ''; }
            }

            await window.dbAPI.saveSchedule(item.dateStr, item.periodsData);
        }
    })();
  }
}

window.yearViewInstance = new YearView(document.getElementById("main-view"));
window.renderYearViewer = (container) => { window.yearViewInstance.container = container; window.yearViewInstance.renderViewer(); };
window.renderYearEditor = (container) => { window.yearViewInstance.container = container; window.yearViewInstance.renderEditor(); };
window.saveYearDataFromEditor = () => window.yearViewInstance.save();
