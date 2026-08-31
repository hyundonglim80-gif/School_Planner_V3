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

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
        for (let registration of registrations) {
            registration.unregister().then(() => {
                console.log("SP3.7: 낡은 서비스 워커 강제 해제 완료");
            });
        }
    });
    if (window.caches) {
        caches.keys().then(keys => {
            keys.forEach(key => {
                caches.delete(key);
                console.log("SP3.7: 앱 캐시 스토리지 청소 완료:", key);
            });
        });
    }
}

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
// 💡 모달창 감지 시 배경 스크롤 강제 차단 로직
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

const isModalOpen = () => {
    let modalVisible = window.activeModalCount > 0;
    
    const overlays = document.querySelectorAll('.modal-overlay, .super-alarm-overlay, #sp3-alarm-modal-overlay');
    overlays.forEach(el => {
        if (window.getComputedStyle(el).display !== 'none' && el.style.display !== 'none') {
            modalVisible = true;
        }
    });

    if (modalVisible) {
        document.body.style.overflow = 'hidden';
        return true;
    } else {
        document.body.style.overflow = ''; 
        return false;
    }
};

const modalObserver = new MutationObserver(() => isModalOpen());
modalObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] });


// ==========================================================================
// 📜 상하 스와이프 및 마우스 휠 페이지 이동 로직 (모바일 무한스크롤 완벽 대응)
// ==========================================================================
localStorage.setItem('workCalendar_swipeMode', 'tab');

// 🌟 [핵심] 모바일/터치 기기 감지
const isMobileDevice = () => /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || window.innerWidth <= 768 || ('ontouchstart' in window);

let scrollNavTimeout = null;
let blockWheelTimer = null;
let startedAtTop = false;
let startedAtBottom = false;

let touchStartX = 0;
let touchStartY = 0;
let touchStartedAtTop = false;
let touchStartedAtBottom = false;

window.addEventListener('wheel', (e) => {
    if (isModalOpen()) return; 
    
    // 무한 스크롤 상태이면 PC 마우스 휠 스크롤은 브라우저 네이티브 스크롤에 맡김 (허용)
    if (window.isInfiniteScrollActive === true || localStorage.getItem('workCalendar_infiniteScroll') === 'true') {
        return; 
    }

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
    if (isModalOpen()) return; 

    // 🌟 모바일 무한 스크롤 켜짐 상태일 때: 당겨서 새로고침(Pull-to-refresh) 원천 차단
    // touchmove 이벤트가 아닌 CSS(overscroll-behavior)를 조작하므로 네이티브 상하 스크롤이 완벽하게 보호됨
    if (isMobileDevice() && (window.isInfiniteScrollActive === true || localStorage.getItem('workCalendar_infiniteScroll') === 'true')) {
        document.documentElement.style.overscrollBehaviorY = 'none';
        document.body.style.overscrollBehaviorY = 'none';
    } else {
        document.documentElement.style.overscrollBehaviorY = 'auto';
        document.body.style.overscrollBehaviorY = 'auto';
    }

    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    
    // 무한스크롤 시 터치 초기좌표만 기억하고 패스 (스크롤 허용)
    if (window.isInfiniteScrollActive === true || localStorage.getItem('workCalendar_infiniteScroll') === 'true') {
        return; 
    }
    
    const scrollHeight = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
    const currentScroll = Math.ceil(window.innerHeight + window.scrollY);
    
    touchStartedAtTop = window.scrollY <= 10;
    touchStartedAtBottom = currentScroll >= scrollHeight - 10;
}, { passive: true });

window.addEventListener('touchend', (e) => {
    if (isModalOpen()) return; 

    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    
    const deltaX = touchStartX - touchEndX;
    const deltaY = touchStartY - touchEndY; 
    
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    // 🌟 좌우 스와이프 판정 기준 강력화 (대각선 스크롤 오작동 차단)
    // 가로로 70px 이상 밀고, Y축 이동량보다 최소 1.5배 클 때만 탭 전환으로 인정
    const isValidHorizontalSwipe = absX > 70 && absX > (absY * 1.5);

    // 🌟 무한 스크롤 켜져있을 때의 동작
    if (window.isInfiniteScrollActive === true || localStorage.getItem('workCalendar_infiniteScroll') === 'true') {
        if (isValidHorizontalSwipe) {
            // 좌우 스와이프는 탭 전환으로 인식
            const scopes = ['day', 'week', 'month', 'year', 'memo'];
            const currentIdx = scopes.indexOf(store.scope);
            if (currentIdx !== -1 && window.setScope) {
                let nextIdx = deltaX > 0 ? currentIdx + 1 : currentIdx - 1;
                if (nextIdx < 0) nextIdx = scopes.length - 1;
                if (nextIdx >= scopes.length) nextIdx = 0;
                window.setScope(scopes[nextIdx]);
            }
        }
        // 상하 스와이프(스크롤)는 네이티브 스크롤(무한 로딩)이 처리하도록 조작 없이 즉시 리턴
        return; 
    }

    // 일반(페이징) 모드
    if (store.mode !== 'viewer') return;
    if (scrollNavTimeout) return;

    if (isValidHorizontalSwipe) {
        const scopes = ['day', 'week', 'month', 'year', 'memo'];
        const currentIdx = scopes.indexOf(store.scope);
        if (currentIdx !== -1 && window.setScope) {
            let nextIdx = deltaX > 0 ? currentIdx + 1 : currentIdx - 1;
            if (nextIdx < 0) nextIdx = scopes.length - 1;
            if (nextIdx >= scopes.length) nextIdx = 0;
            window.setScope(scopes[nextIdx]);
        }
    } else if (absY > absX) { 
        // 페이징 모드에서 위아래로 밀어 페이지 통째로 넘기기
        if (store.scope === 'memo') return; 

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
    if (isModalOpen()) return; 

    const tag = e.target.tagName.toLowerCase();
    const isInput = tag === 'input' || tag === 'textarea' || e.target.isContentEditable;
    
    if (!isInput) {
        if (e.ctrlKey && e.shiftKey && !e.altKey) {
            if (e.key === 'Enter') { e.preventDefault(); if (window.quickGoogleSync) window.quickGoogleSync(); }
        }
        else if (e.ctrlKey && !e.shiftKey && !e.altKey) {
            if (e.key === 'Enter') { 
                e.preventDefault(); 
                if (store.scope === 'memo') {
                    const addBtn = Array.from(document.querySelectorAll('button, [onclick]')).find(b => b.textContent.trim().includes('추가'));
                    if (addBtn) addBtn.click();
                } else if (window.handleEditSaveClick) {
                    window.handleEditSaveClick(); 
                }
            }
            else if (e.key === 'ArrowLeft') { e.preventDefault(); if (window.moveDate) window.moveDate(-1); }
            else if (e.key === 'ArrowRight') { e.preventDefault(); if (window.moveDate) window.moveDate(1); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); if (window.setMode) window.setMode('viewer'); }
            else if (e.key === 'ArrowDown') { e.preventDefault(); if (window.handleEditSaveClick) window.handleEditSaveClick(); }
            else if (e.code === 'Space') { e.preventDefault(); if (window.goToToday) window.goToToday(); }
        }
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
            else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); if (window.toggleWeekend) window.toggleWeekend(); }
        }
        else if (e.altKey && !e.ctrlKey && !e.shiftKey) {
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); if (window.toggleClass) window.toggleClass(); }
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
        else if (attr.includes('SearchUI') || idClass.includes('search') || (isClickable && text === '검색')) attach(el, 'Shift + `');
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
