// js/modules/backup.js

window.BackupManager = {
    modal: null,
    currentTab: 'schedule',

    openModal: function() {
        if (!this.modal) {
            const html = `
            <div class="modal-info-box" style="background:#eff6ff; border-left-color:#3b82f6;">
                <p style="margin:0;"><strong>[데이터 백업/복원]</strong> 클라우드 데이터를 파일(CSV)이나 구글 시트로 백업/복원합니다.</p>
            </div>
            <div style="display:flex; gap:10px; margin-bottom:15px;">
                <button id="backup-tab-schedule" onclick="window.BackupManager.setTab('schedule')" style="flex:1; padding:10px; border:2px solid #3b82f6; background:#eff6ff; color:#1e40af; border-radius:8px; font-weight:bold; cursor:pointer;">📅 일정 및 기록</button>
                <button id="backup-tab-memo" onclick="window.BackupManager.setTab('memo')" style="flex:1; padding:10px; border:2px solid #cbd5e1; background:#f8fafc; color:#64748b; border-radius:8px; font-weight:bold; cursor:pointer;">📝 메모 / 문서·링크</button>
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
                    <button id="btn-sheets-import" onclick="window.BackupManager.importFromSheets()" class="modal-btn-secondary" style="flex:1; background:#fff; border: 2px solid #0f9d58; color:#0f9d58; font-size:1rem;">📗 구글 시트에서 복원</button>
                    <button id="btn-sheets-export" onclick="window.BackupManager.exportToSheets()" class="modal-btn-primary" style="flex:1; background:#0f9d58; font-size:1rem;">📗 구글 시트로 백업</button>
                </div>
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
    // 📥 [데이터 주입 모듈]
    // =========================================================================
    processScheduleRows: async function(rows) {
        if (rows.length < 2) return;
        const pNames = window.periodNames || ["1","2","3","4","5","6"];
        const pCount = pNames.length;
        const batchPromises = [];
        let batch = window.db.batch();
        let opCount = 0;

        for (let i=1; i<rows.length; i++) {
            const row = rows[i];
            const dStr = row[0];
            if(!dStr || !dStr.match(/^\d{4}-\d{2}-\d{2}$/)) continue;

            const evText = row[1] || "";
            const eventList = window.parseRawEventTextToEventList ? window.parseRawEventTextToEventList(evText) : [];
            batch.set(window.getUserCol('events').doc(dStr), { eventList: eventList, eventText: evText, updatedAt: Date.now() }, { merge: true });
            opCount++;

            const periodsData = {};
            let isSkipDay = eventList.some(ev => ev.labels && ev.labels.some(l => window.isSkipLabel && window.isSkipLabel(l)));

            for(let p=1; p<=pCount; p++) {
                const pText = row[1+p] || "";
                let subj = "", memo = pText;
                const match = pText.match(/^\[(.*?)\]\s*([\s\S]*)$/);
                if(match) { subj = match[1]; memo = match[2]; }
                if(isSkipDay) subj = '';
                periodsData[p] = { subject: subj, memo: memo, supplies: "" };
            }
            batch.set(window.getUserCol('schedules').doc(dStr), { periods: periodsData, updatedAt: Date.now() }, { merge: true });
            opCount++;

            const joText = row[pCount + 2] || ""; 
            const joList = window.parseRawEventTextToEventList ? window.parseRawEventTextToEventList(joText) : [];
            batch.set(window.getUserCol('journals').doc(dStr), { entries: joList, updatedAt: Date.now() }, { merge: true });
            opCount++;

            if (opCount > 400) {
                batchPromises.push(batch.commit());
                batch = window.db.batch();
                op
