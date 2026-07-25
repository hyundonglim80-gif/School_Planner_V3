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
      <div style="${dayStyle}">${d} ${scheduleHtml}</div>
      ${eventHtml}
    </div>`;
  });

  html += `</div>`;
  container.innerHTML = html;
};
