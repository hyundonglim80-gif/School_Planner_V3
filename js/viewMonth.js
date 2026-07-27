// js/viewMonth.js

// ==========================================================================
// 👁️ 1. 월간 뷰어 모드 (주말 제외 평일 5단 달력 + 오늘 강조 + 1~6교시 수업 박스)
// ==========================================================================
window.renderMonthViewer = async function(container) {
  container.innerHTML = `<p style="text-align:center; padding: 40px; color:#64748b; font-weight:bold; font-size:var(--font-base);">⏳ 클라우드에서 월간 일정을 불러오는 중입니다...</p>`;

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

  let padding = 0;
  if (firstDay >= 1 && firstDay <= 5) {
    padding = firstDay - 1; 
  }
  for(let i=0; i<padding; i++) {
    html += `<div class="cal-day" style="background:#f8fafc;"></div>`;
  }

  const dayPromises = [];
  for(let i=1; i<=lastDate; i++) {
    const dateStr = `${y}-${String(m+1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    dayPromises.push(window.dbAPI.loadDayData(dateStr).then(data => ({ day: i, data, dateStr })));
  }
  const monthData = await Promise.all(dayPromises);

  let scheduleMap = {};
  try {
    const snap = await window.db.collection('schedules').get();
    snap.forEach(doc => {
      scheduleMap[doc.id] = doc.data().periods || {};
    });
  } catch(e) {
    console.error("시간표 로딩 에러:", e);
  }

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
    
    if (dayOfWeekNum === 0 || dayOfWeekNum === 6) return;

    const dayPeriods = scheduleMap[dateStr] || {};
    let boxesHtml = '';
    let hasClass = false;

    // 💡 월간 달력 뷰어에서 'X' 출력 방지 및 빈 박스 처리
    for (let p = 1; p <= 6; p++) {
      const subject = dayPeriods[p] ? dayPeriods[p].subject : null;
      if (subject && subject.trim() !== '' && subject.toUpperCase() !== 'X') {
        const text = subject.trim();
        
        // 🎯 한 줄 배치를 위한 폰트/자간 축소 로직 유지
        let fontSize = "0.75rem";
        let letterSpacing = "normal";
        if (text.length === 3) {
          fontSize = "0.65rem";
          letterSpacing = "-0.5px";
        } else if (text.length === 4) {
          fontSize = "0.55rem";
          letterSpacing = "-1px";
        } else if (text.length >= 5) {
          fontSize = "0.45rem";
          letterSpacing = "-1.5px";
        }

        // 💡 [핵심 변경] width 고정을 없애고 `flex: 1; min-width: 0;`을 부여하여 무조건 6등분 꽉 채우기
        boxesHtml += `<div style="display:flex; align-items:center; justify-content:center; flex:1; min-width:0; height:22px; box-sizing:border-box; border:1px solid #6ee7b7; border-radius:4px; background:#ecfdf5; color:#047857; font-size:${fontSize}; font-weight:700; letter-spacing:${letterSpacing}; white-space:nowrap; overflow:hidden;">${text}</div>`;
        hasClass = true;
      } else {
        // 💡 빈 박스도 동일하게 `flex: 1; min-width: 0;` 적용
        boxesHtml += `<div style="display:flex; align-items:center; justify-content:center; flex:1; min-width:0; height:22px; box-sizing:border-box; border:1px solid #e2e8f0; border-radius:4px; background:#f8fafc; color:#94a3b8; font-size:0.75rem; font-weight:700;">&nbsp;</div>`;
      }
    }

    let scheduleHtml = '';
    if (hasClass) {
      // 💡 [핵심 변경] 컨테이너에 `width: 100%;`를 주어 날짜 칸의 가로 영역을 모두 사용하게 함
      scheduleHtml = `<div style="display:flex; flex-wrap:nowrap; gap:2px; margin-top:4px; margin-bottom:4px; width:100%;">${boxesHtml}</div>`;
    }

    // 💡 날짜 표시 영역 독립 분리
    let dayNumHtml = `<div style="font-weight:700; color:#334155; font-size:1.1rem;">${d}</div>`;
    
    let eventHtml = '';
    if(eventText) {
       eventHtml = `<div class="cal-event" style="white-space: pre-wrap; margin-top:4px;">${eventText}</div>`;
    }

    const isToday = (dateStr === realTodayStr);
    const todayClass = isToday ? 'month-today-cell' : '';

    html += `<div class="cal-day ${todayClass}">${dayNumHtml}${scheduleHtml}${eventHtml}</div>`;
  });

  html += `</div>`;
  container.innerHTML = html;
};

// ==========================================================================
// ✏️ 2. 월간 에디터 모드 (통합 CSV 버튼 + 1~6교시 헤더 제거 + 'X' 제거)
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

  let html = `
    <div style="background:#f8fafc; padding:16px; border-radius:8px; border:1px solid #cbd5e1; margin-bottom:16px; text-align:left;">
      <h3 style="margin-bottom:12px; color:#1e293b; font-size:1.2rem;">💾 데이터 백업 및 대량 등록 (CSV)</h3>
      <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
        <button onclick="downloadCSV()" style="padding:6px 14px; background:#3b82f6; color:#fff; border:none; border-radius:6px; cursor:pointer; font-weight:bold;">📥 백업 다운로드 (CSV)</button>
        <button onclick="document.getElementById('upload-csv-file').click()" style="padding:6px 14px; background:#ef4444; color:#fff; border:none; border-radius:6px; cursor:pointer; font-weight:bold;">📤 업로드/동기화 (CSV)</button>
        <input type="file" id="upload-csv-file" accept=".csv" style="display:none;" onchange="uploadCSV(this)">
      </div>
      <p style="font-size:0.95rem; color:#ef4444; margin-top:8px; font-weight:bold;">
        * 주의: 📤 업로드 시 선택한 파일이 원본이 되어, 기존 데이터는 파일과 일치하도록 덮어씌워지거나 삭제됩니다!
      </p>
    </div>

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

    if (dayOfWeekNum === 0 || dayOfWeekNum === 6) return; // 주말 제외

    const eventText = (item.data.eventText || '').trim();
    const periods = item.data.periods || {};

    html += `<tr data-month-date="${item.dateStr}">` +
      `<td rowspan="2" style="padding:8px 4px; border:1px solid #cbd5e1; background:#f8fafc; vertical-align:middle; width:80px;">` +
        `<div style="display:flex; flex-direction:column; align-items:center; gap:4px;">` +
          `<span style="font-size:1.8rem; font-weight:900; color:#1e40af; line-height:1;">${dayNum}</span>` +
          `<span style="font-size:1rem; font-weight:600; color:#475569; line-height:1;">${dayOfWeek}</span>` +
        `</div>` +
      `</td>` +
      `<td style="padding:4px; border:1px solid #cbd5e1; background:#ecfdf5; color:#047857; font-weight:bold; font-size:0.9rem; vertical-align:middle; width:60px;">수업</td>`;
      
      // 💡 에디터 칸에 출력 시 'X' 대신 빈 문자열 할당
      for(let p=1; p<=6; p++) {
         const subjText = periods[p] && periods[p].subject && periods[p].subject.toUpperCase() !== 'X' ? periods[p].subject.trim() : '';
         html += `<td class="editable-cell edit-class-cell" data-p="${p}" contenteditable="true" style="padding:6px; border:1px solid #cbd5e1; font-size:1rem; color:#047857; background:#ecfdf5; vertical-align:middle;">${subjText}</td>`;
      }
      
    html += `</tr>` +
    `<tr data-month-sub="${item.dateStr}">` +
      `<td style="padding:4px; border:1px solid #cbd5e1; background:#f0f9ff; color:#0369a1; font-weight:bold; font-size:0.9rem; vertical-align:middle; width:60px;">일정</td>` +
      `<td colspan="6" class="editable-cell edit-event-cell" contenteditable="true" style="text-align:left; padding:6px 10px; border:1px solid #cbd5e1; font-size:1.1rem; color:#0369a1; background:#f0f9ff; vertical-align:top; line-height:1.4;">${eventText}</td>` +
    `</tr>`;
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
    
    const classCells = row.querySelectorAll(".edit-class-cell");
    const periodsData = {};
    
    // 💡 DB에 저장할 때도 'X' 대신 빈 문자열로 저장
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
