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

// 💡 [핵심 해결] PWA 설치 앱에서 구버전 캐시로 인해 로딩이 멈추는 현상을 막기 위한 서비스 워커 강제 차단 및 캐시 청소
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

// ==========================================================================
// 💡 앱 초기화 및 접속 환경(PWA/브라우저)에 따른 네트워크 기본 모드 설정
// ==========================================================================
const applyEnvironmentNetworkMode = () => {
    // 1. PWA(설치된 앱) 상태인지 감지 (PC/모바일 공통 및 iOS Safari 대응)
    const isPWA = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    
    // 2. PWA면 오프라인, 브라우저면 온라인으로 모드 강제 적용
    if (window.toggleNetworkMode) {
        window.toggleNetworkMode(isPWA ? 'offline' : 'online');
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { 
        initAppEvents(); 
        initAuthListener(); 
        applyEnvironmentNetworkMode(); // 환경 감지 함수 실행
    });
} else {
    initAppEvents(); 
    initAuthListener();
    applyEnvironmentNetworkMode(); // 환경 감지 함수 실행
}

// ==========================================================================
// 📜 상하 스와이프 및 키보드 단축키 페이지 이동 로직
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

    if (Math.abs(deltaX) > Math.abs(deltaY)) {
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
    const tag = e.target.tagName.toLowerCase();
    const isInput = tag === 'input' || tag === 'textarea' || e.target.isContentEditable;
    
    if (!isInput) {
        if (e.ctrlKey && e.shiftKey && !e.altKey) {
            if (e.key === 'Enter') { e.preventDefault(); if (window.quickGoogleSync) window.quickGoogleSync(); }
        }
        else if (e.ctrlKey && !e.shiftKey && !e.altKey) {
            if (e.key === 'Enter') { 
                e.preventDefault(); 
                // 💡 [추가됨] 메모 페이지일 때는 '추가' 버튼을 클릭하게 하고, 그 외에는 저장(handleEditSaveClick) 작동
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

// ==========================================================================
// 4. 🚀 초고속 반투명 커스텀 툴팁 (깔끔한 한 줄 노란색 표시)
// ==========================================================================
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
        // 💡 [추가됨] 메모 페이지의 '추가' 버튼 단축키 알림 매칭
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

// ==========================================================================
// 💡 오프라인 캐시 누락 시 동기화 선택 팝업 공통 처리 함수
// ==========================================================================
window.promptOfflineSync = async (viewInstance, renderMethodName) => {
    const userChoice = await new Promise(resolve => {
        const modalId = 'cache-error-modal';
        const html = `
            <div style="padding: 20px; text-align: center;">
                <p style="font-size: 1.05rem; color: #334155; margin-bottom: 25px; line-height: 1.5;">
                    현재 기기(캐시)에 이 화면의 오프라인 데이터가 없습니다.<br>
                    <b>클라우드와 동기화하여 데이터를 불러오시겠습니까?</b>
                </p>
                <div style="display: flex; gap: 10px; justify-content: center;">
                    <button id="btn-cache-cancel" class="modal-btn-secondary" style="background:#f1f5f9; color:#475569; padding: 10px 20px; border-radius: 6px; font-weight: bold; border: none; cursor: pointer;">빈 페이지로 계속</button>
                    <button id="btn-cache-sync" data-shortcut-added="true" class="modal-btn-primary" style="background:#2563eb; color:#fff; padding: 10px 20px; border-radius: 6px; font-weight: bold; border: none; cursor: pointer;">온라인 동기화 진행</button>
                </div>
            </div>
        `;
        let existingModal = document.getElementById(modalId);
        if (existingModal) existingModal.remove();
        
        const modal = new window.Modal({ id: modalId, title: '⚠️ 오프라인 데이터 없음', width: '400px', content: html });
        modal.open();

        document.getElementById('btn-cache-cancel').onclick = () => { modal.close(); resolve('cancel'); };
        document.getElementById('btn-cache-sync').onclick = () => { modal.close(); resolve('sync'); };
    });

    if (userChoice === 'sync') {
        if (!navigator.onLine) {
            alert("기기가 인터넷에 연결되어 있지 않습니다. 와이파이 연결을 확인해주세요.");
            return true; 
        }
        if (viewInstance && viewInstance.showLoading) {
            viewInstance.showLoading('클라우드에서 데이터를 동기화 중입니다...');
        }
        try {
            if (window.setNetworkOnline) await window.setNetworkOnline();
            await new Promise(r => setTimeout(r, 1000)); 
            if (viewInstance && typeof viewInstance[renderMethodName] === 'function') {
                await viewInstance[renderMethodName](); 
            }
        } finally {
            if (window.setNetworkOffline && localStorage.getItem('workCalendar_offlineMode') === 'true') {
                await window.setNetworkOffline();
            }
        }
        return true; // 동기화를 정상적으로 진행했음
    }
    return false; // 취소를 눌러 빈 페이지로 계속 진행함
};
