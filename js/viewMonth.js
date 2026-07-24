// js/viewMonth.js

window.renderMonthViewer = async function(container) {
  // 1. 데이터를 불러오는 동안 보여줄 로딩 화면
  container.innerHTML = `<p style="text-align:center; padding: 40px; color:#64748b; font-weight:bold;">⏳ 클라우드에서 월간 일정을 불러오는 중입니다...</p>`;

  let html = `<div class="calendar-grid">`;
  const days = ['일','월','화','수','목','금','토'];
  days.forEach(d => html += `<div class="cal-header">${d}</div>`);

  // 2026년 7월 1일은 수요일이므로 앞의 일, 월, 화 3칸을 비워둠
  for(let i=0; i<3; i++) html += `<div class="cal-day" style="background:#f8fafc;"></div>`;

  // 2. 1일부터 31일까지의 데이터를 비동기로 동시(병렬) 호출하여 로딩 속도 최적화
  const dayPromises = [];
  for(let i=1; i<=31; i++) {
    const dateStr = `2026-07-${String(i).padStart(2, '0')}`;
    dayPromises.push(window.dbAPI.loadDayData(dateStr).then(data => ({ day: i, data })));
  }

  // 모든 날짜 데이터가 도착할 때까지 대기
  const monthData = await Promise.all(dayPromises);

  // 3. 달력 칸 그리기
  monthData.forEach(item => {
    const d = item.day;
    const eventText = item.data.eventText || ''; // 클라우드에서 불러온 일정
    
    // 요일 계산 (7월 1일이 수요일이므로)
    const isSunday = (d + 2) % 7 === 0;
    const isSaturday = (d + 2) % 7 === 6;

    let dayStyle = "font-weight:700; font-size:0.9rem; margin-bottom:4px; ";
    if(isSunday) dayStyle += "color:#ef4444;"; // 일요일 빨간색
    else if(isSaturday) dayStyle += "color:#3b82f6;"; // 토요일 파란색

    // 일정이 있으면 달력 칸에 표시 (줄 바꿈 속성 포함)
    let eventHtml = '';
    if(eventText) {
       eventHtml = `<div class="cal-event" style="white-space: pre-wrap; font-size:0.75rem;">${eventText}</div>`;
    }

    html += `<div class="cal-day"><div style="${dayStyle}">${d}</div>${eventHtml}</div>`;
  });

  html += `</div>`;
  container.innerHTML = html;
};

// 💡 월간 수정 모드는 안전을 위해 '주/일' 보기로 유도합니다.
window.renderMonthEditor = function(container) {
  container.innerHTML = `
    <div style="text-align:center; padding:50px; background:#fff; border-radius:8px; border:1px solid #cbd5e1;">
      <h3 style="color:#1e293b; margin-bottom:10px;">월간 일정 수정 안내</h3>
      <p style="color:#64748b;">달력 형태에서는 세부 수업과 메모를 작성하기 어렵습니다.<br>일정 수정 및 추가는 <b>'주' 또는 '일' 보기</b> 화면에서 진행해 주세요!</p>
      <button onclick="setMode('viewer')" style="margin-top:20px; padding:8px 16px; background:#3b82f6; color:#fff; border:none; border-radius:6px; cursor:pointer;">👁️ 뷰어 모드로 돌아가기</button>
    </div>
  `;
};
