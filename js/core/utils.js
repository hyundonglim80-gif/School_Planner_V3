// js/core/utils.js

import { doc, getDoc, setDoc } from "firebase/firestore";

export const parseLocalDate = (dateString) => {
    if (!dateString) return new Date();
    const parts = dateString.split('-');
    if (parts.length === 3) return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    return new Date(dateString);
};

export const formatDate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

export const LABEL_PALETTE = {
    red: { bg: '#fee2e2', text: '#b91c1c', border: '#fca5a5' },
    orange: { bg: '#ffedd5', text: '#c2410c', border: '#fdba74' },
    yellow: { bg: '#fef3c7', text: '#a16207', border: '#fcd34d' },
    green: { bg: '#dcfce3', text: '#15803d', border: '#86efac' },
    blue: { bg: '#dbeafe', text: '#1d4ed8', border: '#93c5fd' },
    indigo: { bg: '#e0e7ff', text: '#4338ca', border: '#a5b4fc' },
    purple: { bg: '#f3e8ff', text: '#7e22ce', border: '#d8b4fe' },
    gray: { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' }
};

export const generateTempId = (prefix = 'id') => {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 5)}`;
};

export const getEventLabels = () => {
    let labels = JSON.parse(localStorage.getItem('workCalendar_eventLabels_v4'));
    let changed = false;

    if (!labels || labels.length === 0) {
        labels = [
            { id: generateTempId('lbl_ev'), name: '일정', isSkip: false, isForward: false, isPeriod: false, isRecur: false, color: 'blue', isSystem: true },
            { id: generateTempId('lbl_ev'), name: '완료', isSkip: false, isForward: true,  isPeriod: false, isRecur: false, color: 'green', isSystem: true },
            { id: generateTempId('lbl_ev'), name: '주간', isSkip: false, isForward: false, isPeriod: true,  isRecur: false, color: 'orange', isSystem: true },
            { id: generateTempId('lbl_ev'), name: '반복', isSkip: false, isForward: false, isPeriod: false, isRecur: true,  color: 'purple', isSystem: true },
            { id: generateTempId('lbl_ev'), name: '휴일', isSkip: true,  isForward: false, isPeriod: false, isRecur: false, color: 'red', isSystem: true }
        ];
        changed = true;
    } else {
        labels.forEach(l => { 
            if (!l.id) { l.id = generateTempId('lbl_ev'); changed = true; } 
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
            let target = spec.prop === 'isNormal' 
                ? labels.find(l => !l.isSkip && !l.isForward && !l.isPeriod && !l.isRecur) || labels.find(l => l.name === '일정')
                : labels.find(l => l[spec.prop] === true);

            if (!target) {
                labels.push({ 
                    id: generateTempId('lbl_ev'), name: spec.defaultName, 
                    isSkip: spec.prop === 'isSkip', isForward: spec.prop === 'isForward', 
                    isPeriod: spec.prop === 'isPeriod', isRecur: spec.prop === 'isRecur', 
                    color: spec.color, isSystem: true 
                });
                changed = true;
            } else if (!target.isSystem) {
                target.isSystem = true;
                changed = true;
            }
        });
    }

    if (changed) {
        localStorage.setItem('workCalendar_eventLabels_v4', JSON.stringify(labels));
        if (window.auth?.currentUser) {
//            doc(window.getUserCol('settings'), 'labels').set({ eventLabels: labels }, { merge: true }).catch(e => console.warn(e));
            setDoc(doc(getUserCol('settings'), 'labels'), { eventLabels: labels }, { merge: true });
        }
    }
    return labels;
};

export const getJournalLabels = () => {
    let labels = JSON.parse(localStorage.getItem('workCalendar_journalLabels_v4'));
    let changed = false;

    if (!labels || labels.length === 0) {
        let oldLabels = JSON.parse(localStorage.getItem('workCalendar_journalLabels_v3')) || JSON.parse(localStorage.getItem('workCalendar_journalLabels'));
        if (oldLabels && Array.isArray(oldLabels)) {
            labels = oldLabels.map(l => typeof l === 'string' 
                ? { id: generateTempId('lbl_jr'), name: l, color: 'purple' } 
                : { id: generateTempId('lbl_jr'), name: l.name, color: l.color || 'purple' });
        } else {
            labels = [
                { id: generateTempId('lbl_jr'), name: '참고', color: 'gray' }, 
                { id: generateTempId('lbl_jr'), name: '사건', color: 'red' }, 
                { id: generateTempId('lbl_jr'), name: '감상', color: 'green' }, 
                { id: generateTempId('lbl_jr'), name: '상담', color: 'orange' }
            ];
        }
        changed = true;
    } else {
        labels.forEach(l => { if (!l.id) { l.id = generateTempId('lbl_jr'); changed = true; } });
    }

    if (changed) {
        localStorage.setItem('workCalendar_journalLabels_v4', JSON.stringify(labels));
        if (window.auth?.currentUser) {
            doc(window.getUserCol('settings'), 'labels').set({ journalLabels: labels }, { merge: true }).catch(e => console.warn(e));
        }
    }
    return labels;
};

export const getLabelStyle = (labelId, type = 'event') => {
    const labels = type === 'event' ? getEventLabels() : getJournalLabels();
    const target = labels.find(l => l.id === labelId || l.name === labelId); 
    if (target?.color && LABEL_PALETTE[target.color]) return LABEL_PALETTE[target.color];
    if (type === 'event' && target?.isSkip) return LABEL_PALETTE['red'];
    return type === 'event' ? LABEL_PALETTE['blue'] : LABEL_PALETTE['purple'];
};

export const isSkipLabel = (labelId) => !!getEventLabels().find(l => (l.id === labelId || l.name === labelId))?.isSkip;
export const isForwardLabel = (labelId) => !!getEventLabels().find(l => (l.id === labelId || l.name === labelId))?.isForward;
export const isPeriodLabel = (labelId) => !!getEventLabels().find(l => (l.id === labelId || l.name === labelId))?.isPeriod;

export const checkSkipConditionFromText = (rawText) => {
    if (!rawText) return false;
    if (rawText.includes('(휴일)') || rawText.includes('(행사)')) return true;
    const regex = /\[(.*?)\]/g;
    let match;
    const labels = getEventLabels();
    while ((match = regex.exec(rawText)) !== null) {
        if (labels.find(l => l.name === match[1])?.isSkip) return true;
    }
    return false;
};

// ==========================================================================
// 📅 학사일정 및 공휴일 엔진
// ==========================================================================
export const KOR_HOLIDAYS = {
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

export const getHolidayName = (dateStr) => {
    const mmdd = dateStr.substring(5);
    return KOR_HOLIDAYS[dateStr] || KOR_HOLIDAYS[mmdd] || null;
};

export const isRedDay = (dateStr, eventList = []) => {
    const dObj = parseLocalDate(dateStr);
    if (dObj.getDay() === 0) return true;
    if (getHolidayName(dateStr)) return true;

    const masterLabels = getEventLabels();
    return eventList.some(ev => (ev.labelIds || []).some(id => masterLabels.find(l => l.id === id)?.isSkip));
};

export const getSemesterDates = () => {
    if (window.semesterConfig?.sem1Start) {
        return {
            sem1Start: window.semesterConfig.sem1Start, sem1End: window.semesterConfig.sem1End,
            sem2Start: window.semesterConfig.sem2Start, sem2End: window.semesterConfig.sem2End,
            yearStart: window.semesterConfig.sem1Start, yearEnd: window.semesterConfig.sem2End
        };
    }
    const y = new Date().getFullYear();
    return {
        sem1Start: `${y}-03-02`, sem1End: `${y}-07-20`,
        sem2Start: `${y}-08-16`, sem2End: `${y+1}-01-10`,
        yearStart: `${y}-03-02`, yearEnd: `${y+1}-02-28`
    };
};

// ==========================================================================
// 🌉 과도기 호환성 레이어 
// ==========================================================================
window.parseLocalDate = parseLocalDate;
window.formatDate = formatDate;
window.LABEL_PALETTE = LABEL_PALETTE;
window.generateTempId = generateTempId;
window.getEventLabels = getEventLabels;
window.getJournalLabels = getJournalLabels;
window.getLabelStyle = getLabelStyle;
window.isSkipLabel = isSkipLabel;
window.isForwardLabel = isForwardLabel;
window.isPeriodLabel = isPeriodLabel;
window.checkSkipConditionFromText = checkSkipConditionFromText;
window.KOR_HOLIDAYS = KOR_HOLIDAYS;
window.getHolidayName = getHolidayName;
window.isRedDay = isRedDay;
window.getSemesterDates = getSemesterDates;