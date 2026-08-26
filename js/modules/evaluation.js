// js/modules/evaluation.js

import { dbAPI } from '../firebase.js';
import { formatDate } from '../core/utils.js';
import { store } from '../core/store.js';

export const EvaluationManager = {
    creationModal: null,
    viewerModal: null,
    currentDateStr: '',
    currentEvalList: [],
    currentContext: null,
    roster: null,
    currentGroupId: null, 

    openCreationModal: async function(dateStr, source, period = null, defaultSubject = '') {
        this.currentDateStr = dateStr || formatDate(new Date());
        this.currentContext = { source, period: period || '' };
        
        this.currentEvalList = await dbAPI.loadEvaluations(this.currentDateStr, this.currentGroupId);
        this.roster = await dbAPI.loadRoster();

        const html = this.getCreationHtml(defaultSubject);
        
        const existingCreation = document.getElementById('eval-creation-modal');
        if (existingCreation) existingCreation.remove();

        const titleText = this.currentGroupId ? '📊 새 조사표 [👥 공유됨]' : '📊 새 조사표 [🔒 개인]';

        this.creationModal = new window.Modal({
            id: 'eval-creation-modal',
            title: titleText,
            width: '550px',
            content: html
        });
        
        this.creationModal.open();
        this.toggleEvalType();
    },

    handleRosterChange: function(selectEl) {
        if (selectEl.value === 'ADD_ROSTER') {
            document.getElementById('eval-creation-modal')?.remove();
            if (typeof window.RosterManager !== 'undefined') {
                window.RosterManager.openModal();
            } else {
                alert("명렬표(학급 정보) 관리 메뉴를 찾을 수 없습니다.");
            }
            return;
        }
        if (document.getElementById('eval-method-group')?.checked) {
            this.renderDynamicGroups();
        }
    },

    getCreationHtml: function(defaultSubject) {
        let rosterOptions = '<option value="">등록된 명렬표 없음 (먼저 명렬표를 등록해주세요)</option>';
        if (this.roster && this.roster.length > 0) {
             rosterOptions = this.roster.map((r, i) => {
                 return `<option value="${i}">${r.year}학년도 ${r.grade}학년 ${r.classNum}반 (${r.students ? r.students.length : 0}명)</option>`;
             }).join('');
        }
        rosterOptions += `<option value="ADD_ROSTER" style="font-weight:bold; color:#2563eb;">➕ 새 학급(명렬표) 추가하기</option>`;

        const subjects = ['국어','도덕','사회','수학','과학','실과','체육','음악','미술','영어','창체'];
        const subjOptions = subjects.map(s => `<option value="${s}" ${s===defaultSubject?'selected':''}>${s}</option>`).join('');

        const maxPeriod = store.periodNames ? store.periodNames.length : 6;
        let periodOptions = '';
        for (let i = 1; i <= maxPeriod; i++) {
            const pName = store.periodNames[i-1] || `${i}교시`;
            const isSelected = (this.currentContext.source === 'schedule' && String(this.currentContext.period) === String(i)) ? 'selected' : '';
            periodOptions += `<option value="${i}" ${isSelected}>${pName}</option>`;
        }
        const isJournalSelected = this.currentContext.source === 'journal' ? 'selected' : '';
        periodOptions += `<option value="journal" ${isJournalSelected}>기록 (오늘 기록 칸)</option>`;

        const groupWarning = this.currentGroupId 
            ? `<div style="background:#eff6ff; padding:8px 12px; border-radius:6px; border:1px solid #bfdbfe; color:#1d4ed8; font-size:0.85rem; margin-bottom:12px; font-weight:bold;">ℹ️ 현재 '공유 시간표'에서 생성 중입니다. 만들어진 데이터는 그룹 멤버에게 노출됩니다.</div>`
            : '';

        return `
            ${groupWarning}
            <div style="display:flex; flex-direction:column; gap:12px; margin-bottom:15px; max-height:60vh; overflow-y:auto; padding-right:5px;">
                <div>
                    <label style="font-weight:bold; font-size:0.9rem;">적용할 명렬표 확인</label>
                    <select id="eval-roster" onchange="window.EvaluationManager.handleRosterChange(this)" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:4px; margin-top:4px; outline:none; background:#f8fafc; font-weight:bold; color:#1e40af;">
                        ${rosterOptions}
                    </select>
                </div>
                <div>
                    <label style="font-weight:bold; font-size:0.9rem;">조사표 제목</label>
                    <input type="text" id="eval-title" placeholder="예: 1단원 평가" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:4px; margin-top:4px; outline:none;">
                </div>
                <div>
                    <label style="font-weight:bold; font-size:0.9rem;">유형 (하나만 선택)</label>
                    <div style="display:flex; gap:15px; margin-top:6px; font-size:0.95rem;">
                        <label style="cursor:pointer;"><input type="radio" name="eval-type" value="eval" checked onchange="window.EvaluationManager.toggleEvalType()" style="accent-color:#2563eb;"> 평가</label>
                        <label style="cursor:pointer;"><input type="radio" name="eval-type" value="check" onchange="window.EvaluationManager.toggleEvalType()" style="accent-color:#2563eb;"> 체크(O/X)</label>
                        <label style="cursor:pointer;"><input type="radio" name="eval-type" value="memo" onchange="window.EvaluationManager.toggleEvalType()" style="accent-color:#2563eb;"> 메모</label>
                    </div>
                </div>

                <div style="display:flex; gap:10px;">
                    <div style="flex:1;">
                        <label style="font-size:0.85rem; color:#475569; font-weight:bold;">교과</label>
                        <select id="eval-subject" style="width:100%; padding:6px; border-radius:4px; border:1px solid #cbd5e1; margin-top:4px;">
                            <option value="">선택 안함</option>
                            ${subjOptions}
                        </select>
                    </div>
                    <div style="flex:1;">
                        <label style="font-size:0.85rem; color:#475569; font-weight:bold;">날짜</label>
                        <input type="date" id="eval-date" value="${this.currentDateStr}" style="width:100%; padding:6px; border-radius:4px; border:1px solid #cbd5e1; margin-top:4px;">
                    </div>
                    <div style="flex:1;">
                        <label style="font-size:0.85rem; color:#475569; font-weight:bold;">위치(교시/기록)</label>
                        <select id="eval-period" style="width:100%; padding:6px; border-radius:4px; border:1px solid #cbd5e1; margin-top:4px; outline:none; background:#fff;">
                            ${periodOptions}
                        </select>
                    </div>
                </div>
                
                <div id="eval-detail-config" style="background:#f8fafc; padding:12px; border-radius:6px; border:1px solid #e2e8f0; display:flex; flex-direction:column; gap:12px;">
                    <div>
                        <label style="font-size:0.85rem; color:#475569; font-weight:bold;">평가 방식 (중복 가능)</label>
                        <div style="display:flex; gap:15px; margin-top:6px;">
                            <label style="cursor:pointer;"><input type="checkbox" id="eval-method-indiv" checked onchange="window.EvaluationManager.toggleMethod()" style="accent-color:#10b981;"> 개인 평가</label>
                            <label style="cursor:pointer;"><input type="checkbox" id="eval-method-group" onchange="window.EvaluationManager.toggleMethod()" style="accent-color:#f59e0b;"> 조별 평가</label>
                        </div>
                    </div>

                    <div id="eval-group-settings" style="display:none; background:#fff; padding:10px; border:1px solid #cbd5e1; border-radius:4px;">
                        <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
                            <label style="font-size:0.85rem; font-weight:bold;">조 갯수:</label>
                            <input type="number" id="eval-group-count" value="4" min="1" max="20" onchange="window.EvaluationManager.renderDynamicGroups()" style="width:60px; padding:4px; border:1px solid #cbd5e1; border-radius:4px;">
                        </div>
                        <div id="eval-group-list" style="display:flex; flex-direction:column; gap:6px;"></div>
                    </div>

                    <div id="eval-step-settings" style="background:#fff; padding:10px; border:1px solid #cbd5e1; border-radius:4px;">
                        <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
                            <label style="font-size:0.85rem; font-weight:bold;">단계 수:</label>
                            <select id="eval-step-count" onchange="window.EvaluationManager.renderDynamicSteps()" style="padding:4px; border:1px solid #cbd5e1; border-radius:4px;">
                                <option value="2">2단계</option>
                                <option value="3" selected>3단계</option>
                                <option value="4">4단계</option>
                                <option value="5">5단계</option>
                            </select>
                        </div>
                        <div id="eval-step-list" style="display:flex; gap:6px; flex-wrap:wrap;"></div>
                    </div>
                </div>
            </div>
            <div style="display:flex; justify-content:flex-end; gap:10px;">
                <button onclick="document.getElementById('eval-creation-modal').remove()" style="padding:8px 16px; border:none; background:#f1f5f9; border-radius:6px; font-weight:bold; cursor:pointer;">취소</button>
                <button onclick="window.EvaluationManager.createEvaluation()" style="padding:8px 16px; border:none; background:#2563eb; color:white; border-radius:6px; font-weight:bold; cursor:pointer;">생성하기</button>
            </div>
        `;
    },

    toggleEvalType: function() {
        const type = document.querySelector('input[name="eval-type"]:checked').value;
        const configDiv = document.getElementById('eval-detail-config');
        if (type === 'eval') {
            configDiv.style.display = 'flex';
            this.toggleMethod();
        } else {
            configDiv.style.display = 'none';
        }
    },

    toggleMethod: function() {
        const isGroup = document.getElementById('eval-method-group').checked;
        const isIndiv = document.getElementById('eval-method-indiv').checked;
        
        document.getElementById('eval-group-settings').style.display = isGroup ? 'block' : 'none';
        document.getElementById('eval-step-settings').style.display = (isGroup || isIndiv) ? 'block' : 'none';

        if (isGroup) this.renderDynamicGroups();
        if (isGroup || isIndiv) this.renderDynamicSteps();
    },

    renderDynamicGroups: function() {
        const count = parseInt(document.getElementById('eval-group-count').value, 10) || 4;
        
        let activeStudents = [];
        const rosterSelect = document.getElementById('eval-roster');
        if (rosterSelect && rosterSelect.value && rosterSelect.value !== 'ADD_ROSTER' && this.roster) {
            const selectedRoster = this.roster[parseInt(rosterSelect.value, 10)];
            if (selectedRoster) {
                activeStudents = (selectedRoster.students || []).filter(s => s.isActive !== false);
            }
        }

        const totalStudents = activeStudents.length;
        let currentIdx = 0;
        let html = '';

        for(let i=0; i<count; i++) {
            const defaultName = String.fromCharCode(65 + i) + '조';
            let membersStr = '';
            
            if (totalStudents > 0) {
                const baseSize = Math.floor(totalStudents / count);
                const remainder = totalStudents % count;
                const groupSize = baseSize + (i < remainder ? 1 : 0);
                
                const members = [];
                for(let j=0; j<groupSize; j++) {
                    if (currentIdx < totalStudents) {
                        members.push(activeStudents[currentIdx].num);
                        currentIdx++;
                    }
                }
                membersStr = members.join(', ');
            }

            html += `
                <div style="display:flex; gap:6px; align-items:center;">
                    <input type="text" id="eval-gname-${i}" value="${defaultName}" style="width:70px; padding:4px; font-weight:bold; border:1px solid #cbd5e1; border-radius:4px; outline:none;" placeholder="조이름">
                    <input type="text" id="eval-gmembers-${i}" value="${membersStr}" placeholder="조원 번호 (예: 1, 2, 3)" style="flex:1; padding:4px; border:1px solid #cbd5e1; border-radius:4px; outline:none;">
                </div>
            `;
        }
        document.getElementById('eval-group-list').innerHTML = html;
    },

    renderDynamicSteps: function() {
        const count = parseInt(document.getElementById('eval-step-count').value, 10) || 3;
        const defaults = ['우수', '보통', '노력요함', '미흡', '매우미흡'];
        let html = '';
        for(let i=0; i<count; i++) {
            const stepName = defaults[i] || `단계${i+1}`;
            html += `<input type="text" id="eval-step-name-${i}" value="${stepName}" style="width:80px; padding:4px; border:1px solid #cbd5e1; border-radius:4px; outline:none; text-align:center;">`;
        }
        document.getElementById('eval-step-list').innerHTML = html;
    },

    createEvaluation: async function() {
        const title = document.getElementById('eval-title').value.trim();
        if (!title) return alert("제목을 입력하세요.");

        const rosterSelect = document.getElementById('eval-roster');
        const rosterIndex = rosterSelect.value;
        if (!rosterIndex || rosterIndex === 'ADD_ROSTER') return alert("적용할 명렬표를 선택해주세요.");

        const type = document.querySelector('input[name="eval-type"]:checked').value;
        const subject = document.getElementById('eval-subject').value;
        const dateStr = document.getElementById('eval-date').value || this.currentDateStr;
        
        const selectedPeriodVal = document.getElementById('eval-period').value;
        let finalSource = 'schedule';
        let finalPeriod = '';

        if (selectedPeriodVal === 'journal') {
            finalSource = 'journal';
        } else {
            finalSource = 'schedule';
            finalPeriod = parseInt(selectedPeriodVal, 10);
        }
        
        let methodObj = { indiv: false, group: false };
        let steps = [], groups = [];

        if (type === 'eval') {
            methodObj.indiv = document.getElementById('eval-method-indiv').checked;
            methodObj.group = document.getElementById('eval-method-group').checked;
            if (!methodObj.indiv && !methodObj.group) return alert("평가 방식을 하나 이상 선택해주세요.");

            if (methodObj.group) {
                const gCount = parseInt(document.getElementById('eval-group-count').value, 10);
                for (let i=0; i<gCount; i++) {
                    const gName = document.getElementById(`eval-gname-${i}`).value.trim();
                    const gMembers = document.getElementById(`eval-gmembers-${i}`).value.split(',').map(s=>parseInt(s.trim(),10)).filter(n=>!isNaN(n));
                    if(gName && gMembers.length > 0) groups.push({ name: gName, members: gMembers });
                }
            }
            
            const stepCount = parseInt(document.getElementById('eval-step-count').value, 10);
            for (let i=0; i<stepCount; i++) {
                const sName = document.getElementById(`eval-step-name-${i}`).value.trim();
                if(sName) steps.push(sName);
            }
        }

        const selectedRoster = this.roster[parseInt(rosterIndex, 10)];
        const studentsSnapshot = selectedRoster.students.filter(s => s.isActive !== false).map(s => ({ num: s.num, name: s.name, gender: s.gender }));

        const newEval = {
            id: 'eval_' + Date.now().toString(36),
            authorId: window.auth?.currentUser?.uid,
            title, subject, type, methodObj, steps, groups,
            dateStr, periodStr: finalPeriod,
            context: { source: finalSource, period: finalPeriod },
            rosterMeta: { year: selectedRoster.year, grade: selectedRoster.grade, classNum: selectedRoster.classNum },
            studentsSnapshot,
            records: {} 
        };

        this.currentEvalList.push(newEval);
        
        await dbAPI.saveEvaluations(dateStr, this.currentEvalList, this.currentGroupId);
        document.getElementById('eval-creation-modal').remove();

        if (window.dayViewInstance && window.dayViewInstance.dateStr === dateStr) {
            window.dayViewInstance.refreshEvalBadges();
        }
        
        this.openViewer(dateStr, newEval.id);
    },

    // 🌟 조사표 전체 일괄 적용 엔진 추가
    applyToAll: function(field, value) {
        const table = document.getElementById('eval-viewer-table');
        if (!table) return;
        const inputs = table.querySelectorAll(`tbody [data-field="${field}"]`);
        inputs.forEach(inp => {
            if (inp.type === 'checkbox') {
                inp.checked = value;
            } else {
                inp.value = value;
            }
        });
    },

    openViewer: async function(dateStr, evalId) {
        this.currentDateStr = dateStr;
        this.currentEvalList = await dbAPI.loadEvaluations(dateStr, this.currentGroupId);
        
        const ev = this.currentEvalList.find(e => e.id === evalId);
        if (!ev) return alert("해당 평가 데이터를 찾을 수 없습니다.");

        const uid = window.auth?.currentUser?.uid;
        const isAuthor = !this.currentGroupId || !ev.authorId || !uid || ev.authorId === uid;

        const isEval = ev.type === 'eval';
        const isCheck = ev.type === 'check';
        const isMemo = ev.type === 'memo';
        const isIndiv = isEval && ev.methodObj?.indiv;
        const isGroup = isEval && ev.methodObj?.group;

        let rowsHtml = '';
        const disabledAttr = isAuthor ? '' : 'disabled';
        const readonlyAttr = isAuthor ? '' : 'readonly';
        const bgStyle = isAuthor ? '' : 'background:#f1f5f9; cursor:not-allowed; color:#64748b;';

        ev.studentsSnapshot.forEach(st => {
            const rec = ev.records[st.num] || {};
            let inputsHtml = '';
            
            if (isEval) {
                if (isGroup) {
                    const studentGroup = ev.groups?.find(g => g.members.includes(st.num));
                    const gName = studentGroup ? studentGroup.name : '';
                    inputsHtml += `<td style="padding:6px; border:1px solid #cbd5e1;"><input type="text" data-snum="${st.num}" data-field="groupName" value="${rec.groupName || gName}" style="width:40px; padding:4px; text-align:center; ${bgStyle}" ${readonlyAttr}></td>`;
                    inputsHtml += `<td style="padding:6px; border:1px solid #cbd5e1;"><select data-snum="${st.num}" data-field="groupScore" style="padding:4px; ${bgStyle}" ${disabledAttr}><option value=""></option>${ev.steps.map(s => `<option value="${s}" ${rec.groupScore===s?'selected':''}>${s}</option>`).join('')}</select></td>`;
                }
                if (isIndiv) {
                    inputsHtml += `<td style="padding:6px; border:1px solid #cbd5e1;"><select data-snum="${st.num}" data-field="indivScore" style="padding:4px; ${bgStyle}" ${disabledAttr}><option value=""></option>${ev.steps.map(s => `<option value="${s}" ${rec.indivScore===s?'selected':''}>${s}</option>`).join('')}</select></td>`;
                }
                inputsHtml += `<td style="padding:6px; border:1px solid #cbd5e1;"><input type="text" data-snum="${st.num}" data-field="reason" value="${rec.reason || ''}" style="width:90%; padding:4px; ${bgStyle}" ${readonlyAttr}></td>`;
            } else if (isCheck) {
                inputsHtml += `<td style="padding:6px; border:1px solid #cbd5e1;"><input type="checkbox" data-snum="${st.num}" data-field="checked" ${rec.checked ? 'checked' : ''} style="width:20px;height:20px; accent-color:#059669; cursor:${isAuthor?'pointer':'not-allowed'};" ${disabledAttr}></td>`;
                inputsHtml += `<td style="padding:6px; border:1px solid #cbd5e1;"><input type="text" data-snum="${st.num}" data-field="reason" value="${rec.reason || ''}" style="width:90%; padding:4px; ${bgStyle}" ${readonlyAttr}></td>`;
            } else if (isMemo) {
                inputsHtml += `<td style="padding:6px; border:1px solid #cbd5e1;"><input type="text" data-snum="${st.num}" data-field="memo" value="${rec.memo || ''}" style="width:98%; padding:4px; ${bgStyle}" ${readonlyAttr}></td>`;
            }

            rowsHtml += `<tr style="transition:0.2s;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='transparent'"><td style="padding:6px; border:1px solid #cbd5e1; font-weight:bold; color:#475569;">${st.num}</td><td style="padding:6px; border:1px solid #cbd5e1; font-weight:bold;">${st.name}</td>${inputsHtml}</tr>`;
        });

        let headersHtml = `<th style="padding:8px; border:1px solid #cbd5e1; width:40px;">번호</th><th style="padding:8px; border:1px solid #cbd5e1; width:80px;">이름</th>`;
        let applyAllHtml = `<tr style="background:#e0f2fe; box-shadow: 0 2px 4px rgba(0,0,0,0.05);"><td colspan="2" style="padding:6px; font-weight:bold; color:#0369a1; border:1px solid #cbd5e1; border-bottom:2px solid #38bdf8;">💡 전체 적용 ➡️</td>`;

        if (isEval) {
            if (isGroup) {
                headersHtml += `<th style="padding:8px; border:1px solid #cbd5e1;">조</th><th style="padding:8px; border:1px solid #cbd5e1;">조별</th>`;
                applyAllHtml += `<td style="padding:6px; border:1px solid #cbd5e1; border-bottom:2px solid #38bdf8;"><input type="text" placeholder="조이름" style="width:40px; padding:4px; text-align:center;" onchange="window.EvaluationManager.applyToAll('groupName', this.value)"></td>`;
                applyAllHtml += `<td style="padding:6px; border:1px solid #cbd5e1; border-bottom:2px solid #38bdf8;"><select onchange="window.EvaluationManager.applyToAll('groupScore', this.value)" style="padding:4px;"><option value="">선택</option>${ev.steps.map(s => `<option value="${s}">${s}</option>`).join('')}</select></td>`;
            }
            if (isIndiv) {
                headersHtml += `<th style="padding:8px; border:1px solid #cbd5e1;">개별</th>`;
                applyAllHtml += `<td style="padding:6px; border:1px solid #cbd5e1; border-bottom:2px solid #38bdf8;"><select onchange="window.EvaluationManager.applyToAll('indivScore', this.value)" style="padding:4px;"><option value="">선택</option>${ev.steps.map(s => `<option value="${s}">${s}</option>`).join('')}</select></td>`;
            }
            headersHtml += `<th style="padding:8px; border:1px solid #cbd5e1;">사유/메모</th>`;
            applyAllHtml += `<td style="padding:6px; border:1px solid #cbd5e1; border-bottom:2px solid #38bdf8;"><input type="text" placeholder="일괄입력 후 Enter" onchange="window.EvaluationManager.applyToAll('reason', this.value)" style="width:90%; padding:4px;"></td>`;
        } else if (isCheck) {
            headersHtml += `<th style="padding:8px; border:1px solid #cbd5e1;">체크(O)</th><th style="padding:8px; border:1px solid #cbd5e1;">사유/메모</th>`;
            applyAllHtml += `<td style="padding:6px; border:1px solid #cbd5e1; border-bottom:2px solid #38bdf8;"><button onclick="window.EvaluationManager.applyToAll('checked', true)" style="padding:3px 8px; margin-right:4px; background:#059669; color:white; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">모두 O</button><button onclick="window.EvaluationManager.applyToAll('checked', false)" style="padding:3px 8px; background:#ef4444; color:white; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">모두 X</button></td>`;
            applyAllHtml += `<td style="padding:6px; border:1px solid #cbd5e1; border-bottom:2px solid #38bdf8;"><input type="text" placeholder="일괄입력 후 Enter" onchange="window.EvaluationManager.applyToAll('reason', this.value)" style="width:90%; padding:4px;"></td>`;
        } else {
            headersHtml += `<th style="padding:8px; border:1px solid #cbd5e1;">개별 메모</th>`;
            applyAllHtml += `<td style="padding:6px; border:1px solid #cbd5e1; border-bottom:2px solid #38bdf8;"><input type="text" placeholder="메모 일괄입력 후 Enter" onchange="window.EvaluationManager.applyToAll('memo', this.value)" style="width:98%; padding:4px;"></td>`;
        }
        applyAllHtml += `</tr>`;

        const titleText = this.currentGroupId ? `📊 ${ev.title} [👥 공유됨${isAuthor ? '' : ' - 읽기전용'}]` : `📊 ${ev.title} [🔒 개인]`;
        
        const deleteBtnHtml = isAuthor ? `<button onclick="window.EvaluationManager.deleteEvaluation('${ev.id}')" style="padding:8px 12px; background:#fee2e2; color:#ef4444; border:none; border-radius:6px; cursor:pointer; font-weight:bold;">🗑️ 삭제</button>` : `<div></div>`;
        const saveBtnHtml = isAuthor ? `<button onclick="window.EvaluationManager.saveViewerData('${ev.id}')" style="padding:8px 16px; border:none; background:#2563eb; color:white; border-radius:6px; font-weight:bold; cursor:pointer;">💾 저장</button>` : '';
        const cancelText = isAuthor ? '취소' : '닫기';

        const html = `
            <div style="max-height:60vh; overflow-y:auto; padding-right:5px; margin-bottom:10px;">
                <table style="width:100%; text-align:center; border-collapse:separate; border-spacing:0;" id="eval-viewer-table">
                    <thead style="position:sticky; top:0; z-index:10; background:#f1f5f9;">
                        <tr style="color:#1e293b; background:#f1f5f9;">${headersHtml}</tr>
                        ${isAuthor ? applyAllHtml : ''}
                    </thead>
                    <tbody>${rowsHtml}</tbody>
                </table>
            </div>
            <div style="display:flex; justify-content:space-between; margin-top:15px; border-top:2px solid #e2e8f0; padding-top:15px;">
                ${deleteBtnHtml}
                <div style="display:flex; gap:10px;">
                    <button onclick="document.getElementById('eval-viewer-modal').remove()" style="padding:8px 16px; border:none; background:#f1f5f9; color:#475569; border-radius:6px; cursor:pointer; font-weight:bold;">${cancelText}</button>
                    ${saveBtnHtml}
                </div>
            </div>
        `;

        if (this.viewerModal) document.getElementById('eval-viewer-modal')?.remove();

        this.viewerModal = new window.Modal({
            id: 'eval-viewer-modal',
            title: titleText,
            width: '600px',
            content: html
        });
        this.viewerModal.open();
    },

    saveViewerData: async function(evalId) {
        const ev = this.currentEvalList.find(e => e.id === evalId);
        if (!ev) return;

        const uid = window.auth?.currentUser?.uid;
        if (this.currentGroupId && ev.authorId && uid && ev.authorId !== uid) {
            return alert("권한이 없습니다. 읽기 전용 조사표입니다.");
        }

        const table = document.getElementById('eval-viewer-table');
        if (!table) return;

        ev.records = {};
        const inputs = table.querySelectorAll('tbody input, tbody select');
        inputs.forEach(inp => {
            const sNum = parseInt(inp.getAttribute('data-snum'), 10);
            if (isNaN(sNum)) return;
            const field = inp.getAttribute('data-field');
            let val = inp.type === 'checkbox' ? inp.checked : inp.value.trim();

            if (inp.type !== 'checkbox' && !val) return; 

            if (!ev.records[sNum]) ev.records[sNum] = {};
            ev.records[sNum][field] = val;
        });

        await dbAPI.saveEvaluations(this.currentDateStr, this.currentEvalList, this.currentGroupId);
        document.getElementById('eval-viewer-modal').remove();
        if (window.dayViewInstance && window.dayViewInstance.dateStr === this.currentDateStr) {
            window.dayViewInstance.refreshEvalBadges();
        }
    },

    deleteEvaluation: async function(evalId) {
        const ev = this.currentEvalList.find(e => e.id === evalId);
        if (!ev) return;

        const uid = window.auth?.currentUser?.uid;
        if (this.currentGroupId && ev.authorId && uid && ev.authorId !== uid) {
            return alert("권한이 없습니다. 본인이 작성한 조사표만 삭제할 수 있습니다.");
        }

        if (!confirm("정말 이 조사표를 완전히 삭제하시겠습니까?")) return;
        this.currentEvalList = this.currentEvalList.filter(e => e.id !== evalId);
        await dbAPI.saveEvaluations(this.currentDateStr, this.currentEvalList, this.currentGroupId);
        document.getElementById('eval-viewer-modal')?.remove();
        if (window.dayViewInstance && window.dayViewInstance.dateStr === this.currentDateStr) {
            window.dayViewInstance.refreshEvalBadges();
        }
    }
};

window.EvaluationManager = EvaluationManager;
