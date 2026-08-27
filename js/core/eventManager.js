// js/core/eventManager.js

import { store } from './store.js';
import { formatDate, parseLocalDate, getEventLabels, getLabelStyle, getSemesterDates, isSkipLabel } from './utils.js';
import { getUserCol, getGroupCol, dbAPI } from '../api/database.js';
import { auth, db } from '../api/firebaseInit.js';
import { doc, getDoc, getDocs, setDoc, query, where, documentId, writeBatch } from "firebase/firestore";

// ============================================================================
// 1. 데이터 변환 및 HTML 뱃지 생성 로직 (순수 함수)
// ============================================================================
export const parseRawEventTextToEventList = (rawText) => {
    if (!rawText || !rawText.trim()) return [];
    const lines = rawText.split('\n');
    const eventList = [];
    const masterLabels = getEventLabels();

    lines.forEach(line => {
        let t = line.trim();
        if(!t) return;

        let completed = false;
        if (t.startsWith('[v]') || t.startsWith('[V]')) {
            completed = true;
            t = t.substring(3).trim();
        }

        const match = t.match(/^\[(.*?)\]\s*(.*)$/);
        if (match) {
            let labelName = match[1].trim();
            let lObj = masterLabels.find(l => l.name === labelName);
            eventList.push({ labelIds: lObj ? [lObj.id] : [], content: match[2].trim(), completed: completed });
        } else {
            let defaultLabelIds = [];
            if (t.includes('(휴일)') || t.includes('(행사)')) {
                const skipLabel = masterLabels.find(l => l.isSkip);
                if (skipLabel) defaultLabelIds = [skipLabel.id];
            }
            eventList.push({ labelIds: defaultLabelIds, content: t, completed: completed });
        }
    });
    return eventList;
};

export const formatEventListToText = (eventList) => {
    if (!eventList || eventList.length === 0) return '';
    const masterLabels = getEventLabels();

    return eventList.map(e => {
        let labelStr = '';
        if (e.labelIds && e.labelIds.length > 0) {
            const lObj = masterLabels.find(l => l.id === e.labelIds[0]);
            if (lObj) labelStr = `[${lObj.name}] `;
        } else if (e.labels && e.labels.length > 0) { 
            labelStr = `[${e.labels[0]}] `;
        }
        return `${e.completed ? '[v] ' : ''}${labelStr}${e.content}`;
    }).join('\n');
};

export const generateEventBadgesHTML = (eventList, dateStr = null, viewType = 'normal') => {
    if (!eventList || eventList.length === 0) return '';
    let html = `<div style="display:flex; flex-direction:column; gap:4px; margin-top:2px;">`;
    const realTodayStr = formatDate(new Date()); 
    const masterLabels = getEventLabels();

    eventList.forEach((e, index) => {
        let labelIdsToRender = e.labelIds || [];
        if (labelIdsToRender.length === 0 && (e.labels || e.label)) {
            let legacyNames = e.labels || [e.label];
            legacyNames.forEach(name => {
                const match = masterLabels.find(l => l.name === name);
                if (match && match.id) labelIdsToRender.push(match.id);
            });
        }

        const isCompleted = !!e.completed;
        const canComplete = labelIdsToRender.some(id => {
            const match = masterLabels.find(l => l.id === id);
            return match && match.isForward;
        }); 
        const isSkip = labelIdsToRender.some(id => {
            const match = masterLabels.find(l => l.id === id);
            return match && match.isSkip;
        });
        const isGrouped = !!e.groupId; 

        let pureContent = (e.content || '').replace(/➡️\s*\(미완료\)/g, '').replace(/➡️\s*\(다음 날로 이월됨\)/g, '').replace(/↪️\s*/g, '').trim();
        let isMissedPast = false;
        let isForwardedToToday = false;

        if (canComplete && dateStr) {
            if (!isCompleted && dateStr < realTodayStr) isMissedPast = true;
            if (e.originalDate && e.originalDate < dateStr) isForwardedToToday = true;
        }

        let badgesHtml = '';
        if (labelIdsToRender.length > 0) {
            badgesHtml = labelIdsToRender.map(id => {
                const lObj = masterLabels.find(l => l.id === id);
                if (!lObj) return ''; 

                const style = getLabelStyle(id, 'event');
                let badgeStyle;

                if (isMissedPast) badgeStyle = `background:#fee2e2; color:#ef4444; border:2px solid #ef4444;`;
                else if (isCompleted && canComplete) badgeStyle = `background:#e2e8f0; color:#94a3b8; border:1px solid #cbd5e1; cursor:pointer;`;
                else badgeStyle = `background:${style.bg}; color:${style.text}; border:1px solid ${style.border}; ${canComplete ? 'cursor:pointer;' : ''}`;

                const onClickAttr = (dateStr && canComplete) ? `onclick="event.stopPropagation(); window.EventManager.toggleEventCompletion('${dateStr}', ${index}, ${isCompleted})"` : '';

                return `<span data-id="${id}" ${onClickAttr} style="${badgeStyle} padding:1px 5px; border-radius:4px; font-size:0.8rem; font-weight:bold; white-space:nowrap; flex-shrink:0; transition:0.2s;" title="${canComplete ? '클릭하여 완료 상태 변경' : lObj.name}">${lObj.name}</span>`;
            }).join('');
        }

        let textStyle = isSkip ? `color:#1e293b; font-weight:bold;` : 'color:#1e293b;';
        let groupIcon = isGrouped ? `<span style="font-size:0.8rem; margin-right:3px;" title="반복/기간 일정으로 묶여있습니다">🔗</span>` : '';

        if (isMissedPast) {
            textStyle = 'color:#ef4444; font-weight:bold;';
            pureContent = `${pureContent} <span style="color:#ef4444; font-weight:bold; font-size:0.85rem;">➡️ (미완료)</span>`;
        } else if (isForwardedToToday) {
            if (isCompleted) {
                textStyle = 'color:#94a3b8; text-decoration:line-through; font-style:italic;';
                pureContent = `<span style="color:#94a3b8; font-weight:bold;">↪️</span> ${pureContent}`;
            } else {
                pureContent = `<span style="color:#2563eb; font-weight:bold;">↪️</span> ${pureContent}`;
            }
        } else if (isCompleted && canComplete) {
            textStyle = 'color:#94a3b8; text-decoration:line-through; font-style:italic;';
        }

        let layoutStyle = viewType === 'compact' ? 
            `display:flex; flex-direction:column; align-items:flex-start; gap:2px; font-size:0.9rem; line-height:1.3;` : 
            `display:flex; align-items:flex-start; gap:6px; font-size:0.95rem; line-height:1.3;`;

        html += `
        <div id="evt-row-${dateStr}-${index}" style="${layoutStyle}">
            ${badgesHtml ? `<div style="display:flex; flex-wrap:wrap; gap:4px; flex-shrink:0;">${badgesHtml}</div>` : ''}
            <span id="evt-txt-${dateStr}-${index}" style="white-space:pre-wrap; word-break:break-all; ${textStyle}">${isCompleted && canComplete && !isMissedPast && !isForwardedToToday ? '✓ ' : ''}${groupIcon}${pureContent}</span>
        </div>`;
    });
    html += `</div>`;
    return html;
};

// ============================================================================
// 2. 통합 Event Manager 코어
// ============================================================================
export const EventManager = {
    // ------------------------------------------------------------------------
    // [1] 완료 토글
    // ------------------------------------------------------------------------
    toggleEventCompletion: function(dateStr, index, currentStatus) {
        const willBeComplete = !currentStatus;

        if (window.dayViewInstance && window.dayViewInstance.dateStr === dateStr && window.dayViewInstance.currentEvents) {
            if (window.dayViewInstance.currentEvents[index]) window.dayViewInstance.currentEvents[index].completed = willBeComplete;
        }
        if (window[`tempEvents_${dateStr}`] && window[`tempEvents_${dateStr}`][index]) {
            window[`tempEvents_${dateStr}`][index].completed = willBeComplete;
        }

        const rowEl = document.getElementById(`evt-row-${dateStr}-${index}`);
        if (rowEl) {
            const badges = rowEl.querySelectorAll('span[onclick*="toggleEventCompletion"]');
            badges.forEach(badge => {
                badge.setAttribute('onclick', `event.stopPropagation(); window.EventManager.toggleEventCompletion('${dateStr}', ${index}, ${willBeComplete})`);

                if (willBeComplete) {
                    badge.style.background = '#e2e8f0'; badge.style.color = '#94a3b8'; badge.style.border = '1px solid #cbd5e1';
                } else {
                    const labelId = badge.getAttribute('data-id');
                    const style = getLabelStyle(labelId, 'event');
                    if (style) { badge.style.background = style.bg; badge.style.color = style.text; badge.style.border = `1px solid ${style.border}`; }
                }
            });

            const textEl = document.getElementById(`evt-txt-${dateStr}-${index}`);
            if (textEl) {
                let inner = textEl.innerHTML;
                if (willBeComplete) {
                    textEl.style.color = '#94a3b8'; textEl.style.textDecoration = 'line-through'; textEl.style.fontStyle = 'italic';
                    if (!inner.includes('✓ ')) textEl.innerHTML = '✓ ' + inner;
                } else {
                    textEl.style.color = '#1e293b'; textEl.style.textDecoration = 'none'; textEl.style.fontStyle = 'normal';
                    if (inner.includes('✓ ')) textEl.innerHTML = inner.replace('✓ ', '');
                }
            }
        }

        setTimeout(async () => {
            try {
                const docRef = doc(getUserCol('events'), dateStr);
                const eventSnap = await getDoc(docRef);
                if (!eventSnap.exists()) return; 
                
                const data = eventSnap.data();
                let eventList = data.eventList || [];

                if (eventList.length === 0 && data.eventText) {
                    eventList = parseRawEventTextToEventList(data.eventText);
                }

                if (eventList[index]) {
                    eventList[index].completed = willBeComplete;
                    const newText = formatEventListToText(eventList);
                    await setDoc(docRef, { eventList: eventList, eventText: newText, updatedAt: Date.now() }, { merge: true });
                    if (window.autoForwardIncompleteEvents) await window.autoForwardIncompleteEvents(); // 호환성
                }
            } catch (error) { console.error("🚨 완료 상태 변경 중 오류:", error); }
        }, 0);
    },

    // ------------------------------------------------------------------------
    // [2] 자동 이월 처리 엔진
    // ------------------------------------------------------------------------
    autoForwardIncompleteEvents: async function() {
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
                let curList = curData.eventList || (curData.eventText ? parseRawEventTextToEventList(curData.eventText) : []);
                let newCurList = []; let curChanged = false;

                curList.forEach(ev => {
                    let canComplete = false;
                    if (ev.labelIds?.length > 0) { canComplete = ev.labelIds.some(id => getEventLabels().find(l => l.id === id)?.isForward); } 
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
                let nextList = nextData.eventList || (nextData.eventText ? parseRawEventTextToEventList(nextData.eventText) : []);
                let nextChanged = false;

                if (curStr < todayStr) {
                    activeChains.forEach(chainId => {
                        const existsInNext = nextList.some(n => n.forwardChainId === chainId);
                        if (!existsInNext) {
                            const sourceEv = chainEventData[chainId];
                            nextList.unshift({
                                id: 'ev_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2,5),
                                authorId: sourceEv.authorId || auth?.currentUser?.uid, 
                                labelIds: [...(sourceEv.labelIds || [])], label: sourceEv.label || '', labels: [...(sourceEv.labels || [])],
                                content: sourceEv.content, completed: false, forwardChainId: chainId, originalDate: sourceEv.originalDate,
                                groupId: sourceEv.groupId || null, sharedGroupId: sourceEv.sharedGroupId || null, groupName: sourceEv.groupName || ''
                            });
                            nextChanged = true;
                        }
                    });
                }

                if (curList.length !== newCurList.length) curChanged = true;
                if (curChanged) { eventsMap[curStr] = { ...curData, eventList: newCurList }; changedDocs.add(curStr); }
                if (nextChanged) { eventsMap[nextStr] = { ...nextData, eventList: nextList }; changedDocs.add(nextStr); }
            }

            let batch = writeBatch(db); let opCount = 0; let batchPromises = []; 

            changedDocs.forEach(dateStr => {
                const docRef = doc(getUserCol('events'), dateStr);
                const evList = eventsMap[dateStr].eventList;
                const updateData = { eventList: evList, eventText: formatEventListToText(evList), updatedAt: Date.now() };
                batch.set(docRef, updateData, { merge: true });
                opCount++;
                if (opCount >= 400){ batchPromises.push(batch.commit()); batch = writeBatch(db); opCount = 0; } 
            });

            if (opCount > 0) batchPromises.push(batch.commit());
            Promise.all(batchPromises).catch(e => console.warn(e)); 

        } catch(e) { console.error("자동 이월 처리 에러:", e); }
    },

    showForwardDeleteModal: function(baseDateStr, labelName, textContent, chainId, onConfirm) {
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
            this.executeForwardDelete('stop', baseDateStr, chainId, onConfirm);
        };
        document.getElementById('btn-fwd-del-all').onclick = async () => {
            if(store.hasUnsavedChanges && window.saveCurrentViewData) window.saveCurrentViewData(true);
            this.executeForwardDelete('all', baseDateStr, chainId, onConfirm);
        };
    },

    executeForwardDelete: async function(mode, baseDateStr, chainId, onConfirm) {
        document.getElementById('forward-delete-modal').innerHTML = `<div style="background:#fff; padding:30px; border-radius:12px; font-weight:bold; color:#2563eb; text-align:center;">⏳ 로컬 및 동기화 처리 중...</div>`;
        const matchEvent = (e) => e.forwardChainId === chainId;

        try {
            let myGroups = [];
            try { myGroups = await dbAPI.loadMyGroups(); } catch(e) {}
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

            let batch = writeBatch(db); let count = 0; let batchPromises = []; 

            for (const col of colsToSearch) {
                const snap = await getDocs(col);
                let maxPastDateStr = '';
                
                if (mode === 'stop') {
                    snap.forEach(docSnap => {
                        if (docSnap.id < baseDateStr) {
                            const list = docSnap.data().eventList || (docSnap.data().eventText ? parseRawEventTextToEventList(docSnap.data().eventText) : []);
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
                        let updateData = { eventList: list, eventText: formatEventListToText(list), updatedAt: Date.now() };
                        batch.update(docSnap.ref, updateData);
                        count++;
                        if (count >= 400) { batchPromises.push(batch.commit()); batch = writeBatch(db); count = 0; } 
                    }
                });
            }
            if (count > 0) batchPromises.push(batch.commit());
            await Promise.all(batchPromises);

            this.autoForwardIncompleteEvents();
        } catch(e) { console.error("이월 삭제 오류:", e); }

        document.getElementById('forward-delete-modal')?.remove();
        if (onConfirm) onConfirm();
    },

    // ------------------------------------------------------------------------
    // [3] 연속/기간 일정 등록 및 삭제 (multiEvent 통합)
    // ------------------------------------------------------------------------
    openPeriodModal: function(startDateStr, labelName, textContent, callback, labelId) {
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
        document.getElementById('btn-period-register').onclick = () => this.executeGroupSave(labelName, callback, 'period', labelId);
    },

    executeGroupSave: async function(labelName, callback, mode, labelId) {
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
        let batch = writeBatch(db);
        const groupId = `group_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 5)}`; 

        const targetCol = sharedGroupId ? getGroupCol(sharedGroupId, 'events') : getUserCol('events');

        for(let i=0; i<totalDays; i++) {
            const dStr = datesToSave[i];
            const docRef = doc(targetCol, dStr);
            const docSnap = await getDoc(docRef);
            let list = docSnap.exists() ? (docSnap.data().eventList || []) : [];

            list.push({ 
                id: 'ev_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2,5),
                authorId: auth?.currentUser?.uid,
                labelIds: labelId ? [labelId] : [], 
                label: labelName, labels: [labelName], 
                content: isPeriod ? `${content} (${i+1}/${totalDays})` : content, 
                completed: false, groupId: groupId, sharedGroupId: sharedGroupId 
            });
            batch.set(docRef, { eventList: list, updatedAt: Date.now() }, { merge: true });
        }

        batch.commit().catch(e => console.warn(e)); 
        document.getElementById(`${prefix}-modal`).remove();
        alert(`✅ 총 ${totalDays}개의 그룹 일정이 성공적으로 등록되었습니다.`);
        if (callback) callback(true);
    },

    showGroupDeleteModal: function(baseDateStr, labelIdOrName, textContent, groupId, onConfirm, onOnlyThisDay) {
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
        document.getElementById('btn-del-after-this').onclick = async () => { if(store.hasUnsavedChanges && window.saveCurrentViewData) window.saveCurrentViewData(true); await this.executeGroupDelete('after', baseDateStr, groupId, labelIdOrName, baseContent, onConfirm); };
        document.getElementById('btn-del-all').onclick = async () => { if(store.hasUnsavedChanges && window.saveCurrentViewData) window.saveCurrentViewData(true); await this.executeGroupDelete('all', baseDateStr, groupId, labelIdOrName, baseContent, onConfirm); };
    },

    executeGroupDelete: async function(mode, baseDateStr, groupId, labelIdOrName, baseContent, onConfirm) {
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
            try { myGroups = await dbAPI.loadMyGroups(); } catch(e) {}
            const colsToSearch = [getUserCol('events'), ...myGroups.map(g => getGroupCol(g.id, 'events'))];

            let batch = writeBatch(db); let count = 0; let batchPromises = []; 

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
                        let updateData = { eventList: list, eventText: formatEventListToText(list), updatedAt: Date.now() };
                        batch.update(docSnap.ref, updateData);
                        count++;
                        if (count >= 400) { batchPromises.push(batch.commit()); batch = writeBatch(db); count = 0; }
                    }
                });
            }
            if (count > 0) batchPromises.push(batch.commit());
            await Promise.all(batchPromises);
        } catch(e) { console.error("일괄 삭제 오류:", e); }

        document.getElementById('group-delete-modal')?.remove();
        if (onConfirm) onConfirm();
    },

    // ------------------------------------------------------------------------
    // [4] 반복 일정 (Recurring)
    // ------------------------------------------------------------------------
    currentCallback: null,
    currentLabelName: '',
    currentContent: '',
    currentStartDate: '',
    myGroups: [],

    getRecurringContentHTML: function() {
        let monthDayCheckboxes = '';
        for (let d = 1; d <= 31; d++) {
            monthDayCheckboxes += `<label style="display:inline-flex; align-items:center; gap:2px; font-size:0.85rem; width:48px; cursor:pointer;"><input type="checkbox" class="rec-month-day-check" value="${d}"> ${d}일</label>`;
        }
        return `
          <div class="modal-info-box" style="margin-top:0; background:#f8fafc; border-left-color:#2563eb; display:flex; flex-direction:column; gap:10px;">
            <div style="display:flex; gap:10px; align-items:center;">
              <span style="font-weight:bold; width:80px; color:#1e40af; font-size:0.95rem;">일정 내용:</span>
              <input type="text" id="recur-content" value="${this.currentContent}" placeholder="예: 학년 협의회, 부장 회의, 안전점검" class="modal-input-text" style="flex:1; padding:8px; border:1px solid #cbd5e1; border-radius:6px; font-size:0.95rem;">
            </div>
          </div>
          <div class="modal-info-box alt">
            <h4 style="margin-top:0; margin-bottom:10px; color:#16a34a; border-bottom:1px solid #bbf7d0; padding-bottom:5px;">🔄 1. 반복 조건 설정</h4>
            <div style="display:flex; gap:15px; margin-bottom:12px; align-items:center; flex-wrap:wrap;">
              <span style="font-weight:bold; width:80px; color:#334155;">반복 주기:</span>
              <label style="cursor:pointer; font-weight:bold; color:#1e293b;"><input type="radio" name="rec-type" value="weekly" checked onchange="window.EventManager.toggleRecType('weekly')"> 매주</label>
              <label style="cursor:pointer; font-weight:bold; color:#1e293b;"><input type="radio" name="rec-type" value="biweekly" onchange="window.EventManager.toggleRecType('weekly')"> 격주 (2주 마다)</label>
              <label style="cursor:pointer; font-weight:bold; color:#1e293b;"><input type="radio" name="rec-type" value="monthly" onchange="window.EventManager.toggleRecType('monthly')"> 매월 (날짜 여러 개)</label>
            </div>
            <div id="rec-weekly-options" style="display:flex; gap:12px; align-items:center; background:#fff; padding:10px; border-radius:6px; border:1px solid #cbd5e1;">
              <span style="font-weight:bold; color:#475569; font-size:0.9rem;">반복 요일:</span>
              <label style="cursor:pointer;"><input type="checkbox" class="rec-day-check" value="1"> 월</label><label style="cursor:pointer;"><input type="checkbox" class="rec-day-check" value="2"> 화</label><label style="cursor:pointer;"><input type="checkbox" class="rec-day-check" value="3"> 수</label><label style="cursor:pointer;"><input type="checkbox" class="rec-day-check" value="4"> 목</label><label style="cursor:pointer;"><input type="checkbox" class="rec-day-check" value="5"> 금</label>
            </div>
            <div id="rec-monthly-options" style="display:none; flex-direction:column; gap:10px; background:#fff; padding:12px; border-radius:6px; border:1px solid #cbd5e1;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-weight:bold; color:#475569; font-size:0.9rem;">매월 반복할 날짜 선택:</span>
                <div style="display:flex; gap:4px;">
                  <button onclick="window.EventManager.selectMonthDays([1, 15])" style="font-size:0.75rem; padding:2px 6px; background:#f1f5f9; border:1px solid #cbd5e1; border-radius:4px; cursor:pointer;">1일,15일</button>
                  <button onclick="window.EventManager.selectMonthDays([1, 10, 20])" style="font-size:0.75rem; padding:2px 6px; background:#f1f5f9; border:1px solid #cbd5e1; border-radius:4px; cursor:pointer;">10일 간격</button>
                  <button onclick="window.EventManager.selectMonthDays([])" style="font-size:0.75rem; padding:2px 6px; background:#fee2e2; color:#ef4444; border:1px solid #fca5a5; border-radius:4px; cursor:pointer;">초기화</button>
                </div>
              </div>
              <div style="display:flex; flex-wrap:wrap; gap:6px 10px; max-height:120px; overflow-y:auto; padding:4px;">${monthDayCheckboxes}</div>
            </div>
          </div>
          <div class="modal-info-box">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; border-bottom:1px solid #bfdbfe; padding-bottom:5px;">
              <h4 style="margin:0; color:#1e40af;">📅 2. 적용 기간 지정</h4>
              <div style="display:flex; gap:6px;">
                <button onclick="window.EventManager.setQuickRange('sem1')" style="padding:2px 8px; font-size:0.8rem; background:#dbeafe; color:#1e40af; border:1px solid #93c5fd; border-radius:4px; cursor:pointer; font-weight:bold;">1학기</button>
                <button onclick="window.EventManager.setQuickRange('sem2')" style="padding:2px 8px; font-size:0.8rem; background:#dbeafe; color:#1e40af; border:1px solid #93c5fd; border-radius:4px; cursor:pointer; font-weight:bold;">2학기</button>
                <button onclick="window.EventManager.setQuickRange('year')" style="padding:2px 8px; font-size:0.8rem; background:#e0e7ff; color:#3730a3; border:1px solid #a5b4fc; border-radius:4px; cursor:pointer; font-weight:bold;">전체 학년도</button>
              </div>
            </div>
            <div style="display:flex; align-items:center; gap:10px;">
              <input type="date" id="recur-start" class="modal-input-text" style="flex:1; padding:8px;">
              <span style="font-weight:bold; color:#64748b;">~</span>
              <input type="date" id="recur-end" class="modal-input-text" style="flex:1; padding:8px;">
            </div>
            <div style="margin-top:10px;">
              <label style="cursor:pointer; font-size:0.88rem; color:#ef4444; font-weight:bold; display:flex; align-items:center; gap:4px;">
                <input type="checkbox" id="rec-skip-holidays" checked accent-color="#ef4444"> 🛡️ 휴일 및 수업삭제(행사/방학) 날짜는 자동으로 건너뛰기
              </label>
            </div>
          </div>
          <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:15px;">
            <button id="btn-recur-cancel" class="modal-btn-secondary" style="background:#f1f5f9; color:#475569; border:1px solid #cbd5e1; font-weight:bold;">취소</button>
            <button id="btn-recur-execute" class="modal-btn-primary" style="background:#16a34a; border-color:#15803d; font-weight:bold;">🚀 반복 일정 등록</button>
          </div>
        `;
    },

    openRecurringModal: async function(startDateStr, labelName, textContent, callback, labelId) {
        this.currentLabelName = labelName || '';
        this.currentContent = textContent || '';
        this.currentStartDate = startDateStr || formatDate(new Date());
        this.currentCallback = callback;

        try { this.myGroups = await dbAPI.loadMyGroups(); } catch(e) { this.myGroups = []; }

        const existingModal = document.getElementById('recurring-event-modal');
        if (existingModal) existingModal.remove();

        const wrapper = document.createElement('div');
        wrapper.innerHTML = `
        <div id="recurring-event-modal" class="modal-overlay" style="display:flex; position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.5); z-index:10005; justify-content:center; align-items:center;">
            <div class="modal-content" style="width:540px; padding:25px; background:#fff; border-radius:12px; box-shadow:0 10px 25px rgba(0,0,0,0.2);">
                <h3 style="margin-top:0; color:#16a34a; border-bottom:2px solid #bbf7d0; padding-bottom:10px;">🔁 [${this.currentLabelName}] 반복 일정 등록</h3>
                ${this.getRecurringContentHTML()}
            </div>
        </div>`;
        document.body.appendChild(wrapper.firstElementChild);

        document.getElementById('btn-recur-cancel').onclick = () => this.cancelRecurring();
        document.getElementById('btn-recur-execute').onclick = () => this.executeRecurringBatch(labelId);

        document.getElementById('recurring-event-modal').addEventListener('click', (e) => {
            if(e.target.id === 'recurring-event-modal') this.cancelRecurring();
        });

        document.getElementById('recur-start').value = this.currentStartDate;
        
        const startD = parseLocalDate(this.currentStartDate);
        const dayOfWeek = startD.getDay();
        if(dayOfWeek >= 1 && dayOfWeek <= 5) {
            const cb = document.querySelector(`.rec-day-check[value="${dayOfWeek}"]`);
            if(cb) cb.checked = true;
        }
        if (window.loadGlobalPreferences) await window.loadGlobalPreferences();
        this.setQuickRange('sem1');
    },

    cancelRecurring: function() {
        document.getElementById('recurring-event-modal')?.remove();
        if (this.currentCallback) this.currentCallback(false);
    },

    toggleRecType: function(type) {
        document.getElementById('rec-weekly-options').style.display = type === 'weekly' ? 'flex' : 'none';
        document.getElementById('rec-monthly-options').style.display = type === 'monthly' ? 'flex' : 'none';
    },

    selectMonthDays: function(daysArr) {
        document.querySelectorAll('.rec-month-day-check').forEach(cb => { cb.checked = daysArr.includes(parseInt(cb.value, 10)); });
    },

    setQuickRange: function(type) {
        const dates = getSemesterDates();
        const startInput = document.getElementById('recur-start');
        const endInput = document.getElementById('recur-end');
        if (!store.semesterConfig || !store.semesterConfig.sem1Start) alert("💡 팁: '기준 시간표 관리'에서 학사일정(학기)을 먼저 저장하시면, 이 버튼을 통해 날짜를 자동으로 불러올 수 있습니다!");
        if (type === 'sem1') { startInput.value = dates.sem1Start || ''; endInput.value = dates.sem1End || ''; } 
        else if (type === 'sem2') { startInput.value = dates.sem2Start || ''; endInput.value = dates.sem2End || ''; } 
        else if (type === 'year') { startInput.value = dates.yearStart || ''; endInput.value = dates.yearEnd || ''; }
    },

    executeRecurringBatch: async function(labelId) {
        const content = document.getElementById('recur-content')?.value.trim() || '';
        const startStr = document.getElementById('recur-start').value;
        const endStr = document.getElementById('recur-end').value;
        const skipHolidays = document.getElementById('rec-skip-holidays').checked;
        const targetSharedGroupId = document.getElementById('recur-shared-group')?.value || null;

        if (!content) return alert("일정 내용을 입력해주세요.");
        if (!startStr || !endStr) return alert("시작 날짜와 종료 날짜를 모두 선택해주세요.");

        const startDate = parseLocalDate(startStr); const endDate = parseLocalDate(endStr);
        if (startDate > endDate) return alert("시작 날짜가 종료 날짜보다 늦을 수 없습니다.");

        const recType = document.querySelector('input[name="rec-type"]:checked').value;
        const targetDates = []; let cur = new Date(startDate);

        if (recType === 'weekly' || recType === 'biweekly') {
            const selectedDays = Array.from(document.querySelectorAll('.rec-day-check:checked')).map(cb => parseInt(cb.value, 10));
            if (selectedDays.length === 0) return alert("반복할 요일을 하나 이상 선택해주세요.");
            const startSun = new Date(startDate); startSun.setDate(startDate.getDate() - startDate.getDay());
            while (cur <= endDate) {
                if (selectedDays.includes(cur.getDay())) {
                    if (recType === 'weekly') targetDates.push(formatDate(cur));
                    else if (recType === 'biweekly') {
                        const tempSun = new Date(cur); tempSun.setDate(cur.getDate() - cur.getDay());
                        if (Math.floor(Math.round((tempSun - startSun) / (1000 * 60 * 60 * 24)) / 7) % 2 === 0) targetDates.push(formatDate(cur));
                    }
                }
                cur.setDate(cur.getDate() + 1);
            }
        } else if (recType === 'monthly') {
            const selectedDays = Array.from(document.querySelectorAll('.rec-month-day-check:checked')).map(cb => parseInt(cb.value, 10));
            if (selectedDays.length === 0) return alert("매월 반복할 날짜를 하나 이상 선택해주세요.");
            while (cur <= endDate) {
                if (selectedDays.includes(cur.getDate())) targetDates.push(formatDate(cur));
                cur.setDate(cur.getDate() + 1);
            }
        }

        if (targetDates.length === 0) return alert("조건에 해당하는 날짜가 지정한 기간 내에 없습니다.");
        if (!confirm(`총 ${targetDates.length}일의 반복 일정을 클라우드에 등록하시겠습니까?`)) return;

        const recurringGroupId = `group_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 5)}`;
        document.getElementById('recurring-event-modal').innerHTML = `<div style="background:#fff; padding:40px; border-radius:12px; font-weight:bold; color:#16a34a; text-align:center;">⏳ 클라우드에 일괄 등록 중...</div>`;

        try {
            const targetCol = targetSharedGroupId ? getGroupCol(targetSharedGroupId, 'events') : getUserCol('events');
            const eventSnap = await getDocs(targetCol);
            const existingEventsMap = {};
            eventSnap.forEach(docSnap => { existingEventsMap[docSnap.id] = docSnap.data(); });

            let batch = writeBatch(db); let opCount = 0; let batchPromises = [];
            let addedCount = 0; let skippedCount = 0;

            for (const dateStr of targetDates) {
                const docData = existingEventsMap[dateStr] || {};
                let list = docData.eventList || [];
                if (list.length === 0 && docData.eventText) list = parseRawEventTextToEventList(docData.eventText);

                if (skipHolidays) {
                    if (list.some(ev => isSkipLabel(ev.label) || (ev.labels && ev.labels.some(l => isSkipLabel(l))))) { skippedCount++; continue; }
                }

                if (!list.some(ev => (ev.label === this.currentLabelName || (ev.labels && ev.labels.includes(this.currentLabelName))) && ev.content === content)) {
                    list.push({ 
                        id: 'ev_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2,5),
                        authorId: auth?.currentUser?.uid,
                        labelIds: labelId ? [labelId] : [], 
                        label: this.currentLabelName, labels: [this.currentLabelName], 
                        content: content, completed: false,
                        groupId: recurringGroupId, sharedGroupId: targetSharedGroupId 
                    });

                    const docRef = doc(targetCol, dateStr);
                    batch.set(docRef, { eventList: list, eventText: formatEventListToText(list), updatedAt: Date.now() }, { merge: true });
                    
                    addedCount++; opCount++;
                    if (opCount >= 400) { batchPromises.push(batch.commit()); batch = writeBatch(db); opCount = 0; }
                } else skippedCount++;
            }

            if (opCount > 0) batchPromises.push(batch.commit());
            await Promise.all(batchPromises);

            document.getElementById('recurring-event-modal')?.remove();
            alert(`✅ 성공적으로 등록 완료되었습니다!\n- 등록: ${addedCount}건\n- 건너뜀(휴일/중복): ${skippedCount}건`);
            if (this.currentCallback) this.currentCallback(true);
        } catch (e) { console.error("반복 일정 등록 오류:", e); alert("일정 등록 도중 오류가 발생했습니다."); }
    }
};