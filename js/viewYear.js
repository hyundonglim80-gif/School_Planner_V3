// js/viewYear.js

window.renderYearViewer = async function(container) {
  container.innerHTML = `<p style="text-align:center; padding: 40px; color:#64748b; font-weight:bold; font-size:1.2rem;">⏳ 클라우드에서 연간 일정을 분석하여 불러오는 중입니다...</p>`;

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

  const months = [
    { label: "3월", match: "-03-" }, { label: "4월", match: "-04-" },
    { label: "5월", match: "-05-" }, { label: "6월", match: "-06-" },
    { label: "7월", match: "-07-" }, { label: "8월", match: "-08-" },
    { label: "9월", match: "-09-" }, { label: "10월", match: "-10-" },
    { label: "11월", match: "-11-" }, { label: "12월", match: "-12-" },
    { label: "1월", match: "-01-" }, { label: "2월", match: "-02-" }
  ];

  let html = `<div class="year-grid">`;

  // 💡 진짜 오늘 날짜 구하기 (년, 월 매칭용)
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
        
        // 💡 오늘 일정은 파란색 배지처럼 강조
        const isTodayEvent = (e.dateStr === realTodayStr);
        const eventStyle = isTodayEvent 
            ? 'background-color:#eff6ff; padding:8px; border-radius:6px; border:2px solid #3b82f6; margin-bottom:10px;' 
            : 'margin-bottom:10px; border-bottom:1px dashed #e2e8f0; padding-bottom:6px;';

        return `<div style="${eventStyle}">
                  <div style="color:#2563eb; font-weight:700;">${dayNum}일(${dayOfWeek}) ${isTodayEvent ? '🎯 오늘' : ''}</div>
                  <div style="color:#334155; white-space:pre-wrap; word-break:break-all; margin-top:2px;">${e.text}</div>
                </div>`;
      }).join('');
    } else {
      eventListHtml = `<div style="text-align:center; color:#94a3b8; font-size:0.9rem; padding-top:10px;">일정 없음</div>`;
    }

    // 💡 이번 달 카드 전체 테두리 강조 (현재 연도와 달이 일치할 때만)
    const isCurrentMonthCard = (mObj.match === currentMonthMatch && String(window.currentDate.getFullYear()) === currentYearStr);
    const cardStyle = isCurrentMonthCard 
        ? 'border: 3px solid #2563eb; background-color: #f8fafc; box-shadow: 0 4px 6px rgba(37,99,235,0.1);' 
        : 'border: 1px solid var(--border-color); background: #fff;';

    html += `
      <div class="mini-month" style="display:flex; flex-direction:column; gap:8px; text-align:left; padding:12px; border-radius:8px; ${cardStyle}">
        <h3 style="color:#1e40af; border-bottom:2px solid #bfdbfe; padding-bottom:4px; font-size:1.1rem; text-align:center;">${mObj.label}</h3>
        <div style="font-size:0.95rem; line-height:1.4;">
          ${eventListHtml}
        </div>
      </div>`;
  });

  html += `</div>`;
  container.innerHTML = html;
};

window.renderYearEditor = function(container) {
  container.innerHTML = `
    <div style="text-align:center; padding:50px; background:#fff; border-radius:8px; border:1px solid #cbd5e1;">
      <h3 style="color:#1e293b; margin-bottom:10px; font-size:1.5rem;">연간 일정 수정 안내</h3>
      <p style="color:#64748b; font-size:1.2rem; line-height:1.5;">연간 세부 일정과 행사 내용은 <b>'주' 또는 '일' 보기</b> 화면에서<br>상단 일정칸에 입력하시면 연간 보기에 자동 반영됩니다.</p>
      <button onclick="setMode('viewer')" style="margin-top:20px; padding:10px 20px; font-size:1.2rem; background:#3b82f6; color:#fff; border:none; border-radius:6px; cursor:pointer;">👁️ 뷰어 모드로 돌아가기</button>
    </div>
  `;
};
