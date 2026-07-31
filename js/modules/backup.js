// js/modules/backup.js

window.BackupManager = {
    modal: null,
    currentTab: 'schedule',

    openModal: function() {
        if (!this.modal) {
            const html = `
            <div class="modal-info-box" style="background:#eff6ff; border-left-color:#3b82f6;">
                <p style="margin:0;"><strong>[데이터 백업/복원]</strong> 클라우드 데이터를 엑셀(CSV) 파일로 저장하거나 복원합니다.</p>
            </div>
            <div style="display:flex; gap:10px; margin-bottom:15px;">
                <button id="backup-tab-schedule" onclick="window.BackupManager.setTab('schedule')" style="flex:1; padding:10px; border:2px solid #3b82f6; background:#eff6ff; color:#1e40af; border-radius:8px; font-weight:bold; cursor:pointer;">📅 일정 및 일지</button>
                <button id="backup-tab-memo" onclick="window.BackupManager.setTab('memo')" style="flex:1; padding:10px; border:2px solid #cbd5e1; background:#f8fafc; color:#64748b; border-radius:8px; font-weight:bold; cursor:pointer;">📝 메모 (체크리스트)</button>
            </div>

            <div id="backup-schedule-section">
                <label style="display:block; font-weight:bold; margin-bottom:5px; color:#475569;">백업/복원 기간 선택</label>
                <select id="backup-period-select" onchange="window.BackupManager.onPeriodChange()" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:6px; margin-bottom:15px; font-size:1rem; outline:none;">
                    <option value="sem1">1학기 (3월 ~ 8월 중순)</option>
                    <option value="sem2">2학기 (8월 중순 ~ 2월 말)</option>
                    <option value="year" selected>1학년도 전체 (3월 ~ 다음 해 2월)</option>
                    <option value="custom">직접 기간 설정</option>
                </select>

                <div id="backup-custom-date-section" style="display:none; gap:10px; align-items:center; margin-bottom:15px;">
                    <input type="date" id="backup-start-date" style="flex:1; padding:8px; border:1px solid #cbd5e1; border-radius:6px; outline:none;">
                    <span style="font-weight:bold; color:#64748b;">~</span>
                    <input type="date" id="backup-end-date" style="flex:1; padding:8px; border:1px solid #cbd5e1; border-radius:6px; outline:none;">
                </div>
            </div>

            <div id="backup-memo-section" style="display:none; margin-bottom:15px; padding:15px; background:#f1f5f9; border-radius:8px; border: 1px dashed #cbd5e1;">
                <p style="margin:0; color:#475569; font-size:0.95rem; line-height:1.5;">
                    저장된 <strong>모든 메모 데이터(라벨, 체크 여부, 첨부된 사진 URL 등)</strong>를 안전하게 추출합니다.<br><br>
                    * CSV 파일을 수정 후 업로드 시, 기존 메모는 유지되며 새로운 ID를 가진 메모들은 추가(병합)됩니다.
                </p>
            </div>

            <div style="display:flex; justify-content:space-between; gap:10px; margin-top:20px; padding-top:15px; border-top:1px solid #e2e8f0;">
                <input type="file" id="backup-upload-file" accept=".csv" style="display:none;" onchange="window.BackupManager.handleUpload(this)">
                <button onclick="document.getElementById('backup-upload-file').click()" class="modal-btn-secondary" style="flex:1; background:#fff; border-color:#10b981; color:#047857; font-size:1.05rem;">📤 파일에서 복원</button>
                <button id="btn-backup-download" onclick="window.BackupManager.handleDownload()" class="modal-btn-primary" style="flex:1; font-size:1.05rem;">📥 CSV 다운로드</button>
            </div>
            `;
            this.modal = new window.Modal({
                id: 'backup-modal-v5',
                title: '💾 데이터 통합 백업소',
                width: '500px',
                content: html
            });
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
            schSec.style.display = 'block';
            memoSec.style.display = 'none';
        } else {
            memoBtn.style.background = '#eff6ff'; memoBtn.style.borderColor = '#3b82f6'; memoBtn.style.color = '#1e40af';
            schBtn.style.background = '#f8fafc'; schBtn.style.borderColor = '#cbd5e1'; schBtn.style.color = '#64748b';
            schSec.style.display = 'none';
            memoSec.style.display = 'block';
        }
    },

    setDefaultDates: function() {
        const y = window.currentDate ? window.currentDate.getFullYear() : new Date().getFullYear();
        const m = window.currentDate ? window.currentDate.getMonth() + 1 : new Date().getMonth() + 1;
        const acYear = m <= 2 ? y - 1 : y;
        const lastDayFeb = new Date(acYear + 1, 2, 0).getDate();

        document.getElementById('backup-start-date').value = `${acYear}-03-01`;
        document.getElementById('backup-end-date').value = `${acYear + 1}-02-${lastDayFeb}`;
    },

    onPeriodChange: function() {
        const val = document.getElementById('backup-period-select').value;
        const customSec = document.getElementById('backup-custom-date-section');
        const startInput = document.getElementById('backup-start-date');
        const endInput = document.getElementById('backup-end-date');

        const y = window.currentDate ? window.currentDate.getFullYear() : new Date().getFullYear();
        const m = window.currentDate ? window.currentDate.getMonth() + 1 : new Date().getMonth() + 1;
        const acYear = m <= 2 ? y - 1 : y;
        const lastDayFeb = new Date(acYear + 1, 2, 0).getDate();

        if (val === 'custom') {
            customSec.style.display = 'flex';
        } else {
            customSec.style.display = 'none';
            if (val === 'sem1') {
                startInput.value = `${acYear}-03-01`;
                endInput.value = `${acYear}-08-15`;
            } else if (val === 'sem2') {
                startInput.value = `${acYear}-08-16`;
                endInput.value = `${acYear + 1}-02-${lastDayFeb}`;
            } else if (val === 'year') {
                startInput.value = `${acYear}-03-01`;
                endInput.value = `${acYear + 1}-02-${lastDayFeb}`;
            }
        }
    },

    escapeCSV: function(str) {
        if (str == null) return "";
        let s = String(str);
        if (s.includes('"') || s.includes(',') || s.includes('\n')) {
            s = '"' + s.replace(/"/g, '""') + '"';
        }
        return s;
    },

    parseCSV: function(csvText) {
        const rows = [];
        let row = [];
        let inQuotes = false;
        let val = '';
        for (let i = 0; i < csvText.length; i++) {
            let c = csvText[i];
            let nc = csvText[i+1];
            if (c === '"' && inQuotes && nc === '"') {
                val += '"'; i++;
            } else if (c === '"') {
                inQuotes = !inQuotes;
            } else if (c === ',' && !inQuotes) {
                row.push(val); val = '';
            } else if (c === '\n' && !inQuotes) {
                row.push(val); rows.push(row); row = []; val = '';
            } else if (c === '\r' && !inQuotes) {
            } else {
                val += c;
            }
        }
        if (val || row.length > 0) { row.push(val); rows.push(row); }
        return rows;
    },

    handleDownload: async function() {
        const btn = document.getElementById('btn-backup-download');
        const oldText = btn.textContent;
        btn.textContent = "⏳ 집계 중...";
        btn.disabled = true;

        try {
            if (this.currentTab === 'memo') {
                await this.downloadMemoCSV();
            } else {
                await this.downloadScheduleCSV();
            }
        } catch (e) {
            console.error(e);
            alert("다운로드 중 오류가 발생했습니다.");
        } finally {
            btn.textContent = oldText;
            btn.disabled = false;
        }
    },

    handleUpload: async function(input) {
        const file = input.files[0];
        if (!file) return;
        
        if(!confirm(`선택하신 파일(${file.name})로 복원을 진행하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) {
            input.value = ''; return;
        }

        const btn = input.nextElementSibling;
        const oldText = btn.textContent;
        btn.textContent = "⏳ 업로드 적용 중...";
        btn.disabled = true;

        try {
            if (this.currentTab === 'memo') {
                await this.uploadMemoCSV(file);
            } else {
                await this.uploadScheduleCSV(file);
            }
            alert("데이터가 성공적으로 복원되었습니다!");
            this.modal.close();
            if(window.render) window.render();
        } catch (e) {
            console.error(e);
            alert("업로드 처리 중 오류가 발생했습니다.");
        } finally {
            btn.textContent = oldText;
            btn.disabled = false;
            input.value = ''; 
        }
    },

    downloadScheduleCSV: async function() {
        let startStr = document.getElementById('backup-start-date').value;
        let endStr = document.getElementById('backup-end-date').value;
        if (!startStr || !endStr) return alert("시작일과 종료일을 올바르게 설정해 주세요.");

        const eventsSnap = await window.getUserCol('events').where(firebase.firestore.FieldPath.documentId(), '>=', startStr).where(firebase.firestore.FieldPath.documentId(), '<=', endStr).get();
        const schedSnap = await window.getUserCol('schedules').where(firebase.firestore.FieldPath.documentId(), '>=', startStr).where(firebase.firestore.FieldPath.documentId(), '<=', endStr).get();
        const jourSnap = await window.getUserCol('journals').where(firebase.firestore.FieldPath.documentId(), '>=', startStr).where(firebase.firestore.FieldPath.documentId(), '<=', endStr).get();

        const evMap = {}; eventsSnap.forEach(d => evMap[d.id] = d.data());
        const scMap = {}; schedSnap.forEach(d => scMap[d.id] = d.data());
        const joMap = {}; jourSnap.forEach(d => joMap[d.id] = d.data());

        const pNames = window.periodNames || ["1","2","3","4","5","6"];
        let csvContent = "\uFEFF날짜,일정," + pNames.join(",") + ",일지\n"; 

        let curr = new Date(startStr);
        const end = new Date(endStr);
        
        while(curr <= end) {
            const dStr = window.formatDate(curr);
            let row = [dStr];

            let evText = "";
            if (evMap[dStr]) {
                const list = evMap[dStr].eventList;
                if (list && list.length > 0) {
                    evText = list.map(e => `[${(e.labels||[]).join(' ')}] ${e.content}`).join('\n');
                } else if (evMap[dStr].eventText) {
                    evText = evMap[dStr].eventText;
                }
            }
            row.push(this.escapeCSV(evText));

            const periods = scMap[dStr] ? (scMap[dStr].periods || {}) : {};
            for(let p=1; p<=pNames.length; p++) {
                const pData = periods[p] || {};
                let pText = pData.subject ? `[${pData.subject}] ` : "";
                if(pData.memo) pText += pData.memo;
                row.push(this.escapeCSV(pText.trim()));
            }

            let joText = "";
            if (joMap[dStr]) {
                const entries = joMap[dStr].entries || [];
                joText = entries.map(j => `[${(j.labels||[]).join(' ')}] ${j.content}`).join('\n');
            }
            row.push(this.escapeCSV(joText));

            csvContent += row.join(',') + "\n";
            curr.setDate(curr.getDate() + 1);
        }

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `업무계획표_일정백업_${startStr}_${endStr}.csv`;
        link.click();
    },

    downloadMemoCSV: async function() {
        const snap = await window.getUserCol('tasks').orderBy('createdAt').get();
        let csvContent = "\uFEFF메모ID,메모내용,완료여부(O/X),라벨,첨부이미지주소,생성일자(타임스탬프)\n";
        
        snap.forEach(doc => {
            const d = doc.data();
            let row = [
                doc.id,
                this.escapeCSV(d.text || ''),
                d.completed ? 'O' : 'X',
                this.escapeCSV((d.labels || []).join(',')),
                this.escapeCSV(d.imageUrl || ''),
                d.createdAt || Date.now()
            ];
            csvContent += row.join(',') + "\n";
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `업무계획표_메모체크리스트_전체백업.csv`;
        link.click();
    },

    uploadScheduleCSV: function(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const csvText = e.target.result;
                    const rows = this.parseCSV(csvText);
                    if (rows.length < 2) return resolve();

                    const pNames = window.periodNames || ["1","2","3","4","5","6"];
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
                        let isSkipDay = eventList.some(ev => ev.labels && ev.labels.some(l => window.isSkipLabel(l)));

                        for(let p=1; p<=pNames.length; p++) {
                            const pText = row[1+p] || "";
                            let subj = "", memo = pText;
                            const match = pText.match(/^\[(.*?)\]\s*([\s\S]*)$/);
                            if(match) { subj = match[1]; memo = match[2]; }
                            if(isSkipDay) subj = '';
                            periodsData[p] = { subject: subj, memo: memo, supplies: "" };
                        }
                        batch.set(window.getUserCol('schedules').doc(dStr), { periods: periodsData, updatedAt: Date.now() }, { merge: true });
                        opCount++;

                        const joText = row[row.length - 1] || ""; 
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
                    resolve();
                } catch(err) { reject(err); }
            };
            reader.readAsText(file);
        });
    },

    uploadMemoCSV: function(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const csvText = e.target.result;
                    const rows = this.parseCSV(csvText);
                    if (rows.length < 2) return resolve();

                    const batchPromises = [];
                    let batch = window.db.batch();
                    let opCount = 0;

                    for (let i=1; i<rows.length; i++) {
                        const r = rows[i];
                        if(r.length < 2 || !r[1]) continue; 
                        
                        let id = r[0] || window.getUserCol('tasks').doc().id; 
                        const completed = r[2] === 'O';
                        const labels = r[3] ? r[3].split(',').filter(x=>x.trim()) : [];
                        const imageUrl = r[4] || '';
                        const createdAt = parseInt(r[5], 10) || Date.now();

                        batch.set(window.getUserCol('tasks').doc(id), {
                            text: r[1],
                            completed: completed,
                            labels: labels,
                            imageUrl: imageUrl,
                            createdAt: createdAt,
                            updatedAt: Date.now(),
                            order: -createdAt 
                        }, { merge: true });
                        
                        opCount++;
                        if (opCount > 400) {
                            batchPromises.push(batch.commit());
                            batch = window.db.batch();
                            opCount = 0;
                        }
                    }
                    if(opCount > 0) batchPromises.push(batch.commit());
                    await Promise.all(batchPromises);
                    resolve();
                } catch(err) { reject(err); }
            };
            reader.readAsText(file);
        });
    }
};
