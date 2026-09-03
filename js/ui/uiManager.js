// js/ui/uiManager.js
import { store } from '../core/store.js';
import { formatDate } from '../core/utils.js';

window.addEventListener('resize', () => {
    const needsFixedHeader = store.scope === 'year' || ((store.scope === 'month' || store.scope === 'week') && store.mode === 'editor');
    if (needsFixedHeader) {
        const header = document.querySelector('.app-header');
        if (header) {
            document.body.style.setProperty('padding-top', (header.offsetHeight + 15) + 'px', 'important');
        }
    }
});

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

export const updateButtonUI = () => {
    const unifiedFilter = document.getElementById('unified-filter-container');
    if (unifiedFilter) unifiedFilter.style.display = (store.scope === 'memo') ? 'none' : 'flex';

    document.querySelectorAll('.btn-scope').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-scope') === store.scope);
    });

    const dateRangeText = document.getElementById('date-range-text');
    if (dateRangeText && dateRangeText.closest('.header-row')) {
        dateRangeText.closest('.header-row').style.display = (store.scope === 'memo') ? 'none' : 'flex';
    }

    const needsFixedHeader = store.scope === 'year' || ((store.scope === 'month' || store.scope === 'week') && store.mode === 'editor');
    const appHeader = document.querySelector('.app-header');
    
    if (needsFixedHeader) {
        if (appHeader) {
            appHeader.style.setProperty('position', 'fixed', 'important');
            appHeader.style.setProperty('top', '0', 'important');
            appHeader.style.setProperty('left', '0', 'important');
            appHeader.style.setProperty('right', '0', 'important');
            appHeader.style.setProperty('z-index', '2000', 'important');
            appHeader.style.setProperty('box-sizing', 'border-box', 'important');
            
            setTimeout(() => {
                const headerHeight = appHeader.offsetHeight;
                document.body.style.setProperty('padding-top', (headerHeight + 15) + 'px', 'important');
            }, 50);
        }
    } else {
        if (appHeader) {
            appHeader.style.removeProperty('position');
            appHeader.style.removeProperty('top');
            appHeader.style.removeProperty('left');
            appHeader.style.removeProperty('right');
            appHeader.style.removeProperty('z-index');
            appHeader.style.removeProperty('box-sizing');
        }
        document.body.style.removeProperty('padding-top');
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

    toggleMoreMenu(true); 
};

export const toggleMoreMenu = (forceClose = false) => {
    const dropdown = document.getElementById('more-dropdown');
    if (dropdown) forceClose ? dropdown.classList.add('hidden') : dropdown.classList.toggle('hidden');
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

        if (store.scope === 'day') return; 
        else if (store.scope === 'week') {
            primaryTarget = document.querySelector(`tr[data-week-date="${todayStr}"]`);
            if (primaryTarget) {
                const allRows = document.querySelectorAll(`tr.week-row-${todayStr}`);
                allRows.forEach(row => highlightTargets.push(...Array.from(row.querySelectorAll('td'))));
            }
        } else if (store.scope === 'month') {
            if (store.mode === 'editor') {
                primaryTarget = document.querySelector(`tr[data-month-date="${todayStr}"]`);
                if (!primaryTarget) primaryTarget = document.querySelector(`tr[data-month-date^="${y}-${m}"]`);
                if (primaryTarget) {
                    const targetDateStr = primaryTarget.getAttribute('data-month-date') || todayStr;
                    const allRows = document.querySelectorAll(`tr.month-row-${targetDateStr}`);
                    allRows.forEach(row => highlightTargets.push(...Array.from(row.querySelectorAll('td'))));
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
                    allRows.forEach(row => highlightTargets.push(...Array.from(row.querySelectorAll('td'))));
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
                        setTimeout(() => { el.style.backgroundColor = originalBg; setTimeout(() => { el.style.transition = ''; }, 400); }, 1200);
                    });
                }
            }, 50); 
        } else if (attempts < 15) {
            setTimeout(tryScroll, 200);
        }
    };
    tryScroll();
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

export const saveCurrentViewData = async (silent = false) => {
    const editorBtn = document.getElementById('btn-mode-editor');
    if (editorBtn && !silent) { editorBtn.innerHTML = "저장중.."; editorBtn.style.opacity = '0.7'; }

    store.hasUnsavedChanges = false; 
    const view = window[`${store.scope}ViewInstance`];
    
    try {
        if (view && typeof view.save === 'function') {
            const saveResult = view.save();
            if (saveResult instanceof Promise) await saveResult;
        }
        if (window.autoForwardIncompleteEvents) {
            const forwardResult = window.autoForwardIncompleteEvents();
            if (forwardResult instanceof Promise) await forwardResult;
        }
        
        if (!silent) {
            setTimeout(() => window.render(), 100);
            // 🚨 수정된 부분: 저장 후 거슬리는 알림창 대신 Toast 호출
            window.showToast('저장되었습니다.');
        }
    } catch(e) { console.error("Save execution error:", e); }

    if (editorBtn && !silent) {
        editorBtn.innerHTML = '저장 완료'; editorBtn.style.opacity = '1';
        setTimeout(() => { if (store.mode === 'editor') editorBtn.innerHTML = '작성'; }, 1500); 
    }
};

export const openNativeClock = () => { window.open('https://www.google.com/search?q=10%EB%B6%84+%ED%83%80%EC%9D%B4%EB%A8%B8', '_blank'); };

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
        alert("이미 기기에 설치되어 있거나 지원하지 않습니다.\n\n[아이폰/아이패드(Safari)의 경우]\n하단의 '공유(내보내기)' 아이콘을 누르고 '홈 화면에 추가'를 선택하여 수동으로 설치해주세요.");
    }
};

// 🔥 [Local-First 동기화 관리 로직 추가]
window.pendingLocalChanges = false;

// 데이터 수정이 발생했을 때 꼬리표를 달고 아이콘을 띄우는 함수
window.markLocalChanges = () => {
    // 현재 공유 그룹이 켜져 있는지 확인
    const isGroupActive = window.activeUnifiedFilters && window.activeUnifiedFilters.some(id => id !== 'personal');
    
    // 공유 그룹이 꺼져있는 순수 '개인 모드'일 때만 동기화 필요 상태로 전환
    if (!isGroupActive) {
        window.pendingLocalChanges = true;
        window.updateSyncUI();
    }
};

// 동기화 버튼 표시/숨김 제어 함수
window.updateSyncUI = () => {
    const syncBtn = document.getElementById('btn-sync-status');
    if (!syncBtn) return;
    
    const isGroupActive = window.activeUnifiedFilters && window.activeUnifiedFilters.some(id => id !== 'personal');
    
    if (isGroupActive) {
        // 그룹이 켜져있으면 상시 동기화 모드이므로 아이콘 숨김
        syncBtn.style.display = 'none'; 
    } else {
        // 개인 모드일 때 변경사항이 있으면 버튼 표시
        syncBtn.style.display = window.pendingLocalChanges ? 'flex' : 'none';
    }
};

// 동기화 버튼 클릭 시 실행될 함수 (임시 연출, 네트워크 차단/연결은 추후 적용)
window.executeLocalSync = () => {
    const syncBtn = document.getElementById('btn-sync-status');
    if (syncBtn) {
        syncBtn.innerHTML = '<span style="font-size: 1.1rem; animation: spin 1s linear infinite; display: inline-block;">🔄</span> 동기화 중...';
        syncBtn.style.color = '#059669';
        syncBtn.style.background = '#d1fae5';
        syncBtn.style.borderColor = '#6ee7b7';
    }
    
    // 추후 이 곳에 dbAPI.enableNetwork() 등의 통신 재개 로직이 들어갑니다.
    // 현재는 1초 후 동기화 완료로 연출
    setTimeout(() => {
        window.pendingLocalChanges = false;
        window.updateSyncUI(); // 아이콘 사라짐
        
        // 버튼 스타일 초기화 (다음을 위해)
        if (syncBtn) {
            syncBtn.innerHTML = '<span style="font-size: 1.1rem;">🔄</span> 동기화 필요';
            syncBtn.style.color = '#d97706';
            syncBtn.style.background = '#fffbeb';
            syncBtn.style.borderColor = '#fcd34d';
        }
    }, 1000);
};

// 💡 기존의 saveCurrentViewData 함수를 덮어씌워(오버라이드) 저장 시 markLocalChanges를 호출하도록 연결
const originalSaveCurrentViewData = window.saveCurrentViewData;
window.saveCurrentViewData = async (silent = false) => {
    await originalSaveCurrentViewData(silent); // 기존 저장 로직 실행
    window.markLocalChanges(); // 개인 모드라면 '동기화 필요' 아이콘 표시
};

export const showToast = (message, duration = 2000) => {
    let toast = document.getElementById('sp3-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'sp3-toast';
        toast.style.cssText = 'position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%); background: rgba(15, 23, 42, 0.9); color: #fff; padding: 12px 24px; border-radius: 8px; font-weight: bold; font-size: 1rem; z-index: 999999; opacity: 0; transition: opacity 0.3s ease-in-out; pointer-events: none; box-shadow: 0 4px 12px rgba(0,0,0,0.15);';
        document.body.appendChild(toast);
    }
    toast.innerText = message;
    toast.style.opacity = '1';
    
    if (window.toastTimer) clearTimeout(window.toastTimer);
    window.toastTimer = setTimeout(() => { toast.style.opacity = '0'; }, duration);
};

window.showToast = showToast; // 전역 스코프 등록