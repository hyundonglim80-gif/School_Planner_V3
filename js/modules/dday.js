<<<<<<< HEAD
// js/modules/dday.js

import { store } from '../core/store.js';
import { getUserCol } from '../firebase.js';
import { doc, setDoc } from "firebase/firestore";

// 🌟 [추가됨] D-Day 기능 모듈 분리
export const toggleDdayMenu = () => {
    if (!store.dDayList?.length) return openDdaySettingsModal();
    const dropdown = document.getElementById('dday-dropdown');
    const listContainer = document.getElementById('dday-list-container');
    if (dropdown.classList.contains('hidden')) {
        listContainer.innerHTML = store.dDayList.map(dday => {
            const isSelected = dday.id === store.selectedDDayId;
            return `<button class="dropdown-item" onclick="window.selectDday('${dday.id}')" style="${isSelected ? 'background:#eff6ff; color:#2563eb;' : ''}"><span style="font-weight:bold; margin-right:8px; display:inline-block; width:50px;">${calculateDday(dday.date)}</span> ${dday.title}</button>`;
        }).join('') + (store.selectedDDayId ? `<button class="dropdown-item" onclick="window.selectDday(null)" style="color:#64748b; text-align:center;">선택 해제</button>` : '');
    }
    dropdown.classList.toggle('hidden');
};

export const selectDday = async (id) => {
    store.selectedDDayId = id;
    document.getElementById('dday-dropdown').classList.add('hidden');
    updateDdayUI();
    if (window.auth?.currentUser) {
        setDoc(doc(getUserCol('settings'), 'preferences'), { selectedDDayId: id }, { merge: true }).catch(e=>console.warn(e)); 
    }
};

export const updateDdayUI = () => {
    const btn = document.getElementById('btn-dday-display');
    if (!btn) return;
    if (!store.selectedDDayId || !store.dDayList?.length) {
        btn.textContent = "D-Day 설정"; btn.style.cssText = "color:#64748b; background-color:#f1f5f9; border-color:#cbd5e1; font-weight:bold; min-width:90px; cursor:pointer;"; 
        return;
    }
    const selected = store.dDayList.find(d => d.id === store.selectedDDayId);
    if (selected) {
        btn.textContent = `${selected.title} ${calculateDday(selected.date)}`; 
        btn.style.cssText = "color:#ef4444; background-color:#fef2f2; border-color:#fca5a5; font-weight:bold; min-width:90px; cursor:pointer;";
    }
};

export const calculateDday = (targetDateStr) => {
    const today = new Date(); today.setHours(0, 0, 0, 0); 
    const targetDate = new Date(targetDateStr); targetDate.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)); 
    return diffDays === 0 ? 'D-Day' : (diffDays > 0 ? `D-${diffDays}` : `D+${Math.abs(diffDays)}`);
};

export const openDdaySettingsModal = () => {
    document.getElementById('dday-dropdown')?.classList.add('hidden');
    document.getElementById('dday-modal')?.remove();
    const modalHtml = `<div id="dday-modal" class="modal-overlay" style="z-index: 10006; display:flex;"><div class="modal-content" style="width: 400px; padding:0;"><div class="modal-header" style="padding: 15px 20px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center;"><h2 style="font-size:1.2rem; margin:0; color:#1e293b;">⚙️ D-Day 관리</h2><button class="btn-close-modal" onclick="document.getElementById('dday-modal').remove()" style="font-size:1.5rem; background:none; border:none; cursor:pointer; color:#64748b;">&times;</button></div><div class="modal-body" style="padding: 20px;"><div style="display:flex; gap:8px; margin-bottom:20px;"><input type="text" id="new-dday-title" placeholder="디데이 명칭" style="flex:1; padding:8px; border:1px solid #cbd5e1; border-radius:6px; font-size:0.9rem;"><input type="date" id="new-dday-date" style="padding:8px; border:1px solid #cbd5e1; border-radius:6px;"><button onclick="window.addDday()" style="padding:8px 12px; background:#2563eb; color:white; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">추가</button></div><hr style="border:0; border-top:1px dashed #e2e8f0; margin-bottom:15px;"><div id="dday-settings-list" style="display:flex; flex-direction:column; gap:10px; max-height:250px; overflow-y:auto;"></div></div></div></div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    renderDdaySettingsList();
};

export const renderDdaySettingsList = () => {
    const listEl = document.getElementById('dday-settings-list');
    if(!listEl) return;
    if (store.dDayList.length === 0) { listEl.innerHTML = '<div style="text-align:center; color:#94a3b8; font-size:0.9rem; margin-top:20px;">등록된 D-Day가 없습니다.</div>'; return; }
    listEl.innerHTML = store.dDayList.map(dday => `<div style="display:flex; justify-content:space-between; align-items:center; padding:10px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px;"><div><span style="font-weight:bold; color:#1e293b; margin-right:8px;">${dday.title}</span><span style="font-size:0.85rem; color:#64748b;">${dday.date}</span></div><button onclick="window.deleteDday('${dday.id}')" style="background:none; border:none; color:#ef4444; font-weight:bold; cursor:pointer; padding:4px 8px;">삭제</button></div>`).join('');
};

export const addDday = () => {
    const title = document.getElementById('new-dday-title').value.trim();
    const date = document.getElementById('new-dday-date').value;
    if (!title || !date) return alert("명칭과 날짜를 모두 입력해주세요.");

    const newDday = { id: 'dday_' + Date.now().toString(36), title, date };
    store.dDayList.push(newDday);
    if (store.dDayList.length === 1) store.selectedDDayId = newDday.id;

    saveDdayDataToFirebase(); 
    document.getElementById('new-dday-title').value = ''; 
    document.getElementById('new-dday-date').value = '';
    renderDdaySettingsList(); updateDdayUI();
};

export const deleteDday = (id) => {
    if (!confirm("해당 D-Day를 삭제하시겠습니까?")) return;
    store.dDayList = store.dDayList.filter(d => d.id !== id);
    if (store.selectedDDayId === id) store.selectedDDayId = null;
    saveDdayDataToFirebase(); 
    renderDdaySettingsList(); updateDdayUI();
};

export const saveDdayDataToFirebase = () => {
    if (!window.auth?.currentUser) return;
    setDoc(doc(getUserCol('settings'), 'preferences'), { dDayList: store.dDayList, selectedDDayId: store.selectedDDayId }, { merge: true }).catch(e=>console.warn(e));
};

// HTML 요소(onclick)에서 접근할 수 있도록 전역(window) 객체에 연결
Object.assign(window, {
    toggleDdayMenu, selectDday, updateDdayUI, calculateDday, 
    openDdaySettingsModal, renderDdaySettingsList, addDday, deleteDday, 
    saveDdayDataToFirebase
=======
// js/modules/dday.js

import { store } from '../core/store.js';
import { getUserCol } from '../firebase.js';
import { doc, setDoc } from "firebase/firestore";

// 🌟 [추가됨] D-Day 기능 모듈 분리
export const toggleDdayMenu = () => {
    if (!store.dDayList?.length) return openDdaySettingsModal();
    const dropdown = document.getElementById('dday-dropdown');
    const listContainer = document.getElementById('dday-list-container');
    if (dropdown.classList.contains('hidden')) {
        listContainer.innerHTML = store.dDayList.map(dday => {
            const isSelected = dday.id === store.selectedDDayId;
            return `<button class="dropdown-item" onclick="window.selectDday('${dday.id}')" style="${isSelected ? 'background:#eff6ff; color:#2563eb;' : ''}"><span style="font-weight:bold; margin-right:8px; display:inline-block; width:50px;">${calculateDday(dday.date)}</span> ${dday.title}</button>`;
        }).join('') + (store.selectedDDayId ? `<button class="dropdown-item" onclick="window.selectDday(null)" style="color:#64748b; text-align:center;">선택 해제</button>` : '');
    }
    dropdown.classList.toggle('hidden');
};

export const selectDday = async (id) => {
    store.selectedDDayId = id;
    document.getElementById('dday-dropdown').classList.add('hidden');
    updateDdayUI();
    if (window.auth?.currentUser) {
        setDoc(doc(getUserCol('settings'), 'preferences'), { selectedDDayId: id }, { merge: true }).catch(e=>console.warn(e)); 
    }
};

export const updateDdayUI = () => {
    const btn = document.getElementById('btn-dday-display');
    if (!btn) return;
    if (!store.selectedDDayId || !store.dDayList?.length) {
        btn.textContent = "D-Day 설정"; btn.style.cssText = "color:#64748b; background-color:#f1f5f9; border-color:#cbd5e1; font-weight:bold; min-width:90px; cursor:pointer;"; 
        return;
    }
    const selected = store.dDayList.find(d => d.id === store.selectedDDayId);
    if (selected) {
        btn.textContent = `${selected.title} ${calculateDday(selected.date)}`; 
        btn.style.cssText = "color:#ef4444; background-color:#fef2f2; border-color:#fca5a5; font-weight:bold; min-width:90px; cursor:pointer;";
    }
};

export const calculateDday = (targetDateStr) => {
    const today = new Date(); today.setHours(0, 0, 0, 0); 
    const targetDate = new Date(targetDateStr); targetDate.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)); 
    return diffDays === 0 ? 'D-Day' : (diffDays > 0 ? `D-${diffDays}` : `D+${Math.abs(diffDays)}`);
};

export const openDdaySettingsModal = () => {
    document.getElementById('dday-dropdown')?.classList.add('hidden');
    document.getElementById('dday-modal')?.remove();
    const modalHtml = `<div id="dday-modal" class="modal-overlay" style="z-index: 10006; display:flex;"><div class="modal-content" style="width: 400px; padding:0;"><div class="modal-header" style="padding: 15px 20px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center;"><h2 style="font-size:1.2rem; margin:0; color:#1e293b;">⚙️ D-Day 관리</h2><button class="btn-close-modal" onclick="document.getElementById('dday-modal').remove()" style="font-size:1.5rem; background:none; border:none; cursor:pointer; color:#64748b;">&times;</button></div><div class="modal-body" style="padding: 20px;"><div style="display:flex; gap:8px; margin-bottom:20px;"><input type="text" id="new-dday-title" placeholder="디데이 명칭" style="flex:1; padding:8px; border:1px solid #cbd5e1; border-radius:6px; font-size:0.9rem;"><input type="date" id="new-dday-date" style="padding:8px; border:1px solid #cbd5e1; border-radius:6px;"><button onclick="window.addDday()" style="padding:8px 12px; background:#2563eb; color:white; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">추가</button></div><hr style="border:0; border-top:1px dashed #e2e8f0; margin-bottom:15px;"><div id="dday-settings-list" style="display:flex; flex-direction:column; gap:10px; max-height:250px; overflow-y:auto;"></div></div></div></div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    renderDdaySettingsList();
};

export const renderDdaySettingsList = () => {
    const listEl = document.getElementById('dday-settings-list');
    if(!listEl) return;
    if (store.dDayList.length === 0) { listEl.innerHTML = '<div style="text-align:center; color:#94a3b8; font-size:0.9rem; margin-top:20px;">등록된 D-Day가 없습니다.</div>'; return; }
    listEl.innerHTML = store.dDayList.map(dday => `<div style="display:flex; justify-content:space-between; align-items:center; padding:10px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px;"><div><span style="font-weight:bold; color:#1e293b; margin-right:8px;">${dday.title}</span><span style="font-size:0.85rem; color:#64748b;">${dday.date}</span></div><button onclick="window.deleteDday('${dday.id}')" style="background:none; border:none; color:#ef4444; font-weight:bold; cursor:pointer; padding:4px 8px;">삭제</button></div>`).join('');
};

export const addDday = () => {
    const title = document.getElementById('new-dday-title').value.trim();
    const date = document.getElementById('new-dday-date').value;
    if (!title || !date) return alert("명칭과 날짜를 모두 입력해주세요.");

    const newDday = { id: 'dday_' + Date.now().toString(36), title, date };
    store.dDayList.push(newDday);
    if (store.dDayList.length === 1) store.selectedDDayId = newDday.id;

    saveDdayDataToFirebase(); 
    document.getElementById('new-dday-title').value = ''; 
    document.getElementById('new-dday-date').value = '';
    renderDdaySettingsList(); updateDdayUI();
};

export const deleteDday = (id) => {
    if (!confirm("해당 D-Day를 삭제하시겠습니까?")) return;
    store.dDayList = store.dDayList.filter(d => d.id !== id);
    if (store.selectedDDayId === id) store.selectedDDayId = null;
    saveDdayDataToFirebase(); 
    renderDdaySettingsList(); updateDdayUI();
};

export const saveDdayDataToFirebase = () => {
    if (!window.auth?.currentUser) return;
    setDoc(doc(getUserCol('settings'), 'preferences'), { dDayList: store.dDayList, selectedDDayId: store.selectedDDayId }, { merge: true }).catch(e=>console.warn(e));
};

// HTML 요소(onclick)에서 접근할 수 있도록 전역(window) 객체에 연결
Object.assign(window, {
    toggleDdayMenu, selectDday, updateDdayUI, calculateDday, 
    openDdaySettingsModal, renderDdaySettingsList, addDday, deleteDday, 
    saveDdayDataToFirebase
>>>>>>> d1348ae5447b87f69a849130f4f6a30f4c5cc4fe
});