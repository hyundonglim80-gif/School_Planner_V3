<<<<<<< HEAD
// js/modules/multiEvent.js

import { store } from '../core/store.js';
import { formatDate } from '../core/utils.js';
import { getUserCol, getGroupCol } from '../firebase.js'; 
import { doc, getDoc, getDocs, query, where, documentId, writeBatch } from "firebase/firestore";

// 🌟 [추가됨] 다중/기간 일정 관리 모듈 분리
export const openPeriodModal = async (startDateStr, labelName, textContent, callback, labelId) => {
    const modalHtml = `
    <div id="period-modal" class="modal-overlay" style="display:flex; position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.5); z-index:10002; justify-content:center; align-items:center;">
        <div style="background:#fff; padding:25px; border-radius:12px; width:380px; box-shadow:0 10px 25px rgba(0,0,0,0.2);">
            <h3 style="margin-top:0; color:#2563eb; border-bottom:2px solid #bfdbfe; padding-bottom:10px;">📅 [${labelName}] 연속 기간 등록</h3>

            <div style="margin-bottom:15px;">
                <label style="display:block; font-weight:bold; margin-bottom:5px;">일정 내용</label>
                <input type="text" id="period-content" value="${textContent}" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:6px; box-sizing:border-box;" placeholder="예: 여름방학">
            </div>
            <div style="display:flex; gap:10px; margin-bottom:15px;">
                <div style="flex:1;"><label style="display:block; font-weight:bold; margin-bottom:5px; font-size:0.9rem;">시작일</label><input type="date" id="period-start" value="${startDateStr}" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px; background:#fff; box-sizing:border-box;"></div>
                <div style="flex:1;"><label style="display:block; font-weight:bold; margin-bottom:5px; font-size:0.9rem; color:#ef4444;">종료일 선택</label><input type="date" id="period-end" value="${startDateStr}" style="width:100%; padding:8px; border:1px solid #ef4444; border-radius:6px; outline:none; box-sizing:border-box;"></div>
            </div>
            <div style="margin-bottom:25px; background:#f8fafc; padding:10px; border-radius:6px; border:1px solid #e2e8f0;">
                <label style="display:flex; align-items:center; gap:6px; font-weight:bold; cursor:pointer;"><input type="checkbox" id="period-exclude-weekend" checked style="width:16px; height:16px; accent-color:#2563eb;"> 주말(토/일) 제외하고 계산하기</label>
                <p style="margin:5px 0 0 22px; font-size:0.8rem; color:#64748b;">체크 시 평일에만 등록됩니다.</p>
            </div>
            <div style="display:flex; justify-content:flex-end; gap:10px;">
                <button id="btn-period-cancel" style="padding:10px 16px; border:none; background:#f1f5f9; font-weight:bold; border-radius:6px; cursor:pointer;">취소</button>
                <button id="btn-period-register" style="padding:10px 16px; border:none; background:#2563eb; color:#fff; font-weight:bold; border-radius:6px; cursor:pointer;">등록</button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    document.getElementById('btn-period-cancel').onclick = () => { document.getElementById('period-modal').remove(); if(callback) callback(false); };
    document.getElementById('btn-period-register').onclick = () => executeGroupSave(labelName, callback, 'period', labelId);
};

export const openRecurringModal = async (startDateStr, labelName, textContent, callback, labelId) => {
    if (window.RecurringEventModule) {
        window.RecurringEventModule.open(startDateStr, labelName, textContent, callback);
    }
};

export const executeGroupSave = async (labelName, callback, mode, labelId) => {
    const isPeriod = (mode === 'period');
    const prefix = isPeriod ? 'period' : 'recur';
    const content = document.getElementById(`${prefix}-content`).value.trim();
    const startStr = document.getElementById(`${prefix}-start`).value;
    const endStr = document.getElementById(`${prefix}-end`).value;
    const excludeWeekend = isPeriod ? document.getElementById('period-exclude-weekend').checked : false;

    const sharedGroupId = document.getElementById(`${prefix}-shared-group`)?.value || null;

    if(!content) return alert("일정 내용을 입력해주세요.");
    const startD = new Date(startStr); const endD = new Date(endStr);
    if(startD > endD) return alert("종료일이 시작일보다 빠를 수 없습니다.");

    let datesToSave = []; let curD = new Date(startD); const targetDayOfWeek = startD.getDay();

    while (curD <= endD) {
        if (isPeriod) {
            const day = curD.getDay();
            if (!(excludeWeekend && (day === 0 || day === 6))) datesToSave.push(formatDate(curD));
        } else {
            if (curD.getDay() === targetDayOfWeek) datesToSave.push(formatDate(curD));
        }
        curD.setDate(curD.getDate() + 1);
    }

    const totalDays = datesToSave.length;
    let batch = writeBatch(window.db);
    const groupId = `group_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 5)}`; 

    const targetCol = sharedGroupId ? getGroupCol(sharedGroupId, 'events') : getUserCol('events');

    for(let i=0; i<totalDays; i++) {
        const dStr = datesToSave[i];
        const docRef = doc(targetCol, dStr);
        const docSnap = await getDoc(docRef);
        let list = docSnap.exists() ? (docSnap.data().eventList || []) : [];

        list.push({ 
            id: 'ev_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2,5),
            authorId: window.auth?.currentUser?.uid,
            labelIds: labelId ? [labelId] : [], 
            label: labelName, labels: [labelName], 
            content: isPeriod ? `${content} (${i+1}/${totalDays})` : content, 
            completed: false, 
            groupId: groupId, 
            sharedGroupId: sharedGroupId 
        });
        batch.set(docRef, { eventList: list, updatedAt: Date.now() }, { merge: true });
    }

    batch.commit().catch(e => console.warn(e)); 
    document.getElementById(`${prefix}-modal`).remove();
    alert(`✅ 총 ${totalDays}개의 그룹 일정이 성공적으로 등록되었습니다.`);
    if (callback) callback(true);
};

export const showGroupDeleteModal = (baseDateStr, labelIdOrName, textContent, groupId, onConfirm, onOnlyThisDay) => {
    const modalHtml = `
    <div id="group-delete-modal" class="modal-overlay" style="display:flex; position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.5); z-index:10002; justify-content:center; align-items:center;">
        <div class="modal-content" style="width:380px; padding:25px; background:#fff; border-radius:12px; text-align:center;">
            <h3 style="color:#ef4444; margin-top:0;">🗑️ 연결된 그룹 일정 삭제</h3>
            <p style="color:#475569; font-size:0.95rem; margin-bottom:20px; line-height:1.5;">선택하신 일정은 <b>'반복 또는 기간'</b>으로 연결된 일정입니다.<br>어떻게 처리할까요?</p>
            <div style="display:flex; flex-direction:column; gap:10px;">
                <button id="btn-del-only-this" style="padding:12px; background:#f1f5f9; border:1px solid #cbd5e1; border-radius:8px; cursor:pointer; font-weight:bold; color:#1e293b; text-align:left;">1. 이 일정만 삭제 <span style="font-size:0.8rem; font-weight:normal; color:#64748b;">(예외 처리)</span></button>
                <button id="btn-del-after-this" style="padding:12px; background:#fff1f2; border:1px solid #fecdd3; border-radius:8px; cursor:pointer; font-weight:bold; color:#e11d48; text-align:left;">2. 이 날부터 이후 모든 연결된 일정 삭제</button>
                <button id="btn-del-all" style="padding:12px; background:#fee2e2; border:1px solid #fca5a5; border-radius:8px; cursor:pointer; font-weight:bold; color:#b91c1c; text-align:left;">3. 전체 그룹 일정 모두 삭제 <span style="font-size:0.8rem; font-weight:normal; color:#ef4444;">(과거 포함)</span></button>
                <button onclick="document.getElementById('group-delete-modal').remove()" style="padding:10px; background:none; border:none; color:#64748b; font-weight:bold; cursor:pointer; margin-top:5px;">취소</button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const baseContent = textContent.replace(/\s*\(\d+\/\d+\).*/, '').trim();

    document.getElementById('btn-del-only-this').onclick = () => { document.getElementById('group-delete-modal').remove(); if (onOnlyThisDay) onOnlyThisDay(); };
    document.getElementById('btn-del-after-this').onclick = async () => { if(store.hasUnsavedChanges && window.saveCurrentViewData) window.saveCurrentViewData(true); await executeGroupDelete('after', baseDateStr, groupId, labelIdOrName, baseContent, onConfirm); };
    document.getElementById('btn-del-all').onclick = async () => { if(store.hasUnsavedChanges && window.saveCurrentViewData) window.saveCurrentViewData(true); await executeGroupDelete('all', baseDateStr, groupId, labelIdOrName, baseContent, onConfirm); };
};

export const executeGroupDelete = async (mode, baseDateStr, groupId, labelIdOrName, baseContent, onConfirm) => {
    document.getElementById('group-delete-modal').innerHTML = `<div style="background:#fff; padding:30px; border-radius:12px; font-weight:bold; color:#2563eb; text-align:center;">⏳ 일괄 삭제 처리 중...</div>`;

    const matchEvent = (e) => {
        if (groupId && e.groupId) return e.groupId === groupId; 
        const eLabelIds = e.labelIds || []; const eLabels = e.labels || (e.label ? [e.label] : []);
        const hasLabel = eLabelIds.includes(labelIdOrName) || eLabels.includes(labelIdOrName);
        const c = (e.content || '').replace(/\s*\(\d+\/\d+\).*/, '').trim();
        return hasLabel && c === baseContent;
    };

    if (window.dayViewInstance && window.dayViewInstance.dateStr === baseDateStr && window.dayViewInstance.currentEvents) {
        window.dayViewInstance.currentEvents = window.dayViewInstance.currentEvents.filter(e => !matchEvent(e));
    }
    Object.keys(window).forEach(key => {
        if (key.startsWith('tempEvents_')) {
            const dStr = key.replace('tempEvents_', '');
            if (mode === 'only' && dStr !== baseDateStr) return;
            if (mode === 'after' && dStr < baseDateStr) return;
            window[key] = window[key].filter(e => !matchEvent(e));
        }
    });

    try {
        let myGroups = [];
        try { myGroups = await window.dbAPI.loadMyGroups(); } catch(e) {}
        const colsToSearch = [window.getUserCol('events'), ...myGroups.map(g => window.getGroupCol(g.id, 'events'))];

        let batch = writeBatch(window.db); let count = 0; let batchPromises = []; 

        for (const col of colsToSearch) {
            let q = col;
            if (mode === 'after') q = query(q, where(documentId(), '>=', baseDateStr));
            const snap = await getDocs(q);
            
            snap.forEach(docSnap => {
                const data = docSnap.data();
                let list = data.eventList || [];
                const origLen = list.length;

                list = list.filter(e => !matchEvent(e));

                if (origLen !== list.length) {
                    let updateData = { eventList: list, updatedAt: Date.now() };
                    if (window.formatEventListToText) updateData.eventText = window.formatEventListToText(list);
                    batch.update(docSnap.ref, updateData);

                    count++;
                    if (count >= 400) { batchPromises.push(batch.commit()); batch = writeBatch(window.db); count = 0; }
                }
            });
        }
        if (count > 0) batchPromises.push(batch.commit());
        await Promise.all(batchPromises);
    } catch(e) { console.error("일괄 삭제 오류:", e); }

    document.getElementById('group-delete-modal')?.remove();
    if (onConfirm) onConfirm();
};

// HTML 요소(onclick)에서 접근할 수 있도록 전역(window) 객체에 연결
Object.assign(window, {
    openPeriodModal,
    openRecurringModal,
    executeGroupSave,
    showGroupDeleteModal,
    executeGroupDelete
=======
// js/modules/multiEvent.js

import { store } from '../core/store.js';
import { formatDate } from '../core/utils.js';
import { getUserCol, getGroupCol } from '../firebase.js'; 
import { doc, getDoc, getDocs, query, where, documentId, writeBatch } from "firebase/firestore";

// 🌟 [추가됨] 다중/기간 일정 관리 모듈 분리
export const openPeriodModal = async (startDateStr, labelName, textContent, callback, labelId) => {
    const modalHtml = `
    <div id="period-modal" class="modal-overlay" style="display:flex; position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.5); z-index:10002; justify-content:center; align-items:center;">
        <div style="background:#fff; padding:25px; border-radius:12px; width:380px; box-shadow:0 10px 25px rgba(0,0,0,0.2);">
            <h3 style="margin-top:0; color:#2563eb; border-bottom:2px solid #bfdbfe; padding-bottom:10px;">📅 [${labelName}] 연속 기간 등록</h3>

            <div style="margin-bottom:15px;">
                <label style="display:block; font-weight:bold; margin-bottom:5px;">일정 내용</label>
                <input type="text" id="period-content" value="${textContent}" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:6px; box-sizing:border-box;" placeholder="예: 여름방학">
            </div>
            <div style="display:flex; gap:10px; margin-bottom:15px;">
                <div style="flex:1;"><label style="display:block; font-weight:bold; margin-bottom:5px; font-size:0.9rem;">시작일</label><input type="date" id="period-start" value="${startDateStr}" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px; background:#fff; box-sizing:border-box;"></div>
                <div style="flex:1;"><label style="display:block; font-weight:bold; margin-bottom:5px; font-size:0.9rem; color:#ef4444;">종료일 선택</label><input type="date" id="period-end" value="${startDateStr}" style="width:100%; padding:8px; border:1px solid #ef4444; border-radius:6px; outline:none; box-sizing:border-box;"></div>
            </div>
            <div style="margin-bottom:25px; background:#f8fafc; padding:10px; border-radius:6px; border:1px solid #e2e8f0;">
                <label style="display:flex; align-items:center; gap:6px; font-weight:bold; cursor:pointer;"><input type="checkbox" id="period-exclude-weekend" checked style="width:16px; height:16px; accent-color:#2563eb;"> 주말(토/일) 제외하고 계산하기</label>
                <p style="margin:5px 0 0 22px; font-size:0.8rem; color:#64748b;">체크 시 평일에만 등록됩니다.</p>
            </div>
            <div style="display:flex; justify-content:flex-end; gap:10px;">
                <button id="btn-period-cancel" style="padding:10px 16px; border:none; background:#f1f5f9; font-weight:bold; border-radius:6px; cursor:pointer;">취소</button>
                <button id="btn-period-register" style="padding:10px 16px; border:none; background:#2563eb; color:#fff; font-weight:bold; border-radius:6px; cursor:pointer;">등록</button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    document.getElementById('btn-period-cancel').onclick = () => { document.getElementById('period-modal').remove(); if(callback) callback(false); };
    document.getElementById('btn-period-register').onclick = () => executeGroupSave(labelName, callback, 'period', labelId);
};

export const openRecurringModal = async (startDateStr, labelName, textContent, callback, labelId) => {
    if (window.RecurringEventModule) {
        window.RecurringEventModule.open(startDateStr, labelName, textContent, callback);
    }
};

export const executeGroupSave = async (labelName, callback, mode, labelId) => {
    const isPeriod = (mode === 'period');
    const prefix = isPeriod ? 'period' : 'recur';
    const content = document.getElementById(`${prefix}-content`).value.trim();
    const startStr = document.getElementById(`${prefix}-start`).value;
    const endStr = document.getElementById(`${prefix}-end`).value;
    const excludeWeekend = isPeriod ? document.getElementById('period-exclude-weekend').checked : false;

    const sharedGroupId = document.getElementById(`${prefix}-shared-group`)?.value || null;

    if(!content) return alert("일정 내용을 입력해주세요.");
    const startD = new Date(startStr); const endD = new Date(endStr);
    if(startD > endD) return alert("종료일이 시작일보다 빠를 수 없습니다.");

    let datesToSave = []; let curD = new Date(startD); const targetDayOfWeek = startD.getDay();

    while (curD <= endD) {
        if (isPeriod) {
            const day = curD.getDay();
            if (!(excludeWeekend && (day === 0 || day === 6))) datesToSave.push(formatDate(curD));
        } else {
            if (curD.getDay() === targetDayOfWeek) datesToSave.push(formatDate(curD));
        }
        curD.setDate(curD.getDate() + 1);
    }

    const totalDays = datesToSave.length;
    let batch = writeBatch(window.db);
    const groupId = `group_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 5)}`; 

    const targetCol = sharedGroupId ? getGroupCol(sharedGroupId, 'events') : getUserCol('events');

    for(let i=0; i<totalDays; i++) {
        const dStr = datesToSave[i];
        const docRef = doc(targetCol, dStr);
        const docSnap = await getDoc(docRef);
        let list = docSnap.exists() ? (docSnap.data().eventList || []) : [];

        list.push({ 
            id: 'ev_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2,5),
            authorId: window.auth?.currentUser?.uid,
            labelIds: labelId ? [labelId] : [], 
            label: labelName, labels: [labelName], 
            content: isPeriod ? `${content} (${i+1}/${totalDays})` : content, 
            completed: false, 
            groupId: groupId, 
            sharedGroupId: sharedGroupId 
        });
        batch.set(docRef, { eventList: list, updatedAt: Date.now() }, { merge: true });
    }

    batch.commit().catch(e => console.warn(e)); 
    document.getElementById(`${prefix}-modal`).remove();
    alert(`✅ 총 ${totalDays}개의 그룹 일정이 성공적으로 등록되었습니다.`);
    if (callback) callback(true);
};

export const showGroupDeleteModal = (baseDateStr, labelIdOrName, textContent, groupId, onConfirm, onOnlyThisDay) => {
    const modalHtml = `
    <div id="group-delete-modal" class="modal-overlay" style="display:flex; position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.5); z-index:10002; justify-content:center; align-items:center;">
        <div class="modal-content" style="width:380px; padding:25px; background:#fff; border-radius:12px; text-align:center;">
            <h3 style="color:#ef4444; margin-top:0;">🗑️ 연결된 그룹 일정 삭제</h3>
            <p style="color:#475569; font-size:0.95rem; margin-bottom:20px; line-height:1.5;">선택하신 일정은 <b>'반복 또는 기간'</b>으로 연결된 일정입니다.<br>어떻게 처리할까요?</p>
            <div style="display:flex; flex-direction:column; gap:10px;">
                <button id="btn-del-only-this" style="padding:12px; background:#f1f5f9; border:1px solid #cbd5e1; border-radius:8px; cursor:pointer; font-weight:bold; color:#1e293b; text-align:left;">1. 이 일정만 삭제 <span style="font-size:0.8rem; font-weight:normal; color:#64748b;">(예외 처리)</span></button>
                <button id="btn-del-after-this" style="padding:12px; background:#fff1f2; border:1px solid #fecdd3; border-radius:8px; cursor:pointer; font-weight:bold; color:#e11d48; text-align:left;">2. 이 날부터 이후 모든 연결된 일정 삭제</button>
                <button id="btn-del-all" style="padding:12px; background:#fee2e2; border:1px solid #fca5a5; border-radius:8px; cursor:pointer; font-weight:bold; color:#b91c1c; text-align:left;">3. 전체 그룹 일정 모두 삭제 <span style="font-size:0.8rem; font-weight:normal; color:#ef4444;">(과거 포함)</span></button>
                <button onclick="document.getElementById('group-delete-modal').remove()" style="padding:10px; background:none; border:none; color:#64748b; font-weight:bold; cursor:pointer; margin-top:5px;">취소</button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const baseContent = textContent.replace(/\s*\(\d+\/\d+\).*/, '').trim();

    document.getElementById('btn-del-only-this').onclick = () => { document.getElementById('group-delete-modal').remove(); if (onOnlyThisDay) onOnlyThisDay(); };
    document.getElementById('btn-del-after-this').onclick = async () => { if(store.hasUnsavedChanges && window.saveCurrentViewData) window.saveCurrentViewData(true); await executeGroupDelete('after', baseDateStr, groupId, labelIdOrName, baseContent, onConfirm); };
    document.getElementById('btn-del-all').onclick = async () => { if(store.hasUnsavedChanges && window.saveCurrentViewData) window.saveCurrentViewData(true); await executeGroupDelete('all', baseDateStr, groupId, labelIdOrName, baseContent, onConfirm); };
};

export const executeGroupDelete = async (mode, baseDateStr, groupId, labelIdOrName, baseContent, onConfirm) => {
    document.getElementById('group-delete-modal').innerHTML = `<div style="background:#fff; padding:30px; border-radius:12px; font-weight:bold; color:#2563eb; text-align:center;">⏳ 일괄 삭제 처리 중...</div>`;

    const matchEvent = (e) => {
        if (groupId && e.groupId) return e.groupId === groupId; 
        const eLabelIds = e.labelIds || []; const eLabels = e.labels || (e.label ? [e.label] : []);
        const hasLabel = eLabelIds.includes(labelIdOrName) || eLabels.includes(labelIdOrName);
        const c = (e.content || '').replace(/\s*\(\d+\/\d+\).*/, '').trim();
        return hasLabel && c === baseContent;
    };

    if (window.dayViewInstance && window.dayViewInstance.dateStr === baseDateStr && window.dayViewInstance.currentEvents) {
        window.dayViewInstance.currentEvents = window.dayViewInstance.currentEvents.filter(e => !matchEvent(e));
    }
    Object.keys(window).forEach(key => {
        if (key.startsWith('tempEvents_')) {
            const dStr = key.replace('tempEvents_', '');
            if (mode === 'only' && dStr !== baseDateStr) return;
            if (mode === 'after' && dStr < baseDateStr) return;
            window[key] = window[key].filter(e => !matchEvent(e));
        }
    });

    try {
        let myGroups = [];
        try { myGroups = await window.dbAPI.loadMyGroups(); } catch(e) {}
        const colsToSearch = [window.getUserCol('events'), ...myGroups.map(g => window.getGroupCol(g.id, 'events'))];

        let batch = writeBatch(window.db); let count = 0; let batchPromises = []; 

        for (const col of colsToSearch) {
            let q = col;
            if (mode === 'after') q = query(q, where(documentId(), '>=', baseDateStr));
            const snap = await getDocs(q);
            
            snap.forEach(docSnap => {
                const data = docSnap.data();
                let list = data.eventList || [];
                const origLen = list.length;

                list = list.filter(e => !matchEvent(e));

                if (origLen !== list.length) {
                    let updateData = { eventList: list, updatedAt: Date.now() };
                    if (window.formatEventListToText) updateData.eventText = window.formatEventListToText(list);
                    batch.update(docSnap.ref, updateData);

                    count++;
                    if (count >= 400) { batchPromises.push(batch.commit()); batch = writeBatch(window.db); count = 0; }
                }
            });
        }
        if (count > 0) batchPromises.push(batch.commit());
        await Promise.all(batchPromises);
    } catch(e) { console.error("일괄 삭제 오류:", e); }

    document.getElementById('group-delete-modal')?.remove();
    if (onConfirm) onConfirm();
};

// HTML 요소(onclick)에서 접근할 수 있도록 전역(window) 객체에 연결
Object.assign(window, {
    openPeriodModal,
    openRecurringModal,
    executeGroupSave,
    showGroupDeleteModal,
    executeGroupDelete
>>>>>>> d1348ae5447b87f69a849130f4f6a30f4c5cc4fe
});