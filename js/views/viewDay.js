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
        const filtersToLoad = window.activeUnifiedFilters || ['personal'];
        
        const evalPromises = filtersToLoad.map(async f => {
            const gid = f === 'personal' ? null : f;
            const evals = await dbAPI.loadEvaluations(dateStr, gid) || [];
            evals.forEach(e => e.groupId = gid);
            return evals.filter(e => e.context?.source === 'schedule');
        });

        const journalPromise = dbAPI.loadEvaluations(dateStr, null).then(journalEvals => {
            (journalEvals || []).forEach(e => e.groupId = null);
            return (journalEvals || []).filter(e => e.context?.source === 'journal');
        }).catch(() => []);

        const [scheduleEvalsResults, journalEvals] = await Promise.all([
            Promise.all(evalPromises),
            journalPromise
        ]);

        let allEvals = scheduleEvalsResults.flat().concat(journalEvals);

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

        const filterDataPromises = filters.map(async (fId) => {
            const evCol = fId === 'personal' ? getUserCol('events') : getGroupCol(fId, 'events');
            const scCol = fId === 'personal' ? getUserCol('schedules') : getGroupCol(fId, 'schedules');
            const jrCol = fId === 'personal' ? getUserCol('journals') : getGroupCol(fId, 'journals');

            const [evDoc, scDoc, jrDoc] = await Promise.all([
                getDoc(doc(evCol, dateStr)).catch(e => { hasCacheError = true; return null; }),
                getDoc(doc(scCol, dateStr)).catch(e => { hasCacheError = true; return null; }),
                getDoc(doc(jrCol, dateStr)).catch(e => { hasCacheError = true; return null; })
            ]);

            let eList = [];
            if (evDoc && evDoc.exists()) {
                eList = this.parseEvents(evDoc.data());
                eList.forEach(e => { e.sharedGroupId = fId === 'personal' ? null : fId; });
            }

            let jList = (jrDoc && jrDoc.exists()) ? (jrDoc.data().entries || []) : [];
            jList.forEach(j => {
                if (!j.id) j.id = 'jr_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5);
            });

            return {
                fId,
                events: eList,
                schedules: (scDoc && scDoc.exists()) ? (scDoc.data().periods || {}) : {},
                journals: jList
            };
        });

        const filterResults = await Promise.all(filterDataPromises);
        filterResults.forEach(res => {
            this.dayData[res.fId] = {
                events: res.events,
                schedules: res.schedules,
                journals: res.journals
            };
        });

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
            
            // 기존 뷰어 모드의 라벨/이름 기준 강제 정렬 제거
            // 작성 페이지에서의 순서(드래그 앤 드롭 등)를 그대로 유지합니다.
            
            const eventBadges = window.generateEventBadgesHTML(processedEvents, dateStr, 'normal') || '<p style="color:#94a3b8; font-size:0.95rem; margin:0;">등록된 일정이 없습니다.</p>';

            eventsHtml += `
            <div class="day-event-section" style="background: #fff; padding: 15px; border-radius: 8px; border: 1px solid #cbd5e1; box-shadow: 0 1px 3px rgba(0,0,0,0.05); border-left: 5px solid ${themeColor};">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; flex-wrap:wrap; gap:10px;">
                  <h3 style="font-size:1.2rem; color:${isPersonal ? '#1e40af' : '#047857'}; margin:0; font-weight:bold;">📌 오늘 할 일 <span style="font-size:0.95rem; color:#64748b; font-weight:normal;">(${isPersonal ? '🔒 ' : '👥 '}${gName})</span></h3>
              </div>
              ${eventBadges}
            </div>`;

            const periodRowsHtml = Array.from({ length: this.maxPeriod || 6 }).map((_, i) => {
                const p = i + 1;
                const pObj = this.dayData[fId].schedules[p] || {};
                const periodName = store.periodNames[i] || p + '교시';
                const evalBadges = this.generateEvalBadgesHtml('schedule', p, fId);
                
                // 🚨 수정됨: 수업 뷰어의 링크 배지
                const linkCount = (pObj.linkedItems || []).length;
                const linkBadge = linkCount > 0 ? `<button onclick="window.LinkManager.openViewer('${dateStr}', null, '${fId}', 'schedule', ${p})" style="background:#fef08a; color:#854d0e; font-size:0.7rem; padding:2px 5px; border-radius:4px; font-weight:bold; cursor:pointer; border:1px solid #fde047;" title="연결된 항목 보기 및 수정">📑 ${linkCount}</button>` : '';

                const editBtn = `<button type="button" class="hover-edit-btn" onclick="event.stopPropagation(); window.DetailEditManager.open('schedule', '${dateStr}', ${p}, '${fId}')" style="margin-left:auto; flex-shrink:0;" title="${periodName} 수업 상세 및 수정">✏️</button>`;

                return `
                <tr data-period="${p}" class="hover-edit-item">
                    <td style="width: 60px; font-weight:900; color:#475569; background:#f8fafc; vertical-align:middle; border-bottom: 1px solid #cbd5e1;">${periodName}</td>
                    <td style="width: 120px; vertical-align:top; padding:10px 8px; border-bottom: 1px dashed #cbd5e1;">
                        <div style="display:flex; align-items:center; justify-content:space-between; gap:4px;">
                            <span style="font-weight:bold; color:#0f172a;">${pObj.subject || ''}</span>
                            ${editBtn}
                        </div>
                    </td>
                    <td style="vertical-align:top; padding:10px 8px; border-bottom: 1px dashed #cbd5e1;"><div style="text-align: left; color:#334155; white-space:pre-wrap;">${pObj.memo || ''}</div></td>
                    <td style="width: 25%; vertical-align:top; padding:10px 8px; border-bottom: 1px dashed #cbd5e1;">
                        <div style="color: #d97706; font-weight: 600; text-align: left; white-space:pre-wrap;">${pObj.supplies || ''}</div>
                        <div style="display:flex; align-items:center; flex-wrap:wrap; gap:6px; margin-top:4px;">
                            <div class="eval-badges-container" data-badge-period="${p}" style="display:flex; flex-wrap:wrap; gap:6px;">
                                ${linkBadge}
                                ${evalBadges}
                            </div>
                        </div>
                    </td>
                </tr>`;
            }).join('');

            // 🚨 수정됨: 누락되었던 <tbody> 와 </table> 정상 복구 및 머리글 버튼 축소 적용
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
            
            // 기존 뷰어 모드의 라벨/이름 기준 강제 정렬 제거
            // 작성 페이지에서의 순서(드래그 앤 드롭 등)를 그대로 유지합니다.

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
                        <span style="max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${a.name}</span>
                    </div>`;
                }).join('') + `</div>` : '';

                // 🚨 수정됨: 기록 뷰어의 링크 배지
                const linkCount = (j.linkedItems || []).length;
                const linkBadgeHtml = linkCount > 0 
                    ? `<button onclick="window.LinkManager.openViewer('${dateStr}', '${j.id}', '${fId}', 'journal')" style="background:#fef08a; color:#854d0e; font-size:0.75rem; padding:2px 6px; border-radius:4px; margin-left:4px; font-weight:bold; border:1px solid #fde047; cursor:pointer;" title="연결된 내용 보기 및 수정">📑 ${linkCount}</button>` 
                    : '';

                const rId = Math.random().toString(36).substr(2,9);
                const toggleId = j.id ? 'journal-extras-' + j.id : 'journal-extras-' + rId;
                const textId = j.id ? 'journal-text-' + j.id : 'journal-text-' + rId;
                const toggleBtnHtml = `<button onclick="const xt = document.getElementById('${toggleId}'); const tx = document.getElementById('${textId}'); const isC = xt.style.display === 'none'; if(isC){ xt.style.display='block'; tx.style.display='block'; tx.style.whiteSpace='pre-wrap'; tx.style.overflow='visible'; tx.style.textOverflow='clip'; this.innerText='▼'; }else{ xt.style.display='none'; tx.style.display='block'; tx.style.whiteSpace='nowrap'; tx.style.overflow='hidden'; tx.style.textOverflow='ellipsis'; this.innerText='▶'; }" style="background:none; border:none; cursor:pointer; font-size:0.75rem; color:#64748b; padding:0 4px; margin-right:4px; outline:none;" title="접기/펼치기">▼</button>`;

                const editBtn = `<button type="button" class="hover-edit-btn" onclick="event.stopPropagation(); window.DetailEditManager.open('journal', '${dateStr}', '${j.id}', '${fId}')" style="margin-left:auto; flex-shrink:0;" title="기록 상세 및 수정">✏️</button>`;

                return `
                    <div class="hover-edit-item" style="display:flex; align-items:flex-start; margin-bottom:12px; line-height:1.4; padding:2px 4px; border-radius:4px;">
                        <div style="margin-top:1px; flex-shrink:0; display:flex; align-items:center;">
                            ${toggleBtnHtml}${chipsHtml}${linkBadgeHtml}
                        </div>
                        <div style="font-size:1rem; color:#1e293b; flex:1; margin-left:6px; min-width:0; overflow:hidden;">
                            <div id="${textId}" style="white-space:pre-wrap; word-break:break-all; display:block;">${j.content || ''}</div>
                            <div id="${toggleId}" style="display:block; margin-top:4px;">${attachmentsHtml}</div>
                        </div>
                        ${editBtn}
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

        const filterEditorPromises = filters.map(async (fId) => {
            const evCol = fId === 'personal' ? getUserCol('events') : getGroupCol(fId, 'events');
            const scCol = fId === 'personal' ? getUserCol('schedules') : getGroupCol(fId, 'schedules');
            const jrCol = fId === 'personal' ? getUserCol('journals') : getGroupCol(fId, 'journals');

            const [evDoc, scDoc, jrDoc] = await Promise.all([
                getDoc(doc(evCol, dateStr)).catch(e => { hasCacheError = true; return null; }),
                getDoc(doc(scCol, dateStr)).catch(e => { hasCacheError = true; return null; }),
                getDoc(doc(jrCol, dateStr)).catch(e => { hasCacheError = true; return null; })
            ]);

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

            let jList = (jrDoc && jrDoc.exists()) ? (jrDoc.data().entries || []) : [];
            jList = jList.map(j => ({ 
                ...j, 
                id: j.id || ('jr_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5)),
                labelIds: j.labelIds || [], 
                attachments: j.attachments || [] 
            }));
            if (jList.length === 0) {
                const masterJournalLabels = getJournalLabels();
                const defaultJrLabelId = masterJournalLabels.length > 0 ? masterJournalLabels[0].id : null;
                jList.push({ 
                    id: 'jr_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5),
                    labelIds: defaultJrLabelId ? [defaultJrLabelId] : [], 
                    content: '', 
                    attachments: [] 
                });
            }

            return {
                fId,
                events: eList,
                schedules: (scDoc && scDoc.exists()) ? (scDoc.data().periods || {}) : {},
                journals: jList
            };
        });

        const editorResults = await Promise.all(filterEditorPromises);
        editorResults.forEach(res => {
            this.dayData[res.fId] = {
                events: res.events,
                schedules: res.schedules,
                journals: res.journals
            };
        });

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

            const periodRowsHtml = Array.from({ length: this.maxPeriod || 6 }).map((_, i) => {
                const p = i + 1;
                const pObj = this.dayData[fId].schedules[p] || {};
                const periodName = store.periodNames[i] || p + '교시';
                const evalBadges = this.generateEvalBadgesHtml('schedule', p, fId);
                
                // 🚨 수정됨: 에디터 모드의 수업 링크 배지
                const linkCount = (pObj.linkedItems || []).length;
                const linkBadge = linkCount > 0 ? `<button onclick="window.LinkManager.openViewer('${dateStr}', null, '${fId}', 'schedule', ${p})" style="background:#fef08a; color:#854d0e; font-size:0.7rem; padding:2px 5px; border-radius:4px; font-weight:bold; cursor:pointer; border:1px solid #fde047;" title="연결된 항목 보기 및 수정">📑 ${linkCount}</button>` : '';
				
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
                        <div class="eval-badges-container" data-badge-period="${p}" style="display:flex; flex-wrap:wrap; gap:6px;">
                            ${linkBadge}
                            ${evalBadges}
                        </div>
                    </div>
                  </td>
                </tr>`;
            }).join('');

            // 🚨 수정됨: 머리글 📌 비고 칸 버튼 축소 적용
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

    // ===== 일정 (Event) Drag & Drop 순서 변경 =====
    handleEventDragStart(event, index, filterId) {
        window.dayViewInstance.draggedEventIdx = index;
        window.dayViewInstance.draggedEventFilterId = filterId;
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', String(index));
        setTimeout(() => {
            const card = document.getElementById(`event-card-${filterId}-${index}`);
            if (card) card.style.opacity = '0.4';
        }, 0);
    }

    handleEventDragEnd(event, filterId) {
        const container = document.getElementById(`event-entries-container-${filterId}`);
        if (container) {
            container.querySelectorAll('[id^="event-card-"]').forEach(card => {
                card.style.opacity = '1';
                card.style.backgroundColor = '';
                card.removeAttribute('draggable');
            });
        }
        window.dayViewInstance.draggedEventIdx = null;
        window.dayViewInstance.draggedEventFilterId = null;
    }

    handleEventDrop(event, targetIdx, filterId) {
        event.preventDefault();
        event.stopPropagation();
        
        let sourceIdxStr = '';
        try { sourceIdxStr = event.dataTransfer.getData('text/plain'); } catch(e) {}
        const sourceIdx = sourceIdxStr !== '' ? parseInt(sourceIdxStr, 10) : window.dayViewInstance.draggedEventIdx;

        if (sourceIdx === null || sourceIdx === undefined || isNaN(sourceIdx) || sourceIdx === targetIdx || window.dayViewInstance.draggedEventFilterId !== filterId) {
            return;
        }

        this.syncEventInputs(filterId);
        const events = this.dayData[filterId].events;
        if (!events || !events[sourceIdx] || !events[targetIdx]) return;

        const movedItem = events.splice(sourceIdx, 1)[0];
        events.splice(targetIdx, 0, movedItem);

        this.renderEventEntries(filterId);
        store.hasUnsavedChanges = true;
        window.dayViewInstance.draggedEventIdx = null;
        window.dayViewInstance.draggedEventFilterId = null;
    }

    // ===== 기록 (Journal) Drag & Drop 순서 변경 =====
    handleJournalDragStart(event, index, filterId) {
        window.dayViewInstance.draggedJournalIdx = index;
        window.dayViewInstance.draggedJournalFilterId = filterId;
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', String(index));
        setTimeout(() => {
            const card = document.getElementById(`journal-card-${filterId}-${index}`);
            if (card) card.style.opacity = '0.4';
        }, 0);
    }

    handleJournalDragEnd(event, filterId) {
        const container = document.getElementById(`journal-entries-container-${filterId}`);
        if (container) {
            container.querySelectorAll('[id^="journal-card-"]').forEach(card => {
                card.style.opacity = '1';
                card.style.backgroundColor = '';
                card.removeAttribute('draggable');
            });
        }
        window.dayViewInstance.draggedJournalIdx = null;
        window.dayViewInstance.draggedJournalFilterId = null;
    }

    handleJournalDrop(event, targetIdx, filterId) {
        event.preventDefault();
        event.stopPropagation();
        
        let sourceIdxStr = '';
        try { sourceIdxStr = event.dataTransfer.getData('text/plain'); } catch(e) {}
        const sourceIdx = sourceIdxStr !== '' ? parseInt(sourceIdxStr, 10) : window.dayViewInstance.draggedJournalIdx;

        if (sourceIdx === null || sourceIdx === undefined || isNaN(sourceIdx) || sourceIdx === targetIdx || window.dayViewInstance.draggedJournalFilterId !== filterId) {
            return;
        }

        this.syncJournalInputs(filterId);
        const journals = this.dayData[filterId].journals;
        if (!journals || !journals[sourceIdx] || !journals[targetIdx]) return;

        const movedItem = journals.splice(sourceIdx, 1)[0];
        journals.splice(targetIdx, 0, movedItem);

        this.renderJournalEntries(filterId);
        store.hasUnsavedChanges = true;
        window.dayViewInstance.draggedJournalIdx = null;
        window.dayViewInstance.draggedJournalFilterId = null;
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
            tbody.innerHTML = Array.from({ length: this.maxPeriod || 6 }).map((_, i) => {
                const p = i + 1;
                const pObj = schedules[p] || {};
                const periodName = store.periodNames[i] || p + '교시';
                const evalBadges = this.generateEvalBadgesHtml('schedule', p, fId);
                
                // 🚨 드래그 후 렌더링 시 링크 배지 재생성
                const linkCount = (pObj.linkedItems || []).length;
                const linkBadge = linkCount > 0 ? `<button onclick="window.LinkManager.openViewer('${this.lockedDateStr || this.dateStr}', null, '${fId}', 'schedule', ${p})" style="background:#fef08a; color:#854d0e; font-size:0.7rem; padding:2px 5px; border-radius:4px; font-weight:bold; cursor:pointer; border:1px solid #fde047;" title="연결된 항목 보기 및 수정">📑 ${linkCount}</button>` : '';

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
                        <div class="eval-badges-container" data-badge-period="${p}" style="display:flex; flex-wrap:wrap; gap:6px;">
                            ${linkBadge}
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

    openDayAlarmModal(fId, idx) {
        this.syncEventInputs(fId);
        const events = this.dayData[fId]?.events;
        if (!events || !events[idx]) return;
        const ev = events[idx];
        const dateStr = this.lockedDateStr || this.dateStr;

        let dVal = dateStr;
        let tVal = '';
        if (ev.time) {
            const parts = ev.time.split('T');
            dVal = parts[0] || dateStr;
            tVal = parts[1] || '';
        }

        let modal = document.getElementById('sp3-alarm-modal-overlay');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'sp3-alarm-modal-overlay';
            modal.style.cssText = "position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.6); z-index:999999; display:flex; align-items:center; justify-content:center;";
            document.body.appendChild(modal);
        }

        modal.innerHTML = `
            <div style="background:#fff; padding:25px; border-radius:12px; width:340px; box-shadow:0 10px 25px rgba(0,0,0,0.2);" onclick="event.stopPropagation()">
                <h3 style="margin-top:0; color:#1e40af; font-size:1.3rem; display:flex; align-items:center; gap:8px;">⏰ 알림 시간 설정</h3>
                <div style="margin-bottom:15px;">
                    <label style="display:block; font-size:0.9rem; font-weight:bold; color:#475569; margin-bottom:5px;">날짜 선택</label>
                    <input type="date" id="day-alarm-popup-date" value="${dVal}" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:6px; outline:none; font-size:1rem; box-sizing:border-box; cursor:pointer;">
                </div>
                <div style="margin-bottom:25px;">
                    <label style="display:block; font-size:0.9rem; font-weight:bold; color:#475569; margin-bottom:5px;">시간 입력 (24시간제 키보드 입력)</label>
                    <input type="text" id="day-alarm-popup-time" value="${tVal}" placeholder="예: 1430 (오후 2시 30분)" maxlength="5" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:6px; outline:none; font-size:1.1rem; box-sizing:border-box; text-align:center; letter-spacing:2px; font-weight:bold;" autocomplete="off">
                </div>
                <div style="display:flex; justify-content:space-between; gap:8px;">
                    <button id="btn-day-alarm-off" data-shortcut-added="true" style="padding:10px 15px; background:#fef2f2; color:#ef4444; border:none; border-radius:6px; font-weight:bold; cursor:pointer; font-size:0.95rem;">알림 끄기</button>
                    <div style="display:flex; gap:8px;">
                        <button id="btn-day-alarm-cancel" data-shortcut-added="true" style="padding:10px 15px; background:#f1f5f9; color:#475569; border:none; border-radius:6px; font-weight:bold; cursor:pointer; font-size:0.95rem;">취소</button>
                        <button id="btn-day-alarm-save" data-shortcut-added="true" style="padding:10px 20px; background:#2563eb; color:#fff; border:none; border-radius:6px; font-weight:bold; cursor:pointer; font-size:0.95rem;">저장</button>
                    </div>
                </div>
            </div>
        `;
        modal.style.display = 'flex';
        if (window.increaseModalCount) window.increaseModalCount();

        const closePopup = () => {
            modal.style.display = 'none';
            if (window.decreaseModalCount) window.decreaseModalCount();
        };

        modal.onclick = closePopup;
        document.getElementById('btn-day-alarm-cancel').onclick = closePopup;

        document.getElementById('btn-day-alarm-off').onclick = () => {
            ev.time = '';
            ev.alarmTriggered = false;
            store.hasUnsavedChanges = true;
            closePopup();
            this.renderEventEntries(fId);
            if (window.showToast) window.showToast('알림이 해제되었습니다.');
        };

        document.getElementById('btn-day-alarm-save').onclick = () => {
            const dInput = document.getElementById('day-alarm-popup-date').value;
            const tInput = document.getElementById('day-alarm-popup-time').value;
            
            if (!dInput && (!tInput || tInput.trim() === '')) {
                ev.time = '';
            } else {
                let finalT = (tInput || '').trim().replace(/[^0-9:]/g, '');
                if (/^\d{3,4}$/.test(finalT.replace(':', ''))) {
                    let cleanNum = finalT.replace(':', '');
                    if (cleanNum.length === 3) finalT = '0' + cleanNum[0] + ':' + cleanNum.substring(1);
                    else finalT = cleanNum.substring(0, 2) + ':' + cleanNum.substring(2);
                }
                if (!finalT || finalT.length < 4) finalT = '09:00';
                ev.time = `${dInput || dateStr}T${finalT}`;
            }
            ev.alarmTriggered = false;
            store.hasUnsavedChanges = true;
            closePopup();
            this.renderEventEntries(fId);
            if (window.showToast) window.showToast('⏰ 알림 시간이 설정되었습니다.');
        };

        document.getElementById('day-alarm-popup-time').onkeydown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                document.getElementById('btn-day-alarm-save').click();
            }
        };
        setTimeout(() => document.getElementById('day-alarm-popup-time').focus(), 50);
    }

    renderEventEntries(fId) {
        const container = document.getElementById(`event-entries-container-${fId}`);
        if(!container) return;
        
        const allLabelsObj = getEventLabels();
        const uid = auth?.currentUser?.uid;
        const events = this.dayData[fId].events || [];

        // 🚨 최하단 추가 및 드래그앤드롭 순서 유지를 위해 강제 sort 제거
        container.innerHTML = events.map((ev, idx) => {
            const isAuthor = !ev.authorId || !uid || ev.authorId === uid;
            const eLabelIds = ev.labelIds || [];
            const isCompleted = !!ev.completed;
            const canComplete = eLabelIds.some(id => allLabelsObj.find(l => l.id === id)?.isForward);

            let forwardedBadge = '';
            if (ev.forwardChainId && ev.originalDate && ev.originalDate !== (this.lockedDateStr || this.dateStr)) {
                forwardedBadge = `<div style="font-size:0.75rem; font-weight:bold; color:#059669; background:#dcfce3; padding:2px 6px; border-radius:4px; border:1px solid #bbf7d0;">↪️ 이월됨</div>`;
            }

            const deleteBtnHtml = isAuthor 
                ? `<button class="modal-delete-btn" onclick="window.dayViewInstance.requestRemoveEvent('${fId}', ${idx})" title="일정 삭제" style="margin:0; background:transparent; border:none; color:#ef4444; font-size:1.1rem; cursor:pointer;">✖</button>`
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

            const timeVal = ev.time || '';
            const timeColor = timeVal ? '#2563eb' : '#94a3b8';
            const timeBg = timeVal ? '#eff6ff' : '#f8fafc';
            const timeBorder = timeVal ? '#bfdbfe' : '#cbd5e1';

            const timeHtml = isAuthor 
                  ? `<div onclick="window.dayViewInstance.openDayAlarmModal('${fId}',${idx})" style="display:inline-flex; align-items:center; background:${timeBg}; padding:2px 6px; border-radius:4px; border:1px solid ${timeBorder}; cursor:pointer; margin-right:4px;" title="클릭하여 알림 설정">
                       <span style="font-size:0.75rem; font-weight:bold; color:${timeColor};">${window.CompactEventHelper ? window.CompactEventHelper.formatAlarmTime(timeVal) : ''}</span>
                     </div>` 
                  : `<span style="font-size:0.75rem; color:${timeColor}; font-weight:bold; background:${timeBg}; padding:2px 6px; border-radius:4px; border:1px solid ${timeBorder}; margin-right:4px;">${window.CompactEventHelper ? window.CompactEventHelper.formatAlarmTime(timeVal) : ''}</span>`;

            // 🚨 수정됨: 하루 일정 카드에 링크 생성(🔗 연결)과 확인(📑) 버튼 완벽 분리 적용
            const linkCount = (ev.linkedItems || []).length;
            const linkBadgeHtml = linkCount > 0 
                ? `<button onclick="window.LinkManager.openViewer('${this.lockedDateStr || this.dateStr}', '${ev.id}', '${fId}', 'event')" style="background:#fef08a; color:#854d0e; font-size:0.75rem; padding:2px 6px; border-radius:4px; margin-left:4px; font-weight:bold; border:1px solid #fde047; cursor:pointer;" title="연결된 내용 보기 및 수정">📑 ${linkCount}</button>` 
                : '';
            const linkBtnHtml = isAuthor
                  ? `<div style="display:flex; align-items:center; margin-right:4px;"><button onclick="window.LinkManager.openModal('event', '${this.lockedDateStr || this.dateStr}', '${ev.id}', '${fId}')" style="background:#f8fafc; border:1px solid #cbd5e1; color:#475569; font-size:0.75rem; cursor:pointer; padding:2px 6px; border-radius:4px; line-height:1;" title="새 링크 연결">🔗 연결</button>${linkBadgeHtml}</div>`
                  : (linkCount > 0 ? `<div style="margin-right:4px;">${linkBadgeHtml}</div>` : '');

            const authorBadge = (fId !== 'personal' && ev.authorId)
                ? `<span style="font-size:0.7rem; background:#e2e8f0; color:#475569; padding:2px 6px; border-radius:4px; margin-left:4px;" title="작성자">👤 ${ev.authorName || ev.authorId.substring(0, 6)}</span>`
                : '';

            return `
            <div id="event-card-${fId}-${idx}" data-event-idx="${idx}"
                 ondragstart="window.dayViewInstance.handleEventDragStart(event, ${idx}, '${fId}')"
                 ondragend="window.dayViewInstance.handleEventDragEnd(event, '${fId}')"
                 ondragenter="event.preventDefault(); this.style.backgroundColor='#e2e8f0';"
                 ondragover="event.preventDefault(); event.dataTransfer.dropEffect='move';"
                 ondragleave="this.style.backgroundColor='';"
                 ondrop="event.preventDefault(); this.style.backgroundColor=''; window.dayViewInstance.handleEventDrop(event, ${idx}, '${fId}');"
                 style="display:flex; flex-direction:column; padding:10px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; margin-bottom:12px; transition: background-color 0.2s, opacity 0.2s;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
                    <div class="label-chip-container" style="margin:0; display:flex; flex-wrap:wrap; gap:6px; align-items:center; flex:1;">
                        ${chipsHtml}${forwardedBadge}
                    </div>
                    <div style="display:flex; align-items:center; gap:8px; flex-shrink:0;">
                        ${linkBtnHtml} 
                        ${timeHtml}
                        ${authorBadge}${deleteBtnHtml}
                    </div>
                </div>
                <div style="display:flex; align-items:flex-start; gap:8px; width:100%;">
                    <div class="event-drag-handle" 
                         onmouseenter="document.getElementById('event-card-${fId}-${idx}').setAttribute('draggable', 'true')"
                         onmouseleave="document.getElementById('event-card-${fId}-${idx}').removeAttribute('draggable')"
                         onmousedown="document.getElementById('event-card-${fId}-${idx}').setAttribute('draggable', 'true')"
                         style="cursor:grab; padding:6px 4px; color:#64748b; font-size:1.3rem; line-height:1; user-select:none; display:flex; align-items:center; flex-shrink:0;"
                         title="이곳을 드래그하여 일정 순서 변경">
                        ≡
                    </div>
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
        
        // 🚨 최하단 추가 및 드래그앤드롭 순서 유지를 위해 강제 sort 제거
        const uid = auth?.currentUser?.uid;

        container.innerHTML = journals.map((j, idx) => {
            const isAuthor = !j.authorId || !uid || j.authorId === uid;
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
                    <span style="font-weight:bold; max-width:150px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${a.name}</span>
                    <button class="modal-delete-btn" onclick="event.stopPropagation(); window.dayViewInstance.removeJournalAttachment('${fId}', ${idx}, ${aIdx})" style="margin-left:4px; padding:0; color:#ef4444; font-size:1.1rem; line-height:1;" title="첨부 링크 삭제">✖</button>
                </div>`;
            }).join('') + `</div>` : '';

            const uploadId = `journal-upload-${fId}-${idx}`;
            const isUploading = j.isUploading ? `<div style="margin-top:8px; font-size:0.85rem; color:#2563eb; font-weight:bold; display:flex; align-items:center; gap:6px;">⏳ 구글 드라이브로 파일 업로드 중...</div>` : '';

            // 🚨 수정됨: 기록 영역의 링크 생성(🔗 연결)과 확인(📑) 버튼 분리
            const linkCount = (j.linkedItems || []).length;
            const linkBadgeHtml = linkCount > 0 
                ? `<button onclick="window.LinkManager.openViewer('${this.lockedDateStr || this.dateStr}', '${j.id}', '${fId}', 'journal')" style="background:#fef08a; color:#854d0e; font-size:0.75rem; padding:2px 6px; border-radius:4px; margin-left:4px; font-weight:bold; border:1px solid #fde047; cursor:pointer;" title="연결된 내용 보기 및 수정">📑 ${linkCount}</button>` 
                : '';
            const linkBtnHtml = isAuthor
                ? `<div style="display:flex; align-items:center; margin-right:8px;"><button onclick="window.LinkManager.openModal('journal', '${this.lockedDateStr || this.dateStr}', '${j.id}', '${fId}')" style="background:#fff; border:1px solid #fbcfe8; color:#be185d; font-size:0.75rem; cursor:pointer; padding:2px 6px; border-radius:4px; line-height:1;" title="새 링크 연결">🔗 연결</button>${linkBadgeHtml}</div>`
                : (linkCount > 0 ? `<div style="margin-right:8px;">${linkBadgeHtml}</div>` : '');

            const authorBadge = (fId !== 'personal' && j.authorId)
                ? `<span style="font-size:0.7rem; background:#e2e8f0; color:#475569; padding:2px 6px; border-radius:4px; margin-right:8px;" title="작성자">👤 ${j.authorName || j.authorId.substring(0, 6)}</span>`
                : '';

            const rId = Math.random().toString(36).substr(2,9);
            const toggleId = j.id ? 'journal-edit-extras-' + j.id : 'journal-edit-extras-' + rId;
            const textId = j.id ? 'journal-edit-text-' + j.id : 'journal-edit-text-' + rId;
            const toggleBtnHtml = `<button onclick="const xt = document.getElementById('${toggleId}'); const tx = document.getElementById('${textId}'); const isC = xt.style.display === 'none'; if(isC){ xt.style.display='flex'; tx.style.display='block'; tx.style.whiteSpace='pre-wrap'; tx.style.overflow='visible'; tx.style.textOverflow='clip'; this.innerText='▼'; }else{ xt.style.display='none'; tx.style.display='block'; tx.style.whiteSpace='nowrap'; tx.style.overflow='hidden'; tx.style.textOverflow='ellipsis'; this.innerText='▶'; }" style="background:none; border:none; cursor:pointer; font-size:0.75rem; color:#be185d; padding:0 4px; margin-right:8px; outline:none;" title="접기/펼치기">▼</button>`;

            return `
            <div id="journal-card-${fId}-${idx}" data-journal-idx="${idx}"
                 ondragstart="window.dayViewInstance.handleJournalDragStart(event, ${idx}, '${fId}')"
                 ondragend="window.dayViewInstance.handleJournalDragEnd(event, '${fId}')"
                 ondragenter="event.preventDefault(); this.style.backgroundColor='#fce7f3';"
                 ondragover="event.preventDefault(); event.dataTransfer.dropEffect='move';"
                 ondragleave="this.style.backgroundColor='';"
                 ondrop="event.preventDefault(); this.style.backgroundColor=''; window.dayViewInstance.handleJournalDrop(event, ${idx}, '${fId}');"
                 style="display:flex; flex-direction:column; gap:8px; margin-bottom:12px; padding:10px; background:#fdf2f8; border:1px solid #fbcfe8; border-radius:6px; position:relative; transition: background-color 0.2s, opacity 0.2s;">
                <div style="position:absolute; top:8px; right:8px; display:flex; align-items:center;">
                    ${linkBtnHtml} 
                    ${authorBadge}
                    <button class="modal-delete-btn" onclick="window.dayViewInstance.removeJournalEntry('${fId}',${idx})" title="기록 삭제" style="margin:0; color:#be185d;">✖</button>
                </div>
                <div class="label-chip-container" style="margin:0; padding-right:24px; display:flex; flex-wrap:wrap; gap:4px; align-items:center;">
                    ${toggleBtnHtml}
                    ${chipsHtml}
                </div>
                <div style="display:flex; align-items:flex-start; gap:8px; width:100%;">
                    <div class="journal-drag-handle" 
                         onmouseenter="document.getElementById('journal-card-${fId}-${idx}').setAttribute('draggable', 'true')"
                         onmouseleave="document.getElementById('journal-card-${fId}-${idx}').removeAttribute('draggable')"
                         onmousedown="document.getElementById('journal-card-${fId}-${idx}').setAttribute('draggable', 'true')"
                         style="cursor:grab; padding:6px 4px; color:#be185d; font-size:1.3rem; line-height:1; user-select:none; display:flex; align-items:center; flex-shrink:0;"
                         title="이곳을 드래그하여 기록 순서 변경">
                        ≡
                    </div>
                    <div id="${toggleId}" style="display:flex; flex-direction:column; flex:1; min-width:0; gap:8px;">
                        <div style="display:flex; align-items:flex-start; width:100%; gap:8px;">
                            <textarea id="${textId}" class="modal-input-text" placeholder="학급 기록, 상담, 업무 일지 등을 입력하세요..." style="flex:1; min-height:40px; resize:none; overflow:hidden; font-size:0.95rem; padding:8px; box-sizing:border-box; outline:none; border:1px solid #fbcfe8; border-radius:4px;" onfocus="window.dayViewInstance.autoResize(this)" oninput="window.dayViewInstance.autoResize(this); window.dayViewInstance.updateJournalContent('${fId}', ${idx}, this.value)">${j.content || ''}</textarea>
                            
                            <button onclick="document.getElementById('${uploadId}').click()" style="background:#fce7f3; color:#be185d; border:1px solid #fbcfe8; padding:0; border-radius:4px; cursor:pointer; font-size:1.2rem; width:40px; height:40px; display:flex; align-items:center; justify-content:center; flex-shrink:0; box-shadow:0 1px 2px rgba(0,0,0,0.05); transition:0.2s;" onmouseover="this.style.background='#fbcfe8'" onmouseout="this.style.background='#fce7f3'" title="구글 드라이브 문서/파일 첨부">📎</button>
                            <input type="file" id="${uploadId}" multiple style="display:none;" onchange="window.dayViewInstance.handleJournalAttachmentUpload('${fId}',${idx}, this)">
                        </div>
                        ${isUploading}${attachmentsHtml}
                    </div>
                </div>
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

        // 새로 추가된 최하단 항목으로 포커스 및 스크롤 이동
        setTimeout(() => {
            const container = document.getElementById(`event-entries-container-${fId}`);
            if (container) {
                const textareas = container.querySelectorAll('textarea');
                if (textareas.length > 0) {
                    const lastTa = textareas[textareas.length - 1];
                    lastTa.focus();
                    lastTa.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
        }, 50);
    }

    removeEventEntry(fId, index) {
        this.syncEventInputs(fId);
        const item = this.dayData[fId].events[index];
        if (item) window.TrashManager.moveToTrash('event', fId, this.lockedDateStr || this.dateStr, item);
        
        this.dayData[fId].events.splice(index, 1);
        this.renderEventEntries(fId);
        store.hasUnsavedChanges = true;
        if (window.showToast) window.showToast('일정이 삭제되었습니다. (상단 휴지통에서 복구 가능)');
    }

    addJournalEntry(fId) {
        this.syncJournalInputs(fId);
        const masterJournalLabels = getJournalLabels();
        const defaultJrLabelId = masterJournalLabels.length > 0 ? masterJournalLabels[0].id : null;
        this.dayData[fId].journals.push({ 
            id: 'jr_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5),
            labelIds: defaultJrLabelId ? [defaultJrLabelId] : [], 
            content: '', 
            attachments: [] 
        });
        this.renderJournalEntries(fId);
        store.hasUnsavedChanges = true;

        // 새로 추가된 최하단 항목으로 포커스 및 스크롤 이동
        setTimeout(() => {
            const container = document.getElementById(`journal-entries-container-${fId}`);
            if (container) {
                const textareas = container.querySelectorAll('textarea');
                if (textareas.length > 0) {
                    const lastTa = textareas[textareas.length - 1];
                    lastTa.focus();
                    lastTa.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
        }, 50);
    }

    removeJournalEntry(fId, index) {
        this.syncJournalInputs(fId);
        const j = this.dayData[fId].journals[index];
        if (j) window.TrashManager.moveToTrash('journal', fId, this.lockedDateStr || this.dateStr, j);
        
        // 첨부파일 삭제 로직은 복구를 위해 주석처리 하거나 여기서 유지하되, 드라이브 파일은 유지하는게 나을 수 있음
        // 만약 즉시 지워야한다면 아래 로직 유지, 복구하려면 아래 로직 주석처리
        /*
        if (j && j.attachments && j.attachments.length > 0) {
            j.attachments.forEach(a => {
                if (a && a.id) driveAPI.deleteFile(a.id).catch(e => console.warn(e));
            });
        }
        */
        
        this.dayData[fId].journals.splice(index, 1);
        this.renderJournalEntries(fId);
        store.hasUnsavedChanges = true;
        if (window.showToast) window.showToast('기록이 삭제되었습니다. (상단 휴지통에서 복구 가능)');
    }

    syncEventInputs(fId) {
        if (store.mode !== 'editor') return;
        const container = document.getElementById(`event-entries-container-${fId}`);
        if(container) {
            container.querySelectorAll('textarea').forEach((ta, idx) => {
                if (this.dayData[fId].events[idx]) this.dayData[fId].events[idx].content = ta.value; 
            });
        }
    }

    syncJournalInputs(fId) {
        if (store.mode !== 'editor') return;
        const container = document.getElementById(`journal-entries-container-${fId}`);
        if(container) {
            container.querySelectorAll('textarea').forEach((ta, idx) => {
                if (this.dayData[fId].journals[idx]) this.dayData[fId].journals[idx].content = ta.value; 
            });
        }
    }

    syncScheduleInputs(fId) {
        if (store.mode !== 'editor') return;
        const tbody = document.getElementById(`schedule-tbody-${fId}`);
        if (!tbody) return;

        const wrapper = tbody.closest('.day-schedule-wrapper');
        const wasHidden = wrapper && window.getComputedStyle(wrapper).display === 'none';
        if (wasHidden) wrapper.style.display = 'flex';

        this.dayData[fId].schedules = this.dayData[fId].schedules || {};
        
        tbody.querySelectorAll('tr[data-period]').forEach(row => {
            const p = row.getAttribute('data-period');
            const subEl = row.querySelector('.cell-subject');
            const memoEl = row.querySelector('.cell-memo');
            const supEl = row.querySelector('.cell-supplies');
            if (!subEl && !memoEl && !supEl) return;

            const subject = subEl ? subEl.innerText.trim() : '';
            const memo = memoEl ? memoEl.innerText.trim() : '';
            const supplies = supEl ? supEl.innerText.trim() : '';
            
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
        if (store.mode !== 'editor') return; 
        
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
                            const originalMap = new Map(originalEvents.map(e => [e.id, e]));
                            
                            // 🌟 작성 페이지에서 사용자가 지정한 pEvents 순서를 100% 최우선 유지
                            const mergedEvents = [];
                            const seenIds = new Set();
                            
                            pEvents.forEach(le => {
                                mergedEvents.push(le);
                                seenIds.add(le.id);
                            });
                            
                            // 다른 사용자가 원격에 새로 추가한 일정만 뒤에 병합
                            remoteEvents.forEach(re => {
                                if (!seenIds.has(re.id) && !originalMap.has(re.id)) {
                                    mergedEvents.push(re);
                                    seenIds.add(re.id);
                                }
                            });
                            
                            finalEvents = mergedEvents;
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
                            
                            // 🌟 작성 페이지에서 사용자가 지정한 pJournals 순서를 100% 최우선 유지
                            const mergedJournals = [];
                            const seenJournalIds = new Set();
                            
                            pJournals.forEach(lj => {
                                mergedJournals.push(lj);
                                seenJournalIds.add(lj.id);
                            });
                            
                            // 다른 사용자가 원격에 새로 추가한 기록만 뒤에 병합
                            remoteJournals.forEach(rj => {
                                if (!seenJournalIds.has(rj.id) && !originalMap.has(rj.id)) {
                                    mergedJournals.push(rj);
                                    seenJournalIds.add(rj.id);
                                }
                            });
                            
                            finalJournals = mergedJournals;
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