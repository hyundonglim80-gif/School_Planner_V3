// js/modules/sync.js
import { store } from '../core/store.js';
import { getValidGoogleToken } from '../api/auth.js';
import { ProgressModal } from '../ui/progressModal.js';
import { exportTasksToGoogle, importTasksFromGoogle } from './syncTasks.js';
import { exportCalendarData, importCalendarData } from './syncCalendar.js';
import { fetchHolidaysFromGovApi } from '../api/govApi.js';

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

    ProgressModal.show("구글 캘린더 동기화");
    ProgressModal.update(`구글 캘린더로 내보내는 중... (${mode === 'merge' ? '병합' : '교체'})`, 0);

    try {
        if (syncTasks) {
            ProgressModal.update("📝 구글 Tasks 확인 및 메모 동기화 중...", 10);
            await exportTasksToGoogle(token, mode);
        }

        if (syncEvent || syncClass || syncJournal || syncEval) {
            await exportCalendarData(token, startStr, endStr, mode, { syncEvent, syncClass, syncJournal, syncEval });
        }

        ProgressModal.complete("✅ 구글 캘린더 내보내기가 완벽하게 완료되었습니다!", () => {
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

export const executeGoogleImport = async function() {
    const token = await getValidGoogleToken();
    if (!token) return;

    const startStr = document.getElementById('backup-start-date').value;
    const endStr = document.getElementById('backup-end-date').value;
    const mode = document.querySelector('input[name="import-mode"]:checked').value;
    const internalMode = mode === 'merge' ? 'replace' : 'overwrite';
    
    const syncEvent = document.getElementById('backup-chk-event').checked;
    const syncClass = document.getElementById('backup-chk-class').checked;
    const syncJournal = document.getElementById('backup-chk-journal').checked;
    const syncEval = document.getElementById('backup-chk-eval').checked;
    const syncTasks = document.getElementById('backup-chk-memo').checked;

    if (new Date(startStr) > new Date(endStr)) { alert("시작일이 종료일보다 늦을 수 없습니다."); return; }

    ProgressModal.show("구글 캘린더 동기화");
    ProgressModal.update("구글 캘린더 데이터 가져오기 시작...", 0);

    try {
        if (syncTasks) {
            ProgressModal.update("📝 구글 Tasks 메모 복원 중...", 10);
            await importTasksFromGoogle(token, internalMode);
        }

        if (syncEvent || syncClass || syncJournal || syncEval) {
            await importCalendarData(token, startStr, endStr, internalMode, { syncEvent, syncClass, syncJournal, syncEval });
        }

        ProgressModal.complete("✅ 구글 캘린더 동기화가 완벽하게 완료되었습니다!", () => {
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

window.executeGoogleExport = executeGoogleExport;
window.executeGoogleImport = executeGoogleImport;
window.fetchHolidaysFromGovApi = fetchHolidaysFromGovApi;