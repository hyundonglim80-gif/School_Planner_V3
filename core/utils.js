// ==========================================================================
// 🛠️ 공통 유틸리티 및 데이터 가공 (Labels & Format) 엔진
// ==========================================================================

window.formatDate = function(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

window.getEventLabels = function() {
    let labels = JSON.parse(localStorage.getItem('workCalendar_eventLabels_v2'));
    if (!labels) {
        let oldLabels = JSON.parse(localStorage.getItem('workCalendar_eventLabels'));
        if (oldLabels && Array.isArray(oldLabels)) {
            labels = oldLabels.map(l => ({ name: l, isSkip: l === '전일행사' || l === '휴일' }));
        } else {
            labels = [
                { name: '일정', isSkip: false }, { name: '행사', isSkip: false },
                { name: '전일행사', isSkip: true }, { name: '제출', isSkip: false },
                { name: '기타', isSkip: false }
            ];
        }
        localStorage.setItem('workCalendar_eventLabels_v2', JSON.stringify(labels));
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

window.generateEventBadgesHTML = function(eventList) {
    if (!eventList || eventList.length === 0) return '';
    let html = `<div style="display:flex; flex-direction:column; gap:4px; margin-top:2px;">`;
    eventList.forEach(e => {
        let badgeColor = '#2563eb'; 
        let badgeBg = '#dbeafe';
        let textStyle = '';
        
        if (window.isSkipLabel(e.label)) {
            badgeColor = '#ef4444'; 
            badgeBg = '#fee2e2';
            textStyle = 'color:#ef4444; font-weight:bold;'; 
        } else if (e.label === '제출') {
            badgeColor = '#d97706'; 
            badgeBg = '#fef3c7';
        }

        html += `
        <div style="display:flex; align-items:flex-start; gap:4px; font-size:0.95rem; line-height:1.3;">
            <span style="background:${badgeBg}; color:${badgeColor}; padding:1px 5px; border-radius:4px; font-size:0.8rem; font-weight:bold; white-space:nowrap; flex-shrink:0;">${e.label}</span>
            <span style="white-space:pre-wrap; word-break:break-all; ${textStyle}">${e.content}</span>
        </div>`;
    });
    html += `</div>`;
    return html;
};

window.parseRawEventTextToEventList = function(rawText) {
    if (!rawText || !rawText.trim()) return [];
    const lines = rawText.split('\n');
    const eventList = [];
    const validLabels = window.getEventLabels().map(l => l.name);

    lines.forEach(line => {
        let t = line.trim();
        if(!t) return;
        
        const match = t.match(/^\[(.*?)\]\s*(.*)$/);
        if (match) {
            let labelName = match[1].trim();
            if (!validLabels.includes(labelName)) labelName = validLabels[0] || '일정'; 
            eventList.push({ label: labelName, content: match[2].trim() });
        } else {
            let defaultLabel = validLabels[0] || '일정';
            if (t.includes('(휴일)') || t.includes('(행사)')) {
                const skipLabel = window.getEventLabels().find(l => l.isSkip);
                if (skipLabel) defaultLabel = skipLabel.name;
            }
            eventList.push({ label: defaultLabel, content: t });
        }
    });
    return eventList;
};

window.formatEventListToText = function(eventList) {
    if (!eventList || eventList.length === 0) return '';
    return eventList.map(e => `[${e.label}] ${e.content}`).join('\n');
};

window.getJournalLabels = function() {
    let labels = JSON.parse(localStorage.getItem('workCalendar_journalLabels'));
    if (!labels || !Array.isArray(labels)) {
        labels = [
            { name: '참고' }, { name: '사건' }, { name: '감상' }, { name: '기타' }
        ];
        localStorage.setItem('workCalendar_journalLabels', JSON.stringify(labels));
    }
    return labels;
};
