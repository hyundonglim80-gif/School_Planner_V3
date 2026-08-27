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
    // 🌟 윈도우 객체에 이미 해당 키가 있는지 확인하고, 없으면 생성 (개발 환경 리로드 오류 방지)
    if (!Object.getOwnPropertyDescriptor(window, key)) {
        Object.defineProperty(window, key, {
            get: () => store[key],
            set: (value) => { store[key] = value; },
            configurable: true // 🌟 재정의 가능하도록 설정
        });
    }
};

['currentDate', 'hasUnsavedChanges', 'periodNames', 'semesterConfig', 
 'timetableTemplates', 'dDayList', 'selectedDDayId', 'showWeekend', 'showClass'].forEach(bindToWindow);

if (!Object.getOwnPropertyDescriptor(window, 'currentScope')) {
    Object.defineProperty(window, 'currentScope', { get: () => store.scope, set: (v) => { store.scope = v; }, configurable: true });
}
if (!Object.getOwnPropertyDescriptor(window, 'currentMode')) {
    Object.defineProperty(window, 'currentMode', { get: () => store.mode, set: (v) => { store.mode = v; }, configurable: true });
}