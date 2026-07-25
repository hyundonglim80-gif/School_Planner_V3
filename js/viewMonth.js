// js/viewMonth.js

window.renderMonthViewer = async function(container) {
  container.innerHTML = `<p style="text-align:center; padding: 40px; color:#64748b; font-weight:bold; font-size:1.2rem;">⏳ 클라우드에서 월간 일정을 불러오는 중입니다...</p>`;

  let html = `<div class="calendar-grid">`;
  const days = ['일','월','화','수','목','금','토'];
  days.forEach(d => html += `<div class="cal-header" style="font-size:1.2rem;">${d}</div>`);

  const y = window.currentDate.getFullYear();
  const m = window.currentDate.getMonth();
  const firstDay = new Date(y, m, 1).getDay(); 
  const lastDate = new Date(y, m + 1, 0).getDate(); 

  for(let i=0; i<firstDay; i++) {
    html += `<div class="cal-day" style="background:#f8fafc;"></div>`;
  }

  const dayPromises = [];
  for(let i=1; i<=lastDate; i++) {
    const dateStr = `${y}-${String(m+1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    dayPromises.push(window.dbAPI.loadDayData(dateStr).then(data => ({ day: i, data })));
  }

  const monthData = await Promise.all(dayPromises);
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

  const realTodayStr = window.formatDate(new Date()); // 💡 진짜 오늘 날짜 구하기

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

    // 💡 오늘 날짜인지 확인하여 박스 테두리 스타일 결정
    const currentCellDateStr = `${y}-${String(m+1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const isToday = (currentCellDateStr === realTodayStr);
    const boxStyle = isToday 
        ? 'border: 3px solid #2563eb; background-color: #eff6ff; box-sizing: border-box;' 
        : 'border: 1px solid #e2e8f0; background: #fff;';

    html += `<div class="cal-day" style="${boxStyle}">
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
