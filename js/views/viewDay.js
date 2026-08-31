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
        
        return evals.map(e => {
            let badgeType = '';
            if (e.type === 'eval') badgeType = e.subject || '평가';
            else if (e.type === 'check') badgeType = '체크';
            else if (e.type === 'memo') badgeType = '메모';
            else badgeType = '기타';

            const gId = e.groupId || '';
            return `
                <div onclick="window.EvaluationManager.currentGroupId = '${gId}'; window.EvaluationManager.openViewer('${this.lockedDateStr || this.dateStr}', '${e.id}')" style="padding:4px 8px; background:#eff6ff; border:1px solid #bfdbfe; border-radius:6px; font-size:0.85rem; color:#1e40af; cursor:pointer; font-weight:bold; box-shadow:0 1px 2px rgba(0,0,0,0.05); display:flex; align-items:center; white-space:nowrap;" title="클릭하여 평가 열기">
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
        // 하루 페이지는 스크롤 관련 간섭 끄기
        window.isInfiniteScrollActive = false;
        const infBtn = document.getElementById('btn-toggle-infinite');
        if (infBtn) infBtn.style.display = 'none';

        this.lockedDateStr = this.dateStr; 
        this.showLoading('클라우드 데이터를 불러오는 중...');
        const dateStr = this.lockedDateStr;

        try { this.myGroups = await dbAPI.loadMyGroups(); } catch(e) { this.myGroups = []; }
        
        window.currentMyGroups = this.myGroups;
        if (!window.activeUnifiedFilters) window.activeUnifiedFilters = ['personal', ...this.myGroups.map(g => g.id)];
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
            
            // 🌟 [추가됨] 뷰어 모드 일정 라벨 순서 정렬
            processedEvents.sort((a, b) => {
                const aRank = masterLabels.findIndex(l => l.id === a.labelIds?.[0]);
                const bRank = masterLabels.findIndex(l => l.id === b.labelIds?.[0]);
                return (aRank === -1 ? 999 : aRank) - (bRank === -1 ? 999 : bRank);
            });
            
            const eventBadges = window.generateEventBadgesHTML(processedEvents, dateStr, 'normal') || '<p style="color:#94a3b8; font-size:0.95rem; margin:0;">등록된 일정이 없습니다.</p>';

            eventsHtml += `
            <div class="day-event-section" style="background: #fff; padding: 15px; border-radius: 8px; border: 1px solid #cbd5e1; box-shadow: 0 1px 3px rgba(0,0,0,0.05); border-left: 5px solid ${themeColor};">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; flex-wrap:wrap; gap:10px;">
                  <h3 style="font-size:1.2rem; color:${isPersonal ? '#1e40af' : '#047857'}; margin:0; font-weight:bold;">📌 오늘 할 일 <span style="font-size:0.95rem; color:#64748b; font-weight:normal;">(${isPersonal ? '🔒 ' : '👥 '}${gName})</span></h3>
              </div>
              ${eventBadges}
            </div>`;

            const periodRowsHtml = Array.from({ length: this.maxPeriod }).map((_, i) => {
                const p = i + 1;
                const pObj = this.dayData[fId].schedules[p] || {};
                const periodName = store.periodNames[i] || p + '교시';
                const evalBadges = this.generateEvalBadgesHtml('schedule', p, fId);
                
                return `
                <tr data-period="${p}">
                    <td style="width: 60px; font-weight:900; color:#475569; background:#f8fafc; vertical-align:middle; border-bottom: 1px solid #cbd5e1;">${periodName}</td>
                    <td style="width: 120px; vertical-align:top; padding:10px 8px; border-bottom: 1px dashed #cbd5e1;"><div style="font-weight:bold; color:#0f172a;">${pObj.subject || ''}</div></td>
                    <td style="vertical-align:top; padding:10px 8px; border-bottom: 1px dashed #cbd5e1;"><div style="text-align: left; color:#334155; white-space:pre-wrap;">${pObj.memo || ''}</div></td>
                    <td style="width: 25%; vertical-align:top; padding:10px 8px; border-bottom: 1px dashed #cbd5e1;">
                        <div style="color: #d97706; font-weight: 600; text-align: left; white-space:pre-wrap;">${pObj.supplies || ''}</div>
                        <div style="display:flex; align-items:center; flex-wrap:wrap; gap:6px; margin-top:4px;">
                            <div class="eval-badges-container" data-badge-period="${p}" style="display:flex; flex-wrap:wrap; gap:6px;">${evalBadges}</div>
                        </div>
                    </td>
                </tr>`;
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
                    <th style="width: 25%; position:relative; padding: 10px;">📌 비고
                        <button onclick="window.EvaluationManager.currentGroupId = '${isPersonal ? '' : fId}'; window.EvaluationManager.openCreationModal('${dateStr}', 'schedule')" style="margin-left:8px; padding:3px 10px; background:#e0f2fe; color:#0284c7; border:1px solid #7dd3fc; border-radius:6px; font-size:0.8rem; cursor:pointer; font-weight:bold;">+ 조사표</button>
                    </th>
                  </tr>
                </thead>
                <tbody id="schedule-tbody-${fId}">${periodRowsHtml}</tbody>
              </table>
            </div>`;

            const journals = this.dayData[fId].journals.filter(j => (j.content || '').trim() !== '' || (j.attachments && j.attachments.length > 0));
            
            // 🌟 [추가됨] 뷰어 모드 기록 라벨 순서 정렬
            journals.sort((a, b) => {
                const aRank = masterJournalLabels.findIndex(l => l.id === a.labelIds?.[0]);
                const bRank = masterJournalLabels.findIndex(l => l.id === b.labelIds?.[0]);
                return (aRank === -1 ? 999 : aRank) - (bRank === -1 ? 999 : bRank);
            });

            const jListHtml = journals.length > 0 ? journals.map(j => {
                const lNames = j.labelIds?.map(id => getJournalLabels().find(l => l.id === id)?.name).filter(Boolean) || j.labels || (j.label ? [j.label] : []);
                const chipsHtml = lNames.map(lName => {
                    const style = getLabelStyle(lName, 'journal') || { bg: '#fdf2f8', text: '#9d174d', border: '#fbcfe8' };
                    return `<span style="display:inline-block; padding:2px 6px; font-size:0.8rem; font-weight:bold; border-radius:4px; background:${style.bg}; color:${style.text}; border:1px solid ${style.border}; margin-right:6px; white-space:nowrap; vertical-align:middle;">${lName}</span>`;
                }).join('');

                const attachmentsHtml = (j.attachments && j.attachments.length > 0) ? `<div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:8px;">` + j.attachments.map(a => {
                    const downloadUrl = a.downloadLink || `https://drive.google.com/uc?export=download&id=${a.id}`;
                    return `
                    <div onclick="window.handleAttachmentClick('${a.name}', '${a.webViewLink}', '${downloadUrl}')" style="display:inline-flex; align-items:center; gap:6px; padding:4px 10px; background:#f8fafc; border:1px solid #cbd5e1; border-radius:6px; font-size:0.85rem; color:#0f172a; cursor:pointer; font-weight:bold; transition:0.2s;" onmouseover="this.style.background='#e2e8f0'" onmouseout="this.style.background='#f8fafc'">
                        <img src="${a.iconLink || 'https://upload.wikimedia.org/wikipedia/commons/1/12/Google_Drive_icon_%282020%29.svg'}" style="width:16px; height:16px;">
                        <span data-tooltip="${a.name}" style="max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${a.name}</span>
                    </div>`;
                }).join('') + `</div>` : '';

                return `
                    <div style="display:flex; align-items:flex-start; margin-bottom:12px; line-height:1.4;">
                        <div style="margin-top:1px; flex-shrink:0;">${chipsHtml}</div>
                        <div style="font-size:1rem; color:#1e293b; white-space:pre-wrap; word-break:break-all; flex:1;">${j.content || ''}${attachmentsHtml ? '\n' + attachmentsHtml : ''}</div>
                    </div>`;
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
        const infBtn = document.getElementById('btn-toggle-infinite');
        if (infBtn) infBtn.style.display = 'none';

        this.lockedDateStr = this.dateStr; 
        this.showLoading('편집 화면을 다중 작업공간으로 준비 중...');
        const dateStr = this.lockedDateStr;
        
        try { this.myGroups = await dbAPI.loadMyGroups(); } catch(e) { this.myGroups = []; }

        window.currentMyGroups = this.myGroups;
        if (!window.activeUnifiedFilters) window.activeUnifiedFilters = ['personal', ...this.myGroups.map(g => g.id)];
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

            const periodRowsHtml = Array.from({ length: this.maxPeriod }).map((_, i) => {
                const p = i + 1;
                const pObj = this.dayData[fId].schedules[p] || {};
                const periodName = store.periodNames[i] || p + '교시';
                const evalBadges = this.generateEvalBadgesHtml('schedule', p, fId);
                
                return `
                <tr id="period-row-${fId}-${p}" data-period="${p}" 
                    ondragstart="window.dayViewInstance.handlePeriodDragStart(event, ${p}, '${fId}')"
                    ondragend="window.dayViewInstance.handlePeriodDragEnd(event, '${fId}')"
                    ondragenter="event.preventDefault(); this.style.backgroundColor='#e2e8f0';"
                    ondragover="event.preventDefault(); event.dataTransfer.dropEffect='move';"
                    ondragleave="this.style.backgroundColor='';"
                    ondrop="event.preventDefault(); this.style.backgroundColor=''; window.dayViewInstance.handlePeriodDrop(event, ${p}, '${fId}');"
                    style="transition: background-color 0.2s;">
                  
                  <td class="period-cell" 
                      onmouseenter="document.getElementById('period-row-${fId}-${p}').setAttribute('draggable', 'true')"
                      onmouseleave="document.getElementById('period-row-${fId}-${p}').removeAttribute('draggable')"
                      style="padding:4px; vertical-align:middle; text-align:center; background:#f8fafc; cursor:grab;" title="이곳을 드래그하여 사이에 끼워넣기">
                      <div style="display:flex; align-items:center; justify-content:center; gap:6px; pointer-events:none;">
                          <span style="font-size:1.2rem; color:#94a3b8;">≡</span>
                          <span style="font-weight:900; color:#475569; font-size:0.95rem;">${periodName}</span>
                      </div>
                  </td>
                  <td class="editable-cell cell-subject" contenteditable="true" oninput="window.dayViewInstance.syncScheduleInputs('${fId}')">${pObj.subject || ''}</td>
                  <td class="editable-cell cell-memo" contenteditable="true" style="text-align: left;" oninput="window.dayViewInstance.syncScheduleInputs('${fId}')">${pObj.memo || ''}</td>
                  <td style="text-align: left; vertical-align: top;">
                    <div class="editable-cell cell-supplies" contenteditable="true" style="color: #d97706; font-weight: 600; min-height:20px; outline:none;" oninput="window.dayViewInstance.syncScheduleInputs('${fId}')">${pObj.supplies || ''}</div>
                    <div contenteditable="false" style="display:flex; align-items:center; flex-wrap:wrap; gap:6px; margin-top:4px;">
                        <div class="eval-badges-container" style="display:flex; flex-wrap:wrap; gap:6px;">
                            ${evalBadges}
                        </div>
                    </div>
                  </td>
                </tr>`;
            }).join('');

            schedulesHtml += `
            <div class="table-container" style="background:#fff; padding:15px; border-radius:8px; border: 1px solid #cbd5e1; border-left: 5px solid ${isPersonal ? '#0f766e' : '#059669'}; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
              <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:10px;">
                  <h3 style="font-size:1.2rem; color:${isPersonal ? '#0f766e' : '#059669'}; margin:0; font-weight:bold;">🏫 수업 및 시간표 <span style="font-size:0.95rem; color:#64748b; font-weight:normal;">(${isPersonal ? '🔒 ' : '👥 '}${gName})</span></h3>
                  <div style="font-size:0.8rem; color:#64748b;">💡 왼쪽 '≡' 영역을 잡아 끌어다 놓으세요.</div>
              </div>
              <table style="text-align: center;">
                <thead>
                  <tr>
                    <th style="width: 75px;">교시</th>
                    <th style="width: 120px;">수업</th>
                    <th>📝 수업 메모</th>
                    <th style="width: 25%; position:relative;">📌 비고
                        <button onclick="window.EvaluationManager.currentGroupId = '${isPersonal ? '' : fId}'; window.EvaluationManager.openCreationModal('${dateStr}', 'schedule')" style="margin-left:8px; padding:3px 10px; background:#e0f2fe; color:#0284c7; border:1px solid #7dd3fc; border-radius:6px; font-size:0.8rem; cursor:pointer; font-weight:bold;">+ 조사표</button>
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
            tbody.innerHTML = Array.from({ length: this.maxPeriod }).map((_, i) => {
                const p = i + 1;
                const pObj = schedules[p] || {};
                const periodName = store.periodNames[i] || p + '교시';
                const evalBadges = this.generateEvalBadgesHtml('schedule', p, fId);
                
                return `
                <tr id="period-row-${fId}-${p}" data-period="${p}" 
                    ondragstart="window.dayViewInstance.handlePeriodDragStart(event, ${p}, '${fId}')"
                    ondragend="window.dayViewInstance.handlePeriodDragEnd(event, '${fId}')"
                    ondragenter="event.preventDefault(); this.style.backgroundColor='#e2e8f0';"
                    ondragover="event.preventDefault(); event.dataTransfer.dropEffect='move';"
                    ondragleave="this.style.backgroundColor='';"
                    ondrop="event.preventDefault(); this.style.backgroundColor=''; window.dayViewInstance.handlePeriodDrop(event, ${p}, '${fId}');"
                    style="transition: background-color 0.2s;">
                  
                  <td class="period-cell" 
                      onmouseenter="document.getElementById('period-row-${fId}-${p}').setAttribute('draggable', 'true')"
                      onmouseleave="document.getElementById('period-row-${fId}-${p}').removeAttribute('draggable')"
                      style="padding:4px; vertical-align:middle; text-align:center; background:#f8fafc; cursor:grab;" title="이곳을 드래그하여 사이에 끼워넣기">
                      <div style="display:flex; align-items:center; justify-content:center; gap:6px; pointer-events:none;">
                          <span style="font-size:1.2rem; color:#94a3b8;">≡</span>
                          <span style="font-weight:900; color:#475569; font-size:0.95rem;">${periodName}</span>
                      </div>
                  </td>
                  <td class="editable-cell cell-subject" contenteditable="true" oninput="window.dayViewInstance.syncScheduleInputs('${fId}')">${pObj.subject || ''}</td>
                  <td class="editable-cell cell-memo" contenteditable="true" style="text-align: left;" oninput="window.dayViewInstance.syncScheduleInputs('${fId}')">${pObj.memo || ''}</td>
                  <td style="text-align: left; vertical-align: top;">
                    <div class="editable-cell cell-supplies" contenteditable="true" style="color: #d97706; font-weight: 600; min-height:20px; outline:none;" oninput="window.dayViewInstance.syncScheduleInputs('${fId}')">${pObj.supplies || ''}</div>
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

    renderEventEntries(fId) {
        const container = document.getElementById(`event-entries-container-${fId}`);
        if(!container) return;
        
        const allLabelsObj = getEventLabels();
        const uid = auth?.currentUser?.uid;
        const events = this.dayData[fId].events || [];

        // 🌟 [추가됨] 작성 모드 일정 라벨 정렬
        events.sort((a, b) => {
            const aRank = allLabelsObj.findIndex(l => l.id === a.labelIds?.[0]);
            const bRank = allLabelsObj.findIndex(l => l.id === b.labelIds?.[0]);
            return (aRank === -1 ? 999 : aRank) - (bRank === -1 ? 999 : bRank);
        });

        container.innerHTML = events.map((ev, idx) => {
            const isAuthor = !ev.authorId || !uid || ev.authorId === uid;
            const eLabelIds = ev.labelIds || [];
            const isCompleted = !!ev.completed;
            const canComplete = eLabelIds.some(id => allLabelsObj.find(l => l.id === id)?.isForward);

            let delHandler = `window.dayViewInstance.removeEventEntry('${fId}', ${idx})`;
            let forwardedBadge = '';

            const safeContent = (ev.content || '')
                .replace(/\\/g, '\\\\')
                .replace(new RegExp('\`', 'g'), '\\`')
                .replace(/\$/g, '\\$')
                .replace(/"/g, '&quot;');

            if (ev.groupId || (ev.forwardChainId && ev.originalDate && ev.originalDate !== (this.lockedDateStr || this.dateStr))) {
                const isRecurring = !!ev.groupId; 
                if (isRecurring) {
                    delHandler = `window.showGroupDeleteModal('${this.lockedDateStr || this.dateStr}', '${eLabelIds[0]||''}', \`${safeContent}\`, '${ev.groupId}', () => { window.dayViewInstance.dayData['${fId}'].events.splice(${idx}, 1); window.dayViewInstance.renderEventEntries('${fId}'); store.hasUnsavedChanges = true; }, () => { window.dayViewInstance.dayData['${fId}'].events.splice(${idx}, 1); window.dayViewInstance.renderEventEntries('${fId}'); store.hasUnsavedChanges = true; })`;
                } else {
                    delHandler = `window.showForwardDeleteModal('${this.lockedDateStr || this.dateStr}', '${eLabelIds[0]||''}', \`${safeContent}\`, '${ev.forwardChainId}', () => { window.dayViewInstance.dayData['${fId}'].events.splice(${idx}, 1); window.dayViewInstance.renderEventEntries('${fId}'); store.hasUnsavedChanges = true; })`;
                    forwardedBadge = `<div style="font-size:0.75rem; font-weight:bold; color:#059669; background:#dcfce3; padding:2px 6px; border-radius:4px; border:1px solid #bbf7d0;">↪️ 이월됨</div>`;
                }
            }

            const deleteBtnHtml = isAuthor 
                ? `<button class="modal-delete-btn" onclick="${delHandler}" title="일정 삭제" style="margin:0; background:transparent; border:none; color:#ef4444; font-size:1.1rem; cursor:pointer;">✖</button>`
                : '';

            const chipsHtml = allLabelsObj.map(lObj => {
                const isActive = eLabelIds.includes(lObj.id);
                const style = getLabelStyle(lObj.id, 'event'); 
                
                const chipClickAttr = isAuthor ? `onclick="window.dayViewInstance.toggleEventLabel('${fId}', ${idx}, '${lObj.id}')"` : '';
                const chipCursorStyle = isAuthor ? 'cursor:pointer;' : 'cursor:not-allowed; opacity:0.8;';
                
                const dynamicStyle = isActive 
                    ? `background:${style.text}; color:#ffffff; border:1px solid ${style.text};` 
                    : `background:${style.bg}; color:${style.text}; border:1px solid ${style.border}; opacity:0.6;`;

                return `<div class="label-chip ${isActive ? 'active' : ''}" ${chipClickAttr} style="padding:2px 8px; font-size:0.8rem; font-weight:bold; border-radius:4px; min-width:auto; ${chipCursorStyle} ${dynamicStyle}">${lObj.name}</div>`;
            }).join('');

            const checkboxHtml = canComplete 
                ? `<div style="padding-top:8px;"><input type="checkbox" ${isCompleted ? 'checked' : ''} ${!isAuthor ? 'disabled' : ''} onchange="window.dayViewInstance.updateEventStatus('${fId}', ${idx}, this.checked)" style="width:18px; height:18px; cursor:pointer; accent-color:#059669;" title="완료 체크"></div>`
                : '';

            const textBaseStyle = (isCompleted && canComplete) ? 'text-decoration:line-through; color:#94a3b8; background:#e2e8f0;' : 'background:#fff; color:#1e293b;';
            const textStyle = !isAuthor ? 'background:#f1f5f9; color:#64748b; cursor:not-allowed;' : textBaseStyle;
            const pureContent = (ev.content || '').replace(/➡️\s*\(미완료\)/g, '').replace(/➡️\s*\(다음 날로 이월됨\)/g, '').replace(/↪️\s*/g, '').trim();

            // 🌟 [추가됨] 알람 UI 분리 적용
            const timeVal = ev.time || '';
            let dVal = '', tVal = '';
            if (timeVal) {
                const parts = timeVal.split('T');
                dVal = parts[0]; tVal = parts[1] || '';
            }

            const timeColor = timeVal ? '#2563eb' : '#94a3b8';
            const timeBg = timeVal ? '#eff6ff' : '#f8fafc';
            const timeBorder = timeVal ? '#bfdbfe' : '#cbd5e1';

            const timeHtml = isAuthor 
                  ? `<div style="display:inline-flex; align-items:center; background:${timeBg}; padding:2px 4px; border-radius:4px; border:1px solid ${timeBorder}; margin-right:4px;" title="알림 설정 (날짜 선택 + 시간 직접 입력)">
                       <span style="font-size:0.75rem; font-weight:bold; color:${timeColor}; margin-right:4px; cursor:pointer;" onclick="if(window.Notification && Notification.permission==='default') Notification.requestPermission();">${timeVal ? '⏰' : '⏰ off'}</span>
                       <input type="date" id="day-date-${ev.id}" value="${dVal}" onchange="window.dayViewInstance.updateDateTime('${fId}', ${idx}, this.value, document.getElementById('day-time-${ev.id}').value)" style="border:none; background:transparent; font-size:0.75rem; color:${timeColor}; outline:none; cursor:pointer; padding:0; width:100px;">
                       <input type="text" id="day-time-${ev.id}" value="${tVal}" placeholder="HH:MM" maxlength="5" onblur="window.dayViewInstance.updateDateTime('${fId}', ${idx}, document.getElementById('day-date-${ev.id}').value, this.value)" onkeydown="if(event.key==='Enter') this.blur();" style="border:none; background:transparent; font-size:0.75rem; color:${timeColor}; outline:none; padding:0; width:45px; text-align:center; margin-left:4px;">
                       ${timeVal ? `<button onclick="window.dayViewInstance.updateDateTime('${fId}', ${idx}, '', '')" style="background:none; border:none; color:#ef4444; font-size:0.8rem; cursor:pointer; margin-left:4px; padding:0; line-height:1;">✖</button>` : ''}
                     </div>` 
                  : `<span style="font-size:0.75rem; color:${timeColor}; font-weight:bold; background:${timeBg}; padding:2px 6px; border-radius:4px; border:1px solid ${timeBorder}; margin-right:4px;">${window.CompactEventHelper ? window.CompactEventHelper.formatAlarmTime(timeVal) : ''}</span>`;

            return `
            <div style="display:flex; flex-direction:column; padding:10px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; margin-bottom:12px; transition:0.2s;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
                    <div class="label-chip-container" style="margin:0; display:flex; flex-wrap:wrap; gap:6px; align-items:center; flex:1;">
                        ${chipsHtml}
                        ${forwardedBadge}
                    </div>
                    <div style="display:flex; align-items:center; gap:8px; flex-shrink:0;">
                        ${timeHtml}
                        ${deleteBtnHtml}
                    </div>
                </div>
                <div style="display:flex; align-items:flex-start; gap:8px; width:100%;">
                    ${checkboxHtml}
                    <textarea class="modal-input-text" ${!isAuthor ? 'readonly' : ''} placeholder="${isAuthor ? '일정 내용 입력...' : '권한이 없습니다.'}" style="flex:1; min-height:40px; resize:none; overflow:hidden; font-size:0.95rem; padding:8px; box-sizing:border-box; border:1px solid #cbd5e1; border-radius:4px; outline:none; ${textStyle}" onfocus="window.dayViewInstance.autoResize(this)" oninput="window.dayViewInstance.autoResize(this); window.dayViewInstance.updateEventContent('${fId}', ${idx}, this.value)">${pureContent}</textarea>
                </div>
            </div>`;
        }).join('');

        setTimeout(() => { container.querySelectorAll('textarea').forEach(ta => this.autoResize(ta)); }, 0);
    }

    renderJournalEntries(fId) {
        const container = document.getElementById(`journal-entries-container-${fId}`);
        if(!container) return;
        
        const allLabelsObj = getJournalLabels();
        const journals = this.dayData[fId].journals || [];
        
        // 🌟 [추가됨] 작성 모드 기록 라벨 정렬
        journals.sort((a, b) => {
            const aRank = allLabelsObj.findIndex(l => l.id === a.labelIds?.[0]);
            const bRank = allLabelsObj.findIndex(l => l.id === b.labelIds?.[0]);
            return (aRank === -1 ? 999 : aRank) - (bRank === -1 ? 999 : bRank);
        });

        container.innerHTML = journals.map((j, idx) => {
            const jLabelIds = j.labelIds || [];
            const chipsHtml = allLabelsObj.map(lObj => {
                const isActive = jLabelIds.includes(lObj.id);
                const style = getLabelStyle(lObj.id, 'journal'); 
                
                const dynamicStyle = isActive 
                    ? `background:${style.text}; color:#ffffff; border:1px solid ${style.text};` 
                    : `background:${style.bg}; color:${style.text}; border:1px solid ${style.border}; opacity:0.6;`;

                return `<div class="label-chip ${isActive ? 'active' : ''}" onclick="window.dayViewInstance.toggleJournalLabel('${fId}', ${idx}, '${lObj.id}')" style="padding:2px 8px; font-size:0.8rem; font-weight:bold; border-radius:4px; min-width:auto; cursor:pointer; ${dynamicStyle}">${lObj.name}</div>`;
            }).join('');

            const attachmentsHtml = (j.attachments && j.attachments.length > 0) ? `<div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:8px;">` + j.attachments.map((a, aIdx) => {
                const downloadUrl = a.downloadLink || `https://drive.google.com/uc?export=download&id=${a.id}`;
                return `
                <div onclick="window.handleAttachmentClick('${a.name}', '${a.webViewLink}', '${downloadUrl}')" style="display:inline-flex; align-items:center; gap:6px; padding:4px 8px; background:#fff; border:1px solid #fbcfe8; border-radius:6px; font-size:0.85rem; color:#be185d; box-shadow:0 1px 2px rgba(0,0,0,0.05); cursor:pointer;">
                    <img src="${a.iconLink || 'https://upload.wikimedia.org/wikipedia/commons/1/12/Google_Drive_icon_%282020%29.svg'}" style="width:16px; height:16px;">
                    <span data-tooltip="${a.name}" style="font-weight:bold; max-width:150px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${a.name}</span>
                    <button class="modal-delete-btn" onclick="event.stopPropagation(); window.dayViewInstance.removeJournalAttachment('${fId}', ${idx}, ${aIdx})" style="margin-left:4px; padding:0; color:#ef4444; font-size:1.1rem; line-height:1;" title="첨부 링크 삭제">✖</button>
                </div>`;
            }).join('') + `</div>` : '';

            const uploadId = `journal-upload-${fId}-${idx}`;
            const isUploading = j.isUploading ? `<div style="margin-top:8px; font-size:0.85rem; color:#2563eb; font-weight:bold; display:flex; align-items:center; gap:6px;">⏳ 구글 드라이브로 파일 업로드 중...</div>` : '';

            return `
            <div style="display:flex; flex-direction:column; gap:8px; margin-bottom:12px; padding:10px; background:#fdf2f8; border:1px solid #fbcfe8; border-radius:6px; position:relative;">
                <div style="position:absolute; top:8px; right:8px;">
                    <button class="modal-delete-btn" onclick="window.dayViewInstance.removeJournalEntry('${fId}', ${idx})" title="기록 삭제" style="margin:0; color:#be185d;">✖</button>
                </div>
                <div class="label-chip-container" style="margin:0; padding-right:24px; display:flex; flex-wrap:wrap; gap:4px;">${chipsHtml}</div>
                <div style="display:flex; align-items:flex-start; width:100%; gap:8px;">
                    <textarea class="modal-input-text" placeholder="학급 기록, 상담, 업무 일지 등을 입력하세요..." style="flex:1; min-height:40px; resize:none; overflow:hidden; font-size:0.95rem; padding:8px; box-sizing:border-box; outline:none; border:1px solid #fbcfe8; border-radius:4px;" onfocus="window.dayViewInstance.autoResize(this)" oninput="window.dayViewInstance.autoResize(this); window.dayViewInstance.updateJournalContent('${fId}', ${idx}, this.value)">${j.content || ''}</textarea>
                    
                    <button onclick="document.getElementById('${uploadId}').click()" style="background:#fce7f3; color:#be185d; border:1px solid #fbcfe8; padding:0; border-radius:4px; cursor:pointer; font-size:1.2rem; width:40px; height:40px; display:flex; align-items:center; justify-content:center; flex-shrink:0; box-shadow:0 1px 2px rgba(0,0,0,0.05); transition:0.2s;" onmouseover="this.style.background='#fbcfe8'" onmouseout="this.style.background='#fce7f3'" title="구글 드라이브 문서/파일 첨부">📎</button>
                    <input type="file" id="${uploadId}" multiple style="display:none;" onchange="window.dayViewInstance.handleJournalAttachmentUpload('${fId}', ${idx}, this)">
                </div>
                ${isUploading}
                ${attachmentsHtml}
            </div>`;
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
        }
    }

    updateEventStatus(fId, idx, isCompleted) {
        store.hasUnsavedChanges = true;
        if (this.dayData[fId].events[idx]) this.dayData[fId].events[idx].completed = isCompleted;
        this.renderEventEntries(fId);
    }

    // 🌟 [추가됨] DayView 자체적인 알람 시간 업데이트 함수
    updateDateTime(fId, idx, dVal, tVal) {
        store.hasUnsavedChanges = true;
        const ev = this.dayData[fId].events[idx];
        if (ev) {
            if (!dVal && (!tVal || tVal.trim() === '')) {
                ev.time = '';
            } else {
                let finalT = (tVal || '').trim().replace(/[^0-9:]/g, '');
                if (/^\d{3,4}$/.test(finalT.replace(':', ''))) {
                    let cleanNum = finalT.replace(':', '');
                    if (cleanNum.length === 3) finalT = '0' + cleanNum[0] + ':' + cleanNum.substring(1);
                    else finalT = cleanNum.substring(0,2) + ':' + cleanNum.substring(2);
                }
                if (!finalT || finalT.length < 4) finalT = '09:00'; 
                ev.time = `${dVal || this.lockedDateStr || this.dateStr}T${finalT}`;
            }
            ev.alarmTriggered = false; 
        }
        this.renderEventEntries(fId);
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

        this.dayData[fId].schedules = {};
        tbody.querySelectorAll('tr[data-period]').forEach(row => {
            const p = row.getAttribute('data-period');
            const subject = row.querySelector('.cell-subject').innerText.trim();
            const memo = row.querySelector('.cell-memo').innerText.trim();
            const supplies = row.querySelector('.cell-supplies').innerText.trim();
            if (subject || memo || supplies) this.dayData[fId].schedules[p] = { subject, memo, supplies };
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
                e.sharedGroupId = fId === 'personal' ? null : fId;
                snapshot[0].validEvents.push(e);
            });

            snapshot[0].schedulesData[fId] = dData.schedules;

            const validJournals = dData.journals.filter(j => (j.content || '').trim() !== '' || (j.labelIds && j.labelIds.length > 0) || (j.attachments && j.attachments.length > 0));
            validJournals.forEach(j => {
                if (!j.id) j.id = 'jr_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2,5);
                if (!j.authorId && auth?.currentUser?.uid) j.authorId = auth.currentUser.uid;
                delete j.isUploading;
            });
            snapshot[0].journalsData[fId] = validJournals;
        });

        try {
            const promises = [];
            window.activeUnifiedFilters.forEach(fId => {
                const pEvents = snapshot[0].validEvents.filter(e => (e.sharedGroupId || 'personal') === fId);
                const evCol = fId === 'personal' ? getUserCol('events') : getGroupCol(fId, 'events');
                promises.push(setDoc(doc(evCol, dateStr), { 
                    eventList: pEvents,
                    eventText: window.formatEventListToText ? window.formatEventListToText(pEvents) : '',
                    updatedAt: Date.now() 
                }, { merge: true }));

                const scCol = fId === 'personal' ? getUserCol('schedules') : getGroupCol(fId, 'schedules');
                promises.push(setDoc(doc(scCol, dateStr), { 
                    periods: snapshot[0].schedulesData[fId] || {}, 
                    updatedAt: Date.now() 
                }, { merge: true }));

                const jrCol = fId === 'personal' ? getUserCol('journals') : getGroupCol(fId, 'journals');
                promises.push(setDoc(doc(jrCol, dateStr), {
                    entries: snapshot[0].journalsData[fId] || [], 
                    updatedAt: Date.now() 
                }, { merge: true }));
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
