// js/viewMonth.js

// ==========================================================================
// 👁️ 1. 월간 뷰어 모드 (뱃지 렌더링 적용)
// ==========================================================================
window.renderMonthViewer = async function(container) {
  container.innerHTML = `<p style="text-align:center; padding: 40px; color:#64748b; font-weight:bold; font-size:var(--font-base);">⏳ 클라우드에서 월간 일정을 불러오는 중입니다...</p>`;

  if (!window.db) return;

  let html = `<div class="calendar-grid" style="grid-template-columns: repeat(${window.showWeekend ? 7 : 5}, 1fr);">`;
  
  const days = window.showWeekend ? ['일','월','화','수','목','금','토'] : ['월','화','수','목','금'];
  days.forEach(d => {
    let colorStyle = '';
    if (d === '일') colorStyle = 'color:#ef4444;';
    else if (d === '토') colorStyle = 'color:#3b82f6;';
    html += `<div class="cal-header" style="${colorStyle}">${d}</div>`;
  });
  
  const y = window.currentDate.getFullYear();
  const m = window.currentDate.getMonth();
  const firstDay = new Date(y, m, 1).getDay(); 
  const lastDate = new Date(y, m + 1, 0).getDate(); 
  
  let padding = 0;
  if (window.showWeekend) { padding = firstDay; } 
  else { if (firstDay >= 1 && firstDay <= 5) padding = firstDay - 1; }
  
  for(let i=0; i<padding; i++) {
    html += `<div class="cal-day" style="background:#f8fafc;"></div>`;
  }

  const dayPromises = [];
  for(let i=1; i<=lastDate; i++) {
    const dateStr = `${y}-${String(m+1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    dayPromises.push(window.getUserCol('events').doc(dateStr).get().then(doc => ({ 
      day: i, 
      dateStr, 
      eventData: doc.exists ? doc.data() : {} 
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
    
    // 💡 이벤트 리스트를 뱃지로 변환
    let eventHtml = '';
    if (item.eventData.eventList && item.eventData.eventList.length > 0) {
      eventHtml = window.generateEventBadgesHTML(item.eventData.eventList);
    } else if (item.eventData.eventText) {
      const parsed = window.parseRawEventTextToEventList(item.eventData.eventText);
      eventHtml = window.generateEventBadgesHTML(parsed);
    }
    
    const dateObj = new Date(y, m, d);
    const dayOfWeekNum = dateObj.getDay();
    
    if (!window.showWeekend && (dayOfWeekNum === 0 || dayOfWeekNum === 6)) return;

    const dayPeriods = scheduleMap[dateStr] || {};
    let boxesHtml = '';
    let hasClass = false;

    for (let p = 1; p <= 6; p++) {
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

    let scheduleHtml = hasClass ? `<div style="display:flex; flex-wrap:nowrap; gap:2px; margin-top:4px; margin-bottom:4px; width:100%;">${boxesHtml}</div>` : '';

    let dateColor = '#334155';
    if (dayOfWeekNum === 0) dateColor = '#ef4444';
    else if (dayOfWeekNum === 6) dateColor = '#3b82f6';

    let dayNumHtml = `<div style="font-weight:700; color:${dateColor}; font-size:1.1rem;">${d}</div>`;
    
    // 💡 이벤트 뱃지가 있다면 하단에 출력
    let finalEventOutput = eventHtml ? `<div style="margin-top:4px;">${eventHtml}</div>` : '';

    const todayClass = (dateStr === realTodayStr) ? 'month-today-cell' : '';

    html += `<div class="cal-day ${todayClass}" onclick="window.goToDay('${dateStr}')" style="cursor:pointer;" title="${dateStr} 일 보기로 이동">${dayNumHtml}${scheduleHtml}${finalEventOutput}</div>`;
  });

  html += `</div>`;
  container.innerHTML = html;
};

// ==========================================================================
// ✏️ 2. 월간 에디터 모드
// ==========================================================================
window.renderMonthEditor = async function(container) {
  container.innerHTML = `<p style="text-align:center; padding: 40px; color:#64748b; font-weight:bold; font-size:var(--font-base);">⏳ 월간 편집 시트를 불러오는 중입니다...</p>`;

  if (!window.db) return;

  const y = window.currentDate.getFullYear();
  const m = window.currentDate.getMonth();
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
            <th colspan="6" style="padding:8px; border:1px solid #cbd5e1;">📌 내용 (직접 수정)</th>
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

    if (!window.showWeekend && (dayOfWeekNum === 0 || dayOfWeekNum === 6)) return;

    let eventText = '';
    if (item.eventData.eventList && item.eventData.eventList.length > 0) {
      eventText = window.formatEventListToText(item.eventData.eventList);
    } else if (item.eventData.eventText) {
      eventText = item.eventData.eventText;
    }

    const periods = item.data.periods || {};

    let dateColor = '#1e40af';
    if (dayOfWeekNum === 0) dateColor = '#ef4444';
    else if (dayOfWeekNum === 6) dateColor = '#3b82f6';

    html += `<tr data-month-date="${item.dateStr}">` +
      `<td rowspan="2" onclick="window.goToDay('${item.dateStr}')" style="padding:8px 4px; border:1px solid #cbd5e1; background:#f8fafc; vertical-align:middle; width:80px; cursor:pointer;" title="${item.dateStr} 일 보기로 이동">` +
        `<div style="display:flex; flex-direction:column; align-items:center; gap:4px;">` +
          `<span style="font-size:1.8rem; font-weight:900; color:${dateColor}; line-height:1;">${dayNum}</span>` +
          `<span style="font-size:1rem; font-weight:600; color:${dateColor}; line-height:1;">${dayOfWeek}</span>` +
        `</div>` +
      `</td>` +
      `<td style="padding:4px; border:1px solid #cbd5e1; background:#ecfdf5; color:#047857; font-weight:bold; font-size:0.9rem; vertical-align:middle; width:60px;">수업</td>`;
      
      for(let p=1; p<=6; p++) {
         const subjText = periods[p] && periods[p].subject && periods[p].subject.toUpperCase() !== 'X' ? periods[p].subject.trim() : '';
         html += `<td class="editable-cell edit-class-cell" data-p="${p}" contenteditable="true" style="padding:6px; border:1px solid #cbd5e1; font-size:1rem; color:#047857; background:#ecfdf5; vertical-align:middle;">${subjText}</td>`;
      }
      
    html += `</tr>` +
    `<tr data-month-sub="${item.dateStr}">` +
      `<td style="padding:4px; border:1px solid #cbd5e1; background:#f0f9ff; color:#0369a1; font-weight:bold; font-size:0.9rem; vertical-align:middle; width:60px;">일정</td>` +
      `<td colspan="6" class="editable-cell edit-event-cell" contenteditable="true" style="text-align:left; padding:6px 10px; border:1px solid #cbd5e1; font-size:1.1rem; color:#0369a1; background:#f0f9ff; vertical-align:top; line-height:1.4; white-space:pre-wrap;">${eventText}</td>` +
    `</tr>`;
  });

  html += `</tbody></table></div>`;
  container.innerHTML = html;
};

// ==========================================================================
// 💾 3. 월간 편집 저장 처리 함수 (동적 라벨 확인 로직 적용)
// ==========================================================================
window.saveMonthDataFromEditor = async function() {
  const rows = document.querySelectorAll("tr[data-month-date]");
  for (const row of rows) {
    const dateStr = row.getAttribute("data-month-date");
    
    const nextRow = row.nextElementSibling;
    const eventCell = nextRow ? nextRow.querySelector(".edit-event-cell") : null;
    const eventTextRaw = eventCell ? (eventCell.innerText || eventCell.textContent || "").trim() : "";
    
    const parsedEventList = window.parseRawEventTextToEventList(eventTextRaw);
    const cleanEventText = window.formatEventListToText(parsedEventList);

    await window.getUserCol('events').doc(dateStr).set({
        eventList: parsedEventList,
        eventText: cleanEventText,
        updatedAt: Date.now()
    });

    const isSkipDay = window.checkSkipConditionFromText(cleanEventText);

    let existingPeriods = {};
    try {
      const existingData = await window.dbAPI.loadDayData(dateStr);
      existingPeriods = existingData.periods || {};
    } catch(e) {}

    const classCells = row.querySelectorAll(".edit-class-cell");
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
};
