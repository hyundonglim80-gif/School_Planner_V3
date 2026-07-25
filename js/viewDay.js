// js/viewDay.js

/**
 * 💡 현재 선택된 날짜 문자열(YYYY-MM-DD)을 구하는 동적 도우미 함수
 */
const CURRENT_DAY_STR = () => window.formatDate(window.currentDate);

// ==========================================================================
// 👁️ 1. 일간 뷰어 모드 (상단 전체 일정 + 1~6교시 카드 목록)
// ==========================================================================
window.renderDayViewer = async function(container) {
  container.innerHTML = `<p style="text-align:center; padding: 40px; color:#64748b; font-weight:bold; font-size:var(--font-base);">⏳ 클라우드 데이터를 불러오는 중...</p>`;

  const dateStr = CURRENT_DAY_STR();
  // 🔥 Firestore에서 해당 일자 데이터 가져오기
  const dayData = await window.dbAPI.loadDayData(dateStr);
  const eventText = dayData.eventText || '일정 없음';
  const periods = dayData.periods || {};

  let html = `
    <div class="day-viewer-container">
      <div class="daily-event-banner">
        <h3 style="font-size: var(--day-title-font-size);">📌 ${dateStr} 전체 일정</h3>
        <ul class="daily-event-list">
          <li style="font-size: var(--day-content-font-size);">${eventText}</li>
        </ul>
      </div>
      
      <div class="period-card-list">
  `;

  for (let p = 1; p <= 6; p++) {
    const pObj = periods[p] || {};
    html += `
        <div class="period-card">
          <div class="period-card-header">
            <span style="font-weight:700; font-size:var(--day-title-font-size);">⏰ ${p}교시</span>
            ${pObj.subject ? `<span class="badge-tag">${pObj.subject}</span>` : `<span style="color:#94a3b8; font-size:var(--day-title-font-size);">수업 없음</span>`}
          </div>
          <div style="font-size:var(--day-content-font-size); margin-bottom:6px; color:#d97706; font-weight:600;">🎒 준비물: ${pObj.supplies || '없음'}</div>
          <div style="font-size:var(--day-content-font-size); color:#334155;">📝 메모: ${pObj.memo || '-'}</div>
        </div>
    `;
  }

  html += `</div></div>`;
  container.innerHTML = html;
};

// ==========================================================================
// ✏️ 2. 일간 에디터 모드 (오늘 일정 상단 편집 + 1~6교시 표 편집)
// ==========================================================================
window.renderDayEditor = async function(container) {
  container.innerHTML = `<p style="text-align:center; padding: 40px; color:#64748b; font-weight:bold; font-size:var(--font-base);">⏳ 편집 화면을 준비 중...</p>`;

  const dateStr = CURRENT_DAY_STR();
  const dayData = await window.dbAPI.loadDayData(dateStr);
  const eventText = dayData.eventText || '';
  const periods = dayData.periods || {};

  let html = `
    <div class="day-viewer-container">
      <div class="daily-event-banner" style="background:#ffffff; border: 1px solid var(--border-color); border-left: 5px solid #2563eb;">
        <h3 style="font-size: var(--day-title-font-size); color: #1e40af; margin-bottom: 8px;">📅 오늘의 전체 일정</h3>
        <div id="day-editor-event" class="editable-cell" contenteditable="true" style="background:#f8fafc; border:1px solid #cbd5e1; min-height: 40px; font-size: var(--day-content-font-size); padding: 6px;">${eventText}</div>
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

// ==========================================================================
// 💾 3. 일간 저장 처리 함수
// ==========================================================================
window.saveDayDataFromEditor = async function() {
  const dateStr = CURRENT_DAY_STR();
  const eventEl = document.getElementById("day-editor-event");
  const eventText = eventEl ? (eventEl.innerText || eventEl.textContent || '').trim() : '';

  // 1) 전체 일정 저장
  await window.dbAPI.saveEvent(dateStr, eventText);

  // 2) 교시별 상세 수업 정보 저장
  const periodsData = {};
  const rows = document.querySelectorAll("tr[data-period]");
  
  rows.forEach(row => {
    const p = row.getAttribute("data-period");
    
    const subjectEl = row.querySelector(".cell-subject");
    const suppliesEl = row.querySelector(".cell-supplies");
    const memoEl = row.querySelector(".cell-memo");

    const subject = subjectEl ? (subjectEl.innerText || subjectEl.textContent || '').trim() : '';
    const supplies = suppliesEl ? (suppliesEl.innerText || suppliesEl.textContent || '').trim() : '';
    const memo = memoEl ? (memoEl.innerText || memoEl.textContent || '').trim() : '';

    periodsData[p] = { subject, supplies, memo };
  });

  await window.dbAPI.saveSchedule(dateStr, periodsData);
};
