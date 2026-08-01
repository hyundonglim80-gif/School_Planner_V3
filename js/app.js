// 💡 주말 숨기기 토글 기능
window.toggleWeekend = function() {
  if (currentMode === 'editor' && window.hasUnsavedChanges) {
    if (!confirm("작성 중인 데이터가 저장되지 않았습니다. 정말 이동하시겠습니까?")) return; [cite: 831]
  }
  window.showWeekend = !window.showWeekend; [cite: 832]
  localStorage.setItem('workCalendar_showWeekend', window.showWeekend); [cite: 832]
  window.hasUnsavedChanges = false; [cite: 832]
  
  // 상태 변경 후 화면 렌더링 호출 (이 안에서 updateButtonUI가 실행됨)
  window.render(); [cite: 832]
};

// 💡 수업 숨기기 토글 기능
window.toggleClass = function() {
  if (currentMode === 'editor' && window.hasUnsavedChanges) {
    if (!confirm("작성 중인 데이터가 저장되지 않았습니다. 정말 이동하시겠습니까?")) return; [cite: 783]
  }
  window.showClass = !window.showClass; [cite: 784]
  localStorage.setItem('workCalendar_showClass', window.showClass); [cite: 784]
  window.hasUnsavedChanges = false; [cite: 784]
  
  // 상태 변경 후 화면 렌더링 호출
  window.render(); [cite: 784]
};

// 💡 상단 버튼 상태 및 텍스트 업데이트 함수
function updateButtonUI() {
  const scopeBtns = document.querySelectorAll('.btn-scope'); [cite: 804]
  scopeBtns.forEach(btn => {
    btn.classList.remove('active'); [cite: 804]
    if (btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(`${currentScope}`)) { [cite: 804]
      btn.classList.add('active'); [cite: 804]
    }
  });

  const modeGroup = document.querySelector('.mode-group'); [cite: 805]
  if (modeGroup) {
    modeGroup.style.display = (currentScope === 'memo') ? 'none' : 'flex'; [cite: 805, 806]
  }

  // 🎯 주말 숨기기/보기 버튼 텍스트 변경 적용
  const weekendBtn = document.getElementById('btn-toggle-weekend'); [cite: 808]
  if (weekendBtn) {
    weekendBtn.innerHTML = window.showWeekend ? '📅 주말 숨기기' : '📅 주말 보기'; [cite: 808]
    weekendBtn.style.display = (currentScope === 'memo') ? 'none' : 'inline-block'; [cite: 809]
  }

  // 🎯 수업 숨기기/보기 버튼 텍스트 변경 적용
  const classBtn = document.getElementById('btn-toggle-class'); [cite: 809]
  if (classBtn) {
    classBtn.innerHTML = window.showClass ? '🎒 수업 숨기기' : '🎒 수업 보기'; [cite: 810]
    classBtn.style.display = (currentScope === 'memo') ? 'none' : 'inline-block'; [cite: 811]
  }

  const searchBtn = document.getElementById('btn-search'); [cite: 806]
  if (searchBtn) {
    searchBtn.style.display = (currentScope !== 'memo') ? 'inline-block' : 'none'; [cite: 806]
  }
  
  const moreBtn = document.getElementById('btn-more-menu'); [cite: 807]
  if (moreBtn) {
    moreBtn.style.display = (currentScope !== 'memo') ? 'inline-flex' : 'none'; [cite: 807]
  }

  const viewerBtn = document.getElementById('btn-mode-viewer'); [cite: 805]
  const editorBtn = document.getElementById('btn-mode-editor'); [cite: 805]
  
  if (viewerBtn && editorBtn) {
    viewerBtn.className = currentMode === 'viewer' ? 'btn-mode active-viewer' : 'btn-mode'; [cite: 811, 812]
    if (currentMode === 'viewer') {
      editorBtn.innerHTML = '✏️ 수정'; [cite: 812]
      editorBtn.title = '단축키: Ctrl + ↓'; [cite: 813]
      editorBtn.className = 'btn-mode'; [cite: 813]
    } else {
      editorBtn.innerHTML = '💾 저장'; [cite: 813]
      editorBtn.title = '단축키: Ctrl + Enter'; [cite: 814]
      editorBtn.className = 'btn-mode save-mode'; [cite: 814]
    }
  }
  
  const dropdown = document.getElementById('more-dropdown'); [cite: 814]
  if (dropdown) dropdown.classList.add('hidden'); [cite: 814]
}
