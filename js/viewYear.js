// js/viewYear.js

// ==========================================================================
// 👁️ 1. 연간 뷰어 모드 (12개 월별 학사일정 그리드 + 이번 달 카드 강조)
// ==========================================================================
window.renderYearViewer = async function(container) {
  container.innerHTML = `<p style="text-align:center; padding: 40px; color:#64748b; font-weight:bold; font-size:var(--font-base);">⏳ 클라우드에서 연간 일정을 분석하여 불러오는 중입니다...</p>`;

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

  // 학년도 기준 월 (3월 ~ 다음 해 2월)
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
                  <div style="color:#2563eb; font-weight:700;">${dayNum}일(${dayOfWeek})${isTodayEvent ? '🎯 오늘' : ''}</div>
                  <div style="color:#334155; white-space:pre-wrap; word-break:break-all; margin-top:2px; font-size:var(--year-event-font-size);">${e.text}</div>
                </div>`;
      }).join('');
    } else {
      eventListHtml = `<div style="text-align:center; color:#94a3b8; font-size:0.9rem; padding-top:10px;">일정 없음</div>`;
    }

    const isCurrentMonthCard = (mObj.match === currentMonthMatch && String(window.currentDate.getFullYear()) === currentYearStr);
    const cardClass = isCurrentMonthCard ? 'year-today-card' : '';

    html += `
      <div class="mini-month ${cardClass}" style="display:flex; flex-direction:column; gap:8px;">
        <h3 style="color:#1e40af; border-bottom:2px solid #bfdbfe; padding-bottom:4px; text-align:center;">${mObj.label}</h3>
        <div style="line-height:1.4;">
          ${eventListHtml}
        </div>
      </div>`;
  });

  html += `</div>`;
  container.innerHTML = html;
};

// ==========================================================================
// ✏️ 2. 연간 에디터 모드 (행 추가/삭제 지원 연간 일정 관리 표 + 백업 패널)
// ==========================================================================
window.renderYearEditor = async function(container) {
  container.innerHTML = `<p style="text-align:center; padding: 40px; color:#64748b; font-weight:bold; font-size:var(--font-base);">⏳ 연간 일정 편집 시트를 불러오는 중입니다...</p>`;

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

  // 💡 데이터 백업 및 대량 등록 (CSV) 패널 추가
  let html = `
    <div style="background:#f8fafc; padding:16px; border-radius:8px; border:1px solid #cbd5e1; margin-bottom:16px; text-align:left;">
      <h3 style="margin-bottom:12px; color:#1e293b; font-size:1.2rem;">💾 데이터 백업 및 대량 등록 (CSV)</h3>
      <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
        <span style="font-weight:bold; color:#0369a1;">[일정 관리]</span>
        <button onclick="downloadEventsCSV()" style="padding:6px 12px; background:#3b82f6; color:#fff; border:none; border-radius:6px; cursor:pointer;">📥 다운로드</button>
        <button onclick="document.getElementById('upload-events-file').click()" style="padding:6px 12px; background:#ef4444; color:#fff; border:none; border-radius:6px; cursor:pointer;">📤 업로드(동기화)</button>
        <input type="file" id="upload-events-file" accept=".csv" style="display:none;" onchange="uploadEventsCSV(this)">

        <span style="font-weight:bold; color:#15803d; margin-left:16px;">[시간표 관리]</span>
        <button onclick="downloadSchedulesCSV()" style="padding:6px 12px; background:#10b981; color:#fff; border:none; border-radius:6px; cursor:pointer;">📥 다운로드</button>
        <button onclick="document.getElementById('upload-schedules-file').click()" style="padding:6px 12px; background:#f59e0b; color:#fff; border:none; border-radius:6px; cursor:pointer;">📤 업로드(동기화)</button>
        <input type="file" id="upload-schedules-file" accept=".csv" style="display:none;" onchange="uploadSchedulesCSV(this)">
      </div>
      <p style="font-size:0.95rem; color:#ef4444; margin-top:8px; font-weight:bold;">
        * 주의: 📤 업로드 시 선택한 파일이 원본이 되어, 기존 데이터는 파일과 일치하도록 덮어씌워지거나 삭제됩니다!
      </p>
    </div>

    <div class="table-container" style="background:#fff; padding:16px; border-radius:8px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <h3 style="color:#1e293b; font-size:var(--font-header-title);">📋 연간 일정 관리 시트</h3>
        <button onclick="addYearEventRow()" style="padding:8px 14px; background:#10b981; color:#fff; border:none; border-radius:6px; font-weight:bold; cursor:pointer; font-size:1rem;">➕ 일정 행 추가</button>
      </div>
      <table style="width:100%; border-collapse:collapse; text-align:left;">
        <thead>
          <tr style="background:#f1f5f9; text-align:center;">
            <th style="width:180px; padding:10px; border:1px solid #cbd5e1;">날짜</th>
            <th style="padding:10px; border:1px solid #cbd5e1;">📌 행사/일정 내용</th>
            <th style="width:80px; padding:10px; border:1px solid #cbd5e1;">삭제</th>
          </tr>
        </thead>
        <tbody id="year-editor-tbody">
  `;

// [수정 후] 연간 에디터 모드 일부
window.renderYearEditor = async function(container) {
  container.innerHTML = `<p style="text-align:center; padding: 40px; color:#64748b; font-weight:bold; font-size:var(--font-base);">⏳ 연간 일정 편집 시트를 불러오는 중입니다...</p>`;

  // 💡 현재 선택된 년도 값을 확실하게 가져오도록 보완
  const currentYear = window.currentDate ? window.currentDate.getFullYear() : new Date().getFullYear();

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
    <div style="background:#f8fafc; padding:16px; border-radius:8px; border:1px solid #cbd5e1; margin-bottom:16px; text-align:left;">
      <h3 style="margin-bottom:12px; color:#1e293b; font-size:1.2rem;">💾 데이터 백업 및 대량 등록 (CSV)</h3>
      <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
        <span style="font-weight:bold; color:#0369a1;">[일정 관리]</span>
        <button onclick="downloadEventsCSV()" style="padding:6px 12px; background:#3b82f6; color:#fff; border:none; border-radius:6px; cursor:pointer;">📥 다운로드</button>
        <button onclick="document.getElementById('upload-events-file').click()" style="padding:6px 12px; background:#ef4444; color:#fff; border:none; border-radius:6px; cursor:pointer;">📤 업로드(동기화)</button>
        <input type="file" id="upload-events-file" accept=".csv" style="display:none;" onchange="uploadEventsCSV(this)">

        <span style="font-weight:bold; color:#15803d; margin-left:16px;">[시간표 관리]</span>
        <button onclick="downloadSchedulesCSV()" style="padding:6px 12px; background:#10b981; color:#fff; border:none; border-radius:6px; cursor:pointer;">📥 다운로드</button>
        <button onclick="document.getElementById('upload-schedules-file').click()" style="padding:6px 12px; background:#f59e0b; color:#fff; border:none; border-radius:6px; cursor:pointer;">📤 업로드(동기화)</button>
        <input type="file" id="upload-schedules-file" accept=".csv" style="display:none;" onchange="uploadSchedulesCSV(this)">
      </div>
      <p style="font-size:0.95rem; color:#ef4444; margin-top:8px; font-weight:bold;">
        * 주의: 📤 업로드 시 선택한 파일이 원본이 되어, 기존 데이터는 파일과 일치하도록 덮어씌워지거나 삭제됩니다!
      </p>
    </div>

    <div class="table-container" style="background:#fff; padding:16px; border-radius:8px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <h3 style="color:#1e293b; font-size:var(--font-header-title);">📋 ${currentYear}년 연간 일정 관리 시트</h3>
        <button onclick="addYearEventRow()" style="padding:8px 14px; background:#10b981; color:#fff; border:none; border-radius:6px; font-weight:bold; cursor:pointer; font-size:1rem;">➕ 일정 행 추가</button>
      </div>
      <table style="width:100%; border-collapse:collapse; text-align:left;">
        <thead>
          <tr style="background:#f1f5f9; text-align:center;">
            <th style="width:180px; padding:10px; border:1px solid #cbd5e1;">날짜</th>
            <th style="padding:10px; border:1px solid #cbd5e1;">📌 행사/일정 내용</th>
            <th style="width:80px; padding:10px; border:1px solid #cbd5e1;">삭제</th>
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
        <td class="editable-cell year-event-cell" contenteditable="true" style="padding:8px; border:1px solid #cbd5e1; color:#0369a1; background:#f0f9ff; white-space:pre-wrap;"></td>
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
          <td class="editable-cell year-event-cell" contenteditable="true" style="padding:8px; border:1px solid #cbd5e1; color:#0369a1; background:#f0f9ff; white-space:pre-wrap;">${e.text}</td>
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

// ➕ 동적 연간 일정 행 추가 함수
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
    <td class="editable-cell year-event-cell" contenteditable="true" style="padding:8px; border:1px solid #cbd5e1; color:#0369a1; background:#f0f9ff; white-space:pre-wrap;"></td>
    <td style="text-align:center; padding:8px; border:1px solid #cbd5e1;">
      <button onclick="this.closest('tr').remove()" style="background:#ef4444; color:#fff; border:none; padding:6px 10px; border-radius:4px; cursor:pointer;">🗑️</button>
    </td>
  `;
  tbody.appendChild(tr);
};

// ==========================================================================
// 💾 3. 연간 편집 저장 처리 함수
// ==========================================================================
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
