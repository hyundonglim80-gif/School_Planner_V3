// js/viewDay.js

import { BaseView } from './components/BaseView.js';
import { store } from './core/store.js';
import { getEventLabels, getJournalLabels, getLabelStyle } from './core/utils.js';
import { dbAPI, getUserCol } from './firebase.js';

export class DayView extends BaseView {
    constructor(container) {
        super(container);
        this.currentEvents = [];
        this.currentJournals = [];
        this.currentSchedules = {};
    }

    parseEvents(docData) {
        if (!docData) return [];
        if (docData.eventList && docData.eventList.length > 0) return docData.eventList;
        // parseRawEventTextToEventList는 events.js(아직 미작업)에 있으므로 window 유지
        if (docData.eventText && docData.eventText.trim() !== '') return window.parseRawEventTextToEventList(docData.eventText);
        return [];
    }

    renderLabelChips(containerElement, allLabelsObj, selectedLabelIdsArray, onChangeCallback, onSpecialLabelRequest) {
        if (!containerElement) return;
        containerElement.innerHTML = '';
        containerElement.style.margin = "0";

        allLabelsObj.forEach(labelObj => {
            const labelId = labelObj.id;
            const labelText = labelObj.name;
            const isPeriod = labelObj.isPeriod;
            const isRecur = labelObj.isRecur;
            const isForward = labelObj.isForward;

            const chip = document.createElement('div');
            chip.className = 'label-chip';
            chip.innerText = labelText;
            
            if (selectedLabelIdsArray.includes(labelId)) {
                chip.classList.add('active');
            }
            
            chip.addEventListener('click', () => {
                if (window.dayViewInstance && typeof window.dayViewInstance.syncEventInputs === 'function') window.dayViewInstance.syncEventInputs();
                if (window.dayViewInstance && typeof window.dayViewInstance.syncJournalInputs === 'function') window.dayViewInstance.syncJournalInputs();

                const isActive = selectedLabelIdsArray.includes(labelId);
                
                if (isActive) {
                    selectedLabelIdsArray = selectedLabelIdsArray.filter(id => id !== labelId);
                } else {
                    if (isPeriod || isRecur) {
                        if (onSpecialLabelRequest) {
                            onSpecialLabelRequest(labelText, isPeriod ? 'period' : 'recur', labelId);
                        }
                        return;
                    }
                    if (isForward) {
                        selectedLabelIdsArray = selectedLabelIdsArray.filter(id => {
                            const lObj = allLabelsObj.find(x => x.id === id);
                            return !(lObj && (lObj.isPeriod || lObj.isRecur));
                        });
                    }
                    selectedLabelIdsArray.push(labelId);
                }
                
                if (onChangeCallback) onChangeCallback(selectedLabelIdsArray);
            });
            containerElement.appendChild(chip);
        });
    }

    async renderViewer() {
        this.showLoading('클라우드 데이터를 불러오는 중...');

        const dateStr = this.dateStr;
        const dayData = await dbAPI.loadDayData(dateStr);
        const periods = dayData.periods || {};
        
        const eventDoc = await getUserCol('events').doc(dateStr).get();
        const events = eventDoc.exists ? this.parseEvents(eventDoc.data()) : [];
        
        const journalDoc = await getUserCol('journals').doc(dateStr).get();
        const journals = journalDoc.exists ? journalDoc.data().entries || [] : [];

        let html = `<div class="day-viewer-container">`;
        
        html += `
          <div class="day-event-section" style="background: #fff; padding: 15px; border-radius: 8px; border: 1px solid #cbd5e1; box-shadow: 0 1px 3px rgba(0,0,0,0.05); border-left: 5px solid #2563eb;">
            <h3 style="font-size:1.2rem; color:#1e40af; margin-top:0; margin-bottom:10px; font-weight:bold;">📌 오늘 할 일</h3>
            ${window.generateEventBadgesHTML(events, dateStr, 'normal') || '<p style="color:#94a3b8; font-size:0.95rem; margin:0;">등록된 일정이 없습니다.</p>'}
          </div>
        `;

        html += `
            <div class="table-container" style="margin-top:10px; ${store.showClass ? '' : 'display:none;'}">
              <table style="text-align: center;">
                <thead>
                  <tr>
                    <th style="width: 60px;">교시</th>
                    <th style="width: 120px;">수업</th>
                    <th>📝 수업 메모</th>
                    <th style="width: 25%;">📌 비고</th>
                  </tr>
                </thead>
                <tbody>
        `;
        for (let p = 1; p <= this.maxPeriod; p++) {
            const pObj = periods[p] || {};
            const periodName = store.periodNames[p - 1] || p + '교시';
            html += `
                  <tr>
                    <td style="font-weight:900; color:#475569; background:#f8fafc;">${periodName}</td>
                    <td style="font-weight:bold; color:#0f172a;">${pObj.subject || ''}</td>
                    <td style="text-align: left; color:#334155; white-space:pre-wrap;">${pObj.memo || ''}</td>
                    <td style="color: #d97706; font-weight: 600; text-align: left; white-space:pre-wrap;">${pObj.supplies || ''}</td>
                  </tr>
            `;
        }
        html += `</tbody></table></div>`;

        html += `
          <div class="day-journal-section" style="margin-top: 15px; background: #fff; padding: 15px; border-radius: 8px; border: 1px solid #cbd5e1; box-shadow: 0 1px 3px rgba(0,0,0,0.05); border-left: 5px solid #be185d;">
            <h3 style="font-size:1.2rem; color:#be185d; margin-top:0; margin-bottom:10px; font-weight:bold;">📔 오늘 기록</h3>
        `;
        if (journals.length > 0) {
            html += `<div style="display:flex; flex-direction:column; gap:8px;">`;
            journals.forEach(j => {
                const lNames = [];
                if (j.labelIds && j.labelIds.length > 0) {
                    const masterJournals = getJournalLabels();
                    j.labelIds.forEach(id => {
                        const match = masterJournals.find(l => l.id === id);
                        if (match) lNames.push(match.name);
                    });
                } else if (j.labels && j.labels.length > 0) {
                    lNames.push(...j.labels);
                } else if (j.label) {
                    lNames.push(j.label);
                }

                const lStr = lNames.join(', ');
                const mainLabel = lNames.length > 0 ? lNames[0] : '기타';
                const style = getLabelStyle(mainLabel, 'journal') || { bg: '#fdf2f8', text: '#9d174d', border: '#fbcfe8' };

                html += `<div style="display:flex; flex-direction:column; background:${style.bg}; padding:10px; border-radius:6px; border:1px dashed ${style.border};">`;
                if (lStr && lStr !== '기타') {
                    html += `<div style="font-weight:bold; color:${style.text}; margin-bottom:4px; font-size:0.9rem;">[${lStr}]</div>`;
                }
                html += `<div style="font-size:1rem; color:#1e293b; white-space:pre-wrap; line-height:1.4;">${j.content || ''}</div>`;
                html += `</div>`;
            });
            html += `</div>`;
        } else {
            html += `<p style="color:#94a3b8; font-size:0.95rem; margin:0;">등록된 기록이 없습니다.</p>`;
        }
        html += `</div></div>`;

        this.container.innerHTML = html;
    }

    async renderEditor() {
        this.showLoading('편집 화면을 준비 중...');

        const dateStr = this.dateStr;
        const dayData = await dbAPI.loadDayData(dateStr);
        const periods = dayData.periods || {};
        this.currentSchedules = periods;
        
        const eventDoc = await getUserCol('events').doc(dateStr).get();
        const events = eventDoc.exists ? this.parseEvents(eventDoc.data()) : [];
        
        const masterLabels = getEventLabels();
        this.currentEvents = events.map(e => {
            let labelIds = e.labelIds || [];
            if (labelIds.length === 0 && (e.labels || e.label)) {
                let legacyNames = e.labels || [e.label];
                legacyNames.forEach(name => {
                    const match = masterLabels.find(l => l.name === name);
                    if (match && match.id && !labelIds.includes(match.id)) labelIds.push(match.id);
                });
            }
            return { ...e, labelIds: labelIds };
        });
        if (this.currentEvents.length === 0) this.currentEvents.push({ labelIds: [], content: '', completed: false });
        
        const journalDoc = await getUserCol('journals').doc(dateStr).get();
        const journals = journalDoc.exists ? journalDoc.data().entries || [] : [];
        
        this.currentJournals = journals.map(j => ({ ...j, labelIds: j.labelIds || [] }));
        if (this.currentJournals.length === 0) this.currentJournals.push({ labelIds: [], content: '' });

        let html = `<div class="day-viewer-container">`;

        html += `
          <div class="day-event-editor-section" style="background: #fff; padding: 15px; border-radius: 8px; border: 1px solid #cbd5e1; box-shadow: 0 1px 3px rgba(0,0,0,0.05); border-left: 5px solid #2563eb;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 15px; width: 100%; box-sizing: border-box;">
              <h3 style="font-size:1.2rem; color:#1e40af; margin:0; font-weight:bold;">📌 오늘 할 일</h3>
              <button onclick="window.openEventLabelModal()" style="background:#f8fafc; border:1px solid #cbd5e1; padding:4px 10px; border-radius:6px; cursor:pointer; font-size:0.85rem; font-weight:bold;">⚙️ 설정</button>
            </div>
            <div id="event-entries-container" style="width: 100%;"></div>
            <button onclick="window.dayViewInstance.addEventEntry()" style="width:100%; padding:10px; margin-top:5px; background:#eff6ff; color:#2563eb; border:2px dashed #bfdbfe; border-radius:8px; cursor:pointer; font-weight:bold; font-size:1rem; transition:0.2s;">+ 일정 추가</button>
          </div>
        `;

        html += `
            <div class="table-container" style="margin-top:10px; ${store.showClass ? '' : 'display:none;'}">
              <table style="text-align: center;">
                <thead>
                  <tr>
                    <th style="width: 60px;">교시</th>
                    <th style="width: 120px;">수업</th>
                    <th>📝 수업 메모</th>
                    <th style="width: 25%;">📌 비고</th>
                  </tr>
                </thead>
                <tbody>
        `;
        for (let p = 1; p <= this.maxPeriod; p++) {
          const pObj = periods[p] || {};
          const periodName = store.periodNames[p - 1] || p + '교시';
          html += `
                  <tr data-period="${p}">
                    <td class="period-cell" onclick="window.dayViewInstance.openClassSwapModal(${p})" style="cursor:pointer; color:#2563eb; text-decoration:underline; font-weight:900; font-size:0.9rem;" title="클릭하여 교환">${periodName}</td>
                    <td class="editable-cell cell-subject" contenteditable="true" oninput="window.dayViewInstance.syncScheduleInputs()">${pObj.subject || ''}</td>
                    <td class="editable-cell cell-memo" contenteditable="true" style="text-align: left;" oninput="window.dayViewInstance.syncScheduleInputs()">${pObj.memo || ''}</td>
                    <td class="editable-cell cell-supplies" contenteditable="true" style="color: #d97706; font-weight: 600; text-align: left;" oninput="window.dayViewInstance.syncScheduleInputs()">${pObj.supplies || ''}</td>
                  </tr>
          `;
        }
        html += `</tbody></table></div>`;

        html += `
          <div class="day-journal-editor-section" style="margin-top: 15px; background: #fff; padding: 15px; border-radius: 8px; border: 1px solid #cbd5e1; box-shadow: 0 1px 3px rgba(0,0,0,0.05); border-left: 5px solid #be185d;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 15px; width: 100%; box-sizing: border-box;">
              <h3 style="font-size:1.2rem; color:#be185d; margin:0; font-weight:bold;">📔 오늘 기록</h3>
              <button onclick="window.openJournalLabelModal()" style="background:#fdf2f8; border:1px solid #fbcfe8; padding:4px 10px; border-radius:6px; cursor:pointer; font-size:0.85rem; font-weight:bold; color:#be185d;">⚙️ 설정</button>
            </div>
            <div id="journal-entries-container" style="width: 100%;"></div>
            <button onclick="window.dayViewInstance.addJournalEntry()" style="width:100%; padding:10px; margin-top:5px; background:#fdf2f8; color:#be185d; border:2px dashed #f472b6; border-radius:8px; cursor:pointer; font-weight:bold; font-size:1rem; transition:0.2s;">+ 기록 추가</button>
          </div>
        </div>`;
        
        this.container.innerHTML = html;
        
        setTimeout(() => {
          this.renderEventEntries();
          this.renderJournalEntries();
        }, 0);
    }

    renderEventEntries() {
        const container = document.getElementById('event-entries-container');
        if(!container) return;
        container.innerHTML = '';
        
        const allLabelsObj = getEventLabels();

        this.currentEvents.forEach((ev, idx) => {
            const row = document.createElement('div');
            row.style.cssText = "display:flex; flex-direction:column; gap:8px; margin-bottom:12px; padding:10px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; position:relative;";
            
            if (ev.groupId || (ev.forwardChainId && ev.originalDate && ev.originalDate !== this.dateStr)) {
                let badgeTxt = ev.groupId ? '🔗 반복/기간 그룹 일정' : '↪️ 과거에서 이월된 일정';
                let badgeColor = ev.groupId ? '#2563eb' : '#059669';
                let badgeBg = ev.groupId ? '#dbeafe' : '#dcfce3';
                let delHandler = ev.groupId 
                    ? `window.showGroupDeleteModal('${this.dateStr}', '${ev.labelIds[0]}', \`${(ev.content || '').replace(/`/g, '\\`')}\`, '${ev.groupId}', () => { window.dayViewInstance.currentEvents.splice(${idx}, 1); window.dayViewInstance.renderEventEntries(); store.hasUnsavedChanges = true; }, () => { window.dayViewInstance.currentEvents.splice(${idx}, 1); window.dayViewInstance.renderEventEntries(); store.hasUnsavedChanges = true; })`
                    : `window.showForwardDeleteModal('${this.dateStr}', '${ev.labelIds[0]}', \`${(ev.content || '').replace(/`/g, '\\`')}\`, '${ev.forwardChainId}', () => { window.dayViewInstance.currentEvents.splice(${idx}, 1); window.dayViewInstance.renderEventEntries(); store.hasUnsavedChanges = true; })`;
                
                row.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div style="font-size:0.75rem; font-weight:bold; color:${badgeColor}; background:${badgeBg}; padding:2px 6px; border-radius:4px;">${badgeTxt}</div>
                        <button class="modal-delete-btn" onclick="${delHandler}" title="일정 삭제" style="margin:0;">✖</button>
                    </div>
                `;
            } else {
                row.innerHTML = `
                    <div style="position:absolute; top:8px; right:8px;">
                        <button class="modal-delete-btn" onclick="window.dayViewInstance.removeEventEntry(${idx})" title="일정 삭제" style="margin:0;">✖</button>
                    </div>
                `;
            }

            const chipContainer = document.createElement('div');
            chipContainer.className = 'label-chip-container';
            chipContainer.style.margin = '0';
            chipContainer.style.paddingRight = '24px';
            
            this.renderLabelChips(chipContainer, allLabelsObj, ev.labelIds || [], (newIds) => {
                this.currentEvents[idx].labelIds = newIds;
                store.hasUnsavedChanges = true;
                this.renderEventEntries();
            }, (labelName, mode, labelId) => {
                if (mode === 'period') {
                    window.openPeriodModal(this.dateStr, labelName, this.currentEvents[idx].content || '', (success) => {
                        if (success) { this.currentEvents.splice(idx, 1); this.renderEventEntries(); }
                    }, labelId);
                } else if (mode === 'recur') {
                    window.openRecurringModal(this.dateStr, labelName, this.currentEvents[idx].content || '', (success) => {
                        if (success) { this.currentEvents.splice(idx, 1); this.renderEventEntries(); }
                    }, labelId);
                }
            });
            row.appendChild(chipContainer);

            const input = document.createElement('textarea');
            input.className = 'modal-input-text';
            input.style.cssText = "width:100%; min-height:40px; resize:vertical; font-size:0.95rem; padding:8px; box-sizing:border-box;";
            input.placeholder = "일정 내용 입력...";
            input.value = ev.content || '';
            input.oninput = () => { store.hasUnsavedChanges = true; };
            row.appendChild(input);

            container.appendChild(row);
        });
    }

    addEventEntry() {
        this.syncEventInputs();
        this.currentEvents.push({ labelIds: [], content: '', completed: false });
        this.renderEventEntries();
        store.hasUnsavedChanges = true;
    }

    removeEventEntry(index) {
        this.syncEventInputs();
        this.currentEvents.splice(index, 1);
        this.renderEventEntries();
        store.hasUnsavedChanges = true;
    }

    syncEventInputs() {
        const container = document.getElementById('event-entries-container');
        if(!container) return;
        const textareas = container.querySelectorAll('textarea');
        textareas.forEach((ta, idx) => {
            if (this.currentEvents[idx]) {
                this.currentEvents[idx].content = ta.value; 
            }
        });
    }

    renderJournalEntries() {
        const container = document.getElementById('journal-entries-container');
        if(!container) return;
        container.innerHTML = '';
        
        const allLabelsObj = getJournalLabels();

        this.currentJournals.forEach((j, idx) => {
            const row = document.createElement('div');
            row.style.cssText = "display:flex; flex-direction:column; gap:8px; margin-bottom:12px; padding:10px; background:#fdf2f8; border:1px solid #fbcfe8; border-radius:6px; position:relative;";
            
            row.innerHTML = `
                <div style="position:absolute; top:8px; right:8px;">
                    <button class="modal-delete-btn" onclick="window.dayViewInstance.removeJournalEntry(${idx})" title="기록 삭제" style="margin:0; color:#be185d;">✖</button>
                </div>
            `;

            const chipContainer = document.createElement('div');
            chipContainer.className = 'label-chip-container';
            chipContainer.style.margin = '0';
            chipContainer.style.paddingRight = '24px';
            
            this.renderLabelChips(chipContainer, allLabelsObj, j.labelIds || [], (newIds) => {
                this.currentJournals[idx].labelIds = newIds;
                store.hasUnsavedChanges = true;
                this.renderJournalEntries();
            }, null);
            row.appendChild(chipContainer);

            const input = document.createElement('textarea');
            input.className = 'modal-input-text';
            input.style.cssText = "width:100%; min-height:60px; resize:vertical; font-size:0.95rem; padding:8px; box-sizing:border-box;";
            input.placeholder = "학급 기록, 상담, 업무 일지 등을 입력하세요...";
            input.value = j.content || '';
            input.oninput = () => { store.hasUnsavedChanges = true; };
            row.appendChild(input);

            container.appendChild(row);
        });
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

    syncJournalInputs() {
        const container = document.getElementById('journal-entries-container');
        if(!container) return;
        const textareas = container.querySelectorAll('textarea');
        textareas.forEach((ta, idx) => {
            if (this.currentJournals[idx]) {
                this.currentJournals[idx].content = ta.value; 
            }
        });
    }

    syncScheduleInputs() {
        const tbody = this.container.querySelector('tbody');
        if (!tbody) return;
        
        const rows = tbody.querySelectorAll('tr[data-period]');
        if (rows.length === 0) return;
        
        this.currentSchedules = {};
        rows.forEach(row => {
            const p = row.getAttribute('data-period');
            const subject = row.querySelector('.cell-subject').innerText.trim();
            const memo = row.querySelector('.cell-memo').innerText.trim();
            const supplies = row.querySelector('.cell-supplies').innerText.trim();
            
            if (subject || memo || supplies) {
                this.currentSchedules[p] = { subject, memo, supplies };
            }
        });
        store.hasUnsavedChanges = true;
    }

    openClassSwapModal(period) {
        if (this.currentMode !== 'editor') return;
        const max = this.maxPeriod;
        let optionsHtml = '';
        for(let i=1; i<=max; i++) {
            if (i !== period) {
                const pName = store.periodNames[i-1] || `${i}교시`;
                const sub = (this.currentSchedules[i] && this.currentSchedules[i].subject) ? ` (${this.currentSchedules[i].subject})` : ' (빈 시간)';
                optionsHtml += `<option value="${i}">${pName}${sub}</option>`;
            }
        }
        
        const targetName = store.periodNames[period-1] || `${period}교시`;
        const modalHtml = `
        <div id="swap-modal" class="modal-overlay" style="display:flex; z-index:10005; justify-content:center; align-items:center;">
            <div class="modal-content" style="width:300px; padding:20px; border-radius:12px; text-align:center;">
                <h3 style="color:#2563eb; margin-top:0;">🔄 수업 맞바꾸기</h3>
                <p style="font-size:0.95rem; color:#475569; margin-bottom:15px;"><b>${targetName}</b> 수업을 몇 교시와 바꾸시겠습니까?</p>
                <select id="swap-target-select" style="width:100%; padding:10px; border-radius:6px; border:1px solid #cbd5e1; margin-bottom:20px; font-size:1rem;">
                    ${optionsHtml}
                </select>
                <div style="display:flex; gap:10px; justify-content:center;">
                    <button onclick="document.getElementById('swap-modal').remove()" style="padding:8px 16px; border:none; background:#f1f5f9; font-weight:bold; border-radius:6px; cursor:pointer;">취소</button>
                    <button onclick="window.dayViewInstance.executeClassSwap(${period}, parseInt(document.getElementById('swap-target-select').value))" style="padding:8px 16px; border:none; background:#2563eb; color:white; font-weight:bold; border-radius:6px; cursor:pointer;">바꾸기</button>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    executeClassSwap(p1, p2) {
        this.syncScheduleInputs();
        
        const temp = this.currentSchedules[p1] ? { ...this.currentSchedules[p1] } : null;
        if (this.currentSchedules[p2]) {
            this.currentSchedules[p1] = { ...this.currentSchedules[p2] };
        } else {
            delete this.currentSchedules[p1];
        }
        
        if (temp) {
            this.currentSchedules[p2] = temp;
        } else {
            delete this.currentSchedules[p2];
        }
        
        document.getElementById('swap-modal').remove();
        store.hasUnsavedChanges = true;
        this.renderEditor();
    }

    async save() {
        const dateStr = this.dateStr;
        
        this.syncEventInputs();
        this.syncJournalInputs();
        this.syncScheduleInputs();
        
        const validEvents = this.currentEvents.filter(e => (e.content || '').trim() !== '' || (e.labelIds && e.labelIds.length > 0));
        const eventText = window.formatEventListToText ? window.formatEventListToText(validEvents) : '';
        
        await getUserCol('events').doc(dateStr).set({ 
            eventList: validEvents,
            eventText: eventText,
            updatedAt: Date.now() 
        }, { merge: true });

        const validJournals = this.currentJournals.filter(j => (j.content || '').trim() !== '' || (j.labelIds && j.labelIds.length > 0));
        await getUserCol('journals').doc(dateStr).set({ 
            entries: validJournals, 
            updatedAt: Date.now() 
        }, { merge: true });

        await getUserCol('schedules').doc(dateStr).set({ 
            periods: this.currentSchedules, 
            updatedAt: Date.now() 
        }, { merge: true });

        window[`tempEvents_${dateStr}`] = validEvents;
        window[`tempSchedules_${dateStr}`] = this.currentSchedules;
    }
}

// ==========================================================================
// 🌉 과도기 호환성 레이어 
// ==========================================================================
window.dayViewInstance = new DayView(document.getElementById("main-view")); 
window.renderDayViewer = (container) => { 
    window.dayViewInstance.container = container;
    window.dayViewInstance.renderViewer(); 
}; 
window.renderDayEditor = (container) => { 
    window.dayViewInstance.container = container;
    window.dayViewInstance.renderEditor(); 
}; 
window.saveDayDataFromEditor = () => window.dayViewInstance.save();
