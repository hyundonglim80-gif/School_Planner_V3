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
            // 💡 텍스트에서 라벨명을 발견하면 ID를 찾아 넣어줍니다. 매칭 안되면 빈 배열
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
        } else if (e.labels && e.labels.length > 0) { // 마이그레이션 전 데이터 호환용
            labelStr = `[${e.labels[0]}] `;
        }
        return `${e.completed ? '[v] ' : ''}${labelStr}${e.content}`;
    }).join('\n');
};

// 💡 기록 라벨도 초기 생성 시 ID를 부여해줍니다.
window.getJournalLabels = function() {
    let labels = JSON.parse(localStorage.getItem('workCalendar_journalLabels_v4'));
    if (!labels) {
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
        localStorage.setItem('workCalendar_journalLabels_v4', JSON.stringify(labels));
    }
    return labels;
};

// ... 하단의 getSemesterDates 등은 그대로 유지합니다.
