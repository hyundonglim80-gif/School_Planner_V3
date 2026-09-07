// js/modules/detailEditManager.js
import { dbAPI, getUserCol, getGroupCol } from '../api/database.js';
import { store } from '../core/store.js';
import { formatDate, getEventLabels, getJournalLabels } from '../core/utils.js';
import { doc, getDoc, setDoc } from "firebase/firestore";

export const DetailEditManager = {
    modal: null,
    currentData: null,

    open: async function(type, dateStr, itemId, fId = 'personal') {
        this.currentData = { type, dateStr, itemId, fId };

        let title = '상세 정보 및 수정';
        if (type === 'event') title = `📌 일정 상세 및 수정 [${dateStr}]`;
        else if (type === 'schedule') title = `🏫 ${itemId}교시 수업 상세 및 수정 [${dateStr}]`;
        else if (type === 'journal') title = `📔 오늘 기록 상세 및 수정 [${dateStr}]`;

        if (this.modal) {
            this.modal.close();
            this.modal = null;
        }

        this.modal = new window.Modal({
            id: 'detail-edit-modal',
            title: title,
            width: '460px',
            content: `<div id="detail-edit-modal-body" style="padding:20px; text-align:center; color:#3b82f6; font-weight:bold;">데이터를 불러오는 중...⏳</div>`
        });

        this.modal.open();
        await this.loadAndRender();
    },

    loadAndRender: async function() {
        const { type, dateStr, itemId, fId } = this.currentData;
        const colFunc = fId === 'personal' ? getUserCol : (col) => getGroupCol(fId, col);
        const container = document.getElementById('detail-edit-modal-body');
        if (!container) return;

        try {
            if (type === 'event') {
                let eventItem = null;
                // 메모리 우선 검색
                if (window.dayViewInstance?.dayData?.[fId]?.events) {
                    eventItem = window.dayViewInstance.dayData[fId].events.find(e => String(e.id) === String(itemId));
                }
                if (!eventItem && window[`tempEvents_${dateStr}`]) {
                    eventItem = window[`tempEvents_${dateStr}`].find(e => String(e.id) === String(itemId));
                }
                // DB 조회
                if (!eventItem) {
                    const snap = await getDoc(doc(colFunc('events'), dateStr));
                    if (snap.exists()) {
                        const list = snap.data().eventList || [];
                        eventItem = list.find(e => String(e.id) === String(itemId)) || list[Number(itemId)];
                    }
                }
                if (!eventItem) {
                    container.innerHTML = `<div style="padding:30px; color:#ef4444; font-weight:bold;">일정 데이터를 찾을 수 없습니다.</div>`;
                    return;
                }
                this.renderEventForm(eventItem);
            }
            else if (type === 'schedule') {
                let scheduleItem = null;
                const p = Number(itemId);
                // 메모리 우선 검색
                if (window.dayViewInstance?.dayData?.[fId]?.schedules?.[p]) {
                    scheduleItem = window.dayViewInstance.dayData[fId].schedules[p];
                }
                if (!scheduleItem && window[`tempSchedules_${dateStr}`]?.[fId]?.[p]) {
                    scheduleItem = window[`tempSchedules_${dateStr}`][fId][p];
                }
                // DB 조회
                if (!scheduleItem) {
                    const snap = await getDoc(doc(colFunc('schedules'), dateStr));
                    if (snap.exists()) {
                        scheduleItem = (snap.data().periods || {})[p] || { subject: '', memo: '', supplies: '' };
                    } else {
                        scheduleItem = { subject: '', memo: '', supplies: '' };
                    }
                }
                this.renderScheduleForm(scheduleItem);
            }
            else if (type === 'journal') {
                let journalItem = null;
                // 메모리 우선 검색
                if (window.dayViewInstance?.dayData?.[fId]?.journals) {
                    journalItem = window.dayViewInstance.dayData[fId].journals.find(j => String(j.id) === String(itemId));
                }
                // DB 조회
                if (!journalItem) {
                    const snap = await getDoc(doc(colFunc('journals'), dateStr));
                    if (snap.exists()) {
                        const list = snap.data().entries || [];
                        journalItem = list.find(j => String(j.id) === String(itemId)) || list[Number(itemId)];
                    }
                }
                if (!journalItem) {
                    container.innerHTML = `<div style="padding:30px; color:#ef4444; font-weight:bold;">기록 데이터를 찾을 수 없습니다.</div>`;
                    return;
                }
                this.renderJournalForm(journalItem);
            }
        } catch(e) {
            console.error("DetailEdit load error:", e);
            container.innerHTML = `<div style="padding:30px; color:#ef4444;">데이터 조회 중 오류가 발생했습니다.</div>`;
        }
    },

    renderEventForm: function(ev) {
        const { dateStr, itemId, fId } = this.currentData;
        const container = document.getElementById('detail-edit-modal-body');
        const masterLabels = getEventLabels();
        const selectedLabelIds = [...(ev.labelIds || [])];

        const labelChipsHtml = masterLabels.map(l => {
            const isSelected = selectedLabelIds.includes(l.id);
            const style = isSelected 
                ? 'background:#2563eb; color:#fff; border-color:#1d4ed8;' 
                : 'background:#f1f5f9; color:#475569; border-color:#cbd5e1;';
            return `<button type="button" class="detail-label-chip ${isSelected ? 'active' : ''}" data-id="${l.id}" onclick="window.DetailEditManager.toggleEventLabelChip(this)" style="padding:4px 10px; font-size:0.8rem; font-weight:bold; border-radius:15px; border:1px solid; cursor:pointer; transition:0.2s; ${style}">${l.name}</button>`;
        }).join('');

        let timeVal = '';
        if (ev.time) {
            const parts = ev.time.split('T');
            timeVal = parts[1] || '';
        }

        container.innerHTML = `
            <div style="padding:15px; display:flex; flex-direction:column; gap:16px;">
                <!-- 바로가기 액션 버튼 바 -->
                <div style="display:flex; gap:8px; padding-bottom:12px; border-bottom:1px solid #e2e8f0; flex-wrap:wrap;">
                    <button type="button" onclick="window.DetailEditManager.close(); window.LinkManager.openModal('event', '${dateStr}', '${ev.id || itemId}', '${fId}')" style="padding:6px 12px; background:#fef9c3; color:#854d0e; border:1px solid #fde047; border-radius:6px; font-size:0.85rem; font-weight:bold; cursor:pointer; display:flex; align-items:center; gap:4px;">
                        🔗 링크 관리 / 추가
                    </button>
                </div>

                <!-- 라벨 선택 -->
                <div>
                    <label style="display:block; font-size:0.85rem; font-weight:bold; color:#475569; margin-bottom:6px;">라벨 선택 (다중 선택 가능)</label>
                    <div id="detail-event-labels" style="display:flex; flex-wrap:wrap; gap:6px;">
                        ${labelChipsHtml}
                    </div>
                </div>

                <!-- 일정 내용 -->
                <div>
                    <label style="display:block; font-size:0.85rem; font-weight:bold; color:#475569; margin-bottom:6px;">일정 내용</label>
                    <textarea id="detail-edit-content" style="width:100%; min-height:80px; padding:10px; border:1px solid #cbd5e1; border-radius:8px; box-sizing:border-box; outline:none; font-size:0.95rem; resize:vertical; line-height:1.4;">${ev.content || ''}</textarea>
                </div>

                <!-- 알람 시간 -->
                <div>
                    <label style="display:block; font-size:0.85rem; font-weight:bold; color:#475569; margin-bottom:6px;">⏰ 알림 시간 (예: 1430 또는 14:30 / 비우면 off)</label>
                    <input type="text" id="detail-edit-time" value="${timeVal}" placeholder="예: 0900 (오전 9시) / 비워두면 알림 없음" maxlength="5" style="width:100%; padding:8px 12px; border:1px solid #cbd5e1; border-radius:6px; outline:none; font-size:0.95rem; box-sizing:border-box;">
                </div>

                <!-- 완료 체크 -->
                <div style="display:flex; align-items:center; gap:8px;">
                    <input type="checkbox" id="detail-edit-completed" ${ev.completed ? 'checked' : ''} style="width:18px; height:18px; accent-color:#059669; cursor:pointer;">
                    <label for="detail-edit-completed" style="font-size:0.9rem; font-weight:bold; color:#334155; cursor:pointer;">이 일정을 완료로 표시</label>
                </div>

                <!-- 하단 액션 버튼 -->
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px; padding-top:15px; border-top:1px solid #e2e8f0;">
                    <button type="button" onclick="window.DetailEditManager.deleteItem()" style="padding:8px 16px; background:#fef2f2; color:#ef4444; border:1px solid #fca5a5; border-radius:6px; font-weight:bold; font-size:0.9rem; cursor:pointer;">🗑️ 삭제</button>
                    <div style="display:flex; gap:8px;">
                        <button type="button" onclick="window.DetailEditManager.close()" style="padding:8px 16px; background:#f1f5f9; color:#475569; border:none; border-radius:6px; font-weight:bold; font-size:0.9rem; cursor:pointer;">취소</button>
                        <button type="button" onclick="window.DetailEditManager.saveEvent()" style="padding:8px 20px; background:#2563eb; color:#fff; border:none; border-radius:6px; font-weight:bold; font-size:0.9rem; cursor:pointer;">💾 저장</button>
                    </div>
                </div>
            </div>
        `;
    },

    renderScheduleForm: function(sc) {
        const { dateStr, itemId, fId } = this.currentData;
        const container = document.getElementById('detail-edit-modal-body');
        const p = Number(itemId);

        container.innerHTML = `
            <div style="padding:15px; display:flex; flex-direction:column; gap:16px;">
                <!-- 바로가기 액션 버튼 바 -->
                <div style="display:flex; gap:8px; padding-bottom:12px; border-bottom:1px solid #e2e8f0; flex-wrap:wrap;">
                    <button type="button" onclick="window.DetailEditManager.close(); window.EvaluationManager.currentGroupId = '${fId === 'personal' ? '' : fId}'; window.EvaluationManager.openCreationModal('${dateStr}', 'schedule');" style="padding:6px 12px; background:#e0f2fe; color:#0369a1; border:1px solid #7dd3fc; border-radius:6px; font-size:0.85rem; font-weight:bold; cursor:pointer; display:flex; align-items:center; gap:4px;">
                        📊 조사표 추가
                    </button>
                    <button type="button" onclick="window.DetailEditManager.close(); window.LinkManager.openModal('schedule_header', '${dateStr}', null, '${fId}', ${p});" style="padding:6px 12px; background:#fef9c3; color:#854d0e; border:1px solid #fde047; border-radius:6px; font-size:0.85rem; font-weight:bold; cursor:pointer; display:flex; align-items:center; gap:4px;">
                        🔗 링크 추가
                    </button>
                </div>

                <!-- 과목명 -->
                <div>
                    <label style="display:block; font-size:0.85rem; font-weight:bold; color:#475569; margin-bottom:6px;">과목명</label>
                    <input type="text" id="detail-edit-subject" value="${sc.subject || ''}" placeholder="예: 국어, 수학, 체육 등" style="width:100%; padding:8px 12px; border:1px solid #cbd5e1; border-radius:6px; outline:none; font-size:0.95rem; font-weight:bold; box-sizing:border-box;">
                </div>

                <!-- 수업 메모 -->
                <div>
                    <label style="display:block; font-size:0.85rem; font-weight:bold; color:#475569; margin-bottom:6px;">📝 수업 메모 / 학습 활동</label>
                    <textarea id="detail-edit-memo" style="width:100%; min-height:80px; padding:10px; border:1px solid #cbd5e1; border-radius:8px; box-sizing:border-box; outline:none; font-size:0.95rem; resize:vertical; line-height:1.4;">${sc.memo || ''}</textarea>
                </div>

                <!-- 비고 / 준비물 -->
                <div>
                    <label style="display:block; font-size:0.85rem; font-weight:bold; color:#d97706; margin-bottom:6px;">📌 비고 / 준비물</label>
                    <input type="text" id="detail-edit-supplies" value="${sc.supplies || ''}" placeholder="예: 가위, 풀, 리코더 등" style="width:100%; padding:8px 12px; border:1px solid #cbd5e1; border-radius:6px; outline:none; font-size:0.95rem; box-sizing:border-box;">
                </div>

                <!-- 하단 액션 버튼 -->
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px; padding-top:15px; border-top:1px solid #e2e8f0;">
                    <button type="button" onclick="window.DetailEditManager.clearSchedule()" style="padding:8px 16px; background:#fef2f2; color:#ef4444; border:1px solid #fca5a5; border-radius:6px; font-weight:bold; font-size:0.9rem; cursor:pointer;">내용 지우기</button>
                    <div style="display:flex; gap:8px;">
                        <button type="button" onclick="window.DetailEditManager.close()" style="padding:8px 16px; background:#f1f5f9; color:#475569; border:none; border-radius:6px; font-weight:bold; font-size:0.9rem; cursor:pointer;">취소</button>
                        <button type="button" onclick="window.DetailEditManager.saveSchedule()" style="padding:8px 20px; background:#059669; color:#fff; border:none; border-radius:6px; font-weight:bold; font-size:0.9rem; cursor:pointer;">💾 저장</button>
                    </div>
                </div>
            </div>
        `;
    },

    renderJournalForm: function(j) {
        const { dateStr, itemId, fId } = this.currentData;
        const container = document.getElementById('detail-edit-modal-body');
        const masterLabels = getJournalLabels();
        const selectedLabelIds = [...(j.labelIds || [])];

        const labelChipsHtml = masterLabels.map(l => {
            const isSelected = selectedLabelIds.includes(l.id);
            const style = isSelected 
                ? 'background:#be185d; color:#fff; border-color:#9d174d;' 
                : 'background:#fdf2f8; color:#be185d; border-color:#fbcfe8;';
            return `<button type="button" class="detail-label-chip ${isSelected ? 'active' : ''}" data-id="${l.id}" onclick="window.DetailEditManager.toggleJournalLabelChip(this)" style="padding:4px 10px; font-size:0.8rem; font-weight:bold; border-radius:15px; border:1px solid; cursor:pointer; transition:0.2s; ${style}">${l.name}</button>`;
        }).join('');

        container.innerHTML = `
            <div style="padding:15px; display:flex; flex-direction:column; gap:16px;">
                <!-- 바로가기 액션 버튼 바 -->
                <div style="display:flex; gap:8px; padding-bottom:12px; border-bottom:1px solid #e2e8f0; flex-wrap:wrap;">
                    <button type="button" onclick="window.DetailEditManager.close(); window.LinkManager.openModal('journal', '${dateStr}', '${j.id || itemId}', '${fId}')" style="padding:6px 12px; background:#fef9c3; color:#854d0e; border:1px solid #fde047; border-radius:6px; font-size:0.85rem; font-weight:bold; cursor:pointer; display:flex; align-items:center; gap:4px;">
                        🔗 링크 관리 / 추가
                    </button>
                </div>

                <!-- 라벨 선택 -->
                <div>
                    <label style="display:block; font-size:0.85rem; font-weight:bold; color:#475569; margin-bottom:6px;">라벨 선택 (다중 선택 가능)</label>
                    <div id="detail-journal-labels" style="display:flex; flex-wrap:wrap; gap:6px;">
                        ${labelChipsHtml}
                    </div>
                </div>

                <!-- 기록 내용 -->
                <div>
                    <label style="display:block; font-size:0.85rem; font-weight:bold; color:#475569; margin-bottom:6px;">기록 내용</label>
                    <textarea id="detail-edit-content" style="width:100%; min-height:100px; padding:10px; border:1px solid #cbd5e1; border-radius:8px; box-sizing:border-box; outline:none; font-size:0.95rem; resize:vertical; line-height:1.4;">${j.content || ''}</textarea>
                </div>

                <!-- 하단 액션 버튼 -->
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px; padding-top:15px; border-top:1px solid #e2e8f0;">
                    <button type="button" onclick="window.DetailEditManager.deleteItem()" style="padding:8px 16px; background:#fef2f2; color:#ef4444; border:1px solid #fca5a5; border-radius:6px; font-weight:bold; font-size:0.9rem; cursor:pointer;">🗑️ 삭제</button>
                    <div style="display:flex; gap:8px;">
                        <button type="button" onclick="window.DetailEditManager.close()" style="padding:8px 16px; background:#f1f5f9; color:#475569; border:none; border-radius:6px; font-weight:bold; font-size:0.9rem; cursor:pointer;">취소</button>
                        <button type="button" onclick="window.DetailEditManager.saveJournal()" style="padding:8px 20px; background:#be185d; color:#fff; border:none; border-radius:6px; font-weight:bold; font-size:0.9rem; cursor:pointer;">💾 저장</button>
                    </div>
                </div>
            </div>
        `;
    },

    toggleEventLabelChip: function(btn) {
        btn.classList.toggle('active');
        const isActive = btn.classList.contains('active');
        if (!isActive) {
            btn.style.background = '#f1f5f9';
            btn.style.color = '#475569';
            btn.style.borderColor = '#cbd5e1';
        } else {
            btn.style.background = '#2563eb';
            btn.style.color = '#fff';
            btn.style.borderColor = '#1d4ed8';
        }
    },

    toggleJournalLabelChip: function(btn) {
        btn.classList.toggle('active');
        const isActive = btn.classList.contains('active');
        if (!isActive) {
            btn.style.background = '#fdf2f8';
            btn.style.color = '#be185d';
            btn.style.borderColor = '#fbcfe8';
        } else {
            btn.style.background = '#be185d';
            btn.style.color = '#fff';
            btn.style.borderColor = '#9d174d';
        }
    },

    saveEvent: async function() {
        const { dateStr, itemId, fId } = this.currentData;
        const content = document.getElementById('detail-edit-content')?.value || '';
        const completed = !!document.getElementById('detail-edit-completed')?.checked;
        const tInput = document.getElementById('detail-edit-time')?.value || '';

        const selectedChips = document.querySelectorAll('#detail-event-labels .detail-label-chip.active');
        const labelIds = Array.from(selectedChips).map(c => c.dataset.id);

        let finalTime = '';
        if (tInput && tInput.trim() !== '') {
            let clean = tInput.trim().replace(/[^0-9:]/g, '');
            if (/^\d{3,4}$/.test(clean.replace(':', ''))) {
                let cleanNum = clean.replace(':', '');
                if (cleanNum.length === 3) finalTime = `${dateStr}T0${cleanNum[0]}:${cleanNum.substring(1)}`;
                else finalTime = `${dateStr}T${cleanNum.substring(0, 2)}:${cleanNum.substring(2)}`;
            } else if (clean.includes(':')) {
                finalTime = `${dateStr}T${clean}`;
            } else {
                finalTime = `${dateStr}T09:00`;
            }
        }

        try {
            const colFunc = fId === 'personal' ? getUserCol : (col) => getGroupCol(fId, col);
            const docRef = doc(colFunc('events'), dateStr);
            const snap = await getDoc(docRef);
            let list = snap.exists() ? (snap.data().eventList || []) : [];

            let item = list.find(e => String(e.id) === String(itemId));
            if (!item && list[Number(itemId)]) item = list[Number(itemId)];

            if (item) {
                item.content = content;
                item.completed = completed;
                item.labelIds = labelIds;
                item.time = finalTime;
                item.alarmTriggered = false;
            } else {
                item = {
                    id: itemId || ('ev_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5)),
                    content,
                    completed,
                    labelIds,
                    time: finalTime,
                    alarmTriggered: false,
                    sharedGroupId: fId === 'personal' ? null : fId
                };
                list.push(item);
            }

            await setDoc(docRef, { 
                eventList: list, 
                eventText: window.formatEventListToText ? window.formatEventListToText(list) : '',
                updatedAt: Date.now() 
            }, { merge: true });

            // 메모리 동기화
            if (window.dayViewInstance?.dayData?.[fId]?.events) {
                const memItem = window.dayViewInstance.dayData[fId].events.find(e => String(e.id) === String(itemId));
                if (memItem) {
                    memItem.content = content;
                    memItem.completed = completed;
                    memItem.labelIds = labelIds;
                    memItem.time = finalTime;
                    memItem.alarmTriggered = false;
                }
            }
            if (window[`tempEvents_${dateStr}`]) {
                const memItem = window[`tempEvents_${dateStr}`].find(e => String(e.id) === String(itemId));
                if (memItem) {
                    memItem.content = content;
                    memItem.completed = completed;
                    memItem.labelIds = labelIds;
                    memItem.time = finalTime;
                    memItem.alarmTriggered = false;
                }
            }

            this.close();
            if (window.showToast) window.showToast('✅ 일정이 수정되었습니다.');
            if (typeof window.render === 'function') window.render();
        } catch(e) {
            console.error("일정 저장 오류:", e);
            alert("일정 저장 중 오류가 발생했습니다.");
        }
    },

    saveSchedule: async function() {
        const { dateStr, itemId, fId } = this.currentData;
        const p = Number(itemId);
        const subject = (document.getElementById('detail-edit-subject')?.value || '').trim();
        const memo = (document.getElementById('detail-edit-memo')?.value || '').trim();
        const supplies = (document.getElementById('detail-edit-supplies')?.value || '').trim();

        try {
            const colFunc = fId === 'personal' ? getUserCol : (col) => getGroupCol(fId, col);
            const docRef = doc(colFunc('schedules'), dateStr);
            const snap = await getDoc(docRef);
            let periods = snap.exists() ? (snap.data().periods || {}) : {};

            const oldLinked = periods[p]?.linkedItems || [];
            if (subject || memo || supplies || oldLinked.length > 0) {
                periods[p] = {
                    subject, memo, supplies,
                    linkedItems: oldLinked
                };
            } else {
                delete periods[p];
            }

            await setDoc(docRef, { periods: periods, updatedAt: Date.now() }, { merge: true });

            // 메모리 동기화
            if (window.dayViewInstance?.dayData?.[fId]?.schedules) {
                if (subject || memo || supplies || oldLinked.length > 0) {
                    window.dayViewInstance.dayData[fId].schedules[p] = { subject, memo, supplies, linkedItems: oldLinked };
                } else {
                    delete window.dayViewInstance.dayData[fId].schedules[p];
                }
            }
            if (window[`tempSchedules_${dateStr}`]?.[fId]) {
                if (subject || memo || supplies || oldLinked.length > 0) {
                    window[`tempSchedules_${dateStr}`][fId][p] = { subject, memo, supplies, linkedItems: oldLinked };
                } else {
                    delete window[`tempSchedules_${dateStr}`][fId][p];
                }
            }

            this.close();
            if (window.showToast) window.showToast('✅ 수업 내용이 수정되었습니다.');
            if (typeof window.render === 'function') window.render();
        } catch(e) {
            console.error("수업 저장 오류:", e);
            alert("수업 저장 중 오류가 발생했습니다.");
        }
    },

    clearSchedule: async function() {
        if (!confirm("해당 교시의 모든 내용을 지우시겠습니까?")) return;
        const sub = document.getElementById('detail-edit-subject');
        const mem = document.getElementById('detail-edit-memo');
        const sup = document.getElementById('detail-edit-supplies');
        if (sub) sub.value = '';
        if (mem) mem.value = '';
        if (sup) sup.value = '';
        await this.saveSchedule();
    },

    saveJournal: async function() {
        const { dateStr, itemId, fId } = this.currentData;
        const content = document.getElementById('detail-edit-content')?.value || '';
        const selectedChips = document.querySelectorAll('#detail-journal-labels .detail-label-chip.active');
        const labelIds = Array.from(selectedChips).map(c => c.dataset.id);

        try {
            const colFunc = fId === 'personal' ? getUserCol : (col) => getGroupCol(fId, col);
            const docRef = doc(colFunc('journals'), dateStr);
            const snap = await getDoc(docRef);
            let list = snap.exists() ? (snap.data().entries || []) : [];

            let item = list.find(j => String(j.id) === String(itemId));
            if (!item && list[Number(itemId)]) item = list[Number(itemId)];

            if (item) {
                item.content = content;
                item.labelIds = labelIds;
            } else {
                item = {
                    id: itemId || ('jr_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5)),
                    content,
                    labelIds
                };
                list.push(item);
            }

            await setDoc(docRef, { entries: list, updatedAt: Date.now() }, { merge: true });

            // 메모리 동기화
            if (window.dayViewInstance?.dayData?.[fId]?.journals) {
                const memItem = window.dayViewInstance.dayData[fId].journals.find(j => String(j.id) === String(itemId));
                if (memItem) {
                    memItem.content = content;
                    memItem.labelIds = labelIds;
                }
            }

            this.close();
            if (window.showToast) window.showToast('✅ 기록이 수정되었습니다.');
            if (typeof window.render === 'function') window.render();
        } catch(e) {
            console.error("기록 저장 오류:", e);
            alert("기록 저장 중 오류가 발생했습니다.");
        }
    },

    deleteItem: async function() {
        const { type, dateStr, itemId, fId } = this.currentData;
        const typeLabel = type === 'event' ? '일정' : (type === 'schedule' ? '수업' : '기록');
        if (!confirm(`이 ${typeLabel} 항목을 삭제하시겠습니까? (휴지통으로 이동)`)) return;

        try {
            const colFunc = fId === 'personal' ? getUserCol : (col) => getGroupCol(fId, col);
            if (type === 'event') {
                const docRef = doc(colFunc('events'), dateStr);
                const snap = await getDoc(docRef);
                if (snap.exists()) {
                    let list = snap.data().eventList || [];
                    const item = list.find(e => String(e.id) === String(itemId));
                    if (item && window.TrashManager?.moveToTrash) {
                        window.TrashManager.moveToTrash('event', fId, dateStr, item);
                    }
                    list = list.filter(e => String(e.id) !== String(itemId));
                    await setDoc(docRef, { 
                        eventList: list, 
                        eventText: window.formatEventListToText ? window.formatEventListToText(list) : '',
                        updatedAt: Date.now() 
                    }, { merge: true });
                }
                if (window.dayViewInstance?.dayData?.[fId]?.events) {
                    window.dayViewInstance.dayData[fId].events = window.dayViewInstance.dayData[fId].events.filter(e => String(e.id) !== String(itemId));
                }
                if (window[`tempEvents_${dateStr}`]) {
                    window[`tempEvents_${dateStr}`] = window[`tempEvents_${dateStr}`].filter(e => String(e.id) !== String(itemId));
                }
            } else if (type === 'journal') {
                const docRef = doc(colFunc('journals'), dateStr);
                const snap = await getDoc(docRef);
                if (snap.exists()) {
                    let list = snap.data().entries || [];
                    const item = list.find(j => String(j.id) === String(itemId));
                    if (item && window.TrashManager?.moveToTrash) {
                        window.TrashManager.moveToTrash('journal', fId, dateStr, item);
                    }
                    list = list.filter(j => String(j.id) !== String(itemId));
                    await setDoc(docRef, { entries: list, updatedAt: Date.now() }, { merge: true });
                }
                if (window.dayViewInstance?.dayData?.[fId]?.journals) {
                    window.dayViewInstance.dayData[fId].journals = window.dayViewInstance.dayData[fId].journals.filter(j => String(j.id) !== String(itemId));
                }
            } else if (type === 'schedule') {
                await this.clearSchedule();
                return;
            }

            this.close();
            if (window.showToast) window.showToast(`🗑️ ${typeLabel}이(가) 삭제되었습니다.`);
            if (typeof window.render === 'function') window.render();
        } catch(e) {
            console.error("삭제 오류:", e);
            alert("삭제 중 오류가 발생했습니다.");
        }
    },

    close: function() {
        if (this.modal) {
            this.modal.close();
            this.modal = null;
        } else {
            const el = document.getElementById('detail-edit-modal');
            if (el) el.remove();
            if (window.decreaseModalCount) window.decreaseModalCount();
        }
    }
};

window.DetailEditManager = DetailEditManager;
