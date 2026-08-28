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
// 4. 🚀 초고속 반투명 커스텀 툴팁 (단축키 표시 자동화)
// ==========================================================================

// 4-1. 커스텀 툴팁 CSS 및 HTML 요소 주입
const tooltipStyle = document.createElement('style');
tooltipStyle.innerHTML = `
    #sp3-custom-tooltip {
        position: fixed;
        background: rgba(30, 41, 59, 0.85); /* 부드럽고 진한 반투명 배경 */
        color: #f8fafc;
        padding: 8px 12px;
        border-radius: 8px; /* 둥근 모서리 */
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

// 4-2. 마우스 오버 시 즉각 반응하는 이벤트(이벤트 위임)
let tooltipTimeout;
document.body.addEventListener('mouseover', (e) => {
    const target = e.target.closest('[data-tooltip]');
    if (target) {
        clearTimeout(tooltipTimeout);
        // 0.05초(50ms) 만에 즉시 표시되도록 설정 (체감상 딜레이 없음)
        tooltipTimeout = setTimeout(() => {
            customTooltipEl.innerHTML = target.getAttribute('data-tooltip');
            const rect = target.getBoundingClientRect();
            
            // 기본적으로 엘리먼트 아래쪽에 띄우기
            let top = rect.bottom + 8;
            let left = rect.left + (rect.width / 2) - (customTooltipEl.offsetWidth / 2);

            // 화면 밑으로 벗어나면 엘리먼트 위쪽으로 띄우기 변경
            if (top + customTooltipEl.offsetHeight > window.innerHeight - 10) {
                top = rect.top - customTooltipEl.offsetHeight - 8;
            }
            
            // 화면 좌/우 여백 확보
            if (left < 10) left = 10;
            if (left + customTooltipEl.offsetWidth > window.innerWidth - 10) {
                left = window.innerWidth - customTooltipEl.offsetWidth - 10;
            }

            customTooltipEl.style.top = `${top}px`;
            customTooltipEl.style.left = `${left}px`;
            customTooltipEl.classList.add('show');
        }, 50); 
    }
});

document.body.addEventListener('mouseout', (e) => {
    const target = e.target.closest('[data-tooltip]');
    if (target) {
        clearTimeout(tooltipTimeout);
        customTooltipEl.classList.remove('show');
    }
});

// 4-3. 앱 내 버튼들에 툴팁 데이터 입히기 로직
function applyShortcutTooltips() {
    const attach = (el, shortcutText) => {
        if (!el || el.hasAttribute('data-shortcut-added')) return;
        
        let currentTitle = (el.getAttribute('title') || '').trim();
        // 기존 title 문구 밑에 노란색 텍스트로 단축키 추가
        let newTooltipText = currentTitle 
            ? `${currentTitle}<br><span style="color:#fbbf24; font-size:0.75rem; font-weight:normal;">(단축키: ${shortcutText})</span>` 
            : `<span style="color:#fbbf24; font-size:0.75rem; font-weight:normal;">(단축키: ${shortcutText})</span>`;
        
        el.setAttribute('data-tooltip', newTooltipText);
        el.removeAttribute('title'); // 느리고 못생긴 기본 툴팁 제거
        el.setAttribute('data-shortcut-added', 'true');
    };

    const addTooltipBySelector = (selector, shortcutText) => {
        document.querySelectorAll(selector).forEach(el => attach(el, shortcutText));
    };

    // 선택자 기반 단축키 할당
    addTooltipBySelector('[onclick*="handleEditSaveClick"]', 'Ctrl + Enter');
    addTooltipBySelector('[onclick*="moveDate(-1)"]', 'Ctrl + ⬅️');
    addTooltipBySelector('[onclick*="moveDate(1)"]', 'Ctrl + ➡️');
    addTooltipBySelector('[onclick*="SearchUI"]', 'Shift + `');
    addTooltipBySelector('[onclick*="setScope(\'day\')"]', 'Shift + 1');
    addTooltipBySelector('[onclick*="setScope(\'week\')"]', 'Shift + 2');
    addTooltipBySelector('[onclick*="setScope(\'month\')"]', 'Shift + 3');
    addTooltipBySelector('[onclick*="setScope(\'year\')"]', 'Shift + 4');
    addTooltipBySelector('[onclick*="setScope(\'memo\')"]', 'Shift + 5');
    addTooltipBySelector('[onclick*="goToToday"]', 'Ctrl + Space');
    addTooltipBySelector('[onclick*="quickGoogleSync"]', 'Ctrl + Shift + Enter');
    addTooltipBySelector('[onclick*="toggleWeekend"], [onchange*="toggleWeekend"]', 'Shift + ⬆️/⬇️');
    addTooltipBySelector('[onclick*="toggleClass"], [onchange*="toggleClass"]', 'Alt + ⬆️/⬇️');

    // 💡 선택자로 잡히지 않는 '주말', '수업' 토글 버튼 강제 탐색 (글자 기반 찾기)
    document.querySelectorAll('label, button, .toggle-container').forEach(el => {
        const text = el.textContent.trim();
        if (text.includes('주말') && text.length < 15) attach(el, 'Shift + ⬆️/⬇️');
        if (text.includes('수업') && text.length < 15 && !text.includes('삭제')) attach(el, 'Alt + ⬆️/⬇️');
    });
}

// 화면이 업데이트될 때마다 툴팁 다시 스캔
const tooltipObserver = new MutationObserver(() => applyShortcutTooltips());
tooltipObserver.observe(document.body, { childList: true, subtree: true });

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyShortcutTooltips);
} else {
    applyShortcutTooltips();
}
