// js/core/eventBinder.js
import { store } from './store.js';
import { setMode, setScope, toggleWeekend, toggleClass, moveDate, goToToday, updateDateFromScroll } from './navigation.js';
import { toggleNetworkMode, executeManualSync } from './networkManager.js';
import { saveCurrentViewData, updateTitle, render } from '../ui/uiManager.js';

export const initAppEvents = () => {
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
        btn.addEventListener('click', (e) => setScope(e.target.getAttribute('data-scope')));
    });

    let scrollDebounce = null;
    document.addEventListener('scroll', () => {
        if (store.scope === 'memo' || store.scope === 'day') return;
        if (document.getElementById('day-modal-body')) return; 
        clearTimeout(scrollDebounce);
        scrollDebounce = setTimeout(() => {
            const prevTime = store.currentDate.getTime();
            updateDateFromScroll();
            if (store.currentDate.getTime() !== prevTime) {
                updateTitle();
                if (store.scope && store.scope !== 'memo') localStorage.setItem(`workCalendar_date_${store.scope}`, store.currentDate.toISOString());
            }
        }, 200);
    }, { passive: true, capture: true });

    const markUnsaved = () => { 
        const isDayModalOpen = !!document.getElementById('day-modal-body');
        if (store.mode === 'editor' || isDayModalOpen) {
            store.hasUnsavedChanges = true; 
        }
    };
    document.addEventListener('input', markUnsaved);
    document.addEventListener('change', markUnsaved);

    window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); window.deferredPrompt = e; const installBtn = document.getElementById('btn-install-pwa'); if (installBtn) installBtn.style.display = 'block'; });
    window.addEventListener('beforeunload', () => { if (store.mode === 'editor' && store.hasUnsavedChanges) saveCurrentViewData(true); });
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === 'hidden' && store.mode === 'editor' && store.hasUnsavedChanges) saveCurrentViewData(true); });

    const appTitle = document.getElementById('app-title');
    window.addEventListener('offline', () => { if (appTitle) appTitle.innerHTML = 'SP3.7 <span style="font-size:0.8rem; color:#ef4444; background:#fee2e2; padding:3px 8px; border-radius:12px; vertical-align:middle; margin-left:8px;">⚡ 끊김</span>'; });
    window.addEventListener('online', () => { if (appTitle) { appTitle.innerHTML = 'SP3.7 <span style="font-size:0.8rem; color:#10b981; background:#dcfce7; padding:3px 8px; border-radius:12px; vertical-align:middle; margin-left:8px;">🌐 복구됨</span>'; setTimeout(() => { appTitle.innerHTML = 'SP3.7'; }, 3000); } });

    function applyDefaultMode(newScope) {
        let isModeChanged = false;
        const defaultModes = { year: 'viewer', month: 'viewer', week: 'editor', day: 'editor', memo: 'viewer' };
        const targetMode = localStorage.getItem(`workCalendar_mode_${newScope}`) || defaultModes[newScope] || 'viewer';
        if (store.mode !== targetMode) { store.mode = targetMode; isModeChanged = true; }
        if (isModeChanged) {
            const modeToggle = document.getElementById('mode-toggle') || document.querySelector('input[type="checkbox"]');
            if (modeToggle && modeToggle.checked !== undefined) modeToggle.checked = (store.mode === 'editor');
        }
        return isModeChanged;
    }

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
    }, true); 

    let lastScope = store.scope;
    document.addEventListener('keydown', (e) => {
        const isInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable;
        if (!isInput && e.shiftKey && !e.ctrlKey && !e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
            e.preventDefault(); e.stopImmediatePropagation(); 
            const scopes = ['day', 'week', 'month', 'year', 'memo'];
            let currentIndex = scopes.indexOf(store.scope);
            if (e.key === 'ArrowLeft') currentIndex = (currentIndex - 1 + scopes.length) % scopes.length;
            else if (e.key === 'ArrowRight') currentIndex = (currentIndex + 1) % scopes.length;
            if (window.setScope) window.setScope(scopes[currentIndex]);
        }
        if (e.ctrlKey && !e.shiftKey && !e.altKey) {
            if (e.code === 'Space') { 
                e.preventDefault(); e.stopImmediatePropagation();
                goToToday();
                return;
            }
            
            // 🌟 [수정] Ctrl + Enter 저장 단축키 로직 추가
            if (e.key === 'Enter') {
                // 메모 뷰에서 "새 메모 추가"에 사용되는 단축키일 경우 저장 기능을 덮어씌우지 않고 양보함
                if (e.target.id === 'memo-input-text') return;
                
                e.preventDefault(); e.stopImmediatePropagation();
                const editorBtn = document.getElementById('btn-mode-editor');
                if (editorBtn) editorBtn.click(); // '저장' 버튼을 누른 것과 동일하게 동작
                return;
            }
            
            let targetScope = null;
            if (e.key === '1') targetScope = 'day';
            else if (e.key === '2') targetScope = 'week';
            else if (e.key === '3') targetScope = 'month';
            else if (e.key === '4') targetScope = 'year';
            else if (e.key === '5') targetScope = 'memo';
            else if (e.key === '`' || e.code === 'Backquote') { e.preventDefault(); e.stopImmediatePropagation(); if (window.openSearchModal) window.openSearchModal(); }
            if (targetScope) { e.preventDefault(); e.stopImmediatePropagation(); if (window.setScope) window.setScope(targetScope); }
        }
        setTimeout(() => {
            if (store.scope !== lastScope) {
                const modeChanged = applyDefaultMode(store.scope);
                lastScope = store.scope;
                if (modeChanged && typeof window.render === 'function') window.render(); 
            }
        }, 20);
    }, true);
    document.addEventListener('mouseup', () => { lastScope = store.scope; });
};