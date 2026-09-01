// js/modules/backup.js
import { dbAPI } from '../api/database.js'; 
import { getSemesterDates, formatDate } from '../core/utils.js';
import { store } from '../core/store.js';
import { BackupLocal } from './backupLocal.js';
import { BackupGoogle } from './backupGoogle.js';

export const BackupManager = {
    modal: null,
    myGroups: [],

    openModal: async function() {
        const existing = document.getElementById('backup-modal-v15');
        if (existing) existing.remove();

        try {
            const api = dbAPI || window.dbAPI;
            this.myGroups = api ? await api.loadMyGroups() : [];
        } catch(e) {
            this.myGroups = [];
        }

        const html = this.getModalHtml();
        this.modal = new window.Modal({ id: 'backup-modal-v15', title: '내보내기/가져오기 통합 관리', width: '560px', content: html });
        this.modal.open();
        
        this.setDefaultDates();
        BackupGoogle.checkExistingSheet(); 
        setTimeout(() => this.onScopeChange(), 50);
    },

    getModalHtml: function() {
        const groupOptions = this.myGroups.map(g => `<option value="${g.id}">👥 공유 그룹: ${g.name}</option>`).join('');

        return `
        <div style="display:flex; flex-direction:column; gap:18px; max-height:65vh; overflow-y:auto; padding-right:5px; margin-bottom:15px;">
            <div class="modal-info-box" style="background:#eff6ff; border-left-color:#3b82f6; margin-bottom:0;">
                <p style="margin:0;"><strong>[데이터 안전 관리]</strong> 개인 및 소속된 그룹 데이터를 선택하여 안전하게 동기화할 수 있습니다.</p>
            </div>
            <div>
                <label style="display:block; font-weight:bold; margin-bottom:6px; color:#1e40af; font-size:1.05rem;">1. 동기화 대상 공간</label>
                <div style="background:#f8fafc; padding:15px; border-radius:8px; border:1px solid #e2e8f0;">
                    <select id="backup-scope-select" onchange="window.BackupManager.onScopeChange()" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:6px; font-size:1rem; outline:none; cursor:pointer; font-weight:bold; color:#334155;">
                        <option value="personal" selected>🔒 개인 데이터</option>
                        ${groupOptions}
                    </select>
                </div>
            </div>
            <div>
                <label style="display:block; font-weight:bold; margin-bottom:6px; color:#1e40af; font-size:1.05rem;">2. 기간 선택</label>
                <div style="display:flex; flex-direction:column; gap:10px; background:#f8fafc; padding:15px; border-radius:8px; border:1px solid #e2e8f0;">
                    <select id="backup-period-select" onchange="window.BackupManager.onPeriodChange()" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:6px; font-size:1rem; outline:none; cursor:pointer; font-weight:bold; color:#334155;">
                        <option value="today" selected>오늘</option>
                        <option value="week">해당 주 (이번 주)</option>
                        <option value="month">해당 월 (이번 달)</option>
                        <option value="sem1">1학기 전체</option>
                        <option value="sem2">2학기 전체</option>
                        <option value="year">해당 학년도 전체</option>
                        <option value="custom">기간 직접 설정</option>
                    </select>
                    <div style="display:flex; gap:10px; align-items:center; justify-content:center; margin-top:5px;">
                        <input type="date" id="backup-start-date" style="flex:1; padding:8px; border:1px solid #cbd5e1; border-radius:6px; outline:none; color:#334155;" disabled>
                        <span style="font-weight:bold; color:#64748b;">~</span>
                        <input type="date" id="backup-end-date" style="flex:1; padding:8px; border:1px solid #cbd5e1; border-radius:6px; outline:none; color:#334155;" disabled>
                    </div>
                    <!-- 💡 추가됨: 공휴일 가져오기 버튼 -->
                    <div style="margin-top:5px; text-align:right;">
                        <button onclick="window.executeHolidayImport(document.getElementById('backup-start-date').value, document.getElementById('backup-end-date').value, document.getElementById('backup-scope-select').value)" style="padding:6px 12px; font-size:0.9rem; background:#fee2e2; color:#ef4444; border:1px solid #fca5a5; border-radius:6px; font-weight:bold; cursor:pointer; transition:0.2s;">🇰🇷 해당 기간 공휴일 가져오기</button>
                    </div>
                </div>
            </div>
            <div>
                <label style="display:block; font-weight:bold; margin-bottom:6px; color:#1e40af; font-size:1.05rem;">3. 대상 정보</label>
                <div style="display:flex; flex-wrap:wrap; gap:15px; background:#f8fafc; padding:12px 15px; border-radius:8px; border:1px solid #e2e8f0; font-weight:bold; color:#1e293b;">
                    <label style="cursor:pointer;"><input type="checkbox" id="backup-chk-event" checked style="accent-color:#3b82f6;"> 일정</label>
                    <label style="cursor:pointer;"><input type="checkbox" id="backup-chk-class" checked style="accent-color:#10b981;"> 수업</label>
                    <label style="cursor:pointer;"><input type="checkbox" id="backup-chk-journal" checked style="accent-color:#ec4899;"> 기록</label>
                    <label style="cursor:pointer;"><input type="checkbox" id="backup-chk-eval" checked style="accent-color:#f59e0b;"> 조사표</label>
                    <label style="cursor:pointer;"><input type="checkbox" id="backup-chk-memo" checked style="accent-color:#64748b;"> 메모/링크</label>
                </div>
            </div>
            <div>
                <label style="display:block; font-weight:bold; margin-bottom:6px; color:#1e40af; font-size:1.05rem;">4. 동기화 방식 (가져오기/내보내기)</label>
                <div style="background:#fef2f2; padding:15px; border-radius:8px; border:1px solid #fca5a5;">
                    <label style="display:flex; align-items:flex-start; gap:8px; margin-bottom:12px; cursor:pointer;">
                        <input type="radio" name="import-mode" value="merge" checked style="margin-top:3px; accent-color:#059669;">
                        <div>
                            <span style="font-weight:bold; color:#059669; font-size:0.95rem;">병합 (기존 데이터 보호 및 최신화)</span><br>
                            <span style="font-size:0.8rem; color:#64748b;">기존에 작성된 데이터는 유지하면서 추가/수정된 내용만 반영합니다.</span>
                        </div>
                    </label>
                    <label style="display:flex; align-items:flex-start; gap:8px; cursor:pointer;">
                        <input type="radio" name="import-mode" value="overwrite" style="margin-top:3px; accent-color:#ef4444;">
                        <div>
                            <span style="font-weight:bold; color:#ef4444; font-size:0.95rem;">완전 교체 (모두 지우고 덮어쓰기)</span><br>
                            <span style="font-size:0.8rem; color:#64748b;">선택된 기간의 데이터를 모두 지우고 외부 데이터로 완전히 교체합니다.</span>
                        </div>
                    </label>
                    <div style="margin-top:8px; font-size:0.75rem; color:#94a3b8; border-top: 1px dashed #fca5a5; padding-top:6px;">
                        ※ 로컬(CSV) 내보내기는 위 옵션과 무관하게 항상 전체 데이터를 담은 새 파일로 저장됩니다.
                    </div>
                </div>
            </div>
            <div>
                <label style="display:block; font-weight:bold; margin-bottom:6px; color:#1e40af; font-size:1.05rem;">5. 대상 (플랫폼)</label>
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
                <div id="backup-sheet-direct-link" style="display:none; text-align:center; margin-top:10px;">
                    <button onclick="window.BackupManager.openCurrentSheet()" style="padding:6px 15px; font-size:0.9rem; background:#f0fdf4; color:#166534; border:1px solid #bbf7d0; border-radius:6px; font-weight:bold; cursor:pointer; transition:0.2s; display:inline-flex; align-items:center; gap:6px;"><span style="font-size:1.1rem;">🔗</span> 내 구글 시트 백업본 바로 열기</button>
                </div>
            </div>
        </div>
        <div style="display:flex; gap:10px; border-top: 2px solid #e2e8f0; padding-top: 15px;">
            <input type="file" id="backup-upload-file" accept=".csv" style="display:none;" onchange="window.BackupManager.handleUpload(this)">
            <button id="btn-master-import" onclick="window.BackupManager.executeImport()" style="flex:1; padding:12px; font-size:1.1rem; border:2px solid #3b82f6; background:#fff; color:#3b82f6; border-radius:8px; font-weight:bold; cursor:pointer; transition:0.2s;">📥 가져오기</button>
            <button id="btn-master-export" onclick="window.BackupManager.executeExport()" style="flex:1; padding:12px; font-size:1.1rem; border:none; background:#3b82f6; color:#fff; border-radius:8px; font-weight:bold; cursor:pointer; transition:0.2s;">📤 내보내기</button>
        </div>
        `;
    },

    getOptions: function() {
        return {
            scope: document.getElementById('backup-scope-select').value,
            val: document.getElementById('backup-period-select').value,
            startStr: document.getElementById('backup-start-date').value,
            endStr: document.getElementById('backup-end-date').value,
            incEvent: document.getElementById('backup-chk-event').checked,
            incClass: document.getElementById('backup-chk-class').checked,
            incJournal: document.getElementById('backup-chk-journal').checked,
            incEval: document.getElementById('backup-chk-eval').checked,
            incMemo: document.getElementById('backup-chk-memo').checked,
            mode: document.querySelector('input[name="import-mode"]:checked')?.value || 'merge'
        };
    },

    onScopeChange: function() {
        const scope = document.getElementById('backup-scope-select').value;
        const targetRadios = document.querySelectorAll('input[name="backup-target"]');
        const targetCards = document.querySelectorAll('.target-card');
        const sheetLink = document.getElementById('backup-sheet-direct-link');
        
        if (scope !== 'personal') {
            document.querySelector('input[name="backup-target"][value="csv"]').checked = true;
            targetRadios.forEach(r => { if (r.value !== 'csv') r.disabled = true; });
            targetCards.forEach(c => {
                if (c.id !== 'target-card-csv') {
                    c.style.opacity = '0.4'; c.style.cursor = 'not-allowed';
                    c.style.borderColor = '#cbd5e1'; c.style.background = '#f8fafc'; c.style.color = '#64748b';
                }
            });
            if(sheetLink) sheetLink.style.display = 'none';
        } else {
            targetRadios.forEach(r => r.disabled = false);
            targetCards.forEach(c => { c.style.opacity = '1'; c.style.cursor = 'pointer'; });
            BackupGoogle.checkExistingSheet(); 
        }
        this.onTargetChange();
    },

    onTargetChange: function() {
        const target = document.querySelector('input[name="backup-target"]:checked').value;
        const cCard = document.getElementById('target-card-calendar');
        const sCard = document.getElementById('target-card-sheets');
        const fCard = document.getElementById('target-card-csv');
        const sheetLink = document.getElementById('backup-sheet-direct-link');

        if(cCard && !cCard.style.cursor.includes('not-allowed')) { cCard.style.borderColor = '#cbd5e1'; cCard.style.background = '#f8fafc'; cCard.style.color = '#64748b'; }
        if(sCard && !sCard.style.cursor.includes('not-allowed')) { sCard.style.borderColor = '#cbd5e1'; sCard.style.background = '#f8fafc'; sCard.style.color = '#64748b'; }
        if(fCard && !fCard.style.cursor.includes('not-allowed')) { fCard.style.borderColor = '#cbd5e1'; fCard.style.background = '#f8fafc'; fCard.style.color = '#64748b'; }
        
        if(sheetLink) sheetLink.style.display = 'none';

        if (target === 'calendar' && cCard && !cCard.style.cursor.includes('not-allowed')) {
            cCard.style.borderColor = '#ea4335'; cCard.style.background = '#fce8e6'; cCard.style.color = '#ea4335';
        } else if (target === 'sheets' && sCard && !sCard.style.cursor.includes('not-allowed')) {
            sCard.style.borderColor = '#0f9d58'; sCard.style.background = '#e8f5e9'; sCard.style.color = '#0f9d58';
            if(BackupGoogle.currentSpreadsheetId && sheetLink) sheetLink.style.display = 'block'; 
        } else if (target === 'csv' && fCard) {
            fCard.style.borderColor = '#475569'; fCard.style.background = '#f1f5f9'; fCard.style.color = '#475569';
        }
    },

    openCurrentSheet: function() {
        if (BackupGoogle.currentSpreadsheetId) {
            window.open(`https://docs.google.com/spreadsheets/d/${BackupGoogle.currentSpreadsheetId}/edit`, '_blank');
        } else {
            alert("연결된 시트가 없습니다. 먼저 내보내기를 진행해주세요.");
        }
    },

    executeExport: async function() {
        const target = document.querySelector('input[name="backup-target"]:checked').value;
        const options = this.getOptions();
        const scopeName = options.scope === 'personal' ? '개인' : (this.myGroups.find(g => g.id === options.scope)?.name || '그룹');

        if (!options.incEvent && !options.incClass && !options.incJournal && !options.incEval && !options.incMemo) {
            return alert("내보낼 대상을 최소 하나 이상 선택해주세요.");
        }

        try {
            if (target === 'csv') await BackupLocal.exportToCSV(options);
            else if (target === 'sheets') await BackupGoogle.exportToSheets(options);
            else if (target === 'calendar') await BackupGoogle.exportToCalendar(options);
            
            setTimeout(() => { alert(`[${scopeName}] 내보내기가 완료되었습니다.`); }, 500);
        } catch(e) {
            console.error("내보내기 에러:", e);
            alert("내보내기 중 오류가 발생했습니다.\n" + e.message);
        }
    },

    executeImport: async function() {
        const target = document.querySelector('input[name="backup-target"]:checked').value;
        const options = this.getOptions();
        
        if (!options.incEvent && !options.incClass && !options.incJournal && !options.incEval && !options.incMemo) {
            return alert("가져올 대상을 최소 하나 이상 선택해주세요.");
        }

        if (target === 'calendar') return alert("구글 캘린더에서 앱으로 가져오기는 지원하지 않습니다.");
        
        if (target === 'csv') {
            document.getElementById('backup-upload-file').click();
            return;
        }

        if (target === 'sheets') {
            if (!BackupGoogle.currentSpreadsheetId) {
                return alert("연결된 구글 시트 백업본을 찾을 수 없습니다.");
            }
            if(confirm("구글 시트의 백업 데이터를 불러와 현재 앱에 덮어쓰거나 병합하시겠습니까?\n이 작업은 취소할 수 없습니다.")) {
                try {
                    await BackupGoogle.importFromSheets(options);
                    alert("구글 시트에서 가져오기가 완료되었습니다.\n새로고침 됩니다.");
                    window.location.reload();
                } catch(e) {
                    console.error("시트 가져오기 에러:", e);
                    alert("가져오기 중 오류가 발생했습니다.\n" + e.message);
                }
            }
        }
    },

    handleUpload: function(inputEl) {
        if (!inputEl.files || inputEl.files.length === 0) return;
        const file = inputEl.files[0];
        const options = this.getOptions();
        
        if(confirm(`선택한 CSV 파일(${file.name})의 데이터를 불러오시겠습니까?`)) {
            BackupLocal.importFromCSV(file, options).then(() => {
                alert("CSV 가져오기가 완료되었습니다.\n새로고침 됩니다.");
                window.location.reload();
            }).catch(e => {
                console.error("CSV 업로드 에러:", e);
                alert("CSV 업로드 중 오류가 발생했습니다.\n" + e.message);
            });
        }
        inputEl.value = '';
    },

    setDefaultDates: function() {
        const today = new Date();
        const start = document.getElementById('backup-start-date');
        const end = document.getElementById('backup-end-date');
        if(start && end) {
            start.value = formatDate(today);
            end.value = formatDate(today);
        }
    },

    onPeriodChange: function() {
        const val = document.getElementById('backup-period-select').value;
        const start = document.getElementById('backup-start-date');
        const end = document.getElementById('backup-end-date');
        const today = new Date();

        start.disabled = true; end.disabled = true;

        if (val === 'today') {
            start.value = formatDate(today); end.value = formatDate(today);
        } else if (val === 'week') {
            const d1 = new Date(today); d1.setDate(d1.getDate() - d1.getDay());
            const d2 = new Date(today); d2.setDate(d2.getDate() - d2.getDay() + 6);
            start.value = formatDate(d1); end.value = formatDate(d2);
        } else if (val === 'month') {
            const d1 = new Date(today.getFullYear(), today.getMonth(), 1);
            const d2 = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            start.value = formatDate(d1); end.value = formatDate(d2);
        } else if (val === 'year') {
            const d1 = new Date(today.getFullYear(), 2, 1);
            const d2 = new Date(today.getFullYear() + 1, 1, 28);
            start.value = formatDate(d1); end.value = formatDate(d2);
        } else if (val.startsWith('sem')) {
            const config = store.semesterConfig || {};
            const dates = getSemesterDates(val === 'sem1' ? 1 : 2, config);
            start.value = dates.start; end.value = dates.end;
        } else if (val === 'custom') {
            start.disabled = false; end.disabled = false;
        }
    }
};

window.BackupManager = BackupManager;
