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

window.formatDate = function(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
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
// 📅 백업 및 데이터 관리 도구 엔진
// ==========================================================================
window.getTargetDateList = function() {
  const dates = [];
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const y = window.currentDate.getFullYear();
  const m = window.currentDate.getMonth();
  const d = window.currentDate.getDate();

  if (currentScope === 'day') {
    const dateObj = new Date(y, m, d);
    dates.push({ dateStr: window.formatDate(dateObj), year: y, month: m + 1, day: d, dayOfWeek: dayNames[dateObj.getDay()] });
  } else if (currentScope === 'week') {
    const tempDate = new Date(window.currentDate);
    const dayOfWeek = tempDate.getDay();
    const diffToSun = tempDate.getDate() - dayOfWeek;
    tempDate.setDate(diffToSun);
    for (let i = 0; i < 7; i++) {
      if (!window.showWeekend && (i === 0 || i === 6)) { tempDate.setDate(tempDate.getDate() + 1); continue; }
      dates.push({ dateStr: window.formatDate(tempDate), year: tempDate.getFullYear(), month: tempDate.getMonth() + 1, day: tempDate.getDate(), dayOfWeek: dayNames[tempDate.getDay()] });
      tempDate.setDate(tempDate.getDate() + 1);
    }
  } else if (currentScope === 'month') {
    const lastDate = new Date(y, m + 1, 0).getDate();
    for (let i = 1; i <= lastDate; i++) {
      const dateObj = new Date(y, m, i);
      dates.push({ dateStr: window.formatDate(dateObj), year: y, month: m + 1, day: i, dayOfWeek: dayNames[dateObj.getDay()] });
    }
  } else {
    const startYear = y;
    for (let monthIdx = 3; monthIdx <= 14; monthIdx++) { 
      let targetY = startYear;
      let targetM = monthIdx;
      if (monthIdx > 12) { targetY = startYear + 1; targetM = monthIdx - 12; }
      const lastDate = new Date(targetY, targetM, 0).getDate();
      for (let i = 1; i <= lastDate; i++) {
        const dateObj = new Date(targetY, targetM - 1, i);
        dates.push({ dateStr: window.formatDate(dateObj), year: targetY, month: targetM, day: i, dayOfWeek: dayNames[dateObj.getDay()] });
      }
    }
  }
  return dates;
};

window.downloadCSVFile = function(filename, csvData) {
  const bom = "\uFEFF";
  const blob = new Blob([bom + csvData], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
};

window.escapeCSV = function(str) {
  if (!str && str !== 0) return '';
  let s = String(str);
  let trimmed = s.trim();
  if (/^\d+[-/:]\d+$/.test(trimmed)) { return `'${trimmed}`; }
  s = s.replace(/"/g, '""');
  if (s.includes(',') || s.includes('\n') || s.includes('"')) { s = `"${s}"`; }
  return s;
};

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

window.downloadCSV = async function() {
  const eventSnap = await window.getUserCol('events').get();
  const scheduleSnap = await window.getUserCol('schedules').get();
  const journalSnap = await window.getUserCol('journals').get();

  const eventMap = {};
  eventSnap.forEach(doc => { 
    const data = doc.data();
    let eList = [];
    if (data.eventList && Array.isArray(data.eventList) && data.eventList.length > 0) {
      eList = data.eventList;
    } else if (data.eventText && data.eventText.trim() !== '') {
      eList = window.parseRawEventTextToEventList(data.eventText);
    }
    // 각 일정 항목을 [라벨] 내용 형태로 묶어서 백업 (줄바꿈이 있어도 라벨 구조 유지)
    eventMap[doc.id] = eList.map(e => `[${e.label}] ${e.content}`).join('\n');
  });

  const scheduleMap = {};
  scheduleSnap.forEach(doc => { scheduleMap[doc.id] = doc.data().periods || {}; });

  const journalMap = {};
  journalSnap.forEach(doc => { 
    const data = doc.data();
    let jList = [];
    if (data.entries && Array.isArray(data.entries) && data.entries.length > 0) {
      jList = data.entries;
    }
    // 각 일지 항목을 [라벨] 내용 형태로 묶어서 백업
    journalMap[doc.id] = jList.map(j => `[${j.label}] ${j.content}`).join('\n');
  });

  let csv = "년도,월,일,요일,일정," +
            "1교시 과목,2교시 과목,3교시 과목,4교시 과목,5교시 과목,6교시 과목," +
            "1교시 메모,2교시 메모,3교시 메모,4교시 메모,5교시 메모,6교시 메모," +
            "1교시 준비물,2교시 준비물,3교시 준비물,4교시 준비물,5교시 준비물,6교시 준비물,일지\n";
            
  const targetDates = window.getTargetDateList();

  targetDates.forEach(item => {
    const eventText = eventMap[item.dateStr] || '';
    const journalText = journalMap[item.dateStr] || '';
    const periods = scheduleMap[item.dateStr] || {};
    
    let rowStr = `${item.year},${item.month},${item.day},${item.dayOfWeek},${window.escapeCSV(eventText)}`;
    let subjects = []; let memos = []; let supplies = [];

    for (let p = 1; p <= 6; p++) {
      subjects.push(window.escapeCSV(periods[p]?.subject || ''));
      memos.push(window.escapeCSV(periods[p]?.memo || ''));
      supplies.push(window.escapeCSV(periods[p]?.supplies || ''));
    }
    rowStr += `,${subjects.join(',')},${memos.join(',')},${supplies.join(',')},${window.escapeCSV(journalText)}`;
    csv += rowStr + "\n";
  });

  let titlePrefix = `${window.currentDate.getFullYear()}학년도`;
  if (currentScope === 'day') {
    titlePrefix = `${window.currentDate.getFullYear()}년_${window.currentDate.getMonth()+1}월_${window.currentDate.getDate()}일`;
  } else if (currentScope === 'week') {
    const temp = new Date(window.currentDate);
    const day = temp.getDay();
    const sun = new Date(temp.setDate(temp.getDate() - day));
    const endDay = new Date(sun);
    endDay.setDate(sun.getDate() + 6);
    const mStr1 = String(sun.getMonth()+1).padStart(2,'0');
    const dStr1 = String(sun.getDate()).padStart(2,'0');
    const mStr2 = String(endDay.getMonth()+1).padStart(2,'0');
    const dStr2 = String(endDay.getDate()).padStart(2,'0');
    titlePrefix = `${window.currentDate.getFullYear()}년_${mStr1}${dStr1}_${mStr2}${dStr2}_주간`;
  } else if (currentScope === 'month') {
    titlePrefix = `${window.currentDate.getFullYear()}년_${window.currentDate.getMonth()+1}월`;
  }

  window.downloadCSVFile(`${titlePrefix}_백업.csv`, csv);
};

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

    const parseExcelText = (val) => {
      let v = (val || '').trim();
      if (v.startsWith('=')) v = v.substring(1);
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.substring(1, v.length - 1);
      }
      if (v.startsWith("'")) v = v.substring(1);
      return v;
    };

    // 💡 핵심 파서: 줄바꿈이 섞여 있더라도 대괄호([라벨]) 패턴을 기준으로 정확하게 일정/일지를 분리합니다.
    const parseStructuredList = (rawStr, defaultLabel) => {
        const text = parseExcelText(rawStr);
        if (!text) return [];
        
        // 정규식을 이용해 [라벨] 위치를 기준으로 문자열을 쪼갭니다.
        // 예: "[일정] 회의\n내용\n[행사] 축제" 형태를 완벽하게 인식
        const regex = /\[(.*?)\]/g;
        const matches = [...text.matchAll(regex)];
        
        if (matches.length === 0) {
            // 대괄호 라벨이 아예 없다면 전체를 하나의 내용으로 처리
            return [{ label: defaultLabel, content: text }];
        }

        const items = [];
        for (let i = 0; i < matches.length; i++) {
            const currentMatch = matches[i];
            const label = currentMatch[1].trim();
            const startIndex = currentMatch.index + currentMatch[0].length;
            
            // 다음 [라벨]이 시작하기 전까지의 텍스트를 현재 항목의 내용으로 가져옵니다.
            let endIndex = text.length;
            if (i + 1 < matches.length) {
                endIndex = matches[i + 1].index;
            }
            
            const content = text.substring(startIndex, endIndex).trim();
            items.push({ label: label, content: content });
        }
        return items;
    };

    for(let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if(row.length >= 5 && row[0].trim() && row[1].trim() && row[2].trim()) {
        const y = row[0].trim();
        const m = String(row[1].trim()).padStart(2, '0');
        const d = String(row[2].trim()).padStart(2, '0');
        const dateStr = `${y}-${m}-${d}`;
        
        // 💡 1. 일정 파싱 (라벨 기준 분할)
        const eventTextRaw = parseExcelText(row[4]);
        const eventList = parseStructuredList(eventTextRaw, '일정');
        const cleanEventText = eventList.map(e => `[${e.label}] ${e.content}`).join('\n');
        const isSkipDay = window.checkSkipConditionFromText(cleanEventText);
        
        const periodsData = {};
        for (let p = 1; p <= 6; p++) {
          let subj = parseExcelText(row[4 + p]);
          if (isSkipDay) subj = '';
          periodsData[p] = { subject: subj, memo: parseExcelText(row[10 + p]), supplies: parseExcelText(row[16 + p]) };
        }

        // 💡 2. 일지 파싱 (라벨 기준 분할)
        const journalTextRaw = parseExcelText(row[23] || '');
        const journalList = parseStructuredList(journalTextRaw, '참고');

        const eRef = window.getUserCol('events').doc(dateStr);
        operations.push({ type: 'set', ref: eRef, data: { eventList: eventList, eventText: cleanEventText, updatedAt: Date.now() } });
        
        const sRef = window.getUserCol('schedules').doc(dateStr);
        operations.push({ type: 'set', ref: sRef, data: { periods: periodsData, updatedAt: Date.now() } });

        const jRef = window.getUserCol('journals').doc(dateStr);
        if (journalList.length > 0) {
            operations.push({ type: 'set', ref: jRef, data: { entries: journalList, updatedAt: Date.now() } });
        } else {
            operations.push({ type: 'delete', ref: jRef });
        }
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
  let touchStartX = 0; let touchStartY = 0; let touchEndX = 0; let touchEndY = 0;
  let touchStartTime = 0; let isMultiTouch = false;
  const scopeOrder = ['memo', 'year', 'month', 'week', 'day'];
  const SWIPE_THRESHOLD = 50; const SWIPE_MAX_TIME = 800;  

  function getHorizontalEdgeState() {
    const vv = window.visualViewport;
    let scrollLeft = window.scrollX || document.documentElement.scrollLeft || document.body.scrollLeft || 0;
    if (vv && vv.offsetLeft) scrollLeft += vv.offsetLeft;
    const totalWidth = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth, vv ? vv.width * vv.scale : window.innerWidth);
    const viewportWidth = vv ? vv.width : window.innerWidth;
    const maxScrollLeft = Math.max(0, totalWidth - viewportWidth);
    return { isAtLeftEdge: scrollLeft <= 15, isAtRightEdge: scrollLeft >= (maxScrollLeft - 15) };
  }

  function handleSwipeGesture() {
    if (currentMode !== 'viewer') return;
    if (isMultiTouch) return;
    const deltaX = touchEndX - touchStartX; const deltaY = touchEndY - touchStartY;
    const deltaTime = Date.now() - touchStartTime;

    if (deltaTime > SWIPE_MAX_TIME) return;
    if (Math.abs(deltaY) > Math.abs(deltaX) / 2) return;

    if (Math.abs(deltaX) > SWIPE_THRESHOLD) {
      const { isAtLeftEdge, isAtRightEdge } = getHorizontalEdgeState();
      const currentIndex = scopeOrder.indexOf(currentScope);
      if (deltaX < 0) {
        if (isAtRightEdge && currentIndex !== -1 && currentIndex < scopeOrder.length - 1) {
            window.setScope(scopeOrder[currentIndex + 1]);
        }
      } else {
        if (isAtLeftEdge && currentIndex > 0) {
            window.setScope(scopeOrder[currentIndex - 1]);
        }
      }
    }
  }

  document.addEventListener('touchstart', e => {
    if (e.touches.length > 1) { isMultiTouch = true; return; }
    isMultiTouch = false;
    touchStartX = e.changedTouches[0].screenX; touchStartY = e.changedTouches[0].screenY;
    touchStartTime = Date.now();
  }, { passive: true });
  document.addEventListener('touchmove', e => { if (e.touches.length > 1) isMultiTouch = true; }, { passive: true });
  document.addEventListener('touchend', e => {
    if (isMultiTouch) return;
    touchEndX = e.changedTouches[0].screenX; touchEndY = e.changedTouches[0].screenY;
    handleSwipeGesture();
  }, { passive: true });
})();


// ==========================================================================
// ⌨️ 단축키(Keyboard Shortcuts) 이벤트 엔진
// ==========================================================================
document.addEventListener('keydown', function(event) {
  
  const isTyping = event.target.tagName === 'INPUT' || 
                   event.target.tagName === 'TEXTAREA' || 
                   event.target.isContentEditable;

  if (event.ctrlKey && event.key === 'Enter') {
    event.preventDefault();
    if (currentMode === 'editor') {
      window.saveCurrentViewData();
    }
    return;
  }

  

  if (isTyping) return;

  if (event.ctrlKey) {
    switch (event.key) {
      case 'ArrowLeft': 
        event.preventDefault();
        window.moveDate(-1);
        break;
      case 'ArrowRight': 
        event.preventDefault();
        window.moveDate(1);
        break;
      case ' ': 
        event.preventDefault();
        if(window.goToToday) window.goToToday();
        break;
      case 'ArrowUp': 
        event.preventDefault();
        if(currentMode !== 'viewer') window.setMode('viewer');
        break;
      case 'ArrowDown': 
        event.preventDefault();
        if(currentMode !== 'editor') window.setMode('editor');
        break;
    }
  }
  else if (event.shiftKey) {
    const scopeOrder = ['memo', 'year', 'month', 'week', 'day'];
    const currentIndex = scopeOrder.indexOf(currentScope);

    if (event.key === 'ArrowLeft') { 
      event.preventDefault();
      if (currentIndex > 0) window.setScope(scopeOrder[currentIndex - 1]);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      if (currentIndex !== -1 && currentIndex < scopeOrder.length - 1) window.setScope(scopeOrder[currentIndex + 1]);
    }
  }
  else {
    if (event.key === '/') { 
      event.preventDefault();
      if (typeof window.openSearchModal === 'function') window.openSearchModal();
    }
  }
});

// ==========================================================================
// 🏷️ [신규 시스템] 전역 일정 라벨 관리 및 렌더링 엔진
// ==========================================================================

// 1. 기본 라벨 설정 및 로드
window.getEventLabels = function() {
    let labels = JSON.parse(localStorage.getItem('workCalendar_eventLabels_v2'));
    if (!labels) {
        let oldLabels = JSON.parse(localStorage.getItem('workCalendar_eventLabels'));
        if (oldLabels && Array.isArray(oldLabels)) {
            labels = oldLabels.map(l => ({
                name: l,
                isSkip: l === '전일행사' || l === '휴일'
            }));
        } else {
            labels = [
                { name: '일정', isSkip: false },
                { name: '행사', isSkip: false },
                { name: '전일행사', isSkip: true },
                { name: '제출', isSkip: false },
                { name: '기타', isSkip: false }
            ];
        }
        localStorage.setItem('workCalendar_eventLabels_v2', JSON.stringify(labels));
    }
    return labels;
};

// 2. 특정 라벨이 수업을 삭제해야 하는(isSkip) 라벨인지 확인
window.isSkipLabel = function(labelName) {
    const labels = window.getEventLabels();
    const target = labels.find(l => l.name === labelName);
    return target ? target.isSkip : false; 
};

// 3. 텍스트를 파싱하여, 수업 삭제 조건(isSkip)이 하나라도 있는지 확인
window.checkSkipConditionFromText = function(rawText) {
    if (!rawText) return false;
    if (rawText.includes('(휴일)') || rawText.includes('(행사)')) return true;

    const regex = /\[(.*?)\]/g;
    let match;
    while ((match = regex.exec(rawText)) !== null) {
        if (window.isSkipLabel(match[1])) return true;
    }
    return false;
};

// 4. 모달창: 라벨 리스트 그리기
window.openEventLabelModal = function() {
    const modal = document.getElementById('event-label-modal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.style.display = 'flex'; // 강제로 화면에 표시
    }
    window.tempEditingLabels = JSON.parse(JSON.stringify(window.getEventLabels()));
    window.renderEventLabelManager();
};

window.renderEventLabelManager = function() {
    const container = document.getElementById('event-label-list-container');
    if (!container) return;
    
    // 💡 버그 원인 제거: 화면을 다시 그릴 때마다 원본으로 덮어씌우는 코드를 삭제합니다.
    // window.tempEditingLabels = JSON.parse(JSON.stringify(window.getEventLabels()));
    
    const drawList = () => {
        container.innerHTML = '';
        window.tempEditingLabels.forEach((label, index) => {
            const skipChecked = label.isSkip ? 'checked' : '';
            const skipColor = label.isSkip ? '#ef4444' : '#64748b';
            
            container.innerHTML += `
            <div style="display:flex; justify-content:space-between; align-items:center; background:#f8fafc; padding:8px 12px; border-radius:6px; border:1px solid #e2e8f0;">
                <span style="font-weight:bold; color:#1e40af; font-size:1.05rem;">${label.name}</span>
                <div style="display:flex; align-items:center; gap:12px;">
                    <label style="display:flex; align-items:center; gap:4px; font-size:0.85rem; color:${skipColor}; cursor:pointer;">
                        <input type="checkbox" onchange="window.tempEditingLabels[${index}].isSkip = this.checked; window.renderEventLabelManager();" ${skipChecked} style="accent-color:#ef4444;">
                        수업삭제
                    </label>
                    <button onclick="window.tempEditingLabels.splice(${index}, 1); window.renderEventLabelManager();" style="background:none; border:none; color:#ef4444; font-size:1.1rem; cursor:pointer;" title="삭제">✖</button>
                </div>
            </div>`;
        });
    };
    drawList();
};

// 5. 모달창: 새 라벨 추가
window.addNewEventLabel = function() {
    const nameInput = document.getElementById('new-label-name');
    const skipCheck = document.getElementById('new-label-skip');
    
    const name = nameInput.value.trim();
    if (!name) return alert("라벨 이름을 입력하세요.");
    if (window.tempEditingLabels.some(l => l.name === name)) return alert("이미 존재하는 라벨입니다.");
    
    window.tempEditingLabels.push({ name: name, isSkip: skipCheck.checked });
    
    nameInput.value = '';
    skipCheck.checked = false;
    window.renderEventLabelManager();
};

// 6. 모달창: 변경사항 최종 저장
window.saveEventLabels = function() {
    if (window.tempEditingLabels.length === 0) return alert("최소 1개의 라벨은 있어야 합니다.");
    localStorage.setItem('workCalendar_eventLabels_v2', JSON.stringify(window.tempEditingLabels));
    const modal = document.getElementById('event-label-modal');
    if(modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
    }
    alert("라벨 설정이 저장되었습니다.");
    window.render(); 
};

// 7. [핵심] 주/월/년 뷰어 모드에서 일정 리스트를 예쁜 HTML 뱃지로 변환
window.generateEventBadgesHTML = function(eventList) {
    if (!eventList || eventList.length === 0) return '';
    
    let html = `<div style="display:flex; flex-direction:column; gap:4px; margin-top:2px;">`;
    eventList.forEach(e => {
        let badgeColor = '#2563eb'; 
        let badgeBg = '#dbeafe';
        let textStyle = '';
        
        if (window.isSkipLabel(e.label)) {
            badgeColor = '#ef4444'; 
            badgeBg = '#fee2e2';
            textStyle = 'color:#ef4444; font-weight:bold;'; 
        } else if (e.label === '제출') {
            badgeColor = '#d97706'; 
            badgeBg = '#fef3c7';
        }

        html += `
        <div style="display:flex; align-items:flex-start; gap:4px; font-size:0.95rem; line-height:1.3;">
            <span style="background:${badgeBg}; color:${badgeColor}; padding:1px 5px; border-radius:4px; font-size:0.8rem; font-weight:bold; white-space:nowrap; flex-shrink:0;">${e.label}</span>
            <span style="white-space:pre-wrap; word-break:break-all; ${textStyle}">${e.content}</span>
        </div>`;
    });
    html += `</div>`;
    return html;
};

// 8. 텍스트 <-> 리스트 변환 엔진 고도화
if (!window.parseRawEventTextToEventList) {
  window.parseRawEventTextToEventList = function(rawText) {
      if (!rawText || !rawText.trim()) return [];
      const lines = rawText.split('\n');
      const eventList = [];
      const validLabels = window.getEventLabels().map(l => l.name);

      lines.forEach(line => {
          let t = line.trim();
          if(!t) return;
          
          const match = t.match(/^\[(.*?)\]\s*(.*)$/);
          if (match) {
              let labelName = match[1].trim();
              if (!validLabels.includes(labelName)) {
                  labelName = validLabels[0] || '일정'; 
              }
              eventList.push({ label: labelName, content: match[2].trim() });
          } else {
              let defaultLabel = validLabels[0] || '일정';
              if (t.includes('(휴일)') || t.includes('(행사)')) {
                  const skipLabel = window.getEventLabels().find(l => l.isSkip);
                  if (skipLabel) defaultLabel = skipLabel.name;
              }
              eventList.push({ label: defaultLabel, content: t });
          }
      });
      return eventList;
  };

  window.formatEventListToText = function(eventList) {
      if (!eventList || eventList.length === 0) return '';
      return eventList.map(e => `[${e.label}] ${e.content}`).join('\n');
  };
}

// ==========================================================================
// 🏷️ [신규 추가] 일지 라벨 관리 및 렌더링 엔진 (일정과 팝업창 통일)
// ==========================================================================

// 1. 일지 기본 라벨 설정 및 로드 (기본값: 참고/사건/감상/기타)
window.getJournalLabels = function() {
    let labels = JSON.parse(localStorage.getItem('workCalendar_journalLabels'));
    if (!labels || !Array.isArray(labels)) {
        labels = [
            { name: '참고' },
            { name: '사건' },
            { name: '감상' },
            { name: '기타' }
        ];
        localStorage.setItem('workCalendar_journalLabels', JSON.stringify(labels));
    }
    return labels;
};

// 2. 일지 라벨 모달창 열기
window.openJournalLabelModal = function() {
    const modal = document.getElementById('journal-label-modal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.style.display = 'flex'; // 화면 중앙에 표시
    }
    // 현재 저장된 라벨을 임시 배열에 복사하여 편집 시작
    window.tempEditingJournalLabels = JSON.parse(JSON.stringify(window.getJournalLabels()));
    window.renderJournalLabelManager();
};

// 3. 일지 라벨 리스트 화면에 그리기
window.renderJournalLabelManager = function() {
    const container = document.getElementById('journal-label-list-container');
    if (!container) return;
    
    container.innerHTML = '';
    
    window.tempEditingJournalLabels.forEach((label, index) => {
        container.innerHTML += `
        <div style="display:flex; justify-content:space-between; align-items:center; background:#fdf2f8; padding:8px 12px; border-radius:6px; border:1px solid #fbcfe8;">
            <span style="font-weight:bold; color:#9d174d; font-size:1.05rem;">${label.name}</span>
            <div style="display:flex; align-items:center; gap:12px;">
                <button onclick="window.tempEditingJournalLabels.splice(${index}, 1); window.renderJournalLabelManager();" style="background:none; border:none; color:#ef4444; font-size:1.1rem; cursor:pointer;" title="삭제">✖</button>
            </div>
        </div>`;
    });
};
// 4. 모달창: 새 일지 라벨 추가
window.addNewJournalLabel = function() {
    const nameInput = document.getElementById('new-journal-label-name');
    const name = nameInput.value.trim();
    
    if (!name) return alert("라벨 이름을 입력하세요.");
    if (window.tempEditingJournalLabels.some(l => l.name === name)) return alert("이미 존재하는 라벨입니다.");
    
    window.tempEditingJournalLabels.push({ name: name });
    
    nameInput.value = ''; // 입력창 비우기
    window.renderJournalLabelManager(); // 리스트 갱신
};

// 5. 모달창: 변경사항 최종 저장
window.saveJournalLabels = function() {
    if (window.tempEditingJournalLabels.length === 0) return alert("최소 1개의 일지 라벨은 있어야 합니다.");
    
    localStorage.setItem('workCalendar_journalLabels', JSON.stringify(window.tempEditingJournalLabels));
    
    const modal = document.getElementById('journal-label-modal');
    if(modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
    }
    alert("일지 라벨 설정이 성공적으로 저장되었습니다.");
    window.render(); // 화면 전체 새로고침 (뷰어/에디터에 즉시 반영)
};

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
