// js/app.js

/**
 * 📌 [전역 상태 변수]
 * - currentScope: 현재 선택된 보기 범위 ('memo', 'year', 'month', 'week', 'day')
 * - currentMode: 현재 모드 ('viewer': 눈으로 보기, 'editor': 수정 및 입력)
 * - window.currentDate: 앱 전체의 기준 날짜 (기본 2026-07-20 시작)
 */
let currentScope = localStorage.getItem('workCalendar_scope') || 'week';
let currentMode = localStorage.getItem('workCalendar_mode') || 'viewer';

window.currentDate = new Date(2026, 6, 20); // 2026년 7월 20일 (월은 0부터 시작하므로 6=7월)

/**
 * 🛠️ Date 객체를 "YYYY-MM-DD" 포맷 문자열로 변환하는 전역 공통 함수
 */
window.formatDate = function(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/**
 * 🖥️ 현재 scope와 mode에 따라 메인 화면을 새로 그리는 핵심 랜더링 함수
 */
window.render = function() {
  const container = document.getElementById("main-view");
  if (!container) return;

  container.innerHTML = "";
  updateTitle();
  updateButtonUI();

  // 각 화면별 뷰어/에디터 분기
  if (currentScope === 'week') { currentMode === 'editor' ? renderWeekEditor(container) : renderWeekViewer(container); }
  else if (currentScope === 'month') { currentMode === 'editor' ? renderMonthEditor(container) : renderMonthViewer(container); }
  else if (currentScope === 'year') { currentMode === 'editor' ? renderYearEditor(container) : renderYearViewer(container); }
  else if (currentScope === 'day') { currentMode === 'editor' ? renderDayEditor(container) : renderDayViewer(container); }
  else if (currentScope === 'memo') { renderMemoView(container); }
};

/**
 * 🏷️ 선택된 날짜와 Scope에 맞춰 상단 제목표시줄(Title) 갱신
 */
function updateTitle() {
  const titleEl = document.getElementById("date-range-text");
  if (!titleEl) return;

  const y = window.currentDate.getFullYear();
  const m = window.currentDate.getMonth() + 1;
  const d = window.currentDate.getDate();
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const dayName = days[window.currentDate.getDay()];

  if (currentScope === 'day') { 
    titleEl.textContent = `${y}년 ${m}월 ${d}일 (${dayName}요일)`;
  } else if (currentScope === 'week') {
    // 해당 주의 월요일과 금요일 날짜 자동 계산
    const temp = new Date(window.currentDate);
    const day = temp.getDay();
    const diffToMon = temp.getDate() - day + (day === 0 ? -6 : 1);
    const mon = new Date(temp.setDate(diffToMon));
    const fri = new Date(mon);
    fri.setDate(mon.getDate() + 4);
    
    const mStr1 = String(mon.getMonth()+1).padStart(2,'0');
    const dStr1 = String(mon.getDate()).padStart(2,'0');
    const mStr2 = String(fri.getMonth()+1).padStart(2,'0');
    const dStr2 = String(fri.getDate()).padStart(2,'0');

    titleEl.textContent = `${y}년 ${m}월 (${mStr1}.${dStr1} ~ ${mStr2}.${dStr2})`;
  } else if (currentScope === 'month') { 
    titleEl.textContent = `${y}년 ${m}월`;
  } else if (currentScope === 'year') { 
    titleEl.textContent = `${y}학년도`;
  } else if (currentScope === 'memo') { 
    titleEl.textContent = "📋 업무 및 수업 체크리스트";
  }
}

/**
 * 🔘 보기 범위(Scope) 변경 함수 ('memo', 'year', 'month', 'week', 'day')
 */
window.setScope = function(scope) {
  currentScope = scope;
  localStorage.setItem('workCalendar_scope', scope);
  window.render();
};

/**
 * 🔘 모드(Mode) 변경 함수 ('viewer': 보기, 'editor': 수정)
 */
window.setMode = function(mode) {
  currentMode = mode;
  localStorage.setItem('workCalendar_mode', mode);
  window.render();
};

/**
 * 🔘 상단 버튼 활성화 상태 및 메모 화면 시 [뷰어/수정] 버튼 숨김 제어
 */
function updateButtonUI() {
  // Scope 버튼 활성화 클래스 토글
  const scopeBtns = document.querySelectorAll('.btn-scope');
  scopeBtns.forEach(btn => {
    btn.classList.remove('active');
    if (btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(`'${currentScope}'`)) {
      btn.classList.add('active');
    }
  });

  const viewerBtn = document.getElementById('btn-mode-viewer');
  const editorBtn = document.getElementById('btn-mode-editor');
  const saveBtn = document.getElementById('btn-save-data');
  const modeGroup = document.querySelector('.mode-group');

  // 💡 메모(memo) 화면일 때는 [뷰어/수정] 버튼 그룹 자체를 숨깁니다.
  if (modeGroup) {
    modeGroup.style.display = (currentScope === 'memo') ? 'none' : 'flex';
  }

  // 👇 [여기서부터 새로 추가할 코드] 메모 화면에서는 <이전 / 다음> 버튼 숨기기
  const navBtns = document.querySelectorAll('.nav-btn');
  navBtns.forEach(btn => {
    btn.style.display = (currentScope === 'memo') ? 'none' : '';
  });
  // 👆 [여기까지 추가 완료]

  if (viewerBtn && editorBtn) {
    viewerBtn.className = currentMode === 'viewer' ? 'btn-mode active-viewer' : 'btn-mode';
    editorBtn.className = currentMode === 'editor' ? 'btn-mode active-editor' : 'btn-mode';
  }

  // 수정 모드일 때만 [💾 저장] 버튼 노출
  if (saveBtn) {
    if (currentMode === 'editor' && currentScope !== 'memo') {
      saveBtn.style.display = 'inline-block';
    } else {
      saveBtn.style.display = 'none';
    }
  }
}

/**
 * 💾 [저장] 버튼 클릭 시 현재 활성화된 Scope에 맞춰 Firestore 일괄 저장 실행
 */
window.saveCurrentViewData = async function() {
  const saveBtn = document.getElementById('btn-save-data');
  if (saveBtn) {
    saveBtn.textContent = "⏳ 저장 중...";
    saveBtn.disabled = true;
  }

  if (currentScope === 'day' && window.saveDayDataFromEditor) {
    await window.saveDayDataFromEditor();
  } else if (currentScope === 'week' && window.saveWeekDataFromEditor) {
    await window.saveWeekDataFromEditor();
  } else if (currentScope === 'month' && window.saveMonthDataFromEditor) {
    await window.saveMonthDataFromEditor();
  } else if (currentScope === 'year' && window.saveYearDataFromEditor) {
    await window.saveYearDataFromEditor();
  }

  alert("✅ 클라우드 데이터베이스에 저장되었습니다!");

  if (saveBtn) {
    saveBtn.textContent = "💾 저장";
    saveBtn.disabled = false;
  }
  
  window.setMode('viewer'); // 저장 후 뷰어 모드로 자동 전환
};

/**
 * ◀️ ▶️ [< 이전] [다음 >] 버튼 클릭 시 날짜 이동 처리
 */
window.moveDate = function(dir) {
  if (currentScope === 'day') {
    window.currentDate.setDate(window.currentDate.getDate() + dir);
  } else if (currentScope === 'week') {
    window.currentDate.setDate(window.currentDate.getDate() + (dir * 7));
  } else if (currentScope === 'month') {
    window.currentDate.setMonth(window.currentDate.getMonth() + dir);
  } else if (currentScope === 'year') {
    window.currentDate.setFullYear(window.currentDate.getFullYear() + dir);
  }
  window.render();
};

// 최초 앱 실행
window.render();
