// js/app.js
import { store, subscribe } from './core/store.js'; // 👈 subscribe 추가됨
import { formatDate, parseLocalDate, getEventLabels } from './core/utils.js';
import { getUserCol, signInWithGoogle, signOut } from './firebase.js';

import './components/Modal.js';
import './core/events.js'; 

// 👉 기능 모듈 임포트
import { SearchModule } from './modules/search.js';
import { LabelManager } from './modules/labels.js';
import { TimetableModule } from './modules/timetable.js';
import { BackupManager } from './modules/backup.js';
import { openHelpModal } from './modules/help.js';
import { openGoogleSyncModal } from './modules/sync.js';

// 👉 뷰 컴포넌트 인스턴스 직접 임포트
import { weekViewInstance } from './viewWeek.js';
import { dayViewInstance } from './viewDay.js';
import { monthViewInstance } from './viewMonth.js';
import { yearViewInstance } from './viewYear.js';
import { memoViewInstance } from './viewMemo.js';

window.weekViewInstance = weekViewInstance;
window.dayViewInstance = dayViewInstance;
window.monthViewInstance = monthViewInstance;
window.yearViewInstance = yearViewInstance;
window.memoViewInstance = memoViewInstance;

// ==========================================================================
// 🚀 앱 상태 관리 및 초기화 설정 (반응형 적용됨 🪄)
// ==========================================================================

export const toggleWeekend = () => {
    if (store.mode === 'editor' && store.hasUnsavedChanges) saveCurrentViewData(true);
    store.showWeekend = !store.showWeekend; // 알아서 저장되고 화면이 바뀝니다!
};

export const toggleClass = () => {
    if (store.mode === 'editor' && store.hasUnsavedChanges) saveCurrentViewData(true);
    store.showClass = !store.showClass;
};

export const setScope = (scope) => {
    if (store.mode === 'editor' && store.hasUnsavedChanges) saveCurrentViewData(true);
    store.scope = scope;
    setTimeout(scrollToTodayIfExist, 0); // 화면 갱신 직후 포커스 이동
};

export const setMode = (mode) => {
    if (store.mode === 'editor' && mode === 'viewer' && store.hasUnsavedChanges) {
        saveCurrentViewData(true);
    }
    if (mode === 'viewer') store.hasUnsavedChanges = false;
    store.mode = mode;
};

export const handleEditSaveClick = () => {
    if (store.mode === 'viewer') {
        setMode('editor');
    } else {
        saveCurrentViewData(false);
    }
};

export const moveDate = (dir) => {
    if (store.mode === 'editor' && store.hasUnsavedChanges) saveCurrentViewData(true);

    const nextDate = new Date(store.currentDate); // 💡 Proxy 감지를 위해 새로운 Date 객체 생성!
    if (store.scope === 'day') {
        nextDate.setDate(nextDate.getDate() + dir);
    } else if (store.scope === 'week') {
        nextDate.setDate(nextDate.getDate() + (dir * 7));
    } else if (store.scope === 'month') {
        const currentDay = nextDate.getDate();
        nextDate.setMonth(nextDate.getMonth() + dir);
        if (nextDate.getDate() < currentDay) {
            nextDate.setDate(0); 
        }
    } else if (store.scope === 'year') {
        nextDate.setFullYear(nextDate.getFullYear() + dir);
    }
    store.currentDate = nextDate; // 값 덮어쓰기 -> 화면 자동 갱신!
};

export const goToToday = () => {
    if (store.mode === 'editor' && store.hasUnsavedChanges) saveCurrentViewData(true);
    store.currentDate = new Date();
    setTimeout(scrollToTodayIfExist, 0);
};

export const scrollToTodayIfExist = () => {
    let attempts = 0; 
    const todayStr = formatDate(new Date());

    const tryScroll = () => {
        attempts++;
        const selector = `
            .week-today-cell, .month-today-cell, .year-today-card, 
            tr[data-week-date="${todayStr}"], 
            tr[data-month-date="${todayStr}"], 
            tr[data-year-date="${todayStr}"]
        `;
        const todayEl = document.querySelector(selector);

        if (todayEl) {
            todayEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            const highlightTargets = todayEl.tagName === 'TR' ? todayEl.querySelectorAll('td') : [todayEl];

            highlightTargets.forEach(el => {
                const originalBg = el.style.backgroundColor;
                el.style.transition = 'background-color 0.5s';
                el.style.backgroundColor = '#fef08a'; 
                setTimeout(() => {
                    el.style.backgroundColor = originalBg; 
                    setTimeout(() => { el.style.transition = ''; }, 500);
                }, 800);
            });
        } else if (attempts < 15) {
            setTimeout(tryScroll, 200);
        }
    };
    tryScroll();
};

// ==========================================================================
// ⚙️ 환경 설정 로드
// ==========================================================================

export const loadSettings = async () => { 
    try { 
        const doc = await getUserCol('settings').doc('preferences').get(); 
        if (doc.exists) { 
            const data = doc.data();
            store.dDayList = data.dDayList || [];
            store.selectedDDayId = data.selectedDDayId || null;
            updateDdayUI();
        } else {
            store.dDayList = [];
            store.selectedDDayId = null;
        }

        const ttDoc = await getUserCol('settings').doc('timetable_v5').get();
        if (ttDoc.exists) {
            const ttData = ttDoc.data();
            store.semesterConfig = ttData.semesterConfig || {};
            store.timetableTemplates = ttData.templates || {};
            store.periodNames = ttData.currentNames || ["1", "2", "3", "4", "5", "6"];
        } else {
            if (doc.exists && doc.data().periodNames) store.periodNames = doc.data().periodNames;
        }

        const labelDoc = await getUserCol('settings').doc('labels').get(); 
        if (labelDoc.exists) { 
            const data = labelDoc.data();
            if (data.eventLabels && data.eventLabels.length > 0) {
                localStorage.setItem('workCalendar_eventLabels_v4', JSON.stringify(data.eventLabels));
            }
            if (data.journalLabels && data.journalLabels.length > 0) {
                localStorage.setItem('workCalendar_journalLabels_v4', JSON.stringify(data.journalLabels));
            }
            if (data.memoLabels && data.memoLabels.length > 0) {
                localStorage.setItem('workCalendar_memoLabels', JSON.stringify(data.memoLabels));
            }
        }

        getEventLabels();
        window.getJournalLabels();

    } catch (error) {
        console.warn("설정 로드 에러:", error);
    }
};

// ==========================================================================
// 🖥️ 메인 렌더링 엔진
// ==========================================================================
export const render = () => {
  const container = document.getElementById("main-view");
  if (!container) return; 

  container.innerHTML = "";
  updateTitle();
  updateButtonUI();

  try {
      if (store.scope === 'week') { 
          weekViewInstance.container = container;
          store.mode === 'editor' ? weekViewInstance.renderEditor() : weekViewInstance.renderViewer(); 
      }
      else if (store.scope === 'month') { 
          monthViewInstance.container = container;
          store.mode === 'editor' ? monthViewInstance.renderEditor() : monthViewInstance.renderViewer(); 
      }
      else if (store.scope === 'year') { 
          yearViewInstance.container = container;
          store.mode === 'editor' ? yearViewInstance.renderEditor() : yearViewInstance.renderViewer(); 
      }
      else if (store.scope === 'day') { 
          dayViewInstance.container = container;
          store.mode === 'editor' ? dayViewInstance.renderEditor() : dayViewInstance.renderViewer(); 
      }
      else if (store.scope === 'memo') { 
          memoViewInstance.container = container;
          memoViewInstance.renderViewer(); 
      }
  } catch (error) {
      console.error("화면 렌더링 중 오류 발생:", error);
      container.innerHTML = `<div style="text-align:center; padding: 50px; color:#ef4444; font-weight:bold;">데이터를 불러오는 중 오류가 발생했습니다.<br>잠시 후 다시 시도하거나 F5를 눌러주세요.</div>`;
  }
};

export const updateTitle = () => {
  const titleEl = document.getElementById("date-range-text");
  if (!titleEl) return;

  const y = store.currentDate.getFullYear();
  const m = store.currentDate.getMonth() + 1;
  const d = store.currentDate.getDate();
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const dayName = days[store.currentDate.getDay()];

  if (store.scope === 'day') { 
    titleEl.textContent = `${y}년 ${m}월 ${d}일 (${dayName})`;
  } else if (store.scope === 'week') {
    const temp = new Date(store.currentDate);
    const day = temp.getDay();
    let start, end;

    if (store.showWeekend) {
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
  } else if (store.scope === 'month') { 
    titleEl.textContent = `${y}년 ${m}월`;
  } else if (store.scope === 'year') { 
    titleEl.textContent = `${y}학년도`;
  } else if (store.scope === 'memo') { 
    titleEl.textContent = "";
  }
};

export const toggleMoreMenu = () => {
  const dropdown = document.getElementById('more-dropdown');
  if (dropdown) dropdown.classList.toggle('hidden');
};

export const updateButtonUI = () => {
  const scopeBtns = document.querySelectorAll('.btn-scope');
  scopeBtns.forEach(btn => {
    btn.classList.remove('active');
    if (btn.dataset.scope === store.scope) {
      btn.classList.add('active');
    }
  });

  const viewerBtn = document.getElementById('btn-mode-viewer');
  const editorBtn = document.getElementById('btn-mode-editor');
  const modeGroup = document.querySelector('.mode-group');

  if (modeGroup) {
    modeGroup.style.display = (store.scope === 'memo') ? 'none' : 'flex';
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
    weekendBtn.innerHTML = store.showWeekend ? '주말 숨기기' : '주말 보이기';
    weekendBtn.style.display = (store.scope === 'memo') ? 'none' : 'inline-block';
  }

  const classBtn = document.getElementById('btn-toggle-class');
  if (classBtn) {
    classBtn.innerHTML = store.showClass ? '수업 숨기기' : '수업 보이기';
    classBtn.style.display = (store.scope === 'memo') ? 'none' : 'inline-block';
  }

  const dateNavContainer = document.getElementById('date-range-text')?.parentElement;
  if (dateNavContainer) {
      const prevBtn = document.getElementById('btn-date-prev');
      const nextBtn = document.getElementById('btn-date-next');
      const todayBtn = document.getElementById('date-range-text');

      if (store.scope === 'memo') {
          if (prevBtn) prevBtn.style.display = 'none';
          if (nextBtn) nextBtn.style.display = 'none';
          if (todayBtn) todayBtn.style.display = 'none';
      } else {
          if (prevBtn) prevBtn.style.display = 'inline-block';
          if (nextBtn) nextBtn.style.display = 'inline-block';
          if (todayBtn) todayBtn.style.display = 'inline-block';
      }
  }

  if (viewerBtn && editorBtn) {
    viewerBtn.className = store.mode === 'viewer' ? 'btn-mode active-viewer' : 'btn-mode';

    if (store.mode === 'viewer') {
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
};

// ==========================================================================
// 💾 저장 엔진
// ==========================================================================
export const saveCurrentViewData = (silent = false) => {
  const editorBtn = document.getElementById('btn-mode-editor');

  if (editorBtn && !silent) {
    editorBtn.innerHTML = "저장중..";
    editorBtn.style.opacity = '0.7'; 
  }

  store.hasUnsavedChanges = false; 
  const scopeToSave = store.scope;

  try {
      if (scopeToSave === 'day') {
          if(typeof dayViewInstance.syncEventInputs === 'function') dayViewInstance.syncEventInputs();
          if(typeof dayViewInstance.syncJournalInputs === 'function') dayViewInstance.syncJournalInputs();
          if(typeof dayViewInstance.syncScheduleInputs === 'function') dayViewInstance.syncScheduleInputs();
      } else if (scopeToSave === 'week' && typeof weekViewInstance.syncScheduleInputs === 'function') {
          weekViewInstance.syncScheduleInputs();
          if(typeof weekViewInstance.syncAllCompactEventInputs === 'function') weekViewInstance.syncAllCompactEventInputs(); 
      } else if (scopeToSave === 'month' && typeof monthViewInstance.syncScheduleInputs === 'function') {
          monthViewInstance.syncScheduleInputs();
      } else if (scopeToSave === 'year' && typeof yearViewInstance.syncScheduleInputs === 'function') {
          yearViewInstance.syncScheduleInputs();
      }
  } catch(e) {
      console.warn("Input Sync Warning:", e);
  }

  let savePromise = null;
  try {
      if (scopeToSave === 'day') savePromise = dayViewInstance.save();
      else if (scopeToSave === 'week') savePromise = weekViewInstance.save();
      else if (scopeToSave === 'month') savePromise = monthViewInstance.save();
      else if (scopeToSave === 'year') savePromise = yearViewInstance.save();
  } catch (e) {
      console.error("데이터 저장 중 오류:", e);
  }

  setTimeout(async () => {
      try {
          if (savePromise) await savePromise;
          if (autoForwardIncompleteEvents) {
              await autoForwardIncompleteEvents();
          }

          if (editorBtn && !silent) {
            editorBtn.innerHTML = '저장 완료';
            editorBtn.style.opacity = '1';
            setTimeout(() => {
              if (store.mode === 'editor') editorBtn.innerHTML = '저장';
            }, 1500); 
          }
      } catch (e) {
          console.error("🚨 백그라운드 저장 에러:", e);
      }
  }, 0);
};

// ==========================================================================
// 🚀 앱 중앙 이벤트 리스너 바인딩 (HTML <-> JS 분리)
// ==========================================================================
const bindEvents = () => {
    // Auth
    document.getElementById('btn-login')?.addEventListener('click', signInWithGoogle);
    document.getElementById('btn-logout')?.addEventListener('click', () => {
        if (store.mode === 'editor' && store.hasUnsavedChanges && !confirm('저장하지 않은 데이터가 있습니다. 정말 로그아웃 하시겠습니까?')) return;
        signOut();
    });

    // Nav / View
    document.getElementById('btn-search')?.addEventListener('click', () => SearchModule.open());
    document.querySelectorAll('.btn-scope').forEach(btn => {
        btn.addEventListener('click', (e) => setScope(e.target.dataset.scope));
    });

    document.getElementById('btn-date-prev')?.addEventListener('click', () => moveDate(-1));
    document.getElementById('btn-date-next')?.addEventListener('click', () => moveDate(1));
    document.getElementById('date-range-text')?.addEventListener('click', goToToday);

    // Menu Toggles
    document.getElementById('btn-toggle-weekend')?.addEventListener('click', toggleWeekend);
    document.getElementById('btn-toggle-class')?.addEventListener('click', toggleClass);
    document.getElementById('btn-more-menu')?.addEventListener('click', toggleMoreMenu);

    // Dropdown Actions
    const closeDropdown = () => document.getElementById('more-dropdown')?.classList.add('hidden');
    document.getElementById('btn-menu-memo-label')?.addEventListener('click', () => { closeDropdown(); LabelManager.openMemoModal(); });
    document.getElementById('btn-menu-event-label')?.addEventListener('click', () => { closeDropdown(); LabelManager.openEventModal(); });
    document.getElementById('btn-menu-journal-label')?.addEventListener('click', () => { closeDropdown(); LabelManager.openJournalModal(); });
    document.getElementById('btn-menu-timetable')?.addEventListener('click', () => { closeDropdown(); TimetableModule.open(); });
    document.getElementById('btn-menu-sync')?.addEventListener('click', () => { closeDropdown(); openGoogleSyncModal(); });
    document.getElementById('btn-menu-backup')?.addEventListener('click', () => { closeDropdown(); BackupManager.openModal(); });
    document.getElementById('btn-menu-help')?.addEventListener('click', () => { closeDropdown(); openHelpModal(); });

    // D-Day Events
    document.getElementById('btn-dday-display')?.addEventListener('click', toggleDdayMenu);
    document.getElementById('btn-dday-settings')?.addEventListener('click', openDdaySettingsModal);

    // Image Viewer
    document.getElementById('image-viewer-modal')?.addEventListener('click', function() { this.classList.add('hidden'); });
};


// ==========================================================================
// 🚀 앱 초기화
// ==========================================================================
const initApp = () => {
  // 💡 마법 1: Proxy 스토어 구독! 데이터가 변하면 무조건 화면을 다시 그려라!
  subscribe(() => render());

  bindEvents(); // DOM 이벤트 연결

  const viewerBtn = document.getElementById('btn-mode-viewer');
  const editorBtn = document.getElementById('btn-mode-editor');

  if (viewerBtn) viewerBtn.addEventListener('click', () => setMode('viewer'));
  if (editorBtn) {
    editorBtn.addEventListener('click', () => {
      if (store.mode === 'viewer') setMode('editor');
      else saveCurrentViewData(false);
    });
  }

  const markUnsaved = () => { if (store.mode === 'editor') store.hasUnsavedChanges = true; };
  document.addEventListener('input', markUnsaved);
  document.addEventListener('change', markUnsaved);

  window.addEventListener('beforeunload', (e) => {
    if (store.mode === 'editor' && store.hasUnsavedChanges) {
      if (store.scope === 'day' && typeof dayViewInstance.syncEventInputs === 'function') {
          dayViewInstance.syncEventInputs();
          if(typeof dayViewInstance.syncJournalInputs === 'function') dayViewInstance.syncJournalInputs();
      }
      saveCurrentViewData(true);
      e.preventDefault(); 
      e.returnValue = ''; 
    }
  });

  document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === 'hidden' && store.mode === 'editor' && store.hasUnsavedChanges) {
          if (store.scope === 'day' && typeof dayViewInstance.syncEventInputs === 'function') {
              dayViewInstance.syncEventInputs();
          }
          saveCurrentViewData(true);
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
        if (user.photoURL && document.getElementById('user-photo')) {
            document.getElementById('user-photo').src = user.photoURL;
        }

        try {
            await loadSettings();
            if (autoForwardIncompleteEvents) await autoForwardIncompleteEvents();
        } catch (e) {
            console.error("초기 로딩 에러:", e);
        }

        render(true);

        setTimeout(() => {
          try {
            if (localStorage.getItem('workCalendar_hideHelp_v4') !== 'true' && typeof openHelpModal === 'function') {
              openHelpModal();
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
};

// ==========================================================================
// 🚀 완료 일정 Top-Down 추적 복사 & 사본 연쇄 자동 삭제 엔진
// ==========================================================================
export const autoForwardIncompleteEvents = async () => {
    const todayStr = formatDate(new Date()); 
    try {
        const pastDate = new Date(parseLocalDate(todayStr));
        pastDate.setDate(pastDate.getDate() - 365); 
        const eventsSnap = await getUserCol('events').where('__name__', '>=', formatDate(pastDate)).get();
        let eventsMap = {}; let allDates = [];
        eventsSnap.forEach(doc => { eventsMap[doc.id] = doc.data(); allDates.push(doc.id); });

        if (!allDates.includes(todayStr)) allDates.push(todayStr);
        allDates.sort();

        let activeChains = new Set(); let chainEventData = {}; let changedDocs = new Set();
        const minDateStr = allDates[0] || todayStr; const maxDateStr = allDates[allDates.length - 1];
        let curD = parseLocalDate(minDateStr); let endD = parseLocalDate(maxDateStr);

        while (curD <= endD) {
            const curStr = formatDate(curD);
            curD.setDate(curD.getDate() + 1);
            const nextStr = formatDate(curD);

            let curData = eventsMap[curStr] || { eventList: [] };
            let curList = curData.eventList || [];
            let newCurList = []; let curChanged = false;

            curList.forEach(ev => {
                let canComplete = false;
                const masterLabels = getEventLabels();
                if (ev.labelIds && ev.labelIds.length > 0) { 
                    canComplete = ev.labelIds.some(id => {
                        const m = masterLabels.find(l => l.id === id); return m && m.isForward;
                    });
                } else if (ev.labels || ev.label) {
                    const lName = (ev.labels && ev.labels.length > 0) ? ev.labels[0] : ev.label;
                    const lObj = masterLabels.find(x => x.name === lName);
                    canComplete = lObj ? lObj.isForward : false;
                }

                const cleanContent = (ev.content || '').replace(/➡️\s*\(미완료\)/g, '').replace(/➡️\s*\(다음 날로 이월됨\)/g, '').replace(/↪️\s*/g, '').trim();
                if (ev.content !== cleanContent) { ev.content = cleanContent; curChanged = true; }

                const isOrigin = !ev.originalDate || ev.originalDate === curStr;

                if (isOrigin) {
                    if (canComplete) {
                        if (!ev.forwardChainId) { ev.forwardChainId = 'chain_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5); curChanged = true; }
                        if (!ev.originalDate) { ev.originalDate = curStr; curChanged = true; }

                        if (ev.completed) { activeChains.delete(ev.forwardChainId); } 
                        else { activeChains.add(ev.forwardChainId); chainEventData[ev.forwardChainId] = { ...ev }; }
                        newCurList.push(ev);
                    } else {
                        if (ev.forwardChainId) { delete ev.forwardChainId; delete ev.originalDate; curChanged = true; }
                        newCurList.push(ev);
                    }
                } else {
                    if (activeChains.has(ev.forwardChainId)) {
                        if (ev.completed) { activeChains.delete(ev.forwardChainId); } 
                        else { chainEventData[ev.forwardChainId] = { ...ev }; }
                        newCurList.push(ev);
                    } else { curChanged = true; }
                }
            });

            let nextData = eventsMap[nextStr] || { eventList: [] };
            let nextList = nextData.eventList || [];
            let nextChanged = false;

            if (curStr < todayStr) {
                activeChains.forEach(chainId => {
                    const existsInNext = nextList.some(n => n.forwardChainId === chainId);
                    if (!existsInNext) {
                        const sourceEv = chainEventData[chainId];
                        nextList.unshift({
                            labelIds: [...(sourceEv.labelIds || [])], label: sourceEv.label || '', labels: [...(sourceEv.labels || [])],
                            content: sourceEv.content, completed: false, forwardChainId: chainId, originalDate: sourceEv.originalDate
                        });
                        nextChanged = true;
                    }
                });
            }

            if (curList.length !== newCurList.length) curChanged = true;

            if (curChanged) { eventsMap[curStr] = { ...curData, eventList: newCurList }; changedDocs.add(curStr); }
            if (nextChanged) { eventsMap[nextStr] = { ...nextData, eventList: nextList }; changedDocs.add(nextStr); }
        }

        let batch = window.db.batch(); let opCount = 0; let batchPromises = []; 

        changedDocs.forEach(dateStr => {
            const docRef = getUserCol('events').doc(dateStr);
            const evList = eventsMap[dateStr].eventList;
            batch.set(docRef, { eventList: evList, updatedAt: Date.now() }, { merge: true });
            opCount++;
            if (opCount >= 400){ batchPromises.push(batch.commit()); batch = window.db.batch(); opCount = 0; }
        });

        if (opCount > 0) batchPromises.push(batch.commit());
        await Promise.all(batchPromises);

    } catch(e) { console.error("자동 이월 처리 에러:", e); }
};

export const showForwardDeleteModal = (baseDateStr, labelName, textContent, chainId, onConfirm) => {
    const modalHtml = `
    <div id="forward-delete-modal" class="modal-overlay" style="display:flex; position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.5); z-index:10002; justify-content:center; align-items:center;">
        <div class="modal-content" style="width:380px; padding:25px; background:#fff; border-radius:12px; text-align:center;">
            <h3 style="color:#ef4444; margin-top:0;">🗑️ 이월 일정 삭제</h3>
            <p style="color:#475569; font-size:0.95rem; margin-bottom:20px; line-height:1.5;">이 일정은 <b>'완료(이월)'</b> 속성으로 과거에서 넘어온 일정입니다.<br>어떻게 삭제하시겠습니까?</p>
            <div style="display:flex; flex-direction:column; gap:10px;">
                <button id="btn-fwd-del-stop" style="padding:12px; background:#f1f5f9; border:1px solid #cbd5e1; border-radius:8px; cursor:pointer; font-weight:bold; color:#1e293b; text-align:left; line-height:1.4;">오늘부터 삭제 및 이월 중단<br><span style="font-size:0.8rem; font-weight:normal; color:#64748b;">(과거의 기록은 보존됩니다)</span></button>
                <button id="btn-fwd-del-all" style="padding:12px; background:#fee2e2; border:1px solid #fca5a5; border-radius:8px; cursor:pointer; font-weight:bold; color:#b91c1c; text-align:left; line-height:1.4;">원본 포함 모든 기록 삭제<br><span style="font-size:0.8rem; font-weight:normal; color:#ef4444;">(최초 작성된 원본까지 모두 지웁니다)</span></button>
                <button onclick="document.getElementById('forward-delete-modal').remove()" style="padding:10px; background:none; border:none; color:#64748b; font-weight:bold; cursor:pointer; margin-top:5px;">취소</button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    document.getElementById('btn-fwd-del-stop').onclick = async () => {
        if(store.hasUnsavedChanges) saveCurrentViewData(true);
        executeForwardDelete('stop', baseDateStr, chainId, onConfirm);
    };
    document.getElementById('btn-fwd-del-all').onclick = async () => {
        if(store.hasUnsavedChanges) saveCurrentViewData(true);
        executeForwardDelete('all', baseDateStr, chainId, onConfirm);
    };
};

export const executeForwardDelete = async (mode, baseDateStr, chainId, onConfirm) => {
    document.getElementById('forward-delete-modal').innerHTML = `<div style="background:#fff; padding:30px; border-radius:12px; font-weight:bold; color:#2563eb; text-align:center;">⏳ 삭제 및 동기화 중...</div>`;
    const matchEvent = (e) => e.forwardChainId === chainId;

    try {
        const snap = await getUserCol('events').get();
        let maxPastDateStr = '';
        if (mode === 'stop') {
            snap.forEach(doc => {
                if (doc.id < baseDateStr) {
                    const list = doc.data().eventList || [];
                    if (list.some(matchEvent)) { if (doc.id > maxPastDateStr) maxPastDateStr = doc.id; }
                }
            });
        }

        if (dayViewInstance && dayViewInstance.currentEvents) {
            if (mode === 'all' || dayViewInstance.dateStr >= baseDateStr) {
               dayViewInstance.currentEvents = dayViewInstance.currentEvents.filter(e => !matchEvent(e));
            } else if (mode === 'stop' && dayViewInstance.dateStr === maxPastDateStr) {
               dayViewInstance.currentEvents.forEach(e => { if (matchEvent(e)) e.completed = true; });
            }
        }
        
        let batch = window.db.batch(); let count = 0; let batchPromises = []; 

        snap.forEach(doc => {
            let list = doc.data().eventList || [];
            const origLen = list.length; let changed = false;

            if (mode === 'all') {
                list = list.filter(e => !matchEvent(e));
                if (list.length !== origLen) changed = true;
            } else if (mode === 'stop') {
                if (doc.id >= baseDateStr) {
                    list = list.filter(e => !matchEvent(e));
                    if (list.length !== origLen) changed = true;
                } else if (doc.id === maxPastDateStr) {
                    list.forEach(e => { if (matchEvent(e) && !e.completed) { e.completed = true; changed = true; } });
                }
            }

            if (changed) {
                batch.update(doc.ref, { eventList: list, updatedAt: Date.now() });
                count++;
                if (count >= 400) { batchPromises.push(batch.commit()); batch = window.db.batch(); count = 0; }
            }
        });
        if (count > 0) batchPromises.push(batch.commit());
        await Promise.all(batchPromises);
        if (autoForwardIncompleteEvents) await autoForwardIncompleteEvents();
    } catch(e) { console.error("이월 삭제 오류:", e); }

    if (document.getElementById('forward-delete-modal')) document.getElementById('forward-delete-modal').remove();
    if (onConfirm) onConfirm();
};

// ==========================================================================
// 🚀 D-Day 기능
// ==========================================================================
export const toggleDdayMenu = () => {
    if (!store.dDayList || store.dDayList.length === 0) {
        openDdaySettingsModal();
        return;
    }
    const dropdown = document.getElementById('dday-dropdown');
    const listContainer = document.getElementById('dday-list-container');

    if (dropdown.classList.contains('hidden')) {
        listContainer.innerHTML = '';
        store.dDayList.forEach(dday => {
            const isSelected = dday.id === store.selectedDDayId;
            const dDayText = calculateDday(dday.date);
            listContainer.innerHTML += `
                <button class="dropdown-item" onclick="window.selectDday('${dday.id}')" style="${isSelected ? 'background:#eff6ff; color:#2563eb;' : ''}">
                    <span style="font-weight:bold; margin-right:8px; display:inline-block; width:50px;">${dDayText}</span> 
                    ${dday.title}
                </button>
            `;
        });
        if (store.selectedDDayId) {
            listContainer.innerHTML += `<button class="dropdown-item" onclick="window.selectDday(null)" style="color:#64748b; text-align:center;">선택 해제</button>`;
        }
    }
    dropdown.classList.toggle('hidden');
};

export const updateDdayUI = () => {
    const btn = document.getElementById('btn-dday-display');
    if (!btn) return;
    if (!store.selectedDDayId || store.dDayList.length === 0) {
        btn.textContent = "D-Day 설정"; btn.style.color = "#64748b"; btn.style.backgroundColor = "#f1f5f9"; btn.style.borderColor = "#cbd5e1"; return;
    }
    const selected = store.dDayList.find(d => d.id === store.selectedDDayId);
    if (selected) {
        const dDayText = calculateDday(selected.date);
        btn.textContent = `${selected.title} ${dDayText}`; btn.style.color = "#ef4444"; btn.style.backgroundColor = "#fef2f2"; btn.style.borderColor = "#fca5a5";
    }
};

export const calculateDday = (targetDateStr) => {
    const today = new Date(); today.setHours(0, 0, 0, 0); 
    const targetDate = new Date(targetDateStr); targetDate.setHours(0, 0, 0, 0);
    const diffTime = targetDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    if (diffDays === 0) return 'D-Day';
    if (diffDays > 0) return `D-${diffDays}`;
    return `D+${Math.abs(diffDays)}`;
};

export const openDdaySettingsModal = () => {
    const dropdown = document.getElementById('dday-dropdown');
    if(dropdown) dropdown.classList.add('hidden');

    const existing = document.getElementById('dday-modal');
    if (existing) existing.remove();

    const modalHtml = `
    <div id="dday-modal" class="modal-overlay" style="z-index: 10006; display:flex;">
        <div class="modal-content" style="width: 400px; padding:0;">
            <div class="modal-header" style="padding: 15px 20px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center;">
                <h2 style="font-size:1.2rem; margin:0; color:#1e293b;">⚙️ D-Day 관리</h2>
                <button class="btn-close-modal" onclick="document.getElementById('dday-modal').remove()" style="font-size:1.5rem; background:none; border:none; cursor:pointer; color:#64748b;">&times;</button>
            </div>
            <div class="modal-body" style="padding: 20px;">
                <div style="display:flex; gap:8px; margin-bottom:20px;">
                    <input type="text" id="new-dday-title" placeholder="디데이 명칭" style="flex:1; padding:8px; border:1px solid #cbd5e1; border-radius:6px; font-size:0.9rem;">
                    <input type="date" id="new-dday-date" style="padding:8px; border:1px solid #cbd5e1; border-radius:6px;">
                    <button onclick="window.addDday()" style="padding:8px 12px; background:#2563eb; color:white; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">추가</button>
                </div>
                <hr style="border:0; border-top:1px dashed #e2e8f0; margin-bottom:15px;">
                <div id="dday-settings-list" style="display:flex; flex-direction:column; gap:10px; max-height:250px; overflow-y:auto;"></div>
            </div>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    renderDdaySettingsList();
};

export const renderDdaySettingsList = () => {
    const listEl = document.getElementById('dday-settings-list');
    if(!listEl) return;
    listEl.innerHTML = '';

    if (store.dDayList.length === 0) {
        listEl.innerHTML = '<div style="text-align:center; color:#94a3b8; font-size:0.9rem; margin-top:20px;">등록된 D-Day가 없습니다.</div>';
        return;
    }

    store.dDayList.forEach(dday => {
        listEl.innerHTML += `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px;">
            <div><span style="font-weight:bold; color:#1e293b; margin-right:8px;">${dday.title}</span><span style="font-size:0.85rem; color:#64748b;">${dday.date}</span></div>
            <button onclick="window.deleteDday('${dday.id}')" style="background:none; border:none; color:#ef4444; font-weight:bold; cursor:pointer; padding:4px 8px;">삭제</button>
        </div>`;
    });
};

// ==========================================================================
// 🚨 추가 전역 찌꺼기 연결 (모달 내 onclick 버튼용)
// ==========================================================================
window.selectDday = async (id) => {
    store.selectedDDayId = id; // Proxy 발동 (저장, 화면 갱신은 안되도록 설정되어 있음)
    document.getElementById('dday-dropdown').classList.add('hidden');
    updateDdayUI();
    if (window.auth && window.auth.currentUser) {
        await getUserCol('settings').doc('preferences').set({ selectedDDayId: id }, { merge: true });
    }
};

window.addDday = async () => {
    const titleInput = document.getElementById('new-dday-title');
    const dateInput = document.getElementById('new-dday-date');
    if (!titleInput.value.trim() || !dateInput.value) return alert("명칭과 날짜를 모두 입력해주세요.");

    const newDday = { id: 'dday_' + Date.now().toString(36), title: titleInput.value.trim(), date: dateInput.value };
    store.dDayList.push(newDday);
    if (store.dDayList.length === 1) store.selectedDDayId = newDday.id;

    if (window.auth && window.auth.currentUser) {
        try { await getUserCol('settings').doc('preferences').set({ dDayList: store.dDayList, selectedDDayId: store.selectedDDayId }, { merge: true }); } catch (e) { }
    }
    titleInput.value = ''; dateInput.value = '';
    renderDdaySettingsList(); updateDdayUI();
};

window.deleteDday = async (id) => {
    if (!confirm("해당 D-Day를 삭제하시겠습니까?")) return;
    store.dDayList = store.dDayList.filter(d => d.id !== id);
    if (store.selectedDDayId === id) store.selectedDDayId = null;
    
    if (window.auth && window.auth.currentUser) {
        try { await getUserCol('settings').doc('preferences').set({ dDayList: store.dDayList, selectedDDayId: store.selectedDDayId }, { merge: true }); } catch (e) { }
    }
    renderDdaySettingsList(); updateDdayUI();
};

window.showForwardDeleteModal = showForwardDeleteModal;
window.render = render;
window.goToToday = goToToday;

// 👇 방금 잘라낸 코드를 파일의 가장 마지막 위치에 붙여넣습니다!
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

// ==========================================================================
// 🌉 튕김 현상(Double Render)을 완벽히 해결한 최종 goToDay 함수
// ==========================================================================
window.goToDay = function(dateStr, event) {
    if (!dateStr) return;
    
    if (event) {
        event.stopPropagation();
        event.preventDefault();
        event.stopImmediatePropagation();
    }

    const parts = dateStr.split('-');
    if (parts.length === 3) {
        store.hasUnsavedChanges = false;

        if (document.activeElement && typeof document.activeElement.blur === 'function') {
            document.activeElement.blur();
        }

        // 💡 핵심 해결: 스코프를 먼저 'day'로 확정지은 뒤 날짜를 변경해야 
        // 중간에 주간 뷰가 억지로 다시 그려지는 튕김 현상이 사라집니다!
        store.scope = 'day';
        store.currentDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    }
};
