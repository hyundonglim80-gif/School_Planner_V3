// js/app.js

/**
 * 📌 [전역 상태 변수]
 * - currentScope: 현재 선택된 보기 범위 ('memo', 'year', 'month', 'week', 'day')
 * - currentMode: 현재 모드 ('viewer': 눈으로 보기, 'editor': 수정 및 입력)
 * - window.currentDate: 앱 전체의 기준 날짜 (기본 2026-07-20 시작)
 */
let currentScope = localStorage.getItem('workCalendar_scope') || 'week';
let currentMode = localStorage.getItem('workCalendar_mode') || 'viewer';

window.currentDate = new Date(); // 💡 접속한 기기의 현재(오늘) 날짜를 기준일로 설정

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

  // 💡 오류 해결: 함수 호출 시 앞에 'window.'을 명시하여 브라우저가 전역 함수를 정확히 찾도록 강제 수정
  if (currentScope === 'week') { currentMode === 'editor' ? window.renderWeekEditor(container) : window.renderWeekViewer(container); }
  else if (currentScope === 'month') { currentMode === 'editor' ? window.renderMonthEditor(container) : window.renderMonthViewer(container); }
  else if (currentScope === 'year') { currentMode === 'editor' ? window.renderYearEditor(container) : window.renderYearViewer(container); }
  else if (currentScope === 'day') { currentMode === 'editor' ? window.renderDayEditor(container) : window.renderDayViewer(container); }
  else if (currentScope === 'memo') { window.renderMemoView(container); }
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
    // ✅ 년 보기 수정: 해당 연도 3월 1일부터 다음 해 2월 말일까지 (학교 학사 기준 완벽 매칭)
    const startYear = y;
    
    // 3(월)부터 14(내년 2월)까지 반복
    for (let m = 3; m <= 14; m++) { 
      let targetY = startYear;
      let targetM = m;
      
      // 13, 14가 들어오면 연도를 +1 하고, 월을 1월, 2월로 변환
      if (m > 12) {
        targetY = startYear + 1;
        targetM = m - 12;
      }
      
      // 해당 월의 마지막 날짜 구하기
      const lastDate = new Date(targetY, targetM, 0).getDate();
      
      for (let d = 1; d <= lastDate; d++) {
        // 자바스크립트 Date 객체는 월이 0부터 시작하므로 targetM - 1 처리
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
// 📥 통합 CSV 백업 다운로드 (일정 + 시간표)
// ---------------------------------------------------------
window.downloadCSV = async function() {
  // 1. 클라우드에서 일정과 시간표 데이터 모두 불러오기
  const eventSnap = await window.db.collection('events').get();
  const scheduleSnap = await window.db.collection('schedules').get();

  const eventMap = {};
  eventSnap.forEach(doc => { eventMap[doc.id] = doc.data().eventText || ''; });

  const scheduleMap = {};
  scheduleSnap.forEach(doc => { scheduleMap[doc.id] = doc.data().periods || {}; });

  // 2. 통합 CSV 문자열 생성 (1~6교시 분할)
  let csv = "년도,월,일,요일,일정,1교시,2교시,3교시,4교시,5교시,6교시\n";
  const targetDates = window.getTargetDateList(); // app.js의 헬퍼 함수 활용

  targetDates.forEach(item => {
    const eventText = eventMap[item.dateStr] || '';
    const periods = scheduleMap[item.dateStr] || {};
    const p1 = periods[1]?.subject || '';
    const p2 = periods[2]?.subject || '';
    const p3 = periods[3]?.subject || '';
    const p4 = periods[4]?.subject || '';
    const p5 = periods[5]?.subject || '';
    const p6 = periods[6]?.subject || '';

    // 기존 app.js에 있는 escapeCSV 함수를 사용해 안전하게 변환
    csv += `${item.year},${item.month},${item.day},${item.dayOfWeek},` +
           `${window.escapeCSV(eventText)},` +
           `${window.escapeCSV(p1)},${window.escapeCSV(p2)},${window.escapeCSV(p3)},` +
           `${window.escapeCSV(p4)},${window.escapeCSV(p5)},${window.escapeCSV(p6)}\n`;
  });

  const titlePrefix = currentScope === 'month' ? `${window.currentDate.getFullYear()}년_${window.currentDate.getMonth()+1}월` : `${window.currentDate.getFullYear()}학년도`;
  window.downloadCSVFile(`${titlePrefix}_통합백업.csv`, csv);
};

// ---------------------------------------------------------
// 📤 통합 CSV 업로드 및 동기화 (일정 + 시간표 동시 처리)
// ---------------------------------------------------------
window.uploadCSV = async function(input) {
  const file = input.files[0];
  if(!file) return;
  if(!confirm("⚠️ [경고] 업로드하는 파일 내용으로 기존 클라우드 데이터를 덮어씁니다.\n진행하시겠습니까?")) {
    input.value = ''; return;
  }

  const reader = new FileReader();
  reader.onload = async function(e) {
    const text = e.target.result;
    const rows = window.parseCSV(text); // 기존 app.js의 파서 활용
    const operations = [];

    // 1. 기존 일정 및 시간표 데이터 일괄 삭제 준비
    const eSnap = await window.db.collection('events').get();
    eSnap.forEach(doc => operations.push({ type: 'delete', ref: doc.ref }));
    const sSnap = await window.db.collection('schedules').get();
    sSnap.forEach(doc => operations.push({ type: 'delete', ref: doc.ref }));

    // 2. 통합 CSV 파싱 및 저장 준비
    // CSV 구조: 년도(0), 월(1), 일(2), 요일(3), 일정(4), 1교시(5)~6교시(10)
    for(let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if(row.length >= 11 && row[0].trim() && row[1].trim() && row[2].trim()) {
        const y = row[0].trim();
        const m = String(row[1].trim()).padStart(2, '0');
        const d = String(row[2].trim()).padStart(2, '0');
        const dateStr = `${y}-${m}-${d}`;
        
        const eventText = (row[4] || '').trim();
        const periodsData = {
          1: { subject: (row[5] || '').trim(), memo: '', supplies: '' },
          2: { subject: (row[6] || '').trim(), memo: '', supplies: '' },
          3: { subject: (row[7] || '').trim(), memo: '', supplies: '' },
          4: { subject: (row[8] || '').trim(), memo: '', supplies: '' },
          5: { subject: (row[9] || '').trim(), memo: '', supplies: '' },
          6: { subject: (row[10] || '').trim(), memo: '', supplies: '' }
        };

        // 일정이 있는 경우
        if (eventText) {
          const eRef = window.db.collection('events').doc(dateStr);
          operations.push({ type: 'set', ref: eRef, data: { eventText: eventText, updatedAt: Date.now() } });
        }
        
        // 시간표 저장
        const sRef = window.db.collection('schedules').doc(dateStr);
        operations.push({ type: 'set', ref: sRef, data: { periods: periodsData, updatedAt: Date.now() } });
      }
    }

    // 3. Firestore 배치 처리 실행
    await window.executeBatchOperations(operations);
    alert("✅ 일정 및 시간표 통합 데이터 동기화가 완료되었습니다!");
    window.render();
  };
  
  // 엑셀 한글 깨짐 완벽 방지를 위한 euc-kr 지정
  reader.readAsText(file, 'euc-kr');
  input.value = '';
};
