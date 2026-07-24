// js/viewDay.js

function renderDayViewer(container) {
  const todayData = mockJulyWeekData[0];
  const events = todayData.periods.map(p => p.event).filter(e => e.trim() !== '');
  const eventListHtml = events.length > 0 ? events.map(e => `<li>${e}</li>`).join('') : '<li>일정 없음</li>';

  let html = `
    <div class="day-viewer-container">
      <div class="daily-event-banner">
        <h3>📌 ${todayData.date}(${todayData.day}) 전체 일정</h3>
        <ul class="daily-event-list">${eventListHtml}</ul>
      </div>
      <div class="period-card-list">
  `;

  todayData.periods.forEach(pObj => {
    html += `
        <div class="period-card">
          <div class="period-card-header">
            <span style="font-weight:700; font-size:1.05rem;">⏰ ${pObj.p}교시</span>
            ${pObj.subject ? `<span class="badge-tag">${pObj.subject}</span>` : '<span style="color:#94a3b8; font-size:0.85rem;">수업 없음</span>'}
          </div>
          <div style="font-size:0.9rem; margin-bottom:6px; color:#d97706; font-weight:600;">🎒 준비물: ${pObj.supplies || '없음'}</div>
          <div style="font-size:0.9rem; color:#334155;">📝 메모: ${pObj.memo || '-'}</div>
        </div>
    `;
  });
  html += `</div></div>`;
  container.innerHTML = html;
}

function renderDayEditor(container) {
  const todayData = mockJulyWeekData[0];
  const events = todayData.periods.map(p => p.event).filter(e => e.trim() !== '');
  const eventText = events.join(', ');

  let html = `
    <div class="day-viewer-container">
      <div class="daily-event-banner" style="background:#ffffff; border: 1px solid var(--border-color); border-left: 5px solid #2563eb;">
        <h3 style="font-size: 0.95rem; color: #1e40af; margin-bottom: 8px;">📅 오늘의 전체 일정</h3>
        <div class="editable-cell" contenteditable="true" style="background:#f8fafc; border:1px solid #cbd5e1; min-height: 40px; font-size: 0.9rem;">${eventText}</div>
      </div>
      <div class="table-container">
        <table style="text-align: center;">
          <thead>
            <tr>
              <th style="width: 60px;">교시</th>
              <th style="width: 120px;">수업</th>
              <th style="width: 25%;">🎒 준비물</th>
              <th>📝 메모</th>
            </tr>
          </thead>
          <tbody>
  `;

  todayData.periods.forEach(pObj => {
    html += `
            <tr>
              <td class="period-cell">${pObj.p}교시</td>
              <td class="editable-cell" contenteditable="true">${pObj.subject ? `<span class="badge-tag">${pObj.subject}</span>` : ''}</td>
              <td class="editable-cell" contenteditable="true" style="color: #d97706; font-weight: 600; text-align: left;">${pObj.supplies || ''}</td>
              <td class="editable-cell" contenteditable="true" style="text-align: left;">${pObj.memo || ''}</td>
            </tr>
    `;
  });
  html += `</tbody></table></div></div>`;
  container.innerHTML = html;
}