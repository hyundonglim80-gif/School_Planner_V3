<<<<<<< HEAD
// js/core/store.js

export const store = {
    // 💡 [수정] 최초 접속 시 아무 설정이 없으면 'month'(월간) 페이지로 시작하도록 변경
    scope: localStorage.getItem('workCalendar_scope') || 'month',
    // 💡 [수정] 최초 접속 시 아무 설정이 없으면 'viewer'(보기) 모드로 시작
    mode: localStorage.getItem('workCalendar_mode') || 'viewer',
    
    // 🌟 페이지별 주말 표시 기본값 및 개별 저장소 적용
    get showWeekend() {
        const val = localStorage.getItem(`workCalendar_showWeekend_${this.scope}`);
        if (val !== null) return val === 'true';
        // 💡 설정이 없으면: 년간/월간은 주말 보이기(true), 나머지는 숨기기(false)
        return this.scope === 'year' || this.scope === 'month';
    },
    set showWeekend(value) {
        localStorage.setItem(`workCalendar_showWeekend_${this.scope}`, value);
    },

    // 🌟 페이지별 수업 표시 기본값 및 개별 저장소 적용
    get showClass() {
        const val = localStorage.getItem(`workCalendar_showClass_${this.scope}`);
        if (val !== null) return val === 'true';
        // 💡 설정이 없으면: 년간/월간은 수업 숨기기(false), 나머지는 보이기(true)
        return this.scope !== 'year' && this.scope !== 'month';
    },
    set showClass(value) {
        localStorage.setItem(`workCalendar_showClass_${this.scope}`, value);
    },

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
    if (!Object.getOwnPropertyDescriptor(window, key)) {
        Object.defineProperty(window, key, {
            get: () => store[key],
            set: (value) => { store[key] = value; },
            configurable: true 
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
=======
// js/core/store.js

export const store = {
    // 💡 [수정] 최초 접속 시 아무 설정이 없으면 'month'(월간) 페이지로 시작하도록 변경
    scope: localStorage.getItem('workCalendar_scope') || 'month',
    // 💡 [수정] 최초 접속 시 아무 설정이 없으면 'viewer'(보기) 모드로 시작
    mode: localStorage.getItem('workCalendar_mode') || 'viewer',
    
    // 🌟 페이지별 주말 표시 기본값 및 개별 저장소 적용
    get showWeekend() {
        const val = localStorage.getItem(`workCalendar_showWeekend_${this.scope}`);
        if (val !== null) return val === 'true';
        // 💡 설정이 없으면: 년간/월간은 주말 보이기(true), 나머지는 숨기기(false)
        return this.scope === 'year' || this.scope === 'month';
    },
    set showWeekend(value) {
        localStorage.setItem(`workCalendar_showWeekend_${this.scope}`, value);
    },

    // 🌟 페이지별 수업 표시 기본값 및 개별 저장소 적용
    get showClass() {
        const val = localStorage.getItem(`workCalendar_showClass_${this.scope}`);
        if (val !== null) return val === 'true';
        // 💡 설정이 없으면: 년간/월간은 수업 숨기기(false), 나머지는 보이기(true)
        return this.scope !== 'year' && this.scope !== 'month';
    },
    set showClass(value) {
        localStorage.setItem(`workCalendar_showClass_${this.scope}`, value);
    },

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
    if (!Object.getOwnPropertyDescriptor(window, key)) {
        Object.defineProperty(window, key, {
            get: () => store[key],
            set: (value) => { store[key] = value; },
            configurable: true 
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
>>>>>>> d1348ae5447b87f69a849130f4f6a30f4c5cc4fe
