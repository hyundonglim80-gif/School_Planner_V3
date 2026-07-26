// js/viewMonth.js

// ==========================================================================
// 👁️ 1. 월간 뷰어 모드 (주말 제외 평일 5단 달력 + 오늘 강조 + 1~6교시 수업 박스)
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

    // 💡 1~6교시 6개의 독립된 네모 박스 생성
    const dayPeriods = scheduleMap[dateStr] || {};
    let boxesHtml = '';
    let hasClass = false;

    for (let p = 1; p <= 6; p++) {
      const subject = dayPeriods[p] ? dayPeriods[p].subject : null;
      if (subject && subject.trim() !== '') {
        // 수업이 있는 교시: 초록색 네모 박스
        boxesHtml += `<div style="display:flex; align-items:center; justify-content:center; padding:2px 4px; margin-left:3px; border:1px solid #6ee7b7; border-radius:4px; background:#ecfdf5; color:#047857; font-size:0.75rem; font-weight:700; min-width:24px; white-space:nowrap;">${subject.trim()}</div>`;
        hasClass = true;
      } else {
        // 수업이 없는 교시: 연한 회색 X 네모 박스
        boxesHtml += `<div style="display:flex; align-items:center; justify-content:center; padding:2px 4px; margin-left:3px; border:1px solid #e2e8f0; border-radius:4px; background:#f8fafc; color:#94a3b8; font-size:0.75rem; font-weight:700; min-width:24px;">X</div>`;
      }
    }

    // 수업이 하루라도 등록되어 있으면 6개의 박스를 묶어서 화면에 표시
    let scheduleHtml = '';
    if (hasClass) {
      scheduleHtml = `<div style="display:flex; margin-left:8px;">${boxesHtml}</div>`;
    }

    // 날짜 숫자와 6개의 박스 묶음이 수평으로 나란히 배치되도록 설정
    let dayStyle = "font-weight:700; margin-bottom:4px; color:#334155; display:flex; align-items:center;";

    let eventHtml = '';
    if(eventText) {
       eventHtml = `<div class="cal-event" style="white-space: pre-wrap;">${eventText}</div>`;
    }

    // 오늘 날짜 체크 후 강조 클래스 적용
    const isToday = (dateStr === realTodayStr);
    const todayClass = isToday ? 'month-today-cell' : '';

    html += `<div class="cal-day ${todayClass}">
      <div style="${dayStyle}">${d} ${scheduleHtml}</div>${eventHtml}
    </div>`;
  });

  html += `</div>`;
  container.innerHTML = html;
};

// ==========================================================================
// ✏️ 2. 월간 에디터 모드 (빈 공간 완벽 제거 및 세 줄짜리 날짜 표기 적용)
// ==========================================================================
window.renderMonthEditor = async function(container) {
  container.innerHTML = `<p style="text-align:center; padding: 40px; color:#64748b; font-weight:bold; font-size:var(--font-base);">⏳ 월간 편집 시트를 불러오는 중입니다...</p>`;

  if (!window.db) {
    console.warn("데이터베이스(window.db)가 아직 준비되지 않았습니다.");
    container.innerHTML = `<p style="text-align:center; padding: 40px; color:#ef4444; font-weight:bold;">🚨 데이터베이스 연결 대기 중입니다. 잠시 후 새로고침(F5) 해주세요.</p>`;
    return;
  }

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

  // 💡 데이터 백업 및 대량 등록 (CSV) 패널
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
    </div>

    <div class="table-container" style="background:#fff; padding:12px; border-radius:8px;">
      <h3 style="margin-bottom:12px; color:#1e293b; font-size:var(--font-header-title);">📅 ${y}년 ${m+1}월 일정/수업 편집 시트</h3>
      <table style="width:100%; border-collapse:collapse; text-align:left;">
        <thead>
          <tr style="background:#f1f5f9; text-align:center;">
            <th style="width:90px; padding:8px; border:1px solid #cbd5e1;">날짜</th>
            <th style="width:60px; padding:8px; border:1px solid #cbd5e1;">구분</th>
            <th style="padding:8px; border:1px solid #cbd5e1;">📌 내용 (빈 공간 없이 1줄 크기 자동조절)</th>
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

    const eventText = (item.data.eventText || '').trim();
    const periods = item.data.periods || {};

    let periodList = [];
    for(let p=1; p<=6; p++) {
      periodList.push(periods[p] && periods[p].subject ? periods[p].subject.trim() : 'X');
    }
    const classText = periodList.join(',').trim();

    // 🚨 여기서부터가 핵심입니다! <td> 태그 안에 띄어쓰기(엔터)를 일절 허용하지 않고 코드를 밀착시켰습니다.
    // 💡 날짜 표시: 요일(제일 크게) -> 월 -> 일 순으로 3줄 표기
    html += `
      <tr data-month-date="${item.dateStr}">
        <td rowspan="2" style="text-align:center; padding:12px 4px; border:1px solid #cbd5e1; background:#f8fafc; vertical-align:middle; width:90px;">
          <div style="display:flex; flex-direction:column; align-items:center; gap:2px;">
            <span style="font-size: 1.6rem; font-weight: 900; color: #1e40af;">${dayOfWeek}</span>
            <span style="font-size: 1rem; font-weight: 600; color: #475569;">${m+1}월</span>
            <span style="font-size: 1rem; font-weight: 600; color: #475569;">${dayNum}일</span>
          </div>
        </td>
        <td style="text-align:center; padding:6px; border:1px solid #cbd5e1; background:#ecfdf5; color:#047857; font-weight:bold; font-size:0.95rem; vertical-align:middle; width:60px;">
          수업
        </td>
        <td class="editable-cell edit-class-cell" contenteditable="true" style="padding:8px 10px; border:1px solid #cbd5e1; font-size:1.05rem; color:#047857; background:#ecfdf5; vertical-align:top; line-height:1.4;" title="예: 국어,수학,X,과학,음악,X">${classText}</td>
      </tr>
      <tr data-month-sub="${item.dateStr}">
        <td style="text-align:center; padding:6px; border:1px solid #cbd5e1; background:#f0f9ff; color:#0369a1; font-weight:bold; font-size:0.95rem; vertical-align:middle; width:60px;">
          일정
        </td>
        <td class="editable-cell edit-event-cell" contenteditable="true" style="padding:8px 10px; border:1px solid #cbd5e1; font-size:1.05rem; color:#0369a1; background:#f0f9ff; vertical-align:top; line-height:1.4;">${eventText}</td>
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
    const classCell = row.querySelector(".edit-class-cell");
    
    // 다음 행(sub row)에서 일정 셀 추출
    const nextRow = row.nextElementSibling;
    const eventCell = nextRow ? nextRow.querySelector(".edit-event-cell") : null;
    
    // 1) 일정(events) 저장
    const eventText = eventCell ? (eventCell.innerText || eventCell.textContent || "").trim() : "";
    await window.dbAPI.saveEvent(dateStr, eventText);

    // 2) 수업(schedules) 저장
    if (classCell) {
      const classRaw = (classCell.innerText || classCell.textContent || "").trim();
      const subjects = classRaw.split(',').map(s => s.trim());
      
      const periodsData = {};
      for (let p = 1; p <= 6; p++) {
        const subj = subjects[p - 1] || 'X';
        periodsData[p] = {
          subject: (subj.toUpperCase() === 'X' || subj === '') ? '' : subj,
          supplies: '',
          memo: ''
        };
      }
      await window.dbAPI.saveSchedule(dateStr, periodsData);
    }
  }
};
