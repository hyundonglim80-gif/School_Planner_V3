// js/app.js

// ==========================================================================
// 🚀 앱 상태 관리 및 초기화 설정
// ==========================================================================
let currentScope = localStorage.getItem('workCalendar_scope') || 'week';
let currentMode = localStorage.getItem('workCalendar_mode') || 'viewer';
window.showWeekend = localStorage.getItem('workCalendar_showWeekend') === 'true';
window.showClass = localStorage.getItem('workCalendar_showClass') !== 'false'; 
window.currentDate = new Date(); 
window.hasUnsavedChanges = false;

window.toggleWeekend = async function() {
    if (currentMode === 'editor' && window.hasUnsavedChanges) {
        try { await window.saveCurrentViewData(true); } 
        catch (e) { console.warn("자동 저장 오류 발생, 화면 이동 진행"); }
    }
    window.hasUnsavedChanges = false;
    window.showWeekend = !window.showWeekend;
    localStorage.setItem('workCalendar_showWeekend', window.showWeekend);
    window.render();
};

window.toggleClass = async function() {
    if (currentMode === 'editor' && window.hasUnsavedChanges) {
        try { await window.saveCurrentViewData(true); } 
        catch (e) { console.warn("자동 저장 오류 발생, 화면 이동 진행"); }
    }
    window.hasUnsavedChanges = false;
    window.showClass = !window.showClass;
    localStorage.setItem('workCalendar_showClass', window.showClass);
    window.render();
};

window.setScope = async function(scope) {
    if (currentMode === 'editor' && window.hasUnsavedChanges) {
        try { await window.saveCurrentViewData(true); } 
        catch (e) { console.warn("자동 저장 오류 발생, 화면 이동 진행"); }
    }
    window.hasUnsavedChanges = false;
    currentScope = scope;
    localStorage.setItem('workCalendar_scope', scope);
    window.render();
};

window.setMode = async function(mode) {
    if (currentMode === 'editor' && window.hasUnsavedChanges && mode === 'viewer') {
        try { await window.saveCurrentViewData(false); } 
        catch (e) { console.warn("자동 저장 오류 발생, 화면 이동 진행"); }
    }
    currentMode = mode;
    localStorage.setItem('workCalendar_mode', mode);
    window.render();
};

window.saveCurrentViewData = async function(isSilent = false) {
    try {
        if (currentScope === 'day' && window.saveDayDataFromEditor) await window.saveDayDataFromEditor();
        else if (currentScope === 'week' && window.saveWeekDataFromEditor) await window.saveWeekDataFromEditor();
        else if (currentScope === 'month' && window.saveMonthDataFromEditor) await window.saveMonthDataFromEditor();
        else if (currentScope === 'year' && window.saveYearDataFromEditor) await window.saveYearDataFromEditor();
        
        window.hasUnsavedChanges = false;
        if (!isSilent) alert("✅ 성공적으로 저장되었습니다!");
    } catch (e) {
        console.error("저장 중 오류 발생:", e);
        if (!isSilent) alert("❌ 저장 중 오류가 발생했습니다.");
        throw e; // 에러를 상위 함수로 전달하여 인지할 수 있도록 처리
    }
};

window.render = async function() {
    const container = document.getElementById('main-view');
    if (!container) return;

    if (typeof window.updateToggleButtonsUI === 'function') window.updateToggleButtonsUI();

    if (currentMode === 'viewer') {
        if (currentScope === 'day' && window.renderDayViewer) await window.renderDayViewer(container);
        else if (currentScope === 'week' && window.renderWeekViewer) await window.renderWeekViewer(container);
        else if (currentScope === 'month' && window.renderMonthViewer) await window.renderMonthViewer(container);
        else if (currentScope === 'year' && window.renderYearViewer) await window.renderYearViewer(container);
    } else {
        if (currentScope === 'day' && window.renderDayEditor) await window.renderDayEditor(container);
        else if (currentScope === 'week' && window.renderWeekEditor) await window.renderWeekEditor(container);
        else if (currentScope === 'month' && window.renderMonthEditor) await window.renderMonthEditor(container);
        else if (currentScope === 'year' && window.renderYearEditor) await window.renderYearEditor(container);
    }
};

// ==========================================================================
// 🚀 기간 일정 다중 등록 모달 (시작일/종료일 자유 선택)
// ==========================================================================
window.openPeriodModal = function(startDateStr, labelName, textContent, callback) {
    const existingModal = document.getElementById('period-modal');
    if (existingModal) existingModal.remove();

    const modalHtml = `
    <div id="period-modal" style="position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.5); z-index:10002; display:flex; justify-content:center; align-items:center;">
        <div style="background:#fff; padding:25px; border-radius:12px; width:360px; box-shadow:0 10px 25px rgba(0,0,0,0.2);">
            <h3 style="margin-top:0; color:#2563eb; border-bottom:2px solid #bfdbfe; padding-bottom:10px;">📅 [${labelName}] 기간 등록</h3>
            
            <div style="margin-bottom:15px;">
                <label style="display:block; font-weight:bold; margin-bottom:5px;">일정 내용</label>
                <input type="text" id="period-content" value="${textContent || ''}" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:6px; font-size:1rem; box-sizing:border-box;" placeholder="예: 주간 계획 작성">
            </div>

            <div style="display:flex; gap:10px; margin-bottom:15px;">
                <div style="flex:1;">
                    <label style="display:block; font-weight:bold; margin-bottom:5px; font-size:0.9rem; color:#2563eb;">시작일 선택</label>
                    <input type="date" id="period-start" value="${startDateStr}" style="width:100%; padding:8px; border:1px solid #2563eb; border-radius:6px; outline:none; box-sizing:border-box;">
                </div>
                <div style="flex:1;">
                    <label style="display:block; font-weight:bold; margin-bottom:5px; font-size:0.9rem; color:#ef4444;">종료일 선택</label>
                    <input type="date" id="period-end" value="${startDateStr}" style="width:100%; padding:8px; border:1px solid #ef4444; border-radius:6px; outline:none; box-sizing:border-box;">
                </div>
            </div>

            <div style="margin-bottom:25px; background:#f8fafc; padding:10px; border-radius:6px; border:1px solid #e2e8f0;">
                <label style="display:flex; align-items:center; gap:6px; font-weight:bold; cursor:pointer;">
                    <input type="checkbox" id="period-exclude-weekend" checked style="width:16px; height:16px; accent-color:#2563eb;">
                    주말(토/일) 제외하고 계산하기
                </label>
                <p style="margin:5px 0 0 22px; font-size:0.8rem; color:#64748b;">체크 시 평일에만 (1/5), (2/5) 형식으로 일정이 등록됩니다.</p>
            </div>

            <div style="display:flex; justify-content:flex-end; gap:10px;">
                <button id="btn-period-cancel" style="padding:10px 16px; border:none; background:#f1f5f9; font-weight:bold; border-radius:6px; cursor:pointer; color:#475569;">취소</button>
                <button id="btn-period-register" style="padding:10px 16px; border:none; background:#2563eb; color:#fff; font-weight:bold; border-radius:6px; cursor:pointer;">등록</button>
            </div>
        </div>
    </div>`;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    document.getElementById('btn-period-cancel').onclick = function() {
        document.getElementById('period-modal').remove();
        if (callback) callback(false);
    };

    document.getElementById('btn-period-register').onclick = function() {
        window.executePeriodSave(labelName, callback);
    };
};

window.executePeriodSave = async function(labelName, callback) {
    const content = document.getElementById('period-content').value.trim();
    const startStr = document.getElementById('period-start').value;
    const endStr = document.getElementById('period-end').value;
    const excludeWeekend = document.getElementById('period-exclude-weekend').checked;

    if (!content) {
        alert("일정 내용을 입력해주세요.");
        return;
    }
    if (!startStr || !endStr) {
        alert("시작일과 종료일을 선택해주세요.");
        return;
    }
    if (startStr > endStr) {
        alert("시작일은 종료일보다 이전이거나 같아야 합니다.");
        return;
    }

    const startDate = window.parseLocalDate(startStr);
    const endDate = window.parseLocalDate(endStr);
    
    const dateList = [];
    let cur = new Date(startDate);
    while (cur <= endDate) {
        const dayOfWeek = cur.getDay();
        if (!excludeWeekend || (dayOfWeek !== 0 && dayOfWeek !== 6)) {
            dateList.push(window.formatDate(cur));
        }
        cur.setDate(cur.getDate() + 1);
    }

    if (dateList.length === 0) {
        alert("선택한 기간에 등록 가능한 날짜가 없습니다.");
        return;
    }

    const totalDays = dateList.length;
    const groupId = 'period_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

    const modalBox = document.querySelector('#period-modal > div');
    if (modalBox) {
        modalBox.innerHTML = `<div style="text-align:center; padding:20px; font-weight:bold; color:#2563eb;">⏳ 기간 일정을 저장하는 중입니다...</div>`;
    }

    try {
        let batch = window.db.batch();
        let count = 0;
        let batchPromises = [];

        for (let i = 0; i < totalDays; i++) {
            const dateStr = dateList[i];
            const eventContent = totalDays > 1 ? `${content} (${i + 1}/${totalDays})` : content;
            const newEvent = {
                content: eventContent,
                labels: [labelName],
                groupId: groupId,
                createdAt: Date.now()
            };

            const docRef = window.getUserCol('events').doc(dateStr);
            const docSnap = await docRef.get();
            let eventList = docSnap.exists ? (docSnap.data().eventList || []) : [];
            
            eventList.push(newEvent);

            batch.set(docRef, { eventList: eventList, updatedAt: Date.now() }, { merge: true });
            count++;

            if (count >= 400) {
                batchPromises.push(batch.commit());
                batch = window.db.batch();
                count = 0;
            }
        }

        if (count > 0) batchPromises.push(batch.commit());
        await Promise.all(batchPromises);
    } catch (e) {
        console.error("기간 일정 저장 오류:", e);
        alert("기간 일정 저장 중 오류가 발생했습니다.");
    }

    const modal = document.getElementById('period-modal');
    if (modal) modal.remove();

    if (callback) callback(true);
};

// ==========================================================================
// 🚀 기간 일정 안전 삭제 모달
// ==========================================================================
window.showPeriodDeleteModal = function(baseDateStr, labelName, textContent, groupId, onConfirm) {
    const existingModal = document.getElementById('period-delete-modal');
    if (existingModal) existingModal.remove();

    const modalHtml = `
    <div id="period-delete-modal" style="position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.5); z-index:10002; display:flex; justify-content:center; align-items:center;">
        <div style="width:360px; padding:25px; background:#fff; border-radius:12px; text-align:center; box-shadow:0 10px 25px rgba(0,0,0,0.2);">
            <h3 style="color:#ef4444; margin-top:0;">🗑️ 기간 일정 삭제</h3>
            <p style="color:#475569; font-size:0.95rem; margin-bottom:20px; line-height:1.5;">
                이 일정은 <b>'기간'</b> 속성의 일정입니다.<br>어떻게 삭제하시겠습니까?
            </p>
            <div style="display:flex; flex-direction:column; gap:10px;">
                <button id="btn-del-only-this" style="padding:12px; background:#f1f5f9; border:1px solid #cbd5e1; border-radius:8px; cursor:pointer; font-weight:bold; color:#1e293b;">선택한 날만 삭제</button>
                <button id="btn-del-all" style="padding:12px; background:#fee2e2; border:1px solid #fca5a5; border-radius:8px; cursor:pointer; font-weight:bold; color:#b91c1c;">전체 기간 일정 모두 삭제</button>
                <button id="btn-del-after-this" style="padding:12px; background:#ef4444; border:none; border-radius:8px; cursor:pointer; font-weight:bold; color:#fff;">이 날부터 끝날까지 삭제</button>
                <button onclick="document.getElementById('period-delete-modal').remove()" style="padding:10px; background:none; border:none; color:#64748b; font-weight:bold; cursor:pointer; margin-top:5px;">취소</button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const baseContent = (textContent || '').replace(/\s*\(\d+\/\d+\).*/, '').trim();
    
    document.getElementById('btn-del-only-this').onclick = () => window.executePeriodDelete('only', baseDateStr, groupId, labelName, baseContent, onConfirm);
    document.getElementById('btn-del-after-this').onclick = () => window.executePeriodDelete('after', baseDateStr, groupId, labelName, baseContent, onConfirm);
    document.getElementById('btn-del-all').onclick = () => window.executePeriodDelete('all', baseDateStr, groupId, labelName, baseContent, onConfirm);
};

window.executePeriodDelete = async function(mode, baseDateStr, groupId, labelName, baseContent, onConfirm) {
    const modalEl = document.getElementById('period-delete-modal');
    if (modalEl) {
        modalEl.innerHTML = `<div style="background:#fff; padding:30px; border-radius:12px; font-weight:bold; color:#2563eb; text-align:center;">⏳ 기간 일정을 삭제하는 중입니다...</div>`;
    }
    
    const matchEvent = (e) => {
        if (groupId && e.groupId) return e.groupId === groupId;
        const eLabels = e.labels || (e.label ? [e.label] : []);
        const hasLabel = eLabels.includes(labelName);
        const c = (e.content || '').replace(/\s*\(\d+\/\d+\).*/, '').trim();
        return hasLabel && c === baseContent;
    };

    try {
        let query = window.getUserCol('events');
        
        if (mode === 'only') {
            const docRef = window.getUserCol('events').doc(baseDateStr);
            const docSnap = await docRef.get();
            if (docSnap.exists) {
                let list = docSnap.data().eventList || [];
                list = list.filter(e => !matchEvent(e));
                await docRef.update({ eventList: list, updatedAt: Date.now() });
            }
        } else {
            if (mode === 'after') {
                query = query.where(firebase.firestore.FieldPath.documentId(), '>=', baseDateStr);
            }
            const snap = await query.get();
            let batch = window.db.batch();
            let count = 0;
            let batchPromises = [];
            
            snap.forEach(doc => {
                const data = doc.data();
                let list = data.eventList || [];
                const origLen = list.length;
                
                list = list.filter(e => !matchEvent(e));
                
                if (origLen !== list.length) {
                    batch.update(doc.ref, { eventList: list, updatedAt: Date.now() });
                    count++;
                    
                    // 🚀 [보완] 대량 삭제 시 400개 단위 분할 커밋 (Firestore 한도 초과 방지)
                    if (count >= 400) {
                        batchPromises.push(batch.commit());
                        batch = window.db.batch();
                        count = 0;
                    }
                }
            });
            if (count > 0) batchPromises.push(batch.commit());
            await Promise.all(batchPromises);
        }
    } catch(e) {
        console.error("기간 일정 삭제 오류:", e);
    }
    
    const modal = document.getElementById('period-delete-modal');
    if (modal) modal.remove();
    if (onConfirm) onConfirm();
};
