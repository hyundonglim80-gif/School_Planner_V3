<<<<<<< HEAD
// js/modules/sync.js
import { store } from '../core/store.js';
import { getValidGoogleToken } from '../api/auth.js';
import { ProgressModal } from '../ui/progressModal.js';
import { exportTasksToGoogle, importTasksFromGoogle } from './syncTasks.js';
import { exportCalendarData, importCalendarData } from './syncCalendar.js';
import { fetchHolidaysFromGovApi } from '../api/govApi.js';
import { formatDate, getEventLabels } from '../core/utils.js'; 
import { db } from '../api/firebaseInit.js'; 
import { getUserCol, getGroupCol } from '../api/database.js'; 
import { doc, getDoc, writeBatch } from "firebase/firestore";

export const executeGoogleExport = async function() {
    const token = await getValidGoogleToken();
    if (!token) return;

    const startStr = document.getElementById('backup-start-date').value;
    const endStr = document.getElementById('backup-end-date').value;
    const mode = document.querySelector('input[name="import-mode"]:checked').value; 
    
    const syncEvent = document.getElementById('backup-chk-event').checked;
    const syncClass = document.getElementById('backup-chk-class').checked;
    const syncJournal = document.getElementById('backup-chk-journal').checked;
    const syncEval = document.getElementById('backup-chk-eval').checked;
    const syncTasks = document.getElementById('backup-chk-memo').checked;

    if (!syncEvent && !syncClass && !syncJournal && !syncTasks && !syncEval) { alert("동기화할 대상을 선택해 주세요."); return; }
    if (new Date(startStr) > new Date(endStr)) { alert("시작일이 종료일보다 늦을 수 없습니다."); return; }

    ProgressModal.show("구글 단방향 동기화");
    ProgressModal.update(`구글 캘린더로 내보내는 중... (${mode === 'merge' ? '병합' : '교체'})`, 0);

    try {
        if (syncTasks) {
            ProgressModal.update("📝 구글 Tasks 확인 및 메모 동기화 중...", 10);
            await exportTasksToGoogle(token, mode);
        }

        if (syncEvent || syncClass || syncJournal || syncEval) {
            await exportCalendarData(token, startStr, endStr, mode, { syncEvent, syncClass, syncJournal, syncEval });
        }

        ProgressModal.complete("✅ 구글 단방향 동기화(내보내기)가 완벽하게 완료되었습니다!", () => {
            if (window.BackupManager && window.BackupManager.modal) window.BackupManager.modal.close();
            store.hasUnsavedChanges = false; 
            if (typeof window.render === 'function') window.render();
        });
    } catch (error) {
        console.error("동기화 에러:", error);
        ProgressModal.error(error.message, () => {
            if(error.message && (error.message.includes('401') || error.message.includes('403'))) {
                alert("구글 API 권한이 거부되었습니다.\n\n[해결 방법]\n1. 창을 닫고 로그아웃합니다.\n2. 다시 로그인할 때 뜨는 구글 팝업창에서 모든 접근 권한 체크박스를 반드시 체크해주세요!");
            }
        });
    }
};

export const quickGoogleSync = async function() {
    if (store.hasUnsavedChanges) {
        alert("저장되지 않은 변경사항이 있습니다. 먼저 뷰어[보기] 모드로 전환하여 저장 후 동기화해 주세요.");
        return;
    }

    const token = await getValidGoogleToken();
    if (!token) return;

    let startStr, endStr;
    let syncEvent = false, syncClass = false, syncJournal = false, syncTasks = false;
    
    const d = store.currentDate;
    const scope = store.scope;

    if (scope === 'memo') {
        syncTasks = true;
    } else if (scope === 'day') {
        startStr = endStr = formatDate(d);
        syncEvent = true; syncClass = true; syncJournal = true;
    } else if (scope === 'week') {
        const d1 = new Date(d); d1.setDate(d.getDate() - d.getDay());
        const d2 = new Date(d1); d2.setDate(d1.getDate() + 6);
        startStr = formatDate(d1); endStr = formatDate(d2);
        syncEvent = true; syncClass = true;
    } else if (scope === 'month') {
        const y = d.getFullYear(); const m = d.getMonth();
        startStr = formatDate(new Date(y, m, 1)); 
        endStr = formatDate(new Date(y, m + 1, 0));
        syncEvent = true; syncClass = true;
    } else if (scope === 'year') {
        const y = d.getFullYear();
        const startY = d.getMonth() < 2 ? y - 1 : y; 
        startStr = formatDate(new Date(startY, 2, 1)); 
        endStr = formatDate(new Date(startY + 1, 2, 0)); 
        syncEvent = true; syncClass = true;
    }

    const scopeNames = { memo: '메모', day: '하루', week: '주간', month: '월간', year: '년간' };
    
    ProgressModal.show(`구글 빠른 동기화 (${scopeNames[scope]})`);
    ProgressModal.update(`현재 화면의 데이터를 구글과 교체(동기화)하는 중...`, 0);

    try {
        if (syncTasks) {
            ProgressModal.update("📝 구글 Tasks 확인 및 메모 동기화 중...", 10);
            await exportTasksToGoogle(token, 'overwrite');
        }

        if (syncEvent || syncClass || syncJournal) {
            await exportCalendarData(token, startStr, endStr, 'overwrite', { syncEvent, syncClass, syncJournal, syncEval: false });
        }

        ProgressModal.complete(`✅ 구글 단방향 교체 동기화(${scopeNames[scope]})가 완료되었습니다!`, () => {
            store.hasUnsavedChanges = false; 
        });
    } catch (error) {
        console.error("동기화 에러:", error);
        ProgressModal.error(error.message, () => {
            if(error.message && (error.message.includes('401') || error.message.includes('403'))) {
                alert("구글 API 권한이 거부되었습니다.\n\n[해결 방법]\n1. 창을 닫고 로그아웃합니다.\n2. 다시 로그인할 때 뜨는 구글 팝업창에서 모든 접근 권한 체크박스를 반드시 체크해주세요!");
            }
        });
    }
};

// 💡 변경됨: 가져온 휴일 데이터를 라벨이 아닌 전역 휴일 저장소(settings/holidays)에 보관 및 기존 휴일 일정 청소
export const executeHolidayImport = async function(startStr, endStr, scope) {
    if (!startStr || !endStr) return alert("가져올 기간을 먼저 설정해 주세요.");
    if (new Date(startStr) > new Date(endStr)) return alert("시작일이 종료일보다 늦을 수 없습니다.");
    
    const scopeName = scope === 'personal' ? '개인' : '공유 그룹';
    if (!confirm(`[${scopeName} 공간]\n${startStr} ~ ${endStr} 기간의 공휴일을 불러오시겠습니까?\n(기존 데이터는 갱신되며, 라벨 형태가 아닌 글씨로 출력됩니다)`)) return;

    ProgressModal.show("🇰🇷 공휴일 가져오기");
    ProgressModal.update("공휴일 데이터를 확인하는 중...", 20);

    try {
        const token = await getValidGoogleToken();
        let holidaysMap = {}; 
        let sourceUsed = "";

        const savedApiKey = localStorage.getItem('gov_holiday_api_key') || '61eKHEN9Q5rvaYiHWrtSUco3vwTEhoCiF0d8L2Zdu990gANAp3Cnc0yKKgWqOm3s%2F4Mmqa9STa6WvNHboA1RsQ%3D%3D';
        const startYear = new Date(startStr).getFullYear();
        const endYear = new Date(endStr).getFullYear();

        let apiSuccess = false;
        for (let y = startYear; y <= endYear; y++) {
            try {
                const govHolidays = await fetchHolidaysFromGovApi(y, savedApiKey);
                if (govHolidays && Object.keys(govHolidays).length > 0) {
                    apiSuccess = true;
                    for (const [dStr, hName] of Object.entries(govHolidays)) {
                        if (dStr >= startStr && dStr <= endStr) { holidaysMap[dStr] = hName; }
                    }
                }
            } catch (err) {}
        }

        if (apiSuccess && Object.keys(holidaysMap).length > 0) {
            sourceUsed = "공공데이터 포털";
        } else if (token) {
            ProgressModal.update("구글 캘린더 공휴일 정보를 대체로 불러오는 중...", 40);
            try {
                const holidayCalId = encodeURIComponent('ko.south_korea#holiday@group.v.calendar.google.com');
                const timeMin = new Date(startStr + 'T00:00:00+09:00').toISOString();
                const timeMax = new Date(endStr + 'T23:59:59+09:00').toISOString();
                
                const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${holidayCalId}/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true`, { headers: { 'Authorization': `Bearer ${token}` } });
                const data = await res.json();
                
                if (data.items && data.items.length > 0) {
                    data.items.forEach(ev => {
                        let dStr = ev.start?.date || (ev.start?.dateTime ? ev.start.dateTime.split('T')[0] : null);
                        if (dStr && dStr >= startStr && dStr <= endStr) { holidaysMap[dStr] = ev.summary; }
                    });
                    if (Object.keys(holidaysMap).length > 0) sourceUsed = "구글 캘린더";
                }
            } catch (e) {}
        }

        if (Object.keys(holidaysMap).length === 0) {
            ProgressModal.error("해당 기간에 가져올 수 있는 공휴일 데이터가 없습니다.");
            return;
        }

        ProgressModal.update("글씨 출력을 위한 전역 휴일 등록 및 기존 잔재 청소 중...", 70);

        // 새 휴일 데이터를 settings/holidays 에 독립적으로 병합 보관
        const holidaysDocRef = doc(getUserCol('settings'), 'holidays');
        let existingHolidays = {};
        try {
            const snap = await getDoc(holidaysDocRef);
            if (snap.exists()) existingHolidays = snap.data().map || {};
        } catch (e) {}

        Object.assign(existingHolidays, holidaysMap);
        await writeBatch(db).set(holidaysDocRef, { map: existingHolidays, updatedAt: Date.now() }, { merge: true }).commit();
        
        // 메모리에 즉시 캐싱하여 렌더링에 반영되도록 처리
        localStorage.setItem('sp3_dynamic_holidays', JSON.stringify(existingHolidays));
        window.dynamicHolidays = existingHolidays;

        // 과거 방식으로 eventList에 저장되어 있던(라벨 생성했던) 휴일 일정을 청소하여 중복 표시 방지
        const colRef = scope === 'personal' ? getUserCol('events') : getGroupCol(scope, 'events');
        let curr = new Date(startStr);
        const endD = new Date(endStr);
        let batch = writeBatch(db);
        let count = 0;

        while (curr <= endD) {
            const dStr = formatDate(curr);
            const docRef = doc(colRef, dStr);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                let evList = docSnap.data().eventList || [];
                let filteredList = evList.filter(e => e.source !== 'holiday'); // 구버전 휴일 제거

                if (filteredList.length !== evList.length) {
                    batch.set(docRef, { eventList: filteredList, updatedAt: Date.now() }, { merge: true });
                    count++;
                    if (count >= 400) { await batch.commit(); batch = writeBatch(db); count = 0; }
                }
            }
            curr.setDate(curr.getDate() + 1);
        }

        if (count > 0) await batch.commit();

        ProgressModal.complete(`✅ 공휴일 동기화 완료!\n[출처: ${sourceUsed}]\n라벨 생성 없이 날짜 하단 글씨로 깔끔하게 출력됩니다.`, () => {
            store.hasUnsavedChanges = false;
            if (typeof window.render === 'function') window.render(true);
        });

    } catch (error) {
        console.error("공휴일 가져오기 에러:", error);
        ProgressModal.error("공휴일을 불러오는 중 오류가 발생했습니다.\n" + error.message);
    }
};

export const executeGoogleImport = async function() {
    alert("현재 시스템은 데이터 안정성을 위해 '단방향 동기화(SP3 ➡️ 구글)' 모드로 작동합니다.\n구글 캘린더에서 SP3로 가져오기는 더 이상 지원되지 않습니다.");
};

window.executeGoogleExport = executeGoogleExport;
window.executeGoogleImport = executeGoogleImport;
window.executeHolidayImport = executeHolidayImport; 
window.quickGoogleSync = quickGoogleSync; 
window.fetchHolidaysFromGovApi = fetchHolidaysFromGovApi;
=======
// js/modules/sync.js
import { store } from '../core/store.js';
import { getValidGoogleToken } from '../api/auth.js';
import { ProgressModal } from '../ui/progressModal.js';
import { exportTasksToGoogle, importTasksFromGoogle } from './syncTasks.js';
import { exportCalendarData, importCalendarData } from './syncCalendar.js';
import { fetchHolidaysFromGovApi } from '../api/govApi.js';
import { formatDate, getEventLabels } from '../core/utils.js'; 
import { db } from '../api/firebaseInit.js'; 
import { getUserCol, getGroupCol } from '../api/database.js'; 
import { doc, getDoc, writeBatch } from "firebase/firestore";

export const executeGoogleExport = async function() {
    const token = await getValidGoogleToken();
    if (!token) return;

    const startStr = document.getElementById('backup-start-date').value;
    const endStr = document.getElementById('backup-end-date').value;
    const mode = document.querySelector('input[name="import-mode"]:checked').value; 
    
    const syncEvent = document.getElementById('backup-chk-event').checked;
    const syncClass = document.getElementById('backup-chk-class').checked;
    const syncJournal = document.getElementById('backup-chk-journal').checked;
    const syncEval = document.getElementById('backup-chk-eval').checked;
    const syncTasks = document.getElementById('backup-chk-memo').checked;

    if (!syncEvent && !syncClass && !syncJournal && !syncTasks && !syncEval) { alert("동기화할 대상을 선택해 주세요."); return; }
    if (new Date(startStr) > new Date(endStr)) { alert("시작일이 종료일보다 늦을 수 없습니다."); return; }

    ProgressModal.show("구글 단방향 동기화");
    ProgressModal.update(`구글 캘린더로 내보내는 중... (${mode === 'merge' ? '병합' : '교체'})`, 0);

    try {
        if (syncTasks) {
            ProgressModal.update("📝 구글 Tasks 확인 및 메모 동기화 중...", 10);
            await exportTasksToGoogle(token, mode);
        }

        if (syncEvent || syncClass || syncJournal || syncEval) {
            await exportCalendarData(token, startStr, endStr, mode, { syncEvent, syncClass, syncJournal, syncEval });
        }

        ProgressModal.complete("✅ 구글 단방향 동기화(내보내기)가 완벽하게 완료되었습니다!", () => {
            if (window.BackupManager && window.BackupManager.modal) window.BackupManager.modal.close();
            store.hasUnsavedChanges = false; 
            if (typeof window.render === 'function') window.render();
        });
    } catch (error) {
        console.error("동기화 에러:", error);
        ProgressModal.error(error.message, () => {
            if(error.message && (error.message.includes('401') || error.message.includes('403'))) {
                alert("구글 API 권한이 거부되었습니다.\n\n[해결 방법]\n1. 창을 닫고 로그아웃합니다.\n2. 다시 로그인할 때 뜨는 구글 팝업창에서 모든 접근 권한 체크박스를 반드시 체크해주세요!");
            }
        });
    }
};

export const quickGoogleSync = async function() {
    if (store.hasUnsavedChanges) {
        alert("저장되지 않은 변경사항이 있습니다. 먼저 뷰어[보기] 모드로 전환하여 저장 후 동기화해 주세요.");
        return;
    }

    const token = await getValidGoogleToken();
    if (!token) return;

    let startStr, endStr;
    let syncEvent = false, syncClass = false, syncJournal = false, syncTasks = false;
    
    const d = store.currentDate;
    const scope = store.scope;

    if (scope === 'memo') {
        syncTasks = true;
    } else if (scope === 'day') {
        startStr = endStr = formatDate(d);
        syncEvent = true; syncClass = true; syncJournal = true;
    } else if (scope === 'week') {
        const d1 = new Date(d); d1.setDate(d.getDate() - d.getDay());
        const d2 = new Date(d1); d2.setDate(d1.getDate() + 6);
        startStr = formatDate(d1); endStr = formatDate(d2);
        syncEvent = true; syncClass = true;
    } else if (scope === 'month') {
        const y = d.getFullYear(); const m = d.getMonth();
        startStr = formatDate(new Date(y, m, 1)); 
        endStr = formatDate(new Date(y, m + 1, 0));
        syncEvent = true; syncClass = true;
    } else if (scope === 'year') {
        const y = d.getFullYear();
        const startY = d.getMonth() < 2 ? y - 1 : y; 
        startStr = formatDate(new Date(startY, 2, 1)); 
        endStr = formatDate(new Date(startY + 1, 2, 0)); 
        syncEvent = true; syncClass = true;
    }

    const scopeNames = { memo: '메모', day: '하루', week: '주간', month: '월간', year: '년간' };
    
    ProgressModal.show(`구글 빠른 동기화 (${scopeNames[scope]})`);
    ProgressModal.update(`현재 화면의 데이터를 구글과 교체(동기화)하는 중...`, 0);

    try {
        if (syncTasks) {
            ProgressModal.update("📝 구글 Tasks 확인 및 메모 동기화 중...", 10);
            await exportTasksToGoogle(token, 'overwrite');
        }

        if (syncEvent || syncClass || syncJournal) {
            await exportCalendarData(token, startStr, endStr, 'overwrite', { syncEvent, syncClass, syncJournal, syncEval: false });
        }

        ProgressModal.complete(`✅ 구글 단방향 교체 동기화(${scopeNames[scope]})가 완료되었습니다!`, () => {
            store.hasUnsavedChanges = false; 
        });
    } catch (error) {
        console.error("동기화 에러:", error);
        ProgressModal.error(error.message, () => {
            if(error.message && (error.message.includes('401') || error.message.includes('403'))) {
                alert("구글 API 권한이 거부되었습니다.\n\n[해결 방법]\n1. 창을 닫고 로그아웃합니다.\n2. 다시 로그인할 때 뜨는 구글 팝업창에서 모든 접근 권한 체크박스를 반드시 체크해주세요!");
            }
        });
    }
};

// 💡 변경됨: 가져온 휴일 데이터를 라벨이 아닌 전역 휴일 저장소(settings/holidays)에 보관 및 기존 휴일 일정 청소
export const executeHolidayImport = async function(startStr, endStr, scope) {
    if (!startStr || !endStr) return alert("가져올 기간을 먼저 설정해 주세요.");
    if (new Date(startStr) > new Date(endStr)) return alert("시작일이 종료일보다 늦을 수 없습니다.");
    
    const scopeName = scope === 'personal' ? '개인' : '공유 그룹';
    if (!confirm(`[${scopeName} 공간]\n${startStr} ~ ${endStr} 기간의 공휴일을 불러오시겠습니까?\n(기존 데이터는 갱신되며, 라벨 형태가 아닌 글씨로 출력됩니다)`)) return;

    ProgressModal.show("🇰🇷 공휴일 가져오기");
    ProgressModal.update("공휴일 데이터를 확인하는 중...", 20);

    try {
        const token = await getValidGoogleToken();
        let holidaysMap = {}; 
        let sourceUsed = "";

        const savedApiKey = localStorage.getItem('gov_holiday_api_key') || '61eKHEN9Q5rvaYiHWrtSUco3vwTEhoCiF0d8L2Zdu990gANAp3Cnc0yKKgWqOm3s%2F4Mmqa9STa6WvNHboA1RsQ%3D%3D';
        const startYear = new Date(startStr).getFullYear();
        const endYear = new Date(endStr).getFullYear();

        let apiSuccess = false;
        for (let y = startYear; y <= endYear; y++) {
            try {
                const govHolidays = await fetchHolidaysFromGovApi(y, savedApiKey);
                if (govHolidays && Object.keys(govHolidays).length > 0) {
                    apiSuccess = true;
                    for (const [dStr, hName] of Object.entries(govHolidays)) {
                        if (dStr >= startStr && dStr <= endStr) { holidaysMap[dStr] = hName; }
                    }
                }
            } catch (err) {}
        }

        if (apiSuccess && Object.keys(holidaysMap).length > 0) {
            sourceUsed = "공공데이터 포털";
        } else if (token) {
            ProgressModal.update("구글 캘린더 공휴일 정보를 대체로 불러오는 중...", 40);
            try {
                const holidayCalId = encodeURIComponent('ko.south_korea#holiday@group.v.calendar.google.com');
                const timeMin = new Date(startStr + 'T00:00:00+09:00').toISOString();
                const timeMax = new Date(endStr + 'T23:59:59+09:00').toISOString();
                
                const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${holidayCalId}/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true`, { headers: { 'Authorization': `Bearer ${token}` } });
                const data = await res.json();
                
                if (data.items && data.items.length > 0) {
                    data.items.forEach(ev => {
                        let dStr = ev.start?.date || (ev.start?.dateTime ? ev.start.dateTime.split('T')[0] : null);
                        if (dStr && dStr >= startStr && dStr <= endStr) { holidaysMap[dStr] = ev.summary; }
                    });
                    if (Object.keys(holidaysMap).length > 0) sourceUsed = "구글 캘린더";
                }
            } catch (e) {}
        }

        if (Object.keys(holidaysMap).length === 0) {
            ProgressModal.error("해당 기간에 가져올 수 있는 공휴일 데이터가 없습니다.");
            return;
        }

        ProgressModal.update("글씨 출력을 위한 전역 휴일 등록 및 기존 잔재 청소 중...", 70);

        // 새 휴일 데이터를 settings/holidays 에 독립적으로 병합 보관
        const holidaysDocRef = doc(getUserCol('settings'), 'holidays');
        let existingHolidays = {};
        try {
            const snap = await getDoc(holidaysDocRef);
            if (snap.exists()) existingHolidays = snap.data().map || {};
        } catch (e) {}

        Object.assign(existingHolidays, holidaysMap);
        await writeBatch(db).set(holidaysDocRef, { map: existingHolidays, updatedAt: Date.now() }, { merge: true }).commit();
        
        // 메모리에 즉시 캐싱하여 렌더링에 반영되도록 처리
        localStorage.setItem('sp3_dynamic_holidays', JSON.stringify(existingHolidays));
        window.dynamicHolidays = existingHolidays;

        // 과거 방식으로 eventList에 저장되어 있던(라벨 생성했던) 휴일 일정을 청소하여 중복 표시 방지
        const colRef = scope === 'personal' ? getUserCol('events') : getGroupCol(scope, 'events');
        let curr = new Date(startStr);
        const endD = new Date(endStr);
        let batch = writeBatch(db);
        let count = 0;

        while (curr <= endD) {
            const dStr = formatDate(curr);
            const docRef = doc(colRef, dStr);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                let evList = docSnap.data().eventList || [];
                let filteredList = evList.filter(e => e.source !== 'holiday'); // 구버전 휴일 제거

                if (filteredList.length !== evList.length) {
                    batch.set(docRef, { eventList: filteredList, updatedAt: Date.now() }, { merge: true });
                    count++;
                    if (count >= 400) { await batch.commit(); batch = writeBatch(db); count = 0; }
                }
            }
            curr.setDate(curr.getDate() + 1);
        }

        if (count > 0) await batch.commit();

        ProgressModal.complete(`✅ 공휴일 동기화 완료!\n[출처: ${sourceUsed}]\n라벨 생성 없이 날짜 하단 글씨로 깔끔하게 출력됩니다.`, () => {
            store.hasUnsavedChanges = false;
            if (typeof window.render === 'function') window.render(true);
        });

    } catch (error) {
        console.error("공휴일 가져오기 에러:", error);
        ProgressModal.error("공휴일을 불러오는 중 오류가 발생했습니다.\n" + error.message);
    }
};

export const executeGoogleImport = async function() {
    alert("현재 시스템은 데이터 안정성을 위해 '단방향 동기화(SP3 ➡️ 구글)' 모드로 작동합니다.\n구글 캘린더에서 SP3로 가져오기는 더 이상 지원되지 않습니다.");
};

window.executeGoogleExport = executeGoogleExport;
window.executeGoogleImport = executeGoogleImport;
window.executeHolidayImport = executeHolidayImport; 
window.quickGoogleSync = quickGoogleSync; 
window.fetchHolidaysFromGovApi = fetchHolidaysFromGovApi;
>>>>>>> d1348ae5447b87f69a849130f4f6a30f4c5cc4fe
