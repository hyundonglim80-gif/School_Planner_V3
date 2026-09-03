// js/modules/linker.js
import { dbAPI, getUserCol, getGroupCol } from '../api/database.js';
import { store } from '../core/store.js';
import { formatDate, getSemesterDates } from '../core/utils.js';
import { fetchCalendarData } from '../core/calendarDataManager.js';
import { doc, getDoc, setDoc } from "firebase/firestore";

export const LinkManager = {
    modal: null,
    viewerModal: null,
    sourceData: null, 
    
    currentTab: 'event', 
    tabData: { event: [], journal: [], memo: [] }, 
    selectedLinks: [], 
    
    currentPage: 1,
    itemsPerPage: 8, 

    openModal: async function(sourceType, dateStr, sourceId, fId, sourcePeriod = '') {
        this.sourceData = { type: sourceType, dateStr, id: sourceId, fId, period: sourcePeriod };
        this.selectedLinks = [];
        this.tabData = { event: [], journal: [], memo: [] };
        this.currentPage = 1;
        this.currentTab = 'event';

        if (this.modal) {
            this.modal.close();
            this.modal = null;
        } else {
            const existingModal = document.getElementById('linker-modal');
            if (existingModal) existingModal.remove();
        }

        this.modal = new window.Modal({
            id: 'linker-modal',
            title: '🔗 새 데이터 연결하기 (다중 선택 가능)',
            width: '600px',
            content: this.getModalHtml()
        });
        
        this.modal.open();
        this.switchTab('event'); 
        
        const periodSelect = document.getElementById('linker-period-select');
        if (periodSelect) periodSelect.value = '1month';
        
        this.updateDateRangeUI();
        await this.fetchMemoData();
        await this.fetchDateRangeData(); 
    },

    getModalHtml: function() {
        let sourcePeriodHtml = '';
        if (this.sourceData.type === 'schedule_header') {
            sourcePeriodHtml = `
                <div style="background:#eff6ff; padding:12px; border-radius:8px; border:1px solid #bfdbfe; margin-bottom:15px; display:flex; align-items:center; gap:10px;">
                    <span style="font-weight:bold; color:#1e40af;">📌 링크를 추가할 교시:</span>
                    <select id="linker-source-period" class="eval-input" style="width:120px; padding:6px;">
                        ${[1,2,3,4,5,6].map(p => `<option value="${p}">${p}교시</option>`).join('')}
                    </select>
                </div>
            `;
        }

        return `
            <div style="display:flex; flex-direction:column; max-height:75vh; padding-right:5px;">
                ${sourcePeriodHtml}
                <div style="display:flex; gap:5px; margin-bottom:15px;">
                    <button class="linker-tab-btn active" id="tab-event" onclick="window.LinkManager.switchTab('event')">📌 일정</button>
                    <button class="linker-tab-btn" id="tab-schedule" onclick="window.LinkManager.switchTab('schedule')">🏫 수업</button>
                    <button class="linker-tab-btn" id="tab-journal" onclick="window.LinkManager.switchTab('journal')">📔 기록</button>
                    <button class="linker-tab-btn" id="tab-memo" onclick="window.LinkManager.switchTab('memo')">📝 메모</button>
                </div>

                <style>
                    .linker-tab-btn { flex:1; padding:10px; font-weight:bold; border-radius:8px; border:1px solid #cbd5e1; background:#f8fafc; color:#64748b; cursor:pointer; transition:0.2s; }
                    .linker-tab-btn.active { background:#eff6ff; color:#1e40af; border-color:#3b82f6; box-shadow:0 2px 4px rgba(59,130,246,0.1); }
                </style>

                <div id="linker-tab-content" style="flex:1; display:flex; flex-direction:column; gap:10px; min-height:350px;"></div>

                <div style="margin-top:15px; padding:12px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px;">
                    <div style="font-weight:bold; font-size:0.9rem; color:#475569; margin-bottom:8px;">🛒 선택된 연결 항목 (<span id="linker-selected-count">0</span>)</div>
                    <div id="linker-selected-tray" style="display:flex; flex-wrap:wrap; gap:6px;">
                        <span style="color:#94a3b8; font-size:0.85rem;">선택된 항목이 없습니다.</span>
                    </div>
                </div>
            </div>
            
            <div class="modal-footer-actions" style="margin-top:20px; display:flex; gap:10px; justify-content:flex-end;">
                <button onclick="window.LinkManager.closeModal()" class="modal-btn-secondary" style="padding:10px 24px; font-size:1rem; font-weight:bold;">닫기</button>
                <button onclick="window.LinkManager.saveLinks()" class="modal-btn-primary" style="padding:10px 24px; font-size:1rem; font-weight:bold;">연결 저장</button>
            </div>
        `;
    },

    closeModal: function() {
        if (this.modal) {
            this.modal.close();
            this.modal = null;
        } else {
            const modal = document.getElementById('linker-modal');
            if (modal) modal.remove();
            if (window.decreaseModalCount) window.decreaseModalCount();
        }
        if (typeof window.render === 'function') {
            window.render(); 
        }
    },

    switchTab: function(tab) {
        this.currentTab = tab;
        this.currentPage = 1;
        document.querySelectorAll('.linker-tab-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById(`tab-${tab}`).classList.add('active');
        this.renderTabContent();
    },

    updateDateRangeUI: function() {
        const val = document.getElementById('linker-period-select')?.value;
        const customDiv = document.getElementById('linker-custom-date-div');
        if (customDiv) customDiv.style.display = val === 'custom' ? 'flex' : 'none';
    },

    fetchMemoData: async function() {
        try {
            let allMemos = await dbAPI.loadMemos() || [];
            allMemos.forEach(m => m.fId = 'personal'); 
            
            const myGroups = await dbAPI.loadMyGroups() || [];
            for (const group of myGroups) {
                const groupMemos = await dbAPI.loadGroupMemos(group.id) || [];
                groupMemos.forEach(m => m.fId = group.id);
                allMemos = allMemos.concat(groupMemos);
            }
            
            this.tabData.memo = allMemos.map(m => ({ 
                id: m.firestoreId, 
                title: m.text, 
                date: formatDate(new Date(m.createdAt || Date.now())), 
                type: 'memo',
                fId: m.fId
            })).sort((a,b) => b.date.localeCompare(a.date));
        } catch (e) { console.warn(e); }
    },

    fetchDateRangeData: async function() {
        const periodSelect = document.getElementById('linker-period-select');
        if (!periodSelect) return;
        const val = periodSelect.value;
        const today = new Date();
        let startStr = '', endStr = '';

        if (val === '1month') {
            const past = new Date(); past.setDate(today.getDate() - 30);
            const future = new Date(); future.setDate(today.getDate() + 30);
            startStr = formatDate(past); endStr = formatDate(future);
        } else if (val === 'sem1') {
            const dates = getSemesterDates(1, store.semesterConfig);
            startStr = dates.start; endStr = dates.end;
        } else if (val === 'sem2') {
            const dates = getSemesterDates(2, store.semesterConfig);
            startStr = dates.start; endStr = dates.end;
        } else if (val === 'year') {
            startStr = `${today.getFullYear()}-03-01`; endStr = `${today.getFullYear()+1}-02-28`;
        } else if (val === 'custom') {
            startStr = document.getElementById('linker-custom-start').value;
            endStr = document.getElementById('linker-custom-end').value;
        }

        if (!startStr || !endStr) return;

        document.getElementById('linker-list-area').innerHTML = `<div style="text-align:center; padding:30px; color:#3b82f6; font-weight:bold;">데이터를 불러오는 중...⏳</div>`;

        try {
            const myGroups = await dbAPI.loadMyGroups() || [];
            const { eMap, jMap } = await fetchCalendarData(startStr, endStr, myGroups);
            
            let events = [], journals = [];
            const fId = this.sourceData.fId;

            Object.keys(eMap).forEach(dStr => {
                const fEvents = (eMap[dStr].eventList || []).filter(e => (e.sharedGroupId || 'personal') === fId);
                fEvents.forEach(e => {
                    const eId = e.id || ('ev_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5));
                    if(e.content?.trim()) events.push({ id: eId, title: e.content, date: dStr, type: 'event', fId: fId });
                });
            });

            Object.keys(jMap).forEach(dStr => {
                const fJournals = jMap[dStr]?.[fId] || []; 
                fJournals.forEach(j => {
                    const jId = j.id || ('jr_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5));
                    if(j.content?.trim()) journals.push({ id: jId, title: j.content, date: dStr, type: 'journal', fId: fId });
                });
            });

            this.tabData.event = events.sort((a,b) => b.date.localeCompare(a.date));
            this.tabData.journal = journals.sort((a,b) => b.date.localeCompare(a.date));

            this.currentPage = 1;
            this.renderListArea();
        } catch (e) {
            document.getElementById('linker-list-area').innerHTML = `<div style="text-align:center; color:#ef4444;">오류가 발생했습니다.</div>`;
        }
    },

    renderTabContent: function() {
        const contentDiv = document.getElementById('linker-tab-content');
        
        if (this.currentTab === 'schedule') {
            contentDiv.innerHTML = `
                <div style="background:#f8fafc; padding:20px; border:1px solid #cbd5e1; border-radius:8px;">
                    <h4 style="margin-top:0; color:#0f766e; margin-bottom:15px;">🏫 수업 지정하여 연결</h4>
                    <div style="display:flex; gap:10px; margin-bottom:15px;">
                        <div style="flex:1;">
                            <label style="font-size:0.85rem; font-weight:bold; color:#475569; display:block; margin-bottom:4px;">날짜</label>
                            <input type="date" id="linker-schedule-date" value="${formatDate(new Date())}" class="eval-input" style="padding:8px 10px;">
                        </div>
                        <div style="flex:1;">
                            <label style="font-size:0.85rem; font-weight:bold; color:#475569; display:block; margin-bottom:4px;">교시</label>
                            <select id="linker-schedule-period" class="eval-input" style="padding:8px 10px;">
                                ${[1,2,3,4,5,6].map(p => `<option value="${p}">${p}교시</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    <button onclick="window.LinkManager.addScheduleLink()" style="width:100%; padding:10px; background:#10b981; color:#fff; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">이 교시를 장바구니에 담기 ⬇️</button>
                </div>
            `;
            return;
        }

        const isMemo = this.currentTab === 'memo';
        const dateFilterHtml = isMemo ? '' : `
            <div style="display:flex; gap:8px; align-items:center;">
                <select id="linker-period-select" onchange="window.LinkManager.updateDateRangeUI()" style="padding:8px; border:1px solid #cbd5e1; border-radius:6px; outline:none; font-weight:bold; color:#334155;">
                    <option value="1month">최근 ±1개월</option>
                    <option value="sem1">1학기 전체</option>
                    <option value="sem2">2학기 전체</option>
                    <option value="year">학년도 전체</option>
                    <option value="custom">직접 지정</option>
                </select>
                <div id="linker-custom-date-div" style="display:none; gap:5px; align-items:center;">
                    <input type="date" id="linker-custom-start" class="eval-input" style="padding:6px;"> ~ 
                    <input type="date" id="linker-custom-end" class="eval-input" style="padding:6px;">
                </div>
                <button onclick="window.LinkManager.fetchDateRangeData()" class="modal-btn-secondary" style="padding:8px 12px;">조회</button>
            </div>
        `;

        contentDiv.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:10px;">
                ${dateFilterHtml}
                <div><input type="text" id="linker-search" placeholder="키워드로 목록 내 검색..." onkeyup="window.LinkManager.currentPage=1; window.LinkManager.renderListArea()" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:6px; outline:none; box-sizing:border-box;"></div>
            </div>
            <div id="linker-list-area" style="flex:1; display:flex; flex-direction:column; border:1px solid #e2e8f0; border-radius:6px; background:#fff; overflow:hidden;"></div>
        `;
        this.renderListArea();
    },

    renderListArea: function() {
        const area = document.getElementById('linker-list-area');
        if (!area) return;

        const keyword = (document.getElementById('linker-search')?.value || '').toLowerCase();
        let items = this.tabData[this.currentTab] || [];
        
        if (keyword) items = items.filter(i => (i.title || '').toLowerCase().includes(keyword));

        if (items.length === 0) {
            area.innerHTML = `<div style="padding:30px; text-align:center; color:#94a3b8;">해당 기간/키워드에 맞는 데이터가 없습니다.</div>`;
            return;
        }

        const totalPages = Math.ceil(items.length / this.itemsPerPage);
        if (this.currentPage > totalPages) this.currentPage = totalPages;
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const pageItems = items.slice(startIndex, startIndex + this.itemsPerPage);

        const listHtml = pageItems.map(item => {
            const isChecked = this.selectedLinks.some(l => l.targetId === item.id);
            const dateStr = item.date ? `<span style="font-size:0.75rem; color:#94a3b8; margin-right:8px; display:inline-block; width:70px;">${item.type === 'memo' ? formatDate(new Date(item.date)) : item.date}</span>` : '';
            const safeTitle = (item.title || '').replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/"/g, "&quot;").replace(/\n/g, " ").replace(/\r/g, "");
            const displayTitle = (item.title || '').replace(/\n/g, " ").replace(/\r/g, "");

            return `
                <div style="display:flex; align-items:center; padding:8px 12px; border-bottom:1px solid #f1f5f9; cursor:pointer; transition:0.2s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background=''" onclick="window.LinkManager.toggleSelection('${item.id}', '${item.type}', '${safeTitle}', '${item.date || ''}', '${item.fId}')">
                    <input type="checkbox" ${isChecked ? 'checked' : ''} style="margin-right:10px; width:16px; height:16px; accent-color:#3b82f6; pointer-events:none;">
                    ${dateStr}
                    <span style="font-size:0.95rem; color:#334155; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; flex:1;" title="${safeTitle}">${displayTitle}</span>
                </div>
            `;
        }).join('');

        let pageBtns = '';
        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= this.currentPage - 2 && i <= this.currentPage + 2)) {
                const activeStyle = i === this.currentPage ? 'background:#3b82f6; color:#fff;' : 'background:#f1f5f9; color:#475569;';
                pageBtns += `<button onclick="window.LinkManager.currentPage=${i}; window.LinkManager.renderListArea()" style="padding:4px 10px; border:none; border-radius:4px; cursor:pointer; font-weight:bold; margin:0 2px; ${activeStyle}">${i}</button>`;
            } else if (i === this.currentPage - 3 || i === this.currentPage + 3) {
                pageBtns += `<span style="margin:0 4px; color:#94a3b8;">...</span>`;
            }
        }

        area.innerHTML = `
            <div style="flex:1; overflow-y:auto;">${listHtml}</div>
            <div style="padding:10px; background:#f8fafc; border-top:1px solid #e2e8f0; text-align:center;">${pageBtns}</div>
        `;
    },

    toggleSelection: function(id, type, title, date, fId) {
        const idx = this.selectedLinks.findIndex(l => l.targetId === id);
        if (idx !== -1) {
            this.selectedLinks.splice(idx, 1);
        } else {
            this.selectedLinks.push({ targetType: type, targetId: id, targetDate: date, title: title, targetFId: fId });
        }
        this.renderListArea();
        this.renderTray();
    },

    addScheduleLink: function() {
        const sDate = document.getElementById('linker-schedule-date').value;
        const sPeriod = document.getElementById('linker-schedule-period').value;
        if (!sDate || !sPeriod) return;

        const fakeId = `class_${sDate}_${sPeriod}`;
        const title = `${sDate} ${sPeriod}교시 수업`;

        if (!this.selectedLinks.some(l => l.targetId === fakeId)) {
            this.selectedLinks.push({ targetType: 'schedule', targetId: fakeId, targetDate: sDate, targetPeriod: sPeriod, title: title, targetFId: this.sourceData.fId });
            this.renderTray();
        }
    },

    removeLink: function(id) {
        this.selectedLinks = this.selectedLinks.filter(l => l.targetId !== id);
        this.renderListArea();
        this.renderTray();
    },

    renderTray: function() {
        document.getElementById('linker-selected-count').innerText = this.selectedLinks.length;
        const tray = document.getElementById('linker-selected-tray');
        
        if (this.selectedLinks.length === 0) {
            tray.innerHTML = `<span style="color:#94a3b8; font-size:0.85rem;">선택된 항목이 없습니다.</span>`;
            return;
        }

        tray.innerHTML = this.selectedLinks.map(l => {
            const icon = l.targetType === 'event' ? '📌' : (l.targetType === 'journal' ? '📔' : (l.targetType === 'memo' ? '📝' : '🏫'));
            return `
                <div style="display:inline-flex; align-items:center; background:#e0f2fe; border:1px solid #bae6fd; padding:4px 8px; border-radius:6px; font-size:0.85rem; color:#0369a1;">
                    <span style="margin-right:4px;">${icon}</span>
                    <span style="max-width:120px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-weight:bold;">${l.title}</span>
                    <button onclick="window.LinkManager.removeLink('${l.targetId}')" style="margin-left:6px; background:none; border:none; color:#ef4444; font-weight:bold; cursor:pointer; padding:0;">✖</button>
                </div>
            `;
        }).join('');
    },

    saveLinks: async function() {
        if (this.selectedLinks.length === 0) return alert("연결할 항목을 선택해주세요.");

        const updateLinks = (targetArray) => {
            this.selectedLinks.forEach(link => {
                if (!targetArray.some(l => l.targetId === link.targetId)) targetArray.push(link);
            });
        };

        // 1. 출발지(Source) 업데이트
        if (this.sourceData.type === 'schedule_header') {
            const sp = document.getElementById('linker-source-period').value;
            if (window[`tempSchedules_${this.sourceData.dateStr}`]) {
                const grp = window[`tempSchedules_${this.sourceData.dateStr}`][this.sourceData.fId] || {};
                grp[sp] = grp[sp] || { subject:'', memo:'', supplies:'', linkedItems:[] };
                grp[sp].linkedItems = grp[sp].linkedItems || [];
                updateLinks(grp[sp].linkedItems);
            }
            const dData = window.dayViewInstance?.dayData?.[this.sourceData.fId];
            if (dData && dData.schedules) {
                dData.schedules[sp] = dData.schedules[sp] || { subject:'', memo:'', supplies:'', linkedItems:[] };
                dData.schedules[sp].linkedItems = dData.schedules[sp].linkedItems || [];
                updateLinks(dData.schedules[sp].linkedItems);
            }
        } 
        else if (this.sourceData.type === 'event') {
            const evList = window[`tempEvents_${this.sourceData.dateStr}`] || [];
            const ev = evList.find(e => e.id === this.sourceData.id);
            if (ev) { ev.linkedItems = ev.linkedItems || []; updateLinks(ev.linkedItems); }
            
            const dData = window.dayViewInstance?.dayData?.[this.sourceData.fId];
            if (dData && dData.events) {
                const dev = dData.events.find(e => e.id === this.sourceData.id);
                if (dev) { dev.linkedItems = dev.linkedItems || []; updateLinks(dev.linkedItems); }
            }
        }
        else if (this.sourceData.type === 'journal') {
            const dData = window.dayViewInstance?.dayData?.[this.sourceData.fId];
            if (dData && dData.journals) {
                const jr = dData.journals.find(j => j.id === this.sourceData.id);
                if (jr) { jr.linkedItems = jr.linkedItems || []; updateLinks(jr.linkedItems); }
            }
        }
        else if (this.sourceData.type === 'memo') {
            if (window.memoViewInstance?.memoItems) {
                const memo = window.memoViewInstance.memoItems.find(m => m.firestoreId === this.sourceData.id);
                if (memo) { 
                    memo.linkedItems = memo.linkedItems || []; 
                    updateLinks(memo.linkedItems); 
                    if (window.dbAPI && window.dbAPI.updateMemo) {
                        await window.dbAPI.updateMemo(this.sourceData.id, { linkedItems: memo.linkedItems }, this.sourceData.fId);
                    }
                }
            }
        }

        // 2. 도착지(Target) 역방향 링크 주입
        let sourceTitleLabel = '연결된 항목';
        let safeTargetId = this.sourceData.id;

        if (this.sourceData.type === 'schedule_header') {
            const sp = document.getElementById('linker-source-period').value;
            sourceTitleLabel = `${sp}교시 수업`;
            safeTargetId = `class_${this.sourceData.dateStr}_${sp}`;
        }
        else if (this.sourceData.type === 'event') sourceTitleLabel = '일정';
        else if (this.sourceData.type === 'journal') sourceTitleLabel = '기록';
        else if (this.sourceData.type === 'memo') sourceTitleLabel = '메모';

        const sourceMeta = {
            targetType: this.sourceData.type === 'schedule_header' ? 'schedule' : this.sourceData.type,
            targetId: safeTargetId,
            targetDate: this.sourceData.dateStr || '',
            targetPeriod: this.sourceData.type === 'schedule_header' ? document.getElementById('linker-source-period').value : (this.sourceData.period || ''),
            title: `[${this.sourceData.dateStr || '메모'}] ${sourceTitleLabel}`,
            targetFId: this.sourceData.fId 
        };

        for (const link of this.selectedLinks) {
            await this.addReverseLink(link, sourceMeta, this.sourceData.fId);
        }
        
        window.store.hasUnsavedChanges = true;
        if (typeof window.saveCurrentViewData === 'function') {
            await window.saveCurrentViewData(true); 
        }

        if (window.showToast) window.showToast('✅ 데이터가 성공적으로 연결되었습니다.');
        
        this.selectedLinks = [];
        this.renderListArea();
        this.renderTray();
    },

    addReverseLink: async function(targetLink, sourceMeta, sourceFId) {
        const tFId = targetLink.targetFId || sourceFId; 

        try {
            if (targetLink.targetType === 'event') {
                if (window[`tempEvents_${targetLink.targetDate}`]) {
                    const ev = window[`tempEvents_${targetLink.targetDate}`].find(e => e.id === targetLink.targetId);
                    if (ev) { ev.linkedItems = ev.linkedItems || []; if (!ev.linkedItems.some(l => l.targetId === sourceMeta.targetId)) ev.linkedItems.push(sourceMeta); }
                }
                if (window.dayViewInstance?.dayData?.[tFId]?.events) {
                    const ev = window.dayViewInstance.dayData[tFId].events.find(e => e.id === targetLink.targetId);
                    if (ev) { ev.linkedItems = ev.linkedItems || []; if (!ev.linkedItems.some(l => l.targetId === sourceMeta.targetId)) ev.linkedItems.push(sourceMeta); }
                }
            } else if (targetLink.targetType === 'journal') {
                if (window.dayViewInstance?.dayData?.[tFId]?.journals) {
                    const jr = window.dayViewInstance.dayData[tFId].journals.find(j => j.id === targetLink.targetId);
                    if (jr) { jr.linkedItems = jr.linkedItems || []; if (!jr.linkedItems.some(l => l.targetId === sourceMeta.targetId)) jr.linkedItems.push(sourceMeta); }
                }
            } else if (targetLink.targetType === 'schedule') {
                if (window[`tempSchedules_${targetLink.targetDate}`]) {
                    const grp = window[`tempSchedules_${targetLink.targetDate}`][tFId] || {};
                    const pObj = grp[targetLink.targetPeriod];
                    if (pObj) { pObj.linkedItems = pObj.linkedItems || []; if (!pObj.linkedItems.some(l => l.targetId === sourceMeta.targetId)) pObj.linkedItems.push(sourceMeta); }
                }
                if (window.dayViewInstance?.dayData?.[tFId]?.schedules) {
                    const pObj = window.dayViewInstance.dayData[tFId].schedules[targetLink.targetPeriod];
                    if (pObj) { pObj.linkedItems = pObj.linkedItems || []; if (!pObj.linkedItems.some(l => l.targetId === sourceMeta.targetId)) pObj.linkedItems.push(sourceMeta); }
                }
            } else if (targetLink.targetType === 'memo') {
                if (window.memoViewInstance?.memoItems) {
                    const memo = window.memoViewInstance.memoItems.find(m => m.firestoreId === targetLink.targetId);
                    if (memo) { 
                        memo.linkedItems = memo.linkedItems || []; 
                        if (!memo.linkedItems.some(l => l.targetId === sourceMeta.targetId)) {
                            memo.linkedItems.push(sourceMeta);
                        }
                    }
                }
            }

            const colFunc = tFId === 'personal' ? getUserCol : (col) => getGroupCol(tFId, col);
            if (targetLink.targetType === 'event') {
                const docRef = doc(colFunc('events'), targetLink.targetDate);
                const snap = await getDoc(docRef);
                if (snap.exists()) {
                    const list = snap.data().eventList || [];
                    const item = list.find(e => e.id === targetLink.targetId);
                    if (item) {
                        item.linkedItems = item.linkedItems || [];
                        if (!item.linkedItems.some(l => l.targetId === sourceMeta.targetId)) {
                            item.linkedItems.push(sourceMeta);
                            await setDoc(docRef, { eventList: list }, { merge: true });
                        }
                    }
                }
            } else if (targetLink.targetType === 'journal') {
                const docRef = doc(colFunc('journals'), targetLink.targetDate);
                const snap = await getDoc(docRef);
                if (snap.exists()) {
                    const list = snap.data().entries || [];
                    const item = list.find(e => e.id === targetLink.targetId);
                    if (item) {
                        item.linkedItems = item.linkedItems || [];
                        if (!item.linkedItems.some(l => l.targetId === sourceMeta.targetId)) {
                            item.linkedItems.push(sourceMeta);
                            await setDoc(docRef, { entries: list }, { merge: true });
                        }
                    }
                }
            } else if (targetLink.targetType === 'schedule') {
                const docRef = doc(colFunc('schedules'), targetLink.targetDate);
                const snap = await getDoc(docRef);
                if (snap.exists()) {
                    const periods = snap.data().periods || {};
                    const item = periods[targetLink.targetPeriod];
                    if (item) {
                        item.linkedItems = item.linkedItems || [];
                        if (!item.linkedItems.some(l => l.targetId === sourceMeta.targetId)) {
                            item.linkedItems.push(sourceMeta);
                            await setDoc(docRef, { periods: periods }, { merge: true });
                        }
                    }
                }
            } else if (targetLink.targetType === 'memo') {
                const docRef = doc(colFunc('tasks'), targetLink.targetId);
                const snap = await getDoc(docRef);
                if (snap.exists()) {
                    const linkedItems = snap.data().linkedItems || [];
                    if (!linkedItems.some(l => l.targetId === sourceMeta.targetId)) {
                        linkedItems.push(sourceMeta);
                        await setDoc(docRef, { linkedItems: linkedItems }, { merge: true });
                    }
                }
            }
        } catch (e) { console.error("역방향 링크 저장 오류:", e); }
    },

    openViewer: async function(dateStr, id, fId, type, period = '') {
        let linkedItems = [];
        if (type === 'event') {
            const evList = window[`tempEvents_${dateStr}`] || window.dayViewInstance?.dayData?.[fId]?.events || [];
            const ev = evList.find(e => e.id === id);
            if (ev) linkedItems = ev.linkedItems || [];
        } else if (type === 'journal') {
            const jList = window.dayViewInstance?.dayData?.[fId]?.journals || [];
            const j = jList.find(e => e.id === id);
            if (j) linkedItems = j.linkedItems || [];
        } else if (type === 'schedule') {
            const sData = window[`tempSchedules_${dateStr}`]?.[fId] || window.dayViewInstance?.dayData?.[fId]?.schedules || {};
            const pObj = sData[period];
            if (pObj) linkedItems = pObj.linkedItems || [];
        } else if (type === 'memo') {
            const memoList = window.memoViewInstance?.memoItems || [];
            const m = memoList.find(e => e.firestoreId === id);
            if (m) linkedItems = m.linkedItems || [];
        }

        if (this.viewerModal) {
            this.viewerModal.close();
            this.viewerModal = null;
        } else {
            const existingModal = document.getElementById('linker-viewer-modal');
            if (existingModal) existingModal.remove();
        }

        this.viewerModal = new window.Modal({
            id: 'linker-viewer-modal',
            title: '📑 연결된 데이터 확인 (수정 가능)',
            width: '550px',
            content: `<div id="linker-viewer-body" style="padding:20px; text-align:center; font-weight:bold; color:#3b82f6;">실시간 데이터를 불러오는 중입니다...⏳</div>`
        });
        this.viewerModal.open();

        let html = '';
        for (const link of linkedItems) {
            const tFId = link.targetFId || fId; 
            const text = await this.fetchItemText(link.targetType, link.targetDate, link.targetId, link.targetPeriod, tFId);
            const icon = link.targetType === 'event' ? '📌' : (link.targetType === 'journal' ? '📔' : (link.targetType === 'memo' ? '📝' : '🏫'));
            
            let displayTitle = link.title || '';
            if (!displayTitle.includes('[')) {
                displayTitle = `[${link.targetDate || '날짜없음'}] ${displayTitle}`;
            }

            html += `
                <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:8px; padding:12px; margin-bottom:12px; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <span style="font-weight:bold; color:#1e40af; font-size:0.95rem;">${icon} ${displayTitle}</span>
                        <div style="display:flex; gap:6px;">
                            <button onclick="window.LinkManager.deleteLinkConnection('${type}', '${dateStr}', '${id}', '${period}', '${fId}', '${link.targetType}', '${link.targetDate}', '${link.targetId}', '${link.targetPeriod}', '${tFId}')" style="background:#fef2f2; border:1px solid #fca5a5; color:#ef4444; padding:4px 8px; border-radius:6px; font-size:0.85rem; cursor:pointer; font-weight:bold; transition:0.2s;" title="이 연결을 삭제합니다">🗑️ 삭제</button>
                            <button onclick="window.LinkManager.navigateAndClose('${link.targetDate}', '${link.targetType}')" style="background:#fef08a; border:1px solid #fde047; color:#854d0e; padding:4px 10px; border-radius:6px; font-size:0.85rem; cursor:pointer; font-weight:bold; transition:0.2s; display:flex; align-items:center; gap:4px;" title="해당 페이지로 이동">📌 이동</button>
                        </div>
                    </div>
                    <textarea id="edit-link-${link.targetId}" style="width:100%; min-height:60px; padding:10px; border:1px solid #cbd5e1; border-radius:6px; box-sizing:border-box; outline:none; resize:vertical; font-size:0.95rem; line-height:1.4;" onfocus="this.style.height=this.scrollHeight+'px'">${text}</textarea>
                    <div style="text-align:right; margin-top:8px;">
                        <button onclick="window.LinkManager.updateItemText('${link.targetType}', '${link.targetDate}', '${link.targetId}', '${link.targetPeriod}', '${tFId}')" style="background:#10b981; border:none; color:white; padding:6px 14px; border-radius:6px; font-size:0.9rem; cursor:pointer; font-weight:bold; transition:0.2s;">수정 내용 반영</button>
                    </div>
                </div>
            `;
        }

        if (!html) html = '<div style="color:#94a3b8; text-align:center; padding:20px;">연결된 항목의 데이터를 찾을 수 없습니다.</div>';

        html += `
            <div style="text-align:center; margin-top:20px; padding-top:15px; border-top:1px solid #e2e8f0;">
                <button onclick="window.LinkManager.closeViewer()" style="background:#64748b; color:white; padding:10px 24px; border:none; border-radius:6px; font-weight:bold; cursor:pointer; font-size:1rem; transition:0.2s;">닫기 (새로고침)</button>
            </div>
        `;
        document.getElementById('linker-viewer-body').innerHTML = html;
    },

    closeViewer: function() {
        if (this.viewerModal) {
            this.viewerModal.close();
            this.viewerModal = null;
        } else {
            const modal = document.getElementById('linker-viewer-modal');
            if (modal) modal.remove();
            if (window.decreaseModalCount) window.decreaseModalCount();
        }
        if (typeof window.render === 'function') {
            window.render();
        }
    },

    deleteLinkConnection: async function(sType, sDate, sId, sPeriod, sFId, tType, tDate, tId, tPeriod, tFId) {
        if (!confirm("이 연결을 해제하시겠습니까? (양쪽 모두에서 연결이 끊어집니다)")) return;

        // 💡 [버그 해결 핵심]
        // 수업(schedule)의 경우 뷰어 오픈 시 id가 null 속성으로 넘어와 HTML 상에서 'null' 또는 'undefined' 문자열이 되는 현상 방지
        // 정확한 고유 ID 포맷(class_YYYY-MM-DD_P)을 재조립하여 역방향 필터링 시 누락되지 않도록 보정합니다.
        const actualSourceId = (sType === 'schedule' || sType === 'schedule_header') && (sId === 'null' || sId === 'undefined' || !sId) 
            ? `class_${sDate}_${sPeriod}` : sId;
        const actualTargetId = (tType === 'schedule' || tType === 'schedule_header') && (tId === 'null' || tId === 'undefined' || !tId) 
            ? `class_${tDate}_${tPeriod}` : tId;

        await this._removeLinkFromSide(sType, sDate, actualSourceId, sPeriod, sFId, actualTargetId);
        await this._removeLinkFromSide(tType, tDate, actualTargetId, tPeriod, tFId, actualSourceId);

        window.store.hasUnsavedChanges = true;
        if (typeof window.saveCurrentViewData === 'function') {
            await window.saveCurrentViewData(true); 
        }

        if (window.showToast) window.showToast('✅ 연결이 정상적으로 해제되었습니다.');
        
        if (this.viewerModal) {
            this.viewerModal.close();
            this.viewerModal = null;
        }
        
        // 뷰어 창을 삭제된 상태로 리로드 (복원된 null ID를 유지하여 오픈)
        const restoreSId = (sType === 'schedule' || sType === 'schedule_header') ? null : actualSourceId;
        this.openViewer(sDate, restoreSId, sFId, sType, sPeriod);
    },

    _removeLinkFromSide: async function(type, dateStr, id, period, fId, targetIdToRemove) {
        if (type === 'event') {
            if (window[`tempEvents_${dateStr}`]) {
                const ev = window[`tempEvents_${dateStr}`].find(e => e.id === id);
                if (ev) ev.linkedItems = (ev.linkedItems || []).filter(l => l.targetId !== targetIdToRemove);
            }
            if (window.dayViewInstance?.dayData?.[fId]?.events) {
                const ev = window.dayViewInstance.dayData[fId].events.find(e => e.id === id);
                if (ev) ev.linkedItems = (ev.linkedItems || []).filter(l => l.targetId !== targetIdToRemove);
            }
        } else if (type === 'journal') {
            if (window.dayViewInstance?.dayData?.[fId]?.journals) {
                const jr = window.dayViewInstance.dayData[fId].journals.find(j => j.id === id);
                if (jr) jr.linkedItems = (jr.linkedItems || []).filter(l => l.targetId !== targetIdToRemove);
            }
        } else if (type === 'schedule') {
            if (window[`tempSchedules_${dateStr}`]) {
                const grp = window[`tempSchedules_${dateStr}`][fId] || {};
                const pObj = grp[period];
                if (pObj) pObj.linkedItems = (pObj.linkedItems || []).filter(l => l.targetId !== targetIdToRemove);
            }
            if (window.dayViewInstance?.dayData?.[fId]?.schedules) {
                const pObj = window.dayViewInstance.dayData[fId].schedules[period];
                if (pObj) pObj.linkedItems = (pObj.linkedItems || []).filter(l => l.targetId !== targetIdToRemove);
            }
        } else if (type === 'memo') {
            if (window.memoViewInstance?.memoItems) {
                const m = window.memoViewInstance.memoItems.find(e => e.firestoreId === id);
                if (m) {
                    m.linkedItems = (m.linkedItems || []).filter(l => l.targetId !== targetIdToRemove);
                    if (window.dbAPI && window.dbAPI.updateMemo) {
                        await window.dbAPI.updateMemo(id, { linkedItems: m.linkedItems }, fId);
                    }
                }
            }
        }

        try {
            const colFunc = fId === 'personal' ? getUserCol : (col) => getGroupCol(fId, col);
            if (type === 'event') {
                const docRef = doc(colFunc('events'), dateStr);
                const snap = await getDoc(docRef);
                if (snap.exists()) {
                    const list = snap.data().eventList || [];
                    const item = list.find(e => e.id === id);
                    if (item) {
                        item.linkedItems = (item.linkedItems || []).filter(l => l.targetId !== targetIdToRemove);
                        await setDoc(docRef, { eventList: list }, { merge: true });
                    }
                }
            } else if (type === 'journal') {
                const docRef = doc(colFunc('journals'), dateStr);
                const snap = await getDoc(docRef);
                if (snap.exists()) {
                    const list = snap.data().entries || [];
                    const item = list.find(e => e.id === id);
                    if (item) {
                        item.linkedItems = (item.linkedItems || []).filter(l => l.targetId !== targetIdToRemove);
                        await setDoc(docRef, { entries: list }, { merge: true });
                    }
                }
            } else if (type === 'schedule') {
                const docRef = doc(colFunc('schedules'), dateStr);
                const snap = await getDoc(docRef);
                if (snap.exists()) {
                    const periods = snap.data().periods || {};
                    const item = periods[period];
                    if (item) {
                        item.linkedItems = (item.linkedItems || []).filter(l => l.targetId !== targetIdToRemove);
                        await setDoc(docRef, { periods: periods }, { merge: true });
                    }
                }
            } else if (type === 'memo') {
                const docRef = doc(colFunc('tasks'), id);
                const snap = await getDoc(docRef);
                if (snap.exists()) {
                    const linkedItems = (snap.data().linkedItems || []).filter(l => l.targetId !== targetIdToRemove);
                    await setDoc(docRef, { linkedItems: linkedItems }, { merge: true });
                }
            }
        } catch(e) { console.error("DB Update Error during link removal:", e); }
    },

    fetchItemText: async function(type, dateStr, id, period, fId) {
        try {
            const colFunc = fId === 'personal' ? getUserCol : (col) => getGroupCol(fId, col);
            if (type === 'event') {
                const snap = await getDoc(doc(colFunc('events'), dateStr));
                if (snap.exists()) {
                    const item = (snap.data().eventList || []).find(e => e.id === id);
                    return item ? item.content : '';
                }
            } else if (type === 'journal') {
                const snap = await getDoc(doc(colFunc('journals'), dateStr));
                if (snap.exists()) {
                    const item = (snap.data().entries || []).find(e => e.id === id);
                    return item ? item.content : '';
                }
            } else if (type === 'schedule') {
                const snap = await getDoc(doc(colFunc('schedules'), dateStr));
                if (snap.exists()) {
                    const item = (snap.data().periods || {})[period];
                    return item ? (item.subject ? `[${item.subject}] ${item.memo}` : item.memo) : '';
                }
            } else if (type === 'memo') {
                const snap = await getDoc(doc(colFunc('tasks'), id));
                if (snap.exists()) return snap.data().text || '';
            }
        } catch(e) { console.error("텍스트 조회 실패", e); }
        return '';
    },

    updateItemText: async function(type, dateStr, id, period, fId) {
        const newVal = document.getElementById(`edit-link-${id}`).value;
        try {
            const colFunc = fId === 'personal' ? getUserCol : (col) => getGroupCol(fId, col);
            if (type === 'event') {
                const ref = doc(colFunc('events'), dateStr);
                const snap = await getDoc(ref);
                if (snap.exists()) {
                    const list = snap.data().eventList || [];
                    const item = list.find(e => e.id === id);
                    if (item) { item.content = newVal; await setDoc(ref, { eventList: list }, { merge: true }); }
                }
            } else if (type === 'journal') {
                const ref = doc(colFunc('journals'), dateStr);
                const snap = await getDoc(ref);
                if (snap.exists()) {
                    const list = snap.data().entries || [];
                    const item = list.find(e => e.id === id);
                    if (item) { item.content = newVal; await setDoc(ref, { entries: list }, { merge: true }); }
                }
            } else if (type === 'schedule') {
                const ref = doc(colFunc('schedules'), dateStr);
                const snap = await getDoc(ref);
                if (snap.exists()) {
                    const periods = snap.data().periods || {};
                    if (periods[period]) { 
                        let newMemo = newVal.trim();
                        let newSubj = periods[period].subject || '';
                        
                        // 💡 [버그 방지 추가] 사용자가 뷰어에서 텍스트를 수정할 때 [과목명]을 포함해서 수정한 경우를 대비한 파싱 로직
                        const match = newMemo.match(/^\[(.*?)\]/);
                        if (match) {
                            newSubj = match[1].trim();
                            newMemo = newMemo.replace(/^\[(.*?)\]\s*/, '').trim();
                        }
                        
                        periods[period].subject = newSubj;
                        periods[period].memo = newMemo; 
                        await setDoc(ref, { periods: periods }, { merge: true }); 
                        
                        // 메모리 즉시 반영 (편집 중 데이터 유실 방지)
                        if (window[`tempSchedules_${dateStr}`]?.[fId]?.[period]) {
                            window[`tempSchedules_${dateStr}`][fId][period].subject = newSubj;
                            window[`tempSchedules_${dateStr}`][fId][period].memo = newMemo;
                        }
                        if (window.dayViewInstance?.dayData?.[fId]?.schedules?.[period]) {
                            window.dayViewInstance.dayData[fId].schedules[period].subject = newSubj;
                            window.dayViewInstance.dayData[fId].schedules[period].memo = newMemo;
                        }
                    }
                }
            } else if (type === 'memo') {
                const ref = doc(colFunc('tasks'), id);
                await setDoc(ref, { text: newVal, updatedAt: Date.now() }, { merge: true });
            }
            if (window.showToast) window.showToast('✅ 수정된 내용이 저장되었습니다.');
        } catch(e) { console.error(e); alert('저장에 실패했습니다.'); }
    },

    navigateAndClose: function(dateStr, type) {
        if (this.viewerModal) {
            this.viewerModal.close();
            this.viewerModal = null;
        } else {
            const modal = document.getElementById('linker-viewer-modal');
            if (modal) modal.remove();
            if (window.decreaseModalCount) window.decreaseModalCount();
        }

        document.body.style.overflow = '';
        if (typeof window.activeModalCount !== 'undefined') window.activeModalCount = 0;

        if (type === 'memo') {
            if (window.store) {
                window.store.scope = 'memo';
                window.store.mode = 'editor';
            }
            if (typeof window.render === 'function') window.render();
        } else if (dateStr && dateStr !== 'undefined') {
            if (window.store) {
                const parts = dateStr.split('-');
                if (parts.length === 3) {
                    window.store.currentDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
                }
                window.store.scope = 'day';
                window.store.mode = 'editor';
            }
            if (typeof window.render === 'function') {
                window.render(true);
            }
        } else {
            return alert('이동할 수 없는 항목입니다.');
        }
    }
};

window.LinkManager = LinkManager;