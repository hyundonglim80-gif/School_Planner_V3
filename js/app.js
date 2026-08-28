// js/app.js
import { store } from './core/store.js';
import { app, db, auth, storage } from './api/firebaseInit.js';
import { signInWithGoogle, signOut, forceRenewToken, getValidGoogleToken, initAuthListener } from './api/auth.js';
import { getUserCol, getGroupCol, dbAPI } from './api/database.js';
import { compressImage } from './api/storage.js';
import { setNetworkOnline, setNetworkOffline, toggleNetworkMode, executeManualSync } from './core/networkManager.js';
import { loadSettings } from './core/settings.js';

import { updateTitle, render, updateButtonUI, toggleMoreMenu, saveCurrentViewData, scrollToTodayIfExist, openNativeClock, installPWA } from './ui/uiManager.js';
import { toggleWeekend, toggleClass, updateDateFromScroll, setScope, setMode, handleEditSaveClick, moveDate, goToToday, goToDay, toggleSwipeMode } from './core/navigation.js';
import { initAppEvents } from './core/eventBinder.js';

import { EventManager, parseRawEventTextToEventList, formatEventListToText, generateEventBadgesHTML } from './core/eventManager.js';

import './components/Modal.js';
import './components/BaseView.js';
import './components/FilterUI.js';
import './modules/settings.js';
import './modules/help.js';
import './modules/search.js';
import './modules/labels.js';
import './modules/dday.js';
import './modules/quickLinks.js';
import './modules/timetable.js';
import './modules/backup.js';
import './modules/group.js';
import './modules/roster.js';
import './modules/evaluation.js';
import './modules/sync.js';

import './views/viewDay.js';
import './views/viewWeek.js';
import './views/viewMonth.js';
import './views/viewYear.js';
import './views/viewMemo.js';

window.promptDownloadFile = function(fileName, downloadUrl) {
    if (confirm(`"${fileName}" 파일을 다운로드하시겠습니까?`)) {
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = fileName;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
};

Object.assign(window, {
    app, db, auth, storage,
    store,
    signInWithGoogle, signOut, forceRenewToken, getValidGoogleToken,
    getUserCol, getGroupCol, dbAPI, compressImage,
    setNetworkOnline, setNetworkOffline, toggleNetworkMode, executeManualSync,
    loadSettings,
    updateTitle, render, updateButtonUI, toggleMoreMenu, saveCurrentViewData, scrollToTodayIfExist, openNativeClock, installPWA,
    toggleWeekend, toggleClass, updateDateFromScroll, setScope, setMode, handleEditSaveClick, moveDate, goToToday, goToDay, toggleSwipeMode,
    
    EventManager,
    parseRawEventTextToEventList, 
    formatEventListToText, 
    generateEventBadgesHTML,
    autoForwardIncompleteEvents: () => EventManager.autoForwardIncompleteEvents(),
    showForwardDeleteModal: (...args) => EventManager.showForwardDeleteModal(...args),
    
    showGroupDeleteModal: (...args) => {
        if (window.EventManager && typeof window.EventManager.showGroupDeleteModal === 'function') {
            return window.EventManager.showGroupDeleteModal(...args);
        }
        if (confirm("이 일정을 삭제하시겠습니까?")) {
            if (typeof args[4] === 'function') args[4](); 
        }
    },

    openPeriodModal: (...args) => EventManager.openPeriodModal(...args),
    openRecurringModal: (...args) => EventManager.openRecurringModal(...args)
});

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { initAppEvents(); initAuthListener(); });
} else {
    initAppEvents(); initAuthListener();
}

// ==========================================================================
// 📜 상하 스크롤 및 키보드 단축키 페이지 이동 로직 (완전 맞춤형)
// ==========================================================================

localStorage.setItem('workCalendar_swipeMode', 'tab');

let scrollNavTimeout = null;
let blockWheelTimer = null;
let startedAtTop = false;
let startedAtBottom = false;
let touchStartY = 0;
let touchStartedAtTop = false;
let touchStartedAtBottom = false;

// 1. 마우스 휠 스크롤 이벤트 (PC 환경)
window.addEventListener('wheel', (e) => {
    if (store.mode !== 'viewer' || store.scope === 'memo' || document.querySelector('.modal-overlay:not(.hidden)')) return;
    if (scrollNavTimeout) return;

    const scrollHeight = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
    const currentScroll = Math.ceil(window.innerHeight + window.scrollY);
    const atBottom = currentScroll >= scrollHeight - 10;
    const atTop = window.scrollY <= 10;

    if (!blockWheelTimer) {
        startedAtTop = atTop;
        startedAtBottom = atBottom;
    }
    if (blockWheelTimer) clearTimeout(blockWheelTimer);
    blockWheelTimer = setTimeout(() => { blockWheelTimer = null; }, 150);

    if (atBottom && e.deltaY > 0 && startedAtBottom) executeScrollNav(1);
    else if (atTop && e.deltaY < 0 && startedAtTop) executeScrollNav(-1);
});

// 2. 터치 스와이프 이벤트 (스마트폰/태블릿 환경)
window.addEventListener('touchstart', (e) => {
    touchStartY = e.touches[0].clientY;
    const scrollHeight = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
    const currentScroll = Math.ceil(window.innerHeight + window.scrollY);
    
    touchStartedAtTop = window.scrollY <= 10;
    touchStartedAtBottom = currentScroll >= scrollHeight - 10;
}, { passive: true });

window.addEventListener('touchend', (e) => {
    if (store.mode !== 'viewer' || store.scope === 'memo' || document.querySelector('.modal-overlay:not(.hidden)')) return;
    if (scrollNavTimeout) return;

    const touchEndY = e.changedTouches[0].clientY;
    const deltaY = touchStartY - touchEndY; 
    const scrollHeight = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
    const currentScroll = Math.ceil(window.innerHeight + window.scrollY);
    const atBottom = currentScroll >= scrollHeight - 10;
    const atTop = window.scrollY <= 10;

    if (atBottom && deltaY > 50 && touchStartedAtBottom) executeScrollNav(1);
    else if (atTop && deltaY < -50 && touchStartedAtTop) executeScrollNav(-1);
});

function executeScrollNav(direction) {
    if (window.moveDate) {
        window.moveDate(direction); 
        scrollNavTimeout = setTimeout(() => { scrollNavTimeout = null; }, 800); 
    }
}

// ==========================================================================
// 3. 💡 맞춤형 키보드 단축키 이벤트 세트
// ==========================================================================
window.addEventListener('keydown', (e) => {
    const tag = e.target.tagName.toLowerCase();
    const isInput = tag === 'input' || tag === 'textarea' || e.target.isContentEditable;
    
    if (!isInput) {
        // [A] Ctrl + Shift 조합
        if (e.ctrlKey && e.shiftKey && !e.altKey) {
            if (e.key === 'Enter') { // 캘린더 동기화
                e.preventDefault();
                if (window.quickGoogleSync) window.quickGoogleSync();
            }
        }
        // [B] Ctrl 전용 조합
        else if (e.ctrlKey && !e.shiftKey && !e.altKey) {
            if (e.key === 'Enter') { // 저장 및 보기/작성 전환
                e.preventDefault();
                if (window.handleEditSaveClick) window.handleEditSaveClick();
            } else if (e.key === 'ArrowLeft') { // 이전
                e.preventDefault(); 
                if (window.moveDate) window.moveDate(-1);
            } else if (e.key === 'ArrowRight') { // 다음
                e.preventDefault(); 
                if (window.moveDate) window.moveDate(1);
            } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { // 보기/작성 전환
                e.preventDefault();
                if (window.handleEditSaveClick) window.handleEditSaveClick();
            } else if (e.code === 'Space') { // 오늘 날짜 페이지 이동 및 스크롤
                e.preventDefault();
                if (window.goToToday) window.goToToday();
            }
        }
        // [C] Shift 전용 조합
        else if (e.shiftKey && !e.ctrlKey && !e.altKey) {
            if (e.key === '`' || e.key === '~') { // 검색
                e.preventDefault(); 
                const searchBtn = document.querySelector('[onclick*="SearchUI"]');
                if (searchBtn) searchBtn.click();
            }
            else if (e.key === '1' || e.key === '!') { e.preventDefault(); if (window.setScope) window.setScope('day'); }
            else if (e.key === '2' || e.key === '@') { e.preventDefault(); if (window.setScope) window.setScope('week'); }
            else if (e.key === '3' || e.key === '#') { e.preventDefault(); if (window.setScope) window.setScope('month'); }
            else if (e.key === '4' || e.key === '$') { e.preventDefault(); if (window.setScope) window.setScope('year'); }
            else if (e.key === '5' || e.key === '%') { e.preventDefault(); if (window.setScope) window.setScope('memo'); }
            else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { // 주말 보이기/숨기기
                e.preventDefault();
                if (window.toggleWeekend) window.toggleWeekend();
            }
        }
        // [D] Alt 전용 조합
        else if (e.altKey && !e.ctrlKey && !e.shiftKey) {
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { // 수업 보이기/숨기기
                e.preventDefault();
                if (window.toggleClass) window.toggleClass();
            }
        }
    }
});

// ==========================================================================
// 4. 💡 버튼 툴팁(title 속성) 단축키 자동 표시 로직
// ==========================================================================
function applyShortcutTooltips() {
    const addTooltip = (selector, shortcutText) => {
        document.querySelectorAll(selector).forEach(el => {
            if (!el.hasAttribute('data-shortcut-added')) {
                let currentTitle = (el.getAttribute('title') || '').trim();
                // 기존 툴팁이 있으면 띄어쓰기 후 추가, 없으면 단축키만 표시
                el.setAttribute('title', currentTitle ? `${currentTitle} (${shortcutText})` : shortcutText);
                el.setAttribute('data-shortcut-added', 'true');
            }
        });
    };

    // 각 버튼별 DOM selector 와 매칭시킬 단축키 문자열
    addTooltip('[onclick*="handleEditSaveClick"]', 'Ctrl+Enter 또는 Ctrl+상/하 화살표');
    addTooltip('[onclick*="moveDate(-1)"]', 'Ctrl+좌 화살표');
    addTooltip('[onclick*="moveDate(1)"]', 'Ctrl+우 화살표');
    addTooltip('[onclick*="SearchUI"]', 'Shift+`');
    addTooltip('[onclick*="setScope(\'day\')"]', 'Shift+1');
    addTooltip('[onclick*="setScope(\'week\')"]', 'Shift+2');
    addTooltip('[onclick*="setScope(\'month\')"]', 'Shift+3');
    addTooltip('[onclick*="setScope(\'year\')"]', 'Shift+4');
    addTooltip('[onclick*="setScope(\'memo\')"]', 'Shift+5');
    addTooltip('[onclick*="goToToday"]', 'Ctrl+Space');
    addTooltip('[onclick*="quickGoogleSync"]', 'Ctrl+Shift+Enter');
    addTooltip('[onclick*="toggleWeekend"]', 'Shift+상/하 화살표');
    addTooltip('[onclick*="toggleClass"]', 'Alt+상/하 화살표');
}

// 화면이 렌더링되거나 업데이트될 때마다 새로운 버튼에 툴팁을 입혀주기 위한 감시자(Observer)
const tooltipObserver = new MutationObserver(() => applyShortcutTooltips());
tooltipObserver.observe(document.body, { childList: true, subtree: true });

// 앱 최초 로드 시 실행
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyShortcutTooltips);
} else {
    applyShortcutTooltips();
}
