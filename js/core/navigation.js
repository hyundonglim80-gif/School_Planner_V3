// js/core/navigation.js
import { store } from './store.js';
import { formatDate } from './utils.js';
import { updateTitle, render, saveCurrentViewData, scrollToTodayIfExist, updateButtonUI } from '../ui/uiManager.js';

const toggleState = (key) => {
    if (store.mode === 'editor' && store.hasUnsavedChanges) saveCurrentViewData(true);
    store[key] = !store[key]; 
    render();
};

export const toggleWeekend = () => toggleState('showWeekend');
export const toggleClass = () => toggleState('showClass');

export const updateDateFromScroll = () => {
    if (store.scope === 'memo' || store.scope === 'day') return;
    
    let dateElements = [];
    if (store.scope === 'year') {
        dateElements = Array.from(document.querySelectorAll('tr[data-year-date], .year-grid div[onclick^="window.goToDay"]'));
    } else if (store.scope === 'month') {
        dateElements = Array.from(document.querySelectorAll('tr[data-month-date], .cal-day > div[onclick^="window.goToDay"]'));
    } else if (store.scope === 'week') {
        dateElements = Array.from(document.querySelectorAll('tr[data-week-date], .clean-viewer-board tr > td:first-child span[onclick^="window.goToDay"]'));
    }
    
    if (dateElements.length > 0) {
        const headerOffset = document.querySelector('.app-header')?.offsetHeight || 150;
        let closestEl = null;
        let minDistance = Infinity;

        for (let el of dateElements) {
            const rect = el.getBoundingClientRect();
            if (rect.width === 0 && rect.height === 0) continue; 
            
            const distance = Math.abs(rect.top - headerOffset);
            if (distance < minDistance && rect.bottom > headerOffset) {
                minDistance = distance;
                closestEl = el;
            }
        }

        if (closestEl) {
            let targetDateStr = closestEl.getAttribute('data-year-date') || closestEl.getAttribute('data-month-date') || closestEl.getAttribute('data-week-date');
            
            if (!targetDateStr) {
                const onclickAttr = closestEl.getAttribute('onclick');
                if (onclickAttr) {
                    const match = onclickAttr.match(/goToDay\('([^']+)'\)/);
                    if (match) targetDateStr = match[1];
                }
            }
            
            if (targetDateStr) {
                const parts = targetDateStr.split('-');
                store.currentDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
            }
        }
    }
};

export const setScope = (scope) => {
    if (store.mode === 'editor' && store.hasUnsavedChanges) saveCurrentViewData(true);
    store.scope = scope;
    localStorage.setItem('workCalendar_scope', scope);
    
    const defaultModes = { year: 'viewer', month: 'viewer', week: 'viewer', day: 'viewer', memo: 'viewer' };
    store.mode = localStorage.getItem(`workCalendar_mode_${scope}`) || defaultModes[scope] || 'viewer';
    localStorage.setItem('workCalendar_mode', store.mode);

    const savedDate = localStorage.getItem(`workCalendar_date_${scope}`);
    if (savedDate) store.currentDate = new Date(savedDate);
    else store.currentDate = new Date(); 

    render(false); 
};

export const setMode = (mode) => {
    if (store.mode === 'editor' && mode === 'viewer' && store.hasUnsavedChanges) saveCurrentViewData(true);
    store.mode = mode;
    localStorage.setItem(`workCalendar_mode_${store.scope}`, mode);
    localStorage.setItem('workCalendar_mode', mode); 
    if (mode === 'viewer') store.hasUnsavedChanges = false;
    render(false);
};

export const handleEditSaveClick = () => { store.mode === 'viewer' ? setMode('editor') : saveCurrentViewData(false); };

export const moveDate = (dir) => {
    if (store.mode === 'editor' && store.hasUnsavedChanges) saveCurrentViewData(true);
    const d = store.currentDate;
    
    if (store.scope === 'day') {
        d.setDate(d.getDate() + dir);
        if (!store.showWeekend) {
            const dayOfWeek = d.getDay();
            if (dir > 0 && dayOfWeek === 6) { d.setDate(d.getDate() + 2); }
            else if (dir > 0 && dayOfWeek === 0) { d.setDate(d.getDate() + 1); }
            else if (dir < 0 && dayOfWeek === 0) { d.setDate(d.getDate() - 2); }
            else if (dir < 0 && dayOfWeek === 6) { d.setDate(d.getDate() - 1); }
        }
    } 
    else if (store.scope === 'week') d.setDate(d.getDate() + (dir * 7));
    else if (store.scope === 'month') {
        const currentDay = d.getDate();
        d.setMonth(d.getMonth() + dir);
        if (d.getDate() < currentDay) d.setDate(0); 
    } 
    else if (store.scope === 'year') d.setFullYear(d.getFullYear() + dir);

    if (store.scope !== 'memo') localStorage.setItem(`workCalendar_date_${store.scope}`, store.currentDate.toISOString());
    render();
};

export const goToToday = () => {
    if (store.mode === 'editor' && store.hasUnsavedChanges && window.saveCurrentViewData) window.saveCurrentViewData(true);
    
    store.currentDate = new Date();
    const todayStr = formatDate(store.currentDate);
    const y = store.currentDate.getFullYear();
    const m = String(store.currentDate.getMonth() + 1).padStart(2, '0');

    if (store.scope !== 'memo') localStorage.setItem(`workCalendar_date_${store.scope}`, store.currentDate.toISOString());
    updateTitle();

    let targetExists = false;
    if (store.scope === 'week') targetExists = !!document.querySelector(`tr[data-week-date="${todayStr}"]`);
    else if (store.scope === 'month') targetExists = !!document.querySelector(`tr[data-month-date="${todayStr}"]`) || !!document.querySelector(`.cal-day.month-today-cell`);
    else if (store.scope === 'year') {
        if (store.mode === 'editor') targetExists = !!document.querySelector(`tr[data-year-date^="${y}-${m}"]`);
        else targetExists = !!document.querySelector(`.year-today-card`);
    }

    if (targetExists && store.scope !== 'day') scrollToTodayIfExist();
    else render(true); 
};

export const toggleSwipeMode = () => {
    let mode = localStorage.getItem('workCalendar_swipeMode') || 'date';
    mode = mode === 'date' ? 'scope' : 'date';
    localStorage.setItem('workCalendar_swipeMode', mode);
    updateButtonUI();
    alert(`스와이프 동작이 '${mode === 'date' ? '이전/다음 날짜 이동' : '메모/년간/월간/주간/하루 화면 이동'}'(으)로 변경되었습니다.`);
};

export const goToDay = (dateStr) => {
    if (store.mode === 'editor' && store.hasUnsavedChanges && window.saveCurrentViewData) window.saveCurrentViewData(true);
    if (!dateStr) return;

    if (store.scope === 'day') {
        store.currentDate = new Date(dateStr);
        store.mode = 'editor';
        const modeToggle = document.getElementById('mode-toggle') || document.querySelector('input[type="checkbox"]');
        if (modeToggle) modeToggle.checked = true;
        if (window.render) window.render(); 
        return;
    }

    store.currentDate = new Date(dateStr); 
    const html = `
        <div id="day-modal-body" style="max-height: 75vh; overflow-y: auto; overflow-x: hidden; padding: 10px; background: #f8fafc; border-radius: 8px;">
            <div style="text-align:center; padding:40px; color:#64748b; font-weight:bold;">에디터를 불러오는 중...</div>
        </div>
        <div style="margin-top: 15px; display: flex; justify-content: flex-end; gap: 10px; padding-top: 15px; border-top: 1px solid #e2e8f0;">
            <button id="day-modal-cancel-btn" style="background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; padding: 10px 20px; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 1rem; transition: 0.2s;">취소</button>
            <button id="day-modal-save-btn" style="background: #2563eb; color: #fff; border: none; padding: 10px 20px; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 1rem; transition: 0.2s;">💾 저장 및 닫기</button>
        </div>
    `;

    const dayModal = new window.Modal({
        id: 'day-editor-modal',
        title: `📝 ${dateStr} 일정 및 기록 작성`,
        width: '1100px',
        content: html,
        onClose: () => {
            if (window.dayViewInstance) window.dayViewInstance.container = document.getElementById("main-view");
            if (window.render) window.render(); 
        }
    });

    dayModal.open();

    setTimeout(() => {
        const modalContainer = document.getElementById('day-modal-body');
        if (modalContainer) {
            const modalHeader = modalContainer.closest('.modal-content')?.querySelector('.modal-header');
            const closeBtn = modalHeader?.querySelector('button');
            if (closeBtn && !document.getElementById('btn-pin-day')) {
                let btnWrapper = closeBtn.parentNode;
                if (btnWrapper === modalHeader) {
                    btnWrapper = document.createElement('div');
                    btnWrapper.style.display = 'flex'; btnWrapper.style.alignItems = 'center';
                    modalHeader.insertBefore(btnWrapper, closeBtn);
                    btnWrapper.appendChild(closeBtn);
                }
                
                const pinBtn = document.createElement('button');
                pinBtn.id = 'btn-pin-day'; pinBtn.innerHTML = '📌';
                pinBtn.title = '팝업창을 닫고 하루(기본) 페이지 전체화면으로 엽니다.';
                pinBtn.style.cssText = 'background:none; border:none; font-size:1.3rem; cursor:pointer; margin-right:12px; transition:transform 0.2s; display:flex; align-items:center; justify-content:center;';
                pinBtn.onmouseover = () => pinBtn.style.transform = 'scale(1.2)';
                pinBtn.onmouseout = () => pinBtn.style.transform = 'scale(1)';
                
                pinBtn.onclick = async () => {
                    // 💡 변경됨: 핀 버튼 누를 때도 이월 엔진 작동
                    if (store.hasUnsavedChanges && window.dayViewInstance) { 
                        pinBtn.innerHTML = '⏳'; 
                        await window.dayViewInstance.save(); 
                        if (window.autoForwardIncompleteEvents) await window.autoForwardIncompleteEvents();
                    }
                    store.hasUnsavedChanges = false; dayModal.close();
                    localStorage.setItem('workCalendar_date_day', store.currentDate.toISOString());
                    if (window.setScope) window.setScope('day');
                };
                btnWrapper.insertBefore(pinBtn, closeBtn);
            }
        }

        if (modalContainer && window.dayViewInstance) {
            const prevMode = store.mode;
            store.mode = 'editor';
            window.dayViewInstance.container = modalContainer;
            window.dayViewInstance.renderEditor().then(() => { store.mode = prevMode; });
        }

        document.getElementById('day-modal-save-btn').onclick = async () => {
            if (window.dayViewInstance) {
                try {
                    const btn = document.getElementById('day-modal-save-btn');
                    btn.innerHTML = '💾 저장 중...'; btn.style.opacity = '0.7';
                    await window.dayViewInstance.save();
                    // 💡 변경됨: 팝업창에서 저장할 때도 완벽하게 이월 엔진 작동
                    if (window.autoForwardIncompleteEvents) await window.autoForwardIncompleteEvents();
                    store.hasUnsavedChanges = false;
                    dayModal.close();
                } catch (err) {
                    console.error("저장 중 에러 발생:", err);
                    alert("저장 중 오류가 발생했습니다: " + err.message);
                    document.getElementById('day-modal-save-btn').innerHTML = '💾 저장 및 닫기';
                    document.getElementById('day-modal-save-btn').style.opacity = '1';
                }
            } else { dayModal.close(); }
        };
        
        document.getElementById('day-modal-cancel-btn').onclick = () => { store.hasUnsavedChanges = false; dayModal.close(); };
    }, 100);
};
