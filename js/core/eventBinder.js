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

    let autoSaveTimer = null;
    const markUnsaved = () => { 
        const isDayModalOpen = !!document.getElementById('day-modal-body');
        if (store.mode === 'editor' || isDayModalOpen) {
            store.hasUnsavedChanges = true; 
            clearTimeout(autoSaveTimer); 
            autoSaveTimer = setTimeout(() => {
                if (store.hasUnsavedChanges) {
                    if (isDayModalOpen && window.dayViewInstance) {
                        try { window.dayViewInstance.save().then(() => store.hasUnsavedChanges = false).catch(e => console.warn("팝업 저장 경고:", e)); } 
                        catch(e) { console.error("팝업 자동 저장 중 오류:", e); }
                    } else saveCurrentViewData(false);
                }
            }, 800);
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
                if (modeChanged && typeof window.render === 'function') window.render(true);
            }
        }, 20);
    }, true);
    document.addEventListener('mouseup', () => { lastScope = store.scope; });
};