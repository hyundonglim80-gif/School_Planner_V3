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
// 📜 상하 스와이프 및 키보드 단축키 페이지 이동 로직 (완전 맞춤형)
// ==========================================================================

localStorage.setItem('workCalendar_swipeMode', 'tab');

// 🛑 [버그 수정 2] 모바일에서 맨 위에서 아래로 스와이프 시 '당겨서 새로고침'되는 현상 완벽 차단!
const preventRefreshStyle = document.createElement('style');
preventRefreshStyle.innerHTML = `
    html, body {
        overscroll-behavior-y: none;
    }
`;
document.head.appendChild(preventRefreshStyle);

let scrollNavTimeout = null;
let blockWheelTimer = null;
let startedAtTop = false;
let startedAtBottom = false;

let touchStartX = 0;
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
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    
    const scrollHeight = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
    const currentScroll = Math.ceil(window.innerHeight + window.scrollY);
    
    touchStartedAtTop = window.scrollY <= 10;
    touchStartedAtBottom = currentScroll >= scrollHeight - 10;
}, { passive: true });

window.addEventListener('touchend', (e) => {
    if (store.mode !== 'viewer' || document.querySelector('.modal-overlay:not(.hidden)')) return;
    if (scrollNavTimeout) return;

    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    
    const deltaX = touchStartX - touchEndX;
    const deltaY = touchStartY - touchEndY; 

    // 🛑 [버그 수정 1] 상하(날짜 이동) 스와이프와 좌우(페이지 전환) 스와이프 각도 구별하여 처리
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
        // 좌우 스와이프 (화면 Scope 전환)
        if (Math.abs(deltaX) > 50) {
            const scopes = ['day', 'week', 'month', 'year', 'memo'];
            const currentIdx = scopes.indexOf(store.scope);
            if (currentIdx !== -1 && window.setScope) {
                // 왼쪽으로 스와이프하면 다음 페이지, 오른쪽으로 스와이프하면 이전 페이지
                let nextIdx = deltaX > 0 ? currentIdx + 1 : currentIdx - 1;
                if (nextIdx < 0) nextIdx = scopes.length - 1;
                if (nextIdx >= scopes.length) nextIdx = 0;
                window.setScope(scopes[nextIdx]);
            }
        }
    } else {
        // 상하 스와이프 (이전/다음 날짜 이동)
        if (store.scope === 'memo') return; // 메모는 상하 이동 없음

        const scrollHeight = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
        const currentScroll = Math.ceil(window.innerHeight + window.scrollY);
        const atBottom = currentScroll >= scrollHeight - 10;
        const atTop = window.scrollY <= 10;

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
// 3. 💡 맞춤형 키보드 단축키 이벤트 세트
// ==========================================================================
window.addEventListener('keydown', (e) => {
    const tag = e.target.tagName.toLowerCase();
    const isInput = tag === 'input' || tag === 'textarea' || e.target.isContentEditable;
    
    if (!isInput) {
        // [A] Ctrl + Shift 조합
        if (e.ctrlKey && e.shiftKey && !e.altKey) {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (window.quickGoogleSync) window.quickGoogleSync();
            }
        }
        // [B] Ctrl 전용 조합
        else if (e.ctrlKey && !e.shiftKey && !e.altKey) {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (window.handleEditSaveClick) window.handleEditSaveClick();
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault(); 
                if (window.moveDate) window.moveDate(-1);
            } else if (e.key === 'ArrowRight') {
                e.preventDefault(); 
                if (window.moveDate) window.moveDate(1);
            } else if (e.key === 'ArrowUp') { 
                e.preventDefault();
                if (window.setMode) window.setMode('viewer');
            } else if (e.key === 'ArrowDown') { 
                e.preventDefault();
                if (window.handleEditSaveClick) window.handleEditSaveClick();
            } else if (e.code === 'Space') { 
                e.preventDefault();
                if (window.goToToday) window.goToToday();
            }
        }
        // [C] Shift 전용 조합
        else if (e.shiftKey && !e.ctrlKey && !e.altKey) {
            if (e.key === '`' || e.key === '~') {
                e.preventDefault(); 
                const searchBtn = document.querySelector('[onclick*="SearchUI"]') || document.querySelector('#btn-search') || Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('검색'));
                if (searchBtn) searchBtn.click();
            }
            else if (e.key === '1' || e.key === '!') { e.preventDefault(); if (window.setScope) window.setScope('day'); }
            else if (e.key === '2' || e.key === '@') { e.preventDefault(); if (window.setScope) window.setScope('week'); }
            else if (e.key === '3' || e.key === '#') { e.preventDefault(); if (window.setScope) window.setScope('month'); }
            else if (e.key === '4' || e.key === '$') { e.preventDefault(); if (window.setScope) window.setScope('year'); }
            else if (e.key === '5' || e.key === '%') { e.preventDefault(); if (window.setScope) window.setScope('memo'); }
            else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { 
                e.preventDefault();
                if (window.toggleWeekend) window.toggleWeekend();
            }
        }
        // [D] Alt 전용 조합
        else if (e.altKey && !e.ctrlKey && !e.shiftKey) {
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                e.preventDefault();
                if (window.toggleClass) window.toggleClass();
            }
        }
    }
});

// ==========================================================================
// 4. 🚀 초고속 반투명 커스텀 툴팁 (단축키 표시 자동화)
// ==========================================================================

const tooltipStyle = document.createElement('style');
tooltipStyle.innerHTML = `
    #sp3-custom-tooltip {
        position: fixed;
        background: rgba(30, 41, 59, 0.85);
        color: #f8fafc;
        padding: 8px 12px;
        border-radius: 8px;
        font-size: 0.85rem;
        font-weight: bold;
        pointer-events: none;
        z-index: 100000;
        opacity: 0;
        transform: translateY(5px) scale(0.95);
        transition: opacity 0.15s ease-out, transform 0.15s ease-out;
        white-space: pre-wrap;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
        text-align: center;
        line-height: 1.4;
    }
    #sp3-custom-tooltip.show {
        opacity: 1;
        transform: translateY(0) scale(1);
    }
`;
document.head.appendChild(tooltipStyle);

const customTooltipEl = document.createElement('div');
customTooltipEl.id = 'sp3-custom-tooltip';
document.body.appendChild(customTooltipEl);

let tooltipTimeout;
document.body.addEventListener('mouseover', (e) => {
    const target = e.target.closest('[data-tooltip]');
    if (target) {
        clearTimeout(tooltipTimeout);
        tooltipTimeout = setTimeout(() => {
            customTooltipEl.innerHTML = target.getAttribute('data-tooltip');
            const rect = target.getBoundingClientRect();
            
            let top = rect.bottom + 8;
            let left = rect.left + (rect.width / 2) - (customTooltipEl.offsetWidth / 2);

            if (top + customTooltipEl.offsetHeight > window.innerHeight - 10) top = rect.top - customTooltipEl.offsetHeight - 8;
            if (left < 10) left = 10;
            if (left + customTooltipEl.offsetWidth > window.innerWidth - 10) left = window.innerWidth - customTooltipEl.offsetWidth - 10;

            customTooltipEl.style.top = `${top}px`;
            customTooltipEl.style.left = `${left}px`;
            customTooltipEl.classList.add('show');
        }, 50); 
    }
});

// 🛑 [버그 수정 3] 버튼 클릭(터치) 시 툴팁 즉시 숨기기 (모바일 잔상 완벽 제거)
const hideTooltip = (e) => {
    const target = e.target.closest('[data-tooltip]');
    if (target || e.type === 'click' || e.type === 'touchstart') {
        clearTimeout(tooltipTimeout);
        customTooltipEl.classList.remove('show');
    }
};

document.body.addEventListener('mouseout', hideTooltip);
document.body.addEventListener('click', hideTooltip);
document.body.addEventListener('touchstart', hideTooltip, { passive: true });

function applyShortcutTooltips() {
    const attach = (el, shortcutText) => {
        if (!el || el.hasAttribute('data-shortcut-added')) return;
        let currentTitle = (el.getAttribute('title') || '').trim();
        let newTooltipText = currentTitle 
            ? `${currentTitle}<br><span style="color:#fbbf24; font-size:0.75rem; font-weight:normal;">(단축키: ${shortcutText})</span>` 
            : `<span style="color:#fbbf24; font-size:0.75rem; font-weight:normal;">(단축키: ${shortcutText})</span>`;
        
        el.setAttribute('data-tooltip', newTooltipText);
        el.removeAttribute('title'); 
        el.setAttribute('data-shortcut-added', 'true');
    };

    document.querySelectorAll('label, button, a, div, span, h1, h2, h3, h4, [onclick], .nav-item').forEach(el => {
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
        else if (attr.includes('SearchUI') || idClass.includes('search') || (isClickable && text === '검색')) attach(el, 'Shift + `');
        else if (attr.includes('goToToday') || idClass.includes('date-display') || idClass.includes('current-date') || (isClickable && text.includes('년') && text.includes('월') && text.length < 20)) attach(el, 'Ctrl + Space');
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
