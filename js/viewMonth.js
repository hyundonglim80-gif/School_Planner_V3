// js/viewMonth.js

window.renderMonthViewer = async function(container) {
  container.innerHTML = `<p style="text-align:center; padding: 40px; color:#64748b; font-weight:bold; font-size:1.2rem;">⏳ 클라우드에서 월간 일정을 불러오는 중입니다...</p>`;

  let html = `<div class="calendar-grid" style="grid-template-columns: repeat(5, 1fr);">`;
  const days = ['월','화','수','목','금'];
  days.forEach(d => html += `<div class="cal-header" style="font-size:1.2rem;">${d}</div>`);

  const y = window.currentDate.getFullYear();
  const m = window.currentDate.getMonth();
  const firstDay = new Date(y, m, 1).getDay(); 
  const lastDate = new Date(y, m + 1, 0).getDate(); 

  let padding = 0;
  if (firstDay >= 1 && firstDay <= 5) {
    padding = firstDay - 1; 
  }
  for(let i=0; i<padding; i++) {
    html += `<div class="cal-day" style="background:#f8fafc; border: 1px solid #e2e8f0;"></div>`;
  }

  const dayPromises = [];
  for(let i=1; i<=lastDate; i++) {
    const dateStr = `${y}-${String(m+1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    dayPromises.push(window.dbAPI.loadDayData(dateStr).then(data => ({ day: i, data })));
  }

  const monthData = await Promise.all(dayPromises);
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

  const realTodayStr = window.formatDate(new Date()); 

  monthData.forEach(item => {
    const d = item.day;
    const eventText = item.data.eventText || '';
    
    const dateObj = new Date(y, m, d);
    const dayOfWeekNum = dateObj.getDay();
    const dayOfWeek = dayNames[dayOfWeekNum];
    
    if (dayOfWeekNum === 0 || dayOfWeekNum === 6) return;

    let dayStyle = "font-weight:700; font-size:1.1rem; margin-bottom:4px; color:#334155; text-align: center;";

    let eventHtml = '';
    if(eventText) {
       eventHtml = `<div class="cal-event" style="white-space: pre-wrap; font-size:0.95rem; padding:4px; margin-top:2px;">${eventText}</div>`;
    }

    const currentCellDateStr = `${y}-${String(m+1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const isToday = (currentCellDateStr === realTodayStr);
    const boxStyle = isToday 
        ? 'border: 3px solid #2563eb; background-color: #eff6ff; box-sizing: border-box;' 
        : 'border: 1px solid #e2e8f0; background: #fff;';

    html += `<div class="cal-day" style="${boxStyle}">
      <div style="${dayStyle}">${d}</div>${eventHtml}
    </div>`;
  });

  html += `</div>`;
  container.innerHTML = html;
};

window.renderMonthEditor = async function(container) {
  container.innerHTML = `<p style="text-align:center; padding: 40px; color:#64748b; font-weight:bold; font-size:1.2rem;">⏳ 월간 편집 시트를 불러오는 중입니다...</p>`;

  const y = window.currentDate.getFullYear();
  const m = window.currentDate.getMonth();
  const lastDate = new Date(y, m + 1, 0).getDate();

  const dayPromises = [];
  for(let i=1; i<=lastDate; i++) {
    const dateStr = `${y}-${String(m+1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    dayPromises.push(window.dbAPI.loadDayData(dateStr).then(data => ({ day: i, dateStr, data })));
  }

  const monthData = await Promise.all(dayPromises);
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

  let html = `
    <div class="table-container" style="background:#fff; padding:12px; border-radius:8px;">
      <h3 style="margin-bottom:12px; color:#1e293b; font-size:1.3rem;">📅 ${y}년${m+1}월 일정 편집 시트</h3>
      <table style="width:100%; min-width:600px; border-collapse:collapse; text-align:left;">
        <thead>
          <tr style="background:#f1f5f9; text-align:center;">
            <th style="width:120px; padding:10px; border:1px solid #cbd5e1; font-size:1.1rem;">날짜</th>
            <th style="padding:10px; border:1px solid #cbd5e1; font-size:1.1rem;">📌 일정 내용 (직접 수정/입력/삭제)</th>
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

    if (dayOfWeekNum === 0 || dayOfWeekNum === 6) return;

    const eventText = item.data.eventText || '';

    html += `
      <tr data-month-date="${item.dateStr}">
        <td style="text-align:center; padding:10px; border:1px solid #cbd5e1; background:#f8fafc; font-weight:bold; font-size:1.1rem;">
          ${m+1}/${dayNum} (${dayOfWeek})
        </td>
        <td class="editable-cell month-event-cell" contenteditable="true" style="padding:10px; border:1px solid #cbd5e1; font-size:1.1rem; color:#0369a1; background:#f0f9ff; white-space:pre-wrap;">${eventText}</td>
      </tr>
    `;
  });

  html += `</tbody></table></div>`;
  container.innerHTML = html;
};

window.saveMonthDataFromEditor = async function() {
  const rows = document.querySelectorAll("tr[data-month-date]");
  for (const row of rows) {
    const dateStr = row.getAttribute("data-month-date");
    const eventCell = row.querySelector(".month-event-cell");
    const eventText = eventCell ? (eventCell.innerText || eventCell.textContent || "").trim() : "";
    await window.dbAPI.saveEvent(dateStr, eventText);
  }
};
