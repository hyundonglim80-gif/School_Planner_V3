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
import './modules/linker.js';

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

window.handleAttachmentClick = function(fileName, webViewLink, downloadLink) {
    const unviewableExts = ['.hwp', '.hwpx', '.zip', '.rar', '.7z', '.alz', '.egg', '.exe'];
    const extMatch = fileName.match(/\.[0-9a-z]+$/i);
    const ext = extMatch ? extMatch[0].toLowerCase() : '';
    
    if (unviewableExts.includes(ext)) {
        if (confirm(`'${fileName}' 파일은 바로 열 수 없는 형식입니다.\n파일을 다운로드하시겠습니까?`)) {
            const a = document.createElement('a');
            a.href = downloadLink;
            a.download = fileName;
            a.target = '_blank';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }
    } else {
        const targetLink = (webViewLink && webViewLink !== 'undefined') ? webViewLink : downloadLink;
        window.open(targetLink, '_blank');
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

const applyEnvironmentNetworkMode = () => {
    if (window.toggleNetworkMode) {
        window.toggleNetworkMode('online');
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { 
        initAppEvents(); 
        initAuthListener(); 
        applyEnvironmentNetworkMode(); 
    });
} else {
    initAppEvents(); 
    initAuthListener();
    applyEnvironmentNetworkMode(); 
}

// ==========================================================================
// 💡 [문제 2 해결] 팝업(모달) 감지 시 배경 스크롤 및 단축키 강제 차단 로직
// ==========================================================================
window.activeModalCount = 0;

window.increaseModalCount = () => { 
    window.activeModalCount++; 
    document.body.style.overflow = 'hidden'; 
};

window.decreaseModalCount = () => { 
    if (window.activeModalCount > 0) window.activeModalCount--; 
    if (window.activeModalCount === 0) {
        document.body.style.overflow = ''; 
    }
};

// 화면에 실제로 모달 요소가 표시되고 있는지 단축키/휠 입력 시 검사합니다.
const isModalOpen = () => {
    if (window.activeModalCount > 0) return true;
    const activeOverlay = document.querySelector('.modal-overlay:not(.hidden), [id*="modal-overlay"]:not(.hidden), .super-alarm-overlay:not(.hidden), #day-modal-body');
    if (activeOverlay && activeOverlay.id !== 'main-view' && activeOverlay.offsetParent !== null) {
        return true;
    }
    return false;
};

// ==========================================================================
// 📜 상하 스와이프 및 마우스 휠 페이지 이동 로직
// ==========================================================================
localStorage.setItem('workCalendar_swipeMode', 'tab');

const preventRefreshStyle = document.createElement('style');
preventRefreshStyle.innerHTML = `html, body { overscroll-behavior-y: none; }`;
document.head.appendChild(preventRefreshStyle);

let scrollNavTimeout = null;
let blockWheelTimer = null;
let startedAtTop = false;
let startedAtBottom = false;

let touchStartX = 0;
let touchStartY = 0;
let touchStartedAtTop = false;
let touchStartedAtBottom = false;

window.addEventListener('wheel', (e) => {
    if (isModalOpen()) return; // 모달창 열림 시 휠 차단
    if (window.isInfiniteScrollActive) return; 

    if (store.mode !== 'viewer' || store.scope === 'memo') return;
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

window.addEventListener('touchstart', (e) => {
    if (isModalOpen()) return; // 모달창 열림 시 터치 차단

    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    
    const scrollHeight = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
    const currentScroll = Math.ceil(window.innerHeight + window.scrollY);
    
    // 🔥 모바일 UI 변화를 고려해 오차 범위를 10에서 50으로 확대
    touchStartedAtTop = window.scrollY <= 50;
    touchStartedAtBottom = currentScroll >= scrollHeight - 50;
}, { passive: true });

window.addEventListener('touchend', (e) => {
    if (isModalOpen()) return; // 모달창 열림 시 터치 차단

    // 🔥 작성 모드에서는 앱의 강제 스와이프 개입을 중단 (기본 스크롤만 허용)
    if (store.mode !== 'viewer') return; 
    if (scrollNavTimeout) return;

    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    
    const deltaX = touchStartX - touchEndX;
    const deltaY = touchStartY - touchEndY; 

    // 🔥 대각선 터치 시 화면이 넘어가는 오작동을 막기 위해 가로 스와이프 조건 강화 (1.5배)
    if (Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
        if (Math.abs(deltaX) > 50) {
            const scopes = ['day', 'week', 'month', 'year', 'memo'];
            const currentIdx = scopes.indexOf(store.scope);
            if (currentIdx !== -1 && window.setScope) {
                let nextIdx = deltaX > 0 ? currentIdx + 1 : currentIdx - 1;
                if (nextIdx < 0) nextIdx = scopes.length - 1;
                if (nextIdx >= scopes.length) nextIdx = 0;
                window.setScope(scopes[nextIdx]);
            }
        }
    } else {
        // 세로 스와이프
        if (store.scope === 'memo') return; 

        // 🔥 핵심: 무한 스크롤 모드가 켜져 있을 때는 강제 페이지 새로고침 중단!
        if (window.isInfiniteScrollActive) return;

        const scrollHeight = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
        const currentScroll = Math.ceil(window.innerHeight + window.scrollY);
        const atBottom = currentScroll >= scrollHeight - 50;
        const atTop = window.scrollY <= 50;

        if (atBottom && deltaY > 50 && touchStartedAtBottom) executeScrollNav(1);
        else if (atTop && deltaY < -50 && touchStartedAtTop) executeScrollNav(-1);
    }
});

function executeScrollNav(direction) {
    if (window.moveDate) {
        window.moveDate(direction); 
        scrollNavTimeout = setTimeout(() => { scrollNavTimeout = null; }, 800); 
    }
}

// ==========================================================================
// 3. 💡 맞춤형 키보드 단축키 이벤트 세트 (사용 설명서 완벽 대응)
// ==========================================================================
window.addEventListener('keydown', (e) => {
    if (isModalOpen()) return; // 모달창 열림 시 메인 화면 단축키 차단

    const tag = e.target.tagName ? e.target.tagName.toLowerCase() : '';
    const isInput = tag === 'input' || tag === 'textarea' || e.target.isContentEditable;

    // --------------------------------------------------------------------------
    // A. 입력창(input/textarea) 편집 중에도 즉시 작동해야 하는 핵심 제어 단축키
    // --------------------------------------------------------------------------

    // 1. 빠른 구글 동기화 (Ctrl + Shift + Enter)
    if (e.ctrlKey && e.shiftKey && !e.altKey && e.key === 'Enter') {
        e.preventDefault();
        if (isInput && document.activeElement && document.activeElement.blur) document.activeElement.blur();
        if (window.quickGoogleSync) window.quickGoogleSync();
        return;
    }

    // 2. 모드 전환: 보기 모드로 전환 (Ctrl + ⬆️)
    if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key === 'ArrowUp') {
        e.preventDefault();
        if (isInput && document.activeElement && document.activeElement.blur) document.activeElement.blur();
        if (window.setMode) window.setMode('viewer');
        return;
    }

    // 3. 작성 및 저장: 작성 모드 전환 또는 수정 내용 저장 (Ctrl + ⬇️)
    if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key === 'ArrowDown') {
        e.preventDefault();
        if (isInput && document.activeElement && document.activeElement.blur) document.activeElement.blur();
        if (window.handleEditSaveClick) window.handleEditSaveClick();
        return;
    }

    // 4. 항목 추가 / 저장 완료 (Ctrl + Enter)
    if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key === 'Enter') {
        e.preventDefault();
        if (store.scope === 'memo') {
            if (window.memoViewInstance && typeof window.memoViewInstance.addMemoItem === 'function') {
                window.memoViewInstance.addMemoItem();
            } else {
                const addBtn = document.querySelector('.memo-btn-submit') || 
                               Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === '추가');
                if (addBtn) addBtn.click();
            }
        } else {
            if (isInput && document.activeElement && document.activeElement.blur) document.activeElement.blur();
            if (store.mode === 'editor') {
                if (window.saveCurrentViewData) window.saveCurrentViewData(false);
            } else {
                if (window.handleEditSaveClick) window.handleEditSaveClick();
            }
        }
        return;
    }

    // --------------------------------------------------------------------------
    // B. 입력창에 텍스트 입력 중이 아닐 때만 동작해야 하는 탐색/토글 단축키 (!isInput)
    // --------------------------------------------------------------------------
    if (!isInput) {
        // 5. 오늘 날짜로 즉시 복귀 (Ctrl + Space)
        if (e.ctrlKey && !e.shiftKey && !e.altKey && (e.code === 'Space' || e.key === ' ')) {
            e.preventDefault();
            if (window.goToToday) window.goToToday();
            return;
        }

        // 6. 날짜(기간) 이전/다음 이동 (Ctrl + ⬅️ / ➡️)
        if (e.ctrlKey && !e.shiftKey && !e.altKey) {
            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                if (window.moveDate) window.moveDate(-1);
                return;
            }
            if (e.key === 'ArrowRight') {
                e.preventDefault();
                if (window.moveDate) window.moveDate(1);
                return;
            }
        }

        // 7. 화면(탭) 이동 (Shift + 1~5 및 Ctrl + 1~5 모두 완벽 지원)
        const isShiftNumber = e.shiftKey && !e.ctrlKey && !e.altKey;
        const isCtrlNumber = e.ctrlKey && !e.shiftKey && !e.altKey;
        if (isShiftNumber || isCtrlNumber) {
            let targetScope = null;
            if (e.key === '1' || e.key === '!' || e.code === 'Digit1' || e.code === 'Numpad1') targetScope = 'day';
            else if (e.key === '2' || e.key === '@' || e.code === 'Digit2' || e.code === 'Numpad2') targetScope = 'week';
            else if (e.key === '3' || e.key === '#' || e.code === 'Digit3' || e.code === 'Numpad3') targetScope = 'month';
            else if (e.key === '4' || e.key === '$' || e.code === 'Digit4' || e.code === 'Numpad4') targetScope = 'year';
            else if (e.key === '5' || e.key === '%' || e.code === 'Digit5' || e.code === 'Numpad5') targetScope = 'memo';

            if (targetScope) {
                e.preventDefault();
                if (window.setScope) window.setScope(targetScope);
                return;
            }
        }

        // 8. 화면(탭) 좌우 순환 이동 (Shift + ⬅️ / ➡️)
        if (e.shiftKey && !e.ctrlKey && !e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
            e.preventDefault();
            const scopes = ['day', 'week', 'month', 'year', 'memo'];
            let currentIndex = scopes.indexOf(store.scope);
            if (currentIndex === -1) currentIndex = 0;
            if (e.key === 'ArrowLeft') currentIndex = (currentIndex - 1 + scopes.length) % scopes.length;
            else if (e.key === 'ArrowRight') currentIndex = (currentIndex + 1) % scopes.length;
            if (window.setScope) window.setScope(scopes[currentIndex]);
            return;
        }

        // 9. 검색창 열기 (Shift + ` 또는 Ctrl + ` 또는 /)
        const isShiftBackquote = e.shiftKey && !e.ctrlKey && !e.altKey && (e.key === '`' || e.key === '~' || e.code === 'Backquote');
        const isCtrlBackquote = e.ctrlKey && !e.shiftKey && !e.altKey && (e.key === '`' || e.key === '~' || e.code === 'Backquote');
        const isSlash = !e.ctrlKey && !e.shiftKey && !e.altKey && (e.key === '/' || e.code === 'Slash');
        if (isShiftBackquote || isCtrlBackquote || isSlash) {
            e.preventDefault();
            if (window.openSearchModal) window.openSearchModal();
            else {
                const searchBtn = document.getElementById('btn-search') || document.querySelector('[onclick*="SearchUI"]');
                if (searchBtn) searchBtn.click();
            }
            return;
        }

        // 10. 주말 표시 토글 (Shift + ⬆️ / ⬇️)
        if (e.shiftKey && !e.ctrlKey && !e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
            e.preventDefault();
            if (window.toggleWeekend) window.toggleWeekend();
            return;
        }

        // 11. 수업 표시 토글 (Alt + ⬆️ / ⬇️)
        if (e.altKey && !e.ctrlKey && !e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
            e.preventDefault();
            if (window.toggleClass) window.toggleClass();
            return;
        }
    }
});

if (!document.getElementById('sp3-custom-tooltip-style')) {
    const tooltipStyle = document.createElement('style');
    tooltipStyle.id = 'sp3-custom-tooltip-style';
    tooltipStyle.innerHTML = `
        #sp3-custom-tooltip {
            position: fixed;
            background: rgba(15, 23, 42, 0.9);
            color: #f8fafc;
            padding: 7px 12px;
            border-radius: 6px;
            pointer-events: none;
            z-index: 2147483647;
            opacity: 0;
            transform: translateY(4px) scale(0.95);
            transition: opacity 0.1s ease-out, transform 0.1s ease-out;
            white-space: pre-wrap;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            text-align: center;
            line-height: 1.4;
            backdrop-filter: blur(4px);
        }
        #sp3-custom-tooltip.show {
            opacity: 1;
            transform: translateY(0) scale(1);
        }
    `;
    document.head.appendChild(tooltipStyle);
}

let customTooltipEl = document.getElementById('sp3-custom-tooltip');
if (!customTooltipEl) {
    customTooltipEl = document.createElement('div');
    customTooltipEl.id = 'sp3-custom-tooltip';
    document.body.appendChild(customTooltipEl);
}

let tooltipTimeout;

document.body.addEventListener('mouseover', (e) => {
    const target = e.target.closest('[data-tooltip]');
    if (target) {
        if (target.hasAttribute('title')) target.removeAttribute('title'); 

        clearTimeout(tooltipTimeout);
        tooltipTimeout = setTimeout(() => {
            customTooltipEl.innerHTML = target.getAttribute('data-tooltip');
            const rect = target.getBoundingClientRect();
            
            let top = rect.bottom + 10;
            let left = rect.left + (rect.width / 2) - (customTooltipEl.offsetWidth / 2);

            if (top + customTooltipEl.offsetHeight > window.innerHeight - 10) top = rect.top - customTooltipEl.offsetHeight - 10;
            if (left < 10) left = 10;
            if (left + customTooltipEl.offsetWidth > window.innerWidth - 10) left = window.innerWidth - customTooltipEl.offsetWidth - 10;

            customTooltipEl.style.top = `${top}px`;
            customTooltipEl.style.left = `${left}px`;
            customTooltipEl.classList.add('show');
        }, 30); 
    }
}, true);

const hideTooltip = (e) => {
    const target = e.target.closest('[data-tooltip]');
    if (target || e.type === 'click' || e.type === 'touchstart') {
        clearTimeout(tooltipTimeout);
        if (customTooltipEl) customTooltipEl.classList.remove('show');
    }
};

document.body.addEventListener('mouseout', hideTooltip, true);
document.body.addEventListener('click', hideTooltip, true);
document.body.addEventListener('touchstart', hideTooltip, { passive: true, capture: true });

function applyShortcutTooltips() {
    const attach = (el, shortcutText) => {
        if (!el) return;
        if (el.hasAttribute('title')) el.removeAttribute('title'); 
        let existingTooltip = el.getAttribute('data-tooltip') || '';
        if (existingTooltip.includes(shortcutText)) return; 
        let newTooltipText = `<span style="color:#fbbf24; font-size:0.85rem; font-weight:bold;">단축키: ${shortcutText}</span>`;
        el.setAttribute('data-tooltip', newTooltipText);
        el.setAttribute('data-shortcut-added', 'true');
    };

    document.querySelectorAll('label, button, a, div, span, h1, h2, h3, h4, [onclick], .nav-item').forEach(el => {
        if (el.hasAttribute('title') && el.hasAttribute('data-tooltip')) {
            el.removeAttribute('title'); 
        }
        if (el.hasAttribute('data-shortcut-added')) return;
        
        const text = (el.textContent || '').trim();
        const attr = (el.getAttribute('onclick') || '') + ' ' + (el.getAttribute('onchange') || '');
        const idClass = (el.id || '') + ' ' + (el.className || '');
        const tag = el.tagName.toLowerCase();

        if (idClass.includes('label-chip') || el.hasAttribute('data-id') || attr.includes('toggleEvent') || attr.includes('LabelClick') || attr.includes('toggleJournal') || idClass.includes('modal-overlay') || idClass.includes('modal-content') || idClass.includes('modal-body')) {
            return; 
        }

        const isClickable = tag === 'button' || tag === 'a' || tag === 'label' || el.hasAttribute('onclick') || idClass.includes('nav-item');

        if (attr.includes("setMode('viewer')") || attr.includes('setMode("viewer")') || (isClickable && text === '보기')) attach(el, 'Ctrl + ⬆️');
        else if (attr.includes('handleEditSaveClick') || (isClickable && (text === '작성' || text.includes('저장')))) attach(el, 'Ctrl + ⬇️ (또는 Ctrl+Enter)');
        else if (isClickable && (text === '추가' || text.includes('메모 추가') || text === '+ 추가')) attach(el, 'Ctrl + Enter');
        else if (attr.includes('SearchUI') || idClass.includes('search') || (isClickable && text === '검색')) attach(el, 'Shift + ` (또는 /)');
        else if (attr.includes('goToToday') || idClass.includes('date-range-text') || idClass.includes('date-display') || idClass.includes('current-date') || (isClickable && text.includes('년') && text.includes('월') && text.length < 20)) attach(el, 'Ctrl + Space');
        else if (attr.includes('quickGoogleSync') || (isClickable && text.includes('동기화'))) attach(el, 'Ctrl + Shift + Enter');
        else if ((attr.includes('moveDate') && attr.includes('-1')) || (isClickable && (text === '◀' || text === '<'))) attach(el, 'Ctrl + ⬅️');
        else if ((attr.includes('moveDate') && attr.includes('1')) || (isClickable && (text === '▶' || text === '>'))) attach(el, 'Ctrl + ➡️');
        else if (attr.includes('toggleWeekend') || (isClickable && text.includes('주말') && text.length < 15)) attach(el, 'Shift + ⬆️/⬇️');
        else if (attr.includes('toggleClass') || (isClickable && text.includes('수업') && text.length < 15 && !text.includes('삭제'))) attach(el, 'Alt + ⬆️/⬇️');
        else if ((attr.includes('setScope') && attr.includes('day')) || (isClickable && text === '하루')) attach(el, 'Shift + 1');
        else if ((attr.includes('setScope') && attr.includes('week')) || (isClickable && text === '주간')) attach(el, 'Shift + 2');
        else if ((attr.includes('setScope') && attr.includes('month')) || (isClickable && text === '월간')) attach(el, 'Shift + 3');
        else if ((attr.includes('setScope') && attr.includes('year')) || (isClickable && text === '년간')) attach(el, 'Shift + 4');
        else if ((attr.includes('setScope') && attr.includes('memo')) || (isClickable && (text === '메모' || text === '기록'))) attach(el, 'Shift + 5');
    });
}

const tooltipObserver = new MutationObserver(() => applyShortcutTooltips());
tooltipObserver.observe(document.body, { childList: true, subtree: true });

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyShortcutTooltips);
} else {
    applyShortcutTooltips();
}

window.promptOfflineSync = async (viewInstance, renderMethod) => {
    if (window.isAutoSyncing) return true;
    window.isAutoSyncing = true;

    const toastId = 'auto-sync-toast';
    let existingToast = document.getElementById(toastId);
    if (existingToast) existingToast.remove();

    const toast = document.createElement('div');
    toast.id = toastId;
    toast.style.cssText = "position:fixed; top:20px; left:50%; transform:translateX(-50%); background:#3b82f6; color:white; padding:12px 24px; border-radius:8px; z-index:10000; box-shadow:0 4px 12px rgba(0,0,0,0.15); font-weight:bold; font-size:0.95rem; display:flex; align-items:center; gap:8px;";
    toast.innerHTML = `<div style="width:16px; height:16px; border:3px solid white; border-top-color:transparent; border-radius:50%; animation:spin 1s linear infinite;"></div> 기기에 데이터가 없어 클라우드에서 자동으로 불러옵니다... <style>@keyframes spin { 100% { transform:rotate(360deg); } }</style>`;
    document.body.appendChild(toast);

    try {
        if (window.toggleNetworkMode) window.toggleNetworkMode('online');
        await new Promise(r => setTimeout(r, 1500)); 
        
        if (window.executeManualSync) {
            await window.executeManualSync(); 
        } else {
            throw new Error("동기화 기능 없음");
        }
        
        toast.style.background = '#059669';
        toast.innerHTML = "✅ 데이터를 성공적으로 불러왔습니다.";
        setTimeout(() => toast.remove(), 2500);
        
        window.isAutoSyncing = false;
        
        if (viewInstance && renderMethod) {
            viewInstance[renderMethod]();
        }
        return true; 

    } catch (e) {
        console.error("데이터 불러오기 실패:", e);
        
        toast.style.background = '#ef4444';
        toast.innerHTML = "⚠️ 오프라인 상태입니다. 빈 페이지로 엽니다.";
        setTimeout(() => toast.remove(), 3000);
        
        if (window.toggleNetworkMode) window.toggleNetworkMode('online'); 
        
        window.isAutoSyncing = false;
        return false; 
    }
};
