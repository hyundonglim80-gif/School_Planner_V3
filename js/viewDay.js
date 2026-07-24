// js/viewDay.js

const CURRENT_DAY_STR = "2026-07-20"; // 임시 기준 날짜 (나중에 날짜 이동 버튼과 연동)

// 1. 일간 뷰어 모드
window.renderDayViewer = async function(container) {
  container.innerHTML = `<p style="text-align:center; padding: 40px; color:#64748b;">⏳ 클라우드 데이터를 불러오는 중...</p>`;

  // 🔥 Firestore에서 실제 데이터 읽어오기
  const dayData = await window.dbAPI.loadDayData(CURRENT_DAY_STR);
  const eventText = dayData.eventText || '일정 없음';
  const periods = dayData.periods || {};

  let html = `
    <div class="day-viewer-container">
      <div class="daily-event-banner">
        <h3>📌 2026-07-20 전체 일정</h3>
        <ul class="daily-event-list"><li>${eventText}</li></ul>
      </div>
      <div class="period-card-list">
  `;

  for (let p = 1; p <= 6; p++) {
    const pObj = periods[p] || {};
    html += `
        <div class="period-card">
          <div class="period-card-header">
            <span style="font-weight:700; font-size:1.05rem;">⏰ ${p}교시</span>
            ${pObj.subject ? `<span class="badge-tag">${pObj.subject}</span>` : '<span style="color:#94a3b8; font-size:0.85rem;">수업 없음</span>'}
          </div>
          <div style="font-size:0.9rem; margin-bottom:6px; color:#d97706; font-weight:600;">🎒 준비물: ${pObj.supplies || '없음'}</div>
          <div style="font-size:0.9rem; color:#334155;">📝 메모: ${pObj.memo || '-'}</div>
        </div>
    `;
  }

  html += `</div></div>`;
  container.innerHTML = html;
};

// 2. 일간 에디터 모드
window.renderDayEditor = async function(container) {
  container.innerHTML = `<p style="text-align:center; padding: 40px; color:#64748b;">⏳ 편집 화면을 준비 중...</p>`;

  const dayData = await window.dbAPI.loadDayData(CURRENT_DAY_STR);
  const eventText = dayData.eventText || '';
  const periods = dayData.periods || {};

  let html = `
    <div class="day-viewer-container">
      <div class="daily-event-banner" style="background:#ffffff; border: 1px solid var(--border-color); border-left: 5px solid #2563eb;">
        <h3 style="font-size: 0.95rem; color: #1e40af; margin-bottom: 8px;">📅 오늘의 전체 일정</h3>
        <div id="day-editor-event" class="editable-cell" contenteditable="true" style="background:#f8fafc; border:1px solid #cbd5e1; min-height: 40px; font-size: 0.9rem; padding: 6px;">${eventText}</div>
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

  for (let p = 1; p <= 6; p++) {
    const pObj = periods[p] || {};
    html += `
            <tr data-period="${p}">
              <td class="period-cell">${p}교시</td>
              <td class="editable-cell cell-subject" contenteditable="true">${pObj.subject || ''}</td>
              <td class="editable-cell cell-supplies" contenteditable="true" style="color: #d97706; font-weight: 600; text-align: left;">${pObj.supplies || ''}</td>
              <td class="editable-cell cell-memo" contenteditable="true" style="text-align: left;">${pObj.memo || ''}</td>
            </tr>
    `;
  }

  html += `</tbody></table></div></div>`;
  container.innerHTML = html;
};

// 3. 🔥 [저장 버튼 클릭 시 실행] 수정 모드의 표 내용을 읽어서 Firestore에 저장
window.saveDayDataFromEditor = async function() {
  const eventEl = document.getElementById("day-editor-event");
  const eventText = eventEl ? eventEl.innerText.trim() : '';

  // 1) 일정 저장
  await window.dbAPI.saveEvent(CURRENT_DAY_STR, eventText);

  // 2) 교시별 수업 저장
  const periodsData = {};
  const rows = document.querySelectorAll("tr[data-period]");
  
  rows.forEach(row => {
    const p = row.getAttribute("data-period");
    const subject = row.querySelector(".cell-subject").innerText.trim();
    const supplies = row.querySelector(".cell-supplies").innerText.trim();
    const memo = row.querySelector(".cell-memo").innerText.trim();

    periodsData[p] = { subject, supplies, memo };
  });

  await window.dbAPI.saveSchedule(CURRENT_DAY_STR, periodsData);
};
