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

// ✅ 수정: 브라우저 요소와 스크립트가 충분히 로드된 후 최초 렌더링 실행
window.addEventListener('DOMContentLoaded', () => {
  // DB 연동 시간을 조금 더 벌어주기 위해 약간의 지연(100ms) 후 렌더링
  setTimeout(() => {
    window.render();
  }, 100);
});


// ==========================================================================
// 💾 [데이터 백업 및 대량 등록 (CSV 동기화 엔진 - 5가지 요구사항 반영 완벽본)]
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

// 2. CSV 문자열 이스케이프 처리
window.escapeCSV = function(str) {
  if (!str) return '';
  let s = String(str).replace(/"/g, '""');
  if (s.includes(',') || s.includes('\n') || s.includes('"')) {
    s = `"${s}"`;
  }
  return s;
};

// 3. 강력한 CSV 파서
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

// 💡 헬퍼 함수: 현재 화면(월 또는 년)에 해당하는 전체 날짜 리스트(빈칸 포함, 년/월/일/요일 분할)
window.getTargetDateList = function() {
  const dates = [];
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const y = window.currentDate.getFullYear();

  if (currentScope === 'month') {
    // 월 보기: 해당 월의 1일부터 말일까지
    const m = window.currentDate.getMonth();
    const lastDate = new Date(y, m + 1, 0).getDate();
    for (let d = 1; d <= lastDate; d++) {
      const dateObj = new Date(y, m, d);
      dates.push({
        dateStr: window.formatDate(dateObj),
        year: y,
        month: m + 1,
        day: d,
        dayOfWeek: dayNames[dateObj.getDay()]
      });
    }
  } else {
    // 년 보기: 해당 연도 3월 1일부터 다음 해 2월 말일까지 (학교 학사 기준)
    const startYear = y;
    for (let m = 2; m <= 13; m++) { 
      let targetY = startYear;
      let targetM = m;
      if (m > 11) {
        targetY = startYear + 1;
        targetM = m - 12;
      }
      const lastDate = new Date(targetY, targetM, 0).getDate();
      for (let d = 1; d <= lastDate; d++) {
        const dateObj = new Date(targetY, targetM - 1, d);
        dates.push({
          dateStr: window.formatDate(dateObj),
          year: targetY,
          month: targetM,
          day: d,
          dayOfWeek: dayNames[dateObj.getDay()]
        });
      }
    }
  }
  return dates;
};

// ---------------------------------------------------------
// 📥 [일정(Events)] 전체 날짜 템플릿 다운로드 및 업로드
// ---------------------------------------------------------
window.downloadEventsCSV = async function() {
  const snapshot = await window.db.collection('events').get();
  const eventMap = {};
  snapshot.forEach(doc => {
    eventMap[doc.id] = doc.data().eventText || '';
  });

  const targetDates = window.getTargetDateList();
  let csv = "년도,월,일,요일,일정\n";
  
  targetDates.forEach(item => {
    const text = eventMap[item.dateStr] || '';
    csv += `${item.year},${item.month},${item.day},${item.dayOfWeek},${window.escapeCSV(text)}\n`;
  });

  const titlePrefix = currentScope === 'month' ? `${window.currentDate.getFullYear()}년_${window.currentDate.getMonth()+1}월` : `${window.currentDate.getFullYear()}학년도`;
  window.downloadCSVFile(`${titlePrefix}_학사일정템플릿.csv`, csv);
};

window.uploadEventsCSV = async function(input) {
  const file = input.files[0];
  if(!file) return;
  if(!confirm("⚠️ [경고] 업로드하는 파일 내용이 '원본'이 됩니다!\n기존 일정은 삭제되고 파일 내용으로 100% 교체됩니다.\n진행하시겠습니까?")) {
    input.value = ''; return;
  }

  const reader = new FileReader();
  reader.onload = async function(e) {
    const text = e.target.result;
    const rows = window.parseCSV(text);
    const operations = [];

    const snapshot = await window.db.collection('events').get();
    snapshot.forEach(doc => operations.push({ type: 'delete', ref: doc.ref }));

    // CSV 구조: 년도(0), 월(1), 일(2), 요일(3), 일정(4)
    for(let i=1; i<rows.length; i++) {
      const row = rows[i];
      if(row.length >= 5 && row[0].trim() && row[1].trim() && row[2].trim()) {
        const y = row[0].trim();
        const m = String(row[1].trim()).padStart(2, '0');
        const d = String(row[2].trim()).padStart(2, '0');
        const dateStr = `${y}-${m}-${d}`;
        const eventText = row[4] ? row[4].trim() : '';

        if(eventText) {
          const ref = window.db.collection('events').doc(dateStr);
          operations.push({ type: 'set', ref: ref, data: { eventText: eventText, updatedAt: Date.now() } });
        }
      }
    }

    await window.executeBatchOperations(operations);
    alert("✅ 파일 기준 일정 동기화가 완료되었습니다!");
    window.render();
  };
  
  // 💡 엑셀 한글 깨짐 완벽 방지를 위한 euc-kr 강제 지정
  reader.readAsText(file, 'euc-kr');
  input.value = '';
};

// ---------------------------------------------------------
// 📥 [시간표(Schedules)] 전체 날짜 템플릿 다운로드 및 업로드 (준비물 -> 메모 순서 준수)
// ---------------------------------------------------------
window.downloadSchedulesCSV = async function() {
  const snapshot = await window.db.collection('schedules').get();
  const scheduleMap = {};
  snapshot.forEach(doc => {
    scheduleMap[doc.id] = doc.data().periods || {};
  });

  const targetDates = window.getTargetDateList();
  let csv = "년도,월,일,요일,교시,과목,준비물,메모\n";

  targetDates.forEach(item => {
    const dayPeriods = scheduleMap[item.dateStr] || {};
    for(let p=1; p<=6; p++) {
      const pData = dayPeriods[p] || {};
      csv += `${item.year},${item.month},${item.day},${item.dayOfWeek},${p},${window.escapeCSV(pData.subject)},${window.escapeCSV(pData.supplies)},${window.escapeCSV(pData.memo)}\n`;
    }
  });

  const titlePrefix = currentScope === 'month' ? `${window.currentDate.getFullYear()}년_${window.currentDate.getMonth()+1}월` : `${window.currentDate.getFullYear()}학년도`;
  window.downloadCSVFile(`${titlePrefix}_시간표템플릿.csv`, csv);
};

window.uploadSchedulesCSV = async function(input) {
  const file = input.files[0];
  if(!file) return;
  if(!confirm("⚠️ [경고] 업로드하는 파일 내용이 '원본'이 됩니다!\n기존 시간표는 삭제되고 파일 내용으로 100% 교체됩니다.\n진행하시겠습니까?")) {
    input.value = ''; return;
  }

  const reader = new FileReader();
  reader.onload = async function(e) {
    const text = e.target.result;
    const rows = window.parseCSV(text);
    const operations = [];
    const schedulesByDate = {};

    // CSV 구조: 년도(0), 월(1), 일(2), 요일(3), 교시(4), 과목(5), 준비물(6), 메모(7)
    for(let i=1; i<rows.length; i++) {
      const row = rows[i];
      if(row.length >= 8 && row[0].trim() && row[1].trim() && row[2].trim()) {
        const y = row[0].trim();
        const m = String(row[1].trim()).padStart(2, '0');
        const d = String(row[2].trim()).padStart(2, '0');
        const dateStr = `${y}-${m}-${d}`;
        const p = row[4].trim();
        const subject = row[5].trim();
        const supplies = row[6].trim(); // 준비물
        const memo = row[7].trim();     // 메모

        if(!schedulesByDate[dateStr]) schedulesByDate[dateStr] = {};
        if(p) {
          schedulesByDate[dateStr][p] = { subject, memo, supplies };
        }
      }
    }

    const snapshot = await window.db.collection('schedules').get();
    snapshot.forEach(doc => operations.push({ type: 'delete', ref: doc.ref }));

    Object.keys(schedulesByDate).forEach(dateStr => {
      const ref = window.db.collection('schedules').doc(dateStr);
      operations.push({ type: 'set', ref: ref, data: { periods: schedulesByDate[dateStr], updatedAt: Date.now() } });
    });

    await window.executeBatchOperations(operations);
    alert("✅ 파일 기준 시간표 동기화가 완료되었습니다!");
    window.render();
  };

  reader.readAsText(file, 'euc-kr');
  input.value = '';
};
