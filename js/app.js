// js/app.js

let currentScope = localStorage.getItem('workCalendar_scope') || 'week';
let currentMode = localStorage.getItem('workCalendar_mode') || 'viewer';

window.render = function() {
  const container = document.getElementById("main-view");
  if (!container) return;

  container.innerHTML = "";
  updateTitle();
  updateButtonUI();

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

function updateTitle() {
  const titleEl = document.getElementById("date-range-text");
  if (!titleEl) return;

  if (currentScope === 'week') titleEl.textContent = "2026년 7월 3주차 (07.20 ~ 07.24)";
  else if (currentScope === 'month') titleEl.textContent = "2026년 7월";
  else if (currentScope === 'year') titleEl.textContent = "2026학년도";
  else if (currentScope === 'day') titleEl.textContent = "2026년 7월 20일 (월요일)";
  else if (currentScope === 'memo') titleEl.textContent = "📋 업무 및 수업 체크리스트";
}

window.setScope = function(scope) {
  currentScope = scope;
  localStorage.setItem('workCalendar_scope', scope);
  window.render();
};

window.setMode = function(mode) {
  currentMode = mode;
  localStorage.setItem('workCalendar_mode', mode);
  window.render();
};

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
  const saveBtn = document.getElementById('btn-save-data');

  if (viewerBtn && editorBtn) {
    viewerBtn.className = currentMode === 'viewer' ? 'btn-mode active-viewer' : 'btn-mode';
    editorBtn.className = currentMode === 'editor' ? 'btn-mode active-editor' : 'btn-mode';
  }

  // 💾 수정 모드이고 메모장이 아닐 때만 저장 버튼 노출
  if (saveBtn) {
    if (currentMode === 'editor' && currentScope !== 'memo') {
      saveBtn.style.display = 'inline-block';
    } else {
      saveBtn.style.display = 'none';
    }
  }
}

// 💾 [저장 버튼 클릭 시 실행되는 함수]
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
  }

  alert("✅ 클라우드 데이터베이스에 저장되었습니다!");

  if (saveBtn) {
    saveBtn.textContent = "💾 저장";
    saveBtn.disabled = false;
  }
  
  // 저장 완료 후 뷰어 모드로 자동 전환하여 결과 확인
  window.setMode('viewer');
};

window.moveDate = function(dir) {
  console.log("Date moved by", dir);
};

window.render();
