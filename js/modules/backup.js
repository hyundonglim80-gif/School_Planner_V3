import { store } from '../core/store.js';
import { formatDate, getEventLabels, getJournalLabels, getSemesterDates } from '../core/utils.js';
import { getUserCol, db } from '../firebase.js';
import { doc, getDoc, getDocs, setDoc, deleteDoc, query, where, documentId, orderBy, writeBatch } from "firebase/firestore"; 

export const BackupManager = {
    modal: null,
    currentTab: 'schedule',
    currentSpreadsheetId: null,

    openModal: function() {
        if (!this.modal) {
            const html = `
            <div class="modal-info-box" style="background:#eff6ff; border-left-color:#3b82f6;">
                <p style="margin:0;"><strong>[데이터 백업/복원]</strong> 클라우드 데이터를 파일(CSV)이나 구글 시트로 백업/복원합니다.</p>
            </div>
            <div style="display:flex; gap:10px; margin-bottom:15px;">
                <button id="backup-tab-schedule" onclick="window.BackupManager.setTab('schedule')" style="flex:1; padding:10px; border:2px solid #3b82f6; background:#eff6ff; color:#1e40af; border-radius:8px; font-weight:bold; cursor:pointer;">📅 캘린더 데이터</button>
                <button id="backup-tab-memo" onclick="window.BackupManager.setTab('memo')" style="flex:1; padding:10px; border:2px solid #cbd5e1; background:#f8fafc; color:#64748b; border-radius:8px; font-weight:bold; cursor:pointer;">📝 메모</button>
            </div>

            <div id="backup-schedule-section">
                <label style="display:block; font-weight:bold; margin-bottom:5px; color:#475569;">백업/복원 기간 선택</label>
                <div style="display:flex; flex-direction:column; gap:10px; margin-bottom:15px; background:#f8fafc; padding:15px; border-radius:8px; border:1px solid #e2e8f0;">
                    <select id="backup-period-select" onchange="window.BackupManager.onPeriodChange()" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:6px; font-size:1rem; outline:none; cursor:pointer; font-weight:bold;">
                        <option value="today">오늘</option>
                        <option value="week">해당 주 (이번 주)</option>
                        <option value="month">해당 월 (이번 달)</option>
                        <option value="sem1">1학기 전체</option>
                        <option value="sem2">2학기 전체</option>
                        <option value="year" selected>해당 학년도 전체</option>
                        <option value="custom">기간 직접 설정</option>
                    </select>
                    
                    <div style="display:flex; gap:10px; align-items:center; justify-content:center; margin-top:5px;">
                        <input type="date" id="backup-start-date" style="flex:1; padding:8px; border:1px solid #cbd5e1; border-radius:6px; outline:none;" disabled>
                        <span style="font-weight:bold; color:#64748b;">~</span>
                        <input type="date" id="backup-end-date" style="flex:1; padding:8px; border:1px solid #cbd5e1; border-radius:6px; outline:none;" disabled>
                    </div>
                </div>

                <label style="display:block; font-weight:bold; margin-bottom:5px; color:#475569;">대상 항목 선택</label>
                <div style="display:flex; gap:15px; margin-bottom:15px; background:#f8fafc; padding:10px 15px; border-radius:8px; border:1px solid #e2e8f0; font-weight:bold; color:#1e293b;">
                    <label style="cursor:pointer;"><input type="checkbox" id="backup-chk-event" checked style="accent-color:#3b82f6;"> 일정</label>
                    <label style="cursor:pointer;"><input type="checkbox" id="backup-chk-class" checked style="accent-color:#10b981;"> 수업</label>
                    <label style="cursor:pointer;"><input type="checkbox" id="backup-chk-journal" checked style="accent-color:#ec4899;"> 기록</label>
                    <label style="cursor:pointer;"><input type="checkbox" id="backup-chk-eval" checked style="accent-color:#f59e0b;"> 조사표</label>
                </div>
            </div>

            <div id="backup-memo-section" style="display:none; margin-bottom:15px; padding:15px; background:#f1f5f9; border-radius:8px; border: 1px dashed #cbd5e1;">
                <p style="margin:0; color:#475569; font-size:0.95rem; line-height:1.5;">
                    저장된 <strong>모든 메모 데이터</strong>와 <strong>자주 쓰는 문서/링크</strong> 목록을 처리합니다.<br>
                </p>
            </div>

            <div style="background:#fef2f2; padding:15px; border-radius:8px; border:1px solid #fca5a5; margin-bottom:15px;">
                <p style="margin:0 0 10px 0; font-weight:bold; color:#b91c1c; font-size:1.05rem;">📥 가져오기 방식 선택</p>
                <label style="display:flex; align-items:flex-start; gap:8px; margin-bottom:12px; cursor:pointer;">
                    <input type="radio" name="import-mode" value="merge" checked style="margin-top:3px; accent-color:#059669;">
                    <div>
                        <span style="font-weight:bold; color:#059669; font-size:0.95rem;">기존 데이터 유지하며 추가 (병합 및 시트 최신화)</span><br>
                        <span style="font-size:0.8rem; color:#64748b;">현재 데이터를 보존하고, 구글 시트의 데이터와 비교하여 수정한 내용을 앱에 최신화하여 합칩니다.</span>
                    </div>
                </label>
                <label style="display:flex; align-items:flex-start; gap:8px; cursor:pointer;">
                    <input type="radio" name="import-mode" value="overwrite" style="margin-top:3px; accent-color:#ef4444;">
                    <div>
                        <span style="font-weight:bold; color:#ef4444; font-size:0.95rem;">모두 지우고 덮어쓰기 (교체)</span><br>
                        <span style="font-size:0.8rem; color:#64748b;">현재 데이터를 싹 지우고, 가져오는 데이터로 완전히 교체합니다.</span>
                    </div>
                </label>
                
                <div style="margin-top:12px; padding:10px; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:6px;">
                    <p style="margin:0; font-size:0.85rem; color:#166534; font-weight:bold; line-height:1.4;">
                        ✅ 구글 시트의 [조사표_학년-반] 탭에서 점수를 직접 수정한 후 가져오기를 누르시면, 시트에서 수정한 점수가 앱에도 완벽하게 최신화(동기화) 됩니다!
                    </p>
                </div>
            </div>

            <div style="background:#eef2ff; padding:15px; border-radius:8px; border:1px solid #c7d2fe; margin-top:10px;">
                <p style="margin:0 0 10px 0; font-weight:bold; color:#3730a3; font-size:1.05rem;">☁️ 구글 스프레드시트</p>
                <div style="display:flex; justify-content:space-between; gap:10px;">
                    <button id="btn-sheets-import" onclick="window.BackupManager.importFromSheets()" class="modal-btn-secondary" style="flex:1; background:#fff; border: 2px solid #0f9d58; color:#0f9d58; font-size:1rem;">📗 가져오기 (시트 동기화)</button>
                    <button id="btn-sheets-export" onclick="window.BackupManager.exportToSheets()" class="modal-btn-primary" style="flex:1; background:#0f9d58; font-size:1rem;">📗 내보내기</button>
                </div>
                <div id="sheet-link-area"></div>
            </div>

            <div style="background:#f8fafc; padding:15px; border-radius:8px; border:1px solid #e2e8f0; margin-top:10px;">
                <p style="margin:0 0 10px 0; font-weight:bold; color:#475569; font-size:1.05rem;">💾 로컬 파일(CSV)</p>
                <div style="display:flex; justify-content:space-between; gap:10px;">
                    <input type="file" id="backup-upload-file" accept=".csv" style="display:none;" onchange="window.BackupManager.handleUpload(this)">
                    <button onclick="document.getElementById('backup-upload-file').click()" class="modal-btn-secondary" style="flex:1; background:#fff; border-color:#64748b; color:#475569; font-size:1rem;">📤 가져오기</button>
                    <button id="btn-backup-download" onclick="window.BackupManager.handleDownload()" class="modal-btn-primary" style="flex:1; background:#475569; font-size:1rem;">📥 내보내기</button>
                </div>
            </div>
            `;
            this.modal = new window.Modal({ id: 'backup-modal-v5', title: '백업 및 데이터 동기화', width: '550px', content: html });
        }
        this.modal.open();
        this.setTab('schedule');
        this.setDefaultDates();
        this.checkExistingSheet(); 
    },

    setTab: function(tab) {
        this.currentTab = tab;
        const schBtn = document.getElementById('backup-tab-schedule');
        const memoBtn = document.getElementById('backup-tab-memo');
        const schSec = document.getElementById('backup-schedule-section');
        const memoSec = document.getElementById('backup-memo-section');

        if (tab === 'schedule') {
            schBtn.style.background = '#eff6ff'; schBtn.style.borderColor = '#3b82f6'; schBtn.style.color = '#1e40af';
            memoBtn.style.background = '#f8fafc'; memoBtn.style.borderColor = '#cbd5e1'; memoBtn.style.color = '#64748b';
            schSec.style.display = 'block'; memoSec.style.display = 'none';
        } else {
            memoBtn.style.background = '#eff6ff'; memoBtn.style.borderColor = '#3b82f6'; memoBtn.style.color = '#1e40af';
            schBtn.style.background = '#f8fafc'; schBtn.style.borderColor = '#cbd5e1'; schBtn.style.color = '#64748b';
            schSec.style.display = 'none'; memoSec.style.display = 'block';
        }
    },

    setDefaultDates: function() {
        const select = document.getElementById('backup-period-select');
        if (select) {
            select.value = 'year';
            this.onPeriodChange(); 
        }
    },

    onPeriodChange: function() {
        const val = document.getElementById('backup-period-select').value;
        const startInput = document.getElementById('backup-start-date');
        const endInput = document.getElementById('backup-end-date');

        const d = store.currentDate ? new Date(store.currentDate) : new Date();
        const y = d.getFullYear();
        const m = d.getMonth();

        let sDate = new Date(d);
        let eDate = new Date(d);

        if (val === 'custom') {
            startInput.disabled = false;
            endInput.disabled = false;
            startInput.focus();
            return;
        } else {
            startInput.disabled = true;
            endInput.disabled = true;
        }

        if (val === 'today') { } 
        else if (val === 'week') {
            const day = d.getDay();
            sDate.setDate(d.getDate() - day);
            eDate.setDate(sDate.getDate() + 6);
        } else if (val === 'month') {
            sDate = new Date(y, m, 1);
            eDate = new Date(y, m + 1, 0);
        } else if (val === 'sem1' || val === 'sem2' || val === 'year') {
            let datesInfo = getSemesterDates();

            if (val === 'sem1') { sDate = new Date(datesInfo.sem1Start); eDate = new Date(datesInfo.sem1End); } 
            else if (val === 'sem2') { sDate = new Date(datesInfo.sem2Start); eDate = new Date(datesInfo.sem2End); } 
            else if (val === 'year') { sDate = new Date(datesInfo.sem1Start); eDate = new Date(datesInfo.sem2End); }
        }
        startInput.value = formatDate(sDate);
        endInput.value = formatDate(eDate);
    },

    checkExistingSheet: async function() {
        try {
            const docSnap = await getDoc(doc(getUserCol('settings'), 'backup_config'));
            const linkArea = document.getElementById('sheet-link-area');
            if (docSnap.exists() && docSnap.data().spreadsheetId && linkArea) {
                this.currentSpreadsheetId = docSnap.data().spreadsheetId;
                linkArea.innerHTML = `
                    <button onclick="window.open('https://docs.google.com/spreadsheets/d/${this.currentSpreadsheetId}/edit', '_blank')" style="width:100%; padding:10px; margin-top:15px; background:#c7d2fe; color:#312e81; border:none; border-radius:6px; cursor:pointer; font-weight:bold; transition:0.2s;">🔗 내 백업 시트 파일 바로 열기</button>
                    <div style="text-align:right; margin-top:8px;">
                        <span onclick="window.BackupManager.resetSheetConnection()" style="font-size:0.85rem; color:#64748b; cursor:pointer; text-decoration:underline;">파일을 삭제하셨거나 못 찾으시나요? (연결 초기화)</span>
                    </div>
                `;
            } else if (linkArea) {
                linkArea.innerHTML = '';
            }
        } catch(e) {}
    },

    resetSheetConnection: async function() {
        if(confirm("기존 구글 시트와의 연결을 강제로 끊고 완전히 새로운 파일을 생성하시겠습니까?\n\n(구글 드라이브에서 파일을 완전히 삭제했거나 찾을 수 없을 때 누르세요!)")) {
            await deleteDoc(doc(getUserCol('settings'), 'backup_config'));
            this.currentSpreadsheetId = null;
            this.checkExistingSheet();
            alert("초기화 완료!\n이제 [📗 내보내기] 버튼을 누르시면 드라이브에 새로운 파일이 생성됩니다.");
        }
    },

    getScheduleDataArray: async function() {
        let startStr = document.getElementById('backup-start-date').value;
        let endStr = document.getElementById('backup-end-date').value;
        if (!startStr || !endStr) throw new Error("시작일과 종료일을 올바르게 설정해 주세요.");

        const incEvent = document.getElementById('backup-chk-event').checked;
        const incClass = document.getElementById('backup-chk-class').checked;
        const incJournal = document.getElementById('backup-chk-journal').checked;
        const incEval = document.getElementById('backup-chk-eval').checked;

        const eventsSnap = incEvent ? await getDocs(query(getUserCol('events'), where(documentId(), '>=', startStr), where(documentId(), '<=', endStr))) : { forEach: () => {} };
        const schedSnap = incClass ? await getDocs(query(getUserCol('schedules'), where(documentId(), '>=', startStr), where(documentId(), '<=', endStr))) : { forEach: () => {} };
        const jourSnap = incJournal ? await getDocs(query(getUserCol('journals'), where(documentId(), '>=', startStr), where(documentId(), '<=', endStr))) : { forEach: () => {} };
        const evalSnap = incEval ? await getDocs(query(getUserCol('evaluations'), where(documentId(), '>=', startStr), where(documentId(), '<=', endStr))) : { forEach: () => {} };

        const evMap = {}; eventsSnap.forEach(d => evMap[d.id] = d.data());
        const scMap = {}; schedSnap.forEach(d => scMap[d.id] = d.data());
        const joMap = {}; jourSnap.forEach(d => joMap[d.id] = d.data());
        const elMap = {}; evalSnap.forEach(d => elMap[d.id] = d.data());

        const masterEventLabels = getEventLabels();
        const masterJournalLabels = getJournalLabels();
        const pNames = store.periodNames || ["1","2","3","4","5","6"];
        
        const header = ["날짜"];
        if (incEvent) header.push("일정");
        if (incClass) pNames.forEach(p => header.push(p));
        if (incJournal) header.push("기록");
        if (incEval) header.push("조사표");
        const rows = [header]; 

        const evalMapBySheet = {};

        let curr = new Date(startStr);
        const end = new Date(endStr);
        
        while(curr <= end) {
            const dStr = formatDate(curr);
            let row = [dStr];

            if (incEvent) {
                let evText = "";
                if (evMap[dStr]) {
                    const list = evMap[dStr].eventList;
                    if (Array.isArray(list)) {
                        evText = list.map(e => {
                            let labelNames = [];
                            if (e.labelIds && e.labelIds.length > 0) {
                                labelNames = e.labelIds.map(id => {
                                    const match = masterEventLabels.find(l => l.id === id || l.name === id);
                                    return match ? match.name : id;
                                });
                            } else if (e.labels && e.labels.length > 0) labelNames = e.labels;
                            else if (e.label) labelNames = [e.label];
                            
                            let lName = labelNames.length > 0 ? labelNames.join(', ') : '일정';
                            const pre = e.completed ? '[v] ' : '';
                            return `${pre}[${lName}] ${e.content}`;
                        }).join('\n');
                    } else if (evMap[dStr].eventText) {
                        evText = evMap[dStr].eventText;
                    }
                }
                row.push(evText);
            }

            if (incClass) {
                const periods = scMap[dStr] ? (scMap[dStr].periods || {}) : {};
                for(let p=1; p<=pNames.length; p++) {
                    const pData = periods[p] || {};
                    let pText = "";
                    if(pData.subject && pData.subject.trim() !== '') pText += `[${pData.subject.trim()}] `;
                    if(pData.memo && pData.memo.trim() !== '') pText += pData.memo.trim();
                    if(pData.supplies && pData.supplies.trim() !== '') pText += ` [${pData.supplies.trim()}]`;
                    row.push(pText.trim());
                }
            }

            if (incJournal) {
                let joText = "";
                if (joMap[dStr]) {
                    const entries = joMap[dStr].entries;
                    if (Array.isArray(entries)) {
                        joText = entries.map(j => {
                            let labelNames = [];
                            if (j.labelIds && j.labelIds.length > 0) {
                                labelNames = j.labelIds.map(id => {
                                    const match = masterJournalLabels.find(l => l.id === id || l.name === id);
                                    return match ? match.name : id;
                                });
                            } else if (j.labels && j.labels.length > 0) labelNames = j.labels;
                            else if (j.label) labelNames = [j.label];

                            let lName = labelNames.length > 0 ? labelNames.join(', ') : '기록';
                            const pre = j.completed ? '[v] ' : '';
                            return `${pre}[${lName}] ${j.content}`;
                        }).join('\n');
                    }
                }
                row.push(joText);
            }

            if (incEval) {
                let elText = "";
                if (elMap[dStr] && elMap[dStr].evalList) {
                    elText = JSON.stringify(elMap[dStr].evalList);
                    
                    elMap[dStr].evalList.forEach(ev => {
                        let sheetName = '조사표_기타';
                        if (ev.rosterMeta && ev.rosterMeta.year) {
                            sheetName = `조사표_${ev.rosterMeta.year}-${ev.rosterMeta.grade}-${ev.rosterMeta.classNum}`;
                        }
                        if (!evalMapBySheet[sheetName]) evalMapBySheet[sheetName] = [];
                        if (!ev.dateStr) ev.dateStr = dStr;
                        evalMapBySheet[sheetName].push(ev);
                    });
                }
                row.push(elText);
            }

            rows.push(row);
            curr.setDate(curr.getDate() + 1);
        }
        
        const evalSheetsData = {};
        for (const [sheetName, evals] of Object.entries(evalMapBySheet)) {
            const studentMap = new Map();
            evals.forEach(ev => {
                (ev.studentsSnapshot || []).forEach(st => {
                    if (!studentMap.has(st.num)) studentMap.set(st.num, st);
                });
            });
            const students = Array.from(studentMap.values()).sort((a,b) => a.num - b.num);

            const row1 = ["상위 항목(조사표 제목)", "", ""];
            const row2 = ["조사표 ID (수정금지)", "", ""];
            const row3 = ["하위 항목(날짜)", "", ""];
            const row4 = ["하위 항목(교시)", "", ""];
            const row5 = ["하위 항목(유형)", "", ""];
            const row6 = ["하위 항목(교과)", "", ""];
            const row7 = ["하위 항목(방식)", "", ""];
            const row8 = ["번호", "이름", "성별"];

            evals.forEach(ev => {
                const isEval = ev.type === 'eval';
                const isIndiv = isEval ? (ev.methodObj ? ev.methodObj.indiv : (ev.method !== 'group')) : false;
                const isGroup = isEval ? (ev.methodObj ? ev.methodObj.group : (ev.method === 'group')) : false;

                let cols = [];
                if (isEval) {
                    if (isGroup) cols.push("조이름");
                    if (isGroup) cols.push("조별결과"); 
                    if (isIndiv) cols.push("개별결과"); 
                    cols.push("미평가사유(메모)");
                } else if (ev.type === 'check') {
                    cols.push("체크결과", "미평가사유(메모)");
                } else {
                    cols.push("메모내용");
                }

                const span = cols.length;
                row1.push(ev.title || ""); for(let i=1; i<span; i++) row1.push("");
                row2.push(ev.id || ""); for(let i=1; i<span; i++) row2.push("");
                row3.push(ev.dateStr || ""); for(let i=1; i<span; i++) row3.push("");
                row4.push(ev.periodStr ? `${ev.periodStr}교시` : ""); for(let i=1; i<span; i++) row4.push("");
                
                const typeStr = ev.type === 'eval' ? '평가' : (ev.type === 'check' ? '체크' : '메모');
                row5.push(typeStr); for(let i=1; i<span; i++) row5.push("");
                row6.push(ev.subject || ""); for(let i=1; i<span; i++) row6.push("");
                
                let mArr = [];
                if(isIndiv) mArr.push("개인");
                if(isGroup) mArr.push("조별");
                row7.push(mArr.join(', ')); for(let i=1; i<span; i++) row7.push("");
                row8.push(...cols);
            });

            const sheetRows = [row1, row2, row3, row4, row5, row6, row7, row8];
            
            students.forEach(st => {
                const sRow = [st.num, st.name, st.gender || ""];
                evals.forEach(ev => {
                    const rec = ev.records[st.num] || {};
                    const isEval = ev.type === 'eval';
                    const isIndiv = isEval ? (ev.methodObj ? ev.methodObj.indiv : (ev.method !== 'group')) : false;
                    const isGroup = isEval ? (ev.methodObj ? ev.methodObj.group : (ev.method === 'group')) : false;
                    
                    if (isEval) {
                        if (isGroup) sRow.push(rec.groupName || "");
                        if (isGroup) sRow.push(rec.groupScore || ""); 
                        if (isIndiv) sRow.push(rec.indivScore || rec.score || ""); 
                        sRow.push(rec.reason || "");
                    } else if (ev.type === 'check') {
                        let cRes = '';
                        if (rec.checked === true) cRes = 'O';
                        else if (rec.checked === false) cRes = 'X';
                        sRow.push(cRes, rec.reason || "");
                    } else {
                        sRow.push(rec.memo || "");
                    }
                });
                sheetRows.push(sRow);
            });
            evalSheetsData[sheetName] = sheetRows;
        }

        return { scheduleRows: rows, evalSheetsData: evalSheetsData };
    },

    getMemoDataArray: async function() {
        const snap = await getDocs(query(getUserCol('tasks'), orderBy('createdAt')));
        const rows = [["데이터분류", "ID", "내용/이름", "완료여부(O/X)", "라벨", "주소/URL", "생성일자(타임스탬프)"]];
        
        const linkDoc = await getDoc(doc(getUserCol('settings'), 'user_links'));
        if (linkDoc.exists()) {
            const links = linkDoc.data().links || [];
            links.forEach((l, idx) => rows.push(['LINK', `LINK_${idx}`, l.name || '', '', '', l.url || '', '']));
        }

        snap.forEach(docSnap => {
            const d = docSnap.data();
            rows.push([ 'MEMO', docSnap.id, d.text || '', d.completed ? 'O' : 'X', (d.labels || []).join(','), d.imageUrl || '', d.createdAt || Date.now() ]);
        });
        return rows;
    },

    processScheduleRows: async function(rows, mode, matrixUpdates = []) {
        if (rows.length < 2) return;
        
        let startStr = document.getElementById('backup-start-date').value;
        let endStr = document.getElementById('backup-end-date').value;
        if (!startStr || !endStr) {
            alert("기간이 올바르게 설정되지 않았습니다.");
            return;
        }

        const incEvent = document.getElementById('backup-chk-event').checked;
        const incClass = document.getElementById('backup-chk-class').checked;
        const incJournal = document.getElementById('backup-chk-journal').checked;
        const incEval = document.getElementById('backup-chk-eval').checked;

        const header = rows[0];
        const dateIdx = header.findIndex(h => typeof h === 'string' && h.includes("날짜"));
        const eventIdx = incEvent ? header.findIndex(h => typeof h === 'string' && h.includes("일정")) : -1;
        const journalIdx = incJournal ? header.findIndex(h => typeof h === 'string' && h.includes("기록")) : -1;
        const evalIdx = incEval ? header.findIndex(h => typeof h === 'string' && h.includes("조사표")) : -1;

        const doEvent = incEvent && eventIdx !== -1;
        const doJournal = incJournal && journalIdx !== -1;
        const doEval = incEval && evalIdx !== -1;
        const doClass = incClass;

        const periodIndices = [];
        if (doClass) {
            for (let i = 0; i < header.length; i++) {
                if (i !== dateIdx && i !== eventIdx && i !== journalIdx && i !== evalIdx) {
                    periodIndices.push({ index: i, pNum: periodIndices.length + 1 });
                }
            }
        }

        const masterLabels = getEventLabels();
        const masterJournalLabels = getJournalLabels();
        let labelsChanged = false;

        const parseEventText = (rawText, type) => {
            if (!rawText || !rawText.trim()) return [];
            const lines = rawText.split('\n');
            const eventList = [];
            const targetLabels = type === 'journal' ? masterJournalLabels : masterLabels;

            lines.forEach(line => {
                let t = line.trim();
                if(!t) return;
                
                let completed = false;
                if (t.startsWith('[v]') || t.startsWith('[V]')) {
                    completed = true;
                    t = t.substring(3).trim();
                }

                const match = t.match(/^\[(.*?)\]\s*(.*)$/);
                if (match) {
                    let labelStr = match[1].trim();
                    let content = match[2].trim();
                    
                    let labelsArray = labelStr.split(',').map(s => s.trim()).filter(Boolean);
                    if (labelsArray.length === 0) labelsArray = [type === 'journal' ? '기록' : '일정'];

                    let mappedLabelIds = [];
                    
                    labelsArray.forEach(lbl => {
                        let lObj = targetLabels.find(l => l.name === lbl);
                        if (!lObj) {
                            lObj = {
                                id: (type === 'journal' ? 'lbl_jr_' : 'lbl_ev_') + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5),
                                name: lbl,
                                color: 'blue'
                            };
                            if (type === 'event') {
                                lObj.isSkip = false; lObj.isForward = false; lObj.isPeriod = false; lObj.isRecur = false; lObj.isSystem = false;
                            }
                            targetLabels.push(lObj);
                            labelsChanged = true;
                        }
                        mappedLabelIds.push(lObj.id);
                    });

                    eventList.push({ 
                        labelIds: mappedLabelIds, 
                        label: labelsArray[0], 
                        labels: labelsArray, 
                        content: content, 
                        completed: completed 
                    });
                } else {
                    let defaultLabelIds = [];
                    if (type === 'event' && (t.includes('(휴일)') || t.includes('(행사)'))) {
                        const skipLabel = targetLabels.find(l => l.isSkip);
                        if (skipLabel) defaultLabelIds = [skipLabel.id];
                    }
                    eventList.push({ labelIds: defaultLabelIds, content: t, completed: completed });
                }
            });
            return eventList;
        };

        const parsedDaysMap = {}; 
        const scheduleDataMap = {};
        const journalDataMap = {};
        const evalDataMap = {};

        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            const dStr = row[dateIdx];
            if(!dStr || typeof dStr !== 'string' || !dStr.match(/^\d{4}-\d{2}-\d{2}$/)) continue;
            if (dStr < startStr || dStr > endStr) continue;

            if (doEvent) {
                const evText = row[eventIdx] || "";
                parsedDaysMap[dStr] = { eventList: parseEventText(evText, 'event'), eventText: evText };
            } else {
                parsedDaysMap[dStr] = { eventList: [], eventText: "" };
            }

            if (doClass) {
                let isSkipDay = false;
                if (doEvent) {
                    isSkipDay = parsedDaysMap[dStr].eventList.some(ev => ev.labelIds && ev.labelIds.some(id => {
                        const m = masterLabels.find(l => l.id === id);
                        return m && m.isSkip;
                    }));
                }
                
                let periodsData = {};
                periodIndices.forEach(pCol => {
                    let pText = (row[pCol.index] || "").trim();
                    let subj = "", memo = "", supplies = "";
                    if (pText !== "") {
                        const lastBracketMatch = pText.match(/\[([^\]]+)\]\s*$/);
                        const allBrackets = pText.match(/\[.*?\]/g);
                        if (allBrackets && allBrackets.length >= 2) {
                            supplies = lastBracketMatch ? lastBracketMatch[1].trim() : "";
                            pText = pText.replace(/\[([^\]]+)\]\s*$/, '').trim(); 
                        }
                        const firstBracketMatch = pText.match(/^\[(.*?)\]/);
                        if (firstBracketMatch) {
                            subj = firstBracketMatch[1].trim();
                            memo = pText.replace(/^\[(.*?)\]\s*/, '').trim(); 
                        } else {
                            memo = pText; 
                        }
                    }
                    if(isSkipDay) subj = ''; 
                    periodsData[pCol.pNum] = { subject: subj, memo: memo, supplies: supplies };
                });
                scheduleDataMap[dStr] = periodsData;
            }

            if (doJournal) {
                const joText = row[journalIdx] || ""; 
                journalDataMap[dStr] = parseEventText(joText, 'journal');
            }

            if (doEval) {
                let evalStr = row[evalIdx] || "";
                if (typeof evalStr === 'string' && evalStr.trim() !== '') {
                    evalStr = evalStr.trim();
                    if (evalStr.startsWith("'")) evalStr = evalStr.substring(1);
                    if (evalStr.endsWith("'")) evalStr = evalStr.substring(0, evalStr.length - 1);
                    try { 
                        evalDataMap[dStr] = JSON.parse(evalStr); 
                    } catch(e) { 
                        console.warn("조사표 파싱 에러", e); 
                    }
                }
            }
        }

        if (matrixUpdates && matrixUpdates.length > 0) {
            const updatesByEval = {};
            matrixUpdates.forEach(u => {
                if (!updatesByEval[u.evalId]) updatesByEval[u.evalId] = {};
                if (!updatesByEval[u.evalId][u.studentNum]) updatesByEval[u.evalId][u.studentNum] = {};
                updatesByEval[u.evalId][u.studentNum][u.colName] = u.val;
            });

            for (const dStr in evalDataMap) {
                evalDataMap[dStr].forEach(ev => {
                    const updates = updatesByEval[ev.id];
                    if (updates) {
                        for (const sNumStr in updates) {
                            const sNum = parseInt(sNumStr, 10);
                            const u = updates[sNumStr];
                            if (!ev.records[sNum]) ev.records[sNum] = {};
                            
                            if (ev.type === 'eval') {
                                if (u['조이름'] !== undefined) ev.records[sNum].groupName = u['조이름'];
                                if (u['조별결과'] !== undefined) ev.records[sNum].groupScore = u['조별결과'];
                                if (u['개별결과'] !== undefined) {
                                    ev.records[sNum].indivScore = u['개별결과'];
                                    ev.records[sNum].score = u['개별결과'];
                                }
                                if (u['미평가사유(메모)'] !== undefined) ev.records[sNum].reason = u['미평가사유(메모)'];
                            } else if (ev.type === 'check') {
                                if (u['체크결과'] !== undefined) {
                                    if (u['체크결과'] === 'O') ev.records[sNum].checked = true;
                                    else if (u['체크결과'] === 'X') ev.records[sNum].checked = false;
                                    else delete ev.records[sNum].checked;
                                }
                                if (u['미평가사유(메모)'] !== undefined) ev.records[sNum].reason = u['미평가사유(메모)'];
                            } else if (ev.type === 'memo') {
                                if (u['메모내용'] !== undefined) ev.records[sNum].memo = u['메모내용'];
                            }
                        }
                    }
                });
            }
        }

        let activePeriods = {}; 
        let activeForwards = {}; 
        const sortedDates = Object.keys(parsedDaysMap).sort();
        
        if (doEvent) {
            sortedDates.forEach(dStr => {
                let evList = parsedDaysMap[dStr].eventList;
                let curDateObj = new Date(dStr);

                evList.forEach(ev => {
                    let labelObj = null;
                    if (ev.labelIds && ev.labelIds.length > 0) {
                        labelObj = masterLabels.find(l => l.id === ev.labelIds[0]);
                    }
                    if (!labelObj) return;

                    const pureContent = ev.content.replace(/\s*\(\d+\/\d+\).*/, '').trim();
                    const signature = labelObj.id + "|||" + pureContent;
                    
                    if (labelObj.isPeriod || labelObj.isRecur) {
                        if (activePeriods[signature]) {
                            let lastD = new Date(activePeriods[signature].lastDate);
                            let diff = (curDateObj - lastD) / (1000 * 60 * 60 * 24);
                            if (diff <= 14) { 
                                ev.groupId = activePeriods[signature].groupId;
                                activePeriods[signature].lastDate = dStr;
                            } else {
                                let newGroupId = 'group_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5);
                                ev.groupId = newGroupId;
                                activePeriods[signature] = { groupId: newGroupId, lastDate: dStr };
                            }
                        } else {
                            let newGroupId = 'group_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5);
                            ev.groupId = newGroupId;
                            activePeriods[signature] = { groupId: newGroupId, lastDate: dStr };
                        }
                    }
                    
                    if (labelObj.isForward) {
                         if (activeForwards[signature]) {
                            let lastD = new Date(activeForwards[signature].lastDate);
                            let diff = (curDateObj - lastD) / (1000 * 60 * 60 * 24);
                            if (diff <= 14) { 
                                ev.forwardChainId = activeForwards[signature].chainId;
                                ev.originalDate = activeForwards[signature].originalDate;
                                activeForwards[signature].lastDate = dStr;
                            } else {
                                let newChainId = 'chain_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5);
                                ev.forwardChainId = newChainId;
                                ev.originalDate = dStr; 
                                activeForwards[signature] = { chainId: newChainId, originalDate: dStr, lastDate: dStr };
                            }
                         } else {
                            let newChainId = 'chain_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5);
                            ev.forwardChainId = newChainId;
                            ev.originalDate = dStr;
                            activeForwards[signature] = { chainId: newChainId, originalDate: dStr, lastDate: dStr };
                         }
                    }
                });
            });
        }

        const batchPromises = [];
        let batch = writeBatch(db);
        let opCount = 0;

        if (mode === 'overwrite') {
            const cols = [];
            if (doEvent) cols.push('events');
            if (doClass) cols.push('schedules');
            if (doJournal) cols.push('journals');
            if (doEval) cols.push('evaluations');

            for (const col of cols) {
                const snap = await getDocs(query(getUserCol(col), where(documentId(), '>=', startStr), where(documentId(), '<=', endStr)));
                snap.forEach(docSnap => {
                    batch.delete(docSnap.ref);
                    opCount++;
                    if(opCount >= 400) { batchPromises.push(batch.commit()); batch = writeBatch(db); opCount = 0; }
                });
            }
            if(opCount > 0) { batchPromises.push(batch.commit()); batch = writeBatch(db); opCount = 0; }
            await Promise.all(batchPromises);
            batchPromises.length = 0; 
        }

        for (const dStr of sortedDates) {
            if (doEvent) {
                let newEventList = parsedDaysMap[dStr].eventList;
                let evText = parsedDaysMap[dStr].eventText;
                if (mode === 'merge') {
                    const existDoc = await getDoc(doc(getUserCol('events'), dStr));
                    if (existDoc.exists()) {
                        const existList = existDoc.data().eventList || [];
                        const combinedList = [...existList];
                        newEventList.forEach(newItem => {
                            const isDup = existList.some(old => old.content === newItem.content);
                            if(!isDup) combinedList.push(newItem);
                        });
                        newEventList = combinedList;
                    }
                }
                batch.set(doc(getUserCol('events'), dStr), { eventList: newEventList, eventText: evText, updatedAt: Date.now() }, { merge: true });
                opCount++;
            }

            if (doClass && scheduleDataMap[dStr]) {
                batch.set(doc(getUserCol('schedules'), dStr), { periods: scheduleDataMap[dStr], updatedAt: Date.now() }, { merge: true });
                opCount++;
            }

            if (doJournal && journalDataMap[dStr]) {
                let newJournalList = journalDataMap[dStr];
                if (mode === 'merge') {
                    const existDoc = await getDoc(doc(getUserCol('journals'), dStr));
                    if (existDoc.exists()) {
                        const existList = existDoc.data().entries || [];
                        const combinedList = [...existList];
                        newJournalList.forEach(newItem => {
                            const isDup = existList.some(old => old.content === newItem.content);
                            if(!isDup) combinedList.push(newItem);
                        });
                        newJournalList = combinedList;
                    }
                }
                batch.set(doc(getUserCol('journals'), dStr), { entries: newJournalList, updatedAt: Date.now() }, { merge: true });
                opCount++;
            }

            if (doEval && evalDataMap[dStr] !== undefined) {
                let newEvalList = evalDataMap[dStr] || [];
                if (mode === 'merge') {
                    const existDoc = await getDoc(doc(getUserCol('evaluations'), dStr));
                    if (existDoc.exists()) {
                        const existList = existDoc.data().evalList || [];
                        const combined = [...existList];
                        newEvalList.forEach(newItem => {
                            const idx = combined.findIndex(old => old.id === newItem.id);
                            if (idx !== -1) combined[idx] = newItem; 
                            else combined.push(newItem);
                        });
                        newEvalList = combined;
                    }
                }
                batch.set(doc(getUserCol('evaluations'), dStr), { evalList: newEvalList, updatedAt: Date.now() }, { merge: true });
                opCount++;
            }

            if (opCount > 400) {
                batchPromises.push(batch.commit());
                batch = writeBatch(db);
                opCount = 0;
            }
        }
        if(opCount > 0) batchPromises.push(batch.commit());
        await Promise.all(batchPromises);

        if (labelsChanged) {
            localStorage.setItem('workCalendar_eventLabels_v4', JSON.stringify(masterLabels));
            localStorage.setItem('workCalendar_journalLabels_v4', JSON.stringify(masterJournalLabels));
            if (window.auth && window.auth.currentUser) {
                await setDoc(doc(getUserCol('settings'), 'labels'), {
                    eventLabels: masterLabels,
                    journalLabels: masterJournalLabels
                }, { merge: true });
            }
        }
    },

    processMemoRows: async function(rows, mode) {
        if (rows.length < 2) return;
        const batchPromises = [];
        let batch = writeBatch(db);
        let opCount = 0;
        let newLinks = [];

        if (mode === 'overwrite') {
            const snap = await getDocs(getUserCol('tasks'));
            snap.forEach(docSnap => {
                batch.delete(docSnap.ref);
                opCount++;
                if(opCount >= 400) { batchPromises.push(batch.commit()); batch = writeBatch(db); opCount = 0; }
            });
            await deleteDoc(doc(getUserCol('settings'), 'user_links'));
            if(opCount > 0) { batchPromises.push(batch.commit()); batch = writeBatch(db); opCount = 0; }
            await Promise.all(batchPromises);
            batchPromises.length = 0; 
        }

        for (let i=1; i<rows.length; i++) {
            const r = rows[i];
            if(r.length < 3 || !r[2]) continue; 
            
            const dataType = r[0] || 'MEMO';
            if (dataType === 'LINK') {
                newLinks.push({ name: r[2], url: r[5] });
            } else {
                let id = r[1] && !r[1].startsWith('LINK_') ? r[1] : doc(getUserCol('tasks')).id; 
                const completed = r[3] === 'O';
                const labels = r[4] ? r[4].split(',').filter(x=>x.trim()) : [];
                const imageUrl = r[5] || '';
                const createdAt = parseInt(r[6], 10) || Date.now();

                batch.set(doc(getUserCol('tasks'), id), {
                    text: r[2], completed: completed, labels: labels, imageUrl: imageUrl,
                    createdAt: createdAt, updatedAt: Date.now(), order: -createdAt 
                }, { merge: true });
                
                opCount++;
                if (opCount > 400) {
                    batchPromises.push(batch.commit());
                    batch = writeBatch(db);
                    opCount = 0;
                }
            }
        }
        
        if (newLinks.length > 0) {
            const linkDoc = await getDoc(doc(getUserCol('settings'), 'user_links'));
            let existingLinks = linkDoc.exists() ? (linkDoc.data().links || []) : [];
            
            if (mode === 'merge') {
                const combinedLinks = [...existingLinks];
                newLinks.forEach(nl => {
                    if (!existingLinks.some(el => el.url === nl.url)) combinedLinks.push(nl);
                });
                newLinks = combinedLinks;
            }
            batch.set(doc(getUserCol('settings'), 'user_links'), { links: newLinks }, { merge: true });
            opCount++;
        }

        if(opCount > 0) batchPromises.push(batch.commit());
        await Promise.all(batchPromises);
    },

    getOrCreateSpreadsheet: async function(token) {
        const configRef = doc(getUserCol('settings'), 'backup_config');
        const docSnap = await getDoc(configRef);
        let spreadsheetId = docSnap.exists() ? docSnap.data().spreadsheetId : null;

        if (spreadsheetId) {
            try {
                const checkRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=spreadsheetId`, {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!checkRes.ok) {
                    spreadsheetId = null; 
                }
            } catch (error) {
                spreadsheetId = null;
            }
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
                        errorMsg = "구글 스프레드시트 접근 권한이 없습니다.\n\n해결방법: 화면 우측 상단의 [로그아웃]을 클릭하신 후, 다시 구글 로그인 창이 뜰 때 반드시 'Google 스프레드시트' 관련 체크박스에 체크해 주셔야 파일 생성이 가능합니다.";
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

    exportToSheets: async function() {
        const btn = document.getElementById('btn-sheets-export');
        const oldText = btn.textContent;
        btn.textContent = "⏳ 연결 확인 중..."; btn.disabled = true;

        try {
            const token = await window.getValidGoogleToken();
            if(!token) throw new Error("토큰 발급이 취소되었습니다.");
            
            btn.textContent = "⏳ 내보내는 중...";

            const spreadsheetId = await this.getOrCreateSpreadsheet(token);
            const sheetName = this.currentTab === 'schedule' ? '일정기록' : '메모';
            
            const finalData = this.currentTab === 'schedule' ? await this.getScheduleDataArray() : { scheduleRows: await this.getMemoDataArray(), evalSheetsData: {} };

            await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName + '!A:Z')}:clear`, {
                method: 'POST', headers: { 'Authorization': `Bearer ${token}` }
            });

            const updateRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName + '!A1')}?valueInputOption=USER_ENTERED`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ values: finalData.scheduleRows })
            });

            if (!updateRes.ok) throw new Error("업데이트 실패");

            if (this.currentTab === 'schedule' && document.getElementById('backup-chk-eval').checked) {
                for (const [sName, rows] of Object.entries(finalData.evalSheetsData)) {
                    try {
                        await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
                            method: 'POST',
                            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                            body: JSON.stringify({ requests: [{ addSheet: { properties: { title: sName } } }] })
                        });
                    } catch(e) {}

                    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sName + '!A:Z')}:clear`, {
                        method: 'POST', headers: { 'Authorization': `Bearer ${token}` }
                    });
                    
                    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sName + '!A1')}?valueInputOption=USER_ENTERED`, {
                        method: 'PUT',
                        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ values: rows })
                    });
                }
            }

            this.checkExistingSheet(); 
            btn.textContent = "✅ 백업 완료!";
            setTimeout(() => {
                btn.textContent = oldText;
                btn.disabled = false;
            }, 2000);

        } catch (e) {
            console.error(e);
            if(e.message !== "토큰 발급이 취소되었습니다.") alert("❌ 백업 실패:\n" + e.message);
            btn.textContent = oldText; 
            btn.disabled = false;
        }
    },

    importFromSheets: async function() {
        const mode = document.querySelector('input[name="import-mode"]:checked').value;
        const modeName = mode === 'overwrite' ? '완전 초기화 및 덮어쓰기(교체)' : '기존 데이터 유지하며 추가(병합)';

        if(!confirm(`[${modeName}]\n구글 시트의 데이터로 현재 화면을 복원하시겠습니까?`)) return;

        const btn = document.getElementById('btn-sheets-import');
        const oldText = btn.textContent;
        btn.textContent = "⏳ 연결 확인 중..."; btn.disabled = true;

        try {
            const token = await window.getValidGoogleToken();
            if(!token) throw new Error("토큰 발급이 취소되었습니다.");
            
            btn.textContent = "⏳ 불러오는 중...";

            const docSnap = await getDoc(doc(getUserCol('settings'), 'backup_config'));
            const spreadsheetId = docSnap.exists() ? docSnap.data().spreadsheetId : null;
            if(!spreadsheetId) throw new Error("백업된 시트를 찾을 수 없습니다. 먼저 '구글 시트로 백업'을 진행해주세요.");

            const sheetName = this.currentTab === 'schedule' ? '일정기록' : '메모';
            const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName + '!A:Z')}`, {
                method: 'GET', headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if(!res.ok) throw new Error("시트 읽기에 실패했습니다. (접근 권한이 없거나 파일이 삭제되었습니다.)");
            
            const data = await res.json();
            const rows = data.values || [];

            let matrixUpdates = [];

            if (this.currentTab === 'schedule') {
                const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, { headers: { 'Authorization': `Bearer ${token}` } });
                const metaData = await metaRes.json();
                const evalSheetNames = metaData.sheets.map(s => s.properties.title).filter(t => t.startsWith('조사표_'));

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
            }

            if (this.currentTab === 'schedule') {
                await this.processScheduleRows(rows, mode, matrixUpdates);
            }
            else {
                await this.processMemoRows(rows, mode);
            }

            alert("✅ 구글 시트에서 성공적으로 복원 및 데이터 동기화가 완료되었습니다!");
            this.modal.close();
            if(window.render) window.render();

        } catch (e) {
            console.error(e);
            if(e.message !== "토큰 발급이 취소되었습니다.") alert("복원 중 오류 발생: " + e.message);
        } finally {
            btn.textContent = oldText; 
            btn.disabled = false;
        } 
    },

    escapeCSV: function(str) {
        if (str == null) return "";
        let s = String(str);
        if (s.includes('"') || s.includes(',') || s.includes('\n')) s = '"' + s.replace(/"/g, '""') + '"';
        return s;
    },

    parseCSV: function(csvText) {
        const rows = []; let row = []; let inQuotes = false; let val = '';
        for (let i = 0; i < csvText.length; i++) {
            let c = csvText[i], nc = csvText[i+1];
            if (c === '"' && inQuotes && nc === '"') { val += '"'; i++; }
            else if (c === '"') { inQuotes = !inQuotes; }
            else if (c === ',' && !inQuotes) { row.push(val); val = ''; }
            else if (c === '\n' && !inQuotes) { row.push(val); rows.push(row); row = []; val = ''; }
            else if (c === '\r' && !inQuotes) {} 
            else { val += c; }
        }
        if (val || row.length > 0) { row.push(val); rows.push(row); }
        return rows;
    },

    handleDownload: async function() {
        const btn = document.getElementById('btn-backup-download');
        const oldText = btn.textContent; btn.textContent = "⏳ 집계 중..."; btn.disabled = true;
        try {
            const data = this.currentTab === 'schedule' ? await this.getScheduleDataArray() : { scheduleRows: await this.getMemoDataArray(), evalSheetsData: {} };
            
            const csvContent1 = "\uFEFF" + data.scheduleRows.map(row => row.map(v => this.escapeCSV(v)).join(',')).join('\n');
            const blob1 = new Blob([csvContent1], { type: 'text/csv;charset=utf-8;' });
            const link1 = document.createElement("a");
            link1.href = URL.createObjectURL(blob1);
            link1.download = this.currentTab === 'schedule' ? `업무계획표_일정백업.csv` : `업무계획표_메모백업.csv`;
            link1.click();

            if (this.currentTab === 'schedule' && document.getElementById('backup-chk-eval').checked) {
                let delay = 500;
                for (const [sName, rows] of Object.entries(data.evalSheetsData)) {
                    setTimeout(() => {
                        const csvContent = "\uFEFF" + rows.map(row => row.map(v => this.escapeCSV(v)).join(',')).join('\n');
                        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                        const link = document.createElement("a");
                        link.href = URL.createObjectURL(blob);
                        link.download = `업무계획표_${sName}.csv`;
                        link.click();
                    }, delay);
                    delay += 500;
                }
            }
        } catch (e) { alert("다운로드 중 오류가 발생했습니다."); } 
        finally { btn.textContent = oldText; btn.disabled = false; }
    },

    handleUpload: async function(input) {
        const file = input.files[0];
        if (!file) return;

        const mode = document.querySelector('input[name="import-mode"]:checked').value;
        const modeName = mode === 'overwrite' ? '완전 초기화 및 덮어쓰기(교체)' : '기존 데이터에 병합';

        if(!confirm(`[${modeName}]\n선택하신 파일(${file.name})로 복원을 진행하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) { input.value = ''; return; }

        const btn = input.nextElementSibling;
        const oldText = btn.textContent; btn.textContent = "⏳ 업로드 적용 중..."; btn.disabled = true;

        try {
            const text = await file.text();
            const rows = this.parseCSV(text);
            
            if (this.currentTab === 'schedule') {
                if (rows[0] && rows[0][0] === "상위 항목(조사표 제목)") {
                    const mRows = rows;
                    const idRow = mRows.find(r => r[0] === "조사표 ID (수정금지)");
                    const dateRow = mRows.find(r => r[0] === "하위 항목(날짜)");
                    const headerRow = mRows.find(r => r[0] === "번호" && r[1] === "이름");
                    
                    if (!idRow || !dateRow || !headerRow) throw new Error("유효하지 않은 조사표 형식입니다.");
                    
                    let colMapping = {};
                    let currentEvalId = null;
                    let uniqueDates = new Set();
                    for (let c = 3; c < headerRow.length; c++) {
                        if (idRow[c] && idRow[c].trim() !== '') {
                            currentEvalId = idRow[c].trim();
                            if (dateRow[c] && dateRow[c].trim() !== '') uniqueDates.add(dateRow[c].trim());
                        }
                        if (currentEvalId) colMapping[c] = { evalId: currentEvalId, colName: headerRow[c] };
                    }

                    const updatesByEval = {};
                    const dataRows = mRows.slice(mRows.indexOf(headerRow) + 1);
                    dataRows.forEach(r => {
                        const studentNum = parseInt(r[0], 10);
                        if (isNaN(studentNum)) return;
                        for (let c = 3; c < r.length; c++) {
                            const mapping = colMapping[c];
                            if (!mapping) continue;
                            if (!updatesByEval[mapping.evalId]) updatesByEval[mapping.evalId] = {};
                            if (!updatesByEval[mapping.evalId][studentNum]) updatesByEval[mapping.evalId][studentNum] = {};
                            updatesByEval[mapping.evalId][studentNum][mapping.colName] = (r[c] || '').trim();
                        }
                    });

                    const batchPromises = [];
                    let batch = writeBatch(db);
                    let opCount = 0;
                    
                    for (const dStr of uniqueDates) {
                        const evalDoc = await getDoc(doc(getUserCol('evaluations'), dStr));
                        if (evalDoc.exists()) {
                            const evalList = evalDoc.data().evalList || [];
                            let changed = false;
                            evalList.forEach(ev => {
                                const updates = updatesByEval[ev.id];
                                if (updates) {
                                    changed = true;
                                    for (const sNumStr in updates) {
                                        const sNum = parseInt(sNumStr, 10);
                                        const u = updates[sNumStr];
                                        if (!ev.records[sNum]) ev.records[sNum] = {};
                                        
                                        if (ev.type === 'eval') {
                                            if (u['조이름'] !== undefined) ev.records[sNum].groupName = u['조이름'];
                                            if (u['조별결과'] !== undefined) ev.records[sNum].groupScore = u['조별결과'];
                                            if (u['개별결과'] !== undefined) {
                                                ev.records[sNum].indivScore = u['개별결과'];
                                                ev.records[sNum].score = u['개별결과'];
                                            }
                                            if (u['미평가사유(메모)'] !== undefined) ev.records[sNum].reason = u['미평가사유(메모)'];
                                        } else if (ev.type === 'check') {
                                            if (u['체크결과'] !== undefined) {
                                                if (u['체크결과'] === 'O') ev.records[sNum].checked = true;
                                                else if (u['체크결과'] === 'X') ev.records[sNum].checked = false;
                                                else delete ev.records[sNum].checked;
                                            }
                                            if (u['미평가사유(메모)'] !== undefined) ev.records[sNum].reason = u['미평가사유(메모)'];
                                        } else if (ev.type === 'memo') {
                                            if (u['메모내용'] !== undefined) ev.records[sNum].memo = u['메모내용'];
                                        }
                                    }
                                }
                            });
                            if (changed) {
                                batch.set(doc(getUserCol('evaluations'), dStr), { evalList: evalList, updatedAt: Date.now() }, { merge: true });
                                opCount++;
                                if (opCount >= 400) { batchPromises.push(batch.commit()); batch = writeBatch(db); opCount = 0; }
                            }
                        }
                    }
                    if (opCount > 0) batchPromises.push(batch.commit());
                    await Promise.all(batchPromises);
                    
                    this.modal.close();
                    if(window.render) window.render();
                    alert("✅ CSV 파일에서 조사표 정보가 성공적으로 반영되었습니다!");
                    return;
                }
                
                await this.processScheduleRows(rows, mode);
            }
            else await this.processMemoRows(rows, mode);
            
            this.modal.close();
            if(window.render) window.render();
            alert("✅ CSV 파일에서 성공적으로 복원되었습니다!");
        } catch (e) { 
            if (e.message !== "열람용 파일 업로드 시도") {
                alert("업로드 처리 중 오류가 발생했습니다."); 
                console.error(e);
            }
        } finally {
            btn.textContent = oldText; 
            btn.disabled = false; 
            input.value = ``;
        } 
    }
};

window.BackupManager = BackupManager;