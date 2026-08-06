// js/app.js

// ==========================================================================
// 🚀 앱 상태 관리 및 초기화 설정
// ==========================================================================
let currentScope = localStorage.getItem('workCalendar_scope') || 'week';
let currentMode = localStorage.getItem('workCalendar_mode') || 'viewer';
window.currentMode = currentMode;
window.showWeekend = localStorage.getItem('workCalendar_showWeekend') === 'true';
window.showClass = localStorage.getItem('workCalendar_showClass') !== 'false'; 
window.currentDate = new Date(); 
window.hasUnsavedChanges = false;

window.toggleWeekend = async function() {
  if (currentMode === 'editor' && window.hasUnsavedChanges) await window.saveCurrentViewData(true);
  window.showWeekend = !window.showWeekend;
  localStorage.setItem('workCalendar_showWeekend', window.showWeekend);
  window.render();
};

window.toggleClass = async function() {
  if (currentMode === 'editor' && window.hasUnsavedChanges) await window.saveCurrentViewData(true);
  window.showClass = !window.showClass;
  localStorage.setItem('workCalendar_showClass', window.showClass);
  window.render();
};

window.setScope = async function(scope) {
  if (currentMode === 'editor' && window.hasUnsavedChanges) await window.saveCurrentViewData(true);
  currentScope = scope;
  localStorage.setItem('workCalendar_scope', scope);
  window.render();
};

window.setMode = async function(mode) {
  if (currentMode === 'editor' && window.hasUnsavedChanges) await window.saveCurrentViewData(true);
  currentMode = mode;
  window.currentMode = mode;
  localStorage.setItem('workCalendar_mode', mode);
  window.render();
};

window.navigateDate = async function(dir) {
  if (currentMode === 'editor' && window.hasUnsavedChanges) await window.saveCurrentViewData(true);
  
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

window.goToToday = async function() {
  if (currentMode === 'editor' && window.hasUnsavedChanges) await window.saveCurrentViewData(true);
  window.currentDate = new Date();
  window.render();
};

// ==========================================================================
// 📱 터치 스와이프(좌우 밀기) 설정 - 작성(editor) 모드 완전 잠금 적용
// ==========================================================================
let touchStartX = 0;
let touchStartY = 0;
let touchEndX = 0;
let touchEndY = 0;

document.addEventListener('touchstart', function(e) {
  // ✨ 핵심: 작성(editor) 모드일 때는 터치 스와이프로 날짜 변경 방지 (잠금)
  if (window.currentMode === 'editor' || currentMode === 'editor') return;
  touchStartX = e.changedTouches[0].screenX;
  touchStartY = e.changedTouches[0].screenY;
}, false);

document.addEventListener('touchend', function(e) {
  // ✨ 핵심: 작성(editor) 모드일 때는 터치 스와이프로 날짜 변경 방지 (잠금)
  if (window.currentMode === 'editor' || currentMode === 'editor') return;
  touchEndX = e.changedTouches[0].screenX;
  touchEndY = e.changedTouches[0].screenY;
  handleSwipeGesture();
}, false);

function handleSwipeGesture() {
  // ✨ 핵심: 작성(editor) 모드일 때는 스와이프 날짜 이동 비활성화
  if (window.currentMode === 'editor' || currentMode === 'editor') return;
  
  const diffX = touchEndX - touchStartX;
  const diffY = touchEndY - touchStartY;

  // 수평 스와이프 감지 (상하 이동보다 좌우 이동이 더 크고 50px 이상 밀었을 때)
  if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
    if (diffX < 0) {
      window.navigateDate(1); // 오른쪽 -> 왼쪽: 다음 날짜
    } else {
      window.navigateDate(-1); // 왼쪽 -> 오른쪽: 이전 날짜
    }
  }
}

// 교시 교환 모달 오픈 함수
window.openClassSwapModal = function(sourcePeriod) {
  if (window.currentMode === 'editor' || currentMode === 'editor') return;
  const sourceDate = window.formatDate(window.currentDate);
};

// ==========================================================================
// 🖥️ 메인 렌더링 컨트롤러
// ==========================================================================
window.render = function() {
  const container = document.getElementById("main-view");
  if (!container) return;

  window.updateHeaderTitle();
  window.updateButtonUI();

  if (currentScope === 'week') {
    if (currentMode === 'viewer') window.renderWeekViewer(container);
    else window.renderWeekEditor(container);
  } else if (currentScope === 'day') {
    if (currentMode === 'viewer') window.renderDayViewer(container);
    else window.renderDayEditor(container);
  } else if (currentScope === 'month') {
    if (currentMode === 'viewer') window.renderMonthViewer(container);
    else window.renderMonthEditor(container);
  } else if (currentScope === 'year') {
    if (currentMode === 'viewer') window.renderYearViewer(container);
    else window.renderYearEditor(container);
  } else if (currentScope === 'memo') {
    window.renderMemoView(container);
  }
};

window.updateHeaderTitle = function() {
  const titleEl = document.getElementById("current-range");
  if (!titleEl) return;
  const y = window.currentDate.getFullYear();
  const m = window.currentDate.getMonth() + 1;
  const d = window.currentDate.getDate();
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const dayName = days[window.currentDate.getDay()];

  if (currentScope === 'day') {
    titleEl.textContent = `${y}년 ${m}월 ${d}일 (${dayName})`;
  } else if (currentScope === 'week') {
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
    titleEl.textContent = `${mon.getFullYear()}.${mStr1}.${dStr1} ~ ${mStr2}.${dStr2}`;
  } else if (currentScope === 'month') {
    titleEl.textContent = `${y}년 ${m}월`;
  } else if (currentScope === 'year') {
    titleEl.textContent = `${y}학년도`;
  } else if (currentScope === 'memo') {
    titleEl.textContent = "할 일 및 업무 메모";
  }
};

window.updateButtonUI = function() {
  const scopeBtns = document.querySelectorAll('.btn-scope');
  scopeBtns.forEach(btn => {
    btn.classList.remove('active');
    if (btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(`'${currentScope}'`)) {
      btn.classList.add('active');
    }
  });

  const viewerBtn = document.getElementById('btn-mode-viewer');
  const editorBtn = document.getElementById('btn-mode-editor');
  if (viewerBtn && editorBtn) {
    viewerBtn.classList.remove('active-viewer');
    editorBtn.classList.remove('active-viewer', 'save-mode');
    
    if (currentMode === 'viewer') {
      viewerBtn.classList.add('active-viewer');
      editorBtn.textContent = '✏️ 작성';
    } else {
      editorBtn.classList.add('active-viewer', 'save-mode');
      editorBtn.textContent = '💾 저장';
    }
  }

  const dropdown = document.getElementById('more-menu-dropdown');
  if (dropdown) dropdown.classList.add('hidden');

  const weekendBtn = document.getElementById('btn-toggle-weekend');
  if (weekendBtn) {
    weekendBtn.innerHTML = window.showWeekend ? '📅 주말 숨기기' : '📅 주말 보기';
    weekendBtn.style.display = (currentScope === 'memo') ? 'none' : 'inline-block';
  }
};

window.toggleMoreMenu = function(e) {
  if (e) e.stopPropagation();
  const dropdown = document.getElementById('more-menu-dropdown');
  if (dropdown) dropdown.classList.toggle('hidden');
};

window.addEventListener('click', function(e) {
  const btn = document.getElementById('btn-more-menu');
  const dropdown = document.getElementById('more-dropdown');
  if (btn && dropdown) {
    if (!btn.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.classList.add('hidden');
    }
  }
});

window.saveCurrentViewData = async function(silent = false) {
  const editorBtn = document.getElementById('btn-mode-editor');
  if (editorBtn && !silent) {
    editorBtn.textContent = "⏳ 저장중..";
    editorBtn.disabled = true;
  }
  
  try {
    if (currentScope === 'day' && window.dayViewInstance) await window.dayViewInstance.saveData();
    else if (currentScope === 'week' && window.weekViewInstance) await window.weekViewInstance.saveData();
    else if (currentScope === 'month' && window.monthViewInstance) await window.monthViewInstance.saveData();
    else if (currentScope === 'year' && window.yearViewInstance) await window.yearViewInstance.saveData();
    
    window.hasUnsavedChanges = false;
  } catch(e) {
    console.error("저장 오류:", e);
  } finally {
    if (editorBtn && !silent) {
      editorBtn.textContent = "💾 저장";
      editorBtn.disabled = false;
    }
  }
};

// D-Day 시스템
window.dDayList = [];
window.selectedDDayId = null;

window.updateDdayUI = function() {
  const badge = document.getElementById('dday-badge');
  if (!badge) return;

  if (!window.dDayList || window.dDayList.length === 0) {
    badge.textContent = "D-Day 설정";
    return;
  }

  let selected = window.dDayList.find(d => d.id === window.selectedDDayId);
  if (!selected) selected = window.dDayList[0];

  const today = new Date();
  today.setHours(0,0,0,0);
  const target = new Date(selected.date);
  target.setHours(0,0,0,0);

  const diffTime = target - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  let dDayText = "";
  if (diffDays === 0) dDayText = "D-Day";
  else if (diffDays > 0) dDayText = `D-${diffDays}`;
  else dDayText = `D+${Math.abs(diffDays)}`;

  badge.textContent = `${selected.title} ${dDayText}`;
};

window.openDdayModal = function() {
  if (window.openModal) {
    window.openModal('dday-modal');
    window.renderDdaySettingsList();
  }
};
