// js/viewYear.js

window.renderYearViewer = async function(container) {
  // 로딩 메시지
  container.innerHTML = `<p style="text-align:center; padding: 40px; color:#64748b; font-weight:bold;">⏳ 클라우드에서 연간 일정을 분석하여 불러오는 중입니다...</p>`;

  let allEvents = [];
  try {
    // 🔥 데이터베이스에서 등록된 '모든 일정(events)'을 한 번에 빠르게 가져옵니다.
    const snapshot = await window.db.collection('events').get();
    snapshot.forEach(doc => {
      const data = doc.data();
      // 내용이 비어있지 않은 실제 일정만 배열에 담습니다.
      if (data.eventText && data.eventText.trim() !== '') {
        allEvents.push({ dateStr: doc.id, text: data.eventText });
      }
    });
  } catch (error) {
    console.error("연간 데이터 로딩 에러:", error);
  }

  // 날짜 오름차순(1월 1일 -> 12월 31일)으로 정렬
  allEvents.sort((a, b) => a.dateStr.localeCompare(b.dateStr));

  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

  // 학교 학사일정 기준 월 (3월 시작 ~ 다음 해 2월 끝)
  const months = [
    { label: "3월", match: "-03-" }, { label: "4월", match: "-04-" },
    { label: "5월", match: "-05-" }, { label: "6월", match: "-06-" },
    { label: "7월", match: "-07-" }, { label: "8월", match: "-08-" },
    { label: "9월", match: "-09-" }, { label: "10월", match: "-10-" },
    { label: "11월", match: "-11-" }, { label: "12월", match: "-12-" },
    { label: "1월", match: "-01-" }, { label: "2월", match: "-02-" }
  ];

  let html = `<div class="year-grid">`;

  // 각 월별로 카드(박스)를 만듭니다.
  months.forEach(mObj => {
    // 전체 일정 중에서 해당 월에 속하는 일정만 걸러냅니다.
    const monthEvents = allEvents.filter(e => e.dateStr.includes(mObj.match));

    let eventListHtml = '';
    if (monthEvents.length > 0) {
      // 일정이 있으면 '날짜(요일) 일정내용' 형태로 변환합니다.
      eventListHtml = monthEvents.map(e => {
        // 날짜 문자열(YYYY-MM-DD)을 쪼개서 정확한 요일을 계산합니다.
        const parts = e.dateStr.split('-');
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const dayNum = parseInt(parts[2], 10);
        
        const dateObj = new Date(year, month, dayNum);
        const dayOfWeek = dayNames[dateObj.getDay()]; // 요일 추출
        
        // 화면 출력 HTML (날짜 파란색 강조, 줄바꿈 유지)
        return `<div style="margin-bottom:8px; display:flex; gap:6px;">
                  <span style="color:#2563eb; font-weight:700; white-space:nowrap;">${dayNum}일(${dayOfWeek})</span> 
                  <span style="color:#334155; white-space:pre-wrap; word-break:keep-all;">${e.text}</span>
                </div>`;
      }).join('');
    } else {
      // 해당 월에 등록된 일정이 없을 경우
      eventListHtml = `<div style="text-align:center; color:#94a3b8; font-size:0.8rem; padding-top:10px;">일정 없음</div>`;
    }

    // 각 월별 달력 카드 그리기
    html += `
      <div class="mini-month" style="display:flex; flex-direction:column; gap:8px; text-align:left; background:#fff; padding:12px; border:1px solid var(--border-color); border-radius:8px;">
        <h3 style="color:#1e40af; border-bottom:2px solid #bfdbfe; padding-bottom:4px; font-size:1.1rem; text-align:center;">${mObj.label}</h3>
        <div style="font-size:0.85rem; line-height:1.4;">
          ${eventListHtml}
        </div>
      </div>`;
  });

  html += `</div>`;
  container.innerHTML = html;
};

// 연간 수정 모드는 안전을 위해 '주/일' 보기로 유도합니다.
window.renderYearEditor = function(container) {
  container.innerHTML = `
    <div style="text-align:center; padding:50px; background:#fff; border-radius:8px; border:1px solid #cbd5e1;">
      <h3 style="color:#1e293b; margin-bottom:10px;">연간 일정 수정 안내</h3>
      <p style="color:#64748b;">연간 세부 일정과 행사 내용은 <b>'주' 또는 '일' 보기</b> 화면에서<br>상단 일정칸에 입력하시면 연간 보기에 자동 반영됩니다.</p>
      <button onclick="setMode('viewer')" style="margin-top:20px; padding:8px 16px; background:#3b82f6; color:#fff; border:none; border-radius:6px; cursor:pointer;">👁️ 뷰어 모드로 돌아가기</button>
    </div>
  `;
};
