// js/viewYear.js

window.renderYearViewer = async function(container) {
  container.innerHTML = `<p style="text-align:center; padding: 40px; color:#64748b; font-weight:bold; font-size:1.2rem;">⏳ 클라우드에서 연간 일정을 분석하여 불러오는 중입니다...</p>`;

  let allEvents = [];
  try {
    const snapshot = await window.db.collection('events').get();
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.eventText && data.eventText.trim() !== '') {
        allEvents.push({ dateStr: doc.id, text: data.eventText });
      }
    });
  } catch (error) {
    console.error("연간 데이터 로딩 에러:", error);
  }

  allEvents.sort((a, b) => a.dateStr.localeCompare(b.dateStr));

  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

  const months = [
    { label: "3월", match: "-03-" }, { label: "4월", match: "-04-" },
    { label: "5월", match: "-05-" }, { label: "6월", match: "-06-" },
    { label: "7월", match: "-07-" }, { label: "8월", match: "-08-" },
    { label: "9월", match: "-09-" }, { label: "10월", match: "-10-" },
    { label: "11월", match: "-11-" }, { label: "12월", match: "-12-" },
    { label: "1월", match: "-01-" }, { label: "2월", match: "-02-" }
  ];

  let html = `<div class="year-grid">`;

  const realToday = new Date();
  const currentYearStr = String(realToday.getFullYear());
  const currentMonthMatch = `-${String(realToday.getMonth() + 1).padStart(2, '0')}-`;
  const realTodayStr = window.formatDate(realToday);

  months.forEach(mObj => {
    const monthEvents = allEvents.filter(e => e.dateStr.includes(mObj.match));

    let eventListHtml = '';
    if (monthEvents.length > 0) {
      eventListHtml = monthEvents.map(e => {
        const parts = e.dateStr.split('-');
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const dayNum = parseInt(parts[2], 10);
        
        const dateObj = new Date(year, month, dayNum);
        const dayOfWeek = dayNames[dateObj.getDay()];
        
        const isTodayEvent = (e.dateStr === realTodayStr);
        const eventStyle = isTodayEvent 
            ? 'background-color:#eff6ff; padding:8px; border-radius:6px; border:2px solid #3b82f6; margin-bottom:10px;' 
            : 'margin-bottom:10px; border-bottom:1px dashed #e2e8f0; padding-bottom:6px;';

        return `<div style="${eventStyle}">
                  <div style="color:#2563eb; font-weight:700;">${dayNum}일(${dayOfWeek}) ${isTodayEvent ? '🎯 오늘' : ''}</div>
                  <div style="color:#334155; white-space:pre-wrap; word-break:break-all; margin-top:2px;">${e.text}</div>
                </div>`;
      }).join('');
    } else {
      eventListHtml = `<div style="text-align:center; color:#94a3b8; font-size:0.9rem; padding-top:10px;">일정 없음</div>`;
    }

    const isCurrentMonthCard = (mObj.match === currentMonthMatch && String(window.currentDate.getFullYear()) === currentYearStr);
    const cardStyle = isCurrentMonthCard 
        ? 'border: 3px solid #2563eb; background-color: #f8fafc; box-shadow: 0 4px 6px rgba(37,99,235,0.1);' 
        : 'border: 1px solid var(--border-color); background: #fff;';

    html += `
      <div class="mini-month" style="display:flex; flex-direction:column; gap:8px; text-align:left; padding:12px; border-radius:8px; ${cardStyle}">
        <h3 style="color:#1e40af; border-bottom:2px solid #bfdbfe; padding-bottom:4px; font-size:1.1rem; text-align:center;">${mObj.label}</h3>
        <div style="font-size:0.95rem; line-height:1.4;">
          ${eventListHtml}
        </div>
      </div>`;
  });

  html += `</div>`;
  container.innerHTML = html;
};

window.renderYearEditor = async function(container) {
  container.innerHTML = `<p style="text-align:center; padding: 40px; color:#64748b; font-weight:bold; font-size:1.2rem;">⏳ 연간 일정 편집 시트를 불러오는 중입니다...</p>`;

  let allEvents = [];
  try {
    const snapshot = await window.db.collection('events').get();
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.eventText && data.eventText.trim() !== '') {
        allEvents.push({ dateStr: doc.id, text: data.eventText });
      }
    });
  } catch (error) {
    console.error("연간 데이터 로딩 에러:", error);
  }

  allEvents.sort((a, b) => a.dateStr.localeCompare(b.dateStr));

  let html = `
    <div class="table-container" style="background:#fff; padding:16px; border-radius:8px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <h3 style="color:#1e293b; font-size:1.3rem;">📋 연간 일정 관리 시트</h3>
        <button onclick="addYearEventRow()" style="padding:8px 14px; background:#10b981; color:#fff; border:none; border-radius:6px; font-weight:bold; cursor:pointer; font-size:1rem;">➕ 일정 행 추가</button>
      </div>
      <table style="width:100%; min-width:600px; border-collapse:collapse; text-align:left;">
        <thead>
          <tr style="background:#f1f5f9; text-align:center;">
            <th style="width:180px; padding:10px; border:1px solid #cbd5e1; font-size:1.1rem;">날짜</th>
            <th style="padding:10px; border:1px solid #cbd5e1; font-size:1.1rem;">📌 행사/일정 내용</th>
            <th style="width:80px; padding:10px; border:1px solid #cbd5e1; font-size:1.1rem;">삭제</th>
          </tr>
        </thead>
        <tbody id="year-editor-tbody">
  `;

  if (allEvents.length === 0) {
    const defaultDate = window.formatDate(window.currentDate);
    html += `
      <tr class="year-event-row">
        <td style="padding:8px; border:1px solid #cbd5e1; text-align:center;">
          <input type="date" class="year-date-input" value="${defaultDate}" style="padding:6px; font-size:1rem; border:1px solid #cbd5e1; border-radius:4px;">
        </td>
        <td class="editable-cell year-event-cell" contenteditable="true" style="padding:8px; border:1px solid #cbd5e1; font-size:1.1rem; color:#0369a1; background:#f0f9ff; white-space:pre-wrap;"></td>
        <td style="text-align:center; padding:8px; border:1px solid #cbd5e1;">
          <button onclick="this.closest('tr').remove()" style="background:#ef4444; color:#fff; border:none; padding:6px 10px; border-radius:4px; cursor:pointer;">🗑️</button>
        </td>
      </tr>
    `;
  } else {
    allEvents.forEach(e => {
      html += `
        <tr class="year-event-row">
          <td style="padding:8px; border:1px solid #cbd5e1; text-align:center;">
            <input type="date" class="year-date-input" value="${e.dateStr}" style="padding:6px; font-size:1rem; border:1px solid #cbd5e1; border-radius:4px;">
          </td>
          <td class="editable-cell year-event-cell" contenteditable="true" style="padding:8px; border:1px solid #cbd5e1; font-size:1.1rem; color:#0369a1; background:#f0f9ff; white-space:pre-wrap;">${e.text}</td>
          <td style="text-align:center; padding:8px; border:1px solid #cbd5e1;">
            <button onclick="this.closest('tr').remove()" style="background:#ef4444; color:#fff; border:none; padding:6px 10px; border-radius:4px; cursor:pointer;">🗑️</button>
          </td>
        </tr>
      `;
    });
  }

  html += `</tbody></table></div>`;
  container.innerHTML = html;
};

window.addYearEventRow = function() {
  const tbody = document.getElementById('year-editor-tbody');
  if (!tbody) return;
  const defaultDate = window.formatDate(window.currentDate);
  const tr = document.createElement('tr');
  tr.className = 'year-event-row';
  tr.innerHTML = `
    <td style="padding:8px; border:1px solid #cbd5e1; text-align:center;">
      <input type="date" class="year-date-input" value="${defaultDate}" style="padding:6px; font-size:1rem; border:1px solid #cbd5e1; border-radius:4px;">
    </td>
    <td class="editable-cell year-event-cell" contenteditable="true" style="padding:8px; border:1px solid #cbd5e1; font-size:1.1rem; color:#0369a1; background:#f0f9ff; white-space:pre-wrap;"></td>
    <td style="text-align:center; padding:8px; border:1px solid #cbd5e1;">
      <button onclick="this.closest('tr').remove()" style="background:#ef4444; color:#fff; border:none; padding:6px 10px; border-radius:4px; cursor:pointer;">🗑️</button>
    </td>
  `;
  tbody.appendChild(tr);
};

window.saveYearDataFromEditor = async function() {
  const rows = document.querySelectorAll("tr.year-event-row");
  for (const row of rows) {
    const dateInput = row.querySelector(".year-date-input");
    const eventCell = row.querySelector(".year-event-cell");
    
    if (dateInput) {
      const dateStr = dateInput.value;
      const eventText = eventCell ? (eventCell.innerText || eventCell.textContent || "").trim() : "";
      if (dateStr) {
        await window.dbAPI.saveEvent(dateStr, eventText);
      }
    }
  }
};
