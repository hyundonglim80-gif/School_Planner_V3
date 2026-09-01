// js/modules/backupLocal.js

import { store } from '../core/store.js';
import { ProgressModal } from '../ui/progressModal.js';
import { CSVHelper } from '../utils/csvHelper.js';
import { BackupData } from './backupData.js';

export const BackupLocal = {
    handleDownload: async function(options, scopeName) {
        try {
            ProgressModal.show("로컬 파일(CSV) 통합 내보내기");
            ProgressModal.update(`[${scopeName}] 데이터 집계 및 통합 파일 생성 중...`, 30);

            const doSchedule = options.incEvent || options.incClass || options.incJournal || options.incEval;
            let combinedRows = [];

            if (doSchedule) {
                ProgressModal.update("일정 및 수업 기록 변환 중...", 50);
                const data = await BackupData.getScheduleDataArray(options);
                
                combinedRows.push(["#SECTION", "SCHEDULE"]);
                combinedRows = combinedRows.concat(data.scheduleRows);

                if (options.incEval) {
                    ProgressModal.update("조사표 데이터 병합 중...", 70);
                    for (const [sName, rows] of Object.entries(data.evalSheetsData)) {
                        combinedRows.push(["#SECTION", "EVAL", sName]);
                        combinedRows = combinedRows.concat(rows);
                    }
                }
            }

            if (options.incMemo) {
                ProgressModal.update("메모 데이터 병합 중...", 80);
                const memoData = await BackupData.getMemoDataArray(options);
                
                combinedRows.push(["#SECTION", "MEMO"]);
                combinedRows = combinedRows.concat(memoData);
            }

            if (combinedRows.length === 0) {
                throw new Error("내보낼 데이터가 없습니다.");
            }

            const csvContent = "\uFEFF" + combinedRows.map(row => row.map(v => CSVHelper.escape(v)).join(',')).join('\n');
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = `업무계획표_통합백업_${scopeName}.csv`;
            link.click();

            ProgressModal.complete("✅ 통합 CSV 파일 다운로드가 완료되었습니다!", () => {
                if(window.BackupManager && window.BackupManager.modal) window.BackupManager.modal.close();
                store.hasUnsavedChanges = false; 
            });

        } catch (e) { 
            ProgressModal.error("다운로드 중 오류가 발생했습니다.\n" + e.message);
        } 
    },

    handleUpload: async function(file, options, scopeName) {
        if (!file) return;

        const modeName = options.mode === 'overwrite' ? '완전 초기화 및 덮어쓰기(교체)' : '기존 데이터에 병합';

        if(!confirm(`[공간: ${scopeName}]\n[방식: ${modeName}]\n\n선택하신 파일(${file.name})로 복원을 진행하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return;

        try {
            ProgressModal.show(`로컬 통합 파일(CSV) 가져오기 [${scopeName}]`);
            ProgressModal.update("파일 읽기 및 데이터 분류 중...", 10);

            const text = await file.text();
            const rows = CSVHelper.parse(text);
            
            let schedRows = [];
            let memoRows = [];
            let evalSheetsData = {};

            if (rows.length > 0) {
                let firstCell = String(rows[0][0] || '').replace(/^\uFEFF/, '').trim();
                
                if (firstCell === "#SECTION") {
                    let currentSection = null;
                    let currentSheetName = null;

                    for(let i=0; i<rows.length; i++) {
                        const row = rows[i];
                        if (!row || row.length === 0) continue;
                        
                        let cell0 = String(row[0] || '').replace(/^\uFEFF/, '').trim();
                        if(cell0 === "#SECTION") {
                            currentSection = row[1] ? row[1].trim() : null;
                            currentSheetName = row[2] ? row[2].trim() : null;
                            if(currentSection === "EVAL" && currentSheetName) {
                                evalSheetsData[currentSheetName] = [];
                            }
                            continue;
                        }
                        
                        if (row.every(cell => !cell || String(cell).trim() === '')) continue;

                        if(currentSection === "SCHEDULE") schedRows.push(row);
                        else if(currentSection === "MEMO") memoRows.push(row);
                        else if(currentSection === "EVAL" && currentSheetName) evalSheetsData[currentSheetName].push(row);
                    }
                } else {
                    const headerStr = rows[0] ? rows[0].join(',') : '';
                    if (headerStr.includes('조사표 ID (수정금지)')) {
                        throw new Error("개별 조사표 CSV 파일입니다. 새로운 '통합 CSV 백업 파일'을 이용해주세요.");
                    } else if (headerStr.includes('데이터분류') && headerStr.includes('생성일자')) {
                        memoRows = rows;
                    } else if (headerStr.includes('날짜')) {
                        schedRows = rows;
                    } else {
                        throw new Error("알 수 없는 CSV 파일 형식입니다.");
                    }
                }
            }

            if (schedRows.length > 1) {
                const dateIdx = schedRows[0].findIndex(h => typeof h === 'string' && h.includes("날짜"));
                if (dateIdx !== -1) {
                    let minDate = "9999-99-99";
                    let maxDate = "0000-00-00";
                    for (let i = 1; i < schedRows.length; i++) {
                        const dStr = schedRows[i][dateIdx];
                        if (dStr && dStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
                            if (dStr < minDate) minDate = dStr;
                            if (dStr > maxDate) maxDate = dStr;
                        }
                    }
                    if (minDate <= maxDate) {
                        options.startStr = minDate;
                        options.endStr = maxDate;
                    }
                }
            }

            let matrixUpdates = [];
            if (Object.keys(evalSheetsData).length > 0) {
                for (const sName of Object.keys(evalSheetsData)) {
                    const mRows = evalSheetsData[sName];
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
            }

            if (schedRows.length > 0) await BackupData.processScheduleRows(schedRows, options, matrixUpdates);
            if (memoRows.length > 0) await BackupData.processMemoRows(memoRows, options);
            
            store.hasUnsavedChanges = false;

            ProgressModal.complete(`✅ [${scopeName}] 공간에 성공적으로 복원되었습니다!`, () => {
                if(window.BackupManager && window.BackupManager.modal) window.BackupManager.modal.close();
                store.hasUnsavedChanges = false; 
                if(window.render) window.render(true);
            });

        } catch (e) { 
            if (e.message !== "열람용 파일 업로드 시도") {
                console.error(e);
                ProgressModal.error("업로드 처리 중 오류가 발생했습니다.\n" + e.message);
            }
        }
    }
};