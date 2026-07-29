//js/app.js

// ==========================================================================
// 🚀 앱 상태 관리 및 초기화 설정
// ==========================================================================
let currentScope = localStorage.getItem('workCalendar_scope') || 'week';
let currentMode = localStorage.getItem('workCalendar_mode') || 'viewer';
window.showWeekend = localStorage.getItem('workCalendar_showWeekend') === 'true';
// 💡 추가: 수업 숨기기/보기 상태 저장
window.showClass = localStorage.getItem('workCalendar_showClass') !== 'false'; // 기본값은 항상 보기(true)
window.currentDate = new Date(); 
window.hasUnsavedChanges = false;

window.toggleWeekend = function() {
  if (currentMode === 'editor' && window.hasUnsavedChanges) {
    if (!confirm("작성 중인 데이터가 저장되지 않았습니다. 정말 이동하시겠습니까?")) return;
  }
  window.showWeekend = !window.showWeekend;
  localStorage.setItem('workCalendar_showWeekend', window.showWeekend);
  window.hasUnsavedChanges = false;
  window.render();
};

window.toggleClass = function() {
  if (currentMode === 'editor' && window.hasUnsavedChanges) {
    if (!confirm("작성 중인 데이터가 저장되지 않았습니다. 정말 이동하시겠습니까?")) return;
  }
  window.showClass = !window.showClass;
  localStorage.setItem('workCalendar_showClass', window.showClass);
  window.hasUnsavedChanges = false;
  window.render();
};


// ==========================================================================
// 🖥️ 메인 렌더링 엔진
// ==========================================================================
window.render = function() {
  const container = document.getElementById("main-view");
  if (!container) return; // 방어 코드 추가

  container.innerHTML = "";
  updateTitle();
  updateButtonUI();

  if (currentScope === 'week') { currentMode === 'editor' ? window.renderWeekEditor(container) : window.renderWeekViewer(container); }
  else if (currentScope === 'month') { currentMode === 'editor' ? window.renderMonthEditor(container) : window.renderMonthViewer(container); }
  else if (currentScope === 'year') { currentMode === 'editor' ? window.renderYearEditor(container) : window.renderYearViewer(container); }
  else if (currentScope === 'day') { currentMode === 'editor' ? window.renderDayEditor(container) : window.renderDayViewer(container); }
  else if (currentScope === 'memo') { window.renderMemoView(container); }
};

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

window.setScope = function(scope) {
  if (currentMode === 'editor' && window.hasUnsavedChanges) {
    if (!confirm("작성 중인 데이터가 저장되지 않았습니다. 정말 다른 보기로 이동하시겠습니까?")) return;
  }
  currentScope = scope;
  localStorage.setItem('workCalendar_scope', scope);
  window.hasUnsavedChanges = false;
  window.render();
};

window.setMode = function(mode) {
  if (currentMode === 'editor' && mode === 'viewer' && window.hasUnsavedChanges) {
    if (!confirm("작성 중인 데이터가 저장되지 않았습니다. 정말 뷰어 모드로 전환하시겠습니까?")) return;
  }
  currentMode = mode;
  localStorage.setItem('workCalendar_mode', mode);
  if (mode === 'viewer') window.hasUnsavedChanges = false;
  window.render();
};

window.handleEditSaveClick = function() {
  if (currentMode === 'viewer') {
    window.setMode('editor');
  } else {
    window.saveCurrentViewData();
  }
};

window.toggleMoreMenu = function() {
  const dropdown = document.getElementById('more-dropdown');
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

function updateButtonUI() {
  const scopeBtns = document.querySelectorAll('.btn-scope');
  scopeBtns.forEach(btn => {
    btn.classList.remove('active');
    if (btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(`'${currentScope}'`)) {
      btn.classList.add('active');
    }
  });

  const viewerBtn = document.getElementById('btn-mode-viewer');
  const editorBtn = document.getElementById('btn-mode-editor');
  const modeGroup = document.querySelector('.mode-group');

  if (modeGroup) {
    modeGroup.style.display = (currentScope === 'memo') ? 'none' : 'flex';
  }

  const searchBtn = document.getElementById('btn-search');
  if (searchBtn) {
    searchBtn.style.display = (currentScope !== 'memo') ? 'inline-block' : 'none';
  }

  const moreBtn = document.getElementById('btn-more-menu');
  if (moreBtn) {
    moreBtn.style.display = (currentScope !== 'memo') ? 'inline-flex' : 'none';
  }

  const weekendBtn = document.getElementById('btn-toggle-weekend');
  if (weekendBtn) {
    weekendBtn.innerHTML = window.showWeekend ? '📅 주말 숨기기' : '📅 주말 보기';
    weekendBtn.style.display = (currentScope === 'memo') ? 'none' : 'inline-block';
  }

  const classBtn = document.getElementById('btn-toggle-class');
  if (classBtn) {
    classBtn.innerHTML = window.showClass ? '🎒 수업 숨기기' : '🎒 수업 보기';
    classBtn.style.display = (currentScope === 'memo') ? 'none' : 'inline-block';
  }

  if (viewerBtn && editorBtn) {
    viewerBtn.className = currentMode === 'viewer' ? 'btn-mode active-viewer' : 'btn-mode';

    if (currentMode === 'viewer') {
      editorBtn.innerHTML = '✏️ 수정';
      editorBtn.title = '단축키: Ctrl + ↓';
      editorBtn.className = 'btn-mode';
    } else {
      editorBtn.innerHTML = '💾 저장';
      editorBtn.title = '단축키: Ctrl + Enter';
      editorBtn.className = 'btn-mode save-mode';
    }
  }

  const dropdown = document.getElementById('more-dropdown');
  if (dropdown) dropdown.classList.add('hidden');
}

// ==========================================================================
// 💡 도움말 모달(가이드창) 제어 엔진
// ==========================================================================


window.saveCurrentViewData = async function() {
  const editorBtn = document.getElementById('btn-mode-editor');
  if (editorBtn) {
    editorBtn.innerHTML = "⏳ 저장중..";
    editorBtn.disabled = true;
  }

  if (currentScope === 'day' && window.saveDayDataFromEditor) await window.saveDayDataFromEditor();
  else if (currentScope === 'week' && window.saveWeekDataFromEditor) await window.saveWeekDataFromEditor();
  else if (currentScope === 'month' && window.saveMonthDataFromEditor) await window.saveMonthDataFromEditor();
  else if (currentScope === 'year' && window.saveYearDataFromEditor) await window.saveYearDataFromEditor();

  // 💡 알림창(alert)을 삭제하고 버튼 글씨로 부드럽게 완료 상태를 알려줍니다.
  if (editorBtn) {
    editorBtn.innerHTML = '✅ 저장 완료';
    setTimeout(() => {
      // 1.5초 뒤에 현재 에디터 모드라면 다시 '저장' 버튼으로 복구
      if (currentMode === 'editor') {
        editorBtn.innerHTML = '💾 저장';
        editorBtn.disabled = false;
      }
    }, 1500); 
  }
  
  window.hasUnsavedChanges = false; 
};

window.moveDate = function(dir) {
  if (currentMode === 'editor' && window.hasUnsavedChanges) {
    if (!confirm("작성 중인 데이터가 저장되지 않았습니다. 정말 날짜를 이동하시겠습니까?")) return;
  }
  if (currentScope === 'day') window.currentDate.setDate(window.currentDate.getDate() + dir);
  else if (currentScope === 'week') window.currentDate.setDate(window.currentDate.getDate() + (dir * 7));
  else if (currentScope === 'month') window.currentDate.setMonth(window.currentDate.getMonth() + dir);
  else if (currentScope === 'year') window.currentDate.setFullYear(window.currentDate.getFullYear() + dir);
  
  window.hasUnsavedChanges = false;
  window.render();
};

window.goToToday = function() {
  if (currentMode === 'editor' && window.hasUnsavedChanges) {
    if (!confirm("작성 중인 데이터가 저장되지 않았습니다. 정말 오늘 날짜로 돌아가시겠습니까?")) return;
  }
  window.currentDate = new Date();
  window.hasUnsavedChanges = false;
  window.render();
};

// ==========================================================================
// 🚀 앱 실행 시 초기화 이벤트 설정
// ==========================================================================
window.addEventListener('DOMContentLoaded', () => {
  const viewerBtn = document.getElementById('btn-mode-viewer');
  const editorBtn = document.getElementById('btn-mode-editor');

  if (viewerBtn) viewerBtn.addEventListener('click', () => window.setMode('viewer'));
  if (editorBtn) {
    editorBtn.addEventListener('click', () => {
      if (currentMode === 'viewer') window.setMode('editor');
      else window.saveCurrentViewData();
    });
  }

  const markUnsaved = () => { if (currentMode === 'editor') window.hasUnsavedChanges = true; };
  document.addEventListener('input', markUnsaved);
  document.addEventListener('change', markUnsaved);

  window.addEventListener('beforeunload', (e) => {
    if (currentMode === 'editor' && window.hasUnsavedChanges) {
      e.preventDefault();
      e.returnValue = ''; 
    }
  });

  // 구글 로그인 연동 로직
  if (window.auth) {
    window.auth.onAuthStateChanged(user => {
      if (user) {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('user-info').style.display = 'flex';
        if(user.photoURL) document.getElementById('user-photo').src = user.photoURL;
        window.render();
        
        // 💡 로그인 시 한 번만 팝업을 띄우는 로직 (타이머 사용)
        setTimeout(() => {
          try {
            const hideHelp = localStorage.getItem('workCalendar_hideHelp_v3');
            if (hideHelp !== 'true' && typeof window.openHelpModal === 'function') {
              window.openHelpModal();
            }
          } catch(e) {
            console.warn("도움말 팝업 실행 중 오류:", e);
          }
        }, 500); // UI가 전부 렌더링된 후 0.5초 뒤에 띄움

      } else {
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('user-info').style.display = 'none';
        document.getElementById("main-view").innerHTML = ""; 
      }
    });
  }
});






// ==========================================================================
// ⚙️ [1단계] 환경 설정 (수업 시수 및 명칭 동적 설정)
// ==========================================================================

// 1. 전역 변수 (기본값)
window.periodNames = ["1", "2", "3", "4", "5", "6"];
window.tempPeriodNames = [];

// 2. DB에서 사용자별 설정 불러오기
window.loadSettings = async function() {
    try {
        const doc = await window.getUserCol('settings').doc('preferences').get();
        // 데이터가 정상적으로 있고, 최소 1개 이상의 명칭이 저장되어 있을 때만 불러옴
        if (doc.exists && doc.data().periodNames && doc.data().periodNames.length > 0) {
            window.periodNames = doc.data().periodNames;
        } else {
            // 저장된게 이상하면 무조건 기본값 복구
            window.periodNames = ["1", "2", "3", "4", "5", "6"];
        }
    } catch (error) {
        console.log("설정 데이터를 불러오는 중 대기, 기본값 적용...");
        window.periodNames = ["1", "2", "3", "4", "5", "6"];
    }
};

// 💡 기존 화면 렌더링 함수를 가로채서, DB에서 periodNames 배열을 무조건 먼저 가져오도록 안전 처리
if (!window.originalRenderForSettings) {
    window.originalRenderForSettings = window.render;
    let isSettingsLoaded = false;
    
    window.render = async function() {
        if (!isSettingsLoaded && typeof window.getUserCol === 'function') {
            await window.loadSettings();
            isSettingsLoaded = true;
        }
        if(window.originalRenderForSettings) window.originalRenderForSettings();
    };
}
