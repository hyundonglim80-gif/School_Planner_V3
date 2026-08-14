// js/core/store.js

// 1. 순수 원본 데이터 (Raw Data)
const rawStore = {
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

// 2. 화면 갱신(Render) 함수들을 모아둘 구독(Subscribe) 리스트
const listeners = [];

// 외부에서 화면 갱신 함수를 스토어에 등록할 때 쓰는 함수
export const subscribe = (listener) => {
    listeners.push(listener);
};

// 3. 🪄 Proxy 마법 적용 (반응형 상태 관리자)
export const store = new Proxy(rawStore, {
    set(target, prop, value) {
        // 값이 이전과 완전히 똑같다면 무시 (불필요한 화면 깜빡임 방지)
        if (target[prop] === value) return true;

        // 값 변경
        target[prop] = value;

        // 💡 마법 1: 특정 상태가 바뀌면 알아서 로컬 스토리지에 자동 저장!
        const storageMapping = {
            scope: 'workCalendar_scope',
            mode: 'workCalendar_mode',
            showWeekend: 'workCalendar_showWeekend',
            showClass: 'workCalendar_showClass'
        };
        if (storageMapping[prop]) {
            localStorage.setItem(storageMapping[prop], value);
        }

        // 💡 마법 2: 상태가 변했으므로 화면을 자동으로 다시 그림!
        // 단, 타이핑할 때마다 바뀌는 'hasUnsavedChanges'는 화면을 다시 그릴 필요가 없으므로 제외
        if (prop !== 'hasUnsavedChanges') {
            listeners.forEach(listener => listener(prop, value));
        }

        return true;
    }
});

// ==========================================================================
// 🌉 과도기 호환성 레이어 
// ==========================================================================
const bindToWindow = (key) => {
    Object.defineProperty(window, key, {
        get: () => store[key],
        set: (value) => { store[key] = value; } // 여기서 set을 호출하면 Proxy가 알아서 감지합니다!
    });
};

['currentDate', 'hasUnsavedChanges', 'periodNames', 'semesterConfig', 
 'timetableTemplates', 'dDayList', 'selectedDDayId', 'showWeekend', 'showClass'].forEach(bindToWindow);

Object.defineProperty(window, 'currentScope', { get: () => store.scope, set: (v) => store.scope = v });
Object.defineProperty(window, 'currentMode', { get: () => store.mode, set: (v) => store.mode = v });