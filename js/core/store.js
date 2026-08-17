// js/core/store.js

export const store = {
    scope: localStorage.getItem('workCalendar_scope') || 'week',
    mode: localStorage.getItem('workCalendar_mode') || 'viewer',
    showWeekend: localStorage.getItem('workCalendar_showWeekend') === 'true',
    showClass: localStorage.getItem('workCalendar_showClass') !== 'false',
    currentDate: new Date(),
    hasUnsavedChanges: false,
    periodNames: ["1", "2", "3", "4", "5", "6"],
    semesterConfig: {},
    timetableTemplates: {},
    dDayList: [],
    selectedDDayId: null
};

// ==========================================================================
// 🌉 과도기 호환성 레이어 (Backward Compatibility Layer)
// 다른 파일들이 모듈화되기 전까지 기존 window 변수 접근을 안전하게 유지합니다.
// ==========================================================================
const bindToWindow = (key) => {
    Object.defineProperty(window, key, {
        get: () => store[key],
        set: (value) => { store[key] = value; }
    });
};

['currentDate', 'hasUnsavedChanges', 'periodNames', 'semesterConfig', 
 'timetableTemplates', 'dDayList', 'selectedDDayId', 'showWeekend', 'showClass'].forEach(bindToWindow);

Object.defineProperty(window, 'currentScope', { get: () => store.scope, set: (v) => { store.scope = v; } });
Object.defineProperty(window, 'currentMode', { get: () => store.mode, set: (v) => { store.mode = v; } });