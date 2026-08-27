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
    openPeriodModal: (...args) => EventManager.openPeriodModal(...args),
    openRecurringModal: (...args) => EventManager.openRecurringModal(...args)
});

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { initAppEvents(); initAuthListener(); });
} else {
    initAppEvents(); initAuthListener();
}