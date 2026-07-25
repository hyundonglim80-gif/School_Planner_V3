// js/viewMonth.js

window.renderMonthViewer = async function(container) {
  container.innerHTML = `<p style="text-align:center; padding: 40px; color:#64748b; font-weight:bold; font-size:1.2rem;">⏳ 클라우드에서 월간 일정을 불러오는 중입니다...</p>`;

  let html = `<div class="calendar-grid">`;
  const days = ['일','월','화','수','목','금','토'];
  days.forEach(d => html += `<div class="cal-header" style="font-size:1.2rem;">${d}</div>`);

  // 동적으로 이번 달 1일의 요일과 마지막 날짜 구하기
  const y = window.currentDate.getFullYear();
  const m = window.currentDate.getMonth();
  const firstDay = new Date(y, m, 1).getDay(); // 1일의 요일 (0:일 ~ 6:토)
  const lastDate = new Date(y, m + 1, 0).getDate(); // 이번 달의 마지막 날짜

  // 시작 요일 앞의 빈 칸 채우기
  for(let i=0; i<firstDay; i++) {
    html += `<div class="cal-day" style="background:#f8fafc;"></div>`;
  }

  // 1일부터 마지막 날짜까지 데이터 불러오기
  const dayPromises = [];
  for(let i=1; i<=lastDate; i++) {
    const dateStr = `${y}-${String(m+1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    dayPromises.push(window.dbAPI.loadDayData(dateStr).then(data => ({ day: i, data })));
  }

  const monthData = await Promise.all(dayPromises);
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

  // 달력 칸 그리기
  monthData.forEach(item => {
    const d = item.day;
    const eventText = item.data.eventText || '';
    
    const dateObj = new Date(y, m, d);
    const dayOfWeek = dayNames[dateObj.getDay()];
    const isSunday = dateObj.getDay() === 0;
    const isSaturday = dateObj.getDay() === 6;

    let dayStyle = "font-weight:700; font-size:1.1rem; margin-bottom:4px; ";
    if(isSunday) dayStyle += "color:#ef4444;";
    else if(isSaturday) dayStyle += "color:#3b82f6;";

    let eventHtml = '';
    if(eventText) {
       eventHtml = `<div class="cal-event" style="white-space: pre-wrap; font-size:0.95rem; padding:4px; margin-top:2px;">${eventText}</div>`;
    }

    // 💡 날짜(요일)을 첫 번째 줄에 출력, 그 아래 줄바꿈 후 일정 표시
    html += `<div class="cal-day">
      <div style="${dayStyle}">${d}일(${dayOfWeek})</div>
      ${eventHtml}
    </div>`;
  });

  html += `</div>`;
  container.innerHTML = html;
};

window.renderMonthEditor = function(container) {
  container.innerHTML = `
    <div style="text-align:center; padding:50px; background:#fff; border-radius:8px; border:1px solid #cbd5e1;">
      <h3 style="color:#1e293b; margin-bottom:10px; font-size:1.5rem;">월간 일정 수정 안내</h3>
      <p style="color:#64748b; font-size:1.2rem; line-height:1.5;">달력 형태에서는 세부 수업과 메모를 작성하기 어렵습니다.<br>일정 수정 및 추가는 <b>'주' 또는 '일' 보기</b> 화면에서 진행해 주세요!</p>
      <button onclick="setMode('viewer')" style="margin-top:20px; padding:10px 20px; font-size:1.2rem; background:#3b82f6; color:#fff; border:none; border-radius:6px; cursor:pointer;">👁️ 뷰어 모드로 돌아가기</button>
    </div>
  `;
};
