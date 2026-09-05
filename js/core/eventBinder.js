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
};