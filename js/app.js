// js/app.js

// 초기 상태
let currentScope = 'week';
let currentMode = 'viewer';

// 화면 렌더링 메인 함수
function render() {
  const container = document.getElementById("main-view");
  container.innerHTML = "";
  updateTitle();

  if (currentScope === 'week') { currentMode === 'editor' ? renderWeekEditor(container) : renderWeekViewer(container); }
  else if (currentScope === 'month') { currentMode === 'editor' ? renderMonthEditor(container) : renderMonthViewer(container); }
  else if (currentScope === 'year') { currentMode === 'editor' ? renderYearEditor(container) : renderYearViewer(container); }
  else if (currentScope === 'day') { currentMode === 'editor' ? renderDayEditor(container) : renderDayViewer(container); }
  else if (currentScope === 'memo') { renderMemoView(container); }
}

// 타이틀 변경
function updateTitle() {
  const titleEl = document.getElementById("date-range-text");
  if (currentScope === 'week') titleEl.textContent = "2026년 7월 3주차 (07.20 ~ 07.24)";
  else if (currentScope === 'month') titleEl.textContent = "2026년 7월";
  else if (currentScope === 'year') titleEl.textContent = "2026학년도";
  else if (currentScope === 'day') titleEl.textContent = "2026년 7월 20일 (월요일)";
  else if (currentScope === 'memo') titleEl.textContent = "📋 업무 및 수업 체크리스트";
}

// 네비게이션 제어
function setScope(scope) {
  currentScope = scope;
  document.querySelectorAll('.btn-scope').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');
  render();
}

// 뷰어/수정 모드 제어
function setMode(mode) {
  currentMode = mode;
  document.getElementById('btn-mode-viewer').className = mode === 'viewer' ? 'btn-mode active-viewer' : 'btn-mode';
  document.getElementById('btn-mode-editor').className = mode === 'editor' ? 'btn-mode active-editor' : 'btn-mode';
  render();
}

function moveDate(dir) {
  // 나중에 날짜 연산 및 Firebase 데이터 조회용으로 활용할 함수
  console.log("Date moved by", dir);
}

// 앱 최초 실행
render();