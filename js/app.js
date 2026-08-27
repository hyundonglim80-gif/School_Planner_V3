// js/app.js

import { store } from './core/store.js';
import { formatDate, parseLocalDate, getEventLabels } from './core/utils.js';
import { getUserCol, getGroupCol, setNetworkOnline, setNetworkOffline } from './firebase.js'; 
import { doc, getDoc, getDocs, setDoc, query, where, documentId, writeBatch } from "firebase/firestore";

// ==========================================================================
// 🚀 1. 앱 상태 관리 및 초기화 설정
// ==========================================================================
const toggleState = (key) => {
    if (store.mode === 'editor' && store.hasUnsavedChanges) saveCurrentViewData(true);
    store[key] = !store[key];
    localStorage.setItem(`workCalendar_${key}`, store[key]);
    render();
};

export const toggleWeekend = () => toggleState('showWeekend');
export const toggleClass = () => toggleState('showClass');

export const updateDateFromScroll = () => {
    if (store.scope === 'memo' || store.scope === 'day') return;
    
    let dateElements = [];
    if (store.scope === 'year') {
        dateElements = Array.from(document.querySelectorAll('tr[data-year-date], .year-grid div[onclick^="window.goToDay"]'));
    } else if (store.scope === 'month') {
        dateElements = Array.from(document.querySelectorAll('tr[data-month-date], .cal-day > div[onclick^="window.goToDay"]'));
    } else if (store.scope === 'week') {
        dateElements = Array.from(document.querySelectorAll('tr[data-week-date], .clean-viewer-board tr > td:first-child span[onclick^="window.goToDay"]'));
    }
    
    if (dateElements.length > 0) {
        const headerOffset = document.querySelector('.app-header')?.offsetHeight || 150;
        let closestEl = null;
        let minDistance = Infinity;

        for (let el of dateElements) {
            const rect = el.getBoundingClientRect();
            if (rect.width === 0 && rect.height === 0) continue; 
            
            const distance = Math.abs(rect.top - headerOffset);
            if (distance < minDistance && rect.bottom > headerOffset) {
                minDistance = distance;
                closestEl = el;
            }
        }

        if (closestEl) {
            let targetDateStr = closestEl.getAttribute('data-year-date') || 
                                closestEl.getAttribute('data-month-date') || 
                                closestEl.getAttribute('data-week-date');
            
            if (!targetDateStr) {
                const onclickAttr = closestEl.getAttribute('onclick');
                if (onclickAttr) {
                    const match = onclickAttr.match(/goToDay\('([^']+)'\)/);
                    if (match) targetDateStr = match[1];
                }
            }
            
            if (targetDateStr) {
                const parts = targetDateStr.split('-');
                store.currentDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
            }
        }
    }
};

export const setScope = (scope) => {
    if (store.mode === 'editor' && store.hasUnsavedChanges) saveCurrentViewData(true);
    
    store.scope = scope;
    localStorage.setItem('workCalendar_scope', scope);
    
    // 🌟 각 탭별 이전 모드 기억 및 초기 기본값 설정
    const defaultModes = { year: 'viewer', month: 'viewer', week: 'editor', day: 'editor', memo: 'viewer' };
    store.mode = localStorage.getItem(`workCalendar_mode_${scope}`) || defaultModes[scope] || 'viewer';
    localStorage.setItem('workCalendar_mode', store.mode); // 기존 레거시 키 동기화

    const savedDate = localStorage.getItem(`workCalendar_date_${scope}`);
    if (savedDate) {
        store.currentDate = new Date(savedDate);
    } else {
        store.currentDate = new Date(); 
    }

    render(false); 
};

export const setMode = (mode) => {
    if (store.mode === 'editor' && mode === 'viewer' && store.hasUnsavedChanges) saveCurrentViewData(true);
    store.mode = mode;
    
    // 🌟 현재 탭에 해당하는 전용 키에 모드 저장
    localStorage.setItem(`workCalendar_mode_${store.scope}`, mode);
    localStorage.setItem('workCalendar_mode', mode); 
    
    if (mode === 'viewer') store.hasUnsavedChanges = false;
    render(false);
};

export const handleEditSaveClick = () => {
    store.mode === 'viewer' ? setMode('editor') : saveCurrentViewData(false);
};

export const moveDate = (dir) => {
    if (store.mode === 'editor' && store.hasUnsavedChanges) saveCurrentViewData(true);
    const d = store.currentDate;
    if (store.scope === 'day') d.setDate(d.getDate() + dir);
    else if (store.scope === 'week') d.setDate(d.getDate() + (dir * 7));
    else if (store.scope === 'month') {
        const currentDay = d.getDate();
        d.setMonth(d.getMonth() + dir);
        if (d.getDate() < currentDay) d.setDate(0); 
    } else if (store.scope === 'year') {
        d.setFullYear(d.getFullYear() + dir);
    }

    if (store.scope !== 'memo') {
        localStorage.setItem(`workCalendar_date_${store.scope}`, store.currentDate.toISOString());
    }

    render();
};

export const goToToday = () => {
    if (store.mode === 'editor' && store.hasUnsavedChanges && window.saveCurrentViewData) window.saveCurrentViewData(true);
    
    store.currentDate = new Date();
    const todayStr = formatDate(store.currentDate);
    const y = store.currentDate.getFullYear();
    const m = String(store.currentDate.getMonth() + 1).padStart(2, '0');

    if (store.scope !== 'memo') {
        localStorage.setItem(`workCalendar_date_${store.scope}`, store.currentDate.toISOString());
    }

    updateTitle();

    // 🌟 화면에 오늘 날짜(또는 해당 월)가 이미 로딩되어 있는지 유연하게 검사
    let targetExists = false;
    if (store.scope === 'week') {
        targetExists = !!document.querySelector(`tr[data-week-date="${todayStr}"]`);
    } else if (store.scope === 'month') {
        targetExists = !!document.querySelector(`tr[data-month-date="${todayStr}"]`) || !!document.querySelector(`.cal-day.month-today-cell`);
    } else if (store.scope === 'year') {
        if (store.mode === 'editor') {
            // 작성 모드에서는 정확한 날짜가 없어도 해당 '월'이 존재하면 통과시킴
            targetExists = !!document.querySelector(`tr[data-year-date^="${y}-${m}"]`);
        } else {
            targetExists = !!document.querySelector(`.year-today-card`);
        }
    }

    if (targetExists && store.scope !== 'day') {
        // 이미 렌더링되어 있다면 새로고침(render) 생략하고 즉시 스크롤만 실행!
        scrollToTodayIfExist();
    } else {
        // 화면에 없거나 다른 연/월에 있다면 새로고침(render) 진행
        render(true);
    }
};

export const goToDay = (dateStr) => {
    if (store.mode === 'editor' && store.hasUnsavedChanges && window.saveCurrentViewData) {
        window.saveCurrentViewData(true);
    }
    if (!dateStr) return;
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        store.currentDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        localStorage.setItem(`workCalendar_date_day`, store.currentDate.toISOString());
        if(window.setScope) window.setScope('day'); 
    }
};

export const scrollToTodayIfExist = () => {
    let attempts = 0; 
    const todayStr = formatDate(new Date());
    const y = new Date().getFullYear();
    const m = String(new Date().getMonth() + 1).padStart(2, '0');

    const tryScroll = () => {
        attempts++;
        
        let primaryTarget = null;
        let highlightTargets = [];

        if (store.scope === 'day') {
            return; 
        } else if (store.scope === 'week') {
            primaryTarget = document.querySelector(`tr[data-week-date="${todayStr}"]`);
            if (primaryTarget) {
                const allRows = document.querySelectorAll(`tr.week-row-${todayStr}`);
                allRows.forEach(row => {
                    highlightTargets.push(...Array.from(row.querySelectorAll('td')));
                });
            }
        } else if (store.scope === 'month') {
            if (store.mode === 'editor') {
                primaryTarget = document.querySelector(`tr[data-month-date="${todayStr}"]`);
                if (!primaryTarget) primaryTarget = document.querySelector(`tr[data-month-date^="${y}-${m}"]`);
                if (primaryTarget) {
                    const targetDateStr = primaryTarget.getAttribute('data-month-date') || todayStr;
                    const allRows = document.querySelectorAll(`tr.month-row-${targetDateStr}`);
                    allRows.forEach(row => {
                        highlightTargets.push(...Array.from(row.querySelectorAll('td')));
                    });
                }
            } else {
                primaryTarget = document.querySelector(`.cal-day.month-today-cell`);
                if (primaryTarget) highlightTargets = [primaryTarget];
            }
        } else if (store.scope === 'year') {
            if (store.mode === 'editor') {
                primaryTarget = document.querySelector(`tr[data-year-date="${todayStr}"]`);
                if (!primaryTarget) primaryTarget = document.querySelector(`tr[data-year-date^="${y}-${m}"]`); 
                if (primaryTarget) {
                    const targetDateStr = primaryTarget.getAttribute('data-year-date') || todayStr;
                    const allRows = document.querySelectorAll(`tr.year-row-${targetDateStr}`);
                    allRows.forEach(row => {
                        highlightTargets.push(...Array.from(row.querySelectorAll('td')));
                    });
                }
            } else {
                primaryTarget = document.querySelector(`.year-today-card`);
                if (primaryTarget) highlightTargets = [primaryTarget];
            }
        }

        if (primaryTarget) {
            const appHeader = document.querySelector('.app-header');
            const filterWrapper = document.getElementById(`${store.scope}-filter-wrapper`);
            
            const headerHeight = appHeader ? appHeader.offsetHeight : 0;
            const filterHeight = filterWrapper ? filterWrapper.offsetHeight : 0;
            
            setTimeout(() => {
                const rect = primaryTarget.getBoundingClientRect();
                const absoluteY = rect.top + window.pageYOffset;
                const targetY = absoluteY - headerHeight - filterHeight - 15; 
                
                const distance = Math.abs(window.pageYOffset - targetY);
                const scrollBehavior = distance > 1000 ? 'auto' : 'smooth';
                
                window.scrollTo({ top: targetY, behavior: scrollBehavior });

                if (highlightTargets.length > 0) {
                    highlightTargets.forEach(el => {
                        const originalBg = el.style.backgroundColor;
                        el.style.transition = 'background-color 0.4s ease';
                        el.style.backgroundColor = '#fef08a'; 
                        setTimeout(() => {
                            el.style.backgroundColor = originalBg; 
                            setTimeout(() => { el.style.transition = ''; }, 400);
                        }, 1200);
                    });
                }
            }, 50); 
            
        } else if (attempts < 15) {
            setTimeout(tryScroll, 200);
        }
    };
    tryScroll();
};

export const loadSettings = async () => { 
    try { 
        const docSnap = await getDoc(doc(getUserCol('settings'), 'preferences')); 
        if (docSnap.exists()) { 
            const data = docSnap.data();
            store.dDayList = data.dDayList || [];
            store.selectedDDayId = data.selectedDDayId || null;
            if (window.updateDdayUI) window.updateDdayUI();
        } else {
            store.dDayList = [];
            store.selectedDDayId = null;
        }

        const ttDoc = await getDoc(doc(getUserCol('settings'), 'timetable_v5'));
        if (ttDoc.exists()) {
            const ttData = ttDoc.data();
            store.semesterConfig = ttData.semesterConfig || {};
            store.timetableTemplates = ttData.templates || {};
            store.periodNames = ttData.currentNames || ["1", "2", "3", "4", "5", "6"];
        } else {
            if (docSnap.exists() && docSnap.data().periodNames) store.periodNames = docSnap.data().periodNames;
        }

        const labelDoc = await getDoc(doc(getUserCol('settings'), 'labels')); 
        if (labelDoc.exists()) { 
            const data = labelDoc.data();
            if (data.eventLabels?.length > 0) localStorage.setItem('workCalendar_eventLabels_v4', JSON.stringify(data.eventLabels));
            if (data.journalLabels?.length > 0) localStorage.setItem('workCalendar_journalLabels_v4', JSON.stringify(data.journalLabels));
            if (data.memoLabels?.length > 0) localStorage.setItem('workCalendar_memoLabels', JSON.stringify(data.memoLabels));
        }

        getEventLabels();
        window.getJournalLabels();

    } catch (error) { console.warn("설정 로드 에러(오프라인 시 정상):", error); }
};

// ==========================================================================
// 🖥️ 2. 메인 렌더링 엔진
// ==========================================================================
export const updateTitle = () => {
    const titleEl = document.getElementById("date-range-text");
    if (!titleEl) return;

    const d = store.currentDate;
    const y = d.getFullYear(), m = d.getMonth() + 1, dt = d.getDate();
    const dayName = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];

    const titles = {
        day: `${y}년 ${m}월 ${dt}일 (${dayName})`,
        month: `${y}년 ${m}월`,
        year: `${y}학년도`,
        memo: ''
    };

    if (store.scope === 'week') {
        const target = new Date(d);
        target.setDate(target.getDate() - target.getDay() + 4); 
        const y_week = target.getFullYear();
        const m_week = target.getMonth();
        const firstDayOfMonth = new Date(y_week, m_week, 1);
        const firstDayOfWeek = firstDayOfMonth.getDay(); 
        const weekNumber = Math.ceil((target.getDate() + firstDayOfWeek) / 7);
        
        titles.week = `${y_week}년 ${m_week + 1}월 ${weekNumber}주`;
    }

    titleEl.textContent = titles[store.scope];
};

export const render = (autoScrollToToday = false) => {
    const container = document.getElementById("main-view");
    if (!container) return; 

    container.innerHTML = "";
    updateTitle();
    updateButtonUI();

    try {
        const view = window[`${store.scope}ViewInstance`];
        if (view) {
            view.container = container;
            (store.mode === 'editor' && typeof view.renderEditor === 'function') ? view.renderEditor() : view.renderViewer();
        }
        if (autoScrollToToday) scrollToTodayIfExist();
    } catch (error) {
        console.error("화면 렌더링 중 오류 발생:", error);
        container.innerHTML = `<div style="text-align:center; padding: 50px; color:#ef4444; font-weight:bold;">데이터를 불러오는 중 오류가 발생했습니다.<br>잠시 후 다시 시도 시 F5를 눌러주세요.</div>`;
    }
};

export const updateButtonUI = () => {

	const unifiedFilter = document.getElementById('unified-filter-container');
	if (unifiedFilter) {
		unifiedFilter.style.display = (store.scope === 'memo') ? 'none' : 'flex';
	}

    document.querySelectorAll('.btn-scope').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-scope') === store.scope);
    });

    const dateRangeText = document.getElementById('date-range-text');
    if (dateRangeText && dateRangeText.closest('.header-row')) {
        dateRangeText.closest('.header-row').style.display = (store.scope === 'memo') ? 'none' : 'flex';
    }

    const weekendBtn = document.getElementById('btn-toggle-weekend');
    if (weekendBtn) weekendBtn.innerHTML = store.showWeekend ? '주말 숨기기' : '주말 보이기';

    const classBtn = document.getElementById('btn-toggle-class');
    if (classBtn) classBtn.innerHTML = store.showClass ? '수업 숨기기' : '수업 보이기';

    const viewerBtn = document.getElementById('btn-mode-viewer');
    const editorBtn = document.getElementById('btn-mode-editor');
    
    if (viewerBtn && editorBtn) {
        viewerBtn.className = store.mode === 'viewer' ? 'btn-mode active-viewer' : 'btn-mode';
        if (store.mode === 'viewer') {
            editorBtn.innerHTML = '작성'; editorBtn.title = '단축키: Ctrl + ↓'; editorBtn.className = 'btn-mode';
        } else {
            editorBtn.innerHTML = '저장'; editorBtn.title = '단축키: Ctrl + Enter'; editorBtn.className = 'btn-mode save-mode';
        }
    }

    const searchBtn = document.getElementById('btn-search');
    if (searchBtn) searchBtn.style.display = 'inline-block';

    const moreBtn = document.getElementById('btn-more-menu');
    if (moreBtn) moreBtn.style.display = 'inline-flex';

    const swipeBtn = document.getElementById('menu-swipe-mode');
    if (swipeBtn) {
        const mode = localStorage.getItem('workCalendar_swipeMode') || 'date';
        swipeBtn.innerHTML = mode === 'date' ? '↔️ 스와이프: 날짜 이동' : '↔️ 스와이프: 화면/탭 이동';
    }

    toggleMoreMenu(true); 
};

export const toggleMoreMenu = (forceClose = false) => {
    const dropdown = document.getElementById('more-dropdown');
    if (dropdown) forceClose ? dropdown.classList.add('hidden') : dropdown.classList.toggle('hidden');
};

export const saveCurrentViewData = (silent = false) => {
    const editorBtn = document.getElementById('btn-mode-editor');

    if (editorBtn && !silent) {
        editorBtn.innerHTML = "저장중..";
        editorBtn.style.opacity = '0.7'; 
    }

    store.hasUnsavedChanges = false; 
    
    const view = window[`${store.scope}ViewInstance`];
    
    try {
        if (view && typeof view.save === 'function') {
            view.save(); 
        }
        
        if (window.autoForwardIncompleteEvents) {
            window.autoForwardIncompleteEvents();
        }
    } catch(e) {
        console.error("Save execution error:", e);
    }

    if (editorBtn && !silent) {
        editorBtn.innerHTML = '저장 완료';
        editorBtn.style.opacity = '1';
        setTimeout(() => { if (store.mode === 'editor') editorBtn.innerHTML = '저장'; }, 1500); 
    }
};

// ==========================================================================
// ⚙️ 3. 앱 초기화 및 전역 이벤트
// ==========================================================================
let hasAttachedAppEvents = false;

const initApp = () => {
    if (hasAttachedAppEvents) return;
    hasAttachedAppEvents = true;

    document.getElementById('btn-mode-viewer')?.addEventListener('click', () => setMode('viewer'));
    document.getElementById('btn-mode-editor')?.addEventListener('click', () => store.mode === 'viewer' ? setMode('editor') : saveCurrentViewData(false));
    document.getElementById('btn-toggle-weekend')?.addEventListener('click', toggleWeekend);
    document.getElementById('btn-toggle-class')?.addEventListener('click', toggleClass);
    document.getElementById('btn-search')?.addEventListener('click', () => window.openSearchModal?.());
    document.getElementById('btn-prev-date')?.addEventListener('click', () => moveDate(-1));
    document.getElementById('btn-next-date')?.addEventListener('click', () => moveDate(1));
    document.getElementById('date-range-text')?.addEventListener('click', goToToday);

    document.getElementById('network-toggle-btn')?.addEventListener('click', () => toggleNetworkMode());
    document.getElementById('manual-sync-btn')?.addEventListener('click', () => executeManualSync());

    document.querySelectorAll('.btn-scope').forEach(btn => {
        btn.addEventListener('click', (e) => {
            setScope(e.target.getAttribute('data-scope'));
        });
    });

    let scrollDebounce = null;
    document.addEventListener('scroll', () => {
        if (store.scope === 'memo' || store.scope === 'day') return;
        // 🌟 핵심 방어 코드: 팝업창이 열려있을 때는 배경 스크롤로 인한 날짜 변경 완벽 차단!
        if (document.getElementById('day-modal-body')) return; 
        
        clearTimeout(scrollDebounce);
        scrollDebounce = setTimeout(() => {
            const prevTime = store.currentDate.getTime();
            updateDateFromScroll();
            if (store.currentDate.getTime() !== prevTime) {
                updateTitle();
                if (store.scope && store.scope !== 'memo') {
                    localStorage.setItem(`workCalendar_date_${store.scope}`, store.currentDate.toISOString());
                }
            }
        }, 200);
    }, { passive: true, capture: true });

    let autoSaveTimer = null;
    const markUnsaved = () => { 
        const isDayModalOpen = !!document.getElementById('day-modal-body');
        
        if (store.mode === 'editor' || isDayModalOpen) {
            store.hasUnsavedChanges = true; 
            clearTimeout(autoSaveTimer); 
            
            autoSaveTimer = setTimeout(() => {
                if (store.hasUnsavedChanges) {
                    if (isDayModalOpen && window.dayViewInstance) {
                        try {
                            // 🌟 팝업창 내부 데이터는 뒷 배경 렌더링(새로고침) 없이 조용히 DB에만 저장
                            window.dayViewInstance.save().then(() => {
                                store.hasUnsavedChanges = false;
                            }).catch(e => console.warn("팝업 저장 경고:", e));
                        } catch(e) {
                            console.error("팝업 자동 저장 중 오류:", e);
                        }
                    } else {
                        saveCurrentViewData(false);
                    }
                }
            }, 800);
        }
    };
	
    document.addEventListener('input', markUnsaved);
    document.addEventListener('change', markUnsaved);

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault(); 
        window.deferredPrompt = e; 
        const installBtn = document.getElementById('btn-install-pwa');
        if (installBtn) installBtn.style.display = 'block';
    });

    window.addEventListener('beforeunload', () => {
        if (store.mode === 'editor' && store.hasUnsavedChanges) {
            saveCurrentViewData(true);
        }
    });

    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === 'hidden') {
            if (store.mode === 'editor' && store.hasUnsavedChanges) {
                saveCurrentViewData(true);
            }
        }
    });

    const appTitle = document.getElementById('app-title');
    window.addEventListener('offline', () => {
        if (appTitle) appTitle.innerHTML = 'SP3.6 <span style="font-size:0.8rem; color:#ef4444; background:#fee2e2; padding:3px 8px; border-radius:12px; vertical-align:middle; margin-left:8px;">⚡ 끊김</span>';
    });
    window.addEventListener('online', () => {
        if (appTitle) {
            appTitle.innerHTML = 'SP3.6 <span style="font-size:0.8rem; color:#10b981; background:#dcfce7; padding:3px 8px; border-radius:12px; vertical-align:middle; margin-left:8px;">🌐 복구됨</span>';
            setTimeout(() => { appTitle.innerHTML = 'SP3.6'; }, 3000);
        }
    });
    if (!navigator.onLine && appTitle) {
        appTitle.innerHTML = 'SP3.6 <span style="font-size:0.8rem; color:#ef4444; background:#fee2e2; padding:3px 8px; border-radius:12px; vertical-align:middle; margin-left:8px;">⚡ 끊김</span>';
    }

    if (window.auth) {
        const loginBtn = document.querySelector('#login-screen button');
        let originalBtnHtml = '';

        if (loginBtn) {
            originalBtnHtml = loginBtn.innerHTML;
            loginBtn.innerHTML = '로그인 상태 확인 중...'; loginBtn.disabled = true;
        }

        window.auth.onAuthStateChanged(async user => {
            if (user) {
                document.getElementById('login-screen').style.display = 'none';
                document.getElementById('user-info').style.display = 'flex';
                if (user.photoURL) document.getElementById('user-photo').src = user.photoURL;

                const savedOfflineMode = localStorage.getItem('workCalendar_offlineMode') === 'true';
                await toggleNetworkMode(savedOfflineMode ? 'offline' : 'online');

                const savedScope = localStorage.getItem('workCalendar_scope') || 'day';
                store.scope = savedScope;
                
                // 🌟 앱 최초 진입(새로고침) 시에도 각 탭의 모드 복원
                const defaultModes = { year: 'viewer', month: 'viewer', week: 'editor', day: 'editor', memo: 'viewer' };
                store.mode = localStorage.getItem(`workCalendar_mode_${savedScope}`) || defaultModes[savedScope] || 'viewer';
                localStorage.setItem('workCalendar_mode', store.mode);

                const savedDate = localStorage.getItem(`workCalendar_date_${savedScope}`);
                if (savedDate) {
                    store.currentDate = new Date(savedDate);
                } else {
                    store.currentDate = new Date();
                }

                try {
                    await loadSettings();
                    if (window.autoCheckAndRunMigration) await window.autoCheckAndRunMigration();
                    if (window.autoForwardIncompleteEvents) await window.autoForwardIncompleteEvents();
                } catch (e) { console.error("초기 로딩 에러:", e); }

                render(false);

                setTimeout(() => {
                    if (localStorage.getItem('workCalendar_hideHelp_v4') !== 'true' && typeof window.openHelpModal === 'function') window.openHelpModal();
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

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initApp);
else initApp();

// ==========================================================================
// 📡 4. 기능 및 UI 토글러 모음
// ==========================================================================
export const toggleNetworkMode = async (forceMode = null) => {
    const toggleBtn = document.getElementById('network-toggle-btn');
    const manualSyncBtn = document.getElementById('manual-sync-btn');
    
    let isOfflineMode;

    if (forceMode !== null) {
        isOfflineMode = forceMode === 'offline';
    } else {
        const currentState = localStorage.getItem('workCalendar_offlineMode') === 'true';
        isOfflineMode = !currentState;
    }

    localStorage.setItem('workCalendar_offlineMode', isOfflineMode);

    if (isOfflineMode) {
        if (toggleBtn) {
            toggleBtn.innerHTML = '✈️';
            toggleBtn.style.background = '#ef4444'; 
            toggleBtn.title = '현재 오프라인 모드 (클릭 시 온라인 전환)';
        }
        if (manualSyncBtn) manualSyncBtn.style.display = 'flex';
        await setNetworkOffline();
    } else {
        if (toggleBtn) {
            toggleBtn.innerHTML = '🌐';
            toggleBtn.style.background = '#10b981'; 
            toggleBtn.title = '현재 온라인 모드 (클릭 시 오프라인 전환)';
        }
        if (manualSyncBtn) manualSyncBtn.style.display = 'none';
        await setNetworkOnline();
    }
};

export const executeManualSync = async () => {
    if (!navigator.onLine) {
        alert("기기가 인터넷에 연결되어 있지 않습니다. 와이파이 연결을 확인해주세요.");
        return;
    }

    const btn = document.getElementById('manual-sync-btn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '⏳';
    btn.style.opacity = '0.7';
    btn.disabled = true;

    try {
        await setNetworkOnline();
        await new Promise(resolve => setTimeout(resolve, 2500)); 
        await loadSettings(); 
        
        render(false);
        await new Promise(resolve => setTimeout(resolve, 2000)); 

        alert("✅ 최신 데이터로 동기화가 완료되었습니다.");
    } catch(e) {
        console.error("수동 동기화 실패", e);
        alert("❌ 동기화 중 오류가 발생했습니다.");
    } finally {
        await setNetworkOffline();
        btn.innerHTML = originalText;
        btn.style.opacity = '1';
        btn.disabled = false;
    }
};

export const openNativeClock = () => {
    window.open('https://www.google.com/search?q=10%EB%B6%84+%ED%83%80%EC%9D%B4%EB%A8%B8', '_blank');
};

export const installPWA = async () => {
    const dropdown = document.getElementById('more-dropdown');
    if (dropdown) dropdown.classList.add('hidden');

    if (window.deferredPrompt) {
        window.deferredPrompt.prompt();
        const { outcome } = await window.deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            const installBtn = document.getElementById('btn-install-pwa');
            if (installBtn) installBtn.style.display = 'none'; 
        }
        window.deferredPrompt = null;
    } else {
        alert("이미 기기에 설치되어 있거나, 현재 브라우저에서 자동 설치 버튼을 지원하지 않습니다.\n\n[아이폰/아이패드(Safari)의 경우]\n하단의 '공유(내보내기)' 아이콘을 누르고 '홈 화면에 추가'를 선택하여 수동으로 설치해주세요.");
    }
};

export const toggleSwipeMode = () => {
    let mode = localStorage.getItem('workCalendar_swipeMode') || 'date';
    mode = mode === 'date' ? 'scope' : 'date';
    localStorage.setItem('workCalendar_swipeMode', mode);
    updateButtonUI();
    alert(`스와이프 동작이 '${mode === 'date' ? '이전/다음 날짜 이동' : '메모/년간/월간/주간/하루 화면 이동'}'(으)로 변경되었습니다.`);
};


Object.assign(window, {
    toggleWeekend, toggleClass, setScope, setMode, handleEditSaveClick, 
    moveDate, goToToday, goToDay, scrollToTodayIfExist, updateDateFromScroll, loadSettings, render, 
    updateTitle, toggleMoreMenu, updateButtonUI, saveCurrentViewData, 
    toggleNetworkMode, executeManualSync, openNativeClock, installPWA,
    toggleSwipeMode 
});


// ============================================================================
// 🌟 [추가 기능 1 완벽 복구] 스코프(탭) 변경 시 기본 모드(보기/작성) 자동 설정 (단축키 완벽 지원)
// ============================================================================
(function() {
    // 탭이 변경될 때 올바른 모드를 강제로 적용해 주는 핵심 함수
    function applyDefaultMode(newScope) {
        let isModeChanged = false;
        
        // 🌟 클릭/단축키로 이동 시에도 기억된 모드 사용
        const defaultModes = { year: 'viewer', month: 'viewer', week: 'editor', day: 'editor', memo: 'viewer' };
        const targetMode = localStorage.getItem(`workCalendar_mode_${newScope}`) || defaultModes[newScope] || 'viewer';
        
        if (store.mode !== targetMode) {
            store.mode = targetMode;
            isModeChanged = true;
        }
        
        if (isModeChanged) {
            const modeToggle = document.getElementById('mode-toggle') || document.querySelector('input[type="checkbox"]');
            if (modeToggle && modeToggle.checked !== undefined) {
                modeToggle.checked = (store.mode === 'editor');
            }
        }
        return isModeChanged;
    }

    // 1. 마우스 클릭 낚아채기 (이전에 완벽하게 작동했던 방식 그대로 복구)
    document.addEventListener('click', (e) => {
        const target = e.target.closest('[onclick*="Scope("], [data-scope]');
        if (target) {
            let clickedScope = '';
            if (target.dataset.scope) clickedScope = target.dataset.scope;
            else if (target.getAttribute('onclick')) {
                const match = target.getAttribute('onclick').match(/Scope\(['"]([^'"]+)['"]\)/);
                if (match) clickedScope = match[1];
            }
            if (clickedScope) applyDefaultMode(clickedScope);
        }
    }, true); // 캡처링 단계에서 화면 변경 전에 미리 모드를 바꿈

    // 2. 단축키 낚아채기 (안전한 키보드 감지 방식 추가)
    let lastScope = store.scope;
    
    document.addEventListener('keydown', () => {
        // 단축키 로직이 먼저 실행될 수 있도록 아주 짧게(20ms) 기다린 후 확인
        setTimeout(() => {
            if (store.scope !== lastScope) {
                const modeChanged = applyDefaultMode(store.scope);
                lastScope = store.scope;
                
                // 단축키 작동 후 모드가 강제로 바뀌었다면 화면을 올바른 모드로 한번 더 새로고침
                if (modeChanged && typeof window.render === 'function') {
                    window.render(true);
                }
            }
        }, 20);
    }, true);

    // 마우스 클릭 시에도 이전 탭 상태(lastScope)를 동기화
    document.addEventListener('mouseup', () => {
        lastScope = store.scope;
    });
})();


// ============================================================================
// 🌟 [추가 기능 2] 날짜 클릭 시 화면 이동 대신 '하루-작성 팝업(모달)' 띄우기
// ============================================================================
window.goToDay = (dateStr) => {
    // 이미 '하루' 탭에 있는 경우: 팝업 대신 해당 날짜로 이동 후 '작성' 모드로 강제 전환
    if (store.scope === 'day') {
        store.currentDate = new Date(dateStr);
        store.mode = 'editor';
        const modeToggle = document.getElementById('mode-toggle') || document.querySelector('input[type="checkbox"]');
        if (modeToggle) modeToggle.checked = true;
        if (window.render) window.render(true);
        return;
    }

    // 년간/월간/주간 탭에서 클릭한 경우: 화면 이동 없이 해당 날짜의 하루-작성 팝업 띄우기
    store.currentDate = new Date(dateStr); 
    
    const modalId = 'day-editor-modal';
    const html = `
        <div id="day-modal-body" style="max-height: 75vh; overflow-y: auto; overflow-x: hidden; padding: 10px; background: #f8fafc; border-radius: 8px;">
            <div style="text-align:center; padding:40px; color:#64748b; font-weight:bold;">에디터를 불러오는 중...</div>
        </div>
        <div style="margin-top: 15px; display: flex; justify-content: flex-end; gap: 10px; padding-top: 15px; border-top: 1px solid #e2e8f0;">
            <button id="day-modal-cancel-btn" style="background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; padding: 10px 20px; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 1rem; transition: 0.2s;">취소</button>
            <button id="day-modal-save-btn" style="background: #2563eb; color: #fff; border: none; padding: 10px 20px; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 1rem; transition: 0.2s;">💾 저장 및 닫기</button>
        </div>
    `;

    const dayModal = new window.Modal({
        id: modalId,
        title: `📝 ${dateStr} 일정 및 기록 작성`,
        width: '1100px', // 다중 워크스페이스를 나란히 표시하기 위해 넉넉한 넓이 적용
        content: html,
        onClose: () => {
            // 모달 닫힐 때, DayView 렌더링 컨테이너를 기존의 메인 화면(#main-view)으로 원상복구
            if (window.dayViewInstance) {
                window.dayViewInstance.container = document.getElementById("main-view");
            }
            // 메인 뷰(년간/월간/주간) 새로고침하여 방금 팝업에서 수정한 내용(배지 등) 즉시 반영
            if (window.render) window.render(true);
        }
    });

    dayModal.open();

    // 팝업 내부에 DayView(하루 에디터 엔진) 렌더링
    setTimeout(() => {
        const modalContainer = document.getElementById('day-modal-body');
        if (modalContainer && window.dayViewInstance) {
            // 뒷 배경의 메인 화면 모드(Viewer)를 보호하기 위해 임시 전환
            const prevMode = store.mode;
            store.mode = 'editor';
            
            window.dayViewInstance.container = modalContainer;
            window.dayViewInstance.renderEditor().then(() => {
                store.mode = prevMode; // 렌더링 완료 후 뒷 배경 모드 원상복구
            });
        }

        // js/app.js 내의 day-modal-save-btn 클릭 이벤트 부분
        document.getElementById('day-modal-save-btn').onclick = async () => {
            if (window.dayViewInstance) {
                try {
                    const btn = document.getElementById('day-modal-save-btn');
                    btn.innerHTML = '💾 저장 중...';
                    btn.style.opacity = '0.7';
                    
                    // 🌟 저장이 데이터베이스에 완전히 기록될 때까지 기다림(await)
                    await window.dayViewInstance.save();
                    
                    store.hasUnsavedChanges = false;
                    dayModal.close();
                } catch (err) {
                    console.error("저장 중 에러 발생:", err);
                    alert("저장 중 오류가 발생했습니다: " + err.message);
                    document.getElementById('day-modal-save-btn').innerHTML = '💾 저장 및 닫기';
                    document.getElementById('day-modal-save-btn').style.opacity = '1';
                }
            } else {
                dayModal.close();
            }
        };
        
        // 취소 버튼 동작
        document.getElementById('day-modal-cancel-btn').onclick = () => {
            store.hasUnsavedChanges = false; 
            dayModal.close();
        };
    }, 100);
};