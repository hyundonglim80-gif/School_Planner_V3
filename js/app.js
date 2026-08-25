// js/app.js

import { store } from './core/store.js';
import { formatDate, parseLocalDate, getEventLabels } from './core/utils.js';
import { getUserCol, getGroupCol, setNetworkOnline, setNetworkOffline } from './firebase.js'; 
import { doc, getDoc, getDocs, setDoc, query, where, documentId, writeBatch } from "firebase/firestore";

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
        const headerOffset = document.querySelector('.app-header')?.offsetHeight || 100;
        const viewportBottom = window.innerHeight; // 🌟 화면의 맨 아래쪽 경계선 측정
        let closestEl = null;
        let minDistance = Infinity;

        for (let el of dateElements) {
            const rect = el.getBoundingClientRect();
            if (rect.width === 0 && rect.height === 0) continue; 
            
            // 🚀 [최적화] 요소의 상단이 화면 맨 아래쪽보다 훨씬 밑에 있다면 
            // 그 뒤 요소들은 볼 필요도 없으므로 즉시 반복문 탈출 (스크롤 버벅거림 해결)
            if (rect.top > viewportBottom + 300) break;

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
    
    const savedDate = localStorage.getItem(`workCalendar_date_${scope}`);
    if (savedDate) store.currentDate = new Date(savedDate);
    else store.currentDate = new Date(); 

    render(false); 
};

export const setMode = (mode) => {
    if (store.mode === 'editor' && mode === 'viewer' && store.hasUnsavedChanges) saveCurrentViewData(true);
    store.mode = mode;
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
    if (store.mode === 'editor' && store.hasUnsavedChanges) saveCurrentViewData(true);
    store.currentDate = new Date();

    if (store.scope !== 'memo') {
        localStorage.setItem(`workCalendar_date_${store.scope}`, store.currentDate.toISOString());
    }

    render(true);
};

export const goToDay = (dateStr) => {
    if (store.mode === 'editor' && store.hasUnsavedChanges) saveCurrentViewData(true);
    if (!dateStr) return;
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        store.currentDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        localStorage.setItem(`workCalendar_date_day`, store.currentDate.toISOString());
        setScope('day'); 
    }
};

export const scrollToTodayIfExist = () => {
    let attempts = 0; 
    const todayStr = formatDate(new Date());

    const tryScroll = () => {
        attempts++;
        
        const scopeInstance = window[`${store.scope}ViewInstance`];
        if (scopeInstance && scopeInstance.isRendering) {
            if (attempts < 50) setTimeout(tryScroll, 150);
            return;
        }

        const selector = `.week-today-cell, .month-today-cell, .year-today-card, tr[data-week-date="${todayStr}"], tr[data-month-date="${todayStr}"], tr[data-year-date="${todayStr}"]`;
        const todayEl = document.querySelector(selector);

        if (todayEl) {
            const header = document.querySelector('.app-header');
            const hOffset = header ? header.offsetHeight : 0;
            
            const targetY = todayEl.getBoundingClientRect().top + window.scrollY - hOffset - 15;
            const distance = Math.abs(window.scrollY - targetY);
            
            const scrollBehavior = distance > 1500 ? 'auto' : 'smooth';
            
            window.scrollTo({ top: targetY, behavior: scrollBehavior });

            setTimeout(() => {
                const checkY = todayEl.getBoundingClientRect().top + window.scrollY - hOffset - 15;
                if (Math.abs(window.scrollY - checkY) > 5) {
                    window.scrollTo({ top: checkY, behavior: 'auto' });
                }
            }, 300);

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
        } else if (attempts < 20) {
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

    const header = document.querySelector('.app-header');
    if (header) {
        document.body.style.paddingTop = header.offsetHeight + 'px';
    }

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
    
    // 🌟 보기/작성 버튼 강제 중앙 정렬
    if (viewerBtn && editorBtn) {
        viewerBtn.style.display = 'inline-flex';
        viewerBtn.style.justifyContent = 'center';
        viewerBtn.style.alignItems = 'center';
        viewerBtn.style.textAlign = 'center';

        editorBtn.style.display = 'inline-flex';
        editorBtn.style.justifyContent = 'center';
        editorBtn.style.alignItems = 'center';
        editorBtn.style.textAlign = 'center';

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
        if (view && typeof view.save === 'function') view.save(); 
        if (window.autoForwardIncompleteEvents) window.autoForwardIncompleteEvents();
    } catch(e) { console.error("Save execution error:", e); }

    if (editorBtn && !silent) {
        editorBtn.innerHTML = '저장 완료';
        editorBtn.style.opacity = '1';
        setTimeout(() => { if (store.mode === 'editor') editorBtn.innerHTML = '저장'; }, 1500); 
    }
};

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
        if (store.mode === 'editor') {
            store.hasUnsavedChanges = true; 
            clearTimeout(autoSaveTimer); 
            autoSaveTimer = setTimeout(() => {
                if (store.hasUnsavedChanges) saveCurrentViewData(false);
            }, 2500); 
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
        if (store.mode === 'editor' && store.hasUnsavedChanges) saveCurrentViewData(true);
    });

    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === 'hidden' && store.mode === 'editor' && store.hasUnsavedChanges) {
            saveCurrentViewData(true);
        }
    });

    let lastWidth = window.innerWidth;
    let resizeDebounce = null;
    window.addEventListener('resize', () => {
        if (window.innerWidth === lastWidth) return; 
        lastWidth = window.innerWidth;
        
        clearTimeout(resizeDebounce);
        resizeDebounce = setTimeout(() => {
            const header = document.querySelector('.app-header');
            if (header) document.body.style.paddingTop = header.offsetHeight + 'px';
        }, 200);
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
                
                const savedDate = localStorage.getItem(`workCalendar_date_${savedScope}`);
                if (savedDate) store.currentDate = new Date(savedDate);
                else store.currentDate = new Date();

                try {
                    await loadSettings();
                    if (window.autoCheckAndRunMigration) await window.autoCheckAndRunMigration();
                    if (window.autoForwardIncompleteEvents) await window.autoForwardIncompleteEvents();
                } catch (e) { console.error("초기 로딩 에러:", e); }

                render(false);
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

window.toggleUnifiedFilter = function(filterId) {
    const instance = window[`${store.scope}ViewInstance`];
    if (!instance) return;

    if (store.mode === 'editor') {
        if (store.hasUnsavedChanges) window.saveCurrentViewData(true);
        if (filterId === 'personal') instance.scheduleGroupId = null;
        else instance.scheduleGroupId = filterId;
        instance.renderEditor();
    } else {
        if (!instance.activeFilters) instance.activeFilters = ['personal', ...instance.myGroups.map(g => g.id)];
        
        if (instance.activeFilters.includes(filterId)) {
            instance.activeFilters = instance.activeFilters.filter(id => id !== filterId);
            if (instance.activeFilters.length === 0) instance.activeFilters.push(filterId);
        } else {
            instance.activeFilters.push(filterId);
        }
        instance.renderViewer();
    }
};

export const toggleNetworkMode = async (forceMode = null) => {
    const toggleBtn = document.getElementById('network-toggle-btn');
    const manualSyncBtn = document.getElementById('manual-sync-btn');
    
    let isOfflineMode;
    if (forceMode !== null) isOfflineMode = forceMode === 'offline';
    else isOfflineMode = !(localStorage.getItem('workCalendar_offlineMode') === 'true');

    localStorage.setItem('workCalendar_offlineMode', isOfflineMode);

    if (isOfflineMode) {
        if (toggleBtn) { toggleBtn.innerHTML = '✈️'; toggleBtn.style.background = '#ef4444'; }
        if (manualSyncBtn) manualSyncBtn.style.display = 'flex';
        await setNetworkOffline();
    } else {
        if (toggleBtn) { toggleBtn.innerHTML = '🌐'; toggleBtn.style.background = '#10b981'; }
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

export const autoForwardIncompleteEvents = async () => {
    const todayStr = formatDate(new Date()); 
    try {
        const pastDate = new Date(parseLocalDate(todayStr));
        pastDate.setDate(pastDate.getDate() - 365); 
        
        const eventsSnap = await getDocs(query(getUserCol('events'), where(documentId(), '>=', formatDate(pastDate))));
        let eventsMap = {}; let allDates = [];
        eventsSnap.forEach(docSnap => { eventsMap[docSnap.id] = docSnap.data(); allDates.push(docSnap.id); });

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
            let curList = curData.eventList || (curData.eventText ? window.parseRawEventTextToEventList(curData.eventText) : []);
            let newCurList = []; let curChanged = false;

            curList.forEach(ev => {
                let canComplete = false;
                if (ev.labelIds?.length > 0) { canComplete = ev.labelIds.some(id => window.isForwardLabel ? window.isForwardLabel(id) : getEventLabels().find(l => l.id === id)?.isForward); } 
                else if (ev.labels || ev.label) {
                    const lName = (ev.labels?.length > 0) ? ev.labels[0] : ev.label;
                    const lObj = getEventLabels().find(x => x.name === lName);
                    canComplete = lObj ? lObj.isForward : false;
                }

                const cleanContent = (ev.content || '').replace(/➡️\s*\(미완료\)/g, '').replace(/➡️\s*\(다음 날로 이월됨\)/g, '').replace(/↪️\s*/g, '').trim();
                if (ev.content !== cleanContent) { ev.content = cleanContent; curChanged = true; }

                const isOrigin = !ev.originalDate || ev.originalDate === curStr;

                if (isOrigin) {
                    if (canComplete) {
                        if (!ev.forwardChainId) { ev.forwardChainId = 'chain_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5); curChanged = true; }
                        if (!ev.originalDate) { ev.originalDate = curStr; curChanged = true; }

                        if (ev.completed) activeChains.delete(ev.forwardChainId);
                        else { activeChains.add(ev.forwardChainId); chainEventData[ev.forwardChainId] = { ...ev }; }
                        newCurList.push(ev);
                    } else {
                        if (ev.forwardChainId) { delete ev.forwardChainId; delete ev.originalDate; curChanged = true; }
                        newCurList.push(ev);
                    }
                } else {
                    if (activeChains.has(ev.forwardChainId)) {
                        if (ev.completed) activeChains.delete(ev.forwardChainId);
                        else chainEventData[ev.forwardChainId] = { ...ev };
                        newCurList.push(ev);
                    } else { curChanged = true; }
                }
            });

            let nextData = eventsMap[nextStr] || { eventList: [] };
            let nextList = nextData.eventList || (nextData.eventText ? window.parseRawEventTextToEventList(nextData.eventText) : []);
            let nextChanged = false;

            if (curStr < todayStr) {
                activeChains.forEach(chainId => {
                    const existsInNext = nextList.some(n => n.forwardChainId === chainId);
                    if (!existsInNext) {
                        const sourceEv = chainEventData[chainId];
                        nextList.unshift({
                            id: 'ev_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2,5),
                            authorId: sourceEv.authorId || window.auth?.currentUser?.uid,
                            labelIds: [...(sourceEv.labelIds || [])], label: sourceEv.label || '', labels: [...(sourceEv.labels || [])],
                            content: sourceEv.content, completed: false, forwardChainId: chainId, originalDate: sourceEv.originalDate,
                            groupId: sourceEv.groupId || null, sharedGroupId: sourceEv.sharedGroupId || null,
                            groupName: sourceEv.groupName || ''
                        });
                        nextChanged = true;
                    }
                });
            }

            if (curList.length !== newCurList.length) curChanged = true;

            if (curChanged) { eventsMap[curStr] = { ...curData, eventList: newCurList }; changedDocs.add(curStr); }
            if (nextChanged) { eventsMap[nextStr] = { ...nextData, eventList: nextList }; changedDocs.add(nextStr); }
        }

        let batch = writeBatch(window.db); let opCount = 0; let batchPromises = []; 

        changedDocs.forEach(dateStr => {
            const docRef = doc(getUserCol('events'), dateStr);
            const evList = eventsMap[dateStr].eventList;
            const updateData = { eventList: evList, updatedAt: Date.now() };
            if (window.formatEventListToText) updateData.eventText = window.formatEventListToText(evList); 
            batch.set(docRef, updateData, { merge: true });
            opCount++;
            if (opCount >= 400){ batchPromises.push(batch.commit()); batch = writeBatch(window.db); opCount = 0; }
        });

        if (opCount > 0) batchPromises.push(batch.commit());
        Promise.all(batchPromises).catch(e => console.warn(e)); 

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
    document.getElementById('forward-delete-modal').innerHTML = `<div style="background:#fff; padding:30px; border-radius:12px; font-weight:bold; color:#2563eb; text-align:center;">⏳ 로컬 및 동기화 처리 중...</div>`;
    const matchEvent = (e) => e.forwardChainId === chainId;

    try {
        let myGroups = [];
        try { myGroups = await window.dbAPI.loadMyGroups(); } catch(e) {}
        const colsToSearch = [window.getUserCol('events'), ...myGroups.map(g => window.getGroupCol(g.id, 'events'))];

        if (window.dayViewInstance && window.dayViewInstance.currentEvents) {
            if (mode === 'all' || window.dayViewInstance.dateStr >= baseDateStr) {
               window.dayViewInstance.currentEvents = window.dayViewInstance.currentEvents.filter(e => !matchEvent(e));
            } else if (mode === 'stop') {
               window.dayViewInstance.currentEvents.forEach(e => { if (matchEvent(e)) e.completed = true; });
            }
        }
        
        Object.keys(window).forEach(key => {
            if (key.startsWith('tempEvents_')) {
                const dStr = key.replace('tempEvents_', '');
                if (mode === 'all' || dStr >= baseDateStr) window[key] = window[key].filter(e => !matchEvent(e));
                else if (mode === 'stop') window[key].forEach(e => { if (matchEvent(e)) e.completed = true; });
            }
        });

        let batch = writeBatch(window.db); let count = 0; let batchPromises = []; 

        for (const col of colsToSearch) {
            const snap = await getDocs(col);
            let maxPastDateStr = '';
            
            if (mode === 'stop') {
                snap.forEach(docSnap => {
                    if (docSnap.id < baseDateStr) {
                        const list = docSnap.data().eventList || (docSnap.data().eventText ? window.parseRawEventTextToEventList(docSnap.data().eventText) : []);
                        if (list.some(matchEvent)) { if (docSnap.id > maxPastDateStr) maxPastDateStr = docSnap.id; }
                    }
                });
            }

            snap.forEach(docSnap => {
                let list = docSnap.data().eventList || [];
                const origLen = list.length; let changed = false;

                if (mode === 'all') {
                    list = list.filter(e => !matchEvent(e));
                    if (list.length !== origLen) changed = true;
                } else if (mode === 'stop') {
                    if (docSnap.id >= baseDateStr) {
                        list = list.filter(e => !matchEvent(e));
                        if (list.length !== origLen) changed = true;
                    } else if (docSnap.id === maxPastDateStr) {
                        list.forEach(e => { if (matchEvent(e) && !e.completed) { e.completed = true; changed = true; } });
                    }
                }

                if (changed) {
                    let updateData = { eventList: list, updatedAt: Date.now() };
                    if (window.formatEventListToText) updateData.eventText = window.formatEventListToText(list);
                    batch.update(docSnap.ref, updateData);
                    count++;
                    if (count >= 400) { batchPromises.push(batch.commit()); batch = writeBatch(window.db); count = 0; }
                }
            });
        }
        if (count > 0) batchPromises.push(batch.commit());
        await Promise.all(batchPromises);

        if (window.autoForwardIncompleteEvents) window.autoForwardIncompleteEvents();
    } catch(e) { console.error("이월 삭제 오류:", e); }

    document.getElementById('forward-delete-modal')?.remove();
    if (onConfirm) onConfirm();
};

export const openPeriodModal = async (startDateStr, labelName, textContent, callback, labelId) => {
    let myGroups = [];
    try { myGroups = await window.dbAPI.loadMyGroups(); } catch(e) {}
    
    const groupOptions = `<option value="">🔒 개인 일정으로 등록 (나만 보기)</option>` +
        myGroups.map(g => `<option value="${g.id}">👥 [${g.name}] 그룹에 공유</option>`).join('');

    const modalHtml = `
    <div id="period-modal" class="modal-overlay" style="display:flex; position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.5); z-index:10002; justify-content:center; align-items:center;">
        <div style="background:#fff; padding:25px; border-radius:12px; width:380px; box-shadow:0 10px 25px rgba(0,0,0,0.2);">
            <h3 style="margin-top:0; color:#2563eb; border-bottom:2px solid #bfdbfe; padding-bottom:10px;">📅 [${labelName}] 연속 기간 등록</h3>
            
            <div style="margin-bottom:15px; background:#eff6ff; padding:8px; border-radius:6px; border:1px solid #bfdbfe; display:flex; gap:10px; align-items:center;">
                <span style="font-weight:bold; color:#1d4ed8; font-size:0.9rem; flex-shrink:0;">저장 위치:</span>
                <select id="period-shared-group" style="flex:1; padding:6px; border:1px solid #93c5fd; border-radius:4px; font-weight:bold; color:#1e40af; outline:none;">
                    ${groupOptions}
                </select>
            </div>

            <div style="margin-bottom:15px;">
                <label style="display:block; font-weight:bold; margin-bottom:5px;">일정 내용</label>
                <input type="text" id="period-content" value="${textContent}" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:6px; box-sizing:border-box;" placeholder="예: 여름방학">
            </div>
            <div style="display:flex; gap:10px; margin-bottom:15px;">
                <div style="flex:1;"><label style="display:block; font-weight:bold; margin-bottom:5px; font-size:0.9rem;">시작일</label><input type="date" id="period-start" value="${startDateStr}" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px; background:#fff; box-sizing:border-box;"></div>
                <div style="flex:1;"><label style="display:block; font-weight:bold; margin-bottom:5px; font-size:0.9rem; color:#ef4444;">종료일 선택</label><input type="date" id="period-end" value="${startDateStr}" style="width:100%; padding:8px; border:1px solid #ef4444; border-radius:6px; outline:none; box-sizing:border-box;"></div>
            </div>
            <div style="margin-bottom:25px; background:#f8fafc; padding:10px; border-radius:6px; border:1px solid #e2e8f0;">
                <label style="display:flex; align-items:center; gap:6px; font-weight:bold; cursor:pointer;"><input type="checkbox" id="period-exclude-weekend" checked style="width:16px; height:16px; accent-color:#2563eb;"> 주말(토/일) 제외하고 계산하기</label>
                <p style="margin:5px 0 0 22px; font-size:0.8rem; color:#64748b;">체크 시 평일에만 등록됩니다.</p>
            </div>
            <div style="display:flex; justify-content:flex-end; gap:10px;">
                <button id="btn-period-cancel" style="padding:10px 16px; border:none; background:#f1f5f9; font-weight:bold; border-radius:6px; cursor:pointer;">취소</button>
                <button id="btn-period-register" style="padding:10px 16px; border:none; background:#2563eb; color:#fff; font-weight:bold; border-radius:6px; cursor:pointer;">등록</button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    document.getElementById('btn-period-cancel').onclick = () => { document.getElementById('period-modal').remove(); if(callback) callback(false); };
    document.getElementById('btn-period-register').onclick = () => executeGroupSave(labelName, callback, 'period', labelId);
};

export const openRecurringModal = async (startDateStr, labelName, textContent, callback, labelId) => {
    if (window.RecurringEventModule) {
        window.RecurringEventModule.open(startDateStr, labelName, textContent, callback);
    }
};

export const executeGroupSave = async (labelName, callback, mode, labelId) => {
    const isPeriod = (mode === 'period');
    const prefix = isPeriod ? 'period' : 'recur';
    const content = document.getElementById(`${prefix}-content`).value.trim();
    const startStr = document.getElementById(`${prefix}-start`).value;
    const endStr = document.getElementById(`${prefix}-end`).value;
    const excludeWeekend = isPeriod ? document.getElementById('period-exclude-weekend').checked : false;

    const sharedGroupId = document.getElementById(`${prefix}-shared-group`)?.value || null;

    if(!content) return alert("일정 내용을 입력해주세요.");
    const startD = new Date(startStr); const endD = new Date(endStr);
    if(startD > endD) return alert("종료일이 시작일보다 빠를 수 없습니다.");

    let datesToSave = []; let curD = new Date(startD); const targetDayOfWeek = startD.getDay();

    while (curD <= endD) {
        if (isPeriod) {
            const day = curD.getDay();
            if (!(excludeWeekend && (day === 0 || day === 6))) datesToSave.push(formatDate(curD));
        } else {
            if (curD.getDay() === targetDayOfWeek) datesToSave.push(formatDate(curD));
        }
        curD.setDate(curD.getDate() + 1);
    }

    const totalDays = datesToSave.length;
    let batch = writeBatch(window.db);
    const groupId = `group_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 5)}`; 

    const targetCol = sharedGroupId ? getGroupCol(sharedGroupId, 'events') : getUserCol('events');

    for(let i=0; i<totalDays; i++) {
        const dStr = datesToSave[i];
        const docRef = doc(targetCol, dStr);
        const docSnap = await getDoc(docRef);
        let list = docSnap.exists() ? (docSnap.data().eventList || []) : [];

        list.push({ 
            id: 'ev_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2,5),
            authorId: window.auth?.currentUser?.uid,
            labelIds: labelId ? [labelId] : [], 
            label: labelName, labels: [labelName], 
            content: isPeriod ? `${content} (${i+1}/${totalDays})` : content, 
            completed: false, 
            groupId: groupId, 
            sharedGroupId: sharedGroupId 
        });
        batch.set(docRef, { eventList: list, updatedAt: Date.now() }, { merge: true });
    }

    batch.commit().catch(e => console.warn(e)); 
    document.getElementById(`${prefix}-modal`).remove();
    alert(`✅ 총 ${totalDays}개의 그룹 일정이 성공적으로 등록되었습니다.`);
    if (callback) callback(true);
};

export const showGroupDeleteModal = (baseDateStr, labelIdOrName, textContent, groupId, onConfirm, onOnlyThisDay) => {
    const modalHtml = `
    <div id="group-delete-modal" class="modal-overlay" style="display:flex; position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.5); z-index:10002; justify-content:center; align-items:center;">
        <div class="modal-content" style="width:380px; padding:25px; background:#fff; border-radius:12px; text-align:center;">
            <h3 style="color:#ef4444; margin-top:0;">🗑️ 연결된 그룹 일정 삭제</h3>
            <p style="color:#475569; font-size:0.95rem; margin-bottom:20px; line-height:1.5;">선택하신 일정은 <b>'반복 또는 기간'</b>으로 연결된 일정입니다.<br>어떻게 처리할까요?</p>
            <div style="display:flex; flex-direction:column; gap:10px;">
                <button id="btn-del-only-this" style="padding:12px; background:#f1f5f9; border:1px solid #cbd5e1; border-radius:8px; cursor:pointer; font-weight:bold; color:#1e293b; text-align:left;">1. 이 일정만 삭제 <span style="font-size:0.8rem; font-weight:normal; color:#64748b;">(예외 처리)</span></button>
                <button id="btn-del-after-this" style="padding:12px; background:#fff1f2; border:1px solid #fecdd3; border-radius:8px; cursor:pointer; font-weight:bold; color:#e11d48; text-align:left;">2. 이 날부터 이후 모든 연결된 일정 삭제</button>
                <button id="btn-del-all" style="padding:12px; background:#fee2e2; border:1px solid #fca5a5; border-radius:8px; cursor:pointer; font-weight:bold; color:#b91c1c; text-align:left;">3. 전체 그룹 일정 모두 삭제 <span style="font-size:0.8rem; font-weight:normal; color:#ef4444;">(과거 포함)</span></button>
                <button onclick="document.getElementById('group-delete-modal').remove()" style="padding:10px; background:none; border:none; color:#64748b; font-weight:bold; cursor:pointer; margin-top:5px;">취소</button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const baseContent = textContent.replace(/\s*\(\d+\/\d+\).*/, '').trim();

    document.getElementById('btn-del-only-this').onclick = () => { document.getElementById('group-delete-modal').remove(); if (onOnlyThisDay) onOnlyThisDay(); };
    document.getElementById('btn-del-after-this').onclick = async () => { if(store.hasUnsavedChanges) saveCurrentViewData(true); await executeGroupDelete('after', baseDateStr, groupId, labelIdOrName, baseContent, onConfirm); };
    document.getElementById('btn-del-all').onclick = async () => { if(store.hasUnsavedChanges) saveCurrentViewData(true); await executeGroupDelete('all', baseDateStr, groupId, labelIdOrName, baseContent, onConfirm); };
};

export const executeGroupDelete = async (mode, baseDateStr, groupId, labelIdOrName, baseContent, onConfirm) => {
    document.getElementById('group-delete-modal').innerHTML = `<div style="background:#fff; padding:30px; border-radius:12px; font-weight:bold; color:#2563eb; text-align:center;">⏳ 일괄 삭제 처리 중...</div>`;

    const matchEvent = (e) => {
        if (groupId && e.groupId) return e.groupId === groupId; 
        const eLabelIds = e.labelIds || []; const eLabels = e.labels || (e.label ? [e.label] : []);
        const hasLabel = eLabelIds.includes(labelIdOrName) || eLabels.includes(labelIdOrName);
        const c = (e.content || '').replace(/\s*\(\d+\/\d+\).*/, '').trim();
        return hasLabel && c === baseContent;
    };

    if (window.dayViewInstance && window.dayViewInstance.dateStr === baseDateStr && window.dayViewInstance.currentEvents) {
        window.dayViewInstance.currentEvents = window.dayViewInstance.currentEvents.filter(e => !matchEvent(e));
    }
    Object.keys(window).forEach(key => {
        if (key.startsWith('tempEvents_')) {
            const dStr = key.replace('tempEvents_', '');
            if (mode === 'only' && dStr !== baseDateStr) return;
            if (mode === 'after' && dStr < baseDateStr) return;
            window[key] = window[key].filter(e => !matchEvent(e));
        }
    });

    try {
        let myGroups = [];
        try { myGroups = await window.dbAPI.loadMyGroups(); } catch(e) {}
        const colsToSearch = [window.getUserCol('events'), ...myGroups.map(g => window.getGroupCol(g.id, 'events'))];

        let batch = writeBatch(window.db); let count = 0; let batchPromises = []; 

        for (const col of colsToSearch) {
            let q = col;
            if (mode === 'after') q = query(q, where(documentId(), '>=', baseDateStr));
            const snap = await getDocs(q);
            
            snap.forEach(docSnap => {
                const data = docSnap.data();
                let list = data.eventList || [];
                const origLen = list.length;

                list = list.filter(e => !matchEvent(e));

                if (origLen !== list.length) {
                    let updateData = { eventList: list, updatedAt: Date.now() };
                    if (window.formatEventListToText) updateData.eventText = window.formatEventListToText(list);
                    batch.update(docSnap.ref, updateData);

                    count++;
                    if (count >= 400) { batchPromises.push(batch.commit()); batch = writeBatch(window.db); count = 0; }
                }
            });
        }
        if (count > 0) batchPromises.push(batch.commit());
        await Promise.all(batchPromises);
    } catch(e) { console.error("일괄 삭제 오류:", e); }

    document.getElementById('group-delete-modal')?.remove();
    if (onConfirm) onConfirm();
};

export const toggleDdayMenu = () => {
    if (!store.dDayList?.length) return openDdaySettingsModal();
    const dropdown = document.getElementById('dday-dropdown');
    const listContainer = document.getElementById('dday-list-container');
    if (dropdown.classList.contains('hidden')) {
        listContainer.innerHTML = store.dDayList.map(dday => {
            const isSelected = dday.id === store.selectedDDayId;
            return `<button class="dropdown-item" onclick="window.selectDday('${dday.id}')" style="${isSelected ? 'background:#eff6ff; color:#2563eb;' : ''}"><span style="font-weight:bold; margin-right:8px; display:inline-block; width:50px;">${calculateDday(dday.date)}</span> ${dday.title}</button>`;
        }).join('') + (store.selectedDDayId ? `<button class="dropdown-item" onclick="window.selectDday(null)" style="color:#64748b; text-align:center;">선택 해제</button>` : '');
    }
    dropdown.classList.toggle('hidden');
};

export const selectDday = async (id) => {
    store.selectedDDayId = id;
    document.getElementById('dday-dropdown').classList.add('hidden');
    updateDdayUI();
    if (window.auth?.currentUser) {
        setDoc(doc(getUserCol('settings'), 'preferences'), { selectedDDayId: id }, { merge: true }).catch(e=>console.warn(e)); 
    }
};

export const updateDdayUI = () => {
    const btn = document.getElementById('btn-dday-display');
    if (!btn) return;
    if (!store.selectedDDayId || !store.dDayList?.length) {
        btn.textContent = "D-Day 설정"; btn.style.cssText = "color:#64748b; background-color:#f1f5f9; border-color:#cbd5e1; font-weight:bold; min-width:90px; cursor:pointer;"; 
        return;
    }
    const selected = store.dDayList.find(d => d.id === store.selectedDDayId);
    if (selected) {
        btn.textContent = `${selected.title} ${calculateDday(selected.date)}`; 
        btn.style.cssText = "color:#ef4444; background-color:#fef2f2; border-color:#fca5a5; font-weight:bold; min-width:90px; cursor:pointer;";
    }
};

export const calculateDday = (targetDateStr) => {
    const today = new Date(); today.setHours(0, 0, 0, 0); 
    const targetDate = new Date(targetDateStr); targetDate.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)); 
    return diffDays === 0 ? 'D-Day' : (diffDays > 0 ? `D-${diffDays}` : `D+${Math.abs(diffDays)}`);
};

export const openDdaySettingsModal = () => {
    document.getElementById('dday-dropdown')?.classList.add('hidden');
    document.getElementById('dday-modal')?.remove();
    const modalHtml = `<div id="dday-modal" class="modal-overlay" style="z-index: 10006; display:flex;"><div class="modal-content" style="width: 400px; padding:0;"><div class="modal-header" style="padding: 15px 20px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center;"><h2 style="font-size:1.2rem; margin:0; color:#1e293b;">⚙️ D-Day 관리</h2><button class="btn-close-modal" onclick="document.getElementById('dday-modal').remove()" style="font-size:1.5rem; background:none; border:none; cursor:pointer; color:#64748b;">&times;</button></div><div class="modal-body" style="padding: 20px;"><div style="display:flex; gap:8px; margin-bottom:20px;"><input type="text" id="new-dday-title" placeholder="디데이 명칭" style="flex:1; padding:8px; border:1px solid #cbd5e1; border-radius:6px; font-size:0.9rem;"><input type="date" id="new-dday-date" style="padding:8px; border:1px solid #cbd5e1; border-radius:6px;"><button onclick="window.addDday()" style="padding:8px 12px; background:#2563eb; color:white; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">추가</button></div><hr style="border:0; border-top:1px dashed #e2e8f0; margin-bottom:15px;"><div id="dday-settings-list" style="display:flex; flex-direction:column; gap:10px; max-height:250px; overflow-y:auto;"></div></div></div></div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    renderDdaySettingsList();
};

export const renderDdaySettingsList = () => {
    const listEl = document.getElementById('dday-settings-list');
    if(!listEl) return;
    if (store.dDayList.length === 0) { listEl.innerHTML = '<div style="text-align:center; color:#94a3b8; font-size:0.9rem; margin-top:20px;">등록된 D-Day가 없습니다.</div>'; return; }
    listEl.innerHTML = store.dDayList.map(dday => `<div style="display:flex; justify-content:space-between; align-items:center; padding:10px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px;"><div><span style="font-weight:bold; color:#1e293b; margin-right:8px;">${dday.title}</span><span style="font-size:0.85rem; color:#64748b;">${dday.date}</span></div><button onclick="window.deleteDday('${dday.id}')" style="background:none; border:none; color:#ef4444; font-weight:bold; cursor:pointer; padding:4px 8px;">삭제</button></div>`).join('');
};

export const addDday = () => {
    const title = document.getElementById('new-dday-title').value.trim();
    const date = document.getElementById('new-dday-date').value;
    if (!title || !date) return alert("명칭과 날짜를 모두 입력해주세요.");

    const newDday = { id: 'dday_' + Date.now().toString(36), title, date };
    store.dDayList.push(newDday);
    if (store.dDayList.length === 1) store.selectedDDayId = newDday.id;

    saveDdayDataToFirebase(); 
    document.getElementById('new-dday-title').value = ''; 
    document.getElementById('new-dday-date').value = '';
    renderDdaySettingsList(); updateDdayUI();
};

export const deleteDday = (id) => {
    if (!confirm("해당 D-Day를 삭제하시겠습니까?")) return;
    store.dDayList = store.dDayList.filter(d => d.id !== id);
    if (store.selectedDDayId === id) store.selectedDDayId = null;
    saveDdayDataToFirebase(); 
    renderDdaySettingsList(); updateDdayUI();
};

export const saveDdayDataToFirebase = () => {
    if (!window.auth?.currentUser) return;
    setDoc(doc(getUserCol('settings'), 'preferences'), { dDayList: store.dDayList, selectedDDayId: store.selectedDDayId }, { merge: true }).catch(e=>console.warn(e));
};

Object.assign(window, {
    toggleWeekend, toggleClass, setScope, setMode, handleEditSaveClick, 
    moveDate, goToToday, goToDay, scrollToTodayIfExist, updateDateFromScroll, loadSettings, render, 
    updateTitle, toggleMoreMenu, updateButtonUI, saveCurrentViewData, 
    autoForwardIncompleteEvents, showForwardDeleteModal, executeForwardDelete, 
    openPeriodModal, openRecurringModal, executeGroupSave, 
    showGroupDeleteModal, executeGroupDelete,
    toggleDdayMenu, selectDday, updateDdayUI, calculateDday, 
    openDdaySettingsModal, renderDdaySettingsList, addDday, deleteDday, 
    saveDdayDataToFirebase,
    toggleNetworkMode, executeManualSync, openNativeClock, installPWA,
    toggleSwipeMode 
});
