// js/ui/templateHelpers.js
import { store } from '../core/store.js';
import { formatDate, getEventLabels } from '../core/utils.js';

if (typeof window !== 'undefined' && 'Notification' in window && !window.alarmCheckerInterval) {
    window.alarmCheckerInterval = setInterval(() => {
        if (Notification.permission !== 'granted') return;
        const now = new Date();
        const currentYMDHM = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}T${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
        
        let activeEvents = [];
        const currentYMD = currentYMDHM.split('T')[0];
        
        if (window[`tempEvents_${currentYMD}`]) {
            activeEvents.push(...window[`tempEvents_${currentYMD}`]);
        }
        if (window.dayViewInstance && window.dayViewInstance.dateStr === currentYMD && window.dayViewInstance.dayData) {
            Object.values(window.dayViewInstance.dayData).forEach(d => {
                if (d.events) activeEvents.push(...d.events);
            });
        }
        
        const uniqueEvents = Array.from(new Map(activeEvents.map(e => [e.id, e])).values());

        uniqueEvents.forEach(ev => {
            if (ev.time && ev.time <= currentYMDHM && !ev.completed && !ev.alarmTriggered) {
                const evTimeMs = new Date(ev.time).getTime();
                const nowMs = now.getTime();
                
                if (nowMs >= evTimeMs && nowMs - evTimeMs < 3600000) {
                    ev.alarmTriggered = true; 
                    new Notification('⏰ 일정 알림', {
                        body: ev.content || '예정된 일정이 있습니다.',
                        icon: 'https://cdn-icons-png.flaticon.com/512/2693/2693507.png'
                    });
                }
            }
        });
    }, 20000); 
}

export const CompactEventHelper = {
    formatAlarmTime(datetimeStr) {
        if (!datetimeStr) return '⏰ off';
        const d = new Date(datetimeStr);
        if (isNaN(d.getTime())) return '⏰ off';
        const m = String(d.getMonth()+1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const h = String(d.getHours()).padStart(2, '0');
        const min = String(d.getMinutes()).padStart(2, '0');
        return `⏰ ${m}/${day} ${h}:${min}`;
    },

    // 🌟 [추가됨] 날짜와 시간을 조합하여 저장 (시간은 24시간제 텍스트 자동 변환)
    updateDateTime(dateStr, eventId, fId, dVal, tVal) {
        store.hasUnsavedChanges = true;
        const ev = window[`tempEvents_${dateStr}`]?.find(e => e.id === eventId);
        if (ev) {
            if (!dVal && (!tVal || tVal.trim() === '')) {
                ev.time = '';
            } else {
                let finalT = (tVal || '').trim().replace(/[^0-9:]/g, '');
                // 1430 처럼 치면 자동으로 14:30으로 변환
                if (/^\d{3,4}$/.test(finalT.replace(':', ''))) {
                    let cleanNum = finalT.replace(':', '');
                    if (cleanNum.length === 3) finalT = '0' + cleanNum[0] + ':' + cleanNum.substring(1);
                    else finalT = cleanNum.substring(0,2) + ':' + cleanNum.substring(2);
                }
                if (!finalT || finalT.length < 4) finalT = '09:00'; 
                ev.time = `${dVal || dateStr}T${finalT}`;
            }
            ev.alarmTriggered = false; 
        }
        document.getElementById(`compact-events-${dateStr}-${fId}`).innerHTML = this.generateCompactEventEditor(dateStr, fId);
    },

    generateCompactEventEditor(dateStr, fId) {
        const allEvents = window[`tempEvents_${dateStr}`] || [];
        let list = allEvents.filter(e => (e.sharedGroupId || 'personal') === fId);
        
        const labelObjs = getEventLabels();
        
        // 🌟 [추가됨] 설정된 라벨 순서대로 정렬 로직
        list.sort((a, b) => {
            const aRank = labelObjs.findIndex(l => l.id === a.labelIds?.[0]);
            const bRank = labelObjs.findIndex(l => l.id === b.labelIds?.[0]);
            return (aRank === -1 ? 999 : aRank) - (bRank === -1 ? 999 : bRank);
        });

        const realTodayStr = formatDate(new Date());
        const uid = window.auth?.currentUser?.uid;
        
        return list.map((e) => {
            if (!e.id) e.id = 'ev_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2,5);

            const isAuthor = !e.authorId || !uid || e.authorId === uid;
            const eLabelIds = e.labelIds || [];
            const isCompleted = !!e.completed;
            const canComplete = eLabelIds.some(id => labelObjs.find(l => l.id === id)?.isForward);

            let warningIcon = '';
            if (canComplete) {
                if (!isCompleted && dateStr < realTodayStr) warningIcon = `<span style="color:#ef4444; font-weight:bold; font-size:0.8rem; margin-left:8px; align-self:center;">➡️ (미완료)</span>`;
                else if (e.originalDate && e.originalDate < dateStr) warningIcon = `<span style="color:#2563eb; font-weight:bold; font-size:0.8rem; margin-left:8px; align-self:center;">↪️ (이월됨)</span>`;
            }

            const chipsHtml = labelObjs.map(lObj => {
                const chipClickAttr = isAuthor ? `onclick="window.CompactEventHelper.handleCompactLabelClick('${dateStr}', '${e.id}', '${lObj.id}', '${fId}')"` : '';
                const chipCursorStyle = isAuthor ? 'cursor:pointer;' : 'cursor:not-allowed; opacity:0.8;';
                return `<div class="label-chip ${eLabelIds.includes(lObj.id) ? 'active' : ''}" ${chipClickAttr} style="padding:2px 8px; font-size:0.8rem; min-width:auto; ${chipCursorStyle}">${lObj.name}</div>`;
            }).join('') + warningIcon;

            const checkboxHtml = canComplete 
                ? `<input type="checkbox" ${isCompleted ? 'checked' : ''} ${!isAuthor ? 'disabled' : ''} onchange="window.CompactEventHelper.updateCompactEvent('${dateStr}', '${e.id}', 'completed', this.checked); document.getElementById('compact-events-${dateStr}-${fId}').innerHTML = window.CompactEventHelper.generateCompactEventEditor('${dateStr}', '${fId}');" style="width:18px; height:18px; cursor:pointer; accent-color:#059669;" title="완료 체크">`
                : '';

            const textBaseStyle = (isCompleted && canComplete) ? 'text-decoration:line-through; color:#94a3b8; background:#e2e8f0;' : 'background:#fff; color:#1e293b;';
            const textStyle = !isAuthor ? 'background:#f1f5f9; color:#64748b; cursor:not-allowed;' : textBaseStyle;
            const pureContent = (e.content || '').replace(/➡️\s*\(미완료\)/g, '').replace(/➡️\s*\(다음 날로 이월됨\)/g, '').replace(/↪️\s*/g, '').trim();

            const deleteBtnHtml = isAuthor 
                  ? `<button onclick="window.CompactEventHelper.requestRemoveCompactEvent('${dateStr}', '${e.id}', '${fId}')" style="background:none; border:none; color:#ef4444; font-size:1.1rem; cursor:pointer; padding:0; line-height:1;" title="삭제">✖</button>`
                  : '';
            
            // 🌟 [개선됨] 날짜(달력)와 시간(타이핑) 입력 폼 분리
            const timeVal = e.time || '';
            let dVal = '', tVal = '';
            if (timeVal) {
                const parts = timeVal.split('T');
                dVal = parts[0]; tVal = parts[1] || '';
            }

            const timeColor = timeVal ? '#2563eb' : '#94a3b8';
            const timeBg = timeVal ? '#eff6ff' : '#f8fafc';
            const timeBorder = timeVal ? '#bfdbfe' : '#cbd5e1';

            const timeHtml = isAuthor 
                  ? `<div style="display:inline-flex; align-items:center; background:${timeBg}; padding:2px 4px; border-radius:4px; border:1px solid ${timeBorder}; margin-right:4px;" title="알림 설정 (날짜 선택 + 시간 직접 입력)">
                       <span style="font-size:0.75rem; font-weight:bold; color:${timeColor}; margin-right:4px; cursor:pointer;" onclick="if(window.Notification && Notification.permission==='default') Notification.requestPermission();">${timeVal ? '⏰' : '⏰ off'}</span>
                       <input type="date" id="date-${e.id}" value="${dVal}" onchange="window.CompactEventHelper.updateDateTime('${dateStr}', '${e.id}', '${fId}', this.value, document.getElementById('time-${e.id}').value)" style="border:none; background:transparent; font-size:0.75rem; color:${timeColor}; outline:none; cursor:pointer; padding:0; width:100px;">
                       <input type="text" id="time-${e.id}" value="${tVal}" placeholder="HH:MM" maxlength="5" onblur="window.CompactEventHelper.updateDateTime('${dateStr}', '${e.id}', '${fId}', document.getElementById('date-${e.id}').value, this.value)" onkeydown="if(event.key==='Enter') this.blur();" style="border:none; background:transparent; font-size:0.75rem; color:${timeColor}; outline:none; padding:0; width:45px; text-align:center; margin-left:4px;">
                       ${timeVal ? `<button onclick="window.CompactEventHelper.updateDateTime('${dateStr}', '${e.id}', '${fId}', '', '')" style="background:none; border:none; color:#ef4444; font-size:0.8rem; cursor:pointer; margin-left:4px; padding:0; line-height:1;">✖</button>` : ''}
                     </div>` 
                  : `<span style="font-size:0.75rem; color:${timeColor}; font-weight:bold; background:${timeBg}; padding:2px 6px; border-radius:4px; border:1px solid ${timeBorder}; margin-right:4px;">${this.formatAlarmTime(timeVal)}</span>`;

            return `
            <div class="compact-event-row" style="display:flex; border:1px solid #cbd5e1; border-radius:6px; padding:8px; margin-bottom:8px; background:#f8fafc; flex-direction:column; gap:6px; transition:0.2s;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <div class="label-chip-container" style="margin:0; display:flex; flex-wrap:wrap; gap:4px; align-items:center; flex:1;">
                        ${chipsHtml}
                    </div>
                    <div style="display:flex; align-items:center; gap:8px; flex-shrink:0;">
                        ${timeHtml}
                        ${deleteBtnHtml}
                    </div>
                </div>
                <div style="display:flex; align-items:flex-start; gap:8px; width:100%;">
                    ${checkboxHtml}
                    <textarea data-id="${e.id}" ${!isAuthor ? 'readonly' : ''} placeholder="${isAuthor ? '일정 내용을 입력하세요.' : '권한이 없습니다.'}" style="flex:1; padding:6px 8px; font-size:0.95rem; border:1px solid #cbd5e1; border-radius:4px; outline:none; resize:none; min-height:40px; box-sizing:border-box; ${textStyle}" onfocus="this.style.height = this.scrollHeight + 'px';" oninput="this.style.height = '40px'; this.style.height = this.scrollHeight + 'px'; window.CompactEventHelper.updateCompactEvent('${dateStr}', '${e.id}', 'content', this.value)">${pureContent}</textarea>
                </div>
            </div>`;
        }).join('');
    },

    syncCompactEventInputs(dateStr) {
        (window.activeUnifiedFilters || []).forEach(fId => {
            const container = document.getElementById(`compact-events-${dateStr}-${fId}`);
            if (!container) return;
            container.querySelectorAll('textarea').forEach(ta => {
                const eventId = ta.getAttribute('data-id');
                const ev = window[`tempEvents_${dateStr}`]?.find(e => e.id === eventId);
                if (ev) {
                    ev.content = ta.value;
                }
            });
        });
    },

    syncScheduleInputs(rowAttr, cellClass) {
        document.querySelectorAll(`tr[${rowAttr}]`).forEach(row => {
            const dateStr = row.getAttribute(rowAttr);
            const fId = row.getAttribute('data-fid');
            
            window[`tempSchedules_${dateStr}`] = window[`tempSchedules_${dateStr}`] || {};
            window[`tempSchedules_${dateStr}`][fId] = window[`tempSchedules_${dateStr}`][fId] || {};

            row.querySelectorAll(`.${cellClass}`).forEach(cell => {
                const p = cell.getAttribute("data-p");
                let text = cell.innerText?.trim() || "";
                let subject = '', memo = '', supplies = '';

                if (text !== '') {
                    const allBrackets = text.match(/\[.*?\]/g);
                    if (allBrackets && allBrackets.length >= 2) {
                        const lastMatch = text.match(/\[([^\]]+)\]\s*$/);
                        supplies = lastMatch ? lastMatch[1].trim() : "";
                        text = text.replace(/\[([^\]]+)\]\s*$/, '').trim(); 
                    }
                    const firstMatch = text.match(/^\[(.*?)\]/);
                    if (firstMatch) {
                        subject = firstMatch[1].trim();
                        memo = text.replace(/^\[(.*?)\]\s*/, '').trim();
                    } else {
                        memo = text;
                    }
                }
                window[`tempSchedules_${dateStr}`][fId][p] = { subject: subject.toUpperCase() === 'X' ? '' : subject, memo, supplies };
            });
        });
    },

    updateCompactEvent(dateStr, eventId, field, value) {
        store.hasUnsavedChanges = true;
        const ev = window[`tempEvents_${dateStr}`]?.find(e => e.id === eventId);
        if (ev) {
            ev[field] = value;
        }
    },

    addCompactEvent(dateStr, fId) {
        this.syncCompactEventInputs(dateStr); 
        store.hasUnsavedChanges = true;
        window[`tempEvents_${dateStr}`] = window[`tempEvents_${dateStr}`] || [];
        
        const masterLabels = getEventLabels();
        const defaultLabelId = masterLabels.length > 0 ? masterLabels[0].id : null;
        
        window[`tempEvents_${dateStr}`].push({ 
            id: 'ev_' + Date.now() + Math.random().toString(36).substr(2,5),
            authorId: window.auth?.currentUser?.uid,
            labelIds: defaultLabelId ? [defaultLabelId] : [], 
            content: '', completed: false, sharedGroupId: fId === 'personal' ? null : fId 
        });
        document.getElementById(`compact-events-${dateStr}-${fId}`).innerHTML = this.generateCompactEventEditor(dateStr, fId);
    },

    requestRemoveCompactEvent(dateStr, eventId, fId) {
        this.syncCompactEventInputs(dateStr); 
        const evList = window[`tempEvents_${dateStr}`];
        const ev = evList?.find(e => e.id === eventId);
        if (!ev) return;

        const isGrouped = !!ev.groupId; 
        
        const labelObjs = getEventLabels();
        const forwardLabelId = (ev.labelIds || []).find(id => labelObjs.find(l => l.id === id)?.isForward);
        const forwardLabelName = forwardLabelId ? labelObjs.find(l=>l.id===forwardLabelId).name : '';

        if (isGrouped && ev.groupId.startsWith('group_')) {
            window.showGroupDeleteModal(dateStr, ev.labelIds[0] || '', ev.content, ev.groupId, 
                () => window.render(), 
                () => this.removeCompactEvent(dateStr, eventId, fId)
            );
        } else if (forwardLabelId && ev.forwardChainId) {
            window.showForwardDeleteModal(dateStr, forwardLabelName, ev.content, ev.forwardChainId, () => window.render());
        } else {
            this.removeCompactEvent(dateStr, eventId, fId);
        }
    },

    removeCompactEvent(dateStr, eventId, fId) {
        store.hasUnsavedChanges = true;
        const evList = window[`tempEvents_${dateStr}`];
        const evIndex = evList.findIndex(e => e.id === eventId);
        if (evIndex !== -1) {
            evList.splice(evIndex, 1);
        }
        
        (window.activeUnifiedFilters || []).forEach(filterId => {
            const container = document.getElementById(`compact-events-${dateStr}-${filterId}`);
            if (container) {
                container.innerHTML = this.generateCompactEventEditor(dateStr, filterId);
            }
        });
    },

    async handleCompactLabelClick(dateStr, eventId, labelId, fId) {
        this.syncCompactEventInputs(dateStr);
        
        const evList = window[`tempEvents_${dateStr}`];
        const ev = evList?.find(e => e.id === eventId);
        if (!ev) return;
        ev.labelIds = ev.labelIds || [];
        
        const isActive = ev.labelIds.includes(labelId);
        const labelObj = getEventLabels().find(l => l.id === labelId);

        if (isActive) {
            ev.labelIds = ev.labelIds.filter(id => id !== labelId);
            store.hasUnsavedChanges = true;
            (window.activeUnifiedFilters || []).forEach(filterId => {
                const container = document.getElementById(`compact-events-${dateStr}-${filterId}`);
                if (container) container.innerHTML = this.generateCompactEventEditor(dateStr, filterId);
            });
        } else {
            if (labelObj?.isPeriod || labelObj?.isRecur) {
                const evContent = ev.content || '';
                
                const scopeInstance = window[`${store.scope}ViewInstance`];
                if (scopeInstance && typeof scopeInstance.syncScheduleInputs === 'function') {
                    scopeInstance.syncScheduleInputs();
                }

                const currentIdx = window[`tempEvents_${dateStr}`].findIndex(e => e.id === eventId);
                let removedEvent = null;
                if (currentIdx !== -1) {
                    removedEvent = window[`tempEvents_${dateStr}`].splice(currentIdx, 1)[0];
                }

                (window.activeUnifiedFilters || []).forEach(filterId => {
                    const container = document.getElementById(`compact-events-${dateStr}-${filterId}`);
                    if (container) container.innerHTML = this.generateCompactEventEditor(dateStr, filterId);
                });

                if (scopeInstance && typeof scopeInstance.save === 'function') {
                    await scopeInstance.save();
                }
                store.hasUnsavedChanges = false; 

                const callback = async (success) => { 
                    store.hasUnsavedChanges = false;
                    if (!success && removedEvent) {
                        window[`tempEvents_${dateStr}`].push(removedEvent);
                        if (scopeInstance && typeof scopeInstance.save === 'function') {
                            await scopeInstance.save();
                        }
                    }
                    if (typeof window.render === 'function') window.render(true);
                };

                labelObj.isPeriod 
                    ? window.openPeriodModal(dateStr, labelObj.name, evContent, callback, labelId)
                    : window.openRecurringModal(dateStr, labelObj.name, evContent, callback, labelId);
                return; 
            }
            
            ev.labelIds.push(labelId);
            store.hasUnsavedChanges = true;
            
            (window.activeUnifiedFilters || []).forEach(filterId => {
                const container = document.getElementById(`compact-events-${dateStr}-${filterId}`);
                if (container) container.innerHTML = this.generateCompactEventEditor(dateStr, filterId);
            });
        }
    }
};

window.CompactEventHelper = CompactEventHelper;
