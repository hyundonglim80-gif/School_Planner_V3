// js/app.js

// ==========================================================================
// 🚀 앱 상태 관리 및 초기화 설정
// ==========================================================================
let currentScope = localStorage.getItem('workCalendar_scope') || 'week';
let currentMode = localStorage.getItem('workCalendar_mode') || 'viewer';
window.showWeekend = localStorage.getItem('workCalendar_showWeekend') === 'true';
window.showClass = localStorage.getItem('workCalendar_showClass') !== 'false'; 
window.currentDate = new Date(); 
window.hasUnsavedChanges = false;

window.toggleWeekend = async function() {
  if (currentMode === 'editor' && window.hasUnsavedChanges) await window.saveCurrentViewData(true);
  window.showWeekend = !window.showWeekend;
  localStorage.setItem('workCalendar_showWeekend', window.showWeekend);
  window.render();
};

window.toggleClass = async function() {
  if (currentMode === 'editor' && window.hasUnsavedChanges) await window.saveCurrentViewData(true);
  window.showClass = !window.showClass;
  localStorage.setItem('workCalendar_showClass', window.showClass);
  window.render();
};

window.setScope = async function(scope) {
  if (currentMode === 'editor' && window.hasUnsavedChanges) await window.saveCurrentViewData(true);
  currentScope = scope;
  localStorage.setItem('workCalendar_scope', scope);
  window.render();
};

window.setMode = async function(mode) {
  if (currentMode === 'editor' && mode === 'viewer' && window.hasUnsavedChanges) {
    await window.saveCurrentViewData(true);
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
    window.saveCurrentViewData(false);
  }
};

window.moveDate = async function(dir) {
  if (currentMode === 'editor' && window.hasUnsavedChanges) await window.saveCurrentViewData(true);
  
  if (currentScope === 'day') {
      window.currentDate.setDate(window.currentDate.getDate() + dir);
  } else if (currentScope === 'week') {
      window.currentDate.setDate(window.currentDate.getDate() + (dir * 7));
  } else if (currentScope === 'month') {
      const currentDay = window.currentDate.getDate();
      window.currentDate.setMonth(window.currentDate.getMonth() + dir);
      if (window.currentDate.getDate() < currentDay) {
          window.currentDate.setDate(0); 
      }
  } else if (currentScope === 'year') {
      window.currentDate.setFullYear(window.currentDate.getFullYear() + dir);
  }
  window.render();
};

// 💡 [수정] 렌더링 후 오늘 날짜 칸으로 자동 스크롤 이동 및 반짝임 효과
window.goToToday = async function() {
  if (currentMode === 'editor' && window.hasUnsavedChanges) await window.saveCurrentViewData(true);
  window.currentDate = new Date();
  window.render();

  setTimeout(() => {
      const todayStr = window.formatDate(window.currentDate);
      const todayEl = document.querySelector(`.week-today-cell, .month-today-cell, .year-today-cell, [data-date="${todayStr}"], [data-week-date="${todayStr}"]`);
      
      if (todayEl) {
          todayEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          const originalBg = todayEl.style.backgroundColor;
          const originalTransition = todayEl.style.transition;
          
          todayEl.style.transition = 'background-color 0.5s';
          todayEl.style.backgroundColor = '#fef08a'; // 강조 노란색
          
          setTimeout(() => {
              todayEl.style.backgroundColor = originalBg;
              setTimeout(() => { todayEl.style.transition = originalTransition; }, 500);
          }, 1200);
      }
  }, 300);
};

// ==========================================================================
// ⚙️ 환경 설정 (수업 시수 및 명칭 동적 설정)
// ==========================================================================
window.periodNames = ["1", "2", "3", "4", "5", "6"];
window.tempPeriodNames = [];

window.loadSettings = async function() {
    try {
        const doc = await window.getUserCol('settings').doc('preferences').get();
        if (doc.exists && doc.data().periodNames && doc.data().periodNames.length > 0) {
            window.periodNames = doc.data().periodNames;
        } else {
            window.periodNames = ["1", "2", "3", "4", "5", "6"];
        }
    } catch (error) {
        console.warn("설정 데이터를 불러올 권한이 없거나 에러가 발생했습니다. 기본값을 적용합니다.", error);
        window.periodNames = ["1", "2", "3", "4", "5", "6"];
    }
};

// ==========================================================================
// 🖥️ 메인 렌더링 엔진
// ==========================================================================
window.render = function() {
  const container = document.getElementById("main-view");
  if (!container) return; 

  container.innerHTML = "";
  updateTitle();
  updateButtonUI();

  try {
      if (currentScope === 'week') { currentMode === 'editor' ? window.renderWeekEditor(container) : window.renderWeekViewer(container); }
      else if (currentScope === 'month') { currentMode === 'editor' ? window.renderMonthEditor(container) : window.renderMonthViewer(container); }
      else if (currentScope === 'year') { currentMode === 'editor' ? window.renderYearEditor(container) : window.renderYearViewer(container); }
      else if (currentScope === 'day') { currentMode === 'editor' ? window.renderDayEditor(container) : window.renderDayViewer(container); }
      else if (currentScope === 'memo') { window.renderMemoView(container); }
  } catch (error) {
      console.error("화면 렌더링 중 오류 발생:", error);
      container.innerHTML = `<div style="text-align:center; padding: 50px; color:#ef4444; font-weight:bold;">데이터를 불러오는 중 오류가 발생했습니다.<br>잠시 후 다시 시도하거나 F5를 눌러주세요.</div>`;
  }
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
    let start, end;
    
    if (window.showWeekend) {
        const diffToSun = temp.getDate() - day;
        start = new Date(temp.setDate(diffToSun));
        end = new Date(start);
        end.setDate(start.getDate() + 6);
    } else {
        const diffToMon = temp.getDate() - day + (day === 0 ? -6 : 1);
        start = new Date(temp.setDate(diffToMon));
        end = new Date(start);
        end.setDate(start.getDate() + 4);
    }
    
    const mStr1 = String(start.getMonth() + 1).padStart(2, '0');
    const dStr1 = String(start.getDate()).padStart(2, '0');
    const mStr2 = String(end.getMonth() + 1).padStart(2, '0');
    const dStr2 = String(end.getDate()).padStart(2, '0');

    titleEl.textContent = `${y}년 ${m}월 (${mStr1}.${dStr1} ~ ${mStr2}.${dStr2})`;
  } else if (currentScope === 'month') { 
    titleEl.textContent = `${y}년 ${m}월`;
  } else if (currentScope === 'year') { 
    titleEl.textContent = `${y}학년도`;
  } else if (currentScope === 'memo') { 
    titleEl.textContent = "할 일 및 메모";
  }
}

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

  const headerBottom = document.querySelector('.header-bottom');
  if (headerBottom) {
    headerBottom.style.display = (currentScope === 'memo') ? 'none' : 'block';
  }

  const viewerBtn = document.getElementById('btn-mode-viewer');
  const editorBtn = document.getElementById('btn-mode-editor');
  const modeGroup = document.querySelector('.mode-group');

  if (modeGroup) {
    modeGroup.style.display = (currentScope === 'memo') ? 'none' : 'flex';
  }

  const searchBtn = document.getElementById('btn-search');
  if (searchBtn) {
    searchBtn.style.display = 'inline-block';
  }

  const moreBtn = document.getElementById('btn-more-menu');
  if (moreBtn) {
    moreBtn.style.display = 'inline-flex';
  }

  const weekendBtn = document.getElementById('btn-toggle-weekend');
  if (weekendBtn) {
    weekendBtn.innerHTML = window.showWeekend ? '주말 숨기기' : '주말 보이기';
    weekendBtn.style.display = (currentScope === 'memo') ? 'none' : 'inline-block';
  }

  const classBtn = document.getElementById('btn-toggle-class');
  if (classBtn) {
    classBtn.innerHTML = window.showClass ? '수업 숨기기' : '수업 보이기';
    classBtn.style.display = (currentScope === 'memo') ? 'none' : 'inline-block';
  }

  if (viewerBtn && editorBtn) {
    viewerBtn.className = currentMode === 'viewer' ? 'btn-mode active-viewer' : 'btn-mode';

    if (currentMode === 'viewer') {
      editorBtn.innerHTML = '작성';
      editorBtn.title = '단축키: Ctrl + ↓';
      editorBtn.className = 'btn-mode';
    } else {
      editorBtn.innerHTML = '저장';
      editorBtn.title = '단축키: Ctrl + Enter';
      editorBtn.className = 'btn-mode save-mode';
    }
  }

  const dropdown = document.getElementById('more-dropdown');
  if (dropdown) dropdown.classList.add('hidden');
}

window.saveCurrentViewData = async function(silent = false) {
  const editorBtn = document.getElementById('btn-mode-editor');
  
  if (editorBtn && !silent) {
    editorBtn.innerHTML = "저장중..";
    editorBtn.disabled = true;
  }

  if (currentScope === 'day' && window.saveDayDataFromEditor) await window.saveDayDataFromEditor();
  else if (currentScope === 'week' && window.saveWeekDataFromEditor) await window.saveWeekDataFromEditor();
  else if (currentScope === 'month' && window.saveMonthDataFromEditor) await window.saveMonthDataFromEditor();
  else if (currentScope === 'year' && window.saveYearDataFromEditor) await window.saveYearDataFromEditor();

  // 💡 [추가] 과거 일정을 저장했을 때 즉시 이월되도록 백그라운드 체크 실행
  if (window.autoForwardIncompleteEvents) await window.autoForwardIncompleteEvents();

  if (editorBtn && !silent) {
    editorBtn.innerHTML = '저장 완료';
    setTimeout(() => {
      if (currentMode === 'editor') {
        editorBtn.innerHTML = '저장';
        editorBtn.disabled = false;
      }
    }, 1500); 
  }
  
  window.hasUnsavedChanges = false; 
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
      else window.saveCurrentViewData(false);
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

  if (window.auth) {
    const loginBtn = document.querySelector('#login-screen button');
    let originalBtnHtml = '';
    
    if (loginBtn) {
        originalBtnHtml = loginBtn.innerHTML;
        loginBtn.innerHTML = '로그인 상태 확인 중...';
        loginBtn.disabled = true;
    }

    window.auth.onAuthStateChanged(async user => {
      if (user) {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('user-info').style.display = 'flex';
        if(user.photoURL) document.getElementById('user-photo').src = user.photoURL;
        
        await window.loadSettings();
        
        // 로그인 직후 미완료 자동 이월 로직 실행
        await window.autoForwardIncompleteEvents();

        window.render();
        
        setTimeout(() => {
          try {
            const hideHelp = localStorage.getItem('workCalendar_hideHelp_v4');
            if (hideHelp !== 'true' && typeof window.openHelpModal === 'function') {
              window.openHelpModal();
            }
          } catch(e) {}
        }, 500); 

      } else {
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('user-info').style.display = 'none';
        document.getElementById("main-view").innerHTML = ""; 
        
        if (loginBtn) {
            loginBtn.innerHTML = originalBtnHtml || 'Google 계정으로 로그인';
            loginBtn.disabled = false;
        }
      }
    });
  }
});

// ==========================================================================
// 🚀 미완료 자동 이월 로직 (과거 기록 보존 방식 추가)
// ==========================================================================
window.autoForwardIncompleteEvents = async function() {
    const todayStr = window.formatDate(new Date());
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 14); // 최근 14일치 스캔
    const pastDateStr = window.formatDate(pastDate);

    try {
        const eventsSnap = await window.getUserCol('events')
            .where(firebase.firestore.FieldPath.documentId(), '>=', pastDateStr)
            .where(firebase.firestore.FieldPath.documentId(), '<', todayStr)
            .get();
        
        let forwardedEvents = [];
        let batch = window.db.batch();

        eventsSnap.forEach(doc => {
            const data = doc.data();
            let list = data.eventList || (data.eventText ? window.parseRawEventTextToEventList(data.eventText) : []);
            let docChanged = false;

            list.forEach(ev => {
                const label = ev.labels ? ev.labels[0] : ev.label;
                if (window.isForwardLabel && window.isForwardLabel(label) && !ev.completed && !ev.isForwarded) {
                    ev.isForwarded = true; 
                    // 💡 [수정] 원본 기록은 이월되었음을 표시하고 유지
                    const originalContent = ev.content || '';
                    ev.content = "➡️[이월됨] " + originalContent;
                    docChanged = true;
                    forwardedEvents.push({ label: label, labels: ev.labels, content: originalContent, completed: false }); 
                }
            });

            if (docChanged) {
                batch.update(doc.ref, { eventList: list, updatedAt: Date.now() });
            }
        });

        if (forwardedEvents.length > 0) {
            const todayDoc = await window.getUserCol('events').doc(todayStr).get();
            const todayData = todayDoc.exists ? todayDoc.data() : {};
            let todayList = todayData.eventList || (todayData.eventText ? window.parseRawEventTextToEventList(todayData.eventText) : []);
            
            todayList = [...forwardedEvents, ...todayList];

            batch.set(window.getUserCol('events').doc(todayStr), {
                eventList: todayList,
                updatedAt: Date.now()
            }, { merge: true });
        }

        await batch.commit();
        if (forwardedEvents.length > 0 && window.render) window.render(); 
    } catch(e) {
        console.error("자동 이월 처리 중 에러:", e);
    }
};

// ==========================================================================
// 🚀 기간 다중 등록 달력 팝업
// ==========================================================================
window.openPeriodModal = function(startDateStr, labelName, textContent, callback) {
    const modalHtml = `
    <div id="period-modal" style="position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.5); z-index:10002; display:flex; justify-content:center; align-items:center;">
        <div style="background:#fff; padding:25px; border-radius:12px; width:360px; box-shadow:0 10px 25px rgba(0,0,0,0.2);">
            <h3 style="margin-top:0; color:#2563eb; border-bottom:2px solid #bfdbfe; padding-bottom:10px;">📅 [${labelName}] 기간 등록</h3>
            
            <div style="margin-bottom:15px;">
                <label style="display:block; font-weight:bold; margin-bottom:5px;">일정 내용</label>
                <input type="text" id="period-content" value="${textContent}" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:6px; font-size:1rem;" placeholder="예: 여름방학">
            </div>

            <div style="display:flex; gap:10px; margin-bottom:15px;">
                <div style="flex:1;">
                    <label style="display:block; font-weight:bold; margin-bottom:5px; font-size:0.9rem;">시작일</label>
                    <input type="date" id="period-start" value="${startDateStr}" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px; background:#f1f5f9;" readonly>
                </div>
                <div style="flex:1;">
                    <label style="display:block; font-weight:bold; margin-bottom:5px; font-size:0.9rem; color:#ef4444;">종료일 선택</label>
                    <input type="date" id="period-end" value="${startDateStr}" style="width:100%; padding:8px; border:1px solid #ef4444; border-radius:6px; outline:none;">
                </div>
            </div>

            <div style="margin-bottom:25px; background:#f8fafc; padding:10px; border-radius:6px; border:1px solid #e2e8f0;">
                <label style="display:flex; align-items:center; gap:6px; font-weight:bold; cursor:pointer;">
                    <input type="checkbox" id="period-exclude-weekend" checked style="width:16px; height:16px; accent-color:#2563eb;">
                    주말(토/일) 제외하고 계산하기
                </label>
                <p style="margin:5px 0 0 22px; font-size:0.8rem; color:#64748b;">체크 시 평일에만 (1/5), (2/5) 형식으로 일정이 등록됩니다.</p>
            </div>

            <div style="display:flex; justify-content:flex-end; gap:10px;">
                <button id="btn-period-cancel" style="padding:10px 16px; border:none; background:#f1f5f9; font-weight:bold; border-radius:6px; cursor:pointer;">취소</button>
                <button id="btn-period-register" style="padding:10px 16px; border:none; background:#2563eb; color:#fff; font-weight:bold; border-radius:6px; cursor:pointer;">등록</button>
            </div>
        </div>
    </div>`;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    document.getElementById('btn-period-cancel').onclick = function() {
        document.getElementById('period-modal').remove();
        if(callback) callback(false);
    };

    document.getElementById('btn-period-register').onclick = function() {
        window.executePeriodSave(labelName, callback);
    };
};

window.executePeriodSave = async function(labelName, callback) {
    const content = document.getElementById('period-content').value.trim();
    const startStr = document.getElementById('period-start').value;
    const endStr = document.getElementById('period-end').value;
    const excludeWeekend = document.getElementById('period-exclude-weekend').checked;

    if(!content) return alert("일정 내용을 입력해주세요.");
    const startD = new Date(startStr);
    const endD = new Date(endStr);
    if(startD > endD) return alert("종료일이 시작일보다 빠를 수 없습니다.");

    document.getElementById('period-modal').innerHTML = `<div style="background:#fff; padding:30px; border-radius:12px; font-weight:bold; color:#2563eb; text-align:center;">⏳ 클라우드에 일괄 등록 중...</div>`;

    let datesToSave = [];
    let curD = new Date(startD);
    while (curD <= endD) {
        const day = curD.getDay();
        if (excludeWeekend && (day === 0 || day === 6)) {
            // 주말 제외 패스
        } else {
            datesToSave.push(window.formatDate(curD));
        }
        curD.setDate(curD.getDate() + 1);
    }

    const totalDays = datesToSave.length;
    let batch = window.db.batch();
    
    for(let i=0; i<totalDays; i++) {
        const dStr = datesToSave[i];
        const docRef = window.getUserCol('events').doc(dStr);
        const docSnap = await docRef.get();
        let list = docSnap.exists ? (docSnap.data().eventList || []) : [];
        
        list.push({ label: labelName, labels: [labelName], content: `${content} (${i+1}/${totalDays})`, completed: false });
        batch.set(docRef, { eventList: list, updatedAt: Date.now() }, { merge: true });
    }

    await batch.commit();
    document.getElementById('period-modal').remove();
    alert(`✅ 총 ${totalDays}일의 일정이 등록되었습니다.`);
    if (callback) callback(true);
};

// ==========================================================================
// 🚀 [신규] 일정 삭제 시 다중/기간 일정 자동 감지 및 삭제 옵션 제공 엔진
// ==========================================================================
window.handleEventDeletion = function(dateStr, eventObj, singleDeleteCallback) {
    const match = (eventObj.content || '').match(/(.*)\s+\((\d+)\/(\d+)\)$/);
    
    if (!match) {
        if (singleDeleteCallback) singleDeleteCallback();
        return;
    }

    const baseContent = match[1].trim();
    const currentIdx = match[2];
    const totalDays = match[3];

    const modalHtml = `
    <div id="delete-option-modal" style="position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.5); z-index:10005; display:flex; justify-content:center; align-items:center;">
        <div style="background:#fff; padding:25px; border-radius:12px; width:340px; box-shadow:0 10px 25px rgba(0,0,0,0.2);">
            <h3 style="margin-top:0; color:#ef4444; border-bottom:2px solid #fca5a5; padding-bottom:10px;">🗑️ 연결된 기간 일정 삭제</h3>
            <p style="font-size:0.95rem; color:#475569; margin-bottom:20px; line-height:1.5;">
                <strong>[${baseContent}]</strong> 일정은 총 ${totalDays}일 중 ${currentIdx}번째 일정입니다.<br>삭제 범위를 선택해 주세요.
            </p>
            <div style="display:flex; flex-direction:column; gap:10px;">
                <button id="btn-del-single" style="padding:12px; border:1px solid #cbd5e1; background:#f8fafc; font-weight:bold; border-radius:6px; cursor:pointer; text-align:left;">
                    🔹 <strong>이 일정만 삭제</strong><br><span style="font-size:0.8rem; color:#64748b; font-weight:normal;">선택한 오늘 하루만 지웁니다.</span>
                </button>
                <button id="btn-del-future" style="padding:12px; border:1px solid #fca5a5; background:#fef2f2; color:#b91c1c; font-weight:bold; border-radius:6px; cursor:pointer; text-align:left;">
                    🔸 <strong>이후 일정 모두 삭제 (추천)</strong><br><span style="font-size:0.8rem; color:#ef4444; font-weight:normal;">과거 기록은 보존하고 오늘 포함 이후만 지웁니다.</span>
                </button>
                <button id="btn-del-all" style="padding:12px; border:none; background:#ef4444; color:#fff; font-weight:bold; border-radius:6px; cursor:pointer; text-align:left;">
                    💥 <strong>전체 일정 삭제</strong><br><span style="font-size:0.8rem; color:#fecaca; font-weight:normal;">과거를 포함해 연결된 모든 일정을 지웁니다.</span>
                </button>
                <button onclick="document.getElementById('delete-option-modal').remove()" style="margin-top:10px; padding:10px; border:none; background:transparent; color:#64748b; font-weight:bold; cursor:pointer;">취소</button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    document.getElementById('btn-del-single').onclick = function() {
        document.getElementById('delete-option-modal').remove();
        if (singleDeleteCallback) singleDeleteCallback();
    };

    document.getElementById('btn-del-future').onclick = function() {
        window.executeComplexDeletion(dateStr, baseContent, totalDays, 'future');
    };

    document.getElementById('btn-del-all').onclick = function() {
        window.executeComplexDeletion(dateStr, baseContent, totalDays, 'all');
    };
};

window.executeComplexDeletion = async function(baseDateStr, baseContent, totalDays, deleteType) {
    document.getElementById('delete-option-modal').innerHTML = `<div style="background:#fff; padding:30px; border-radius:12px; font-weight:bold; color:#ef4444; text-align:center;">⏳ 클라우드에서 다중 삭제 중...</div>`;
    
    const baseDate = new Date(baseDateStr);
    const startDate = new Date(baseDate); startDate.setDate(startDate.getDate() - parseInt(totalDays) - 5);
    const endDate = new Date(baseDate); endDate.setDate(endDate.getDate() + parseInt(totalDays) + 5);

    let datesToScan = [];
    let curD = new Date(startDate);
    while (curD <= endDate) {
        datesToScan.push(window.formatDate(curD));
        curD.setDate(curD.getDate() + 1);
    }

    let batch = window.db.batch();
    
    for (let i = 0; i < datesToScan.length; i++) {
        const dStr = datesToScan[i];
        if (deleteType === 'future' && dStr < baseDateStr) continue;

        const docRef = window.getUserCol('events').doc(dStr);
        const docSnap = await docRef.get();
        if (docSnap.exists) {
            let list = docSnap.data().eventList || [];
            let originalLength = list.length;
            list = list.filter(e => {
                if (!e.content) return true;
                const match = e.content.match(/(.*)\s+\((\d+)\/(\d+)\)$/);
                if (match && match[1].trim() === baseContent) return false; 
                return true; 
            });
            
            if (list.length !== originalLength) {
                batch.set(docRef, { eventList: list, updatedAt: Date.now() }, { merge: true });
            }
        }
    }

    await batch.commit();
    document.getElementById('delete-option-modal').remove();
    alert('✅ 일괄 삭제가 완료되었습니다.');
    window.hasUnsavedChanges = false;
    window.render(); 
};

// ==========================================================================
// 🚀 [신규] 라벨 데이터 V4 읽기 및 인라인 뱃지 렌더링/토글 엔진
// ==========================================================================
window.LABEL_PALETTE = {
    red: { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' },
    orange: { bg: '#ffedd5', text: '#9a3412', border: '#fdba74' },
    yellow: { bg: '#fef9c3', text: '#854d0e', border: '#fde047' },
    green: { bg: '#dcfce7', text: '#166534', border: '#86efac' },
    blue: { bg: '#dbeafe', text: '#1e40af', border: '#93c5fd' },
    indigo: { bg: '#e0e7ff', text: '#3730a3', border: '#a5b4fc' },
    purple: { bg: '#f3e8ff', text: '#6b21a8', border: '#d8b4fe' },
    gray: { bg: '#f1f5f9', text: '#334155', border: '#cbd5e1' }
};

window.getEventLabels = function() {
    const saved = JSON.parse(localStorage.getItem('workCalendar_eventLabels_v4'));
    if (saved && saved.length > 0) return saved;
    return [
        { name: '일정', color: 'blue', isPeriod: false, isForward: false, isSkip: false },
        { name: '행사', color: 'red', isPeriod: false, isForward: false, isSkip: false },
        { name: '휴일', color: 'gray', isPeriod: false, isForward: false, isSkip: true }
    ];
};

window.getJournalLabels = function() {
    const saved = JSON.parse(localStorage.getItem('workCalendar_journalLabels_v4'));
    if (saved && saved.length > 0) return saved;
    return [{ name: '참고', color: 'purple' }];
};

window.getLabelStyle = function(labelName, type = 'event') {
    const labels = type === 'event' ? window.getEventLabels() : window.getJournalLabels();
    const target = labels.find(l => l.name === labelName);
    if (target && target.color && window.LABEL_PALETTE[target.color]) return window.LABEL_PALETTE[target.color];
    return { bg: '#f8fafc', text: '#475569', border: '#cbd5e1' }; 
};

window.isForwardLabel = function(labelName) {
    const target = window.getEventLabels().find(l => l.name === labelName);
    return target ? !!target.isForward : false;
};

window.isPeriodLabel = function(labelName) {
    const target = window.getEventLabels().find(l => l.name === labelName);
    return target ? !!target.isPeriod : false;
};

window.isSkipLabel = function(labelName) {
    const target = window.getEventLabels().find(l => l.name === labelName);
    return target ? !!target.isSkip : false;
};

// 💡 [수정] 작은 인라인 라벨 버튼과 텍스트가 자연스럽게 이어지도록 그리기
window.generateEventBadgesHTML = function(events, dateStr) {
    if (!events || events.length === 0) return '';
    let html = '<div style="display:flex; flex-direction:column; gap:4px;">';
    
    events.forEach((ev, idx) => {
        const eLabels = ev.labels && ev.labels.length > 0 ? ev.labels : (ev.label ? [ev.label] : ['기타']);
        const mainLabel = eLabels[0];
        const isCompleted = !!ev.completed;
        const canComplete = window.isForwardLabel(mainLabel);
        
        let textStyle = isCompleted ? 'text-decoration:line-through; color:#94a3b8;' : 'color:#1e293b;';
        
        let chipsHtml = '';
        eLabels.forEach(lName => {
            const style = window.getLabelStyle(lName, 'event');
            const chipBg = isCompleted ? '#f1f5f9' : style.bg;
            const chipText = isCompleted ? '#94a3b8' : style.text;
            const chipBorder = isCompleted ? '#cbd5e1' : style.border;
            
            const clickAction = canComplete ? `onclick="window.toggleEventCompletion('${dateStr}', ${idx})" style="cursor:pointer;" title="클릭하여 완료 상태 변경"` : `style="cursor:default;"`;
            
            chipsHtml += `<span ${clickAction} class="event-badge-chip" style="display:inline-block; padding:2px 6px; border-radius:4px; font-size:0.8rem; font-weight:bold; background:${chipBg}; color:${chipText}; border:1px solid ${chipBorder}; margin-right:4px; box-shadow:0 1px 2px rgba(0,0,0,0.05); transition:0.2s;">${lName}</span>`;
        });

        html += `
        <div class="event-badge-row" style="margin-bottom: 2px; line-height:1.4;">
            ${chipsHtml}
            <span style="font-size:0.95rem; word-break:break-all; vertical-align:middle; ${textStyle}">${ev.content}</span>
        </div>
        `;
    });
    html += '</div>';
    return html;
};

// 💡 뷰어 모드 원클릭 완료(토글) 기능
window.toggleEventCompletion = async function(dateStr, idx) {
    if (window.currentMode === 'editor' && window.hasUnsavedChanges) {
         await window.saveCurrentViewData(true);
    }
    try {
        const docRef = window.getUserCol('events').doc(dateStr);
        const docSnap = await docRef.get();
        if (docSnap.exists) {
            let list = docSnap.data().eventList || [];
            if (list[idx]) {
                list[idx].completed = !list[idx].completed;
                await docRef.update({ eventList: list, updatedAt: Date.now() });
                if (window.render) window.render(); 
            }
        }
    } catch (e) {
        console.error("완료 상태 토글 에러", e);
        alert("상태 변경에 실패했습니다.");
    }
};

// ==========================================================================
// 🚀 [자동화] 모든 화면(월, 년 등)에서 [라벨명] 텍스트를 찾아 버튼형 뱃지로 자동 치환
// ==========================================================================
if (!window._originalRenderV4) {
    window._originalRenderV4 = window.render;
    window.render = function() {
        window._originalRenderV4(); 
        
        setTimeout(() => {
            const elements = document.querySelectorAll('td, .month-event, .year-event, .cal-event');
            elements.forEach(el => {
                if (el.querySelector('.event-badge-chip') || el.querySelector('.badge-tag')) return;
                
                let html = el.innerHTML;
                const regex = /\[([^\]]+)\]/g; 
                
                if (regex.test(html)) {
                    const newHtml = html.replace(regex, (match, labelName) => {
                        const style = window.getLabelStyle(labelName, 'event');
                        return `<span class="event-badge-chip" style="display:inline-block; padding:2px 6px; border-radius:4px; font-size:0.8rem; font-weight:bold; background:${style.bg}; color:${style.text}; border:1px solid ${style.border}; margin-right:4px; margin-bottom:2px; box-shadow:0 1px 2px rgba(0,0,0,0.05); cursor:default;">${labelName}</span>`;
                    });
                    el.innerHTML = newHtml;
                }
            });
        }, 50); 
    };
}
