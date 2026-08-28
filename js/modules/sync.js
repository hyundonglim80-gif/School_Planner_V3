// js/modules/sync.js
import { store } from '../core/store.js';
import { getValidGoogleToken } from '../api/auth.js';
import { ProgressModal } from '../ui/progressModal.js';
import { exportTasksToGoogle, importTasksFromGoogle } from './syncTasks.js';
import { exportCalendarData, importCalendarData } from './syncCalendar.js';
import { fetchHolidaysFromGovApi } from '../api/govApi.js';
import { formatDate } from '../core/utils.js'; // 날짜 계산을 위해 추가

// 기존 더보기 메뉴의 통합 내보내기 로직
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

// 새로 추가된 기능: 헤더의 📅버튼 클릭 시 현재 화면(Scope) 기반 스마트 동기화
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

    // 현재 화면별 날짜 기간과 동기화 대상 설정
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
        const startY = d.getMonth() < 2 ? y - 1 : y; // 학년도는 3월부터 이듬해 2월
        startStr = formatDate(new Date(startY, 2, 1)); 
        endStr = formatDate(new Date(startY + 1, 2, 0)); // 2월 마지막 날
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
            // 조사표(Eval)는 UI 명세에 따라 빠른 동기화에서 제외
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

export const executeGoogleImport = async function() {
    alert("현재 시스템은 데이터 안정성을 위해 '단방향 동기화(SP3 ➡️ 구글)' 모드로 작동합니다.\n구글 캘린더에서 SP3로 가져오기는 더 이상 지원되지 않습니다.");
};

window.executeGoogleExport = executeGoogleExport;
window.executeGoogleImport = executeGoogleImport;
window.quickGoogleSync = quickGoogleSync; // 새로 만든 함수 전역 바인딩
window.fetchHolidaysFromGovApi = fetchHolidaysFromGovApi;