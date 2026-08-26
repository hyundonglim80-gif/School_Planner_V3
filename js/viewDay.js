// js/viewDay.js

import { BaseView } from './components/BaseView.js';
import { store } from './core/store.js';
import { getEventLabels, getJournalLabels, getLabelStyle } from './core/utils.js';
import { dbAPI, getUserCol, getGroupCol } from './firebase.js'; 
import { doc, getDoc, setDoc } from "firebase/firestore";

export class DayView extends BaseView {
    constructor(container) {
        super(container);
        this.currentEvents = [];
        this.currentJournals = [];
        this.currentSchedules = {};
        this.currentEvalList = []; 
        this.draggedPeriod = null; 
        
        this.myGroups = [];
        this.scheduleGroupId = null; 
    }

    // 🌟 [추가됨] 텍스트 에리어 높이를 내용에 맞게 자동으로 조절하는 함수
    autoResize(textarea) {
        if (!textarea) return;
        textarea.style.height = 'auto';
        textarea.style.height = (textarea.scrollHeight + 2) + 'px';
    }

    async loadEvaluationsForDay(dateStr) {
        let allEvals = [];
        
        if (store.mode === 'editor') {
            const scheduleEvals = await dbAPI.loadEvaluations(dateStr, this.scheduleGroupId) || [];
            scheduleEvals.forEach(e => e.groupId = this.scheduleGroupId);
            allEvals = scheduleEvals.filter(e => e.context?.source === 'schedule');
        } else {
            const filtersToLoad = window.activeUnifiedFilters || ['personal'];
            for (const f of filtersToLoad) {
                const gid = f === 'personal' ? null : f;
                const evals = await dbAPI.loadEvaluations(dateStr, gid) || [];
                evals.forEach(e => e.groupId = gid);
                allEvals = allEvals.concat(evals.filter(e => e.context?.source === 'schedule'));
            }
        }

        const journalEvals = await dbAPI.loadEvaluations(dateStr, null) || [];
        journalEvals.forEach(e => e.groupId = null);
        allEvals = allEvals.concat(journalEvals.filter(e => e.context?.source === 'journal'));

        const uniqueEvals = [];
        const ids = new Set();
        allEvals.forEach(e => {
            if (!ids.has(e.id)) { ids.add(e.id); uniqueEvals.push(e); }
        });
        return uniqueEvals;
    }

    generateEvalBadgesHtml(source, period = null) {
        const evals = this.currentEvalList.filter(e => {
            const eSource = e.context?.source || (e.periodStr ? 'schedule' : 'journal');
            if (eSource !== source) return false;
            
            if (source === 'schedule') {
                const savedPeriod = e.periodStr || e.context?.period || '';
                const ePeriodStr = String(savedPeriod).replace(/[^0-9]/g, '');
                const currentPStr = String(period || '').replace(/[^0-9]/g, '');
                
                if (!ePeriodStr || !currentPStr) return false;
                return parseInt(ePeriodStr, 10) === parseInt(currentPStr, 10);
            }
            return true;
        });

        if(evals.length === 0) return '';
        
        return evals.map(e => {
            let badgeType = '';
            if (e.type === 'eval') badgeType = e.subject || '평가';
            else if (e.type === 'check') badgeType = '체크';
            else if (e.type === 'memo') badgeType = '메모';
            else badgeType = '기타';

            const gId = e.groupId || '';
            return `
                <div onclick="window.EvaluationManager.currentGroupId = '${gId}'; window.EvaluationManager.openViewer('${this.dateStr}', '${e.id}')" style="padding:4px 8px; background:#eff6ff; border:1px solid #bfdbfe; border-radius:6px; font-size:0.85rem; color:#1e40af; cursor:pointer; font-weight:bold; box-shadow:0 1px 2px rgba(0,0,0,0.05); display:flex; align-items:center; white-space:nowrap;" title="클릭하여 평가 열기">
                    📊 [${badgeType}] ${e.title}
                </div>
            `;
        }).join('');
    }

    async refreshEvalBadges() {
        this.currentEvalList = await this.loadEvaluationsForDay(this.dateStr);
        
        const periodRows = this.container.querySelectorAll('tr[data-period]');
        periodRows.forEach(row => {
            const p = row.getAttribute('data-period');
            const badgeContainer = row.querySelector('.eval-badges-container');
            if (badgeContainer) {
                badgeContainer.innerHTML = this.generateEvalBadgesHtml('schedule', p);
            }
        });

        const journalContainer = this.container.querySelector('.journal-eval-badges-container');
        if (journalContainer) {
            const html = this.generateEvalBadgesHtml('journal');
            journalContainer.innerHTML = html;
            journalContainer.style.display = html ? 'flex' : 'none';
        }
    }

    parseEvents(docData) {
        if (!docData) return [];
        if (docData.eventList && docData.eventList.length > 0) return docData.eventList;
        if (docData.eventText && docData.eventText.trim() !== '') return window.parseRawEventTextToEventList(docData.eventText);
        return [];
    }

    async changeScheduleWorkspace(newGroupId) {
        if (store.hasUnsavedChanges) {
            this.save(); 
        }
        this.scheduleGroupId = newGroupId || null;
        this.renderEditor();
    }

    async renderViewer() {
        this.showLoading('클라우드 데이터를 불러오는 중...');
        const dateStr = this.dateStr;

        try { this.myGroups = await dbAPI.loadMyGroups(); } catch(e) { this.myGroups = []; }
        
        window.currentMyGroups = this.myGroups;
        if (!window.activeUnifiedFilters) window.activeUnifiedFilters = ['personal', ...this.myGroups.map(g => g.id)];
        if (window.FilterUI) window.FilterUI.renderUnifiedFilter(this.myGroups);
        if (store.mode === 'editor') this.scheduleGroupId = window.activeUnifiedFilters.includes('personal') ? null : window.activeUnifiedFilters[0];

        let allEvents = [];
        const eventDoc = await getDoc(doc(getUserCol('events'), dateStr));
        if (eventDoc.exists()) {
            let pEvents = this.parseEvents(eventDoc.data());
            pEvents.forEach(e => { e.sharedGroupId = null; });
            allEvents = allEvents.concat(pEvents);
        }
        for (const g of this.myGroups) {
            const gData = await dbAPI.loadGroupDayData(dateStr, g.id);
            const gEvents = gData.eventList || [];
            gEvents.forEach(e => { e.sharedGroupId = g.id; e.groupName = g.name; });
            allEvents = allEvents.concat(gEvents);
        }
        
        const viewableEvents = allEvents
            .filter(e => window.activeUnifiedFilters.includes(e.sharedGroupId || 'personal'))
            .map(e => ({
                ...e,
                content: (e.sharedGroupId ? `<span style="display:inline-block; padding:2px 6px; font-size:0.75rem; border-radius:4px; background:#e0f2fe; color:#0369a1; border:1px solid #bae6fd; margin-right:4px; vertical-align:middle; font-weight:bold;">👥 ${e.groupName}</span> ` : '') + e.content
            }));

        const allSchedules = {};
        const pSchedDoc = await getDoc(doc(getUserCol('schedules'), dateStr));
        allSchedules['personal'] = pSchedDoc.exists() ? (pSchedDoc.data().periods || {}) : {};

        for (const g of this.myGroups) {
            const gSchedDoc = await getDoc(doc(getGroupCol(g.id, 'schedules'), dateStr));
            allSchedules[g.id] = gSchedDoc.exists() ? (gSchedDoc.data().periods || {}) : {};
        }
        
        this.currentEvalList = await this.loadEvaluationsForDay(dateStr);
        
        const journalDoc = await getDoc(doc(getUserCol('journals'), dateStr));
        const journals = journalDoc.exists() ? journalDoc.data().entries || [] : [];

        const periodRowsHtml = Array.from({ length: this.maxPeriod }).map((_, i) => {
            const p = i + 1;
            const periodName = store.periodNames[i] || p + '교시';
            
            let subjectHtml = '';
            let memoHtml = '';
            let suppliesHtml = '';
            
            window.activeUnifiedFilters.forEach((filterId, idx) => {
                const pObj = allSchedules[filterId]?.[p] || {};
                const isLast = idx === window.activeUnifiedFilters.length - 1;
                const borderStyle = isLast ? '' : 'border-bottom: 1px dashed #cbd5e1; padding-bottom:8px; margin-bottom:8px;';
                
                let badge = '';
                if (window.activeUnifiedFilters.length > 1) {
                    const groupName = filterId === 'personal' ? '🔒 개인' : '👥 ' + (this.myGroups.find(g => g.id === filterId)?.name || '');
                    const badgeColor = filterId === 'personal' ? '#2563eb' : '#059669';
                    const badgeBg = filterId === 'personal' ? '#eff6ff' : '#ecfdf5';
                    badge = `<div style="font-size:0.7rem; color:${badgeColor}; background:${badgeBg}; padding:2px 4px; border-radius:4px; display:inline-block; margin-bottom:4px; font-weight:bold;">${groupName}</div><br>`;
                }

                subjectHtml += `<div style="${borderStyle} min-height:24px; font-weight:bold; color:#0f172a;">${pObj.subject ? badge + pObj.subject : badge}</div>`;
                memoHtml += `<div style="${borderStyle} min-height:24px; text-align: left; color:#334155; white-space:pre-wrap;">${pObj.memo || ''}</div>`;
                suppliesHtml += `<div style="${borderStyle} min-height:24px; color: #d97706; font-weight: 600; text-align: left; white-space:pre-wrap;">${pObj.supplies || ''}</div>`;
            });
            
            const evalBadges = this.generateEvalBadgesHtml('schedule', p);

            return `
                <tr data-period="${p}">
                    <td style="font-weight:900; color:#475569; background:#f8fafc; vertical-align:middle;">${periodName}</td>
                    <td style="vertical-align:top; padding:10px 8px;">${subjectHtml}</td>
                    <td style="vertical-align:top; padding:10px 8px;">${memoHtml}</td>
                    <td style="vertical-align:top; padding:10px 8px;">
                        ${suppliesHtml}
                        <div style="display:flex; align-items:center; flex-wrap:wrap; gap:6px; margin-top:4px;">
                            <div class="eval-badges-container" style="display:flex; flex-wrap:wrap; gap:6px;">
                                ${evalBadges}
                            </div>
                        </div>
                    </td>
                </tr>`;
        }).join('');

        const journalsHtml = journals.length > 0 ? journals.map(j => {
            const lNames = j.labelIds?.map(id => getJournalLabels().find(l => l.id === id)?.name).filter(Boolean) || j.labels || (j.label ? [j.label] : []);
            const chipsHtml = lNames.map(lName => {
                const style = getLabelStyle(lName, 'journal') || { bg: '#fdf2f8', text: '#9d174d', border: '#fbcfe8' };
                return `<span style="display:inline-block; padding:2px 6px; font-size:0.8rem; font-weight:bold; border-radius:4px; background:${style.bg}; color:${style.text}; border:1px solid ${style.border}; margin-right:6px; white-space:nowrap; vertical-align:middle;">${lName}</span>`;
            }).join('');

            return `
                <div style="display:flex; align-items:flex-start; margin-bottom:8px; line-height:1.4;">
                    <div style="margin-top:1px; flex-shrink:0;">${chipsHtml}</div>
                    <div style="font-size:1rem; color:#1e293b; white-space:pre-wrap; word-break:break-all; flex:1;">${j.content || ''}</div>
                </div>`;
        }).join('') : `<p style="color:#94a3b8; font-size:0.95rem; margin:0;">등록된 기록이 없습니다.</p>`;

        this.container.innerHTML = `
          <div class="day-viewer-container">
            <div class="day-event-section" style="background: #fff; padding: 15px; border-radius: 8px; border: 1px solid #cbd5e1; box-shadow: 0 1px 3px rgba(0,0,0,0.05); border-left: 5px solid #2563eb;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; flex-wrap:wrap; gap:10px;">
                  <h3 style="font-size:1.2rem; color:#1e40af; margin:0; font-weight:bold;">📌 오늘 할 일</h3>
              </div>
              ${window.generateEventBadgesHTML(viewableEvents, dateStr, 'normal') || '<p style="color:#94a3b8; font-size:0.95rem; margin:0;">등록된 일정이 없습니다.</p>'}
            </div>
            
            <div class="table-container" style="margin-top:10px; ${store.showClass ? '' : 'display:none;'}">
              <table style="text-align: center;">
                <thead>
                  <tr>
                    <th style="width: 60px;">교시</th>
                    <th style="width: 120px;">수업</th>
                    <th>📝 수업 메모</th>
                    <th style="width: 25%; position:relative;">📌 비고
                        <button onclick="window.EvaluationManager.currentGroupId = '${this.scheduleGroupId || ''}'; window.EvaluationManager.openCreationModal('${dateStr}', 'schedule')" style="margin-left:8px; padding:3px 10px; background:#e0f2fe; color:#0284c7; border:1px solid #7dd3fc; border-radius:6px; font-size:0.8rem; cursor:pointer; font-weight:bold; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">+ 조사표</button>
                    </th>
                  </tr>
                </thead>
                <tbody>${periodRowsHtml}</tbody>
              </table>
            </div>

            <div class="day-journal-section" style="margin-top: 15px; background: #fff; padding: 15px; border-radius: 8px; border: 1px solid #cbd5e1; box-shadow: 0 1px 3px rgba(0,0,0,0.05); border-left: 5px solid #be185d;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                  <h3 style="font-size:1.2rem; color:#be185d; margin:0; font-weight:bold;">📔 오늘 기록 <span style="font-size:0.8rem; color:#f472b6; font-weight:normal;">(🔒 비공개)</span></h3>
              </div>
              <div class="journal-eval-badges-container" style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:10px; ${this.generateEvalBadgesHtml('journal') ? '' : 'display:none;'}">
                  ${this.generateEvalBadgesHtml('journal')}
              </div>
              <div style="display:flex; flex-direction:column;">${journalsHtml}</div>
            </div>
          </div>`;
    }

    async renderEditor() {
        this.showLoading('편집 화면을 준비 중...');
        const dateStr = this.dateStr;
        
        try { this.myGroups = await dbAPI.loadMyGroups(); } catch(e) { this.myGroups = []; }

        window.currentMyGroups = this.myGroups;
        if (!window.activeUnifiedFilters) window.activeUnifiedFilters = ['personal', ...this.myGroups.map(g => g.id)];
        if (window.FilterUI) window.FilterUI.renderUnifiedFilter(this.myGroups);
        if (store.mode === 'editor') this.scheduleGroupId = window.activeUnifiedFilters.includes('personal') ? null : window.activeUnifiedFilters[0];

        let allEvents = [];
        const eventDoc = await getDoc(doc(getUserCol('events'), dateStr));
        if (eventDoc.exists()) {
            let pEvents = this.parseEvents(eventDoc.data());
            pEvents.forEach(e => { e.sharedGroupId = null; });
            allEvents = allEvents.concat(pEvents);
        }
        for (const g of this.myGroups) {
            const gData = await dbAPI.loadGroupDayData(dateStr, g.id);
            const gEvents = gData.eventList || [];
            gEvents.forEach(e => { e.sharedGroupId = g.id; e.groupName = g.name; });
            allEvents = allEvents.concat(gEvents);
        }
        
        const masterLabels = getEventLabels();
        this.currentEvents = allEvents.map(e => {
            let labelIds = e.labelIds || [];
            if (labelIds.length === 0 && (e.labels || e.label)) {
                (e.labels || [e.label]).forEach(name => {
                    const match = masterLabels.find(l => l.name === name);
                    if (match && match.id && !labelIds.includes(match.id)) labelIds.push(match.id);
                });
            }
            return { ...e, labelIds };
        });
        
        if (this.currentEvents.length === 0) {
            this.currentEvents.push({ 
                id: 'ev_' + Date.now() + Math.random().toString(36).substr(2,5),
                authorId: window.auth?.currentUser?.uid,
                labelIds: [], content: '', completed: false, sharedGroupId: null 
            });
        }

        let scheduleDoc;
        if (this.scheduleGroupId) {
            scheduleDoc = await getDoc(doc(getGroupCol(this.scheduleGroupId, 'schedules'), dateStr));
        } else {
            scheduleDoc = await getDoc(doc(getUserCol('schedules'), dateStr));
        }
        this.currentSchedules = scheduleDoc.exists() ? (scheduleDoc.data().periods || {}) : {};
        
        this.currentEvalList = await this.loadEvaluationsForDay(dateStr);
        
        const journalDoc = await getDoc(doc(getUserCol('journals'), dateStr));
        const journals = journalDoc.exists() ? journalDoc.data().entries || [] : [];
        this.currentJournals = journals.map(j => ({ ...j, labelIds: j.labelIds || [] }));
        if (this.currentJournals.length === 0) this.currentJournals.push({ labelIds: [], content: '' });

        const wsSelectHtml = `
            <div style="display:inline-flex; background:#f0fdf4; padding:3px; border-radius:8px; border:1px solid #bbf7d0; align-items:center;">
                <div onclick="window.dayViewInstance.changeScheduleWorkspace(null)" style="padding:4px 12px; font-size:0.85rem; border-radius:6px; cursor:pointer; font-weight:bold; transition:0.2s; ${!this.scheduleGroupId ? 'background:#fff; color:#0f766e; box-shadow:0 1px 3px rgba(0,0,0,0.1);' : 'color:#94a3b8;'}">🔒 개인 시간표 작업공간</div>
                ${this.myGroups.map(g => `<div onclick="window.dayViewInstance.changeScheduleWorkspace('${g.id}')" style="padding:4px 12px; font-size:0.85rem; border-radius:6px; cursor:pointer; font-weight:bold; transition:0.2s; ${this.scheduleGroupId === g.id ? 'background:#fff; color:#0f766e; box-shadow:0 1px 3px rgba(0,0,0,0.1);' : 'color:#94a3b8;'}">👥 ${g.name} 편집</div>`).join('')}
            </div>
        `;

        const periodRowsHtml = Array.from({ length: this.maxPeriod }).map((_, i) => {
          const p = i + 1;
          const pObj = this.currentSchedules[p] || {};
          const periodName = store.periodNames[i] || p + '교시';
          
          const evalBadges = this.generateEvalBadgesHtml('schedule', p);
          
          return `
            <tr id="period-row-${p}" data-period="${p}" 
                ondragstart="window.dayViewInstance.handlePeriodDragStart(event, ${p})"
                ondragend="window.dayViewInstance.handlePeriodDragEnd(event)"
                ondragenter="event.preventDefault(); this.style.backgroundColor='#e2e8f0';"
                ondragover="event.preventDefault(); event.dataTransfer.dropEffect='move';"
                ondragleave="this.style.backgroundColor='';"
                ondrop="event.preventDefault(); this.style.backgroundColor=''; window.dayViewInstance.handlePeriodDrop(event, ${p});"
                style="transition: background-color 0.2s;">
              
              <td class="period-cell" 
                  onmouseenter="document.getElementById('period-row-${p}').setAttribute('draggable', 'true')"
                  onmouseleave="document.getElementById('period-row-${p}').removeAttribute('draggable')"
                  style="padding:4px; vertical-align:middle; text-align:center; background:#f8fafc; cursor:grab;" title="이곳을 드래그하여 사이에 끼워넣기">
                  <div style="display:flex; align-items:center; justify-content:center; gap:6px; pointer-events:none;">
                      <span style="font-size:1.2rem; color:#94a3b8;">≡</span>
                      <span style="font-weight:900; color:#475569; font-size:0.95rem;">${periodName}</span>
                  </div>
              </td>
              <td class="editable-cell cell-subject" contenteditable="true" oninput="window.dayViewInstance.syncScheduleInputs()">${pObj.subject || ''}</td>
              <td class="editable-cell cell-memo" contenteditable="true" style="text-align: left;" oninput="window.dayViewInstance.syncScheduleInputs()">${pObj.memo || ''}</td>
              <td style="text-align: left; vertical-align: top;">
                <div class="editable-cell cell-supplies" contenteditable="true" style="color: #d97706; font-weight: 600; min-height:20px; outline:none;" oninput="window.dayViewInstance.syncScheduleInputs()">${pObj.supplies || ''}</div>
                <div contenteditable="false" style="display:flex; align-items:center; flex-wrap:wrap; gap:6px; margin-top:4px;">
                    <div class="eval-badges-container" style="display:flex; flex-wrap:wrap; gap:6px;">
                        ${evalBadges}
                    </div>
                </div>
              </td>
            </tr>`;
        }).join('');

        this.container.innerHTML = `
          <style>
            .table-container.is-dragging .editable-cell { pointer-events: none !important; user-select: none !important; }
          </style>

          <div class="day-viewer-container">
            <div class="day-event-editor-section" style="background: #fff; padding: 15px; border-radius: 8px; border: 1px solid #cbd5e1; box-shadow: 0 1px 3px rgba(0,0,0,0.05); border-left: 5px solid #2563eb;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 15px; flex-wrap:wrap; gap:10px;">
                <h3 style="font-size:1.2rem; color:#1e40af; margin:0; font-weight:bold;">📌 오늘 할 일</h3>
                <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                    <button onclick="window.openEventLabelModal()" style="background:#f8fafc; border:1px solid #cbd5e1; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:0.85rem; font-weight:bold;">⚙️ 설정</button>
                </div>
              </div>
              <div id="event-entries-container" style="width: 100%;"></div>
              <button onclick="window.dayViewInstance.addEventEntry()" style="width:100%; padding:10px; margin-top:5px; background:#eff6ff; color:#2563eb; border:2px dashed #bfdbfe; border-radius:8px; cursor:pointer; font-weight:bold; font-size:1rem; transition:0.2s;">+ 일정 추가</button>
            </div>

            <div class="table-container" style="margin-top:10px; ${store.showClass ? '' : 'display:none;'}">
              <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:6px;">
                  <div style="font-size:0.8rem; color:#64748b;">💡 왼쪽 '≡' 영역을 잡아 다른 교시로 끌어다 놓으면 해당 위치로 끼워넣어집니다.</div>
                  <div>${wsSelectHtml}</div>
              </div>
              <table style="text-align: center;">
                <thead>
                  <tr>
                    <th style="width: 75px;">교시</th>
                    <th style="width: 120px;">수업</th>
                    <th>📝 수업 메모</th>
                    <th style="width: 25%; position:relative;">📌 비고
                        <button onclick="window.EvaluationManager.currentGroupId = '${this.scheduleGroupId || ''}'; window.EvaluationManager.openCreationModal('${dateStr}', 'schedule')" style="margin-left:8px; padding:3px 10px; background:#e0f2fe; color:#0284c7; border:1px solid #7dd3fc; border-radius:6px; font-size:0.8rem; cursor:pointer; font-weight:bold; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">+ 조사표</button>
                    </th>
                  </tr>
                </thead>
                <tbody>${periodRowsHtml}</tbody>
              </table>
            </div>

            <div class="day-journal-editor-section" style="margin-top: 15px; background: #fff; padding: 15px; border-radius: 8px; border: 1px solid #cbd5e1; box-shadow: 0 1px 3px rgba(0,0,0,0.05); border-left: 5px solid #be185d;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 15px;">
                <h3 style="font-size:1.2rem; color:#be185d; margin:0; font-weight:bold;">📔 오늘 기록 <span style="font-size:0.8rem; color:#f472b6; font-weight:normal;">(🔒 비공개)</span></h3>
                <button onclick="window.openJournalLabelModal()" style="background:#fdf2f8; border:1px solid #fbcfe8; padding:4px 10px; border-radius:6px; cursor:pointer; font-size:0.85rem; font-weight:bold; color:#be185d;">⚙️ 설정</button>
              </div>
              <div class="journal-eval-badges-container" style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:10px; ${this.generateEvalBadgesHtml('journal') ? '' : 'display:none;'}">
                  ${this.generateEvalBadgesHtml('journal')}
              </div>
              <div id="journal-entries-container" style="width: 100%;"></div>
              <button onclick="window.dayViewInstance.addJournalEntry()" style="width:100%; padding:10px; margin-top:5px; background:#fdf2f8; color:#be185d; border:2px dashed #f472b6; border-radius:8px; cursor:pointer; font-weight:bold; font-size:1rem; transition:0.2s;">+ 기록 추가</button>
            </div>
          </div>`;
        
        setTimeout(() => {
          this.renderEventEntries();
          this.renderJournalEntries();
        }, 0);
    }

    handlePeriodDragStart(event, period) {
        window.dayViewInstance.draggedPeriod = period;
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', String(period)); 
        setTimeout(() => {
            const row = event.target.closest('tr');
            if (row) row.style.opacity = '0.4';
            const tableContainer = window.dayViewInstance.container.querySelector('.table-container');
            if (tableContainer) tableContainer.classList.add('is-dragging'); 
        }, 0);
    }

    handlePeriodDragEnd(event) {
        const tbody = window.dayViewInstance.container.querySelector('tbody');
        if (tbody) {
            tbody.querySelectorAll('tr').forEach(tr => { 
                tr.style.opacity = '1'; 
                tr.style.backgroundColor = '';
                tr.removeAttribute('draggable');
            });
        }
        const tableContainer = window.dayViewInstance.container.querySelector('.table-container');
        if (tableContainer) tableContainer.classList.remove('is-dragging');
        window.dayViewInstance.draggedPeriod = null;
    }

    handlePeriodDrop(event, targetPeriod) {
        event.preventDefault();
        event.stopPropagation();
        
        const tableContainer = window.dayViewInstance.container.querySelector('.table-container');
        if (tableContainer) tableContainer.classList.remove('is-dragging');
        
        let sourcePeriodStr = '';
        try { sourcePeriodStr = event.dataTransfer.getData('text/plain'); } catch(e) {}
        
        const sourcePeriod = parseInt(sourcePeriodStr, 10) || window.dayViewInstance.draggedPeriod;
        if (!sourcePeriod || sourcePeriod === targetPeriod) return;

        window.dayViewInstance.executeClassInsert(sourcePeriod, targetPeriod);
        window.dayViewInstance.draggedPeriod = null;
    }

    executeClassInsert(sourceP, targetP) {
        if (sourceP === targetP) return;
        
        this.syncScheduleInputs();
        this.syncEventInputs();
        this.syncJournalInputs();

        const s = parseInt(sourceP, 10);
        const t = parseInt(targetP, 10);

        const sourceData = this.currentSchedules[s] ? { ...this.currentSchedules[s] } : null;

        if (s < t) {
            for (let i = s; i < t; i++) {
                if (this.currentSchedules[i + 1]) this.currentSchedules[i] = { ...this.currentSchedules[i + 1] };
                else delete this.currentSchedules[i];
            }
        } else {
            for (let i = s; i > t; i--) {
                if (this.currentSchedules[i - 1]) this.currentSchedules[i] = { ...this.currentSchedules[i - 1] };
                else delete this.currentSchedules[i];
            }
        }

        if (sourceData) this.currentSchedules[t] = sourceData;
        else delete this.currentSchedules[t];

        let evalChanged = false;
        this.currentEvalList.forEach(ev => {
            const eSource = ev.context?.source || (ev.periodStr ? 'schedule' : 'journal');
            if (eSource === 'schedule') {
                const savedPeriod = ev.periodStr || ev.context?.period || '';
                const p = parseInt(String(savedPeriod).replace(/[^0-9]/g, ''), 10);
                
                if (p === s) {
                    ev.periodStr = String(t);
                    if (ev.context) ev.context.period = t;
                    evalChanged = true;
                } else if (s < t && p > s && p <= t) {
                    ev.periodStr = String(p - 1);
                    if (ev.context) ev.context.period = p - 1;
                    evalChanged = true;
                } else if (s > t && p >= t && p < s) {
                    ev.periodStr = String(p + 1);
                    if (ev.context) ev.context.period = p + 1;
                    evalChanged = true;
                }
            }
        });

        store.hasUnsavedChanges = true;

        const tbody = this.container.querySelector('tbody');
        if (tbody) {
            tbody.innerHTML = Array.from({ length: this.maxPeriod }).map((_, i) => {
                const p = i + 1;
                const pObj = this.currentSchedules[p] || {};
                const periodName = store.periodNames[i] || p + '교시';
                const evalBadges = this.generateEvalBadgesHtml('schedule', p);
                
                return `
                <tr id="period-row-${p}" data-period="${p}" 
                    ondragstart="window.dayViewInstance.handlePeriodDragStart(event, ${p})"
                    ondragend="window.dayViewInstance.handlePeriodDragEnd(event)"
                    ondragenter="event.preventDefault(); this.style.backgroundColor='#e2e8f0';"
                    ondragover="event.preventDefault(); event.dataTransfer.dropEffect='move';"
                    ondragleave="this.style.backgroundColor='';"
                    ondrop="event.preventDefault(); this.style.backgroundColor=''; window.dayViewInstance.handlePeriodDrop(event, ${p});"
                    style="transition: background-color 0.2s;">
                  
                  <td class="period-cell" 
                      onmouseenter="document.getElementById('period-row-${p}').setAttribute('draggable', 'true')"
                      onmouseleave="document.getElementById('period-row-${p}').removeAttribute('draggable')"
                      style="padding:4px; vertical-align:middle; text-align:center; background:#f8fafc; cursor:grab;" title="이곳을 드래그하여 사이에 끼워넣기">
                      <div style="display:flex; align-items:center; justify-content:center; gap:6px; pointer-events:none;">
                          <span style="font-size:1.2rem; color:#94a3b8;">≡</span>
                          <span style="font-weight:900; color:#475569; font-size:0.95rem;">${periodName}</span>
                      </div>
                  </td>
                  <td class="editable-cell cell-subject" contenteditable="true" oninput="window.dayViewInstance.syncScheduleInputs()">${pObj.subject || ''}</td>
                  <td class="editable-cell cell-memo" contenteditable="true" style="text-align: left;" oninput="window.dayViewInstance.syncScheduleInputs()">${pObj.memo || ''}</td>
                  <td style="text-align: left; vertical-align: top;">
                    <div class="editable-cell cell-supplies" contenteditable="true" style="color: #d97706; font-weight: 600; min-height:20px; outline:none;" oninput="window.dayViewInstance.syncScheduleInputs()">${pObj.supplies || ''}</div>
                    <div contenteditable="false" style="display:flex; align-items:center; flex-wrap:wrap; gap:6px; margin-top:4px;">
                        <div class="eval-badges-container" style="display:flex; flex-wrap:wrap; gap:6px;">
                            ${evalBadges}
                        </div>
                    </div>
                  </td>
                </tr>`;
            }).join('');
        }

        if (evalChanged) {
            const scheduleEvals = this.currentEvalList.filter(e => e.context?.source === 'schedule');
            const journalEvals = this.currentEvalList.filter(e => e.context?.source === 'journal');
            
            dbAPI.saveEvaluations(this.dateStr, scheduleEvals, this.scheduleGroupId).catch(e => console.warn(e));
            if (journalEvals.length > 0) {
                dbAPI.saveEvaluations(this.dateStr, journalEvals, null).catch(e => console.warn(e));
            }
        }
        
        if (typeof window.saveCurrentViewData === 'function') {
            window.saveCurrentViewData(true);
        } else {
            this.save();
            store.hasUnsavedChanges = false;
        }
    }

    renderEventEntries() {
        const container = document.getElementById('event-entries-container');
        if(!container) return;
        
        const allLabelsObj = getEventLabels();
        const uid = window.auth?.currentUser?.uid;

        container.innerHTML = this.currentEvents.map((ev, idx) => {
            const isVisible = window.activeUnifiedFilters.includes(ev.sharedGroupId || 'personal');
            const displayStyle = isVisible ? 'display:flex;' : 'display:none;';
            const isAuthor = !ev.authorId || !uid || ev.authorId === uid;

            const eLabelIds = ev.labelIds || [];
            const isCompleted = !!ev.completed;
            const canComplete = eLabelIds.some(id => allLabelsObj.find(l => l.id === id)?.isForward);

            let groupButtonsHtml = '';
            if (isAuthor) {
                groupButtonsHtml = `
                    <div style="display:inline-flex; background:#f1f5f9; padding:2px; border-radius:6px; border:1px solid #cbd5e1; align-items:center;">
                        <div onclick="window.dayViewInstance.changeEventGroup(${idx}, null)" style="padding:3px 8px; font-size:0.75rem; border-radius:4px; cursor:pointer; font-weight:bold; transition:0.2s; ${!ev.sharedGroupId ? 'background:#fff; color:#2563eb; box-shadow:0 1px 3px rgba(0,0,0,0.1);' : 'color:#64748b;'}">🔒 개인</div>
                        ${this.myGroups.map(g => `<div onclick="window.dayViewInstance.changeEventGroup(${idx}, '${g.id}')" style="padding:3px 8px; font-size:0.75rem; border-radius:4px; cursor:pointer; font-weight:bold; transition:0.2s; ${ev.sharedGroupId === g.id ? 'background:#fff; color:#2563eb; box-shadow:0 1px 3px rgba(0,0,0,0.1);' : 'color:#64748b;'}">👥 ${g.name}</div>`).join('')}
                    </div>
                `;
            } else {
                groupButtonsHtml = `<div style="padding:3px 8px; font-size:0.75rem; border-radius:4px; font-weight:bold; background:#e0f2fe; color:#0369a1; border:1px solid #bae6fd;">👥 ${ev.groupName} (읽기전용)</div>`;
            }

            let delHandler = `window.dayViewInstance.removeEventEntry(${idx})`;
            let forwardedBadge = '';

            if (ev.groupId || (ev.forwardChainId && ev.originalDate && ev.originalDate !== this.dateStr)) {
                const isRecurring = !!ev.groupId; 
                if (isRecurring) {
                    delHandler = `window.showGroupDeleteModal('${this.dateStr}', '${eLabelIds[0]||''}', \`${(ev.content || '').replace(/`/g, '\\`')}\`, '${ev.groupId}', () => { window.dayViewInstance.currentEvents.splice(${idx}, 1); window.dayViewInstance.renderEventEntries(); store.hasUnsavedChanges = true; }, () => { window.dayViewInstance.currentEvents.splice(${idx}, 1); window.dayViewInstance.renderEventEntries(); store.hasUnsavedChanges = true; })`;
                } else {
                    delHandler = `window.showForwardDeleteModal('${this.dateStr}', '${eLabelIds[0]||''}', \`${(ev.content || '').replace(/`/g, '\\`')}\`, '${ev.forwardChainId}', () => { window.dayViewInstance.currentEvents.splice(${idx}, 1); window.dayViewInstance.renderEventEntries(); store.hasUnsavedChanges = true; })`;
                    forwardedBadge = `<div style="font-size:0.75rem; font-weight:bold; color:#059669; background:#dcfce3; padding:2px 6px; border-radius:4px; border:1px solid #bbf7d0;">↪️ 이월됨</div>`;
                }
            }

            const deleteBtnHtml = isAuthor 
                ? `<button class="modal-delete-btn" onclick="${delHandler}" title="일정 삭제" style="margin:0; background:transparent; border:none; color:#ef4444; font-size:1.1rem; cursor:pointer;">✖</button>`
                : '';

            const chipsHtml = allLabelsObj.map(lObj => {
                const chipClickAttr = isAuthor ? `onclick="window.dayViewInstance.toggleEventLabel(${idx}, '${lObj.id}')"` : '';
                const chipCursorStyle = isAuthor ? 'cursor:pointer;' : 'cursor:not-allowed; opacity:0.8;';
                return `<div class="label-chip ${eLabelIds.includes(lObj.id) ? 'active' : ''}" ${chipClickAttr} style="padding:2px 8px; font-size:0.8rem; min-width:auto; ${chipCursorStyle}">${lObj.name}</div>`;
            }).join('');

            const checkboxHtml = canComplete 
                ? `<div style="padding-top:8px;"><input type="checkbox" ${isCompleted ? 'checked' : ''} ${!isAuthor ? 'disabled' : ''} onchange="window.dayViewInstance.updateEventStatus(${idx}, this.checked)" style="width:18px; height:18px; cursor:pointer; accent-color:#059669;" title="완료 체크"></div>`
                : '';

            const textBaseStyle = (isCompleted && canComplete) ? 'text-decoration:line-through; color:#94a3b8; background:#e2e8f0;' : 'background:#fff; color:#1e293b;';
            const textStyle = !isAuthor ? 'background:#f1f5f9; color:#64748b; cursor:not-allowed;' : textBaseStyle;
            const pureContent = (ev.content || '').replace(/➡️\s*\(미완료\)/g, '').replace(/➡️\s*\(다음 날로 이월됨\)/g, '').replace(/↪️\s*/g, '').trim();

            // 🌟 [변경됨] 일정 입력칸에 autoResize 함수 연결
            return `
            <div style="${displayStyle} flex-direction:column; padding:10px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; margin-bottom:12px; transition:0.2s;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
                    <div class="label-chip-container" style="margin:0; display:flex; flex-wrap:wrap; gap:6px; align-items:center; flex:1;">
                        ${chipsHtml}
                        ${forwardedBadge}
                    </div>
                    <div style="display:flex; align-items:center; gap:8px; flex-shrink:0;">
                        ${groupButtonsHtml}
                        ${deleteBtnHtml}
                    </div>
                </div>
                <div style="display:flex; align-items:flex-start; gap:8px; width:100%;">
                    ${checkboxHtml}
                    <textarea class="modal-input-text" ${!isAuthor ? 'readonly' : ''} placeholder="${isAuthor ? '일정 내용 입력...' : '권한이 없습니다.'}" style="flex:1; min-height:40px; resize:none; overflow:hidden; font-size:0.95rem; padding:8px; box-sizing:border-box; border:1px solid #cbd5e1; border-radius:4px; outline:none; ${textStyle}" onfocus="window.dayViewInstance.autoResize(this)" oninput="window.dayViewInstance.autoResize(this); window.dayViewInstance.updateEventContent(${idx}, this.value)">${pureContent}</textarea>
                </div>
            </div>`;
        }).join('');

        // 🌟 [추가됨] 화면 렌더링 직후 높이 자동 맞춤 실행
        setTimeout(() => {
            container.querySelectorAll('textarea').forEach(ta => this.autoResize(ta));
        }, 0);
    }

    renderJournalEntries() {
        const container = document.getElementById('journal-entries-container');
        if(!container) return;
        const allLabelsObj = getJournalLabels();

        container.innerHTML = this.currentJournals.map((j, idx) => {
            const jLabelIds = j.labelIds || [];
            const chipsHtml = allLabelsObj.map(lObj => 
                `<div class="label-chip ${jLabelIds.includes(lObj.id) ? 'active' : ''}" onclick="window.dayViewInstance.toggleJournalLabel(${idx}, '${lObj.id}')" style="padding:2px 8px; font-size:0.8rem; min-width:auto; cursor:pointer;">${lObj.name}</div>`
            ).join('');

            // 🌟 [변경됨] 오늘 기록 입력칸에 autoResize 함수 연결
            return `
            <div style="display:flex; flex-direction:column; gap:8px; margin-bottom:12px; padding:10px; background:#fdf2f8; border:1px solid #fbcfe8; border-radius:6px; position:relative;">
                <div style="position:absolute; top:8px; right:8px;">
                    <button class="modal-delete-btn" onclick="window.dayViewInstance.removeJournalEntry(${idx})" title="기록 삭제" style="margin:0; color:#be185d;">✖</button>
                </div>
                <div class="label-chip-container" style="margin:0; padding-right:24px; display:flex; flex-wrap:wrap; gap:4px;">${chipsHtml}</div>
                <textarea class="modal-input-text" placeholder="학급 기록, 상담, 업무 일지 등을 입력하세요..." style="width:100%; min-height:60px; resize:none; overflow:hidden; font-size:0.95rem; padding:8px; box-sizing:border-box; outline:none; border:1px solid #fbcfe8; border-radius:4px;" onfocus="window.dayViewInstance.autoResize(this)" oninput="window.dayViewInstance.autoResize(this); window.dayViewInstance.updateJournalContent(${idx}, this.value)">${j.content || ''}</textarea>
            </div>`;
        }).join('');

        // 🌟 [추가됨] 화면 렌더링 직후 높이 자동 맞춤 실행
        setTimeout(() => {
            container.querySelectorAll('textarea').forEach(ta => this.autoResize(ta));
        }, 0);
    }

    changeEventGroup(idx, newGroupId) {
        this.syncEventInputs(); 
        store.hasUnsavedChanges = true;
        if (this.currentEvents[idx]) {
            this.currentEvents[idx].sharedGroupId = newGroupId || null;
            const g = this.myGroups.find(g => g.id === newGroupId);
            this.currentEvents[idx].groupName = g ? g.name : '';
            this.renderEventEntries(); 
        }
    }

    toggleEventLabel(idx, labelId) {
        this.syncEventInputs();
        store.hasUnsavedChanges = true;
        const ev = this.currentEvents[idx];
        if (!ev) return;
        
        const labelObj = getEventLabels().find(l => l.id === labelId);
        ev.labelIds = ev.labelIds || [];

        if (ev.labelIds.includes(labelId)) {
            ev.labelIds = ev.labelIds.filter(id => id !== labelId);
        } else {
            if (labelObj?.isPeriod || labelObj?.isRecur) {
                const evContent = ev.content || '';
                const callback = (success) => {
                    if (success) {
                        this.currentEvents.splice(idx, 1);
                        this.renderEventEntries();
                    }
                };
                if (labelObj.isPeriod) window.openPeriodModal(this.dateStr, labelObj.name, evContent, callback, labelId);
                else if (labelObj.isRecur) window.openRecurringModal(this.dateStr, labelObj.name, evContent, callback, labelId);
                return; 
            }
            if (labelObj?.isForward) ev.labelIds = ev.labelIds.filter(id => !getEventLabels().find(x => x.id === id)?.isPeriod && !getEventLabels().find(x => x.id === id)?.isRecur);
            ev.labelIds.push(labelId);
        }
        this.renderEventEntries();
    }

    updateEventStatus(idx, isCompleted) {
        store.hasUnsavedChanges = true;
        if (this.currentEvents[idx]) this.currentEvents[idx].completed = isCompleted;
        this.renderEventEntries();
    }

    updateEventContent(idx, val) {
        store.hasUnsavedChanges = true;
        if (this.currentEvents[idx]) this.currentEvents[idx].content = val;
    }

    toggleJournalLabel(idx, labelId) {
        this.syncJournalInputs();
        store.hasUnsavedChanges = true;
        const j = this.currentJournals[idx];
        if (!j) return;
        j.labelIds = j.labelIds || [];
        j.labelIds = j.labelIds.includes(labelId) ? j.labelIds.filter(id => id !== labelId) : [...j.labelIds, labelId];
        this.renderJournalEntries();
    }

    updateJournalContent(idx, val) {
        store.hasUnsavedChanges = true;
        if (this.currentJournals[idx]) this.currentJournals[idx].content = val;
    }

    addEventEntry() {
        this.syncEventInputs();
        this.currentEvents.push({ 
            id: 'ev_' + Date.now() + Math.random().toString(36).substr(2,5),
            authorId: window.auth?.currentUser?.uid,
            labelIds: [], content: '', completed: false, sharedGroupId: null 
        });
        this.renderEventEntries();
        store.hasUnsavedChanges = true;
    }

    removeEventEntry(index) {
        this.syncEventInputs();
        this.currentEvents.splice(index, 1);
        this.renderEventEntries();
        store.hasUnsavedChanges = true;
    }

    addJournalEntry() {
        this.syncJournalInputs();
        this.currentJournals.push({ labelIds: [], content: '' });
        this.renderJournalEntries();
        store.hasUnsavedChanges = true;
    }

    removeJournalEntry(index) {
        this.syncJournalInputs();
        this.currentJournals.splice(index, 1);
        this.renderJournalEntries();
        store.hasUnsavedChanges = true;
    }

    syncEventInputs() {
        document.getElementById('event-entries-container')?.querySelectorAll('textarea').forEach((ta, idx) => {
            if (this.currentEvents[idx]) this.currentEvents[idx].content = ta.value; 
        });
    }

    syncJournalInputs() {
        document.getElementById('journal-entries-container')?.querySelectorAll('textarea').forEach((ta, idx) => {
            if (this.currentJournals[idx]) this.currentJournals[idx].content = ta.value; 
        });
    }

    syncScheduleInputs() {
        const tbody = this.container.querySelector('tbody');
        if (!tbody) return;
        this.currentSchedules = {};
        tbody.querySelectorAll('tr[data-period]').forEach(row => {
            const p = row.getAttribute('data-period');
            const subject = row.querySelector('.cell-subject').innerText.trim();
            const memo = row.querySelector('.cell-memo').innerText.trim();
            const supplies = row.querySelector('.cell-supplies').innerText.trim();
            if (subject || memo || supplies) this.currentSchedules[p] = { subject, memo, supplies };
        });
        store.hasUnsavedChanges = true;
    }

    save() {
        const dateStr = this.dateStr;
        
        this.syncEventInputs();
        this.syncJournalInputs();
        this.syncScheduleInputs();
        
        const eventsByGroup = { 'personal': [] };
        this.myGroups.forEach(g => eventsByGroup[g.id] = []);

        this.currentEvents.forEach(e => {
            if ((e.content || '').trim() !== '' || (e.labelIds && e.labelIds.length > 0)) {
                if (!e.id) e.id = 'ev_' + Date.now() + Math.random().toString(36).substr(2,5);
                if (!e.authorId && window.auth?.currentUser?.uid) e.authorId = window.auth.currentUser.uid;
                
                const gId = e.sharedGroupId || 'personal';
                if (eventsByGroup[gId]) eventsByGroup[gId].push(e);
            }
        });

        const pEvents = eventsByGroup['personal'];
        setDoc(doc(getUserCol('events'), dateStr), { 
            eventList: pEvents,
            eventText: window.formatEventListToText ? window.formatEventListToText(pEvents) : '',
            updatedAt: Date.now() 
        }, { merge: true }).catch(e => console.warn(e));

        this.myGroups.forEach(g => {
            const gEvents = eventsByGroup[g.id];
            setDoc(doc(getGroupCol(g.id, 'events'), dateStr), {
                eventList: gEvents,
                eventText: window.formatEventListToText ? window.formatEventListToText(gEvents) : '',
                updatedAt: Date.now()
            }, { merge: true }).catch(e => console.warn(e));
        });

        const validJournals = this.currentJournals.filter(j => (j.content || '').trim() !== '' || (j.labelIds && j.labelIds.length > 0));
        setDoc(doc(getUserCol('journals'), dateStr), { 
            entries: validJournals, 
            updatedAt: Date.now() 
        }, { merge: true }).catch(e => console.warn(e));

        if (this.scheduleGroupId) {
            setDoc(doc(getGroupCol(this.scheduleGroupId, 'schedules'), dateStr), { 
                periods: this.currentSchedules, 
                updatedAt: Date.now() 
            }, { merge: true }).catch(e => console.warn(e));
        } else {
            setDoc(doc(getUserCol('schedules'), dateStr), { 
                periods: this.currentSchedules, 
                updatedAt: Date.now() 
            }, { merge: true }).catch(e => console.warn(e));
        }

        window[`tempEvents_${dateStr}`] = this.currentEvents;
        window[`tempSchedules_${dateStr}`] = this.currentSchedules;
    }
}

window.dayViewInstance = new DayView(document.getElementById("main-view")); 
Object.assign(window, {
    renderDayViewer: (c) => { window.dayViewInstance.container = c; window.dayViewInstance.renderViewer(); },
    renderDayEditor: (c) => { window.dayViewInstance.container = c; window.dayViewInstance.renderEditor(); },
    saveDayDataFromEditor: () => window.dayViewInstance.save()
});
