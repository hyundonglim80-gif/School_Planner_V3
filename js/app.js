// js/app.js

let currentScope = localStorage.getItem('workCalendar_scope') || 'week';
let currentMode = localStorage.getItem('workCalendar_mode') || 'viewer';

window.currentDate = new Date(2026, 6, 20); 

window.formatDate = function(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

window.render = function() {
  const container = document.getElementById("main-view");
  if (!container) return;

  container.innerHTML = "";
  updateTitle();
  updateButtonUI();

  if (currentScope === 'week') { currentMode === 'editor' ? renderWeekEditor(container) : renderWeekViewer(container); }
  else if (currentScope === 'month') { currentMode === 'editor' ? renderMonthEditor(container) : renderMonthViewer(container); }
  else if (currentScope === 'year') { currentMode === 'editor' ? renderYearEditor(container) : renderYearViewer(container); }
  else if (currentScope === 'day') { currentMode === 'editor' ? renderDayEditor(container) : renderDayViewer(container); }
  else if (currentScope === 'memo') { renderMemoView(container); }
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

  if (saveBtn) {
    if (currentMode === 'editor' && currentScope !== 'memo') {
      saveBtn.style.display = 'inline-block';
    } else {
      saveBtn.style.display = 'none';
    }
  }
}

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
    await window.saveMonthDataFromEditor(); // 👈 새 기능: 월간 저장
  } else if (currentScope === 'year' && window.saveYearDataFromEditor) {
    await window.saveYearDataFromEditor();  // 👈 새 기능: 연간 저장
  }

  alert("✅ 클라우드 데이터베이스에 저장되었습니다!");

  if (saveBtn) {
    saveBtn.textContent = "💾 저장";
    saveBtn.disabled = false;
  }
  
  window.setMode('viewer');
};

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

window.render();
