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

// 🚀 [옵션 1-B] 클릭 시 오늘 날짜로 즉시 스크롤 점프 (애니메이션 없음)
window.goToToday = async function() {
  if (currentMode === 'editor' && window.hasUnsavedChanges) await window.saveCurrentViewData(true);
  window.currentDate = new Date();
  window.render();
  
  setTimeout(() => {
      const todayEl = document.querySelector('.week-today-cell, .month-today-cell, .year-today-card');
      if (todayEl) {
          todayEl.scrollIntoView({ behavior: 'auto', block: 'center' });
      }
  }, 50);
};

// ==========================================================================
// ⚙️ 환경 설정 (수업 시수 및 명칭 동적 설정 + 라벨 동기화)
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

        const labelDoc = await window.getUserCol('settings').doc('labels').get();
        if (labelDoc.exists) {
            const data = labelDoc.data();
            if (data.eventLabels) localStorage.setItem('workCalendar_eventLabels_v4', JSON.stringify(data.eventLabels));
            if (data.journalLabels) localStorage.setItem('workCalendar_journalLabels_v4', JSON.stringify(data.journalLabels));
            if (data.memoLabels) localStorage.setItem('workCalendar_memoLabels', JSON.stringify(data.memoLabels));
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
// 🚀 [옵션 3-B] 미완료 자동 이월 로직 (붉은 강조 표시 적용)
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
                const hasBeenForwarded = ev.isForwarded || (ev.content && ev.content.includes('(미완료)'));
                
                if (window.isForwardLabel && window.isForwardLabel(label) && !ev.completed && !hasBeenForwarded) {
                    ev.isForwarded = true; 
                    // 과거 일정을 강제로 완료 처리하지 않고 미완료 텍스트를 부여하여 시각적으로 붉게 경고
                    const originalContent = ev.content.replace(/\s*\(미완료\)$/, '').replace(/\s*\(이월됨\)$/, '');
                    
                    // 과거 데이터에 흔적 남기기
                    ev.content = `${originalContent} (미완료)`; 
                    docChanged = true;
                    
                    // 오늘 날짜로 가져갈 새 객체 생성
                    forwardedEvents.push({ label: label, labels: ev.labels, content: `${originalContent} (이월됨)`, completed: false }); 
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
            // 주말 제외
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
// 🚀 [옵션 4-A] 기간 일정 3가지 삭제 옵션 모달 텍스트 변경
// ==========================================================================
window.showPeriodDeleteModal = function(baseDateStr, labelName, textContent, onConfirm) {
    const baseContent = textContent.replace(/\s*\(\d+\/\d+\)$/, '');
    
    const modalHtml = `
    <div id="period-delete-modal" class="modal-overlay" style="display:flex;">
        <div class="modal-content" style="width:360px; padding:25px; background:#fff; border-radius:12px; text-align:center;">
            <h3 style="color:#ef4444; margin-top:0;">🗑️ 기간 일정 삭제</h3>
            <p style="color:#475569; font-size:0.95rem; margin-bottom:20px; line-height:1.5;">
                이 일정은 <b>'기간'</b> 속성을 가진 일정입니다.<br>어떻게 삭제하시겠습니까?
            </p>
            <div style="display:flex; flex-direction:column; gap:10px;">
                <button id="btn-del-only-this" style="padding:12px; background:#f1f5f9; border:1px solid #cbd5e1; border-radius:8px; cursor:pointer; font-weight:bold; color:#1e293b;">그 날만 삭제</button>
                <button id="btn-del-all" style="padding:12px; background:#fee2e2; border:1px solid #fca5a5; border-radius:8px; cursor:pointer; font-weight:bold; color:#b91c1c;">모든 기간 일정 모두 삭제</button>
                <button id="btn-del-after-this" style="padding:12px; background:#ef4444; border:none; border-radius:8px; cursor:pointer; font-weight:bold; color:#fff;">이 날부터 끝날까지 삭제</button>
                <button onclick="document.getElementById('period-delete-modal').remove()" style="padding:10px; background:none; border:none; color:#64748b; font-weight:bold; cursor:pointer; margin-top:5px;">취소</button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    document.getElementById('btn-del-only-this').onclick = () => window.executePeriodDelete('only', baseDateStr, labelName, baseContent, onConfirm);
    document.getElementById('btn-del-after-this').onclick = () => window.executePeriodDelete('after', baseDateStr, labelName, baseContent, onConfirm);
    document.getElementById('btn-del-all').onclick = () => window.executePeriodDelete('all', baseDateStr, labelName, baseContent, onConfirm);
};

window.executePeriodDelete = async function(mode, baseDateStr, labelName, baseContent, onConfirm) {
    document.getElementById('period-delete-modal').innerHTML = `<div style="background:#fff; padding:30px; border-radius:12px; font-weight:bold; color:#2563eb; text-align:center;">⏳ 클라우드에서 삭제 중...</div>`;
    
    try {
        let query = window.getUserCol('events');
        if (mode === 'after') {
            query = query.where(firebase.firestore.FieldPath.documentId(), '>=', baseDateStr);
        }

        if (mode === 'only') {
            const docRef = window.getUserCol('events').doc(baseDateStr);
            const docSnap = await docRef.get();
            if (docSnap.exists) {
                let list = docSnap.data().eventList || [];
                list = list.filter(e => {
                    const l = e.labels?.[0] || e.label;
                    const c = e.content.replace(/\s*\(\d+\/\d+\)$/, '');
                    return !(l === labelName && c === baseContent);
                });
                await docRef.update({ eventList: list, updatedAt: Date.now() });
            }
        } else {
            const snap = await query.get();
            let batch = window.db.batch();
            let count = 0;
            snap.forEach(doc => {
                // all 모드이거나 기준일 이후인 경우
                if (mode === 'all' || doc.id >= baseDateStr) {
                    const data = doc.data();
                    let list = data.eventList || [];
                    const origLen = list.length;
                    list = list.filter(e => {
                        const l = e.labels?.[0] || e.label;
                        const c = e.content.replace(/\s*\(\d+\/\d+\)$/, '');
                        return !(l === labelName && c === baseContent);
                    });
                    if (origLen !== list.length) {
                        batch.update(doc.ref, { eventList: list, updatedAt: Date.now() });
                        count++;
                    }
                }
            });
            if (count > 0) await batch.commit();
        }
    } catch(e) {
        console.error("일괄 삭제 오류:", e);
    }
    
    document.getElementById('period-delete-modal').remove();
    if (onConfirm) onConfirm();
};
