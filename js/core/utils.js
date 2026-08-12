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

window.getLabelStyle = function(labelName, type = 'event') {
    const labels = type === 'event' ? window.getEventLabels() : window.getJournalLabels();
    const target = labels.find(l => l.name === labelName);
    if (target && target.color && window.LABEL_PALETTE[target.color]) return window.LABEL_PALETTE[target.color];
    if (type === 'event' && target && target.isSkip) return window.LABEL_PALETTE['red'];
    if (type === 'event') return window.LABEL_PALETTE['blue'];
    return window.LABEL_PALETTE['purple'];
};

// 💡 [초기 일정 라벨 지정] 시스템 기본 라벨 5종 및 속성 정의
window.getEventLabels = function() {
    let labels = JSON.parse(localStorage.getItem('workCalendar_eventLabels_v4'));
    
    if (!labels || labels.length === 0) {
        labels = [
            { name: '일정', isSkip: false, isForward: false, isPeriod: false, isRecur: false, color: 'blue' },
            { name: '휴일', isSkip: true,  isForward: false, isPeriod: false, isRecur: false, color: 'red' },
            { name: '확인', isSkip: false, isForward: true,  isPeriod: false, isRecur: false, color: 'green' },
            { name: '주간', isSkip: false, isForward: false, isPeriod: true,  isRecur: false, color: 'orange' },
            { name: '반복', isSkip: false, isForward: false, isPeriod: false, isRecur: true,  color: 'purple' }
        ];
        localStorage.setItem('workCalendar_eventLabels_v4', JSON.stringify(labels));
    }
    return labels;
};

window.isSkipLabel = function(labelName) {
    const target = window.getEventLabels().find(l => l.name === labelName);
    return target ? target.isSkip : false; 
};

window.isForwardLabel = function(labelName) {
    const target = window.getEventLabels().find(l => l.name === labelName);
    return target ? target.isForward : false; 
};

window.isPeriodLabel = function(labelName) {
    const target = window.getEventLabels().find(l => l.name === labelName);
    return target ? target.isPeriod : false; 
};

window.checkSkipConditionFromText = function(rawText) {
    if (!rawText) return false;
    if (rawText.includes('(휴일)') || rawText.includes('(행사)')) return true;
    const regex = /\[(.*?)\]/g;
    let match;
    while ((match = regex.exec(rawText)) !== null) {
        if (window.isSkipLabel(match[1])) return true;
    }
    return false;
};

// ==========================================================================
// 🚀 렌더링 엔진 (DOM 조작을 위해 id 속성 추가)
// ==========================================================================
window.generateEventBadgesHTML = function(eventList, dateStr = null, viewType = 'normal') {
    if (!eventList || eventList.length === 0) return '';
    let html = `<div style="display:flex; flex-direction:column; gap:4px; margin-top:2px;">`;
    const realTodayStr = window.formatDate(new Date()); 
    
    eventList.forEach((e, index) => {
        let labelsToRender = e.labels || (e.label ? [e.label] : []);

        const isCompleted = !!e.completed;
        const canComplete = labelsToRender.some(l => typeof window.isForwardLabel === 'function' && window.isForwardLabel(l)); 
        const isSkip = labelsToRender.some(l => typeof window.isSkipLabel === 'function' && window.isSkipLabel(l));
        const isGrouped = !!e.groupId; 

        let pureContent = (e.content || '').replace(/➡️\s*\(미완료\)/g, '').replace(/➡️\s*\(다음 날로 이월됨\)/g, '').replace(/↪️\s*/g, '').trim();

        let isMissedPast = false;
        let isForwardedToToday = false;

        if (canComplete && dateStr) {
            if (!isCompleted && dateStr < realTodayStr) isMissedPast = true;
            if (e.originalDate && e.originalDate < dateStr) isForwardedToToday = true;
        }

        let badgesHtml = '';
        if (labelsToRender.length > 0) {
            badgesHtml = labelsToRender.map(lName => {
                const style = window.getLabelStyle(lName, 'event');
                let badgeStyle;
                
                if (isMissedPast) badgeStyle = `background:#fee2e2; color:#ef4444; border:2px solid #ef4444;`;
                else if (isCompleted && canComplete) badgeStyle = `background:#e2e8f0; color:#94a3b8; border:1px solid #cbd5e1; cursor:pointer;`;
                else badgeStyle = `background:${style.bg}; color:${style.text}; border:1px solid ${style.border}; ${canComplete ? 'cursor:pointer;' : ''}`;
                
                const onClickAttr = (dateStr && canComplete) ? `onclick="event.stopPropagation(); window.toggleEventCompletion('${dateStr}', ${index}, ${isCompleted})"` : '';
                
                return `<span ${onClickAttr} style="${badgeStyle} padding:1px 5px; border-radius:4px; font-size:0.8rem; font-weight:bold; white-space:nowrap; flex-shrink:0; transition:0.2s;" title="${canComplete ? '클릭하여 완료 상태 변경' : lName}">${lName}</span>`;
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
        if (window.dayViewInstance.currentEvents[index]) {
            window.dayViewInstance.currentEvents[index].completed = willBeComplete;
        }
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
                const lName = badge.innerText;
                const style = window.getLabelStyle(lName, 'event');
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
                const newText = window.formatEventListToText(eventList);
                
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
            eventList.push({ label: labelName, labels: [labelName], content: match[2].trim(), completed: completed });
        } else {
            let defaultLabels = [];
            if (t.includes('(휴일)') || t.includes('(행사)')) {
                const skipLabel = window.getEventLabels().find(l => l.isSkip);
                if (skipLabel) defaultLabels = [skipLabel.name];
            }
            eventList.push({ label: defaultLabels[0] || '', labels: defaultLabels, content: t, completed: completed });
        }
    });
    return eventList;
};

window.formatEventListToText = function(eventList) {
    if (!eventList || eventList.length === 0) return '';
    return eventList.map(e => {
        let labelStr = (e.labels && e.labels.length > 0) ? `[${e.labels[0]}] ` : (e.label ? `[${e.label}] ` : '');
        return `${e.completed ? '[v]' : ''}${labelStr}${e.content}`;
    }).join('\n');
};

window.getJournalLabels = function() {
    let labels = JSON.parse(localStorage.getItem('workCalendar_journalLabels_v4'));
    if (!labels) {
        let oldLabels = JSON.parse(localStorage.getItem('workCalendar_journalLabels_v3')) || JSON.parse(localStorage.getItem('workCalendar_journalLabels'));
        if (oldLabels && Array.isArray(oldLabels)) {
            labels = oldLabels.map(l => {
                if (typeof l === 'string') return { name: l, color: 'purple' };
                return { name: l.name, color: l.color || 'purple' };
            });
        } else {
            labels = [
                { name: '참고', color: 'gray' }, { name: '사건', color: 'red' }, 
                { name: '감상', color: 'green' }, { name: '상담', color: 'orange' }
            ];
        }
        localStorage.setItem('workCalendar_journalLabels_v4', JSON.stringify(labels));
    }
    return labels;
};

window.sem2StartMMDD = '08-16'; 
window.isPreferencesLoaded = false;

window.loadGlobalPreferences = async function() {
    if (window.isPreferencesLoaded || !window.db) return;
    try {
        const doc = await window.getUserCol('settings').doc('preferences').get();
        if (doc.exists && doc.data().sem2StartDate) {
            window.sem2StartMMDD = doc.data().sem2StartDate;
        }
        window.isPreferencesLoaded = true;
    } catch (e) { console.warn("설정 로드 실패", e); }
};

window.getSemesterDates = function(baseDate = window.currentDate) {
    const y = baseDate.getFullYear();
    const m = baseDate.getMonth();
    const acYear = m <= 1 ? y - 1 : y; 

    const sem2Parts = window.sem2StartMMDD.split('-');
    const sem2Month = parseInt(sem2Parts[0], 10) - 1;
    const sem2Day = parseInt(sem2Parts[1], 10);

    const yearStart = new Date(acYear, 2, 1); 
    const yearEnd = new Date(acYear + 1, 2, 0); 
    
    const sem2Start = new Date(acYear, sem2Month, sem2Day);
    
    const sem1End = new Date(sem2Start);
    sem1End.setDate(sem1End.getDate() - 1); 

    return {
        acYear: acYear,
        yearStart: yearStart,
        yearEnd: yearEnd,
        sem1Start: yearStart,
        sem1End: sem1End,
        sem2Start: sem2Start,
        sem2End: yearEnd
    };
};

// ==========================================================================
// 🚀 [신규] 대한민국 공휴일 데이터 및 판별 엔진
// ==========================================================================
window.KOR_HOLIDAYS = {
    // 1. 매년 고정 공휴일 (월-일)
    "01-01": "신정",
    "03-01": "삼일절",
    "05-05": "어린이날",
    "06-06": "현충일",
    "08-15": "광복절",
    "10-03": "개천절",
    "10-09": "한글날",
    "12-25": "성탄절",

    // 2. 유동/음력 공휴일 (2024년 ~ 2026년 기준)
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
    // dateStr 형식: "YYYY-MM-DD"
    const mmdd = dateStr.substring(5);
    // 1순위: 특정 연도 휴일 (설날, 추석, 대체휴일 등)
    if (window.KOR_HOLIDAYS[dateStr]) return window.KOR_HOLIDAYS[dateStr]; 
    // 2순위: 매년 반복 고정 휴일 (광복절, 크리스마스 등)
    if (window.KOR_HOLIDAYS[mmdd]) return window.KOR_HOLIDAYS[mmdd];     
    return null;
};
