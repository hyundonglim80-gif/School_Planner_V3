// js/ui/templateHelpers.js

import { store } from '../core/store.js';
import { formatDate, getEventLabels } from '../core/utils.js';

// 🌟 안전하게 로그인 정보를 가져오는 헬퍼 함수
const getCurrentUser = () => {
    return window.auth?.currentUser || null;
};

window.showCustomAlarmPopup = function(messages) {
    let popup = document.getElementById('sp3-super-alarm-popup');
    
    if (!popup) {
        const style = document.createElement('style');
        style.innerHTML = `
            @keyframes extremeBlink {
                0% { background-color: #ef4444; color: #ffffff; transform: translate(-50%, -50%) scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
                50% { background-color: #fef08a; color: #b91c1c; transform: translate(-50%, -50%) scale(1.05); box-shadow: 0 0 80px 30px rgba(239, 68, 68, 0.9); }
                100% { background-color: #ef4444; color: #ffffff; transform: translate(-50%, -50%) scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
            }
            .super-alarm-overlay {
                position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                background: rgba(0,0,0,0.85); z-index: 9999999; display: none; 
            }
            .super-alarm-content {
                position: absolute; top: 50%; left: 50%; width: 80vw; min-height: 60vh; max-height: 90vh;
                border-radius: 30px; border: 10px solid #fef08a;
                display: flex; flex-direction: column; justify-content: center; align-items: center;
                animation: extremeBlink 0.6s infinite; text-align: center; padding: 40px; overflow-y: auto;
            }
        `;
        document.head.appendChild(style);

        popup = document.createElement('div');
        popup.id = 'sp3-super-alarm-popup';
        popup.className = 'super-alarm-overlay';
        
        popup.innerHTML = `
            <div class="super-alarm-content">
                <div style="font-size: 8rem; margin-bottom: 20px; text-shadow: 0 4px 10px rgba(0,0,0,0.5);">⏰</div>
                <div id="sp3-super-alarm-text" style="font-size: 3rem; font-weight: 900; margin-bottom: 50px; line-height: 1.4; word-break: keep-all; text-shadow: 0 2px 4px rgba(0,0,0,0.3);">
                </div>
                <button onclick="document.getElementById('sp3-super-alarm-popup').style.display='none'" data-shortcut-added="true"
                        style="padding: 25px 80px; font-size: 2.5rem; font-weight: 900; border: 5px solid #fff; border-radius: 20px; background: #0f172a; color: #f8fafc; cursor: pointer; box-shadow: 0 10px 25px rgba(0,0,0,0.6); transition: 0.2s;">
                    확 인 (알림 끄기)
                </button>
            </div>
        `;
        document.body.appendChild(popup);
    }
    
    const textContainer = document.getElementById('sp3-super-alarm-text');
    if (textContainer) {
        textContainer.innerHTML = messages.map(m => `<div>🚨 ${m.replace(/\n/g, '<br>')}</div>`).join('<hr style="border:2px dashed rgba(255,255,255,0.5); margin:30px 0;">');
    }
    popup.style.display = 'block';
};

if (typeof window !== 'undefined' && !window.alarmCheckerInterval) {
    window.alarmCheckerInterval = setInterval(() => {
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
        let alarmMessages = [];

        uniqueEvents.forEach(ev => {
            if (ev.time && ev.time <= currentYMDHM && !ev.completed && !ev.alarmTriggered) {
                const evTimeMs = new Date(ev.time).getTime();
                const nowMs = now.getTime();
                
                if (nowMs >= evTimeMs && nowMs - evTimeMs < 3600000) {
                    ev.alarmTriggered = true; 
                    alarmMessages.push(ev.content || '예정된 일정이 있습니다.');
                }
            }
        });

        if (alarmMessages.length > 0) {
            window.showCustomAlarmPopup(alarmMessages);
        }
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

    updateDateTime(dateStr, eventId, fId, dVal, tVal) {
        store.hasUnsavedChanges = true;
        const ev = window[`tempEvents_${dateStr}`]?.find(e => e.id === eventId);
        if (ev) {
            if (!dVal && (!tVal || tVal.trim() === '')) {
                ev.time = '';
            } else {
                let finalT = (tVal || '').trim().replace(/[^0-9:]/g, '');
                if (/^\d{3,4}$/.test(finalT.replace(':', ''))) {
                    let cleanNum = finalT.replace(':', '');
                    if (cleanNum.length === 3) finalT = '0' + cleanNum[0] + ':' + cleanNum.substring(1);
                    else finalT = cleanNum.substring(0,2) + ':' + cleanNum.substring(2);
                }
                if (!finalT || finalT.length < 4) finalT = '09:00'; 
                ev.time = `${dVal || dateStr}T${finalT}`;
            }
            ev.alarmTriggered = false; 
            ev.editorEmail = getCurrentUser()?.email; // 💡
        }
        document.getElementById(`compact-events-${dateStr}-${fId}`).innerHTML = this.generateCompactEventEditor(dateStr, fId);
    },

    openAlarmModal(dateStr, eventId, fId) {
        const evList = window[`tempEvents_${dateStr}`];
        const ev = evList?.find(e => e.id === eventId);
        if (!ev) return;

        let dVal = dateStr;
        let tVal = '';
        if (ev.time) {
            const parts = ev.time.split('T');
            dVal = parts[0] || dateStr;
            tVal = parts[1] || '';
        }

        let modal = document.getElementById('sp3-alarm-modal-overlay');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'sp3-alarm-modal-overlay';
            modal.style.cssText = "position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.6); z-index:999999; display:flex; align-items:center; justify-content:center;";
            document.body.appendChild(modal);
        }

        modal.innerHTML = `
            <div style="background:#fff; padding:25px; border-radius:12px; width:340px; box-shadow:0 10px 25px rgba(0,0,0,0.2);" onclick="event.stopPropagation()">
                <h3 style="margin-top:0; color:#1e40af; font-size:1.3rem; display:flex; align-items:center; gap:8px;">⏰ 알림 시간 설정</h3>
                <div style="margin-bottom:15px;">
                    <label style="display:block; font-size:0.9rem; font-weight:bold; color:#475569; margin-bottom:5px;">날짜 선택</label>
                    <input type="date" id="alarm-popup-date" value="${dVal}" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:6px; outline:none; font-size:1rem; box-sizing:border-box; cursor:pointer;">
                </div>
                <div style="margin-bottom:25px;">
                    <label style="display:block; font-size:0.9rem; font-weight:bold; color:#475569; margin-bottom:5px;">시간 입력 (24시간제 키보드 입력)</label>
                    <input type="text" id="alarm-popup-time" value="${tVal}" placeholder="예: 1430 (오후 2시 30분)" maxlength="5" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:6px; outline:none; font-size:1.1rem; box-sizing:border-box; text-align:center; letter-spacing:2px; font-weight:bold;" autocomplete="off">
                </div>
                <div style="display:flex; justify-content:space-between; gap:8px;">
                    <button id="btn-alarm-off" data-shortcut-added="true" style="padding:10px 15px; background:#fef2f2; color:#ef4444; border:none; border-radius:6px; font-weight:bold; cursor:pointer; font-size:0.95rem;">알림 끄기</button>
                    <div style="display:flex; gap:8px;">
                        <button id="btn-alarm-cancel" data-shortcut-added="true" style="padding:10px 15px; background:#f1f5f9; color:#475569; border:none; border-radius:6px; font-weight:bold; cursor:pointer; font-size:0.95rem;">취소</button>
                        <button id="btn-alarm-save" data-shortcut-added="true" style="padding:10px 20px; background:#2563eb; color:#fff; border:none; border-radius:6px; font-weight:bold; cursor:pointer; font-size:0.95rem;">저장</button>
                    </div>
                </div>
            </div>
        `;
        modal.style.display = 'flex';
        if (window.increaseModalCount) window.increaseModalCount();

        const closePopup = () => {
            modal.style.display = 'none';
            if (window.decreaseModalCount) window.decreaseModalCount();
        };

        modal.onclick = closePopup;
        document.getElementById('btn-alarm-cancel').onclick = closePopup;

        document.getElementById('btn-alarm-off').onclick = () => {
            this.updateDateTime(dateStr, eventId, fId, '', '');
            closePopup();
        };

        document.getElementById('btn-alarm-save').onclick = () => {
            const dInput = document.getElementById('alarm-popup-date').value;
            const tInput = document.getElementById('alarm-popup-time').value;
            this.updateDateTime(dateStr, eventId, fId, dInput, tInput);
            closePopup();
        };

        document.getElementById('alarm-popup-time').onkeydown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                document.getElementById('btn-alarm-save').click();
            }
        };
        setTimeout(() => document.getElementById('alarm-popup-time').focus(), 50);
    },

    generateCompactEventEditor(dateStr, fId) {
        const allEvents = window[`tempEvents_${dateStr}`] || [];
        let list = allEvents.filter(e => (e.sharedGroupId || 'personal') === fId);
        
        const labelObjs = getEventLabels();
        
        list.sort((a, b) => {
            let aRank = 9999, bRank = 9999;
            (a.labelIds || []).forEach(id => {
                const r = labelObjs.findIndex(l => l.id === id);
                if (r !== -1 && r < aRank) aRank = r;
            });
            (b.labelIds || []).forEach(id => {
                const r = labelObjs.findIndex(l => l.id === id);
                if (r !== -1 && r < bRank) bRank = r;
            });
            if (aRank !== bRank) return aRank - bRank;
            return (a.id || '').localeCompare(b.id || '');
        });

        const realTodayStr = formatDate(new Date());
        const uid = getCurrentUser()?.uid; // 💡
        
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
            
            const timeVal = e.time || '';
            const timeColor = timeVal ? '#2563eb' : '#94a3b8';
            const timeBg = timeVal ? '#eff6ff' : '#f8fafc';
            const timeBorder = timeVal ? '#bfdbfe' : '#cbd5e1';

            const timeHtml = isAuthor 
                  ? `<div onclick="window.CompactEventHelper.openAlarmModal('${dateStr}', '${e.id}', '${fId}')" style="display:inline-flex; align-items:center; background:${timeBg}; padding:2px 6px; border-radius:4px; border:1px solid ${timeBorder}; cursor:pointer; margin-right:4px;" title="클릭하여 알림 설정">
                       <span style="font-size:0.75rem; font-weight:bold; color:${timeColor};">${this.formatAlarmTime(timeVal)}</span>
                     </div>` 
                  : `<span style="font-size:0.75rem; color:${timeColor}; font-weight:bold; background:${timeBg}; padding:2px 6px; border-radius:4px; border:1px solid ${timeBorder}; margin-right:4px;">${this.formatAlarmTime(timeVal)}</span>`;

            let authorHtml = '';
            if (fId !== 'personal') {
                const emailStr = e.editorEmail || e.authorEmail || '';
                const authorName = emailStr ? emailStr.split('@')[0] : '익명';
                authorHtml = `<div style="font-size:0.75rem; color:#64748b; background:#f8fafc; padding:2px 6px; border-radius:4px; border:1px solid #cbd5e1; display:inline-flex; align-items:center; font-weight:bold; margin-right:4px;" title="최근 수정자: ${emailStr || '알수없음'}">👤 ${authorName}</div>`;
            }

            return `
            <div class="compact-event-row" style="display:flex; border:1px solid #cbd5e1; border-radius:6px; padding:8px; margin-bottom:8px; background:#f8fafc; flex-direction:column; gap:6px; transition:0.2s;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <div class="label-chip-container" style="margin:0; display:flex; flex-wrap:wrap; gap:4px; align-items:center; flex:1;">
                        ${chipsHtml}
                    </div>
                    <div style="display:flex; align-items:center; gap:8px; flex-shrink:0;">
                        ${authorHtml}
                        ${timeHtml}
                        ${deleteBtnHtml}
                    </div>
                </div>
                <div style="display:flex; align-items:flex-start; gap:8px; width:100%;">
                    ${checkboxHtml}
                    <textarea data-id="${e.id}" ${!isAuthor ? 'readonly' : ''} placeholder="${isAuthor ? '일정 내용을 입력하세요.' : '작성자 본인만 수정할 수 있습니다.'}" style="flex:1; padding:6px 8px; font-size:0.95rem; border:1px solid #cbd5e1; border-radius:4px; outline:none; resize:none; min-height:40px; box-sizing:border-box; ${textStyle}" onfocus="this.style.height = this.scrollHeight + 'px';" oninput="this.style.height = '40px'; this.style.height = this.scrollHeight + 'px'; window.CompactEventHelper.updateCompactEvent('${dateStr}', '${e.id}', 'content', this.value)">${pureContent}</textarea>
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
                
                const prev = window[`tempSchedules_${dateStr}`][fId][p] || {};
                let authorEmail = prev.authorEmail;
                let editorEmail = prev.editorEmail;
                
                const prevSubject = prev.subject && prev.subject.toUpperCase() !== 'X' ? `[${prev.subject}] ` : '';
                const prevSupplies = prev.supplies ? ` [${prev.supplies}]` : '';
                const prevText = `${prevSubject}${prev.memo || ''}${prevSupplies}`.trim();
                
                const currSubject = subject && subject.toUpperCase() !== 'X' ? `[${subject}] ` : '';
                const currSupplies = supplies ? ` [${supplies}]` : '';
                const currText = `${currSubject}${memo || ''}${currSupplies}`.trim();

                // 💡 텍스트가 바뀌었을 때만 새로운 사람의 이메일로 덮어쓰기
                if (currText !== prevText) {
                    if (currText === '') {
                        authorEmail = null; editorEmail = null;
                    } else {
                        const userEmail = getCurrentUser()?.email;
                        authorEmail = authorEmail || userEmail;
                        editorEmail = userEmail;
                    }
                }

                window[`tempSchedules_${dateStr}`][fId][p] = { 
                    subject: subject.toUpperCase() === 'X' ? '' : subject, 
                    memo, 
                    supplies,
                    authorEmail,
                    editorEmail
                };
            });
        });
    },

    updateCompactEvent(dateStr, eventId, field, value) {
        store.hasUnsavedChanges = true;
        const ev = window[`tempEvents_${dateStr}`]?.find(e => e.id === eventId);
        if (ev) {
            ev[field] = value;
            ev.editorEmail = getCurrentUser()?.email; 
        }
        
        if (field === 'completed' && typeof window.saveCurrentViewData === 'function') {
            window.saveCurrentViewData(true);
        }
    },

    addCompactEvent(dateStr, fId) {
        this.syncCompactEventInputs(dateStr); 
        store.hasUnsavedChanges = true;
        window[`tempEvents_${dateStr}`] = window[`tempEvents_${dateStr}`] || [];
        
        const masterLabels = getEventLabels();
        const defaultLabelId = masterLabels.length > 0 ? masterLabels[0].id : null;
        
        const userEmail = getCurrentUser()?.email;
        const uid = getCurrentUser()?.uid;
        
        window[`tempEvents_${dateStr}`].push({ 
            id: 'ev_' + Date.now() + Math.random().toString(36).substr(2,5),
            authorId: uid,
            authorEmail: userEmail, 
            editorEmail: userEmail, 
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
        const labelObjs = window.getEventLabels ? window.getEventLabels() : [];
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
        ev.editorEmail = getCurrentUser()?.email; 
        
        const isActive = ev.labelIds.includes(labelId);
        const labelObj = getEventLabels().find(l => l.id === labelId);

        if (isActive) {
            ev.labelIds = ev.labelIds.filter(id => id !== labelId);
            store.hasUnsavedChanges = true;
            (window.activeUnifiedFilters || []).forEach(filterId => {
                const container = document.getElementById(`compact-events-${dateStr}-${filterId}`);
                if (container) container.innerHTML = this.generateCompactEventEditor(dateStr, filterId);
            });
            if (typeof window.saveCurrentViewData === 'function') {
                await window.saveCurrentViewData(true);
            }
        } else {
            if (labelObj?.isPeriod || labelObj?.isRecur) {
                
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
                    ? window.openPeriodModal(dateStr, labelObj.name, ev.content, callback, labelId)
                    : window.openRecurringModal(dateStr, labelObj.name, ev.content, callback, labelId);
                return; 
            }
            
            ev.labelIds.push(labelId);
            store.hasUnsavedChanges = true;
            
            (window.activeUnifiedFilters || []).forEach(filterId => {
                const container = document.getElementById(`compact-events-${dateStr}-${filterId}`);
                if (container) container.innerHTML = this.generateCompactEventEditor(dateStr, filterId);
            });
            if (typeof window.saveCurrentViewData === 'function') {
                await window.saveCurrentViewData(true);
            }
        }
    }
};

window.CompactEventHelper = CompactEventHelper;