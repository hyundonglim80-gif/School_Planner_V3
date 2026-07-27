// js/app.js

/**
 * 📌 [전역 상태 변수]
 * - currentScope: 현재 선택된 보기 범위 ('memo', 'year', 'month', 'week', 'day')
 * - currentMode: 현재 모드 ('viewer': 눈으로 보기, 'editor': 수정 및 입력)
 * - window.currentDate: 앱 전체의 기준 날짜 (기본 2026-07-20 시작)
 */
let currentScope = localStorage.getItem('workCalendar_scope') || 'week';
let currentMode = localStorage.getItem('workCalendar_mode') || 'viewer';

// 💡 [신규] 주말 표시 여부 상태 저장 (기본값은 숨김)
window.showWeekend = localStorage.getItem('workCalendar_showWeekend') === 'true';

window.currentDate = new Date(); // 접속한 기기의 현재(오늘) 날짜를 기준일로 설정

// 💡 [신규] 주말 보기/숨기기 전환 함수
window.toggleWeekend = function() {
  window.showWeekend = !window.showWeekend;
  localStorage.setItem('workCalendar_showWeekend', window.showWeekend);
  window.render(); // 화면 즉시 새로고침
};

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
 * 🔘 [신규] 수정/저장 버튼 통합 클릭 핸들러
 */
window.handleEditSaveClick = function() {
  if (currentMode === 'viewer') {
    window.setMode('editor'); // 뷰어일 때는 수정 모드로 진입
  } else {
    window.saveCurrentViewData(); // 수정 모드일 때는 데이터 저장
  }
};

/**
 * 🔘 [신규] 드롭다운 메뉴 토글 및 외부 클릭 시 닫기
 */
window.toggleMoreMenu = function() {
  const dropdown = document.getElementById('more-dropdown');
  if (dropdown) dropdown.classList.toggle('hidden');
};

window.addEventListener('click', function(e) {
  const btn = document.getElementById('btn-more-menu');
  const dropdown = document.getElementById('more-dropdown');
  if (btn && dropdown) {
    // 버튼이나 드롭다운 내부를 클릭한 게 아니라면 드롭다운을 닫음
    if (!btn.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.classList.add('hidden');
    }
  }
});

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
  const modeGroup = document.querySelector('.mode-group');

  if (modeGroup) {
    modeGroup.style.display = (currentScope === 'memo') ? 'none' : 'flex';
  }

  const navBtns = document.querySelectorAll('.nav-btn');
  navBtns.forEach(btn => {
    btn.style.display = (currentScope === 'memo') ? 'none' : '';
  });

  if (viewerBtn && editorBtn) {
    viewerBtn.className = currentMode === 'viewer' ? 'btn-mode active-viewer' : 'btn-mode';

    if (currentMode === 'viewer') {
      editorBtn.innerHTML = '✏️ 수정';
      editorBtn.className = 'btn-mode';
    } else {
      editorBtn.innerHTML = '💾 저장';
      editorBtn.className = 'btn-mode save-mode';
    }
  }

  // 💡 [수정됨] 점 세개 버튼 표시 제어 (수정 모드일 때 보임 - 년/월/주/일 전체)
  const moreBtn = document.getElementById('btn-more-menu');
  if (moreBtn) {
    if (currentMode === 'editor' && currentScope !== 'memo') {
      moreBtn.style.display = 'inline-flex';
    } else {
      moreBtn.style.display = 'none';
    }
  }

  // 화면이나 모드가 바뀔 때 열려있던 드롭다운은 무조건 닫기
  const dropdown = document.getElementById('more-dropdown');
  if (dropdown) dropdown.classList.add('hidden');

  // 💡 주말 버튼 상태 및 표시 여부 업데이트
  const weekendBtn = document.getElementById('btn-toggle-weekend');
  if (weekendBtn) {
    weekendBtn.innerHTML = window.showWeekend ? '주말 숨기기' : '주말 보기';
    // 일(Day) 보기나 메모(Memo) 화면에서는 굳이 필요 없으므로 숨김
    weekendBtn.style.display = (currentScope === 'memo' || currentScope === 'day') ? 'none' : 'inline-block';
  }
}
/**
 * 💾 [저장] 버튼 클릭 시 현재 활성화된 Scope에 맞춰 Firestore 일괄 저장 실행
 */
window.saveCurrentViewData = async function() {
  const editorBtn = document.getElementById('btn-mode-editor');
  
  if (editorBtn) {
    editorBtn.innerHTML = "⏳ 저장중..";
    editorBtn.disabled = true;
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

  if (editorBtn) {
    editorBtn.disabled = false;
  }
  
  // 저장 완료 후 다시 뷰어 모드로 자동 전환 -> 버튼도 알아서 '✏️ 수정'으로 돌아감
  window.setMode('viewer'); 
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

// ✅ 수정: 브라우저 요소와 스크립트가 충분히 로드된 후 최초 렌더링 및 이벤트 연결 실행
// ✅ (js/app.js 파일의 제일 마지막 부분 덮어쓰기)
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

  // 💡 [신규] 로그인 상태 감지 및 자동 로그인 처리 로직
  window.auth.onAuthStateChanged(user => {
    if (user) {
      // 1. 이미 로그인 된 사용자라면 (자동 로그인) 로그인 화면을 숨기고 메인 화면을 보여줌
      document.getElementById('login-screen').style.display = 'none';
      document.getElementById('user-info').style.display = 'flex';
      // 프로필 사진 불러오기
      if(user.photoURL) document.getElementById('user-photo').src = user.photoURL;
      
      // 2. 로그인 한 사람의 개인 데이터를 불러와서 화면에 그림
      window.render();
    } else {
      // 로그아웃 상태라면 메인 화면을 지우고 로그인 덮개 화면을 표시함
      document.getElementById('login-screen').style.display = 'flex';
      document.getElementById('user-info').style.display = 'none';
      document.getElementById("main-view").innerHTML = ""; 
    }
  });
});


// ==========================================================================
// 💾 [데이터 백업 및 대량 등록 (CSV 동기화 엔진)]
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

// 2. CSV 문자열 이스케이프 처리 (💡 엑셀 날짜 변환 방지 - 작은따옴표 방식 적용)
window.escapeCSV = function(str) {
  if (!str && str !== 0) return '';
  let s = String(str);
  let trimmed = s.trim();
  
  // 🎯 [수정됨] "4-2", "10/2" 같은 패턴일 경우 앞에 작은따옴표(')를 붙임
  if (/^\d+[-/:]\d+$/.test(trimmed)) {
    return `'${trimmed}`;
  }

  s = s.replace(/"/g, '""');
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

// 💡 헬퍼 함수: 현재 화면(월 또는 년)에 해당하는 전체 날짜 리스트
window.getTargetDateList = function() {
  const dates = [];
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const y = window.currentDate.getFullYear();

  if (currentScope === 'month') {
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
    const startYear = y;
    for (let m = 3; m <= 14; m++) { 
      let targetY = startYear;
      let targetM = m;
      if (m > 12) { targetY = startYear + 1; targetM = m - 12; }
      
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
// 📥 통합 CSV 백업 다운로드
// ---------------------------------------------------------
window.downloadCSV = async function() {
  const eventSnap = await window.getUserCol('events').get();
  const scheduleSnap = await window.getUserCol('schedules').get();

  const eventMap = {};
  eventSnap.forEach(doc => { eventMap[doc.id] = doc.data().eventText || ''; });

  const scheduleMap = {};
  scheduleSnap.forEach(doc => { scheduleMap[doc.id] = doc.data().periods || {}; });

  let csv = "년도,월,일,요일,일정," +
            "1교시 과목,2교시 과목,3교시 과목,4교시 과목,5교시 과목,6교시 과목," +
            "1교시 메모,2교시 메모,3교시 메모,4교시 메모,5교시 메모,6교시 메모," +
            "1교시 준비물,2교시 준비물,3교시 준비물,4교시 준비물,5교시 준비물,6교시 준비물\n";
            
  const targetDates = window.getTargetDateList();

  targetDates.forEach(item => {
    const eventText = eventMap[item.dateStr] || '';
    const periods = scheduleMap[item.dateStr] || {};
    
    let rowStr = `${item.year},${item.month},${item.day},${item.dayOfWeek},${window.escapeCSV(eventText)}`;

    let subjects = [];
    let memos = [];
    let supplies = [];

    for (let p = 1; p <= 6; p++) {
      subjects.push(window.escapeCSV(periods[p]?.subject || ''));
      memos.push(window.escapeCSV(periods[p]?.memo || ''));
      supplies.push(window.escapeCSV(periods[p]?.supplies || ''));
    }

    rowStr += `,${subjects.join(',')},${memos.join(',')},${supplies.join(',')}`;
    csv += rowStr + "\n";
  });

  const titlePrefix = currentScope === 'month' ? `${window.currentDate.getFullYear()}년_${window.currentDate.getMonth()+1}월` : `${window.currentDate.getFullYear()}학년도`;
  window.downloadCSVFile(`${titlePrefix}_통합백업.csv`, csv);
};

// ---------------------------------------------------------
// 📤 통합 CSV 업로드 및 동기화 (💡 엑셀 수식 기호(=) 완벽 제거)
// ---------------------------------------------------------
window.uploadCSV = async function(input) {
  const file = input.files[0];
  if(!file) return;
  if(!confirm("⚠️ [안내] 업로드하는 파일에 포함된 '해당 날짜'의 데이터만 수정됩니다.\n(파일에 없는 다른 달의 데이터는 그대로 안전하게 유지됩니다.)\n진행하시겠습니까?")) {
    input.value = ''; return;
  }

  const reader = new FileReader();
  reader.onload = async function(e) {
    const text = e.target.result;
    const rows = window.parseCSV(text);
    const operations = [];

    // 💡 엑셀에서 날짜 자동 변환을 막기 위해 쓴 =, ", ' 기호를 완벽하게 벗겨내는 함수
    const parseExcelText = (val) => {
      let v = (val || '').trim();
      
      // 1. 맨 앞이 '='로 시작하면 '=' 기호 먼저 제거 (예: =4-2 -> 4-2)
      if (v.startsWith('=')) {
        v = v.substring(1);
      }
      
      // 2. 양끝이 큰따옴표(")나 작은따옴표(')로 감싸져 있다면 알맹이만 추출
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.substring(1, v.length - 1);
      }
      
      // 3. 🎯 [신규] 맨 앞에 작은따옴표(') 하나만 붙어있는 경우 제거 ('4-2 -> 4-2)
      if (v.startsWith("'")) {
        v = v.substring(1);
      }
      
      return v;
    };

    for(let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if(row.length >= 5 && row[0].trim() && row[1].trim() && row[2].trim()) {
        const y = row[0].trim();
        const m = String(row[1].trim()).padStart(2, '0');
        const d = String(row[2].trim()).padStart(2, '0');
        const dateStr = `${y}-${m}-${d}`;
        
        const eventText = parseExcelText(row[4]);
        
        const isSkipDay = eventText.includes('(휴일)') || eventText.includes('(행사)');
        
        const periodsData = {};
        
        for (let p = 1; p <= 6; p++) {
          let subj = parseExcelText(row[4 + p]);
          
          if (isSkipDay) {
            subj = '';
          }

          periodsData[p] = {
            subject: subj,
            memo: parseExcelText(row[10 + p]),
            supplies: parseExcelText(row[16 + p])
          };
        }

        // 💡 주의: 구글 로그인 연동 시 getUserCol을 사용합니다.
        const eRef = window.getUserCol('events').doc(dateStr);
        operations.push({ type: 'set', ref: eRef, data: { eventText: eventText, updatedAt: Date.now() } });
        
        const sRef = window.getUserCol('schedules').doc(dateStr);
        operations.push({ type: 'set', ref: sRef, data: { periods: periodsData, updatedAt: Date.now() } });
      }
    }

    await window.executeBatchOperations(operations);
    alert("✅ 데이터가 성공적으로 동기화 및 업데이트되었습니다!");
    window.render();
  };
  
  reader.readAsText(file, 'utf-8');
  input.value = '';
};

// ==========================================================================
// 📱 모바일 스와이프(좌우 밀기) 화면 전환 제스처 기능
// ==========================================================================
(function() {
  let touchStartX = 0;
  let touchEndX = 0;
  // 화면 전환 순서 (메모 -> 년 -> 월 -> 주 -> 일)
  const scopeOrder = ['memo', 'year', 'month', 'week', 'day'];
  const SWIPE_THRESHOLD = 70; // 70px 이상 밀어야 스와이프로 인정 (오터치 방지)

  function handleSwipeGesture() {
    // 💡 [수정] window.을 빼고 파일 내의 currentMode 변수를 직접 확인합니다.
    if (currentMode !== 'viewer') return;

    const deltaX = touchEndX - touchStartX;

    // 좌우로 충분히 밀었는지 확인
    if (Math.abs(deltaX) > SWIPE_THRESHOLD) {
      // 💡 [수정] window.을 빼고 currentScope 변수를 직접 확인합니다.
      const currentIndex = scopeOrder.indexOf(currentScope);

      if (deltaX < 0) {
        // 👈 왼쪽으로 밀기 (오른쪽에서 왼쪽으로) -> 다음 화면으로 이동
        if (currentIndex !== -1 && currentIndex < scopeOrder.length - 1) {
          window.setScope(scopeOrder[currentIndex + 1]);
        }
      } else {
        // 👉 오른쪽으로 밀기 (왼쪽에서 오른쪽으로) -> 이전 화면으로 이동
        if (currentIndex > 0) {
          window.setScope(scopeOrder[currentIndex - 1]);
        }
      }
    }
  }

  // 화면 전체에 터치 이벤트 리스너 등록
  document.addEventListener('touchstart', e => {
    touchStartX = e.changedTouches[0].screenX;
  }, { passive: true });

  document.addEventListener('touchend', e => {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipeGesture();
  }, { passive: true });
})();
