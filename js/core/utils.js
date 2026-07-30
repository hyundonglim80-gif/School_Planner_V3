// ==========================================================================
// 🛠️ 공통 유틸리티 및 데이터 가공 (Labels & Format) 엔진
// ==========================================================================

window.formatDate = function(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// 🎨 무지개색(파스텔톤) 대표 팔레트 정의
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

// 🏷️ 라벨의 색상 스타일을 찾아주는 헬퍼 함수
window.getLabelStyle = function(labelName, type = 'event') {
    const labels = type === 'event' ? window.getEventLabels() : window.getJournalLabels();
    const target = labels.find(l => l.name === labelName);
    if (target && target.color && window.LABEL_PALETTE[target.color]) {
        return window.LABEL_PALETTE[target.color];
    }
    // 색상이 없을 경우의 기본값 (수업삭제는 빨강, 일지는 보라, 일정은 파랑)
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

// 🎨 뱃지 렌더링 시 팔레트 색상 동적 적용
window.generateEventBadgesHTML = function(eventList) {
    if (!eventList || eventList.length === 0) return '';
    let html = `<div style="display:flex; flex-direction:column; gap:4px; margin-top:2px;">`;
    eventList.forEach(e => {
        const style = window.getLabelStyle(e.label, 'event');
        let textStyle = window.isSkipLabel(e.label) ? `color:${style.text}; font-weight:bold;` : 'color:#1e293b;';

        html += `
        <div style="display:flex; align-items:flex-start; gap:4px; font-size:0.95rem; line-height:1.3;">
            <span style="background:${style.bg}; color:${style.text}; border:1px solid ${style.border}; padding:1px 5px; border-radius:4px; font-size:0.8rem; font-weight:bold; white-space:nowrap; flex-shrink:0;">${e.label}</span>
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
    return eventList.map(e => `[${e.label}]${e.content}`).join('\n');
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
