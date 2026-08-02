// js/modules/backup.js

window.BackupManager = {
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
                <button id="backup-tab-schedule" onclick="window.BackupManager.setTab('schedule')" style="flex:1; padding:10px; border:2px solid #3b82f6; background:#eff6ff; color:#1e40af; border-radius:8px; font-weight:bold; cursor:pointer;">📅 일정 및 기록</button>
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
            </div>

            <div id="backup-memo-section" style="display:none; margin-bottom:15px; padding:15px; background:#f1f5f9; border-radius:8px; border: 1px dashed #cbd5e1;">
                <p style="margin:0; color:#475569; font-size:0.95rem; line-height:1.5;">
                    저장된 <strong>모든 메모 데이터</strong>와 <strong>자주 쓰는 문서/링크</strong> 목록을 처리합니다.<br><br>
                    * 파일이나 시트에서 수정 후 복원 시, 기존 메모/링크는 유지되며 새로운 항목들은 병합됩니다.
                </p>
            </div>

            <div style="background:#eef2ff; padding:15px; border-radius:8px; border:1px solid #c7d2fe; margin-top:20px;">
                <p style="margin:0 0 10px 0; font-weight:bold; color:#3730a3; font-size:1.05rem;">☁️ 구글 스프레드시트 동기화</p>
                <div style="display:flex; justify-content:space-between; gap:10px;">
                    <button id="btn-sheets-import" onclick="window.BackupManager.importFromSheets()" class="modal-btn-secondary" style="flex:1; background:#fff; border: 2px solid #0f9d58; color:#0f9d58; font-size:1rem;">📗 시트에서 복원</button>
                    <button id="btn-sheets-export" onclick="window.BackupManager.exportToSheets()" class="modal-btn-primary" style="flex:1; background:#0f9d58; font-size:1rem;">📗 시트로 백업</button>
                </div>
                <div id="sheet-link-area"></div>
            </div>

            <div style="background:#f8fafc; padding:15px; border-radius:8px; border:1px solid #e2e8f0; margin-top:10px;">
                <p style="margin:0 0 10px 0; font-weight:bold; color:#475569; font-size:1.05rem;">💾 로컬 파일 (CSV) 동기화</p>
                <div style="display:flex; justify-content:space-between; gap:10px;">
                    <input type="file" id="backup-upload-file" accept=".csv" style="display:none;" onchange="window.BackupManager.handleUpload(this)">
                    <button onclick="document.getElementById('backup-upload-file').click()" class="modal-btn-secondary" style="flex:1; background:#fff; border-color:#64748b; color:#475569; font-size:1rem;">📤 파일에서 복원</button>
                    <button id="btn-backup-download" onclick="window.BackupManager.handleDownload()" class="modal-btn-primary" style="flex:1; background:#475569; font-size:1rem;">📥 CSV 다운로드</button>
                </div>
            </div>
            `;
            this.modal = new window.Modal({ id: 'backup-modal-v5', title: '데이터 통합 백업/복원소', width: '520px', content: html });
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

        const d = window.currentDate ? new Date(window.currentDate) : new Date();
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

        if (val === 'today') {
            // 유지
        } else if (val === 'week') {
            const day = d.getDay();
            sDate.setDate(d.getDate() - day);
            eDate.setDate(sDate.getDate() + 6);
        } else if (val === 'month') {
            sDate = new Date(y, m, 1);
            eDate = new Date(y, m + 1, 0);
        } else if (val === 'sem1' || val === 'sem2' || val === 'year') {
            let datesInfo = {
                sem1Start: `${y}-03-01`, sem1End: `${y}-08-15`,
                sem2Start: `${y}-08-16`, sem2End: `${y+1}-02-28`
            };
            if (typeof window.getSemesterDates === 'function') datesInfo = window.getSemesterDates();

            if (val === 'sem1') { sDate = new Date(datesInfo.sem1Start); eDate = new Date(datesInfo.sem1End); } 
            else if (val === 'sem2') { sDate = new Date(datesInfo.sem2Start); eDate = new Date(datesInfo.sem2End); } 
            else if (val === 'year') { sDate = new Date(datesInfo.sem1Start); eDate = new Date(datesInfo.sem2End); }
        }
        startInput.value = window.formatDate(sDate);
        endInput.value = window.formatDate(eDate);
    },

    checkExistingSheet: async function() {
        try {
            const doc = await window.getUserCol('settings').doc('backup_config').get();
            const linkArea = document.getElementById('sheet-link-area');
            if (doc.exists && doc.data().spreadsheetId && linkArea) {
                this.currentSpreadsheetId = doc.data().spreadsheetId;
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
            await window.getUserCol('settings').doc('backup_config').delete();
            this.currentSpreadsheetId = null;
            this.checkExistingSheet();
            alert("초기화 완료!\n이제 [📗 시트로 백업] 버튼을 누르시면 드라이브에 새로운 파일이 생성됩니다.");
        }
    },

    // =========================================================================
    // 📊 [데이터 추출 모듈]
    // =========================================================================
    getScheduleDataArray: async function() {
        let startStr = document.getElementById('backup-start-date').value;
        let endStr = document.getElementById('backup-end-date').value;
        if (!startStr || !endStr) throw new Error("시작일과 종료일을 올바르게 설정해 주세요.");

        const eventsSnap = await window.getUserCol('events').where(firebase.firestore.FieldPath.documentId(), '>=', startStr).where(firebase.firestore.FieldPath.documentId(), '<=', endStr).get();
        const schedSnap = await window.getUserCol('schedules').where(firebase.firestore.FieldPath.documentId(), '>=', startStr).where(firebase.firestore.FieldPath.documentId(), '<=', endStr).get();
        const jourSnap = await window.getUserCol('journals').where(firebase.firestore.FieldPath.documentId(), '>=', startStr).where(firebase.firestore.FieldPath.documentId(), '<=', endStr).get();

        const evMap = {}; eventsSnap.forEach(d => evMap[d.id] = d.data());
        const scMap = {}; schedSnap.forEach(d => scMap[d.id] = d.data());
        const joMap = {}; jourSnap.forEach(d => joMap[d.id] = d.data());

        const pNames = window.periodNames || ["1","2","3","4","5","6"];
        const rows = [["날짜", "일정", ...pNames, "기록"]]; 

        let curr = new Date(startStr);
        const end = new Date(endStr);
        
        while(curr <= end) {
            const dStr = window.formatDate(curr);
            let row = [dStr];

            let evText = "";
            if (evMap[dStr]) {
                const list = evMap[dStr].eventList;
                if (list && list.length > 0) {
                    evText = list.map(e => {
                        const lbls = e.labels || [];
                        return lbls.length > 0 ? `[${lbls.join(', ')}] ${e.content}` : e.content;
                    }).join('\n');
                } else if (evMap[dStr].eventText) evText = evMap[dStr].eventText;
            }
            row.push(evText);

            const periods = scMap[dStr] ? (scMap[dStr].periods || {}) : {};
            for(let p=1; p<=pNames.length; p++) {
                const pData = periods[p] || {};
                let pText = pData.subject ? `[${pData.subject}] ` : "";
                if(pData.memo) pText += pData.memo;
                row.push(pText.trim());
            }

            let joText = "";
            if (joMap[dStr]) {
                const entries = joMap[dStr].entries || [];
                joText = entries.map(j => {
                    const lbls = j.labels || [];
                    return lbls.length > 0 ? `[${lbls.join(', ')}] ${j.content}` : j.content;
                }).join('\n');
            }
            row.push(joText);

            rows.push(row);
            curr.setDate(curr.getDate() + 1);
        }
        return rows;
    },

    getMemoDataArray: async function() {
        const snap = await window.getUserCol('tasks').orderBy('createdAt').get();
        const rows = [["데이터분류", "ID", "내용/이름", "완료여부(O/X)", "라벨", "주소/URL", "생성일자(타임스탬프)"]];
        
        const linkDoc = await window.getUserCol('settings').doc('user_links').get();
        if (linkDoc.exists) {
            const links = linkDoc.data().links || [];
            links.forEach((l, idx) => rows.push(['LINK', `LINK_${idx}`, l.name || '', '', '', l.url || '', '']));
        }

        snap.forEach(doc => {
            const d = doc.data();
            rows.push([ 'MEMO', doc.id, d.text || '', d.completed ? 'O' : 'X', (d.labels || []).join(','), d.imageUrl || '', d.createdAt || Date.now() ]);
        });
        return rows;
    },

    // =========================================================================
    // 📥 [데이터 주입 모듈] - 스마트 헤더 파싱 및 오류 차단 로직 적용
    // =========================================================================
    processScheduleRows: async function(rows) {
        if (rows.length < 2) return;
        
        const header = rows[0];
        let dateIdx = header.findIndex(h => typeof h === 'string' && h.includes("날짜"));
        let eventIdx = header.findIndex(h => typeof h === 'string' && h.includes("일정"));
        let journalIdx = header.findIndex(h => typeof h === 'string' && h.includes("기록"));
        
        if (dateIdx === -1) dateIdx = 0;
        if (eventIdx === -1) eventIdx = 1;
        if (journalIdx === -1) journalIdx = header.length > 2 ? header.length - 1 : -1;

        // 🛑 [치명적 버그 원천 차단] 
        // 만약 빈칸 잘림 현상으로 인해 기록(journalIdx) 위치가 일정(eventIdx)과 같거나 작아졌다면 
        // 데이터 오염 방지를 위해 기록 칸 자체를 무효화(-1) 합니다.
        if (journalIdx <= eventIdx) journalIdx = -1;

        const batchPromises = [];
        let batch = window.db.batch();
        let opCount = 0;

        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            const dStr = row[dateIdx];
            if(!dStr || typeof dStr !== 'string' || !dStr.match(/^\d{4}-\d{2}-\d{2}$/)) continue;

            const evText = row[eventIdx] || "";
            const eventList = window.parseRawEventTextToEventList ? window.parseRawEventTextToEventList(evText) : [];
            batch.set(window.getUserCol('events').doc(dStr), { eventList: eventList, eventText: evText, updatedAt: Date.now() }, { merge: true });
            opCount++;

            const periodsData = {};
            let isSkipDay = eventList.some(ev => ev.labels && ev.labels.some(l => window.isSkipLabel && window.isSkipLabel(l)));

            let pNum = 1;
            let endPIdx = journalIdx !== -1 ? journalIdx : row.length;
            for(let p = eventIdx + 1; p < endPIdx; p++) {
                const pText = row[p] || "";
                let subj = "", memo = pText;
                const match = pText.match(/^\[(.*?)\]\s*([\s\S]*)$/);
                if(match) { subj = match[1]; memo = match[2]; }
                if(isSkipDay) subj = '';
                periodsData[pNum] = { subject: subj, memo: memo, supplies: "" };
                pNum++;
            }
            batch.set(window.getUserCol('schedules').doc(dStr), { periods: periodsData, updatedAt: Date.now() }, { merge: true });
            opCount++;

            const joText = journalIdx !== -1 ? (row[journalIdx] || "") : ""; 
            const joList = window.parseRawEventTextToEventList ? window.parseRawEventTextToEventList(joText) : [];
            batch.set(window.getUserCol('journals').doc(dStr), { entries: joList, updatedAt: Date.now() }, { merge: true });
            opCount++;

            if (opCount > 400) {
                batchPromises.push(batch.commit());
                batch = window.db.batch();
                opCount = 0;
            }
        }
        if(opCount > 0) batchPromises.push(batch.commit());
        await Promise.all(batchPromises);
    },

    processMemoRows: async function(rows) {
        if (rows.length < 2) return;
        const batchPromises = [];
        let batch = window.db.batch();
        let opCount = 0;
        let newLinks = [];

        for (let i=1; i<rows.length; i++) {
            const r = rows[i];
            if(r.length < 3 || !r[2]) continue; 
            
            const dataType = r[0] || 'MEMO';
            if (dataType === 'LINK') {
                newLinks.push({ name: r[2], url: r[5] });
            } else {
                let id = r[1] && !r[1].startsWith('LINK_') ? r[1] : window.getUserCol('tasks').doc().id; 
                const completed = r[3] === 'O';
                const labels = r[4] ? r[4].split(',').filter(x=>x.trim()) : [];
                const imageUrl = r[5] || '';
                const createdAt = parseInt(r[6], 10) || Date.now();

                batch.set(window.getUserCol('tasks').doc(id), {
                    text: r[2], completed: completed, labels: labels, imageUrl: imageUrl,
                    createdAt: createdAt, updatedAt: Date.now(), order: -createdAt 
                }, { merge: true });
                
                opCount++;
                if (opCount > 400) {
                    batchPromises.push(batch.commit());
                    batch = window.db.batch();
                    opCount = 0;
                }
            }
        }
        
        if (newLinks.length > 0) {
            const linkDoc = await window.getUserCol('settings').doc('user_links').get();
            let existingLinks = linkDoc.exists ? (linkDoc.data().links || []) : [];
            const mergedLinks = [...existingLinks, ...newLinks];
            batch.set(window.getUserCol('settings').doc('user_links'), { links: mergedLinks }, { merge: true });
            opCount++;
        }

        if(opCount > 0) batchPromises.push(batch.commit());
        await Promise.all(batchPromises);
    },

    // =========================================================================
    // ☁️ [Google Sheets API 동기화] - 스마트 병합 엔진 방어막 강화
    // =========================================================================
    getGoogleToken: function() {
        const token = sessionStorage.getItem('google_api_token');
        if (!token) alert("구글 연동 권한이 없거나 만료되었습니다.\n우측 상단의 '로그아웃' 후 다시 로그인하여 권한을 승인해주세요.");
        return token;
    },

    getOrCreateSpreadsheet: async function(token) {
        const configRef = window.getUserCol('settings').doc('backup_config');
        const doc = await configRef.get();
        let spreadsheetId = doc.exists ? doc.data().spreadsheetId : null;

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
                    sheets: [ { properties: { title: '일정기록' } }, { properties: { title: '메모링크' } } ]
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
            await configRef.set({ spreadsheetId });
        }
        return spreadsheetId;
    },

    exportToSheets: async function() {
        const token = this.getGoogleToken();
        if(!token) return;

        const btn = document.getElementById('btn-sheets-export');
        const oldText = btn.textContent;
        btn.textContent = "⏳ 내보내는 중..."; btn.disabled = true;

        try {
            const spreadsheetId = await this.getOrCreateSpreadsheet(token);
            const sheetName = this.currentTab === 'schedule' ? '일정기록' : '메모링크';
            
            const newRows = this.currentTab === 'schedule' ? await this.getScheduleDataArray() : await this.getMemoDataArray();
            const newHeader = newRows[0];
            const keyIdx = this.currentTab === 'schedule' ? 0 : 1; 

            let existingRows = [];
            try {
                const readRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName + '!A:Z')}`, {
                    method: 'GET', headers: { 'Authorization': `Bearer ${token}` }
                });
                if (readRes.ok) existingRows = (await readRes.json()).values || [];
            } catch (e) {}

            const mergedMap = {};
            let oldDateIdx = 0, oldEventIdx = 1, oldJournalIdx = -1;
            
            if (existingRows.length > 0) {
                const oldHeader = existingRows[0];
                oldDateIdx = oldHeader.indexOf("날짜") !== -1 ? oldHeader.indexOf("날짜") : 0;
                oldEventIdx = oldHeader.indexOf("일정") !== -1 ? oldHeader.indexOf("일정") :
