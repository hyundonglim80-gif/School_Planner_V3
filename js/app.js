// ==========================================================================
// 1. 모드 전환 제어 (수정됨: 저장 버튼 유무에 따른 다른 버튼 위치 변경 방지)
// ==========================================================================
window.setMode = function(mode) {
  window.currentMode = mode;
  const btnViewer = document.getElementById('btn-mode-viewer');
  const btnEditor = document.getElementById('btn-mode-editor');
  const btnSave = document.getElementById('btn-save-data');

  if (mode === 'editor') {
    if (btnViewer) btnViewer.className = 'btn-mode';
    if (btnEditor) btnEditor.className = 'btn-mode active-editor';
    if (btnSave) btnSave.classList.remove('hidden'); // 저장 버튼 보이기
  } else {
    if (btnViewer) btnViewer.className = 'btn-mode active-viewer';
    if (btnEditor) btnEditor.className = 'btn-mode';
    if (btnSave) btnSave.classList.add('hidden'); // 공간은 유지하고 버튼만 숨기기
  }

  // 화면 다시 그리기 호출
  if (typeof renderCurrentView === 'function') {
    renderCurrentView();
  }
};


// ==========================================================================
// 2. 점세개(⋮) 더보기 드롭다운 메뉴 처리 (새로 추가)
// ==========================================================================
window.toggleMoreMenu = function(event) {
  if (event) event.stopPropagation();
  const menu = document.getElementById('more-dropdown-menu');
  if (menu) {
    menu.classList.toggle('show');
  }
};

// 화면 아무곳이나 클릭 시 더보기 드롭다운 자동으로 닫기
document.addEventListener('click', function(e) {
  const menu = document.getElementById('more-dropdown-menu');
  const toggleBtn = document.getElementById('btn-more-toggle');
  if (menu && menu.classList.contains('show')) {
    if (!menu.contains(e.target) && e.target !== toggleBtn) {
      menu.classList.remove('show');
    }
  }
});

// JSON 내보내기 (데이터 백업)
window.exportDataJSON = function() {
  toggleMoreMenu();
  try {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(window.appData || {}));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `업무시트_백업_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  } catch (err) {
    alert("백업 파일 생성 중 오류가 발생했습니다: " + err.message);
  }
};

// JSON 가져오기 (데이터 대량 등록)
window.importDataJSON = function() {
  toggleMoreMenu();
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.json';
  fileInput.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = event => {
      try {
        const importedData = JSON.parse(event.target.result);
        if (confirm("기존 데이터에 덮어쓰거나 복원하시겠습니까?")) {
          window.appData = Object.assign(window.appData || {}, importedData);
          if (typeof saveCurrentViewData === 'function') saveCurrentViewData();
          if (typeof renderCurrentView === 'function') renderCurrentView();
          alert("데이터가 성공적으로 대량 등록되었습니다!");
        }
      } catch (err) {
        alert("올바르지 않은 JSON 파일 형식입니다.");
      }
    };
    reader.readAsText(file);
  };
  fileInput.click();
};


// ==========================================================================
// 3. 1학기/2학기 기준시간표 모달 및 기간 일괄 적용 로직 (새로 추가)
// ==========================================================================
window.activeSemesterTab = 1;
window.timetableConfig = JSON.parse(localStorage.getItem('app_timetable_config')) || {
  "1": { "mon": {}, "tue": {}, "wed": {}, "thu": {}, "fri": {} },
  "2": { "mon": {}, "tue": {}, "wed": {}, "thu": {}, "fri": {} }
};

// 기준시간표 모달 창 열기
window.openTimetableModal = function() {
  const menu = document.getElementById('more-dropdown-menu');
  if (menu) menu.classList.remove('show');
  
  const modal = document.getElementById('timetable-modal');
  if (modal) modal.style.display = 'flex';
  switchSemesterTab(1); // 기본 1학기 선택
};

// 기준시간표 모달 창 닫기
window.closeTimetableModal = function() {
  const modal = document.getElementById('timetable-modal');
  if (modal) modal.style.display = 'none';
};

// 학기 탭 전환
window.switchSemesterTab = function(sem) {
  window.activeSemesterTab = sem;
  document.getElementById('tab-sem-1').classList.toggle('active', sem === 1);
  document.getElementById('tab-sem-2').classList.toggle('active', sem === 2);
  renderTimetableForm();
};

// 시간표 입력 폼 렌더링
window.renderTimetableForm = function() {
  const tbody = document.getElementById('timetable-editor-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const semData = window.timetableConfig[window.activeSemesterTab] || {};
  const days = ['mon', 'tue', 'wed', 'thu', 'fri'];

  for (let p = 1; p <= 6; p++) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><strong>${p}교시</strong></td>` + days.map(d => {
      const val = (semData[d] && semData[d][p]) || '';
      return `<td><input type="text" data-day="${d}" data-period="${p}" value="${val}" placeholder="과목명"></td>`;
    }).join('');
    tbody.appendChild(tr);
  }
};

// 기준시간표 저장
window.saveTimetableConfig = function() {
  const inputs = document.querySelectorAll('#timetable-editor-tbody input');
  const semData = window.timetableConfig[window.activeSemesterTab] || {};

  inputs.forEach(input => {
    const day = input.getAttribute('data-day');
    const period = input.getAttribute('data-period');
    if (!semData[day]) semData[day] = {};
    semData[day][period] = input.value.trim();
  });

  window.timetableConfig[window.activeSemesterTab] = semData;
  localStorage.setItem('app_timetable_config', JSON.stringify(window.timetableConfig));
  alert(`${window.activeSemesterTab}학기 기준시간표가 저장되었습니다!`);
};

// 선택한 기간에 기준시간표 일괄 적용
window.applyTimetableToRange = function() {
  const sem = document.getElementById('apply-semester-select').value;
  const startDateStr = document.getElementById('apply-start-date').value;
  const endDateStr = document.getElementById('apply-end-date').value;

  if (!startDateStr || !endDateStr) {
    alert("시작일과 종료일을 모두 선택해 주세요.");
    return;
  }

  const startDate = new Date(startDateStr);
  const endDate = new Date(endDateStr);

  if (startDate > endDate) {
    alert("시작일은 종료일보다 이전이어야 합니다.");
    return;
  }

  if (!confirm(`${startDateStr} ~ ${endDateStr} 기간 동안 ${sem}학기 기준시간표를 일괄 적용하시겠습니까?`)) {
    return;
  }

  const semData = window.timetableConfig[sem];
  if (!semData) {
    alert("해당 학기의 기준시간표가 먼저 등록되어야 합니다.");
    return;
  }

  const dayMap = { 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri' };
  let appliedCount = 0;

  let cur = new Date(startDate);
  while (cur <= endDate) {
    const dayOfWeek = cur.getDay(); // 1:월 ~ 5:금
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      const dayKey = dayMap[dayOfWeek];
      const yyyy = cur.getFullYear();
      const mm = String(cur.getMonth() + 1).padStart(2, '0');
      const dd = String(cur.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;

      if (!window.appData) window.appData = {};
      if (!window.appData[dateStr]) window.appData[dateStr] = { periods: {}, memo: '', event: '' };

      const daySchedule = semData[dayKey] || {};
      for (let p = 1; p <= 6; p++) {
        const subj = daySchedule[p] || '';
        if (subj) {
          if (!window.appData[dateStr].periods) window.appData[dateStr].periods = {};
          if (!window.appData[dateStr].periods[p]) window.appData[dateStr].periods[p] = { subject: '', supplies: '', memo: '' };
          window.appData[dateStr].periods[p].subject = subj;
        }
      }
      appliedCount++;
    }
    cur.setDate(cur.getDate() + 1);
  }

  // 데이터 저장 및 화면 업데이트
  if (typeof saveCurrentViewData === 'function') {
    saveCurrentViewData();
  }

  alert(`총 ${appliedCount}일간의 평일에 ${sem}학기 기준시간표가 성공적으로 적용되었습니다!`);
  closeTimetableModal();

  if (typeof renderCurrentView === 'function') {
    renderCurrentView();
  }
};
