// js/viewMonth.js

class MonthView extends window.BaseView {
  constructor(container) {
    super(container); 
  }

  static setupGoToDay() {
    if (!window.goToDay) {
      window.goToDay = function(dateStr) {
        if (!dateStr) return;
        const parts = dateStr.split('-');
        if (parts.length === 3) {
          window.currentDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
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

    const dayPromises = [];
    for(let i=1; i<=lastDate; i++) {
      const dateStr = `${y}-${String(m+1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      dayPromises.push(window.getUserCol('events').doc(dateStr).get().then(doc => ({ 
        day: i, dateStr, eventData: doc.exists ? doc.data() : {} 
      })));
    }
    const monthData = await Promise.all(dayPromises);

    let scheduleMap = {};
    try {
      const snap = await window.getUserCol('schedules').get();
      snap.forEach(doc => { scheduleMap[doc.id] = doc.data().periods || {}; });
    } catch(e) {}

    const realTodayStr = window.formatDate(new Date());

    monthData.forEach(item => {
      const d = item.day;
      const dateStr = item.dateStr;
      
      let eventHtml = '';
      let finalEvents = [];
      if (item.eventData.eventList && item.eventData.eventList.length > 0) {
        finalEvents = item.eventData.eventList;
      } else if (item.eventData.eventText) {
        finalEvents = window.parseRawEventTextToEventList(item.eventData.eventText);
      }
      
      if (finalEvents.length > 0) {
        // 💡 [수정] 라벨이 없는 경우 '기타'를 부여하여 배지 생성기로 넘깁니다.
        let processedEvents = finalEvents.map(e => ({
            ...e,
            labels: (e.labels && e.labels.length > 0) ? e.labels : (e.label ? [e.label] : ['기타'])
        }));
        eventHtml = window.generateEventBadgesHTML(processedEvents, dateStr);
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

          boxesHtml += `<div style="display:flex; align-items:center; justify-content:center; flex:1; min-width:0; height:22px; box-sizing:border-box; border:1px solid #6ee7b7; border-radius:4px; background:#ecfdf5; color:#047857; font-size:${fontSize}; font-weight:700; letter-spacing:${letterSpacing}; white-space:nowrap; overflow:hidden;">${text}</div>`;
          hasClass = true;
        } else {
          boxesHtml += `<div style="display:flex; align-items:center; justify-content:center; flex:1; min-width:0; height:22px; box-sizing:border-box; border:1px solid #e2e8f0; border-radius:4px; background:#f8fafc; color:#94a3b8; font-size:0.75rem; font-weight:700;">&nbsp;</div>`;
        }
      }

      let scheduleHtml = (hasClass && window.showClass) ? `<div style="display:flex; flex-wrap:nowrap; gap:2px; margin-top:4px; margin-bottom:4px; width:100%;">${boxesHtml}</div>` : '';

      let dateColor = '#334155';
      if (dayOfWeekNum === 0) dateColor = '#ef4444';
      else if (dayOfWeekNum === 6) dateColor = '#3b82f6';

      let dayNumHtml = `<div style="font-weight:700; color:${dateColor}; font-size:1.1rem;">${d}</div>`;
      let finalEventOutput = eventHtml ? `<div style="margin-top:4px;">${eventHtml}</div>` : '';
      const todayClass = (dateStr === realTodayStr) ? 'month-today-cell' : '';

      html += `<div class="cal-day ${todayClass}" onclick="window.goToDay('${dateStr}')" style="cursor:pointer;" title="${dateStr} 일 보기로 이동">${dayNumHtml}${scheduleHtml}${finalEventOutput}</div>`;
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

    const dayPromises = [];
    for(let i=1; i<=lastDate; i++) {
      const dateStr = `${y}-${String(m+1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      dayPromises.push(
        Promise.all([
          window.dbAPI.loadDayData(dateStr), 
          window.getUserCol('events').doc(dateStr).get()
        ]).then(([data, eventDoc]) => ({ day: i, dateStr, data, eventData: eventDoc.exists ? eventDoc.data() : {} }))
      );
    }

    const monthData = await Promise.all(dayPromises);
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

      html += `<tr data-month-date="${item.dateStr}">` +
        `<td rowspan="${window.showClass ? 2 : 1}" onclick="window.goToDay('${item.dateStr}')" style="padding:8px 4px; border:1px solid #cbd5e1; background:#f8fafc; vertical-align:middle; width:80px; cursor:pointer;" title="${item.dateStr} 일 보기로 이동">` +
          `<div style="display:flex; flex-direction:column; align-items:center; gap:4px;">` +
            `<span style="font-size:1.8rem; font-weight:900; color:${dateColor}; line-height:1;">${dayNum}</span>` +
            `<span style="font-size:1rem; font-weight:600; color:${dateColor}; line-height:1;">${dayOfWeek}</span>` +
          `</div>` +
        `</td>` +
        `<td style="padding:4px; border:1px solid #cbd5e1; background:#f0f9ff; color:#0369a1; font-weight:bold; font-size:0.9rem; vertical-align:middle; width:60px; text-align:center;">` +
            `일정<br>` +
            `<button onclick="window.weekViewInstance ? window.weekViewInstance.addCompactEvent('${item.dateStr}') : window.addCompactEvent('${item.dateStr}')" style="margin-top:6px; background:#e0f2fe; color:#0369a1; border:1px dashed #7dd3fc; border-radius:4px; padding:2px 8px; cursor:pointer; font-weight:bold; font-size:1.1rem; box-shadow:0 1px 2px rgba(0,0,0,0.05);" title="일정 추가">+</button>` +
        `</td>` +
        `<td colspan="${this.maxPeriod}" style="text-align:left; padding:6px 10px; background:#f0f9ff; vertical-align:top;">${compactEditorHtml}</td>` +
      `</tr>` +
      `<tr data-month-sub="${item.dateStr}" style="${window.showClass ? '' : 'display:none;'}">` +
        `<td style="padding:4px; border:1px solid #cbd5e1; background:#ecfdf5; color:#047857; font-weight:bold; font-size:0.9rem; vertical-align:middle; width:60px;">수업</td>`;
        
        for(let p=1; p<=this.maxPeriod; p++) {
           const subjText = periods[p] && periods[p].subject && periods[p].subject.toUpperCase() !== 'X' ? periods[p].subject.trim() : '';
           html += `<td class="editable-cell edit-class-cell" data-p="${p}" contenteditable="true" style="padding:6px; border:1px solid #cbd5e1; font-size:1rem; color:#047857; background:#ecfdf5; vertical-align:middle;">${subjText}</td>`;
        }
        
      html += `</tr>`;
    });

    html += `</tbody></table></div>`;
    this.container.innerHTML = html;
  }

  // 💡 weekViewInstance에서 빌려쓰는 토글 함수 처리
  toggleCompactEventLabel(dateStr, idx, labelName) {
      if(window.weekViewInstance) window.weekViewInstance.toggleCompactEventLabel(dateStr, idx, labelName);
  }
  updateCompactEvent(dateStr, idx, field, value) {
      if(window.weekViewInstance) window.weekViewInstance.updateCompactEvent(dateStr, idx, field, value);
  }
  removeCompactEvent(dateStr, idx) {
      if(window.weekViewInstance) window.weekViewInstance.removeCompactEvent(dateStr, idx);
  }

  async save() {
    const rows = document.querySelectorAll("tr[data-month-date]");
    for (const row of rows) {
      const dateStr = row.getAttribute("data-month-date");
      
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

      const subRow = document.querySelector(`tr[data-month-sub="${dateStr}"]`);
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

MonthView.setupGoToDay();
window.monthViewInstance = new MonthView(document.getElementById("main-view"));
window.renderMonthViewer = (container) => { window.monthViewInstance.container = container; window.monthViewInstance.renderViewer(); };
window.renderMonthEditor = (container) => { window.monthViewInstance.container = container; window.monthViewInstance.renderEditor(); };
window.saveMonthDataFromEditor = () => window.monthViewInstance.save();
