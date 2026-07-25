// js/viewMonth.js

// ==========================================================================
// 👁️ 1. 월간 뷰어 모드 (주말 제외 평일 5단 달력 + 오늘 강조)
// ==========================================================================
window.renderMonthViewer = async function(container) {
  container.innerHTML = `<p style="text-align:center; padding: 40px; color:#64748b; font-weight:bold; font-size:var(--font-base);">⏳ 클라우드에서 월간 일정을 불러오는 중입니다...</p>`;

  // 💡 DB 로드 지연 시 방어 코드
  if (!window.db) {
    console.warn("데이터베이스(window.db)가 아직 준비되지 않았습니다.");
    container.innerHTML = `<p style="text-align:center; padding: 40px; color:#ef4444; font-weight:bold;">🚨 데이터베이스 연결 대기 중입니다. 잠시 후 새로고침(F5) 해주세요.</p>`;
    return;
  }

  let html = `<div class="calendar-grid">`;
  const days = ['월','화','수','목','금'];
  days.forEach(d => html += `<div class="cal-header">${d}</div>`);

  const y = window.currentDate.getFullYear();
  const m = window.currentDate.getMonth();
  const firstDay = new Date(y, m, 1).getDay(); 
  const lastDate = new Date(y, m + 1, 0).getDate(); 

  // 월요일 시작 기준 빈 칸 계산
  let padding = 0;
  if (firstDay >= 1 && firstDay <= 5) {
    padding = firstDay - 1; 
  }
  for(let i=0; i<padding; i++) {
    html += `<div class="cal-day" style="background:#f8fafc;"></div>`;
  }

  // 1일부터 마지막 날까지 이벤트 데이터 호출
  const dayPromises = [];
  for(let i=1; i<=lastDate; i++) {
    const dateStr = `${y}-${String(m+1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    dayPromises.push(window.dbAPI.loadDayData(dateStr).then(data => ({ day: i, data, dateStr })));
  }
  const monthData = await Promise.all(dayPromises);

  // 💡 월간 뷰 날짜 옆에 표시할 '시간표(schedules)' 데이터를 통째로 로드
  let scheduleMap = {};
  try {
    const snap = await window.db.collection('schedules').get();
    snap.forEach(doc => {
      scheduleMap[doc.id] = doc.data().periods || {};
    });
  } catch(e) {
    console.error("시간표 로딩 에러:", e);
  }

  // 안전한 날짜 포맷 변환 (에러 방지)
  const realToday = new Date();
  const realTodayStr = typeof window.formatDate === 'function' 
      ? window.formatDate(realToday) 
      : `${realToday.getFullYear()}-${String(realToday.getMonth() + 1).padStart(2, '0')}-${String(realToday.getDate()).padStart(2, '0')}`;

  monthData.forEach(item => {
    const d = item.day;
    const dateStr = item.dateStr;
    const eventText = item.data.eventText || '';
    
    const dateObj = new Date(y, m, d);
    const dayOfWeekNum = dateObj.getDay();
    
    // 주말(토, 일) 제외
    if (dayOfWeekNum === 0 || dayOfWeekNum === 6) return;

    // 💡 1~6교시 시간표(수업) 여부를 체크하여 문자열 생성 (수업1, 수업2, X ...)
    const dayPeriods = scheduleMap[dateStr] || {};
    let periodLabels = [];
    let hasClass = false;

    for (let p = 1; p <= 6; p++) {
      const subject = dayPeriods[p] ? dayPeriods[p].subject : null;
      if (subject && subject.trim() !== '') {
        periodLabels.push(subject.trim());
        hasClass = true;
      } else {
        periodLabels.push('X'); // 수업이 없으면 X 표시
      }
    }

    // 💡 수업 정보 박스(배지) HTML 생성
    let scheduleHtml = '';
    if (hasClass) {
      scheduleHtml = `<span style="font-size:0.75rem; color:#047857; background:#ecfdf5; border:1px solid #a7f3d0; border-radius:4px; padding:2px 6px; margin-left:6px; font-weight:600; display:inline-block; line-height:1.2; word-break:keep-all;">수업(${periodLabels.join(',')})</span>`;
    }

    // 날짜와 박스가 나란히 중앙 정렬되도록 display: flex; align-items: center; 적용
    let dayStyle = "font-weight:700; margin-bottom:4px; color:#334155; display:flex; align-items:center;";

    let eventHtml = '';
    if(eventText) {
       eventHtml = `<div class="cal-event" style="white-space: pre-wrap;">${eventText}</div>`;
    }

    // 오늘 날짜 체크 후 강조 클래스 적용
    const isToday = (dateStr === realTodayStr);
    const todayClass = isToday ? 'month-today-cell' : '';

    html += `<div class="cal-day ${todayClass}">
      <div style="${dayStyle}">${d} ${scheduleHtml}</div>
      ${eventHtml}
    </div>`;
  });

  html += `</div>`;
  container.innerHTML = html;
};

// ==========================================================================
// ✏️ 2. 월간 에디터 모드 (월간 평일 세로 목록 스프레드시트 편집 - 가변 높이 적용)
// ==========================================================================
window.renderMonthEditor = async function(container) {
  container.innerHTML = `<p style="text-align:center; padding: 40px; color:#64748b; font-weight:bold; font-size:var(--font-base);">⏳ 월간 편집 시트를 불러오는 중입니다...</p>`;

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

    <div class="table-container" style="background:#fff; padding:12px; border-radius:8px;">
      <h3 style="margin-bottom:12px; color:#1e293b; font-size:var(--font-header-title);">📅 ${y}년 ${m+1}월 일정 편집 시트</h3>
      <table style="width:100%; border-collapse:collapse; text-align:left;">
        <thead>
          <tr style="background:#f1f5f9; text-align:center;">
            <th style="width:120px; padding:10px; border:1px solid #cbd5e1;">날짜</th>
            <th style="padding:10px; border:1px solid #cbd5e1;">📌 일정 내용 (직접 수정/입력/삭제)</th>
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

    if (dayOfWeekNum === 0 || dayOfWeekNum === 6) return; // 주말 제외

    const eventText = item.data.eventText || '';

    html += `
      <tr data-month-date="${item.dateStr}">
        <td style="text-align:center; padding:6px 8px; border:1px solid #cbd5e1; background:#f8fafc; font-weight:bold; font-size:1.1rem; vertical-align:middle;">
          ${m+1}/${dayNum} (${dayOfWeek})
        </td>
        <td class="editable-cell month-event-cell" contenteditable="true" style="padding:6px 8px; border:1px solid #cbd5e1; font-size:1.1rem; color:#0369a1; background:#f0f9ff; white-space:pre-wrap; height:auto; vertical-align:top;">${eventText}</td>
      </tr>
    `;
  });

  html += `</tbody></table></div>`;
  container.innerHTML = html;
};

// ==========================================================================
// 💾 3. 월간 편집 저장 처리 함수
// ==========================================================================
window.saveMonthDataFromEditor = async function() {
  const rows = document.querySelectorAll("tr[data-month-date]");
  for (const row of rows) {
    const dateStr = row.getAttribute("data-month-date");
    const eventCell = row.querySelector(".month-event-cell");
    const eventText = eventCell ? (eventCell.innerText || eventCell.textContent || "").trim() : "";
    await window.dbAPI.saveEvent(dateStr, eventText);
  }
};
