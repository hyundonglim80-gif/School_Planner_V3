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

  // 💡 메모 화면에서는 <이전 / 다음> 버튼 숨기기
  const navBtns = document.querySelectorAll('.nav-btn');
  navBtns.forEach(btn => {
    btn.style.display = (currentScope === 'memo') ? 'none' : '';
  });

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


// ==========================================================================
// 💾 [신규 기능: 데이터 백업 및 대량 등록 (CSV 동기화 엔진)]
// ==========================================================================

// 1. CSV 파일 생성 및 다운로드 (한글 깨짐 방지 BOM 포함)
window.downloadCSVFile = function(filename, csvData) {
  const bom = "\uFEFF";
  const blob = new Blob([bom + csvData], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
};

// 2. CSV 문자열 이스케이프 처리 (내용에 쉼표나 엔터가 있을 때 보호)
window.escapeCSV = function(str) {
  if (!str) return '';
  let s = String(str).replace(/"/g, '""');
  if (s.includes(',') || s.includes('\n') || s.includes('"')) {
    s = `"${s}"`;
  }
  return s;
};

// 3. 강력한 CSV 파서 (엔터, 쉼표가 포함된 복잡한 셀도 완벽 분리)
window.parseCSV = function(str) {
  const arr = [];
  let quote = false;
  let col = 0, row = 0;
  for (let c = 0; c < str.length; c++) {
    let cc = str[c], nc = str[c+1];
    arr[row] = arr[row] || [];
    arr[row][col] = arr[row][col] || '';
    if (cc == '"' && quote && nc == '"') { arr[row][col] += cc; ++c; continue; }
    if (cc == '"') { quote = !quote; continue; }
    if (cc == ',' && !quote) { ++col; continue; }
    if (cc == '\r' && nc == '\n' && !quote) { ++row; col = 0; ++c; continue; }
    if (cc == '\n' && !quote) { ++row; col = 0; continue; }
    if (cc == '\r' && !quote) { ++row; col = 0; continue; }
    arr[row][col] += cc;
  }
  return arr;
};

// 4. Firestore 500개 제한 돌파를 위한 분할 일괄 처리(Chunk Batch)
window.executeBatchOperations = async function(operations) {
  const chunkSize = 400; 
  for (let i = 0; i < operations.length; i += chunkSize) {
    const chunk = operations.slice(i, i + chunkSize);
    const batch = window.db.batch();
    chunk.forEach(op => {
      if (op.type === 'delete') batch.delete(op.ref);
      else if (op.type === 'set') batch.set(op.ref, op.data);
    });
    await batch.commit();
  }
};

// ---------------------------------------------------------
// 📥 [일정(Events)] 다운로드 및 업로드
// ---------------------------------------------------------
window.downloadEventsCSV = async function() {
  const snapshot = await window.db.collection('events').get();
  let csv = "날짜,일정\n";
  snapshot.forEach(doc => {
    const data = doc.data();
    if(data.eventText) {
      csv += `${doc.id},${window.escapeCSV(data.eventText)}\n`;
    }
  });
  window.downloadCSVFile("학사일정_백업.csv", csv);
};

window.uploadEventsCSV = async function(input) {
  const file = input.files[0];
  if(!file) return;
  if(!confirm("⚠️ [경고] 업로드하는 파일 내용이 '원본'이 됩니다!\n기존의 모든 일정은 삭제되고 파일 내용으로 100% 교체됩니다.\n진행하시겠습니까?")) {
    input.value = ''; return;
  }

  const reader = new FileReader();
  reader.onload = async function(e) {
    const text = e.target.result;
    const rows = window.parseCSV(text);
    const operations = [];

    // 1) 기존 모든 일정 삭제 예약
    const snapshot = await window.db.collection('events').get();
    snapshot.forEach(doc => operations.push({ type: 'delete', ref: doc.ref }));

    // 2) 파일 데이터 바탕으로 새 일정 추가 예약 (헤더 제외)
    for(let i=1; i<rows.length; i++) {
      const row = rows[i];
      if(row.length >= 2 && row[0].trim()) {
        const dateStr = row[0].trim();
        const eventText = row[1].trim();
        if(dateStr) {
          const ref = window.db.collection('events').doc(dateStr);
          operations.push({ type: 'set', ref: ref, data: { eventText: eventText, updatedAt: Date.now() } });
        }
      }
    }

    await window.executeBatchOperations(operations);
    alert("✅ 파일 기준 일정 동기화가 완료되었습니다!");
    window.render();
  };
  reader.readAsText(file);
  input.value = '';
};

// ---------------------------------------------------------
// 📥 [시간표(Schedules)] 다운로드 및 업로드
// ---------------------------------------------------------
window.downloadSchedulesCSV = async function() {
  const snapshot = await window.db.collection('schedules').get();
  let csv = "날짜,교시,과목,메모,준비물\n";
  snapshot.forEach(doc => {
    const data = doc.data();
    if(data.periods) {
      for(let p=1; p<=6; p++) {
         const pData = data.periods[p];
         if(pData && (pData.subject || pData.memo || pData.supplies)) {
           csv += `${doc.id},${p},${window.escapeCSV(pData.subject)},${window.escapeCSV(pData.memo)},${window.escapeCSV(pData.supplies)}\n`;
         }
      }
    }
  });
  window.downloadCSVFile("시간표_백업.csv", csv);
};

window.uploadSchedulesCSV = async function(input) {
  const file = input.files[0];
  if(!file) return;
  if(!confirm("⚠️ [경고] 업로드하는 파일 내용이 '원본'이 됩니다!\n기존의 모든 시간표는 삭제되고 파일 내용으로 100% 교체됩니다.\n진행하시겠습니까?")) {
    input.value = ''; return;
  }

  const reader = new FileReader();
  reader.onload = async function(e) {
    const text = e.target.result;
    const rows = window.parseCSV(text);
    const operations = [];
    const schedulesByDate = {};

    // 1) CSV 파싱 및 날짜별로 그룹화
    for(let i=1; i<rows.length; i++) {
      const row = rows[i];
      if(row.length >= 5 && row[0].trim()) {
        const dateStr = row[0].trim();
        const p = row[1].trim();
        const subject = row[2].trim();
        const memo = row[3].trim();
        const supplies = row[4].trim();

        if(!schedulesByDate[dateStr]) schedulesByDate[dateStr] = {};
        schedulesByDate[dateStr][p] = { subject, memo, supplies };
      }
    }

    // 2) 기존 모든 시간표 삭제 예약
    const snapshot = await window.db.collection('schedules').get();
    snapshot.forEach(doc => operations.push({ type: 'delete', ref: doc.ref }));

    // 3) 새 시간표 추가 예약
    Object.keys(schedulesByDate).forEach(dateStr => {
      const ref = window.db.collection('schedules').doc(dateStr);
      operations.push({ type: 'set', ref: ref, data: { periods: schedulesByDate[dateStr], updatedAt: Date.now() } });
    });

    await window.executeBatchOperations(operations);
    alert("✅ 파일 기준 시간표 동기화가 완료되었습니다!");
    window.render();
  };
  reader.readAsText(file);
  input.value = '';
};
