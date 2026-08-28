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

// 🌟 다운로드 안내 팝업 공통 함수 추가
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
    
    // 💡 추가됨: 공유 그룹 일정 삭제 팝업 함수 전역 바인딩 오류 방지
    showGroupDeleteModal: (...args) => {
        if (window.EventManager && typeof window.EventManager.showGroupDeleteModal === 'function') {
            return window.EventManager.showGroupDeleteModal(...args);
        }
        // 만약 EventManager에 없다면 기본 삭제 확인 창으로 안전하게 대체
        if (confirm("이 일정을 삭제하시겠습니까?")) {
            if (typeof args[4] === 'function') args[4](); // 성공 콜백 실행
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
// 📜 보기 모드 한정: 상하 스크롤 끝단 자동 페이지 이동 로직 (메모 페이지 제외 완벽 대응)
// ==========================================================================

// 가로 스와이프를 무조건 '탭 이동'으로 강제 고정
localStorage.setItem('workCalendar_swipeMode', 'tab');

let scrollNavTimeout = null;
let blockWheelTimer = null;

// 위/아래 경계를 각각 독립적으로 기억하도록 수정
let startedAtTop = false;
let startedAtBottom = false;

let touchStartY = 0;
let touchStartedAtTop = false;
let touchStartedAtBottom = false;

// 1. 마우스 휠 스크롤 이벤트 (PC 환경)
window.addEventListener('wheel', (e) => {
    // 💡 수정됨: 뷰어 모드가 아니거나, 메모 페이지이거나, 모달창이 열려있으면 작동하지 않음
    if (store.mode !== 'viewer' || store.scope === 'memo' || document.querySelector('.modal-overlay:not(.hidden)')) return;
    if (scrollNavTimeout) return;

    const scrollHeight = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
    const currentScroll = Math.ceil(window.innerHeight + window.scrollY);
    
    const atBottom = currentScroll >= scrollHeight - 10;
    const atTop = window.scrollY <= 10;

    // 새로운 휠 동작이 시작될 때 위/아래 각각의 닿음 여부를 독립적으로 기록
    if (!blockWheelTimer) {
        startedAtTop = atTop;
        startedAtBottom = atBottom;
    }

    if (blockWheelTimer) clearTimeout(blockWheelTimer);
    blockWheelTimer = setTimeout(() => { blockWheelTimer = null; }, 150);

    // 스크롤 방향과 최초 시작 경계가 일치할 때만 작동
    if (atBottom && e.deltaY > 0 && startedAtBottom) {
        executeScrollNav(1);
    } else if (atTop && e.deltaY < 0 && startedAtTop) {
        executeScrollNav(-1);
    }
});

// 2. 터치 스와이프 이벤트 (스마트폰/태블릿 환경)
window.addEventListener('touchstart', (e) => {
    touchStartY = e.touches[0].clientY;
    
    const scrollHeight = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
    const currentScroll = Math.ceil(window.innerHeight + window.scrollY);
    
    // 터치 시작 시 위/아래 경계 여부를 각각 기록
    touchStartedAtTop = window.scrollY <= 10;
    touchStartedAtBottom = currentScroll >= scrollHeight - 10;
}, { passive: true });

window.addEventListener('touchend', (e) => {
    // 💡 수정됨: 뷰어 모드가 아니거나, 메모 페이지이거나, 모달창이 열려있으면 작동하지 않음
    if (store.mode !== 'viewer' || store.scope === 'memo' || document.querySelector('.modal-overlay:not(.hidden)')) return;
    if (scrollNavTimeout) return;

    const touchEndY = e.changedTouches[0].clientY;
    const deltaY = touchStartY - touchEndY; 

    const scrollHeight = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
    const currentScroll = Math.ceil(window.innerHeight + window.scrollY);
    
    const atBottom = currentScroll >= scrollHeight - 10;
    const atTop = window.scrollY <= 10;

    if (atBottom && deltaY > 50 && touchStartedAtBottom) {
        executeScrollNav(1);
    } else if (atTop && deltaY < -50 && touchStartedAtTop) {
        executeScrollNav(-1);
    }
});

function executeScrollNav(direction) {
    if (window.moveDate) {
        window.moveDate(direction); 
        // 페이지가 연달아 넘어가는 것을 방지하는 쿨타임
        scrollNavTimeout = setTimeout(() => { scrollNavTimeout = null; }, 800); 
    }
}
