// js/modules/backup.js

import { store } from '../core/store.js';
import { formatDate, getEventLabels, getJournalLabels, getSemesterDates } from '../core/utils.js';
import { getUserCol, db } from '../firebase.js';
import { doc, getDoc, getDocs, setDoc, deleteDoc, query, where, documentId, orderBy, writeBatch } from "firebase/firestore"; 

// 🌟 [핵심 신규 기능] 화면 중앙을 덮는 글로벌 프로세스 팝업창 로직
window.ProgressModal = {
    modalEl: null,
    show: function(title) {
        if (this.modalEl) this.modalEl.remove();
        const html = `
        <div id="global-progress-modal" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15, 23, 42, 0.75); z-index:10005; display:flex; justify-content:center; align-items:center; backdrop-filter:blur(4px);">
            <div style="background:#fff; width:380px; padding:30px 25px; border-radius:16px; box-shadow:0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04); text-align:center; transform: scale(0.95); animation: popIn 0.2s forwards ease-out;">
                <div id="progress-spinner" style="margin:0 auto 20px auto; width:50px; height:50px; border:4px solid #e2e8f0; border-top-color:#3b82f6; border-radius:50%; animation: spin 1s linear infinite;"></div>
                <h3 id="progress-title" style="margin:0 0 12px 0; color:#1e293b; font-size:1.25rem; font-weight:800;">${title}</h3>
                <div id="progress-bar-container" style="width:100%; background:#f1f5f9; height:12px; border-radius:6px; overflow:hidden; margin-bottom:15px; box-shadow:inset 0 1px 2px rgba(0,0,0,0.05);">
                    <div id="progress-bar-fill" style="width:0%; height:100%; background:linear-gradient(90deg, #3b82f6, #60a5fa); transition:width 0.3s ease; border-radius:6px;"></div>
                </div>
                <p id="progress-desc" style="margin:0 0 25px 0; color:#64748b; font-size:0.95rem; font-weight:600; line-height:1.5; word-break:keep-all;">준비 중...</p>
                <button id="progress-ok-btn" style="display:none; width:100%; padding:12px; background:#10b981; color:#fff; border:none; border-radius:8px; font-weight:bold; cursor:pointer; font-size:1.05rem; transition: background 0.2s;">확인</button>
            </div>
        </div>
        <style>
            @keyframes spin { 100% { transform:rotate(360deg); } }
            @keyframes popIn { 100% { transform: scale(1); } }
        </style>
        `;
        document.body.insertAdjacentHTML('beforeend', html);
        this.modalEl = document.getElementById('global-progress-modal');
    },
    update: function(desc, percent) {
        if(!this.modalEl) return;
        const descEl = document.getElementById('progress-desc');
        const barEl = document.getElementById('progress-bar-fill');
        if(descEl && desc) descEl.innerText = desc;
        if(barEl && percent !== undefined) barEl.style.width = percent + '%';
    },
    complete: function(desc, callback) {
        if(!this.modalEl) return;
        const spinner = document.getElementById('progress-spinner');
        const descEl = document.getElementById('progress-desc');
        const barEl = document.getElementById('progress-bar-fill');
        const btn = document.getElementById('progress-ok-btn');
        const title = document.getElementById('progress-title');
        
        if(spinner) {
            spinner.style.animation = "none";
            spinner.style.border = "none";
            spinner.innerHTML = "✅";
            spinner.style.fontSize = "3.5rem";
            spinner.style.lineHeight = "50px";
        }
        if(title) title.innerText = "작업 완료";
        if(descEl && desc) { descEl.innerText = desc; descEl.style.color = "#047857"; }
        if(barEl) { barEl.style.width = '100%'; barEl.style.background = "linear-gradient(90deg, #10b981, #34d399)"; }
        if(btn) { 
            btn.style.display = 'block'; 
            btn.style.background = '#10b981';
            btn.onclick = () => {
                this.close();
                if(callback) callback();
            };
        }
    },
    error: function(desc, callback) {
        if(!this.modalEl) return;
        const spinner = document.getElementById('progress-spinner');
        const descEl = document.getElementById('progress-desc');
        const barEl = document.getElementById('progress-bar-fill');
        const btn = document.getElementById('progress-ok-btn');
        const title = document.getElementById('progress-title');
        
        if(spinner) {
            spinner.style.animation = "none";
            spinner.style.border = "none";
            spinner.innerHTML = "❌";
            spinner.style.fontSize = "3.5rem";
            spinner.style.lineHeight = "50px";
        }
        if(title) { title.innerText = "오류 발생"; title.style.color = "#b91c1c"; }
        if(descEl && desc) { descEl.innerText = desc; descEl.style.color = "#b91c1c"; }
        if(barEl) barEl.style.background = "#ef4444";
        if(btn) { 
            btn.style.display = 'block'; 
            btn.style.background = '#ef4444';
            btn.onclick = () => {
                this.close();
                if(callback) callback();
            };
        }
    },
    close: function() {
        if(this.modalEl) {
            this.modalEl.remove();
            this.modalEl = null;
        }
    }
};


export const BackupManager = {
    modal: null,
    currentSpreadsheetId: null,

    openModal: function() {
        if (!this.modal) {
            const html = `
            <div style="display:flex; flex-direction:column; gap:18px; max-height:65vh; overflow-y:auto; padding-right:5px; margin-bottom:15px;">
                
                <div class="modal-info-box" style="background:#eff6ff; border-left-color:#3b82f6; margin-bottom:0;">
                    <p style="margin:0;"><strong>[데이터 통합 관리]</strong> 클라우드 데이터를 구글 캘린더, 시트, 로컬(CSV)과 양방향으로 동기화합니다.</p>
                </div>

                <!-- 1단계: 기간 선택 -->
                <div>
                    <label style="display:block; font-weight:bold; margin-bottom:6px; color:#1e40af; font-size:1.05rem;">1. 기간 선택</label>
                    <div style="display:flex; flex-direction:column; gap:10px; background:#f8fafc; padding:15px; border-radius:8px; border:1px solid #e2e8f0;">
                        <select id="backup-period-select" onchange="window.BackupManager.onPeriodChange()" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:6px; font-size:1rem; outline:none; cursor:pointer; font-weight:bold;">
                            <option value="today" selected>오늘 (기본)</option>
                            <option value="week">해당 주 (이번 주)</option>
                            <option value="month">해당 월 (이번 달)</option>
                            <option value="sem1">1학기 전체</option>
                            <option value="sem2">2학기 전체</option>
                            <option value="year">해당 학년도 전체</option>
                            <option value="custom">기간 직접 설정</option>
                        </select>
                        <div style="display:flex; gap:10px; align-items:center; justify-content:center; margin-top:5px;">
                            <input type="date" id="backup-start-date" style="flex:1; padding:8px; border:1px solid #cbd5e1; border-radius:6px; outline:none;" disabled>
                            <span style="font-weight:bold; color:#64748b;">~</span>
                            <input type="date" id="backup-end-date" style="flex:1; padding:8px; border:1px solid #cbd5e1; border-radius:6px; outline:none;" disabled>
                        </div>
                    </div>
                </div>

                <!-- 2단계: 대상 정보 -->
                <div>
                    <label style="display:block; font-weight:bold; margin-bottom:6px; color:#1e40af; font-size:1.05rem;">2. 대상 정보</label>
                    <div style="display:flex; flex-wrap:wrap; gap:15px; background:#f8fafc; padding:12px 15px; border-radius:8px; border:1px solid #e2e8f0; font-weight:bold; color:#1e293b;">
                        <label style="cursor:pointer;"><input type="checkbox" id="backup-chk-event" checked style="accent-color:#3b82f6;"> 일정</label>
                        <label style="cursor:pointer;"><input type="checkbox" id="backup-chk-class" checked style="accent-color:#10b981;"> 수업</label>
                        <label style="cursor:pointer;"><input type="checkbox" id="backup-chk-journal" checked style="accent-color:#ec4899;"> 기록</label>
                        <label style="cursor:pointer;"><input type="checkbox" id="backup-chk-eval" checked style="accent-color:#f59e0b;"> 조사표</label>
                        <label style="cursor:pointer;"><input type="checkbox" id="backup-chk-memo" checked style="accent-color:#64748b;"> 메모/링크</label>
                    </div>
                </div>

                <!-- 3단계: 방식 선택 -->
                <div>
                    <label style="display:block; font-weight:bold; margin-bottom:6px; color:#1e40af; font-size:1.05rem;">3. 동기화 방식 (가져오기/내보내기)</label>
                    <div style="background:#fef2f2; padding:15px; border-radius:8px; border:1px solid #fca5a5;">
                        <label style="display:flex; align-items:flex-start; gap:8px; margin-bottom:12px; cursor:pointer;">
                            <input type="radio" name="import-mode" value="merge" checked style="margin-top:3px; accent-color:#059669;">
                            <div>
                                <span style="font-weight:bold; color:#059669; font-size:0.95rem;">병합 (기존 데이터 보호 및 최신화)</span><br>
                                <span style="font-size:0.8rem; color:#64748b;">기존에 작성된 데이터는 그대로 유지하면서 새로 추가/수정된 내용만 스마트하게 반영합니다.</span>
                            </div>
                        </label>
                        <label style="display:flex; align-items:flex-start; gap:8px; cursor:pointer;">
                            <input type="radio" name="import-mode" value="overwrite" style="margin-top:3px; accent-color:#ef4444;">
                            <div>
                                <span style="font-weight:bold; color:#ef4444; font-size:0.95rem;">완전 교체 (모두 지우고 덮어쓰기)</span><br>
                                <span style="font-size:0.8rem; color:#64748b;">선택된 기간의 타겟 데이터를 모두 싹 지우고 지정한 데이터로 완전히 교체합니다.</span>
                            </div>
                        </label>
                        <div style="margin-top:8px; font-size:0.75rem; color:#94a3b8; border-top: 1px dashed #fca5a5; padding-top:6px;">
                            ※ 로컬(CSV) 내보내기는 위 옵션과 무관하게 항상 새 파일로 저장됩니다.
                        </div>
                    </div>
                </div>

                <!-- 4단계: 플랫폼 대상 -->
                <div>
                    <label style="display:block; font-weight:bold; margin-bottom:6px; color:#1e40af; font-size:1.05rem;">4. 대상 (플랫폼)</label>
                    <div style="display:flex; gap:10px;">
                        <label style="flex:1; cursor:pointer; text-align:center;">
                            <input type="radio" name="backup-target" value="calendar" style="display:none;" onchange="window.BackupManager.onTargetChange()">
                            <div class="target-card" id="target-card-calendar" style="padding:15px 5px; border:2px solid #cbd5e1; border-radius:8px; background:#f8fafc; color:#64748b; font-weight:bold; transition:0.2s;">
                                📅 구글 캘린더
                            </div>
                        </label>
                        <label style="flex:1; cursor:pointer; text-align:center;">
                            <input type="radio" name="backup-target" value="sheets" checked style="display:none;" onchange="window.BackupManager.onTargetChange()">
                            <div class="target-card" id="target-card-sheets" style="padding:15px 5px; border:2px solid #0f9d58; border-radius:8px; background:#e8f5e9; color:#0f9d58; font-weight:bold; transition:0.2s;">
                                📗 구글 시트
                            </div>
                        </label>
                        <label style="flex:1; cursor:pointer; text-align:center;">
                            <input type="radio" name="backup-target" value="csv" style="display:none;" onchange="window.BackupManager.onTargetChange()">
                            <div class="target-card" id="target-card-csv" style="padding:15px 5px; border:2px solid #cbd5e1; border-radius:8px; background:#f8fafc; color:#64748b; font-weight:bold; transition:0.2s;">
                                💾 로컬 (CSV)
                            </div>
                        </label>
                    </div>
                    
                    <!-- 구글 시트 링크 영역 -->
                    <div id="sheet-link-area"></div>
                </div>

            </div>

            <!-- 마스터 실행 버튼 -->
            <div style="display:flex; gap:10px; border-top: 2px solid #e2e8f0; padding-top: 15px;">
                <input type="file" id="backup-upload-file" accept=".csv" style="display:none;" onchange="window.BackupManager.handleUpload(this)">
                <button id="btn-master-import" onclick="window.BackupManager.executeImport()" style="flex:1; padding:12px; font-size:1.1rem; border:2px solid #3b82f6; background:#fff; color:#3b82f6; border-radius:8px; font-weight:bold; cursor:pointer; transition:0.2s;">📥 가져오기</button>
                <button id="btn-master-export" onclick="window.BackupManager.executeExport()" style="flex:1; padding:12px; font-size:1.1rem; border:none; background:#3b82f6; color:#fff; border-radius:8px; font-weight:bold; cursor:pointer; transition:0.2s;">📤 내보내기</button>
            </div>
            `;
            this.modal = new window.Modal({ id: 'backup-modal-v9', title: '내보내기/가져오기', width: '550px', content: html });
        }
        this.modal.open();
        this.setDefaultDates();
        this.checkExistingSheet(); 
        setTimeout(() => this.onTargetChange(), 50);
    },

    onTargetChange: function() {
        const target = document.querySelector('input[name="backup-target"]:checked').value;
        const cCard = document.getElementById('target-card-calendar');
        const sCard = document.getElementById('target-card-sheets');
        const fCard = document.getElementById('target-card-csv');
        const sheetExtra = document.getElementById('sheet-link-area');

        cCard.style.borderColor = '#cbd5e1'; cCard.style.background = '#f8fafc'; cCard.style.color = '#64748b';
        sCard.style.borderColor = '#cbd5e1'; sCard.style.background = '#f8fafc'; sCard.style.color = '#64748b';
        fCard.style.borderColor = '#cbd5e1'; fCard.style.background = '#f8fafc'; fCard.style.color = '#64748b';
        sheetExtra.style.display = 'none';

        if (target === 'calendar') {
            cCard.style.borderColor = '#ea4335'; cCard.style.background = '#fce8e6'; cCard.style.color = '#ea4335';
        } else if (target === 'sheets') {
            sCard.style.borderColor = '#0f9d58'; sCard.style.background = '#e8f5e9'; sCard.style.color = '#0f9d58';
            sheetExtra.style.display = 'block';
        } else if (target === 'csv') {
            fCard.style.borderColor = '#475569'; fCard.style.background = '#f1f5f9'; fCard.style.color = '#475569';
        }
    },

    executeExport: async function() {
        const target = document.querySelector('input[name="backup-target"]:checked').value;
        if (target === 'sheets') {
            await this.exportToSheets();
        } else if (target === 'csv') {
            await this.handleDownload();
        } else if (target === 'calendar') {
            if (typeof window.executeGoogleExport === 'function') {
                await window.executeGoogleExport();
            } else {
                alert("구글 캘린더 연동 기능이 준비되지 않았습니다. (sync.js 필요)");
            }
        }
    },

    executeImport: async function() {
        const target = document.querySelector('input[name="backup-target"]:checked').value;
        if (target === 'sheets') {
            await this.importFromSheets();
        } else if (target === 'csv') {
            document.getElementById('backup-upload-file').click();
        } else if (target === 'calendar') {
            if (typeof window.executeGoogleImport === 'function') {
                await window.executeGoogleImport();
            } else {
                alert("구글 캘린더 연동 기능이 준비되지 않았습니다. (sync.js 필요)");
            }
        }
    },

    setDefaultDates: function() {
        const select = document.getElementById('backup-period-select');
        if (select) {
            select.value = 'today';
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
                    <div style="margin-top: 15px;">
                        <button onclick="window.open('https://docs.google.com/spreadsheets/d/${this.currentSpreadsheetId}/edit', '_blank')" style="width:100%; padding:10px; background:#c7d2fe; color:#312e81; border:none; border-radius:6px; cursor:pointer; font-weight:bold; transition:0.2s;">🔗 내 구글 시트 파일 바로 열기</button>
                        <div style="text-align:right; margin-top:8px;">
                            <span onclick="window.BackupManager.resetSheetConnection()" style="font-size:0.85rem; color:#64748b; cursor:pointer; text-decoration:underline;">시트 연결 해제/초기화</span>
                        </div>
                    </div>
                `;
            } else if (linkArea) {
                linkArea.innerHTML = '';
            }
        } catch(e) {}
    },

    resetSheetConnection: async function() {
        if(confirm("기존 구글 시트와의 연결을 끊고 완전히 새로운 파일을 생성하시겠습니까?")) {
            await deleteDoc(doc(getUserCol('settings'), 'backup_config'));
            this.currentSpreadsheetId = null;
            this.checkExistingSheet();
            alert("초기화 완료!\n[내보내기] 버튼을 누르시면 드라이브에 새로운 파일이 생성됩니다.");
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

                    eventList.push({ labelIds: mappedLabelIds, label: labelsArray[0], labels: labelsArray, content: content, completed: completed });
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
                    try { evalDataMap[dStr] = JSON.parse(evalStr); } catch(e) { console.warn("조사표 파싱 에러", e); }
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

        const sortedDates = Object.keys(parsedDaysMap).sort();
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

        const totalDays = sortedDates.length;
        let processedCount = 0;

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

            processedCount++;
            if (window.ProgressModal) {
                window.ProgressModal.update(`데이터베이스 저장 중... [${processedCount}/${totalDays}]`, 30 + (70 * (processedCount/totalDays)));
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

        const totalRows = rows.length - 1;
        let processedRows = 0;

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

            processedRows++;
            if (processedRows % 10 === 0 && window.ProgressModal) {
                window.ProgressModal.update(`메모 데이터 저장 중... [${processedRows}/${totalRows}]`, 50 + (50 * (processedRows/totalRows)));
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

    exportToSheets: async function() {
        try {
            window.ProgressModal.show("구글 시트 내보내기");
            window.ProgressModal.update("구글 계정 연결 확인 중...", 10);

            const token = await window.getValidGoogleToken();
            if(!token) throw new Error("토큰 발급이 취소되었습니다.");
            
            const mode = document.querySelector('input[name="import-mode"]:checked').value;
            window.ProgressModal.update("시트 파일 및 환경 준비 중...", 20);

            const spreadsheetId = await this.getOrCreateSpreadsheet(token);
            
            const incEvent = document.getElementById('backup-chk-event').checked;
            const incClass = document.getElementById('backup-chk-class').checked;
            const incJournal = document.getElementById('backup-chk-journal').checked;
            const incEval = document.getElementById('backup-chk-eval').checked;
            const incMemo = document.getElementById('backup-chk-memo').checked;

            const doSchedule = incEvent || incClass || incJournal || incEval;

            if (doSchedule) {
                window.ProgressModal.update("일정 및 수업 기록 업로드 중...", 50);
                const finalData = await this.getScheduleDataArray();
                
                if (mode === 'overwrite') {
                    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent('일정기록!A:Z')}:clear`, {
                        method: 'POST', headers: { 'Authorization': `Bearer ${token}` }
                    });
                }
                
                await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent('일정기록!A1')}?valueInputOption=USER_ENTERED`, {
                    method: 'PUT',
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ values: finalData.scheduleRows })
                });

                if (incEval) {
                    window.ProgressModal.update("조사표 및 명렬표 연동 데이터 업로드 중...", 70);
                    for (const [sName, rows] of Object.entries(finalData.evalSheetsData)) {
                        try {
                            await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
                                method: 'POST',
                                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                                body: JSON.stringify({ requests: [{ addSheet: { properties: { title: sName } } }] })
                            });
                        } catch(e) {}

                        if (mode === 'overwrite') {
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

            if (incMemo) {
                window.ProgressModal.update("메모 및 링크 업로드 중...", 85);
                const memoData = await this.getMemoDataArray();
                
                if (mode === 'overwrite') {
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
            window.ProgressModal.complete("✅ 구글 시트 백업이 성공적으로 완료되었습니다!", () => {
                if(window.BackupManager.modal) window.BackupManager.modal.close();
            });

        } catch (e) {
            console.error(e);
            if(e.message !== "토큰 발급이 취소되었습니다.") {
                window.ProgressModal.error("❌ 백업 실패:\n" + e.message);
            } else {
                window.ProgressModal.close();
            }
        }
    },

    importFromSheets: async function() {
        const mode = document.querySelector('input[name="import-mode"]:checked').value;
        const modeName = mode === 'overwrite' ? '완전 초기화 및 덮어쓰기(교체)' : '기존 데이터 유지하며 추가(병합)';

        const incEvent = document.getElementById('backup-chk-event').checked;
        const incClass = document.getElementById('backup-chk-class').checked;
        const incJournal = document.getElementById('backup-chk-journal').checked;
        const incEval = document.getElementById('backup-chk-eval').checked;
        const incMemo = document.getElementById('backup-chk-memo').checked;

        const doSchedule = incEvent || incClass || incJournal || incEval;

        if(!confirm(`[${modeName}]\n구글 시트의 데이터로 현재 앱 화면을 복원하시겠습니까?`)) return;

        try {
            window.ProgressModal.show("구글 시트 가져오기");
            window.ProgressModal.update("구글 계정 연결 확인 중...", 10);

            const token = await window.getValidGoogleToken();
            if(!token) throw new Error("토큰 발급이 취소되었습니다.");
            
            window.ProgressModal.update("시트 파일 읽는 중...", 20);

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
                await this.processScheduleRows(rows, mode, matrixUpdates);
            }

            if (incMemo) {
                window.ProgressModal.update("메모 데이터 읽는 중...", 80);
                const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent('메모!A:Z')}`, {
                    method: 'GET', headers: { 'Authorization': `Bearer ${token}` }
                });
                if(res.ok) {
                    const data = await res.json();
                    const rows = data.values || [];
                    await this.processMemoRows(rows, mode);
                }
            }

            window.ProgressModal.complete("✅ 구글 시트에서 성공적으로 복원 및 동기화가 완료되었습니다!", () => {
                if(window.BackupManager.modal) window.BackupManager.modal.close();
                if(window.render) window.render();
            });

        } catch (e) {
            console.error(e);
            if(e.message !== "토큰 발급이 취소되었습니다.") {
                window.ProgressModal.error("복원 중 오류 발생:\n" + e.message);
            } else {
                window.ProgressModal.close();
            }
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
        try {
            window.ProgressModal.show("로컬 파일(CSV) 내보내기");
            window.ProgressModal.update("데이터 집계 및 파일 생성 중...", 30);

            const incEvent = document.getElementById('backup-chk-event').checked;
            const incClass = document.getElementById('backup-chk-class').checked;
            const incJournal = document.getElementById('backup-chk-journal').checked;
            const incEval = document.getElementById('backup-chk-eval').checked;
            const incMemo = document.getElementById('backup-chk-memo').checked;

            const doSchedule = incEvent || incClass || incJournal || incEval;

            if (doSchedule) {
                window.ProgressModal.update("일정 및 수업 기록 변환 중...", 50);
                const data = await this.getScheduleDataArray();
                const csvContent1 = "\uFEFF" + data.scheduleRows.map(row => row.map(v => this.escapeCSV(v)).join(',')).join('\n');
                const blob1 = new Blob([csvContent1], { type: 'text/csv;charset=utf-8;' });
                const link1 = document.createElement("a");
                link1.href = URL.createObjectURL(blob1);
                link1.download = `업무계획표_일정백업.csv`;
                link1.click();

                if (incEval) {
                    window.ProgressModal.update("조사표 파일 묶음 변환 중...", 70);
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
            }

            if (incMemo) {
                window.ProgressModal.update("메모 파일 생성 중...", 80);
                const memoData = await this.getMemoDataArray();
                const csvContent2 = "\uFEFF" + memoData.map(row => row.map(v => this.escapeCSV(v)).join(',')).join('\n');
                const blob2 = new Blob([csvContent2], { type: 'text/csv;charset=utf-8;' });
                const link2 = document.createElement("a");
                link2.href = URL.createObjectURL(blob2);
                link2.download = `업무계획표_메모백업.csv`;
                link2.click();
            }

            window.ProgressModal.complete("✅ CSV 파일 다운로드가 완료되었습니다!", () => {
                if(window.BackupManager.modal) window.BackupManager.modal.close();
            });

        } catch (e) { 
            window.ProgressModal.error("다운로드 중 오류가 발생했습니다.\n" + e.message);
        } 
    },

    handleUpload: async function(input) {
        const file = input.files[0];
        if (!file) return;

        const mode = document.querySelector('input[name="import-mode"]:checked').value;
        const modeName = mode === 'overwrite' ? '완전 초기화 및 덮어쓰기(교체)' : '기존 데이터에 병합';

        if(!confirm(`[${modeName}]\n선택하신 파일(${file.name})로 복원을 진행하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) { input.value = ''; return; }

        try {
            window.ProgressModal.show("로컬 파일(CSV) 가져오기");
            window.ProgressModal.update("파일 읽기 및 분석 중...", 10);

            const text = await file.text();
            const rows = this.parseCSV(text);
            
            const headerStr = rows[0] ? rows[0].join(',') : '';
            if (headerStr.includes('조사표 ID (수정금지)')) {
                throw new Error("유효하지 않은 조사표 형식입니다. (조사표를 직접 복원하는 기능은 구글 시트 연동을 이용하세요.)");
            }

            if (headerStr.includes('데이터분류') && headerStr.includes('생성일자')) {
                await this.processMemoRows(rows, mode);
            } else if (headerStr.includes('날짜')) {
                await this.processScheduleRows(rows, mode);
            } else {
                throw new Error("알 수 없는 CSV 파일 형식입니다.");
            }
            
            window.ProgressModal.complete("✅ CSV 파일에서 성공적으로 복원되었습니다!", () => {
                if(window.BackupManager.modal) window.BackupManager.modal.close();
                if(window.render) window.render();
            });

        } catch (e) { 
            if (e.message !== "열람용 파일 업로드 시도") {
                console.error(e);
                window.ProgressModal.error("업로드 처리 중 오류가 발생했습니다.\n" + e.message);
            }
        } finally {
            input.value = ``;
        } 
    },

    // 🌟 조사표를 CSV 형태의 문자열로 변환하는 함수
    generateSingleEvalCSV: function(ev) {
        const rows = [];
        rows.push(["조사표 제목", ev.title || ""]);
        rows.push(["날짜", ev.dateStr || ""]);
        rows.push(["교시/위치", ev.periodStr ? `${ev.periodStr}교시` : (ev.context?.source==='journal' ? "기록" : "")]);
        
        const isEval = ev.type === 'eval';
        const isIndiv = isEval ? (ev.methodObj ? ev.methodObj.indiv : (ev.method !== 'group')) : false;
        const isGroup = isEval ? (ev.methodObj ? ev.methodObj.group : (ev.method === 'group')) : false;

        const headers = ["번호", "이름", "성별"];
        if (isEval) {
            if (isGroup) headers.push("조이름", "조별결과");
            if (isIndiv) headers.push("개별결과");
            headers.push("미평가사유");
        } else if (ev.type === 'check') {
            headers.push("체크결과", "미평가사유");
        } else {
            headers.push("메모내용");
        }
        rows.push(headers);

        (ev.studentsSnapshot || []).forEach(st => {
            const rec = ev.records[st.num] || {};
            const r = [st.num, st.name, st.gender || ""];
            
            if (isEval) {
                if (isGroup) r.push(rec.groupName || "", rec.groupScore || "");
                if (isIndiv) r.push(rec.indivScore || rec.score || "");
                r.push(rec.reason || "");
            } else if (ev.type === 'check') {
                let cRes = '';
                if (rec.checked === true) cRes = 'O';
                else if (rec.checked === false) cRes = 'X';
                r.push(cRes, rec.reason || "");
            } else if (ev.type === 'memo') {
                r.push(rec.memo || "");
            }
            rows.push(r);
        });

        return "\uFEFF" + rows.map(r => r.map(v => this.escapeCSV(v)).join(',')).join('\n');
    }
};

window.BackupManager = BackupManager;
window.openGoogleSyncModal = () => { window.BackupManager.openModal(); setTimeout(() => { const r = document.querySelector('input[name="backup-target"][value="calendar"]'); if(r){ r.checked=true; window.BackupManager.onTargetChange(); } }, 50); };
