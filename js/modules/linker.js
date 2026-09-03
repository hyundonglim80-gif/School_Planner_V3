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

        const existingModal = document.getElementById('linker-modal');
        if (existingModal) existingModal.remove();

        this.modal = new window.Modal({
            id: 'linker-modal',
            title: '🔗 관련 데이터 연결 (다중 선택 가능)',
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
            
            <div class="modal-footer-actions">
                <button onclick="document.getElementById('linker-modal').remove()" class="modal-btn-secondary">취소</button>
                <button onclick="window.LinkManager.saveLinks()" class="modal-btn-primary">연결 저장</button>
            </div>
        `;
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
            const allMemos = await dbAPI.loadMemos() || [];
            this.tabData.memo = allMemos.map(m => ({ id: m.firestoreId, title: m.text, date: m.createdAt, type: 'memo' }))
                                        .sort((a,b) => b.date - a.date);
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

        if (!startStr || !endStr) return alert("날짜를 올바르게 설정해주세요.");

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
                    if(e.content?.trim()) events.push({ id: eId, title: e.content, date: dStr, type: 'event' });
                });
            });

            Object.keys(jMap).forEach(dStr => {
                const fJournals = jMap[dStr]?.[fId] || []; 
                fJournals.forEach(j => {
                    const jId = j.id || ('jr_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5));
                    if(j.content?.trim()) journals.push({ id: jId, title: j.content, date: dStr, type: 'journal' });
                });
            });

            this.tabData.event = events.sort((a,b) => b.date.localeCompare(a.date));
            this.tabData.journal = journals.sort((a,b) => b.date.localeCompare(a.date));

            this.currentPage = 1;
            this.renderListArea();
        } catch (e) {
            console.error("Linker Data Load Error:", e);
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
            <div id="linker-list-area" style="flex:1; display:flex; flex-direction:column; border:1px solid #e2e8f0; border-radius:6px; background:#fff; overflow:hidden;">
            </div>
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
                <div style="display:flex; align-items:center; padding:8px 12px; border-bottom:1px solid #f1f5f9; cursor:pointer; transition:0.2s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background=''" onclick="window.LinkManager.toggleSelection('${item.id}', '${item.type}', '${safeTitle}', '${item.date || ''}')">
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
            <div style="padding:10px; background:#f8fafc; border-top:1px solid #e2e8f0; text-align:center; display:flex; justify-content:center; align-items:center; flex-wrap:wrap;">
                ${pageBtns}
            </div>
        `;
    },

    toggleSelection: function(id, type, title, date) {
        const idx = this.selectedLinks.findIndex(l => l.targetId === id);
        if (idx !== -1) {
            this.selectedLinks.splice(idx, 1);
        } else {
            this.selectedLinks.push({ targetType: type, targetId: id, targetDate: date, title: title });
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
            this.selectedLinks.push({ targetType: 'schedule', targetId: fakeId, targetDate: sDate, targetPeriod: sPeriod, title: title });
            this.renderTray();
            if(window.showToast) window.showToast('담겼습니다.');
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
                if (!targetArray.some(l => l.targetId === link.targetId)) {
                    targetArray.push(link);
                }
            });
        };

        if (this.sourceData.type === 'schedule_header') {
            const sp = document.getElementById('linker-source-period').value;
            if (window[`tempSchedules_${this.sourceData.dateStr}`]) {
                const grp = window[`tempSchedules_${this.sourceData.dateStr}`][this.sourceData.fId] || {};
                grp[sp] = grp[sp] || { subject:'', memo:'', supplies:'', linkedItems:[] };
                grp[sp].linkedItems = grp[sp].linkedItems || [];
                updateLinks(grp[sp].linkedItems);
                window[`tempSchedules_${this.sourceData.dateStr}`][this.sourceData.fId] = grp;
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

        let sourceTitleLabel = '연결된 항목';
        if (this.sourceData.type === 'schedule_header') sourceTitleLabel = `${document.getElementById('linker-source-period').value}교시 수업`;
        else if (this.sourceData.type === 'event') sourceTitleLabel = '일정';
        else if (this.sourceData.type === 'journal') sourceTitleLabel = '기록';

        const sourceMeta = {
            targetType: this.sourceData.type === 'schedule_header' ? 'schedule' : this.sourceData.type,
            targetId: this.sourceData.id,
            targetDate: this.sourceData.dateStr,
            targetPeriod: this.sourceData.type === 'schedule_header' ? document.getElementById('linker-source-period').value : (this.sourceData.period || ''),
            title: `[${this.sourceData.dateStr}] ${sourceTitleLabel}`
        };

        for (const link of this.selectedLinks) {
            await this.addReverseLink(link, sourceMeta, this.sourceData.fId);
        }
        
        window.store.hasUnsavedChanges = true;
        
        if (typeof window.saveCurrentViewData === 'function') {
            await window.saveCurrentViewData(true); 
        } else if (window.render) {
            window.render(false);
        }

        if (window.showToast) window.showToast('✅ 데이터가 양방향으로 연결되었습니다.');
        document.getElementById('linker-modal').remove();
    },

    addReverseLink: async function(targetLink, sourceMeta, fId) {
        try {
            const colFunc = fId === 'personal' ? getUserCol : (col) => getGroupCol(fId, col);
            
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
        }

        const existingModal = document.getElementById('linker-viewer-modal');
        if (existingModal) existingModal.remove();

        this.viewerModal = new window.Modal({
            id: 'linker-viewer-modal',
            title: '🔗 연결된 상세 항목 (수정 가능)',
            width: '550px',
            content: `<div id="linker-viewer-body" style="padding:20px; text-align:center; font-weight:bold; color:#3b82f6;">실시간 데이터를 불러오는 중입니다...⏳</div>`
        });
        this.viewerModal.open();

        let html = '';
        for (const link of linkedItems) {
            const text = await this.fetchItemText(link.targetType, link.targetDate, link.targetId, link.targetPeriod, fId);
            const icon = link.targetType === 'event' ? '📌' : (link.targetType === 'journal' ? '📔' : (link.targetType === 'memo' ? '📝' : '🏫'));
            
            html += `
				<div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:8px; padding:12px; margin-bottom:12px; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
					<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
						<span style="font-weight:bold; color:#1e40af; font-size:0.95rem;">${icon} ${link.title}</span>
						<button onclick="window.LinkManager.navigateAndClose('${link.targetDate}')" style="background:#fef08a; border:1px solid #fde047; color:#854d0e; padding:4px 10px; border-radius:6px; font-size:0.85rem; cursor:pointer; font-weight:bold; transition:0.2s; display:flex; align-items:center; gap:4px;" onmouseover="this.style.background='#fde047'" onmouseout="this.style.background='#fef08a'" title="해당 페이지로 이동">📌 이동</button>
					</div>
					<textarea id="edit-link-${link.targetId}" style="width:100%; min-height:60px; padding:10px; border:1px solid #cbd5e1; border-radius:6px; box-sizing:border-box; outline:none; resize:vertical; font-size:0.95rem; line-height:1.4;" onfocus="this.style.height=this.scrollHeight+'px'">${text}</textarea>
					<div style="text-align:right; margin-top:8px;">
						<button onclick="window.LinkManager.updateItemText('${link.targetType}', '${link.targetDate}', '${link.targetId}', '${link.targetPeriod}', '${fId}')" style="background:#10b981; border:none; color:white; padding:6px 14px; border-radius:6px; font-size:0.9rem; cursor:pointer; font-weight:bold; transition:0.2s;" onmouseover="this.style.background='#059669'" onmouseout="this.style.background='#10b981'">수정 내용 반영</button>
					</div>
				</div>
			`;
        }
        document.getElementById('linker-viewer-body').innerHTML = html || '<div style="color:#94a3b8; text-align:center; padding:20px;">연결된 항목의 데이터를 찾을 수 없습니다.</div>';
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
                        periods[period].memo = newVal; 
                        await setDoc(ref, { periods: periods }, { merge: true }); 
                    }
                }
            } else if (type === 'memo') {
                const ref = doc(colFunc('tasks'), id);
                await setDoc(ref, { text: newVal, updatedAt: Date.now() }, { merge: true });
            }
            if (window.showToast) window.showToast('✅ 수정된 내용이 저장되었습니다.');
        } catch(e) { console.error(e); alert('저장에 실패했습니다.'); }
    },

    navigateAndClose: function(dateStr) {
        if (!dateStr || dateStr === 'undefined') return alert('이동할 수 없는 항목입니다.');
        if (window.goToDay) window.goToDay(dateStr);
        const modal = document.getElementById('linker-viewer-modal');
        if (modal) modal.remove();
    }
};

window.LinkManager = LinkManager;