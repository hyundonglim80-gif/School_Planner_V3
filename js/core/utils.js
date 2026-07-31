//js/core/utils.js

// ==========================================================================
// 🛠️ 공통 유틸리티 및 데이터 가공 (Labels & Format) 엔진
// ==========================================================================

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

window.getEventLabels = function() {
    let labels = JSON.parse(localStorage.getItem('workCalendar_eventLabels_v4'));
    if (!labels) {
        let oldLabels = JSON.parse(localStorage.getItem('workCalendar_eventLabels_v3')) || JSON.parse(localStorage.getItem('workCalendar_eventLabels_v2'));
        if (oldLabels) {
            labels = oldLabels.map(l => ({ ...l, color: l.color || (l.isSkip ? 'red' : 'blue') }));
        } else {
            labels = [
                { name: '일정', isSkip: false, color: 'blue' }, { name: '행사', isSkip: false, color: 'orange' },
                { name: '전일행사', isSkip: true, color: 'red' }, { name: '제출', isSkip: false, color: 'yellow' },
                { name: '기타', isSkip: false, color: 'gray' }
            ];
        }
        localStorage.setItem('workCalendar_eventLabels_v4', JSON.stringify(labels));
    }
    return labels;
};

window.isSkipLabel = function(labelName) {
    const labels = window.getEventLabels();
    const target = labels.find(l => l.name === labelName);
    return target ? target.isSkip : false; 
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

window.generateEventBadgesHTML = function(eventList, dateStr = null) {
    if (!eventList || eventList.length === 0) return '';
    let html = `<div style="display:flex; flex-direction:column; gap:4px; margin-top:2px;">`;
    
    const validLabels = window.getEventLabels().map(l => l.name);
    const defaultLabel = validLabels[0] || '일정';

    eventList.forEach((e, index) => {
        let currentLabel = e.label;
        if (!validLabels.includes(currentLabel)) currentLabel = defaultLabel;

        const style = window.getLabelStyle(currentLabel, 'event');
        const isCompleted = !!e.completed;

        let badgeStyle = isCompleted 
            ? `background:#e2e8f0; color:#94a3b8; border:1px solid #cbd5e1; text-decoration:line-through; cursor:pointer;`
            : `background:${style.bg}; color:${style.text}; border:1px solid ${style.border}; cursor:pointer;`;

        let textStyle = window.isSkipLabel(currentLabel) ? `color:${style.text}; font-weight:bold;` : 'color:#1e293b;';
        if (isCompleted) {
            textStyle = 'color:#94a3b8; text-decoration:line-through; font-style:italic;';
        }

        const onClickAttr = dateStr ? `onclick="event.stopPropagation(); window.toggleEventCompletion('${dateStr}', ${index}, ${isCompleted})"` : '';

        html += `
        <div style="display:flex; align-items:flex-start; gap:6px; font-size:0.95rem; line-height:1.3; ${isCompleted ? 'opacity:0.65;' : ''}">
            <span ${onClickAttr} style="${badgeStyle} padding:1px 5px; border-radius:4px; font-size:0.8rem; font-weight:bold; white-space:nowrap; flex-shrink:0; transition:0.2s;" title="클릭하여 완료 상태 변경">${currentLabel}</span>
            <span style="white-space:pre-wrap; word-break:break-all; ${textStyle}">${isCompleted ? '✓ ' : ''}${e.content}</span>
        </div>`;
    });
    html += `</div>`;
    return html;
};

window.toggleEventCompletion = async function(dateStr, index, currentStatus) {
    try {
        const eventDoc = await window.getUserCol('events').doc(dateStr).get();
        if (!eventDoc.exists) return;
        const data = eventDoc.data();
        let eventList = data.eventList || [];

        if (eventList.length === 0 && data.eventText) {
            eventList = window.parseRawEventTextToEventList(data.eventText);
        }

        if (eventList[index]) {
            eventList[index].completed = !currentStatus;
            const newText = window.formatEventListToText(eventList);
            
            await window.getUserCol('events').doc(dateStr).set({
                eventList: eventList,
                eventText: newText,
                updatedAt: Date.now()
            }, { merge: true });

            if (window.render) window.render(); 
        }
    } catch (error) {
        console.error("완료 상태 변경 중 오류:", error);
    }
};

window.parseRawEventTextToEventList = function(rawText) {
    if (!rawText || !rawText.trim()) return [];
    const lines = rawText.split('\n');
    const eventList = [];
    const validLabels = window.getEventLabels().map(l => l.name);

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
            if (!validLabels.includes(labelName)) labelName = validLabels[0] || '일정'; 
            eventList.push({ label: labelName, content: match[2].trim(), completed: completed });
        } else {
            let defaultLabel = validLabels[0] || '일정';
            if (t.includes('(휴일)') || t.includes('(행사)')) {
                const skipLabel = window.getEventLabels().find(l => l.isSkip);
                if (skipLabel) defaultLabel = skipLabel.name;
            }
            eventList.push({ label: defaultLabel, content: t, completed: completed });
        }
    });
    return eventList;
};

window.formatEventListToText = function(eventList) {
    if (!eventList || eventList.length === 0) return '';
    return eventList.map(e => `${e.completed ? '[v]' : ''}[${e.label}] ${e.content}`).join('\n');
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

// ==========================================================================
// 🎓 전역 학기 계산 엔진 (Semester Calculation Engine) 추가
// ==========================================================================
window.sem2StartMMDD = '08-16'; // 기본값 설정
window.isPreferencesLoaded = false;

// 모달을 열 때마다 DB에서 사용자 설정을 불러오는 전역 함수
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

// 언제 어디서든 현재 기준일자를 넣으면 학사일정 범위를 정확히 계산해 반환
window.getSemesterDates = function(baseDate = window.currentDate) {
    const y = baseDate.getFullYear();
    const m = baseDate.getMonth();
    const acYear = m <= 1 ? y - 1 : y; // 1~2월이면 이전 연도가 학년도 기준

    const sem2Parts = window.sem2StartMMDD.split('-');
    const sem2Month = parseInt(sem2Parts[0], 10) - 1;
    const sem2Day = parseInt(sem2Parts[1], 10);

    const yearStart = new Date(acYear, 2, 1); // 3월 1일 시작
    const yearEnd = new Date(acYear + 1, 2, 0); // 다음해 2월 마지막 날
    
    const sem2Start = new Date(acYear, sem2Month, sem2Day);
    
    const sem1End = new Date(sem2Start);
    sem1End.setDate(sem1End.getDate() - 1); // 2학기 시작 전날이 1학기 종료

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
