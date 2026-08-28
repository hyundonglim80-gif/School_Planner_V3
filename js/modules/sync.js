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
    ProgressModal.update(`현재 화면의 데이터를 구글로 전송하는 중...`, 0);

    try {
        if (syncTasks) {
            ProgressModal.update("📝 구글 Tasks 확인 및 메모 동기화 중...", 10);
            await exportTasksToGoogle(token, 'merge');
        }

        if (syncEvent || syncClass || syncJournal) {
            await exportCalendarData(token, startStr, endStr, 'merge', { syncEvent, syncClass, syncJournal, syncEval: false });
        }

        ProgressModal.complete(`✅ 구글 단방향 동기화(${scopeNames[scope]})가 완료되었습니다!`, () => {
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

// 💡 추가됨: 공휴일 독립 가져오기 함수
export const executeHolidayImport = async function(startStr, endStr, scope) {
    if (!startStr || !endStr) return alert("가져올 기간을 먼저 설정해 주세요.");
    if (new Date(startStr) > new Date(endStr)) return alert("시작일이 종료일보다 늦을 수 없습니다.");
    
    const scopeName = scope === 'personal' ? '개인' : '공유 그룹';
    if (!confirm(`[${scopeName} 공간]\n${startStr} ~ ${endStr} 기간의 공휴일을 불러오시겠습니까?\n(기존에 등록된 공휴일은 갱신됩니다)`)) return;

    ProgressModal.show("🇰🇷 공휴일 가져오기");
    ProgressModal.update("공휴일 데이터를 확인하는 중...", 20);

    try {
        const token = await getValidGoogleToken();
        let holidaysMap = {}; // { 'YYYY-MM-DD': '공휴일이름' }
        let sourceUsed = "";

        // 1단계: 정부 공공데이터 API 시도
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
                        if (dStr >= startStr && dStr <= endStr) {
                            holidaysMap[dStr] = hName;
                        }
                    }
                }
            } catch (err) {}
        }

        if (apiSuccess && Object.keys(holidaysMap).length > 0) {
            sourceUsed = "공공데이터 포털";
        } else if (token) {
            // 2단계: 공공데이터 실패 시 구글 캘린더 공휴일 달력으로 대체 시도
            ProgressModal.update("구글 캘린더 공휴일 정보를 대체로 불러오는 중...", 40);
            try {
                const holidayCalId = encodeURIComponent('ko.south_korea#holiday@group.v.calendar.google.com');
                const timeMin = new Date(startStr + 'T00:00:00+09:00').toISOString();
                const timeMax = new Date(endStr + 'T23:59:59+09:00').toISOString();
                
                // 구글 API 호출
                const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${holidayCalId}/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                
                if (data.items && data.items.length > 0) {
                    data.items.forEach(ev => {
                        let dStr = ev.start?.date || (ev.start?.dateTime ? ev.start.dateTime.split('T')[0] : null);
                        if (dStr && dStr >= startStr && dStr <= endStr) {
                            holidaysMap[dStr] = ev.summary;
                        }
                    });
                    if (Object.keys(holidaysMap).length > 0) {
                        sourceUsed = "구글 캘린더";
                    }
                }
            } catch (e) {}
        }

        if (Object.keys(holidaysMap).length === 0) {
            ProgressModal.error("해당 기간에 가져올 수 있는 공휴일 데이터가 없습니다.");
            return;
        }

        ProgressModal.update("기존 공휴일 정리 및 새 정보 반영 중...", 70);

        const masterEventLabels = getEventLabels();
        const holidayLabelObj = masterEventLabels.find(l => l.isSkip) || masterEventLabels.find(l => l.name === '휴일') || masterEventLabels[0];
        const holidayLabelId = holidayLabelObj ? holidayLabelObj.id : 'lbl_holiday';
        const holidayLabelName = holidayLabelObj ? holidayLabelObj.name : '휴일';

        const colRef = scope === 'personal' ? getUserCol('events') : getGroupCol(scope, 'events');
        
        // 날짜별 문서 순회하며 기존 source === 'holiday'만 제거 후 새 공휴일 삽입
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
                // 기존 공휴일 데이터 제거
                let filteredList = evList.filter(e => e.source !== 'holiday');

                // 해당 날짜에 새 공휴일이 존재하면 추가
                if (holidaysMap[dStr]) {
                    filteredList.push({
                        id: 'ev_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5),
                        labelIds: [holidayLabelId],
                        label: holidayLabelName,
                        labels: [holidayLabelName],
                        content: holidaysMap[dStr],
                        completed: false,
                        source: 'holiday'
                    });
                }

                if (filteredList.length !== evList.length || holidaysMap[dStr]) {
                    batch.set(docRef, { eventList: filteredList, updatedAt: Date.now() }, { merge: true });
                    count++;
                    if (count >= 400) { await batch.commit(); batch = writeBatch(db); count = 0; }
                }
            } else if (holidaysMap[dStr]) {
                // 문서가 아예 없고 공휴일만 있는 경우 생성
                const newList = [{
                    id: 'ev_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5),
                    labelIds: [holidayLabelId],
                    label: holidayLabelName,
                    labels: [holidayLabelName],
                    content: holidaysMap[dStr],
                    completed: false,
                    source: 'holiday'
                }];
                batch.set(docRef, { eventList: newList, updatedAt: Date.now() }, { merge: true });
                count++;
                if (count >= 400) { await batch.commit(); batch = writeBatch(db); count = 0; }
            }

            curr.setDate(curr.getDate() + 1);
        }

        if (count > 0) await batch.commit();

        ProgressModal.complete(`✅ 공휴일 동기화 완료!\n[출처: ${sourceUsed}]에서 성공적으로 불러왔습니다.`, () => {
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
