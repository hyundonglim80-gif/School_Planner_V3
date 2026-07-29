//js/app.js

// =========================================================================
// 🚀 앱 상태 관리 및 초기화 설정
// =========================================================================
let currentScope = localStorage.getItem('workCalendar_scope') || 'week';
let currentMode = localStorage.getItem('workCalendar_mode') || 'viewer';
window.showWeekend = localStorage.getItem('workCalendar_showWeekend') === 'true';
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

window.setScope = function(scope) {
  if (currentMode === 'editor' && window.hasUnsavedChanges) {
    if (!confirm("작성 중인 데이터가 저장되지 않았습니다. 정말 이동하시겠습니까?")) return;
  }
  currentScope = scope;
  localStorage.setItem('workCalendar_scope', scope);
  window.hasUnsavedChanges = false;
  window.render();
};

window.setMode = function(mode) {
  currentMode = mode;
  localStorage.setItem('workCalendar_mode', mode);
  window.render();
};

// =========================================================================
// 🏷️ 라벨 및 데이터 처리 시스템 (💡 getEventLabels 함수 포함!)
// =========================================================================

// 일정 라벨 가져오기
window.getEventLabels = function() {
    const defaultLabels = [
        { name: '일정', isSkip: false },
        { name: '행사', isSkip: false },
        { name: '출장', isSkip: false },
        { name: '전일행사', isSkip: true }, 
        { name: '휴일', isSkip: true }
    ];
    try {
        const stored = localStorage.getItem('workCalendar_eventLabels');
        if (stored) return JSON.parse(stored);
    } catch(e) {}
    return defaultLabels;
};

// 특정 라벨이 수업을 지우는(Skip) 라벨인지 확인
window.isSkipLabel = function(labelName) {
    const labels = window.getEventLabels();
    const found = labels.find(l => l.name === labelName);
    return found ? found.isSkip : false;
};

// 일지 라벨 가져오기
window.getJournalLabels = function() {
    const defaultLabels = [
        { name: '참고' },
        { name: '사건' },
        { name: '감상' },
        { name: '기타' }
    ];
    try {
        const stored = localStorage.getItem('workCalendar_journalLabels');
        if (stored) return JSON.parse(stored);
    } catch(e) {}
    return defaultLabels;
};

// 이벤트 객체 배열을 레거시 텍스트 포맷으로 변환 (하위 호환성 유지)
window.formatEventListToText = function(eventList) {
    if (!eventList || eventList.length === 0) return '';
    return eventList.map(e => `[${e.label}] ${e.content}`).join('\n');
};

// 레거시 텍스트 포맷을 이벤트 객체 배열로 변환
window.parseRawEventTextToEventList = function(rawText) {
    if (!rawText || rawText.trim() === '') return [];
    const lines = rawText.split('\n').map(l => l.trim()).filter(l => l !== '');
    const validLabels = window.getEventLabels().map(l => l.name);
    
    const eventList = [];
    lines.forEach(line => {
        const match = line.match(/^\[(.*?)\]\s*(.*)$/);
        if (match) {
            let labelName = match[1].trim();
            if (!validLabels.includes(labelName)) {
                labelName = validLabels[0] || '일정'; 
            }
            eventList.push({ label: labelName, content: match[2].trim() });
        } else {
            let defaultLabel = validLabels[0] || '일정';
            if (line.includes('(휴일)') || line.includes('(행사)') || line.includes('[전일행사]')) {
                const skipLabel = window.getEventLabels().find(l => l.isSkip);
                if (skipLabel) defaultLabel = skipLabel.name;
            }
            eventList.push({ label: defaultLabel, content: line });
        }
    });
    return eventList;
};

// 뷰어 모드에서 일정 객체들을 알록달록한 배지(Badge) HTML로 변환
window.generateEventBadgesHTML = function(eventList) {
    if (!eventList || eventList.length === 0) return '';
    return eventList.map(e => {
        const isSkip = window.isSkipLabel(e.label);
        const bg = isSkip ? '#fee2e2' : '#eff6ff';
        const border = isSkip ? '#fca5a5' : '#bfdbfe';
        const color = isSkip ? '#ef4444' : '#2563eb';
        return `<div style="font-size:0.85rem; background:${bg}; border:1px solid ${border}; color:${color}; padding:3px 6px; border-radius:6px; margin-bottom:4px; line-height:1.3; font-weight:500;">
                  <b style="font-weight:900;">[${e.label}]</b> ${e.content}
                </div>`;
    }).join('');
};

// =========================================================================
// ⚙️ 수업 시수 동적 설정 시스템 (최대 교시 및 명칭 관리)
// =========================================================================
window.periodNames = ['1교시', '2교시', '3교시', '4교시', '5교시', '6교시'];
window.tempPeriodNames = [...window.periodNames];

window.loadSettings = async function() {
    try {
        const doc = await window.getUserCol('settings').doc('preferences').get();
        if (doc.exists && doc.data().periodNames) {
            window.periodNames = doc.data().periodNames;
        } else {
            window.periodNames = ['1교시', '2교시', '3교시', '4교시', '5교시', '6교시'];
        }
    } catch (e) {
        console.error("설정 불러오기 실패:", e);
        window.periodNames = ['1교시', '2교시', '3교시', '4교시', '5교시', '6교시'];
    }
};

window.openSettingsModal = function() {
    window.tempPeriodNames = [...window.periodNames];
    window.renderSettingsPeriods();
    document.getElementById('settings-modal').classList.remove('hidden');
    const dropdown = document.getElementById('more-dropdown');
    if (dropdown) dropdown.classList.add('hidden');
};

window.closeSettingsModal = function() {
    document.getElementById('settings-modal').classList.add('hidden');
};

window.renderSettingsPeriods = function() {
    const container = document.getElementById('settings-period-list');
    if (!container) return;
    container.innerHTML = '';

    window.tempPeriodNames.forEach((name, index) => {
        container.innerHTML += `
            <div style="display:flex; align-items:center; gap:10px;">
                <span style="font-weight:bold; width:60px; color:#475569;">${index + 1}번째</span>
                <input type="text" value="${name}" oninput="window.updateTempPeriodName(${index}, this.value)" style="flex:1; padding:8px 12px; border:1px solid #cbd5e1; border-radius:6px; font-size:1rem; outline:none;">
                <button onclick="window.removePeriodInput(${index})" style="background:none; border:none; color:#ef4444; font-size:1.2rem; cursor:pointer;" title="삭제">✖</button>
            </div>
        `;
    });
};

window.updateTempPeriodName = function(index, value) {
    window.tempPeriodNames[index] = value;
};

window.addPeriodInput = function() {
    window.tempPeriodNames.push(`새 시간 ${window.tempPeriodNames.length + 1}`);
    window.renderSettingsPeriods();
};

window.removePeriodInput = function(index) {
    if (window.tempPeriodNames.length <= 1) {
        alert("최소 1개의 시간은 존재해야 합니다.");
        return;
    }
    window.tempPeriodNames.splice(index, 1);
    window.renderSettingsPeriods();
};

window.saveSettings = async function(event) {
    const finalNames = window.tempPeriodNames.map(n => n.trim()).filter(n => n !== '');
    
    if (finalNames.length === 0) {
        alert("최소 1개의 유효한 명칭을 입력해야 합니다.");
        return;
    }

    const btn = event.target;
    btn.textContent = "저장 중...";
    btn.disabled = true;

    try {
        await window.getUserCol('settings').doc('preferences').set({
            periodNames: finalNames,
            updatedAt: Date.now()
        }, { merge: true });

        window.periodNames = [...finalNames];
        alert("✅ 설정이 성공적으로 저장 및 적용되었습니다.");
        window.closeSettingsModal();
        window.render();
    } catch (e) {
        console.error("설정 저장 오류:", e);
        alert("설정 저장 중 오류가 발생했습니다.");
    } finally {
        btn.textContent = "저장 및 적용";
        btn.disabled = false;
    }
};

// =========================================================================
// 🔄 핵심 렌더링 디스패처 (Scope 및 Mode에 따른 화면 분기)
// =========================================================================
window.render = async function() {
  await window.loadSettings();
  
  // 상단 헤더 정보 업데이트
  window.updateHeaderInfo();

  const mainView = document.getElementById('main-view');
  if (!mainView) return;

  if (currentScope === 'year') {
    if (currentMode === 'viewer' && typeof window.renderYearViewer === 'function') {
      await window.renderYearViewer(mainView);
    } else if (currentMode === 'editor' && typeof window.renderYearEditor === 'function') {
      await window.renderYearEditor(mainView);
    }
  } else if (currentScope === 'month') {
    if (currentMode === 'viewer' && typeof window.renderMonthViewer === 'function') {
      await window.renderMonthViewer(mainView);
    } else if (currentMode === 'editor' && typeof window.renderMonthEditor === 'function') {
      await window.renderMonthEditor(mainView);
    }
  } else if (currentScope === 'week') {
    if (currentMode === 'viewer' && typeof window.renderWeekViewer === 'function') {
      await window.renderWeekViewer(mainView);
    } else if (currentMode === 'editor' && typeof window.renderWeekEditor === 'function') {
      await window.renderWeekEditor(mainView);
    }
  } else if (currentScope === 'day') {
    if (currentMode === 'viewer' && typeof window.renderDayViewer === 'function') {
      await window.renderDayViewer(mainView);
    } else if (currentMode === 'editor' && typeof window.renderDayEditor === 'function') {
      await window.renderDayEditor(mainView);
    }
  } else if (currentScope === 'memo') {
    if (typeof window.renderMemoView === 'function') {
      await window.renderMemoView(mainView);
    }
  }
};

// 상단 헤더 날짜 및 학기 정보 동적 표시
window.updateHeaderInfo = function() {
  const infoEl = document.getElementById('header-info-text');
  if (!infoEl) return;

  const y = window.currentDate.getFullYear();
  const m = window.currentDate.getMonth() + 1;
  const d = window.currentDate.getDate();

  if (currentScope === 'year') {
    infoEl.textContent = `${y}학년도 연간 일정`;
  } else if (currentScope === 'month') {
    infoEl.textContent = `${y}년 ${m}월`;
  } else if (currentScope === 'week') {
    const weekNum = window.getWeekNumber(window.currentDate);
    infoEl.textContent = `${y}년 ${m}월 (${weekNum}주차)`;
  } else if (currentScope === 'day') {
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const dayName = dayNames[window.currentDate.getDay()];
    infoEl.textContent = `${y}년 ${m}월 ${d}일 (${dayName})`;
  } else if (currentScope === 'memo') {
    infoEl.textContent = `📝 즐겨찾기 링크 및 메모장`;
  }
};

// 주차 계산 헬퍼 함수
window.getWeekNumber = function(d) {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
  var yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
  var weekNo = Math.ceil((((d - yearStart) / 86400000) + 1)/7);
  return weekNo;
};

// =========================================================================
// 📂 CSV 백업 및 대량 등록 (동적 시수 대응)
// =========================================================================
window.escapeCSV = function(str) {
  if (!str) return '';
  return '"' + str.replace(/"/g, '""') + '"';
};

window.downloadCSV = async function() {
  const currentYear = window.currentDate.getFullYear();
  
  let csv = "년도,월,일,요일,일정,";
  window.periodNames.forEach((name, idx) => { csv += `${name} 과목${idx < window.periodNames.length - 1 ? ',' : ''}`; });
  csv += ",";
  window.periodNames.forEach((name, idx) => { csv += `${name} 메모${idx < window.periodNames.length - 1 ? ',' : ''}`; });
  csv += ",";
  window.periodNames.forEach((name, idx) => { csv += `${name} 준비물${idx < window.periodNames.length - 1 ? ',' : ''}`; });
  csv += "\n";

  try {
    const eventSnap = await window.getUserCol('events').get();
    const eventMap = {};
    eventSnap.forEach(doc => { eventMap[doc.id] = doc.data().eventText || ''; });

    const scheduleSnap = await window.getUserCol('schedules').get();
    const scheduleMap = {};
    scheduleSnap.forEach(doc => { scheduleMap[doc.id] = doc.data().periods || {}; });

    const targetDates = window.getTargetDateList(); 
    targetDates.forEach(item => {
      const eventText = eventMap[item.dateStr] || '';
      const periods = scheduleMap[item.dateStr] || {};
      
      let rowStr = `${item.year},${item.month},${item.day},${item.dayOfWeek},${window.escapeCSV(eventText)}`;
      
      // 과목
      window.periodNames.forEach((_, p) => {
        const periodIdx = p + 1;
        rowStr += `,${window.escapeCSV(periods[periodIdx] ? periods[periodIdx].subject : '')}`;
      });
      // 메모
      window.periodNames.forEach((_, p) => {
        const periodIdx = p + 1;
        rowStr += `,${window.escapeCSV(periods[periodIdx] ? periods[periodIdx].memo : '')}`;
      });
      // 준비물
      window.periodNames.forEach((_, p) => {
        const periodIdx = p + 1;
        rowStr += `,${window.escapeCSV(periods[periodIdx] ? periods[periodIdx].supplies : '')}`;
      });

      csv += rowStr + "\n";
    });

    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `학교_업무일정_백업_${currentYear}년.csv`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    console.error("백업 생성 중 오류:", e);
    alert("데이터 백업 중 오류가 발생했습니다.");
  }
};

window.getTargetDateList = function() {
  const list = [];
  const start = new Date(window.currentDate.getFullYear(), 0, 1);
  const end = new Date(window.currentDate.getFullYear(), 11, 31);
  let curr = new Date(start);

  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  while (curr <= end) {
    list.push({
      year: curr.getFullYear(),
      month: curr.getMonth() + 1,
      day: curr.getDate(),
      dayOfWeek: dayNames[curr.getDay()],
      dateStr: window.formatDate(curr)
    });
    curr.setDate(curr.getDate() + 1);
  }
  return list;
};

window.formatDate = function(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// =========================================================================
// 📱 모바일 스와이프 제스처 기능
// =========================================================================
(function() {
  let touchStartX = 0;
  let touchEndX = 0;

  document.addEventListener('touchstart', e => {
    touchStartX = e.changedTouches[0].screenX;
  }, false);

  document.addEventListener('touchend', e => {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
  }, false);

  function handleSwipe() {
    const threshold = 80;
    if (touchEndX < touchStartX - threshold) {
      window.moveDate(1); // 왼쪽으로 밀기 -> 다음 기간
    }
    if (touchEndX > touchStartX + threshold) {
      window.moveDate(-1); // 오른쪽으로 밀기 -> 이전 기간
    }
  }
})();

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

window.goToToday = function() {
  window.currentDate = new Date();
  window.render();
};

// 최초 앱 구동 바인딩
window.addEventListener('DOMContentLoaded', async () => {
  if (typeof firebase !== 'undefined' && window.auth) {
    window.auth.onAuthStateChanged(async user => {
      const loginScreen = document.getElementById('login-screen');
      if (user) {
        if (loginScreen) loginScreen.style.display = 'none';
        await window.loadSettings();
        window.render();
      } else {
        if (loginScreen) loginScreen.style.display = 'flex';
      }
    });
  } else {
    await window.loadSettings();
    window.render();
  }
});
