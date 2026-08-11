// js/core/utils.js

// ==========================================================================
// 🛠️ 공통 유틸리티 및 데이터 가공 (Labels & Format) 엔진
// ==========================================================================

window.parseLocalDate = function(dateString) {
  if (!dateString) return new Date();
  const parts = dateString.split('-');
  if (parts.length === 3) {
    return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  }
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

// 🚀 렌더링 분리 방식 적용 (기호는 화면에 뿌릴 때만 동적 계산하여 부착)
window.generateEventBadgesHTML = function(eventList, dateStr = null, viewType = 'normal') {
    if (!eventList || eventList.length === 0) return '';
    let html = `<div style="display:flex; flex-direction:column; gap:4px; margin-top:2px;">`;
    const realTodayStr = window.formatDate(new Date()); 
    
    eventList.forEach((e, index) => {
        let labelsToRender = e.labels || (e.label ? [e.label] : []);

        const isCompleted = !!e.completed;
        const canComplete = labelsToRender.some(l => typeof window.isForwardLabel === 'function' && window.isForwardLabel(l)); 
        const isSkip = labelsToRender.some(l => typeof window.isSkipLabel === 'function' && window.isSkipLabel(l));

        // DB 오염 방지를 위해 출력 직전 혹시 모를 기호들을 한 번 더 청소
        let pureContent = (e.content || '').replace(/➡️\s*\(미완료\)/g, '').replace(/➡️\s*\(다음 날로 이월됨\)/g, '').replace(/↪️\s*/g, '').trim();

        let isMissedPast = false;
        let isForwardedToToday = false;

        if (canComplete && dateStr) {
            // 과거 일정이 미완료면 경고 아이콘 부여
            if (!isCompleted && dateStr < realTodayStr) {
                isMissedPast = true;
            }
            // 원본 작성일보다 미래로 복사되어 넘어온 일정이면 전달받음 아이콘 부여
            if (e.originalDate && e.originalDate < dateStr) {
                isForwardedToToday = true;
            }
        }

        let badgesHtml = '';
        if (labelsToRender.length > 0) {
            badgesHtml = labelsToRender.map(lName => {
                const style = window.getLabelStyle(lName, 'event');
                let badgeStyle;
                
                if (isMissedPast) {
                    badgeStyle = `background:#fee2e2; color:#ef4444; border:2px solid #ef4444;`;
                } else if (isCompleted && canComplete) {
                    badgeStyle = `background:#e2e8f0; color:#94a3b8; border:1px solid #cbd5e1; cursor:pointer;`;
                } else {
                    badgeStyle = `background:${style.bg}; color:${style.text}; border:1px solid ${style.border}; ${canComplete ? 'cursor:pointer;' : ''}`;
                }
                
                const onClickAttr = (dateStr && canComplete) ? `onclick="event.stopPropagation(); window.toggleEventCompletion('${dateStr}', ${index}, ${isCompleted})"` : '';
                
                return `<span ${onClickAttr} style="${badgeStyle} padding:1px 5px; border-radius:4px; font-size:0.8rem; font-weight:bold; white-space:nowrap; flex-shrink:0; transition:0.2s;" title="${canComplete ? '클릭하여 완료 상태 변경' : lName}">${lName}</span>`;
            }).join('');
        }

        let textStyle = isSkip ? `color:#1e293b; font-weight:bold;` : 'color:#1e293b;';
        
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

        let layoutStyle = `display:flex; align-items:flex-start; gap:6px; font-size:0.95rem; line-height:1.3;`;
        if (viewType === 'compact') {
            layoutStyle = `display:flex; flex-direction:column; align-items:flex-start; gap:2px; font-size:0.9rem; line-height:1.3;`;
        }

        html += `
        <div style="${layoutStyle}">
            ${badgesHtml ? `<div style="display:flex; flex-wrap:wrap; gap:4px; flex-shrink:0;">${badgesHtml}</div>` : ''}
            <span style="white-space:pre-wrap; word-break:break-all; ${textStyle}">${isCompleted && canComplete && !isMissedPast && !isForwardedToToday ? '✓ ' : ''}${pureContent}</span>
        </div>`;
    });
    html += `</div>`;
    return html;
};

// 💡 [V3.5 최적화] 낙관적 업데이트 기반 완료 제어 엔진 (스캔 위임 방식 결합)
window.toggleEventCompletion = function(dateStr, index, currentStatus) {
    const willBeComplete = !currentStatus;

    // [1단계: 화면(UI) 즉시 갱신] - 메모리 상의 데이터를 먼저 바꾸고 화면을 즉시 다시 그립니다.
    if (window.dayViewInstance && window.dayViewInstance.dateStr === dateStr && window.dayViewInstance.currentEvents) {
        if (window.dayViewInstance.currentEvents[index]) {
            window.dayViewInstance.currentEvents[index].completed = willBeComplete;
        }
    }
    if (window[`tempEvents_${dateStr}`] && window[`tempEvents_${dateStr}`][index]) {
        window[`tempEvents_${dateStr}`][index].completed = willBeComplete;
    }

    // DB 대기 없이 화면 즉시 다시 그리기
    if (window.render) window.render();

    // [2단계: 백그라운드 DB 동기화] - 화면 뒤에서 조용히 저장 및 이월 엔진을 돌립니다.
    setTimeout(async () => {
        try {
            const eventDoc = await window.getUserCol('events').doc(dateStr).get();
            if (!eventDoc.exists) return;
            const data = eventDoc.data();
            let eventList = data.eventList || [];

            if (eventList.length === 0 && data.eventText) {
                eventList = window.parseRawEventTextToEventList(data.eventText);
            }

            if (eventList[index]) {
                eventList[index].completed = willBeComplete;
                const newText = window.formatEventListToText(eventList);
                
                await window.getUserCol('events').doc(dateStr).set({
                    eventList: eventList,
                    eventText: newText,
                    updatedAt: Date.now()
                }, { merge: true });

                // 체크하자마자 스캔 엔진 가동시켜 연쇄 삭제(동기화) 수행
                if (window.autoForwardIncompleteEvents) {
                    await window.autoForwardIncompleteEvents();
                }
                console.log(`✅ [Optimistic UI] ${dateStr} 완료 상태 백그라운드 동기화 완료`);
            }
        } catch (error) {
            console.error("🚨 완료 상태 변경 중 오류:", error);
        }
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
