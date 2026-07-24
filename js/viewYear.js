// js/viewYear.js

window.renderYearViewer = async function(container) {
  // 연간 뷰어 (현재는 간략한 월별 요약 UI만 유지)
  let html = `<div class="year-grid">`;
  const months = ["3월","4월","5월","6월","7월","8월","9월","10월","11월","12월","1월","2월"];
  
  months.forEach(m => {
    html += `
      <div class="mini-month" style="display:flex; flex-direction:column; gap:8px;">
        <h3 style="color:#1e40af; border-bottom:2px solid #bfdbfe; padding-bottom:4px; font-size:1.1rem;">${m}</h3>
        <p style="font-size:0.85rem; color:#475569;">
          ${m === '7월' ? '📌 여름방학식<br>📌 1학기 성적 처리' : '상세 일정은 월/주 보기 참조'}
        </p>
      </div>`;
  });
  html += `</div>`;
  container.innerHTML = html;
};

// 💡 연간 수정 모드 역시 안전을 위해 '주/일' 보기로 유도합니다.
window.renderYearEditor = function(container) {
  container.innerHTML = `
    <div style="text-align:center; padding:50px; background:#fff; border-radius:8px; border:1px solid #cbd5e1;">
      <h3 style="color:#1e293b; margin-bottom:10px;">연간 일정 수정 안내</h3>
      <p style="color:#64748b;">연간 세부 일정과 수업 내용은 <b>'주' 또는 '일' 보기</b> 화면에서 작성하시면<br>클라우드에 안전하게 자동 반영됩니다.</p>
      <button onclick="setMode('viewer')" style="margin-top:20px; padding:8px 16px; background:#3b82f6; color:#fff; border:none; border-radius:6px; cursor:pointer;">👁️ 뷰어 모드로 돌아가기</button>
    </div>
  `;
};
