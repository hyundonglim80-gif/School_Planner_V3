// js/ui/templateHelpers.js
import { store } from '../core/store.js';
import { formatDate, getEventLabels } from '../core/utils.js';

// 🌟 [방향 B] 20초마다 브라우저 로컬 알림을 검사하는 글로벌 알림 엔진 초기화
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
            // 알림 시간이 있고(과거거나 현재), 완료되지 않았으며, 아직 알림이 울리지 않은 경우
            if (ev.time && ev.time <= currentYMDHM && !ev.completed && !ev.alarmTriggered) {
                const evTimeMs = new Date(ev.time).getTime();
                const nowMs = now.getTime();
                
                // 설정된 시간이 지났더라도 1시간(3600000ms) 이내라면 늦게라도 알려줌 (오래된 알림 폭탄 방지)
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
    // 🌟 [추가] datetime-local 텍스트를 "MM/DD HH:mm" 또는 "off" 형태로 변환하는 헬퍼
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

    generateCompactEventEditor(dateStr, fId) {
        const allEvents = window[`tempEvents_${dateStr}`] || [];
        const list = allEvents.filter(e => (e.sharedGroupId || 'personal') === fId);
        
        const labelObjs = getEventLabels();
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
            
            // 🌟 [변경됨] 날짜 및 시간이 포함된 새로운 알림 UI
            const timeVal = e.time || '';
            const timeLabel = this.formatAlarmTime(timeVal);
            const timeColor = timeVal ? '#2563eb' : '#94a3b8';
            const timeBg = timeVal ? '#eff6ff' : '#f8fafc';
            const timeBorder = timeVal ? '#bfdbfe' : '#cbd5e1';

            const timeHtml = isAuthor 
                  ? `<label style="position:relative; cursor:pointer; display:inline-flex; align-items:center; background:${timeBg}; padding:2px 6px; border-radius:4px; font-size:0.75rem; color:${timeColor}; font-weight:bold; border:1px solid ${timeBorder}; margin-right:4px;" title="알림 날짜/시간 설정 (브라우저 푸시 알림)">
                       ${timeLabel}
                       <input type="datetime-local" value="${timeVal}" onclick="if(window.Notification && Notification.permission==='default') Notification.requestPermission();" onchange="window.CompactEventHelper.updateCompactEvent('${dateStr}', '${e.id}', 'time', this.value); document.getElementById('compact-events-${dateStr}-${fId}').innerHTML = window.CompactEventHelper.generateCompactEventEditor('${dateStr}', '${fId}');" style="width:1px; height:1px; opacity:0; position:absolute; bottom:0; right:0;">
                     </label>` 
                  : `<span style="font-size:0.75rem; color:${timeColor}; font-weight:bold; background:${timeBg}; padding:2px 6px; border-radius:4px; border:1px solid ${timeBorder}; margin-right:4px;">${timeLabel}</span>`;

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
            if (field === 'time') ev.alarmTriggered = false; // 시간 변경 시 알람 리셋
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
