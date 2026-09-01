<<<<<<< HEAD
// js/modules/forwarding.js

import { store } from '../core/store.js';
import { formatDate, parseLocalDate, getEventLabels } from '../core/utils.js';
// 🌟 1. Firebase 관련 객체들을 직접 import 하도록 추가 (db, getGroupCol, dbAPI, auth 추가)
import { getUserCol, getGroupCol, db, dbAPI, auth } from '../firebase.js'; 
import { doc, getDocs, query, where, documentId, writeBatch } from "firebase/firestore";

// 🌟 [추가됨] 일정 자동 이월 엔진 모듈 분리
export const autoForwardIncompleteEvents = async () => {
    const todayStr = formatDate(new Date()); 
    try {
        const pastDate = new Date(parseLocalDate(todayStr));
        pastDate.setDate(pastDate.getDate() - 365); 
        
        const eventsSnap = await getDocs(query(getUserCol('events'), where(documentId(), '>=', formatDate(pastDate))));
        let eventsMap = {}; let allDates = [];
        eventsSnap.forEach(docSnap => { eventsMap[docSnap.id] = docSnap.data(); allDates.push(docSnap.id); });

        if (!allDates.includes(todayStr)) allDates.push(todayStr);
        allDates.sort();

        let activeChains = new Set(); let chainEventData = {}; let changedDocs = new Set();
        const minDateStr = allDates[0] || todayStr; const maxDateStr = allDates[allDates.length - 1];
        let curD = parseLocalDate(minDateStr); let endD = parseLocalDate(maxDateStr);

        while (curD <= endD) {
            const curStr = formatDate(curD);
            curD.setDate(curD.getDate() + 1);
            const nextStr = formatDate(curD);

            let curData = eventsMap[curStr] || { eventList: [] };
            let curList = curData.eventList || (curData.eventText && window.parseRawEventTextToEventList ? window.parseRawEventTextToEventList(curData.eventText) : []);
            let newCurList = []; let curChanged = false;

            curList.forEach(ev => {
                let canComplete = false;
                if (ev.labelIds?.length > 0) { canComplete = ev.labelIds.some(id => window.isForwardLabel ? window.isForwardLabel(id) : getEventLabels().find(l => l.id === id)?.isForward); } 
                else if (ev.labels || ev.label) {
                    const lName = (ev.labels?.length > 0) ? ev.labels[0] : ev.label;
                    const lObj = getEventLabels().find(x => x.name === lName);
                    canComplete = lObj ? lObj.isForward : false;
                }

                const cleanContent = (ev.content || '').replace(/➡️\s*\(미완료\)/g, '').replace(/➡️\s*\(다음 날로 이월됨\)/g, '').replace(/↪️\s*/g, '').trim();
                if (ev.content !== cleanContent) { ev.content = cleanContent; curChanged = true; }

                const isOrigin = !ev.originalDate || ev.originalDate === curStr;

                if (isOrigin) {
                    if (canComplete) {
                        if (!ev.forwardChainId) { ev.forwardChainId = 'chain_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5); curChanged = true; }
                        if (!ev.originalDate) { ev.originalDate = curStr; curChanged = true; }

                        if (ev.completed) activeChains.delete(ev.forwardChainId);
                        else { activeChains.add(ev.forwardChainId); chainEventData[ev.forwardChainId] = { ...ev }; }
                        newCurList.push(ev);
                    } else {
                        if (ev.forwardChainId) { delete ev.forwardChainId; delete ev.originalDate; curChanged = true; }
                        newCurList.push(ev);
                    }
                } else {
                    if (activeChains.has(ev.forwardChainId)) {
                        if (ev.completed) activeChains.delete(ev.forwardChainId);
                        else chainEventData[ev.forwardChainId] = { ...ev };
                        newCurList.push(ev);
                    } else { curChanged = true; }
                }
            });

            let nextData = eventsMap[nextStr] || { eventList: [] };
            let nextList = nextData.eventList || (nextData.eventText && window.parseRawEventTextToEventList ? window.parseRawEventTextToEventList(nextData.eventText) : []);
            let nextChanged = false;

            if (curStr < todayStr) {
                activeChains.forEach(chainId => {
                    const existsInNext = nextList.some(n => n.forwardChainId === chainId);
                    if (!existsInNext) {
                        const sourceEv = chainEventData[chainId];
                        nextList.unshift({
                            id: 'ev_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2,5),
                            authorId: sourceEv.authorId || auth?.currentUser?.uid, // 🌟 2. window.auth 대신 import 한 auth 사용
                            labelIds: [...(sourceEv.labelIds || [])], label: sourceEv.label || '', labels: [...(sourceEv.labels || [])],
                            content: sourceEv.content, completed: false, forwardChainId: chainId, originalDate: sourceEv.originalDate,
                            groupId: sourceEv.groupId || null, sharedGroupId: sourceEv.sharedGroupId || null,
                            groupName: sourceEv.groupName || ''
                        });
                        nextChanged = true;
                    }
                });
            }

            if (curList.length !== newCurList.length) curChanged = true;

            if (curChanged) { eventsMap[curStr] = { ...curData, eventList: newCurList }; changedDocs.add(curStr); }
            if (nextChanged) { eventsMap[nextStr] = { ...nextData, eventList: nextList }; changedDocs.add(nextStr); }
        }

        // 🌟 3. window.db 대신 import 한 db 인스턴스 사용
        let batch = writeBatch(db); let opCount = 0; let batchPromises = []; 

        changedDocs.forEach(dateStr => {
            const docRef = doc(getUserCol('events'), dateStr);
            const evList = eventsMap[dateStr].eventList;
            const updateData = { eventList: evList, updatedAt: Date.now() };
            if (window.formatEventListToText) updateData.eventText = window.formatEventListToText(evList); 
            batch.set(docRef, updateData, { merge: true });
            opCount++;
            if (opCount >= 400){ batchPromises.push(batch.commit()); batch = writeBatch(db); opCount = 0; } // 🌟 window.db -> db
        });

        if (opCount > 0) batchPromises.push(batch.commit());
        Promise.all(batchPromises).catch(e => console.warn(e)); 

    } catch(e) { console.error("자동 이월 처리 에러:", e); }
};

export const showForwardDeleteModal = (baseDateStr, labelName, textContent, chainId, onConfirm) => {
    const modalHtml = `
    <div id="forward-delete-modal" class="modal-overlay" style="display:flex; position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.5); z-index:10002; justify-content:center; align-items:center;">
        <div class="modal-content" style="width:380px; padding:25px; background:#fff; border-radius:12px; text-align:center;">
            <h3 style="color:#ef4444; margin-top:0;">🗑️ 이월 일정 삭제</h3>
            <p style="color:#475569; font-size:0.95rem; margin-bottom:20px; line-height:1.5;">이 일정은 <b>'완료(이월)'</b> 속성으로 과거에서 넘어온 일정입니다.<br>어떻게 삭제하시겠습니까?</p>
            <div style="display:flex; flex-direction:column; gap:10px;">
                <button id="btn-fwd-del-stop" style="padding:12px; background:#f1f5f9; border:1px solid #cbd5e1; border-radius:8px; cursor:pointer; font-weight:bold; color:#1e293b; text-align:left; line-height:1.4;">오늘부터 삭제 및 이월 중단<br><span style="font-size:0.8rem; font-weight:normal; color:#64748b;">(과거의 기록은 보존됩니다)</span></button>
                <button id="btn-fwd-del-all" style="padding:12px; background:#fee2e2; border:1px solid #fca5a5; border-radius:8px; cursor:pointer; font-weight:bold; color:#b91c1c; text-align:left; line-height:1.4;">원본 포함 모든 기록 삭제<br><span style="font-size:0.8rem; font-weight:normal; color:#ef4444;">(최초 작성된 원본까지 모두 지웁니다)</span></button>
                <button onclick="document.getElementById('forward-delete-modal').remove()" style="padding:10px; background:none; border:none; color:#64748b; font-weight:bold; cursor:pointer; margin-top:5px;">취소</button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    document.getElementById('btn-fwd-del-stop').onclick = async () => {
        if(store.hasUnsavedChanges && window.saveCurrentViewData) window.saveCurrentViewData(true);
        executeForwardDelete('stop', baseDateStr, chainId, onConfirm);
    };
    document.getElementById('btn-fwd-del-all').onclick = async () => {
        if(store.hasUnsavedChanges && window.saveCurrentViewData) window.saveCurrentViewData(true);
        executeForwardDelete('all', baseDateStr, chainId, onConfirm);
    };
};

export const executeForwardDelete = async (mode, baseDateStr, chainId, onConfirm) => {
    document.getElementById('forward-delete-modal').innerHTML = `<div style="background:#fff; padding:30px; border-radius:12px; font-weight:bold; color:#2563eb; text-align:center;">⏳ 로컬 및 동기화 처리 중...</div>`;
    const matchEvent = (e) => e.forwardChainId === chainId;

    try {
        let myGroups = [];
        // 🌟 4. window.dbAPI.loadMyGroups() -> dbAPI.loadMyGroups() 
        try { myGroups = await dbAPI.loadMyGroups(); } catch(e) {}
        // 🌟 5. window.getUserCol -> getUserCol / window.getGroupCol -> getGroupCol 로 통일
        const colsToSearch = [getUserCol('events'), ...myGroups.map(g => getGroupCol(g.id, 'events'))];

        if (window.dayViewInstance && window.dayViewInstance.currentEvents) {
            if (mode === 'all' || window.dayViewInstance.dateStr >= baseDateStr) {
               window.dayViewInstance.currentEvents = window.dayViewInstance.currentEvents.filter(e => !matchEvent(e));
            } else if (mode === 'stop') {
               window.dayViewInstance.currentEvents.forEach(e => { if (matchEvent(e)) e.completed = true; });
            }
        }
        
        Object.keys(window).forEach(key => {
            if (key.startsWith('tempEvents_')) {
                const dStr = key.replace('tempEvents_', '');
                if (mode === 'all' || dStr >= baseDateStr) window[key] = window[key].filter(e => !matchEvent(e));
                else if (mode === 'stop') window[key].forEach(e => { if (matchEvent(e)) e.completed = true; });
            }
        });

        // 🌟 6. window.db -> db 
        let batch = writeBatch(db); let count = 0; let batchPromises = []; 

        for (const col of colsToSearch) {
            const snap = await getDocs(col);
            let maxPastDateStr = '';
            
            if (mode === 'stop') {
                snap.forEach(docSnap => {
                    if (docSnap.id < baseDateStr) {
                        const list = docSnap.data().eventList || (docSnap.data().eventText && window.parseRawEventTextToEventList ? window.parseRawEventTextToEventList(docSnap.data().eventText) : []);
                        if (list.some(matchEvent)) { if (docSnap.id > maxPastDateStr) maxPastDateStr = docSnap.id; }
                    }
                });
            }

            snap.forEach(docSnap => {
                let list = docSnap.data().eventList || [];
                const origLen = list.length; let changed = false;

                if (mode === 'all') {
                    list = list.filter(e => !matchEvent(e));
                    if (list.length !== origLen) changed = true;
                } else if (mode === 'stop') {
                    if (docSnap.id >= baseDateStr) {
                        list = list.filter(e => !matchEvent(e));
                        if (list.length !== origLen) changed = true;
                    } else if (docSnap.id === maxPastDateStr) {
                        list.forEach(e => { if (matchEvent(e) && !e.completed) { e.completed = true; changed = true; } });
                    }
                }

                if (changed) {
                    let updateData = { eventList: list, updatedAt: Date.now() };
                    if (window.formatEventListToText) updateData.eventText = window.formatEventListToText(list);
                    batch.update(docSnap.ref, updateData);
                    count++;
                    if (count >= 400) { batchPromises.push(batch.commit()); batch = writeBatch(db); count = 0; } // 🌟 window.db -> db
                }
            });
        }
        if (count > 0) batchPromises.push(batch.commit());
        await Promise.all(batchPromises);

        if (window.autoForwardIncompleteEvents) window.autoForwardIncompleteEvents();
    } catch(e) { console.error("이월 삭제 오류:", e); }

    document.getElementById('forward-delete-modal')?.remove();
    if (onConfirm) onConfirm();
};

Object.assign(window, {
    autoForwardIncompleteEvents,
    showForwardDeleteModal,
    executeForwardDelete
=======
// js/modules/forwarding.js

import { store } from '../core/store.js';
import { formatDate, parseLocalDate, getEventLabels } from '../core/utils.js';
// 🌟 1. Firebase 관련 객체들을 직접 import 하도록 추가 (db, getGroupCol, dbAPI, auth 추가)
import { getUserCol, getGroupCol, db, dbAPI, auth } from '../firebase.js'; 
import { doc, getDocs, query, where, documentId, writeBatch } from "firebase/firestore";

// 🌟 [추가됨] 일정 자동 이월 엔진 모듈 분리
export const autoForwardIncompleteEvents = async () => {
    const todayStr = formatDate(new Date()); 
    try {
        const pastDate = new Date(parseLocalDate(todayStr));
        pastDate.setDate(pastDate.getDate() - 365); 
        
        const eventsSnap = await getDocs(query(getUserCol('events'), where(documentId(), '>=', formatDate(pastDate))));
        let eventsMap = {}; let allDates = [];
        eventsSnap.forEach(docSnap => { eventsMap[docSnap.id] = docSnap.data(); allDates.push(docSnap.id); });

        if (!allDates.includes(todayStr)) allDates.push(todayStr);
        allDates.sort();

        let activeChains = new Set(); let chainEventData = {}; let changedDocs = new Set();
        const minDateStr = allDates[0] || todayStr; const maxDateStr = allDates[allDates.length - 1];
        let curD = parseLocalDate(minDateStr); let endD = parseLocalDate(maxDateStr);

        while (curD <= endD) {
            const curStr = formatDate(curD);
            curD.setDate(curD.getDate() + 1);
            const nextStr = formatDate(curD);

            let curData = eventsMap[curStr] || { eventList: [] };
            let curList = curData.eventList || (curData.eventText && window.parseRawEventTextToEventList ? window.parseRawEventTextToEventList(curData.eventText) : []);
            let newCurList = []; let curChanged = false;

            curList.forEach(ev => {
                let canComplete = false;
                if (ev.labelIds?.length > 0) { canComplete = ev.labelIds.some(id => window.isForwardLabel ? window.isForwardLabel(id) : getEventLabels().find(l => l.id === id)?.isForward); } 
                else if (ev.labels || ev.label) {
                    const lName = (ev.labels?.length > 0) ? ev.labels[0] : ev.label;
                    const lObj = getEventLabels().find(x => x.name === lName);
                    canComplete = lObj ? lObj.isForward : false;
                }

                const cleanContent = (ev.content || '').replace(/➡️\s*\(미완료\)/g, '').replace(/➡️\s*\(다음 날로 이월됨\)/g, '').replace(/↪️\s*/g, '').trim();
                if (ev.content !== cleanContent) { ev.content = cleanContent; curChanged = true; }

                const isOrigin = !ev.originalDate || ev.originalDate === curStr;

                if (isOrigin) {
                    if (canComplete) {
                        if (!ev.forwardChainId) { ev.forwardChainId = 'chain_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5); curChanged = true; }
                        if (!ev.originalDate) { ev.originalDate = curStr; curChanged = true; }

                        if (ev.completed) activeChains.delete(ev.forwardChainId);
                        else { activeChains.add(ev.forwardChainId); chainEventData[ev.forwardChainId] = { ...ev }; }
                        newCurList.push(ev);
                    } else {
                        if (ev.forwardChainId) { delete ev.forwardChainId; delete ev.originalDate; curChanged = true; }
                        newCurList.push(ev);
                    }
                } else {
                    if (activeChains.has(ev.forwardChainId)) {
                        if (ev.completed) activeChains.delete(ev.forwardChainId);
                        else chainEventData[ev.forwardChainId] = { ...ev };
                        newCurList.push(ev);
                    } else { curChanged = true; }
                }
            });

            let nextData = eventsMap[nextStr] || { eventList: [] };
            let nextList = nextData.eventList || (nextData.eventText && window.parseRawEventTextToEventList ? window.parseRawEventTextToEventList(nextData.eventText) : []);
            let nextChanged = false;

            if (curStr < todayStr) {
                activeChains.forEach(chainId => {
                    const existsInNext = nextList.some(n => n.forwardChainId === chainId);
                    if (!existsInNext) {
                        const sourceEv = chainEventData[chainId];
                        nextList.unshift({
                            id: 'ev_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2,5),
                            authorId: sourceEv.authorId || auth?.currentUser?.uid, // 🌟 2. window.auth 대신 import 한 auth 사용
                            labelIds: [...(sourceEv.labelIds || [])], label: sourceEv.label || '', labels: [...(sourceEv.labels || [])],
                            content: sourceEv.content, completed: false, forwardChainId: chainId, originalDate: sourceEv.originalDate,
                            groupId: sourceEv.groupId || null, sharedGroupId: sourceEv.sharedGroupId || null,
                            groupName: sourceEv.groupName || ''
                        });
                        nextChanged = true;
                    }
                });
            }

            if (curList.length !== newCurList.length) curChanged = true;

            if (curChanged) { eventsMap[curStr] = { ...curData, eventList: newCurList }; changedDocs.add(curStr); }
            if (nextChanged) { eventsMap[nextStr] = { ...nextData, eventList: nextList }; changedDocs.add(nextStr); }
        }

        // 🌟 3. window.db 대신 import 한 db 인스턴스 사용
        let batch = writeBatch(db); let opCount = 0; let batchPromises = []; 

        changedDocs.forEach(dateStr => {
            const docRef = doc(getUserCol('events'), dateStr);
            const evList = eventsMap[dateStr].eventList;
            const updateData = { eventList: evList, updatedAt: Date.now() };
            if (window.formatEventListToText) updateData.eventText = window.formatEventListToText(evList); 
            batch.set(docRef, updateData, { merge: true });
            opCount++;
            if (opCount >= 400){ batchPromises.push(batch.commit()); batch = writeBatch(db); opCount = 0; } // 🌟 window.db -> db
        });

        if (opCount > 0) batchPromises.push(batch.commit());
        Promise.all(batchPromises).catch(e => console.warn(e)); 

    } catch(e) { console.error("자동 이월 처리 에러:", e); }
};

export const showForwardDeleteModal = (baseDateStr, labelName, textContent, chainId, onConfirm) => {
    const modalHtml = `
    <div id="forward-delete-modal" class="modal-overlay" style="display:flex; position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.5); z-index:10002; justify-content:center; align-items:center;">
        <div class="modal-content" style="width:380px; padding:25px; background:#fff; border-radius:12px; text-align:center;">
            <h3 style="color:#ef4444; margin-top:0;">🗑️ 이월 일정 삭제</h3>
            <p style="color:#475569; font-size:0.95rem; margin-bottom:20px; line-height:1.5;">이 일정은 <b>'완료(이월)'</b> 속성으로 과거에서 넘어온 일정입니다.<br>어떻게 삭제하시겠습니까?</p>
            <div style="display:flex; flex-direction:column; gap:10px;">
                <button id="btn-fwd-del-stop" style="padding:12px; background:#f1f5f9; border:1px solid #cbd5e1; border-radius:8px; cursor:pointer; font-weight:bold; color:#1e293b; text-align:left; line-height:1.4;">오늘부터 삭제 및 이월 중단<br><span style="font-size:0.8rem; font-weight:normal; color:#64748b;">(과거의 기록은 보존됩니다)</span></button>
                <button id="btn-fwd-del-all" style="padding:12px; background:#fee2e2; border:1px solid #fca5a5; border-radius:8px; cursor:pointer; font-weight:bold; color:#b91c1c; text-align:left; line-height:1.4;">원본 포함 모든 기록 삭제<br><span style="font-size:0.8rem; font-weight:normal; color:#ef4444;">(최초 작성된 원본까지 모두 지웁니다)</span></button>
                <button onclick="document.getElementById('forward-delete-modal').remove()" style="padding:10px; background:none; border:none; color:#64748b; font-weight:bold; cursor:pointer; margin-top:5px;">취소</button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    document.getElementById('btn-fwd-del-stop').onclick = async () => {
        if(store.hasUnsavedChanges && window.saveCurrentViewData) window.saveCurrentViewData(true);
        executeForwardDelete('stop', baseDateStr, chainId, onConfirm);
    };
    document.getElementById('btn-fwd-del-all').onclick = async () => {
        if(store.hasUnsavedChanges && window.saveCurrentViewData) window.saveCurrentViewData(true);
        executeForwardDelete('all', baseDateStr, chainId, onConfirm);
    };
};

export const executeForwardDelete = async (mode, baseDateStr, chainId, onConfirm) => {
    document.getElementById('forward-delete-modal').innerHTML = `<div style="background:#fff; padding:30px; border-radius:12px; font-weight:bold; color:#2563eb; text-align:center;">⏳ 로컬 및 동기화 처리 중...</div>`;
    const matchEvent = (e) => e.forwardChainId === chainId;

    try {
        let myGroups = [];
        // 🌟 4. window.dbAPI.loadMyGroups() -> dbAPI.loadMyGroups() 
        try { myGroups = await dbAPI.loadMyGroups(); } catch(e) {}
        // 🌟 5. window.getUserCol -> getUserCol / window.getGroupCol -> getGroupCol 로 통일
        const colsToSearch = [getUserCol('events'), ...myGroups.map(g => getGroupCol(g.id, 'events'))];

        if (window.dayViewInstance && window.dayViewInstance.currentEvents) {
            if (mode === 'all' || window.dayViewInstance.dateStr >= baseDateStr) {
               window.dayViewInstance.currentEvents = window.dayViewInstance.currentEvents.filter(e => !matchEvent(e));
            } else if (mode === 'stop') {
               window.dayViewInstance.currentEvents.forEach(e => { if (matchEvent(e)) e.completed = true; });
            }
        }
        
        Object.keys(window).forEach(key => {
            if (key.startsWith('tempEvents_')) {
                const dStr = key.replace('tempEvents_', '');
                if (mode === 'all' || dStr >= baseDateStr) window[key] = window[key].filter(e => !matchEvent(e));
                else if (mode === 'stop') window[key].forEach(e => { if (matchEvent(e)) e.completed = true; });
            }
        });

        // 🌟 6. window.db -> db 
        let batch = writeBatch(db); let count = 0; let batchPromises = []; 

        for (const col of colsToSearch) {
            const snap = await getDocs(col);
            let maxPastDateStr = '';
            
            if (mode === 'stop') {
                snap.forEach(docSnap => {
                    if (docSnap.id < baseDateStr) {
                        const list = docSnap.data().eventList || (docSnap.data().eventText && window.parseRawEventTextToEventList ? window.parseRawEventTextToEventList(docSnap.data().eventText) : []);
                        if (list.some(matchEvent)) { if (docSnap.id > maxPastDateStr) maxPastDateStr = docSnap.id; }
                    }
                });
            }

            snap.forEach(docSnap => {
                let list = docSnap.data().eventList || [];
                const origLen = list.length; let changed = false;

                if (mode === 'all') {
                    list = list.filter(e => !matchEvent(e));
                    if (list.length !== origLen) changed = true;
                } else if (mode === 'stop') {
                    if (docSnap.id >= baseDateStr) {
                        list = list.filter(e => !matchEvent(e));
                        if (list.length !== origLen) changed = true;
                    } else if (docSnap.id === maxPastDateStr) {
                        list.forEach(e => { if (matchEvent(e) && !e.completed) { e.completed = true; changed = true; } });
                    }
                }

                if (changed) {
                    let updateData = { eventList: list, updatedAt: Date.now() };
                    if (window.formatEventListToText) updateData.eventText = window.formatEventListToText(list);
                    batch.update(docSnap.ref, updateData);
                    count++;
                    if (count >= 400) { batchPromises.push(batch.commit()); batch = writeBatch(db); count = 0; } // 🌟 window.db -> db
                }
            });
        }
        if (count > 0) batchPromises.push(batch.commit());
        await Promise.all(batchPromises);

        if (window.autoForwardIncompleteEvents) window.autoForwardIncompleteEvents();
    } catch(e) { console.error("이월 삭제 오류:", e); }

    document.getElementById('forward-delete-modal')?.remove();
    if (onConfirm) onConfirm();
};

Object.assign(window, {
    autoForwardIncompleteEvents,
    showForwardDeleteModal,
    executeForwardDelete
>>>>>>> d1348ae5447b87f69a849130f4f6a30f4c5cc4fe
});