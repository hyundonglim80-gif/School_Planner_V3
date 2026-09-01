// js/core/eventUtils.js

import { formatDate, getEventLabels, getLabelStyle } from './utils.js';
import { getUserCol } from '../firebase.js';
import { doc, getDoc, setDoc } from "firebase/firestore"; // 🌟 [수정] 최신 Firebase 모듈 추가

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

export const toggleEventCompletion = (dateStr, index, currentStatus) => {
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
                const style = getLabelStyle(labelId, 'event');
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
            // 🌟 [수정] V10 최신 Modular SDK 문법으로 교체하여 에러 방지
            const docRef = doc(getUserCol('events'), dateStr);
            const eventSnap = await getDoc(docRef);
            
            if (!eventSnap.exists()) return; // 🌟 .exists -> .exists() 함수 호출로 변경
            
            const data = eventSnap.data();
            let eventList = data.eventList || [];

            if (eventList.length === 0 && data.eventText) {
                eventList = parseRawEventTextToEventList(data.eventText);
            }

            if (eventList[index]) {
                eventList[index].completed = willBeComplete;
                const newText = formatEventListToText(eventList);

                // 🌟 [수정] V10 최신 setDoc 함수로 교체
                await setDoc(docRef, {
                    eventList: eventList,
                    eventText: newText,
                    updatedAt: Date.now()
                }, { merge: true });

                if (window.autoForwardIncompleteEvents) await window.autoForwardIncompleteEvents();
            }
        } catch (error) { console.error("🚨 완료 상태 변경 중 오류:", error); }
    }, 0);
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

// ==========================================================================
// 🌉 과도기 호환성 레이어 
// ==========================================================================
window.parseRawEventTextToEventList = parseRawEventTextToEventList;
window.formatEventListToText = formatEventListToText;
window.toggleEventCompletion = toggleEventCompletion;
window.generateEventBadgesHTML = generateEventBadgesHTML;