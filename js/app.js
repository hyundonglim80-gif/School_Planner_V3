// js/app.js

// 1. 브라우저 저장소(localStorage)에서 마지막 선택 상태 불러오기 (기본값: 'week', 'viewer')
let currentScope = localStorage.getItem('workCalendar_scope') || 'week';
let currentMode = localStorage.getItem('workCalendar_mode') || 'viewer';

// 2. 메인 렌더링 함수
window.render = function() {
  const container = document.getElementById("main-view");
  if (!container) return;

  container.innerHTML = "";
  updateTitle();
  updateButtonUI(); // 새로고침 시 상단 버튼 활성화 상태 복원

  if (currentScope === 'week') { 
    currentMode === 'editor' ? renderWeekEditor(container) : renderWeekViewer(container); 
  } else if (currentScope === 'month') { 
    currentMode === 'editor' ? renderMonthEditor(container) : renderMonthViewer(container); 
  } else if (currentScope === 'year') { 
    currentMode === 'editor' ? renderYearEditor(container) : renderYearViewer(container); 
  } else if (currentScope === 'day') { 
    currentMode === 'editor' ? renderDayEditor(container) : renderDayViewer(container); 
  } else if (currentScope === 'memo') { 
    renderMemoView(container); 
  }
};

// 3. 상단 타이틀 업데이트
function updateTitle() {
  const titleEl = document.getElementById("date-range-text");
  if (!titleEl) return;

  if (currentScope === 'week') titleEl.textContent = "2026년 7월 3주차 (07.20 ~ 07.24)";
  else if (currentScope === 'month') titleEl.textContent = "2026년 7월";
  else if (currentScope === 'year') titleEl.textContent = "2026학년도";
  else if (currentScope === 'day') titleEl.textContent = "2026년 7월 20일 (월요일)";
  else if (currentScope === 'memo') titleEl.textContent = "📋 업무 및 수업 체크리스트";
}

// 4. 보기 범위 변경 (주/일/월/년/메모) 및 localStorage 저장
window.setScope = function(scope) {
  currentScope = scope;
  localStorage.setItem('workCalendar_scope', scope); // 선택한 상태 저장
  window.render();
};

// 5. 모드 변경 (뷰어/수정) 및 localStorage 저장
window.setMode = function(mode) {
  currentMode = mode;
  localStorage.setItem('workCalendar_mode', mode); // 선택한 모드 저장
  window.render();
};

// 6. 저장된 상태에 맞게 상단 버튼 스타일(active) 복원
function updateButtonUI() {
  // 범위 버튼들 (메모, 년, 월, 주, 일)
  const scopeBtns = document.querySelectorAll('.btn-scope');
  scopeBtns.forEach(btn => {
    btn.classList.remove('active');
    if (btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(`'${currentScope}'`)) {
      btn.classList.add('active');
    }
  });

  // 모드 버튼들 (뷰어, 수정)
  const viewerBtn = document.getElementById('btn-mode-viewer');
  const editorBtn = document.getElementById('btn-mode-editor');
  if (viewerBtn && editorBtn) {
    viewerBtn.className = currentMode === 'viewer' ? 'btn-mode active-viewer' : 'btn-mode';
    editorBtn.className = currentMode === 'editor' ? 'btn-mode active-editor' : 'btn-mode';
  }
}

window.moveDate = function(dir) {
  console.log("Date moved by", dir);
};

// 앱 최초 실행
window.render();
