// js/core/utils.js

// ==========================================================================
// 🛠️ 공통 유틸리티 및 데이터 가공 (Labels & Format) 엔진
// ==========================================================================

window.parseLocalDate = function(dateString) {
    if (!dateString) return new Date();
    const parts = dateString.split('-');
    if (parts.length === 3) return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    return new Date(dateString);
};

window.formatDate = function(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

window.LABEL_PALETTE = {
    red: { bg: '#fee2e2', text: '#b91c1c', border: '#fca5a5' },
    orange: { bg: '#ffedd5', text: '#c2410c', border: '#fdba74' },
    yellow: { bg: '#fef3c7', text: '#a16207', border: '#fcd34d' },
    green: { bg: '#dcfce3', text: '#15803d', border: '#86efac' },
    blue: { bg: '#dbeafe', text: '#1d4ed8', border: '#93c5fd' },
    indigo: { bg: '#e0e7ff', text: '#4338ca', border: '#a5b4fc' },
    purple: { bg: '#f3e8ff', text: '#7e22ce', border: '#d8b4fe' },
    gray: { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' }
};

window.getLabelStyle = function(labelId, type = 'event') {
    const labels = type === 'event' ? window.getEventLabels() : window.getJournalLabels();
    const target = labels.find(l => l.id === labelId || l.name === labelId); 
    if (target && target.color && window.LABEL_PALETTE[target.color]) return window.LABEL_PALETTE[target.color];
    if (type === 'event' && target && target.isSkip) return window.LABEL_PALETTE['red'];
    if (type === 'event') return window.LABEL_PALETTE['blue'];
    return window.LABEL_PALETTE['purple'];
};

window.generateTempId = function(prefix = 'id') {
    return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5);
};

window.getEventLabels = function() {
    let labels = JSON.parse(localStorage.getItem('workCalendar_eventLabels_v4'));
    let changed = false;

    if (!labels || labels.length === 0) {
        labels = [
            { id: window.generateTempId('lbl_ev'), name: '일정', isSkip: false, isForward: false, isPeriod: false, isRecur: false, color: 'blue', isSystem: true },
            { id: window.generateTempId('lbl_ev'), name: '완료', isSkip: false, isForward: true,  isPeriod: false, isRecur: false, color: 'green', isSystem: true },
            { id: window.generateTempId('lbl_ev'), name: '주간', isSkip: false, isForward: false, isPeriod: true,  isRecur: false, color: 'orange', isSystem: true },
            { id: window.generateTempId('lbl_ev'), name: '반복', isSkip: false, isForward: false, isPeriod: false, isRecur: true,  color: 'purple', isSystem: true },
            { id: window.generateTempId('lbl_ev'), name: '휴일', isSkip: true,  isForward: false, isPeriod: false, isRecur: false, color: 'red', isSystem: true }
        ];
        changed = true;
    } else {
        labels.forEach(l => { 
            if (!l.id) { l.id = window.generateTempId('lbl_ev'); changed = true; } 
            if (l.isSkip && l.name === '전일행사') { l.name = '휴일'; changed = true; }
            if (l.isForward && l.name === '확인') { l.name = '완료'; changed = true; }
        });

        const requiredSpecs = [
            { defaultName: '일정', prop: 'isNormal', color: 'blue' },
            { defaultName: '완료', prop: 'isForward', color: 'green' },
            { defaultName: '주간', prop: 'isPeriod', color: 'orange' },
            { defaultName: '반복', prop: 'isRecur', color: 'purple' },
            { defaultName: '휴일', prop: 'isSkip', color: 'red' }
        ];

        requiredSpecs.forEach(spec => {
            let target;
            if (spec.prop === 'isNormal') {
                target = labels.find(l => !l.isSkip && !l.isForward && !l.isPeriod && !l.isRecur);
                if (!target) target = labels.find(l => l.name === '일정');
            } else {
                target = labels.find(l => l[spec.prop] === true);
            }

            if (!target) {
                labels.push({ 
                    id: window.generateTempId('lbl_ev'), 
                    name: spec.defaultName, 
                    isSkip: spec.prop === 'isSkip', 
                    isForward: spec.prop === 'isForward', 
                    isPeriod: spec.prop === 'isPeriod', 
                    isRecur: spec.prop === 'isRecur', 
                    color: spec.color, 
                    isSystem: true 
                });
                changed = true;
            } else {
                if (!target.isSystem) {
                    target.isSystem = true;
                    changed = true;
                }
            }
        });
    }

    if (changed) {
        localStorage.setItem('workCalendar_eventLabels_v4', JSON.stringify(labels));
        if (window.auth && window.auth.currentUser) {
            window.getUserCol('settings').doc('labels').set({ eventLabels: labels }, { merge: true }).catch(e => console.warn(e));
        }
    }
    return labels;
};

window.getJournalLabels = function() {
    let labels = JSON.parse(localStorage.getItem('workCalendar_journalLabels_v4'));
    let changed = false;
    if (!labels || labels.length === 0) {
        let oldLabels = JSON.parse(localStorage.getItem('workCalendar_journalLabels_v3')) || JSON.parse(localStorage.getItem('workCalendar_journalLabels'));
        if (oldLabels && Array.isArray(oldLabels)) {
            labels = oldLabels.map(l => {
                if (typeof l === 'string') return { id: window.generateTempId('lbl_jr'), name: l, color: 'purple' };
                return { id: window.generateTempId('lbl_jr'), name: l.name, color: l.color || 'purple' };
            });
        } else {
            labels = [
                { id: window.generateTempId('lbl_jr'), name: '참고', color: 'gray' }, 
                { id: window.generateTempId('lbl_jr'), name: '사건', color: 'red' }, 
                { id: window.generateTempId('lbl_jr'), name: '감상', color: 'green' }, 
                { id: window.generateTempId('lbl_jr'), name: '상담', color: 'orange' }
            ];
        }
        changed = true;
    } else {
        labels.forEach(l => { if (!l.id) { l.id = window.generateTempId('lbl_jr'); changed = true; } });
    }
    
    if (changed) {
        localStorage.setItem('workCalendar_journalLabels_v4', JSON.stringify(labels));
        if (window.auth && window.auth.currentUser) {
            window.getUserCol('settings').doc('labels').set({ journalLabels: labels }, { merge: true }).catch(e => console.warn(e));
        }
    }
    return labels;
};

window.isSkipLabel = function(labelId) {
    const target = window.getEventLabels().find(l => l.id === labelId || l.name === labelId);
    return target ? target.isSkip : false; 
};

window.isForwardLabel = function(labelId) {
    const target = window.getEventLabels().find(l => l.id === labelId || l.name === labelId);
    return target ? target.isForward : false; 
};

window.isPeriodLabel = function(labelId) {
    const target = window.getEventLabels().find(l => l.id === labelId || l.name === labelId);
    return target ? target.isPeriod : false; 
};

window.checkSkipConditionFromText = function(rawText) {
    if (!rawText) return false;
    if (rawText.includes('(휴일)') || rawText.includes('(행사)')) return true;
    const regex = /\[(.*?)\]/g;
    let match;
    const labels = window.getEventLabels();
    while ((match = regex.exec(rawText)) !== null) {
        const target = labels.find(l => l.name === match[1]);
        if (target && target.isSkip) return true;
    }
    return false;
};

// ==========================================================================
// 🚀 자동 마이그레이션 엔진 탑재 (계정별 독립 팝업 처리)
// ==========================================================================
window.autoCheckAndRunMigration = async function() {
    const user = window.auth && window.auth.currentUser;
    if (!user) return;
    
    const stampKey = 'v4_migration_done_' + user.uid;
    if (localStorage.getItem(stampKey) === 'true') return;
    
    try {
        const prefDoc = await window.getUserCol('settings').doc('preferences').get();
        if (prefDoc.exists && prefDoc.data().v4LabelMigrationDone === true) {
            localStorage.setItem(stampKey, 'true');
            return;
        }
    } catch(e) { return; }

    const popupHtml = `
    <div id="migration-prompt-modal" style="position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.7); z-index:100000; display:flex; justify-content:center; align-items:center;">
        <div style="background:#fff; padding:35px 30px; border-radius:12px; width:400px; text-align:center; box-shadow:0 10px 25px rgba(0,0,0,0.2);">
            <div style="font-size:3.5rem; margin-bottom:10px;">🚀</div>
            <h2 style="color:#2563eb; margin-top:0; margin-bottom:15px; font-size: 1.4rem;">V4 시스템 데이터 업데이트</h2>
            <p style="color:#475569; font-size:0.95rem; line-height:1.6; margin-bottom:25px; word-break:keep-all;">
                새로운 V4 라벨 시스템(ID 기반)이 적용되었습니다.<br>
                선생님의 기존 데이터를 안전하게 최신화하기 위해<br>
                <strong style="color:#ef4444;">반드시 아래 버튼을 눌러 업데이트를 진행해 주세요.</strong>
            </p>
            <button onclick="window.startV4MigrationProcess()" style="background:#2563eb; color:#fff; border:none; padding:14px 20px; font-size:1.1rem; font-weight:bold; border-radius:8px; cursor:pointer; width:100%; transition:0.2s;">
                데이터 최적화 시작 (약 10초 소요)
            </button>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', popupHtml);
};

window.startV4MigrationProcess = async function() {
    const btn = document.querySelector('#migration-prompt-modal button');
    if(btn) {
        btn.innerHTML = "데이터 변환 중... 창을 닫지 마세요⏳";
        btn.disabled = true;
        btn.style.background = "#94a3b8";
        btn.style.cursor = "wait";
    }

    try {
        const masterEventLabels = window.getEventLabels();
        const masterJournalLabels = window.getJournalLabels();

        const findIdByName = (name, type) => {
            const list = type === 'event' ? masterEventLabels : masterJournalLabels;
            const match = list.find(l => l.name === name);
            return match ? match.id : null;
        };

        let batch = window.db.batch();
        let opCount = 0;
        let promises = [];

        const eventsSnap = await window.getUserCol('events').get();
        eventsSnap.forEach(doc => {
            const data = doc.data();
            let list = data.eventList || [];
            let docChanged = false;

            list.forEach(ev => {
                if (ev.labels || ev.label) {
                    let oldNames = ev.labels || [ev.label];
                    ev.labelIds = ev.labelIds || [];
                    oldNames.forEach(name => {
                        const id = findIdByName(name, 'event');
                        if (id && !ev.labelIds.includes(id)) ev.labelIds.push(id);
                    });
                    delete ev.labels; delete ev.label;
                    docChanged = true;
                }
            });

            if (docChanged) {
                batch.update(doc.ref, { eventList: list });
                opCount++;
                if (opCount >= 400) { promises.push(batch.commit()); batch = window.db.batch(); opCount = 0; }
            }
        });

        const journalsSnap = await window.getUserCol('journals').get();
        journalsSnap.forEach(doc => {
            const data = doc.data();
            let entries = data.entries || [];
            let docChanged = false;

            entries.forEach(j => {
                if (j.labels || j.label) {
                    let oldNames = j.labels || [j.label];
                    j.labelIds = j.labelIds || [];
                    oldNames.forEach(name => {
                        const id = findIdByName(name, 'journal');
                        if (id && !j.labelIds.includes(id)) j.labelIds.push(id);
                    });
                    delete j.labels; delete j.label;
                    docChanged = true;
                }
            });

            if (docChanged) {
                batch.update(doc.ref, { entries: entries });
                opCount++;
                if (opCount >= 400) { promises.push(batch.commit()); batch = window.db.batch(); opCount = 0; }
            }
        });

        if (opCount > 0) promises.push(batch.commit());
        await Promise.all(promises);

        const uid = window.auth.currentUser.uid;
        await window.getUserCol('settings').doc('preferences').set({ v4LabelMigrationDone: true }, { merge: true });
        localStorage.setItem('v4_migration_done_' + uid, 'true');

        document.getElementById('migration-prompt-modal').remove();
        alert("🎉 V4 데이터 업데이트가 완벽하게 완료되었습니다!\n확인을 누르면 앱이 새로고침됩니다.");
        window.location.reload(); 

    } catch(e) {
        console.error("마이그레이션 에러:", e);
        alert("업데이트 중 오류가 발생했습니다. (F12 콘솔 확인 필요)");
        if(document.getElementById('migration-prompt-modal')) document.getElementById('migration-prompt-modal').remove();
    }
};

// ==========================================================================
// 🚀 렌더링 엔진 (구버전 데이터도 즉석에서 고쳐서 보여주는 자동 힐링 탑재)
// ==========================================================================
window.generateEventBadgesHTML = function(eventList, dateStr = null, viewType = 'normal') {
    if (!eventList || eventList.length === 0) return '';
    let html = `<div style="display:flex; flex-direction:column; gap:4px; margin-top:2px;">`;
    const realTodayStr = window.formatDate(new Date()); 
    const masterLabels = window.getEventLabels();
    
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
                
                const style = window.getLabelStyle(id, 'event');
                let badgeStyle;
                
                if (isMissedPast) badgeStyle = `background:#fee2e2; color:#ef4444; border:2px solid #ef4444;`;
                else if (isCompleted && canComplete) badgeStyle = `background:#e2e8f0; color:#94a3b8; border:1px solid #cbd5e1; cursor:pointer;`;
                else badgeStyle = `background:${style.bg}; color:${style.text}; border:1px solid ${style.border}; ${canComplete ? 'cursor:pointer;' : ''}`;
                
                const onClickAttr = (dateStr && canComplete) ? `onclick="event.stopPropagation(); window.toggleEventCompletion('${dateStr}', ${index}, ${isCompleted})"` : '';
                
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

window.toggleEventCompletion = function(dateStr, index, currentStatus) {
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
            badge.setAttribute('onclick', `event.stopPropagation(); window.toggleEventCompletion('${dateStr}', ${index}, ${willBeComplete})`);
            
            if (willBeComplete) {
                badge.style.background = '#e2e8f0';
                badge.style.color = '#94a3b8';
                badge.style.border = '1px solid #cbd5e1';
            } else {
                const labelId = badge.getAttribute('data-id');
                const style = window.getLabelStyle(labelId, 'event');
                if (style) {
                    badge.style.background = style.bg;
                    badge.style.color = style.text;
                    badge.style.border = `1px solid ${style.border}`;
                }
            }
        });

        const textEl = document.getElementById(`evt-txt-${dateStr}-${index}`);
        if (textEl) {
            let inner = textEl.innerHTML;
            if (willBeComplete) {
                textEl.style.color = '#94a3b8';
                textEl.style.textDecoration = 'line-through';
                textEl.style.fontStyle = 'italic';
                if (!inner.includes('✓ ')) textEl.innerHTML = '✓ ' + inner;
            } else {
                textEl.style.color = '#1e293b';
                textEl.style.textDecoration = 'none';
                textEl.style.fontStyle = 'normal';
                if (inner.includes('✓ ')) textEl.innerHTML = inner.replace('✓ ', '');
            }
        }
    }

    setTimeout(async () => {
        try {
            const eventDoc = await window.getUserCol('events').doc(dateStr).get();
            if (!eventDoc.exists) return;
            const data = eventDoc.data();
            let eventList = data.eventList || [];

            if (eventList.length === 0 && data.eventText) eventList = window.parseRawEventTextToEventList(data.eventText);

            if (eventList[index]) {
                eventList[index].completed = willBeComplete;
                const newText = window.formatEventListToText ? window.formatEventListToText(eventList) : '';
                
                await window.getUserCol('events').doc(dateStr).set({
                    eventList: eventList,
                    eventText: newText,
                    updatedAt: Date.now()
                }, { merge: true });

                if (window.autoForwardIncompleteEvents) await window.autoForwardIncompleteEvents();
            }
        } catch (error) { console.error("🚨 완료 상태 변경 중 오류:", error); }
    }, 0);
};

window.parseRawEventTextToEventList = function(rawText) {
    if (!rawText || !rawText.trim()) return [];
    const lines = rawText.split('\n');
    const eventList = [];
    const masterLabels = window.getEventLabels();

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

window.formatEventListToText = function(eventList) {
    if (!eventList || eventList.length === 0) return '';
    const masterLabels = window.getEventLabels();
    
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

// ==========================================================================
// 🚀 설정 및 공휴일(빨간날 엔진 통합)
// ==========================================================================

window.KOR_HOLIDAYS = {
    "01-01": "신정", "03-01": "삼일절", "05-05": "어린이날", "06-06": "현충일",
    "08-15": "광복절", "10-03": "개천절", "10-09": "한글날", "12-25": "성탄절",
    "2024-02-09": "설날 연휴", "2024-02-10": "설날", "2024-02-11": "설날 연휴", "2024-02-12": "대체공휴일",
    "2024-04-10": "국회의원선거", "2024-05-06": "대체공휴일", "2024-05-15": "부처님오신날",
    "2024-09-16": "추석 연휴", "2024-09-17": "추석", "2024-09-18": "추석 연휴",
    "2025-01-28": "설날 연휴", "2025-01-29": "설날", "2025-01-30": "설날 연휴",
    "2025-03-03": "대체공휴일", "2025-05-05": "부처님오신날", "2025-05-06": "대체공휴일",
    "2025-10-05": "추석 연휴", "2025-10-06": "추석", "2025-10-07": "추석 연휴", "2025-10-08": "대체공휴일",
    "2026-02-16": "설날 연휴", "2026-02-17": "설날", "2026-02-18": "설날 연휴",
    "2026-05-24": "부처님오신날", "2026-05-25": "대체공휴일",
    "2026-09-24": "추석 연휴", "2026-09-25": "추석", "2026-09-26": "추석 연휴", "2026-09-27": "대체공휴일"
};

window.getHolidayName = function(dateStr) {
    const mmdd = dateStr.substring(5);
    if (window.KOR_HOLIDAYS[dateStr]) return window.KOR_HOLIDAYS[dateStr]; 
    if (window.KOR_HOLIDAYS[mmdd]) return window.KOR_HOLIDAYS[mmdd];     
    return null;
};

// 💡 [핵심 추가] 이 날짜가 달력에서 '빨간 날'로 표시되어야 하는지 판별하는 통합 엔진
window.isRedDay = function(dateStr, eventList = []) {
    const dObj = window.parseLocalDate(dateStr);
    
    // 1. 일요일인지 확인
    if (dObj.getDay() === 0) return true;
    
    // 2. 공식 공휴일인지 확인
    if (window.getHolidayName(dateStr)) return true;
    
    // 3. 사용자가 [휴일/수업삭제] 라벨을 지정한 일정인지 확인
    const masterLabels = window.getEventLabels();
    const hasSkipLabel = eventList.some(ev => {
        const ids = ev.labelIds || [];
        return ids.some(id => {
            const lObj = masterLabels.find(l => l.id === id);
            return lObj && lObj.isSkip; // isSkip 속성이 있으면 빨간날!
        });
    });
    
    if (hasSkipLabel) return true;

    return false;
};

// ==========================================================================
// 📅 학사일정 글로벌 연동 엔진
// ==========================================================================
window.getSemesterDates = function() {
    // 1. 시간표 모듈에서 저장한 클라우드 데이터(학사일정)가 있으면 최우선으로 사용합니다.
    if (window.semesterConfig && window.semesterConfig.sem1Start) {
        return {
            sem1Start: window.semesterConfig.sem1Start,
            sem1End: window.semesterConfig.sem1End,
            sem2Start: window.semesterConfig.sem2Start,
            sem2End: window.semesterConfig.sem2End,
            yearStart: window.semesterConfig.sem1Start,
            yearEnd: window.semesterConfig.sem2End
        };
    }
    
    // 2. 아직 설정된 데이터가 없을 경우의 기본 임시값 (에러 방지용)
    const y = new Date().getFullYear();
    return {
        sem1Start: `${y}-03-02`,
        sem1End: `${y}-07-20`,
        sem2Start: `${y}-08-16`,
        sem2End: `${y+1}-01-10`,
        yearStart: `${y}-03-02`,
        yearEnd: `${y+1}-02-28`
    };
};
