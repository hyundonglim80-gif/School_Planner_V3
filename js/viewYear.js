// js/viewYear.js

// ==========================================================================
// 👁️ 1. 연간 뷰어 모드 (12개 월별 학사일정 그리드 + 이번 달 카드 강조)
// ==========================================================================
window.renderYearViewer = async function(container) {
  container.innerHTML = `<p style="text-align:center; padding: 40px; color:#64748b; font-weight:bold; font-size:var(--font-base);">⏳ 클라우드에서 연간 일정을 분석하여 불러오는 중입니다...</p>`;

  if (!window.db) {
    console.warn("데이터베이스(window.db)가 아직 준비되지 않았습니다.");
    container.innerHTML = `<p style="text-align:center; padding: 40px; color:#ef4444; font-weight:bold;">🚨 데이터베이스 연결 대기 중입니다. 잠시 후 새로고침(F5) 해주세요.</p>`;
    return;
  }

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

  const targetYear = window.currentDate ? window.currentDate.getFullYear() : new Date().getFullYear();
  const nextYear = targetYear + 1;

  const months = [
    { label: "3월", match: `${targetYear}-03-` },
    { label: "4월", match: `${targetYear}-04-` },
    { label: "5월", match: `${targetYear}-05-` },
    { label: "6월", match: `${targetYear}-06-` },
    { label: "7월", match: `${targetYear}-07-` },
    { label: "8월", match: `${targetYear}-08-` },
    { label: "9월", match: `${targetYear}-09-` },
    { label: "10월", match: `${targetYear}-10-` },
    { label: "11월", match: `${targetYear}-11-` },
    { label: "12월", match: `${targetYear}-12-` },
    { label: "1월", match: `${nextYear}-01-` },
    { label: "2월", match: `${nextYear}-02-` }
  ];

  let html = `<div class="year-grid">`;

  const realToday = new Date();
  const realTodayMonthMatch = `${realToday.getFullYear()}-${String(realToday.getMonth() + 1).padStart(2, '0')}-`;
  
  const realTodayStr = typeof window.formatDate === 'function' 
      ? window.formatDate(realToday) 
      : `${realToday.getFullYear()}-${String(realToday.getMonth() + 1).padStart(2, '0')}-${String(realToday.getDate()).padStart(2, '0')}`;

  months.forEach(mObj => {
    const monthEvents = allEvents.filter(e => e.dateStr.startsWith(mObj.match));

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

    const isCurrentMonthCard = (mObj.match === realTodayMonthMatch);
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
// ✏️ 2. 연간 에디터 모드 (월간 수정 레이아웃 + 통합 CSV + 월/일 표기)
// ==========================================================================
window.renderYearEditor = async function(container) {
  container.innerHTML = `<p style="text-align:center; padding: 40px; color:#64748b; font-weight:bold; font-size:var(--font-base);">⏳ 연간 일정 편집 시트를 불러오는 중입니다...</p>`;

  if (!window.db) {
    console.warn("데이터베이스(window.db)가 아직 준비되지 않았습니다.");
    container.innerHTML = `<p style="text-align:center; padding: 40px; color:#ef4444; font-weight:bold;">🚨 데이터베이스 연결 대기 중입니다. 잠시 후 새로고침(F5) 해주세요.</p>`;
    return;
  }

  const currentYear = window.currentDate ? window.currentDate.getFullYear() : new Date().getFullYear();
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

  // 학년도 전체(3월 ~ 이듬해 2월) 날짜 생성 및 데이터 로딩
  const dayPromises = [];

  // 3월 ~ 12월 (현재 연도)
  for (let month = 2; month <= 11; month++) {
    const year = currentYear;
    const lastDay = new Date(year, month + 1, 0).getDate();
    for (let d = 1; d <= lastDay; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      dayPromises.push(window.dbAPI.loadDayData(dateStr).then(data => ({ year, month: month + 1, day: d, dateStr, data })));
    }
  }
  // 1월 ~ 2월 (다음 연도)
  for (let month = 0; month <= 1; month++) {
    const year = currentYear + 1;
    const lastDay = new Date(year, month + 1, 0).getDate();
    for (let d = 1; d <= lastDay; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      dayPromises.push(window.dbAPI.loadDayData(dateStr).then(data => ({ year, month: month + 1, day: d, dateStr, data })));
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
            <th colspan="6" style="padding:8px; border:1px solid #cbd5e1;">📌 내용 (직접 수정)</th>
          </tr>
        </thead>
        <tbody>
  `;

  yearData.forEach(item => {
    const dateObj = new Date(item.year, item.month - 1, item.day);
    const dayOfWeekNum = dateObj.getDay();
    const dayOfWeek = dayNames[dayOfWeekNum];

    if (dayOfWeekNum === 0 || dayOfWeekNum === 6) return; // 주말 제외

    const eventText = (item.data.eventText || '').trim();
    const periods = item.data.periods || {};

    // 연간 수정 날짜 표기: 월과 일을 함께 표시 (예: 3월 3일 / 화)
    html += `<tr data-year-date="${item.dateStr}">` +
      `<td rowspan="2" style="padding:8px 4px; border:1px solid #cbd5e1; background:#f8fafc; vertical-align:middle; width:110px;">` +
        `<div style="display:flex; flex-direction:column; align-items:center; gap:4px;">` +
          `<span style="font-size:1.2rem; font-weight:900; color:#1e40af; line-height:1.1;">${item.month}월 ${item.day}일</span>` +
          `<span style="font-size:0.95rem; font-weight:600; color:#475569; line-height:1;">${dayOfWeek}</span>` +
        `</div>` +
      `</td>` +
      `<td style="padding:4px; border:1px solid #cbd5e1; background:#ecfdf5; color:#047857; font-weight:bold; font-size:0.9rem; vertical-align:middle; width:60px;">수업</td>`;

      // 💡 'X' 대신 빈 문자열('') 할당
      for (let p = 1; p <= 6; p++) {
         const subjText = periods[p] && periods[p].subject && periods[p].subject.toUpperCase() !== 'X' ? periods[p].subject.trim() : '';
         html += `<td class="editable-cell edit-class-cell" data-p="${p}" contenteditable="true" style="padding:6px; border:1px solid #cbd5e1; font-size:1rem; color:#047857; background:#ecfdf5; vertical-align:middle;">${subjText}</td>`;
      }

    html += `</tr>` +
    `<tr data-year-sub="${item.dateStr}">` +
      `<td style="padding:4px; border:1px solid #cbd5e1; background:#f0f9ff; color:#0369a1; font-weight:bold; font-size:0.9rem; vertical-align:middle; width:60px;">일정</td>` +
      `<td colspan="6" class="editable-cell edit-event-cell" contenteditable="true" style="text-align:left; padding:6px 10px; border:1px solid #cbd5e1; font-size:1.1rem; color:#0369a1; background:#f0f9ff; vertical-align:top; line-height:1.4;">${eventText}</td>` +
    `</tr>`;
  });

  html += `</tbody></table></div>`;
  container.innerHTML = html;
};

// ==========================================================================
// 💾 3. 연간 편집 저장 처리 함수
// ==========================================================================
window.saveYearDataFromEditor = async function() {
  const rows = document.querySelectorAll("tr[data-year-date]");
  for (const row of rows) {
    const dateStr = row.getAttribute("data-year-date");
    
    const classCells = row.querySelectorAll(".edit-class-cell");
    const periodsData = {};
    
    // 💡 저장 시에도 빈 문자열로 저장
    classCells.forEach(cell => {
       const p = cell.getAttribute("data-p");
       const subjRaw = (cell.innerText || cell.textContent || "").trim();
       periodsData[p] = {
          subject: (subjRaw.toUpperCase() === 'X' || subjRaw === '') ? '' : subjRaw,
          supplies: '',
          memo: ''
       };
    });

    const nextRow = row.nextElementSibling;
    const eventCell = nextRow ? nextRow.querySelector(".edit-event-cell") : null;
    const eventText = eventCell ? (eventCell.innerText || eventCell.textContent || "").trim() : "";
    
    await window.dbAPI.saveEvent(dateStr, eventText);
    await window.dbAPI.saveSchedule(dateStr, periodsData);
  }
};
