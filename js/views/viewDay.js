// js/views/viewDay.js

import { BaseView } from '../components/BaseView.js';
import { store } from '../core/store.js';
import { formatDate, parseLocalDate, getEventLabels, getJournalLabels, getLabelStyle, isRedDay, getHolidayName } from '../core/utils.js';
import { dbAPI, getUserCol, getGroupCol } from '../api/database.js'; 
import { auth, db } from '../api/firebaseInit.js';
import { driveAPI } from '../api/driveAPI.js';
import { generateEventBadgesHTML, formatEventListToText, parseRawEventTextToEventList } from '../core/eventManager.js';
import { doc, getDoc, setDoc, query, where, documentId, getDocs, writeBatch } from "firebase/firestore";
import { CompactEventHelper } from '../ui/templateHelpers.js';
import { fetchCalendarData, saveCalendarData } from '../core/calendarDataManager.js';
import { DayTemplates } from '../ui/dayTemplates.js'; // 🌟 신규 모듈 추가

export class DayView extends BaseView {
    constructor(container) {
        super(container);
        this.currentEvalList = []; 
        this.draggedPeriod = null; 
        this.draggedFilterId = null;
        this.myGroups = [];
        this.dayData = {}; 
        this.lockedDateStr = null; 
    }

    autoResize(textarea) {
        if (!textarea) return;
        textarea.style.height = '1px';
        textarea.style.height = (textarea.scrollHeight + 2) + 'px';
    }

    async loadEvaluationsForDay(dateStr) {
        let allEvals = [];
        const filtersToLoad = window.activeUnifiedFilters || ['personal'];
        
        for (const f of filtersToLoad) {
            const gid = f === 'personal' ? null : f;
            const evals = await dbAPI.loadEvaluations(dateStr, gid) || [];
            evals.forEach(e => e.groupId = gid);
            allEvals = allEvals.concat(evals.filter(e => e.context?.source === 'schedule'));
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

    generateEvalBadgesHtml(source, period = null, filterId = null) {
        const evals = this.currentEvalList.filter(e => {
            const eSource = e.context?.source || (e.periodStr ? 'schedule' : 'journal');
            if (eSource !== source) return false;
            const evGid = e.groupId || 'personal';
            if (filterId && evGid !== filterId) return false;
            
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
        
        const targetDate = this.lockedDateStr || this.dateStr;

        return evals.map(e => {
            let badgeType = '';
            if (e.type === 'eval') badgeType = e.subject || '평가';
            else if (e.type === 'check') badgeType = '체크';
            else if (e.type === 'memo') badgeType = '메모';
            else badgeType = '기타';

            const gId = e.groupId || '';
            return `
                <div onclick="window.EvaluationManager.currentGroupId = '${gId}'; window.EvaluationManager.openViewer('${targetDate}', '${e.id}')" style="padding:4px 8px; background:#eff6ff; border:1px solid #bfdbfe; border-radius:6px; font-size:0.85rem; color:#1e40af; cursor:pointer; font-weight:bold; box-shadow:0 1px 2px rgba(0,0,0,0.05); display:flex; align-items:center; white-space:nowrap;" title="클릭하여 평가 열기">
                    📊 [${badgeType}] ${e.title}
                </div>
            `;
        }).join('');
    }

    async refreshEvalBadges() {
        this.currentEvalList = await this.loadEvaluationsForDay(this.lockedDateStr || this.dateStr);
        (window.activeUnifiedFilters || []).forEach(fId => {
            const tbody = document.getElementById(`schedule-tbody-${fId}`);
            if (tbody) {
                tbody.querySelectorAll('tr[data-period]').forEach(row => {
                    const p = row.getAttribute('data-period');
                    const badgeContainer = row.querySelector('.eval-badges-container');
                    if (badgeContainer) badgeContainer.innerHTML = this.generateEvalBadgesHtml('schedule', p, fId);
                });
            }
            const jContainer = document.querySelector(`.journal-eval-badges-container-${fId}`);
            if (jContainer) {
                const html = this.generateEvalBadgesHtml('journal', null, fId);
                jContainer.innerHTML = html;
                jContainer.style.display = html ? 'flex' : 'none';
            }
        });
    }

    parseEvents(docData) {
        if (!docData) return [];
        if (docData.eventList && docData.eventList.length > 0) return docData.eventList;
        if (docData.eventText && docData.eventText.trim() !== '') return window.parseRawEventTextToEventList(docData.eventText);
        return [];
    }

    async changeScheduleWorkspace(newGroupId) {
        if (store.hasUnsavedChanges) this.save(); 
        this.scheduleGroupId = newGroupId || null;
        this.renderEditor();
    }

    async renderViewer() {
        window.isInfiniteScrollActive = false;
        
        if (this.container && this.container.id === 'main-view') {
            const infBtn = document.getElementById('btn-toggle-infinite');
            if (infBtn) infBtn.style.display = 'none';
        }

        this.lockedDateStr = this.dateStr; 
        this.showLoading('클라우드 데이터를 불러오는 중...');
        const dateStr = this.lockedDateStr;

        try { this.myGroups = await dbAPI.loadMyGroups(); } catch(e) { this.myGroups = []; }
        
        window.currentMyGroups = this.myGroups;
        if (!window.activeUnifiedFilters) window.activeUnifiedFilters = ['personal'];
        if (window.FilterUI && typeof window.FilterUI.renderUnifiedFilter === 'function') window.FilterUI.renderUnifiedFilter(this.myGroups);

        this.dayData = {};
        const filters = window.activeUnifiedFilters;
        let hasCacheError = false;

        for (const fId of filters) {
            this.dayData[fId] = { events: [], schedules: {}, journals: [] };

            const evCol = fId === 'personal' ? getUserCol('events') : getGroupCol(fId, 'events');
            let evDoc = null;
            try { evDoc = await getDoc(doc(evCol, dateStr)); } catch(e) { hasCacheError = true; }
            let eList = [];
            if (evDoc && evDoc.exists()) {
                eList = this.parseEvents(evDoc.data());
                eList.forEach(e => { e.sharedGroupId = fId === 'personal' ? null : fId; });
            }
            this.dayData[fId].events = eList;

            const scCol = fId === 'personal' ? getUserCol('schedules') : getGroupCol(fId, 'schedules');
            let scDoc = null;
            try { scDoc = await getDoc(doc(scCol, dateStr)); } catch(e) { hasCacheError = true; }
            this.dayData[fId].schedules = (scDoc && scDoc.exists()) ? (scDoc.data().periods || {}) : {};

            const jrCol = fId === 'personal' ? getUserCol('journals') : getGroupCol(fId, 'journals');
            let jrDoc = null;
            try { jrDoc = await getDoc(doc(jrCol, dateStr)); } catch(e) { hasCacheError = true; }
            this.dayData[fId].journals = (jrDoc && jrDoc.exists()) ? (jrDoc.data().entries || []) : [];
        }

        if (hasCacheError) {
            if (window.promptOfflineSync && await window.promptOfflineSync(this, 'renderViewer')) return;
        }

        this.currentEvalList = await this.loadEvaluationsForDay(dateStr);
        
        const masterLabels = getEventLabels();
        const masterJournalLabels = getJournalLabels();

        let eventsHtml = '';
        let schedulesHtml = '';
        let journalsHtml = '';

        filters.forEach(fId => {
            const isPersonal = fId === 'personal';
            const gName = isPersonal ? '개인' : (this.myGroups.find(g => g.id === fId)?.name || '그룹');
            const themeColor = isPersonal ? '#2563eb' : '#10b981';
            const jThemeColor = isPersonal ? '#be185d' : '#9d174d';

            const processedEvents = this.dayData[fId].events.filter(e => (e.content || '').trim() !== '').map(e => ({ ...e, content: e.content }));
            
            processedEvents.sort((a, b) => {
                let aRank = 9999, bRank = 9999;
                (a.labelIds || []).forEach(id => {
                    const r = masterLabels.findIndex(l => l.id === id);
                    if (r !== -1 && r < aRank) aRank = r;
                });
                (b.labelIds || []).forEach(id => {
                    const r = masterLabels.findIndex(l => l.id === id);
                    if (r !== -1 && r < bRank) bRank = r;
                });
                if (aRank !== bRank) return aRank - bRank;
                return (a.id || '').localeCompare(b.id || '');
            });
            
            const eventBadges = window.generateEventBadgesHTML(processedEvents, dateStr, 'normal') || '<p style="color:#94a3b8; font-size:0.95rem; margin:0;">등록된 일정이 없습니다.</p>';

            eventsHtml += `
            <div class="day-event-section" style="background: #fff; padding: 15px; border-radius: 8px; border: 1px solid #cbd5e1; box-shadow: 0 1px 3px rgba(0,0,0,0.05); border-left: 5px solid ${themeColor};">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; flex-wrap:wrap; gap:10px;">
                  <h3 style="font-size:1.2rem; color:${isPersonal ? '#1e40af' : '#047857'}; margin:0; font-weight:bold;">📌 오늘 할 일 <span style="font-size:0.95rem; color:#64748b; font-weight:normal;">(${isPersonal ? '🔒 ' : '👥 '}${gName})</span></h3>
              </div>
              ${eventBadges}
            </div>`;

            // 🌟 템플릿 사용
            const periodRowsHtml = Array.from({ length: this.maxPeriod || 6 }).map((_, i) => {
                const p = i + 1;
                const pObj = this.dayData[fId].schedules[p] || {};
                const periodName = store.periodNames[i] || p + '교시';
                const evalBadges = this.generateEvalBadgesHtml('schedule', p, fId);
                return DayTemplates.getViewerPeriodRow(p, pObj, periodName, fId, evalBadges, dateStr);
            }).join('');

            schedulesHtml += `
            <div class="table-container" style="background:#fff; padding:15px; border-radius:8px; border: 1px solid #cbd5e1; border-left: 5px solid ${isPersonal ? '#0f766e' : '#059669'}; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
              <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:10px;">
                  <h3 style="font-size:1.2rem; color:${isPersonal ? '#0f766e' : '#059669'}; margin:0; font-weight:bold;">🏫 수업 및 시간표 <span style="font-size:0.95rem; color:#64748b; font-weight:normal;">(${isPersonal ? '🔒 ' : '👥 '}${gName})</span></h3>
              </div>
              <table style="text-align: center; border-collapse: collapse; width: 100%;">
                <thead>
                  <tr style="border-bottom: 1px solid #cbd5e1;">
                    <th style="width: 60px; padding: 10px;">교시</th>
                    <th style="width: 120px; padding: 10px;">수업</th>
                    <th style="padding: 10px;">📝 수업 메모</th>
                    <th style="width: 25%; min-width: 140px; position:relative; padding: 4px;">
                        <div style="display:flex; gap:4px; align-items:center; justify-content:center; white-space: nowrap;">
                            <span style="font-size:0.85rem;">📌 비고</span>
                            <button onclick="window.EvaluationManager.currentGroupId = '${isPersonal ? '' : fId}'; window.EvaluationManager.openCreationModal('${dateStr}', 'schedule')" style="padding:1px 4px; background:#e0f2fe; color:#0284c7; border:1px solid #7dd3fc; border-radius:3px; font-size:0.65rem; cursor:pointer; font-weight:bold; letter-spacing:-0.5px;">+조사표</button>
                            <button onclick="window.LinkManager.openModal('schedule_header', '${dateStr}', null, '${fId}')" style="padding:1px 4px; background:#fef08a; color:#854d0e; border:1px solid #fde047; border-radius:3px; font-size:0.65rem; cursor:pointer; font-weight:bold; letter-spacing:-0.5px;" title="해당 일자 교시와 데이터를 연결합니다.">+링크</button>
                        </div>
                    </th>
                  </tr>
                </thead>
                <tbody id="schedule-tbody-${fId}">
                    ${periodRowsHtml}
                </tbody>
              </table>
            </div>`;

            const journals = this.dayData[fId].journals.filter(j => (j.content || '').trim() !== '' || (j.attachments && j.attachments.length > 0));
            
            journals.sort((a, b) => {
                let aRank = 9999, bRank = 9999;
                (a.labelIds || []).forEach(id => {
                    const r = masterJournalLabels.findIndex(l => l.id === id);
                    if (r !== -1 && r < aRank) aRank = r;
                });
                (b.labelIds || []).forEach(id => {
                    const r = masterJournalLabels.findIndex(l => l.id === id);
                    if (r !== -1 && r < bRank) bRank = r;
                });
                if (aRank !== bRank) return aRank - bRank;
                return (a.id || '').localeCompare(b.id || '');
            });

            // 🌟 템플릿 사용
            const jListHtml = journals.length > 0 ? journals.map(j => {
                return DayTemplates.getViewerJournalEntry(j, dateStr, fId, masterJournalLabels, getLabelStyle);
            }).join('') : `<p style="color:#94a3b8; font-size:0.95rem; margin:0;">등록된 기록이 없습니다.</p>`;

            journalsHtml += `
            <div class="day-journal-section" style="background: #fff; padding: 15px; border-radius: 8px; border: 1px solid #cbd5e1; box-shadow: 0 1px 3px rgba(0,0,0,0.05); border-left: 5px solid ${jThemeColor};">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                  <h3 style="font-size:1.2rem; color:${isPersonal ? '#be185d' : '#9d174d'}; margin:0; font-weight:bold;">📔 오늘 기록 <span style="font-size:0.95rem; color:#64748b; font-weight:normal;">(${isPersonal ? '🔒 ' : '👥 '}${gName})</span></h3>
              </div>
              <div class="journal-eval-badges-container-${fId}" style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:10px; ${this.generateEvalBadgesHtml('journal', null, fId) ? '' : 'display:none;'}">
                  ${this.generateEvalBadgesHtml('journal', null, fId)}
              </div>
              <div style="display:flex; flex-direction:column;">${jListHtml}</div>
            </div>`;
        });

        this.container.innerHTML = `
          <div class="day-viewer-container">
            <div style="display:flex; flex-direction:column; gap:15px; margin-bottom:25px;">${eventsHtml}</div>
            <div class="day-schedule-wrapper" style="display:flex; flex-direction:column; gap:15px; margin-bottom:25px; ${store.showClass ? '' : 'display:none;'}">${schedulesHtml}</div>
            <div style="display:flex; flex-direction:column; gap:15px; margin-bottom:25px;">${journalsHtml}</div>
          </div>
        `;
    }

    async renderEditor() {
        window.isInfiniteScrollActive = false;
        
        if (this.container && this.container.id === 'main-view') {
            const infBtn = document.getElementById('btn-toggle-infinite');
            if (infBtn) infBtn.style.display = 'none';
        }

        this.lockedDateStr = this.dateStr; 
        this.showLoading('편집 화면을 다중 작업공간으로 준비 중...');
        const dateStr = this.lockedDateStr;
        
        try { this.myGroups = await dbAPI.loadMyGroups(); } catch(e) { this.myGroups = []; }

        window.currentMyGroups = this.myGroups;
        if (!window.activeUnifiedFilters) window.activeUnifiedFilters = ['personal'];
        if (window.FilterUI && typeof window.FilterUI.renderUnifiedFilter === 'function') window.FilterUI.renderUnifiedFilter(this.myGroups);

        this.dayData = {};
        const filters = window.activeUnifiedFilters;
        const masterLabels = getEventLabels();
        let hasCacheError = false;

        for (const fId of filters) {
            this.dayData[fId] = { events: [], schedules: {}, journals: [] };

            const evCol = fId === 'personal' ? getUserCol('events') : getGroupCol(fId, 'events');
            let evDoc = null;
            try { evDoc = await getDoc(doc(evCol, dateStr)); } catch(e) { hasCacheError = true; }
            let eList = [];
            if (evDoc && evDoc.exists()) {
                eList = this.parseEvents(evDoc.data());
                eList.forEach(e => { e.sharedGroupId = fId === 'personal' ? null : fId; });
            }
            eList = eList.map(e => {
                let labelIds = e.labelIds || [];
                if (labelIds.length === 0 && (e.labels || e.label)) {
                    (e.labels || [e.label]).forEach(name => {
                        const match = masterLabels.find(l => l.name === name);
                        if (match && match.id && !labelIds.includes(match.id)) labelIds.push(match.id);
                    });
                }
                return { ...e, labelIds };
            });
            if (eList.length === 0) eList.push(this.createEmptyEvent(fId));
            this.dayData[fId].events = eList;

            const scCol = fId === 'personal' ? getUserCol('schedules') : getGroupCol(fId, 'schedules');
            let scDoc = null;
            try { scDoc = await getDoc(doc(scCol, dateStr)); } catch(e) { hasCacheError = true; }
            this.dayData[fId].schedules = (scDoc && scDoc.exists()) ? (scDoc.data().periods || {}) : {};

            const jrCol = fId === 'personal' ? getUserCol('journals') : getGroupCol(fId, 'journals');
            let jrDoc = null;
            try { jrDoc = await getDoc(doc(jrCol, dateStr)); } catch(e) { hasCacheError = true; }
            let jList = (jrDoc && jrDoc.exists()) ? (jrDoc.data().entries || []) : [];
            jList = jList.map(j => ({ ...j, labelIds: j.labelIds || [], attachments: j.attachments || [] }));
            if (jList.length === 0) {
                const masterJournalLabels = getJournalLabels();
                const defaultJrLabelId = masterJournalLabels.length > 0 ? masterJournalLabels[0].id : null;
                jList.push({ labelIds: defaultJrLabelId ? [defaultJrLabelId] : [], content: '', attachments: [] });
            }
            this.dayData[fId].journals = jList;
        }

        if (hasCacheError) {
            if (window.promptOfflineSync && await window.promptOfflineSync(this, 'renderEditor')) return;
        }

        this.currentEvalList = await this.loadEvaluationsForDay(dateStr);

        let eventsHtml = '';
        let schedulesHtml = '';
        let journalsHtml = '';

        filters.forEach(fId => {
            const isPersonal = fId === 'personal';
            const gName = isPersonal ? '개인' : (this.myGroups.find(g => g.id === fId)?.name || '그룹');
            const themeColor = isPersonal ? '#2563eb' : '#10b981';
            const bgColor = isPersonal ? '#eff6ff' : '#ecfdf5';
            const bColor = isPersonal ? '#bfdbfe' : '#a7f3d0';
            const jThemeColor = isPersonal ? '#be185d' : '#9d174d';
            const jBgColor = isPersonal ? '#fdf2f8' : '#fce7f3';
            const jBColor = isPersonal ? '#fbcfe8' : '#f9a8d4';

            eventsHtml += `
            <div class="day-event-editor-section" style="background: #fff; padding: 15px; border-radius: 8px; border: 1px solid #cbd5e1; box-shadow: 0 1px 3px rgba(0,0,0,0.05); border-left: 5px solid ${themeColor};">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 15px; flex-wrap:wrap; gap:10px;">
                <h3 style="font-size:1.2rem; color:${isPersonal ? '#1e40af' : '#047857'}; margin:0; font-weight:bold;">📌 오늘 할 일 <span style="font-size:0.95rem; color:#64748b; font-weight:normal;">(${isPersonal ? '🔒 ' : '👥 '}${gName})</span></h3>
                <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                    <button onclick="window.openEventLabelModal()" style="background:#f8fafc; border:1px solid #cbd5e1; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:0.85rem; font-weight:bold;">⚙️ 설정</button>
                </div>
              </div>
              <div id="event-entries-container-${fId}" style="width: 100%;"></div>
              <button onclick="window.dayViewInstance.addEventEntry('${fId}')" style="width:100%; padding:10px; margin-top:5px; background:${bgColor}; color:${themeColor}; border:2px dashed ${bColor}; border-radius:8px; cursor:pointer; font-weight:bold; font-size:1rem; transition:0.2s;">+ 일정 추가</button>
            </div>`;

            // 🌟 템플릿 사용
            const periodRowsHtml = Array.from({ length: this.maxPeriod || 6 }).map((_, i) => {
                const p = i + 1;
                const pObj = this.dayData[fId].schedules[p] || {};
                const periodName = store.periodNames[i] || p + '교시';
                const evalBadges = this.generateEvalBadgesHtml('schedule', p, fId);
                return DayTemplates.getEditorPeriodRow(p, pObj, periodName, fId, evalBadges, dateStr);
            }).join('');

            schedulesHtml += `
            <div class="table-container" style="background:#fff; padding:15px; border-radius:8px; border: 1px solid #cbd5e1; border-left: 5px solid ${isPersonal ? '#0f766e' : '#059669'}; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
              <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:10px;">
                  <h3 style="font-size:1.2rem; color:${isPersonal ? '#0f766e' : '#059669'}; margin:0; font-weight:bold;">🏫 수업 및 시간표 <span style="font-size:0.95rem; color:#64748b; font-weight:normal;">(${isPersonal ? '🔒 ' : '👥 '}${gName})</span></h3>
                  <div style="font-size:0.8rem; color:#64748b;">💡 왼쪽 '≡' 영역을 잡아 끌어다 놓으세요.</div>
              </div>
              <table style="text-align: center; width: 100%;">
                <thead>
                  <tr>
                    <th style="width: 75px;">교시</th>
                    <th style="width: 120px;">수업</th>
                    <th>📝 수업 메모</th>
                    <th style="width: 25%; min-width: 140px; position:relative; padding: 4px; border-bottom:none;">
                        <div style="display:flex; gap:4px; align-items:center; justify-content:center; white-space: nowrap;">
                            <span style="font-size:0.85rem;">📌 비고</span>
                            <button onclick="window.EvaluationManager.currentGroupId = '${isPersonal ? '' : fId}'; window.EvaluationManager.openCreationModal('${dateStr}', 'schedule')" style="padding:1px 4px; background:#e0f2fe; color:#0284c7; border:1px solid #7dd3fc; border-radius:3px; font-size:0.65rem; cursor:pointer; font-weight:bold; letter-spacing:-0.5px;">+조사표</button>
                            <button onclick="window.LinkManager.openModal('schedule_header', '${dateStr}', null, '${fId}')" style="padding:1px 4px; background:#fef08a; color:#854d0e; border:1px solid #fde047; border-radius:3px; font-size:0.65rem; cursor:pointer; font-weight:bold; letter-spacing:-0.5px;" title="해당 일자 교시와 데이터를 연결합니다.">+링크</button>
                        </div>
                    </th>
                  </tr>
                </thead>
                <tbody id="schedule-tbody-${fId}">${periodRowsHtml}</tbody>
              </table>
            </div>`;

            journalsHtml += `
            <div class="day-journal-editor-section" style="background: #fff; padding: 15px; border-radius: 8px; border: 1px solid #cbd5e1; box-shadow: 0 1px 3px rgba(0,0,0,0.05); border-left: 5px solid ${jThemeColor};">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 15px;">
                <h3 style="font-size:1.2rem; color:${isPersonal ? '#be185d' : '#9d174d'}; margin:0; font-weight:bold;">📔 오늘 기록 <span style="font-size:0.95rem; color:#64748b; font-weight:normal;">(${isPersonal ? '🔒 ' : '👥 '}${gName})</span></h3>
                <button onclick="window.openJournalLabelModal()" style="background:#fdf2f8; border:1px solid #fbcfe8; padding:4px 10px; border-radius:6px; cursor:pointer; font-size:0.85rem; font-weight:bold; color:#be185d;">⚙️ 설정</button>
              </div>
              <div class="journal-eval-badges-container-${fId}" style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:10px; ${this.generateEvalBadgesHtml('journal', null, fId) ? '' : 'display:none;'}">
                  ${this.generateEvalBadgesHtml('journal', null, fId)}
              </div>
              <div id="journal-entries-container-${fId}" style="width: 100%;"></div>
              <button onclick="window.dayViewInstance.addJournalEntry('${fId}')" style="width:100%; padding:10px; margin-top:5px; background:${jBgColor}; color:${jThemeColor}; border:2px dashed ${jBColor}; border-radius:8px; cursor:pointer; font-weight:bold; font-size:1rem; transition:0.2s;">+ 기록 추가</button>
            </div>`;
        });

        this.container.innerHTML = `
          <style>
            .table-container.is-dragging .editable-cell { pointer-events: none !important; user-select: none !important; }
          </style>
          <div class="day-viewer-container">
            <div style="display:flex; flex-direction:column; gap:15px; margin-bottom:25px;">${eventsHtml}</div>
            <div class="day-schedule-wrapper" style="display:flex; flex-direction:column; gap:15px; margin-bottom:25px; ${store.showClass ? '' : 'display:none;'}">${schedulesHtml}</div>
            <div style="display:flex; flex-direction:column; gap:15px; margin-bottom:25px;">${journalsHtml}</div>
          </div>
        `;
        
        setTimeout(() => {
          filters.forEach(fId => {
              this.renderEventEntries(fId);
              this.renderJournalEntries(fId);
          });
          this.originalEventsBackup = JSON.parse(JSON.stringify(this.dayData));
        }, 0);
    }

    createEmptyEvent(fId) {
        const masterLabels = getEventLabels();
        const defaultLabelId = masterLabels.length > 0 ? masterLabels[0].id : null;
        return { 
            id: 'ev_' + Date.now() + Math.random().toString(36).substr(2,5),
            authorId: auth?.currentUser?.uid,
            labelIds: defaultLabelId ? [defaultLabelId] : [], 
            content: '', completed: false, 
            sharedGroupId: fId === 'personal' ? null : fId 
        };
    }

    handlePeriodDragStart(event, period, filterId) {
        window.dayViewInstance.draggedPeriod = period;
        window.dayViewInstance.draggedFilterId = filterId;
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', String(period)); 
        setTimeout(() => {
            const row = event.target.closest('tr');
            if (row) row.style.opacity = '0.4';
            const tableContainer = event.target.closest('.table-container');
            if (tableContainer) tableContainer.classList.add('is-dragging'); 
        }, 0);
    }

    handlePeriodDragEnd(event, filterId) {
        const tbody = document.getElementById(`schedule-tbody-${filterId}`);
        if (tbody) {
            tbody.querySelectorAll('tr').forEach(tr => { 
                tr.style.opacity = '1'; 
                tr.style.backgroundColor = '';
                tr.removeAttribute('draggable');
            });
        }
        const tableContainer = event.target.closest('.table-container');
        if (tableContainer) tableContainer.classList.remove('is-dragging');
        window.dayViewInstance.draggedPeriod = null;
        window.dayViewInstance.draggedFilterId = null;
    }

    handlePeriodDrop(event, targetPeriod, filterId) {
        event.preventDefault();
        event.stopPropagation();
        
        const tableContainer = event.target.closest('.table-container');
        if (tableContainer) tableContainer.classList.remove('is-dragging');
        
        let sourcePeriodStr = '';
        try { sourcePeriodStr = event.dataTransfer.getData('text/plain'); } catch(e) {}
        
        const sourcePeriod = parseInt(sourcePeriodStr, 10) || window.dayViewInstance.draggedPeriod;
        if (!sourcePeriod || sourcePeriod === targetPeriod || window.dayViewInstance.draggedFilterId !== filterId) return;

        window.dayViewInstance.executeClassInsert(sourcePeriod, targetPeriod, filterId);
        window.dayViewInstance.draggedPeriod = null;
        window.dayViewInstance.draggedFilterId = null;
    }

    executeClassInsert(sourceP, targetP, fId) {
        if (sourceP === targetP) return;
        
        this.syncScheduleInputs(fId);

        const s = parseInt(sourceP, 10);
        const t = parseInt(targetP, 10);
        const schedules = this.dayData[fId].schedules;
        const sourceData = schedules[s] ? { ...schedules[s] } : null;

        if (s < t) {
            for (let i = s; i < t; i++) {
                if (schedules[i + 1]) schedules[i] = { ...schedules[i + 1] };
                else delete schedules[i];
            }
        } else {
            for (let i = s; i > t; i--) {
                if (schedules[i - 1]) schedules[i] = { ...schedules[i - 1] };
                else delete schedules[i];
            }
        }

        if (sourceData) schedules[t] = sourceData;
        else delete schedules[t];

        let evalChanged = false;
        this.currentEvalList.forEach(ev => {
            const eSource = ev.context?.source || (ev.periodStr ? 'schedule' : 'journal');
            const targetGid = fId === 'personal' ? null : fId;
            if (eSource === 'schedule' && ev.groupId === targetGid) {
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

        const tbody = document.getElementById(`schedule-tbody-${fId}`);
        if (tbody) {
            // 🌟 템플릿 사용
            tbody.innerHTML = Array.from({ length: this.maxPeriod || 6 }).map((_, i) => {
                const p = i + 1;
                const pObj = schedules[p] || {};
                const periodName = store.periodNames[i] || p + '교시';
                const evalBadges = this.generateEvalBadgesHtml('schedule', p, fId);
                return DayTemplates.getEditorPeriodRow(p, pObj, periodName, fId, evalBadges, this.lockedDateStr || this.dateStr);
            }).join('');
        }

        if (evalChanged) {
            const targetGid = fId === 'personal' ? null : fId;
            const scheduleEvals = this.currentEvalList.filter(e => e.context?.source === 'schedule' && e.groupId === targetGid);
            const journalEvals = this.currentEvalList.filter(e => e.context?.source === 'journal' && e.groupId === targetGid);
            
            dbAPI.saveEvaluations(this.lockedDateStr || this.dateStr, scheduleEvals, targetGid).catch(e => console.warn(e));
            if (journalEvals.length > 0) {
                dbAPI.saveEvaluations(this.lockedDateStr || this.dateStr, journalEvals, targetGid).catch(e => console.warn(e));
            }
        }
        
        if (typeof window.saveCurrentViewData === 'function') {
            window.saveCurrentViewData(true);
        } else {
            this.save();
            store.hasUnsavedChanges = false;
        }
    }

    requestRemoveEvent(fId, idx) {
        this.syncEventInputs(fId);
        const ev = this.dayData[fId].events[idx];
        if (!ev) return;

        const isGrouped = !!ev.groupId;
        const allLabelsObj = window.getEventLabels ? window.getEventLabels() : [];
        const forwardLabelId = (ev.labelIds || []).find(id => allLabelsObj.find(l => l.id === id)?.isForward);
        const forwardLabelName = forwardLabelId ? allLabelsObj.find(l=>l.id===forwardLabelId).name : '';
        const targetDate = this.lockedDateStr || this.dateStr;

        if (isGrouped && ev.groupId.startsWith('group_')) {
            window.showGroupDeleteModal(targetDate, ev.labelIds[0] || '', ev.content, ev.groupId, 
                () => { 
                    this.dayData[fId].events.splice(idx, 1); 
                    this.renderEventEntries(fId); 
                    store.hasUnsavedChanges = true; 
                }, 
                () => { 
                    this.dayData[fId].events.splice(idx, 1); 
                    this.renderEventEntries(fId); 
                    store.hasUnsavedChanges = true; 
                }
            );
        } else if (forwardLabelId && ev.forwardChainId) {
            window.showForwardDeleteModal(targetDate, forwardLabelName, ev.content, ev.forwardChainId, () => { 
                this.dayData[fId].events.splice(idx, 1); 
                this.renderEventEntries(fId); 
                store.hasUnsavedChanges = true; 
            });
        } else {
            this.removeEventEntry(fId, idx);
        }
    }

    renderEventEntries(fId) {
        const container = document.getElementById(`event-entries-container-${fId}`);
        if(!container) return;
        
        const allLabelsObj = getEventLabels();
        const uid = auth?.currentUser?.uid;
        const events = this.dayData[fId].events || [];

        if (store.mode !== 'editor') {
            events.sort((a, b) => {
                let aRank = 9999, bRank = 9999;
                (a.labelIds || []).forEach(id => {
                    const r = allLabelsObj.findIndex(l => l.id === id);
                    if (r !== -1 && r < aRank) aRank = r;
                });
                (b.labelIds || []).forEach(id => {
                    const r = allLabelsObj.findIndex(l => l.id === id);
                    if (r !== -1 && r < bRank) bRank = r;
                });
                if (aRank !== bRank) return aRank - bRank;
                return (a.id || '').localeCompare(b.id || '');
            });
        } else {
            events.sort((a, b) => (a.id || '').localeCompare(b.id || ''));
        }

        // 🌟 템플릿 사용
        container.innerHTML = events.map((ev, idx) => {
            const isAuthor = !ev.authorId || !uid || ev.authorId === uid;
            return DayTemplates.getEditorEventEntry(ev, idx, fId, isAuthor, allLabelsObj, this.lockedDateStr || this.dateStr, getLabelStyle);
        }).join('');

        setTimeout(() => { container.querySelectorAll('textarea').forEach(ta => this.autoResize(ta)); }, 0);
    }

    renderJournalEntries(fId) {
        const container = document.getElementById(`journal-entries-container-${fId}`);
        if(!container) return;
        
        const allLabelsObj = getJournalLabels();
        const journals = this.dayData[fId].journals || [];
        
        if (store.mode !== 'editor') {
            journals.sort((a, b) => {
                let aRank = 9999, bRank = 9999;
                (a.labelIds || []).forEach(id => {
                    const r = allLabelsObj.findIndex(l => l.id === id);
                    if (r !== -1 && r < aRank) aRank = r;
                });
                (b.labelIds || []).forEach(id => {
                    const r = allLabelsObj.findIndex(l => l.id === id);
                    if (r !== -1 && r < bRank) bRank = r;
                });
                if (aRank !== bRank) return aRank - bRank;
                return (a.id || '').localeCompare(b.id || '');
            });
        } else {
            journals.sort((a, b) => (a.id || '').localeCompare(b.id || ''));
        }

        const uid = auth?.currentUser?.uid;

        // 🌟 템플릿 사용
        container.innerHTML = journals.map((j, idx) => {
            const isAuthor = !j.authorId || !uid || j.authorId === uid;
            return DayTemplates.getEditorJournalEntry(j, idx, fId, isAuthor, allLabelsObj, this.lockedDateStr || this.dateStr, getLabelStyle);
        }).join('');

        setTimeout(() => { container.querySelectorAll('textarea').forEach(ta => this.autoResize(ta)); }, 0);
    }

    async handleJournalAttachmentUpload(fId, idx, inputEl) {
        this.syncJournalInputs(fId);
        
        const files = inputEl.files;
        if (!files || files.length === 0) return;

        const j = this.dayData[fId].journals[idx];
        if (!j) return;

        j.isUploading = true;
        this.renderJournalEntries(fId);

        try {
            const uploadedFiles = await driveAPI.uploadFiles(files);
            if (!j.attachments) j.attachments = [];
            j.attachments.push(...uploadedFiles);
            store.hasUnsavedChanges = true;
        } catch (err) {
            console.error(err);
            alert("파일 업로드 중 오류가 발생했습니다: " + err.message);
        } finally {
            j.isUploading = false;
            inputEl.value = '';
            this.renderJournalEntries(fId);
        }
    }

    removeJournalAttachment(fId, jIdx, aIdx) {
        this.syncJournalInputs(fId);
        if (confirm("첨부된 파일 링크를 삭제하시겠습니까?\n(※ 구글 드라이브의 실제 파일은 삭제되지 않습니다.)")) {
            const j = this.dayData[fId].journals[jIdx];
            if (j && j.attachments) {
                const targetAttachment = j.attachments[aIdx];
                if (targetAttachment && targetAttachment.id) {
                    driveAPI.deleteFile(targetAttachment.id).catch(e => console.warn(e));
                }
                
                j.attachments.splice(aIdx, 1);
                store.hasUnsavedChanges = true;
                this.renderJournalEntries(fId);
            }
        }
    }

    async toggleEventLabel(fId, idx, labelId) {
        this.syncEventInputs(fId);
        store.hasUnsavedChanges = true;
        const ev = this.dayData[fId].events[idx];
        if (!ev) return;

        const labelObj = getEventLabels().find(l => l.id === labelId);
        ev.labelIds = ev.labelIds || [];

        if (ev.labelIds.includes(labelId)) {
            ev.labelIds = ev.labelIds.filter(id => id !== labelId);
            this.renderEventEntries(fId);
            await this.save(); 
        } else {
            if (labelObj?.isPeriod || labelObj?.isRecur) {
                const evContent = ev.content || '';

                const removedEvent = this.dayData[fId].events.splice(idx, 1)[0];
                this.renderEventEntries(fId);

                await this.save();
                store.hasUnsavedChanges = false;

                const callback = async (success) => {
                    store.hasUnsavedChanges = false;
                    if (!success && removedEvent) {
                        this.dayData[fId].events.push(removedEvent);
                        await this.save();
                    }
                    
                    if (document.getElementById('day-modal-body')) {
                        await this.renderEditor();
                    }

                    if (typeof window.render === 'function') window.render();
                };

                if (labelObj.isPeriod) window.openPeriodModal(this.lockedDateStr || this.dateStr, labelObj.name, evContent, callback, labelId);
                else if (labelObj.isRecur) window.openRecurringModal(this.lockedDateStr || this.dateStr, labelObj.name, evContent, callback, labelId);
                return;
            }

            ev.labelIds.push(labelId);
            this.renderEventEntries(fId);
            await this.save(); 
        }
    }

    updateEventStatus(fId, idx, isCompleted) {
        store.hasUnsavedChanges = true;
        if (this.dayData[fId].events[idx]) this.dayData[fId].events[idx].completed = isCompleted;
        this.renderEventEntries(fId);
        this.save(); 
    }

    updateEventContent(fId, idx, val) {
        store.hasUnsavedChanges = true;
        if (this.dayData[fId].events[idx]) this.dayData[fId].events[idx].content = val;
    }

    toggleJournalLabel(fId, idx, labelId) {
        this.syncJournalInputs(fId);
        store.hasUnsavedChanges = true;
        const j = this.dayData[fId].journals[idx];
        if (!j) return;
        j.labelIds = j.labelIds || [];
        j.labelIds = j.labelIds.includes(labelId) ? j.labelIds.filter(id => id !== labelId) : [...j.labelIds, labelId];
        this.renderJournalEntries(fId);
    }

    updateJournalContent(fId, idx, val) {
        store.hasUnsavedChanges = true;
        if (this.dayData[fId].journals[idx]) this.dayData[fId].journals[idx].content = val;
    }

    addEventEntry(fId) {
        this.syncEventInputs(fId);
        this.dayData[fId].events.push(this.createEmptyEvent(fId));
        this.renderEventEntries(fId);
        store.hasUnsavedChanges = true;
    }

    removeEventEntry(fId, index) {
        this.syncEventInputs(fId);
        this.dayData[fId].events.splice(index, 1);
        this.renderEventEntries(fId);
        store.hasUnsavedChanges = true;
    }

    addJournalEntry(fId) {
        this.syncJournalInputs(fId);
        const masterJournalLabels = getJournalLabels();
        const defaultJrLabelId = masterJournalLabels.length > 0 ? masterJournalLabels[0].id : null;
        this.dayData[fId].journals.push({ labelIds: defaultJrLabelId ? [defaultJrLabelId] : [], content: '', attachments: [] });
        this.renderJournalEntries(fId);
        store.hasUnsavedChanges = true;
    }

    removeJournalEntry(fId, index) {
        this.syncJournalInputs(fId);
        if (confirm("이 기록을 삭제하시겠습니까?\n(첨부된 구글 드라이브 파일도 함께 영구 삭제됩니다)")) {
            const j = this.dayData[fId].journals[index];
            
            if (j && j.attachments && j.attachments.length > 0) {
                j.attachments.forEach(a => {
                    if (a && a.id) driveAPI.deleteFile(a.id).catch(e => console.warn(e));
                });
            }
            
            this.dayData[fId].journals.splice(index, 1);
            this.renderJournalEntries(fId);
            store.hasUnsavedChanges = true;
        }
    }

    syncEventInputs(fId) {
        const container = document.getElementById(`event-entries-container-${fId}`);
        if(container) {
            container.querySelectorAll('textarea').forEach((ta, idx) => {
                if (this.dayData[fId].events[idx]) this.dayData[fId].events[idx].content = ta.value; 
            });
        }
    }

    syncJournalInputs(fId) {
        const container = document.getElementById(`journal-entries-container-${fId}`);
        if(container) {
            container.querySelectorAll('textarea').forEach((ta, idx) => {
                if (this.dayData[fId].journals[idx]) this.dayData[fId].journals[idx].content = ta.value; 
            });
        }
    }

    syncScheduleInputs(fId) {
        const tbody = document.getElementById(`schedule-tbody-${fId}`);
        if (!tbody) return;

        const wrapper = tbody.closest('.day-schedule-wrapper');
        const wasHidden = wrapper && window.getComputedStyle(wrapper).display === 'none';
        if (wasHidden) wrapper.style.display = 'flex';

        this.dayData[fId].schedules = this.dayData[fId].schedules || {};
        
        tbody.querySelectorAll('tr[data-period]').forEach(row => {
            const p = row.getAttribute('data-period');
            const subject = row.querySelector('.cell-subject').innerText.trim();
            const memo = row.querySelector('.cell-memo').innerText.trim();
            const supplies = row.querySelector('.cell-supplies').innerText.trim();
            
            const oldObj = this.dayData[fId].schedules[p] || {};
            if (subject || memo || supplies || (oldObj.linkedItems && oldObj.linkedItems.length > 0)) { 
                this.dayData[fId].schedules[p] = { 
                    subject, memo, supplies,
                    linkedItems: oldObj.linkedItems || []
                }; 
            } else {
                delete this.dayData[fId].schedules[p];
            }
        });

        if (wasHidden) wrapper.style.display = 'none';
        store.hasUnsavedChanges = true;
    }

    async save() {
        if (this.isRendering) return; 
        
        const dateStr = this.lockedDateStr || this.dateStr; 
        
        window.activeUnifiedFilters.forEach(fId => {
            this.syncEventInputs(fId);
            this.syncJournalInputs(fId);
            this.syncScheduleInputs(fId);
        });

        if (!this.isGroupUpdateBypassed && window.EventManager && typeof window.EventManager.showGroupUpdateModal === 'function') {
            let changedGroupEvent = null;
            
            for (const fId of window.activeUnifiedFilters) {
                const currentEvents = this.dayData[fId].events;
                const origEvents = this.originalEventsBackup?.[fId]?.events || [];
                
                for (let i = 0; i < currentEvents.length; i++) {
                    const cEv = currentEvents[i];
                    if (cEv.groupId) { 
                        const oEv = origEvents.find(e => e.id === cEv.id);
                        if (oEv && oEv.content !== cEv.content) {
                            changedGroupEvent = { fId, cEv, oEv };
                            break;
                        }
                    }
                }
                if (changedGroupEvent) break;
            }

            if (changedGroupEvent) {
                return new Promise((resolve) => {
                    window.EventManager.showGroupUpdateModal(
                        dateStr,
                        changedGroupEvent.cEv.groupId,
                        changedGroupEvent.oEv.content,
                        changedGroupEvent.cEv.content,
                        async () => { 
                            this.isGroupUpdateBypassed = true; 
                            if(this.originalEventsBackup[changedGroupEvent.fId]) {
                                const backupEv = this.originalEventsBackup[changedGroupEvent.fId].events.find(e => e.id === changedGroupEvent.cEv.id);
                                if(backupEv) backupEv.content = changedGroupEvent.cEv.content;
                            }
                            await this.save(); 
                            resolve();
                        },
                        async () => { 
                            this.isGroupUpdateBypassed = true;
                            if(this.originalEventsBackup[changedGroupEvent.fId]) {
                                const backupEv = this.originalEventsBackup[changedGroupEvent.fId].events.find(e => e.id === changedGroupEvent.cEv.id);
                                if(backupEv) backupEv.content = changedGroupEvent.cEv.content;
                            }
                            await this.save();
                            resolve();
                        },
                        () => { 
                            changedGroupEvent.cEv.content = changedGroupEvent.oEv.content;
                            this.renderEventEntries(changedGroupEvent.fId); 
                            resolve();
                        }
                    );
                });
            }
        }
        this.isGroupUpdateBypassed = false; 

        const snapshot = [{
            dateStr: dateStr,
            validEvents: [],
            schedulesData: {},
            journalsData: {}
        }];

        window.activeUnifiedFilters.forEach(fId => {
            const dData = this.dayData[fId];
            if (!dData) return;

            const validEvents = dData.events.filter(e => (e.content || '').trim() !== '' || (e.labelIds && e.labelIds.length > 0));
            validEvents.forEach(e => {
                if (!e.id) e.id = 'ev_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2,5);
                if (!e.authorId && auth?.currentUser?.uid) e.authorId = auth.currentUser.uid;
                if (e.authorId === auth?.currentUser?.uid) {
                    e.authorName = localStorage.getItem('sp3_nickname') || e.authorName || '';
                }
                e.sharedGroupId = fId === 'personal' ? null : fId;
                snapshot[0].validEvents.push(e);
            });

            snapshot[0].schedulesData[fId] = dData.schedules;

            const validJournals = dData.journals.filter(j => (j.content || '').trim() !== '' || (j.labelIds && j.labelIds.length > 0) || (j.attachments && j.attachments.length > 0));
            validJournals.forEach(j => {
                if (!j.id) j.id = 'jr_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2,5);
                if (!j.authorId && auth?.currentUser?.uid) j.authorId = auth.currentUser.uid;
                if (j.authorId === auth?.currentUser?.uid) {
                    j.authorName = localStorage.getItem('sp3_nickname') || j.authorName || '';
                }
                delete j.isUploading;
            });
            snapshot[0].journalsData[fId] = validJournals;
        });

        try {
            const promises = [];
            window.activeUnifiedFilters.forEach(fId => {
                promises.push((async () => {
                    const pEvents = snapshot[0].validEvents.filter(e => (e.sharedGroupId || 'personal') === fId);
                    const pJournals = snapshot[0].journalsData[fId] || [];
                    const pSchedules = snapshot[0].schedulesData[fId] || {};

                    const evCol = fId === 'personal' ? getUserCol('events') : getGroupCol(fId, 'events');
                    const scCol = fId === 'personal' ? getUserCol('schedules') : getGroupCol(fId, 'schedules');
                    const jrCol = fId === 'personal' ? getUserCol('journals') : getGroupCol(fId, 'journals');

                    let finalEvents = pEvents;
                    const evRef = doc(evCol, dateStr);
                    try {
                        const evSnap = await getDoc(evRef);
                        if (evSnap.exists()) {
                            const remoteEvents = evSnap.data().eventList || [];
                            const originalEvents = this.originalEventsBackup?.[fId]?.events || [];
                            
                            const remoteMap = new Map(remoteEvents.map(e => [e.id, e]));
                            const originalMap = new Map(originalEvents.map(e => [e.id, e]));
                            const localMap = new Map(pEvents.map(e => [e.id, e]));
                            
                            const mergedMap = new Map();
                            
                            remoteEvents.forEach(re => {
                                if (originalMap.has(re.id) && !localMap.has(re.id)) {
                                } else if (localMap.has(re.id)) {
                                    mergedMap.set(re.id, localMap.get(re.id)); 
                                } else {
                                    mergedMap.set(re.id, re); 
                                }
                            });
                            
                            pEvents.forEach(le => {
                                if (!mergedMap.has(le.id)) mergedMap.set(le.id, le);
                            });
                            
                            finalEvents = Array.from(mergedMap.values());
                        }
                    } catch(err) { console.warn("일정 병합 오류:", err); }

                    await setDoc(evRef, { 
                        eventList: finalEvents,
                        eventText: window.formatEventListToText ? window.formatEventListToText(finalEvents) : '',
                        updatedAt: Date.now() 
                    }, { merge: true });

                    let finalJournals = pJournals;
                    const jrRef = doc(jrCol, dateStr);
                    try {
                        const jrSnap = await getDoc(jrRef);
                        if (jrSnap.exists()) {
                            const remoteJournals = jrSnap.data().entries || [];
                            const originalJournals = this.originalEventsBackup?.[fId]?.journals || [];
                            
                            const originalMap = new Map(originalJournals.map(j => [j.id, j]));
                            const localMap = new Map(pJournals.map(j => [j.id, j]));
                            const mergedMap = new Map();
                            
                            remoteJournals.forEach(rj => {
                                if (originalMap.has(rj.id) && !localMap.has(rj.id)) { }
                                else if (localMap.has(rj.id)) mergedMap.set(rj.id, localMap.get(rj.id));
                                else mergedMap.set(rj.id, rj); 
                            });
                            pJournals.forEach(lj => { if (!mergedMap.has(lj.id)) mergedMap.set(lj.id, lj); });
                            finalJournals = Array.from(mergedMap.values());
                        }
                    } catch(err) { console.warn("기록 병합 오류:", err); }

                    await setDoc(jrRef, { entries: finalJournals, updatedAt: Date.now() }, { merge: true });

                    let finalSchedules = { ...pSchedules };
                    const scRef = doc(scCol, dateStr);
                    try {
                        const scSnap = await getDoc(scRef);
                        if (scSnap.exists()) {
                            const remotePeriods = scSnap.data().periods || {};
                            const originalPeriods = this.originalEventsBackup?.[fId]?.schedules || {};
                            
                            for (let p in remotePeriods) {
                                const rJson = JSON.stringify(remotePeriods[p] || {});
                                const oJson = JSON.stringify(originalPeriods[p] || {});
                                const lJson = JSON.stringify(pSchedules[p] || {});
                                
                                if (oJson === lJson && rJson !== oJson) {
                                    finalSchedules[p] = remotePeriods[p]; 
                                }
                            }
                        }
                    } catch(err) { console.warn("수업 병합 오류:", err); }

                    await setDoc(scRef, { periods: finalSchedules, updatedAt: Date.now() }, { merge: true });

                })());
            });
            
            await Promise.race([
                Promise.all(promises),
                new Promise(resolve => setTimeout(resolve, 300))
            ]);
            
            store.hasUnsavedChanges = false;
        } catch(e) {
            console.error("저장 중 오류 발생:", e);
            throw e;
        }
    }
}

window.dayViewInstance = new DayView(document.getElementById("main-view")); 
Object.assign(window, {
    renderDayViewer: (c) => { window.dayViewInstance.container = c; window.dayViewInstance.renderViewer(); },
    renderDayEditor: (c) => { window.dayViewInstance.container = c; window.dayViewInstance.renderEditor(); },
    saveDayDataFromEditor: () => window.dayViewInstance.save()
});