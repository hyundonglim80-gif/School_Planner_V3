// js/modules/backupGoogle.js

import { store } from '../core/store.js';
import { ProgressModal } from '../ui/progressModal.js';
import { BackupData } from './backupData.js';
import { getUserCol } from '../api/database.js';
import { getValidGoogleToken } from '../api/auth.js';
import { doc, getDoc, setDoc } from "firebase/firestore";

// 🌟 추가: 새로 만든 분할 캘린더/Tasks 엔진 가져오기
import { exportCalendarData } from './syncCalendar.js';
import { exportTasksToGoogle } from './syncTasks.js';

/**
 * 스프레드시트에서 '조사표_'로 시작하는 탭을 모두 '명렬표_'로 바꾼다.
 *
 * 탭 이름만 고칠 뿐 칸 안의 값은 건드리지 않는다. 새 이름이 이미 있는 탭은
 * 이름이 겹치므로 그냥 둔다. 내보내기 직전에 한 번 불러, 옛 이름 탭과 새 이름
 * 탭이 같은 학급으로 둘 다 남는 일을 막는다.
 */
async function renameLegacyRosterSheets(token, spreadsheetId) {
    try {
        const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties(sheetId,title)`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!metaRes.ok) return 0;

        const meta = await metaRes.json();
        const sheets = meta.sheets || [];
        const titles = new Set(sheets.map(s => s.properties && s.properties.title).filter(Boolean));

        const requests = [];
        for (const s of sheets) {
            const title = (s.properties && s.properties.title) || '';
            if (!title.startsWith('조사표_')) continue;
            const newTitle = '명렬표_' + title.slice('조사표_'.length);
            if (titles.has(newTitle)) continue;
            titles.add(newTitle);
            requests.push({ updateSheetProperties: { properties: { sheetId: s.properties.sheetId, title: newTitle }, fields: 'title' } });
        }
        if (requests.length === 0) return 0;

        const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ requests })
        });
        return res.ok ? requests.length : 0;
    } catch (e) {
        console.warn('옛 명렬표 탭 이름 바꾸기 실패:', e);
        return 0;
    }
}

export const BackupGoogle = {
    currentSpreadsheetId: null,

    checkExistingSheet: async function() {
        try {
            const docSnap = await getDoc(doc(getUserCol('settings'), 'backup_config'));
            if (docSnap.exists() && docSnap.data().spreadsheetId) {
                this.currentSpreadsheetId = docSnap.data().spreadsheetId;
                const linkBox = document.getElementById('backup-sheet-direct-link');
                const target = document.querySelector('input[name="backup-target"]:checked');
                if (linkBox && target && target.value === 'sheets') {
                    linkBox.style.display = 'block';
                }
            } else {
                this.currentSpreadsheetId = null;
            }
        } catch(e) {}
    },

    getOrCreateSpreadsheet: async function(token) {
        const configRef = doc(getUserCol('settings'), 'backup_config');
        const docSnap = await getDoc(configRef);
        let spreadsheetId = docSnap.exists() ? docSnap.data().spreadsheetId : null;

        if (spreadsheetId) {
            try {
                const checkRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=spreadsheetId`, {
                    method: 'GET', headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!checkRes.ok) spreadsheetId = null; 
            } catch (error) { spreadsheetId = null; }
        }

        if (!spreadsheetId) {
            const res = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    properties: { title: '업무 및 수업 계획표 클라우드 백업' },
                    sheets: [ { properties: { title: '일정기록' } }, { properties: { title: '메모' } } ]
                })
            });
            
            if (!res.ok) {
                let errorMsg = "알 수 없는 오류가 발생했습니다.";
                try {
                    const errData = await res.json();
                    if (errData.error && errData.error.status === 'PERMISSION_DENIED') {
                        errorMsg = "구글 스프레드시트 접근 권한이 없습니다.\n\n[해결방법] 창을 닫고 로그아웃 후 다시 로그인할 때, 구글 팝업창에서 모든 권한 체크박스를 반드시 체크해주세요.";
                    } else if (errData.error && errData.error.message) {
                        errorMsg = `구글 클라우드 오류: ${errData.error.message}`;
                    }
                } catch(e) {}
                throw new Error(errorMsg);
            }
            
            const data = await res.json();
            spreadsheetId = data.spreadsheetId;
            await setDoc(configRef, { spreadsheetId });
        }
        return spreadsheetId;
    },

    exportToSheets: async function(options) {
        try {
            ProgressModal.show("구글 시트 내보내기");
            ProgressModal.update("구글 계정 연결 확인 중...", 10);

            const token = await getValidGoogleToken();
            if(!token) throw new Error("토큰 발급이 취소되었습니다.");
            
            ProgressModal.update("시트 파일 및 환경 준비 중...", 20);

            const spreadsheetId = await this.getOrCreateSpreadsheet(token);
            const doSchedule = options.incEvent || options.incClass || options.incJournal || options.incEval;

            if (doSchedule) {
                ProgressModal.update("일정 및 수업 기록 업로드 중...", 50);
                const finalData = await BackupData.getScheduleDataArray(options);
                
                if (options.mode === 'overwrite') {
                    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent('일정기록!A:Z')}:clear`, {
                        method: 'POST', headers: { 'Authorization': `Bearer ${token}` }
                    });
                }
                
                await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent('일정기록!A1')}?valueInputOption=USER_ENTERED`, {
                    method: 'PUT',
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ values: finalData.scheduleRows })
                });

                if (options.incEval) {
                    ProgressModal.update("조사표 및 명렬표 연동 데이터 업로드 중...", 70);
                    // 옛 이름('조사표_') 탭이 남아 있으면 먼저 새 이름으로 바꾼다.
                    // 그러지 않으면 같은 학급의 탭이 두 이름으로 갈라진다.
                    await renameLegacyRosterSheets(token, spreadsheetId);
                    for (const [sName, rows] of Object.entries(finalData.evalSheetsData)) {
                        try {
                            await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
                                method: 'POST',
                                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                                body: JSON.stringify({ requests: [{ addSheet: { properties: { title: sName } } }] })
                            });
                        } catch(e) {}

                        if (options.mode === 'overwrite') {
                            await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sName + '!A:Z')}:clear`, {
                                method: 'POST', headers: { 'Authorization': `Bearer ${token}` }
                            });
                        }
                        
                        await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sName + '!A1')}?valueInputOption=USER_ENTERED`, {
                            method: 'PUT',
                            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                            body: JSON.stringify({ values: rows })
                        });
                    }
                }
            }

            if (options.incMemo) {
                ProgressModal.update("메모 및 링크 업로드 중...", 85);
                const memoData = await BackupData.getMemoDataArray(options);
                
                if (options.mode === 'overwrite') {
                    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent('메모!A:Z')}:clear`, {
                        method: 'POST', headers: { 'Authorization': `Bearer ${token}` }
                    });
                }

                await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent('메모!A1')}?valueInputOption=USER_ENTERED`, {
                    method: 'PUT',
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ values: memoData })
                });
            }

            this.checkExistingSheet(); 
            
            const sheetLinkHtml = `<button onclick="window.open('https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit', '_blank')" style="width:100%; padding:10px; background:#c7d2fe; color:#312e81; border:none; border-radius:6px; cursor:pointer; font-weight:bold; transition:0.2s;">🔗 내 구글 시트 파일 바로 열기</button>`;
            
            ProgressModal.complete("✅ 구글 시트 내보내기가 성공적으로 완료되었습니다!", () => {
                if(window.BackupManager && window.BackupManager.modal) window.BackupManager.modal.close();
                store.hasUnsavedChanges = false; 
                if(window.render) window.render();
            }, sheetLinkHtml);

        } catch (e) {
            console.error(e);
            if(e.message !== "토큰 발급이 취소되었습니다.") {
                ProgressModal.error("❌ 백업 실패:\n" + e.message);
            } else {
                ProgressModal.close();
            }
        }
    },

    importFromSheets: async function(options) {
        const modeName = options.mode === 'overwrite' ? '완전 초기화 및 덮어쓰기(교체)' : '기존 데이터 유지하며 추가(병합)';
        const doSchedule = options.incEvent || options.incClass || options.incJournal || options.incEval;

        if(!confirm(`[${modeName}]\n구글 시트의 데이터로 현재 앱 화면을 복원하시겠습니까?`)) return;

        try {
            ProgressModal.show("구글 시트 가져오기");
            ProgressModal.update("구글 계정 연결 확인 중...", 10);

            const token = await getValidGoogleToken();
            if(!token) throw new Error("토큰 발급이 취소되었습니다.");
            
            ProgressModal.update("시트 파일 읽는 중...", 20);

            const docSnap = await getDoc(doc(getUserCol('settings'), 'backup_config'));
            const spreadsheetId = docSnap.exists() ? docSnap.data().spreadsheetId : null;
            if(!spreadsheetId) throw new Error("백업된 시트를 찾을 수 없습니다. 먼저 '내보내기'를 진행해주세요.");

            if (doSchedule) {
                const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent('일정기록!A:Z')}`, {
                    method: 'GET', headers: { 'Authorization': `Bearer ${token}` }
                });
                if(!res.ok) throw new Error("일정기록 시트 읽기에 실패했습니다.");
                const data = await res.json();
                const rows = data.values || [];

                let matrixUpdates = [];
                const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, { headers: { 'Authorization': `Bearer ${token}` } });
                const metaData = await metaRes.json();
                // 이름을 바꾸기 전에 만들어진 시트가 있을 수 있어 두 이름을 다 본다
                const evalSheetNames = metaData.sheets.map(s => s.properties.title).filter(t => t.startsWith('명렬표_') || t.startsWith('조사표_'));

                for (const sName of evalSheetNames) {
                    const sRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sName + '!A:Z')}`, { headers: { 'Authorization': `Bearer ${token}` } });
                    const sData = await sRes.json();
                    const mRows = sData.values || [];
                    
                    if (mRows.length < 8) continue;
                    const idRow = mRows.find(r => r[0] === "조사표 ID (수정금지)");
                    const headerRow = mRows.find(r => r[0] === "번호" && r[1] === "이름");
                    if (!idRow || !headerRow) continue;

                    let colMapping = {};
                    let currentEvalId = null;
                    for (let c = 3; c < headerRow.length; c++) {
                        if (idRow[c] && idRow[c].trim() !== '') currentEvalId = idRow[c].trim();
                        if (currentEvalId) colMapping[c] = { evalId: currentEvalId, colName: headerRow[c] };
                    }

                    const dataRows = mRows.slice(mRows.indexOf(headerRow) + 1);
                    dataRows.forEach(r => {
                        const studentNum = parseInt(r[0], 10);
                        if (isNaN(studentNum)) return;
                        for (let c = 3; c < r.length; c++) {
                            if (!colMapping[c]) continue;
                            matrixUpdates.push({
                                evalId: colMapping[c].evalId,
                                studentNum: studentNum,
                                colName: colMapping[c].colName,
                                val: (r[c] || '').trim()
                            });
                        }
                    });
                }
                await BackupData.processScheduleRows(rows, options, matrixUpdates);
            }

            if (options.incMemo) {
                ProgressModal.update("메모 데이터 읽는 중...", 80);
                const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent('메모!A:Z')}`, {
                    method: 'GET', headers: { 'Authorization': `Bearer ${token}` }
                });
                if(res.ok) {
                    const data = await res.json();
                    const rows = data.values || [];
                    await BackupData.processMemoRows(rows, options);
                }
            }

            store.hasUnsavedChanges = false; 

            const sheetLinkHtml = `<button onclick="window.open('https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit', '_blank')" style="width:100%; padding:10px; background:#c7d2fe; color:#312e81; border:none; border-radius:6px; cursor:pointer; font-weight:bold; transition:0.2s;">🔗 연동된 구글 시트 파일 열기</button>`;
            
            ProgressModal.complete("✅ 구글 시트에서 성공적으로 복원 및 동기화가 완료되었습니다!", () => {
                if(window.BackupManager && window.BackupManager.modal) window.BackupManager.modal.close();
                store.hasUnsavedChanges = false; 
                if(window.render) window.render();
            }, sheetLinkHtml);

        } catch (e) {
            console.error(e);
            if(e.message !== "토큰 발급이 취소되었습니다.") {
                ProgressModal.error("복원 중 오류 발생:\n" + e.message);
            } else {
                ProgressModal.close();
            }
        } 
    },

    // 🌟 추가: 누락되었던 캘린더 단방향 내보내기 연결 메서드
    exportToCalendar: async function(options) {
        try {
            ProgressModal.show("구글 캘린더 단방향 동기화");
            ProgressModal.update("구글 계정 연결 확인 중...", 10);

            const token = await getValidGoogleToken();
            if(!token) throw new Error("토큰 발급이 취소되었습니다.");

            if (options.incMemo) {
                ProgressModal.update("📝 구글 Tasks 확인 및 메모 동기화 중...", 10);
                await exportTasksToGoogle(token, options.mode);
            }

            const syncOptions = {
                syncEvent: options.incEvent,
                syncClass: options.incClass,
                syncJournal: options.incJournal,
                syncEval: options.incEval
            };

            if (syncOptions.syncEvent || syncOptions.syncClass || syncOptions.syncJournal || syncOptions.syncEval) {
                await exportCalendarData(token, options.startStr, options.endStr, options.mode, syncOptions);
            }

            ProgressModal.complete("✅ 3분할 캘린더 내보내기가 성공적으로 완료되었습니다!", () => {
                if(window.BackupManager && window.BackupManager.modal) window.BackupManager.modal.close();
                store.hasUnsavedChanges = false; 
                if(window.render) window.render();
            });

        } catch (e) {
            console.error(e);
            if(e.message !== "토큰 발급이 취소되었습니다.") {
                ProgressModal.error("❌ 백업 실패:\n" + e.message);
            } else {
                ProgressModal.close();
            }
            throw e; // backup.js의 try-catch로 넘기기
        }
    }
};