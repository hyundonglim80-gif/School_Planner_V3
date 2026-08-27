// js/modules/evaluation.js

import { dbAPI } from '../api/database.js'; // 🌟 신규 API 경로로 변경
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

        const titleText = this.currentGroupId ? '새 조사표 생성 (공유됨)' : '새 조사표 생성 (개인)';

        this.creationModal = new window.Modal({
            id: 'eval-creation-modal',
            title: titleText,
            width: '560px',
            content: html
        });
        
        this.creationModal.open();
        this.toggleEvalType();
    },

    handleRosterChange: function(selectEl) {
        if (selectEl.value === 'ADD_ROSTER') {
            document.getElementById('eval-creation-modal')?.remove();
            if (typeof window.RosterManager !== 'undefined') window.RosterManager.openModal();
            else alert("명렬표(학급 정보) 관리 메뉴를 찾을 수 없습니다.");
            return;
        }
        if (document.getElementById('eval-method-group')?.checked) {
            this.renderDynamicGroups();
        }
    },

    getCreationHtml: function(defaultSubject) {
        let rosterOptions = '<option value="">등록된 명렬표 없음 (먼저 명렬표를 등록해주세요)</option>';
        if (this.roster && this.roster.length > 0) {
             rosterOptions = this.roster.map((r, i) => `<option value="${i}">${r.year}학년도 ${r.grade}학년 ${r.classNum}반 (${r.students ? r.students.length : 0}명)</option>`).join('');
        }
        rosterOptions += `<option value="ADD_ROSTER" style="font-weight:bold; color:#475569;">새 학급(명렬표) 추가하기</option>`;

        const subjects = ['국어','도덕','사회','수학','과학','실과','체육','음악','미술','영어','창체'];
        const subjOptions = subjects.map(s => `<option value="${s}" ${s===defaultSubject?'selected':''}>${s}</option>`).join('');

        const maxPeriod = store.periodNames ? store.periodNames.length : 6;
        let periodOptions = '';
        for (let i = 1; i <= maxPeriod; i++) {
            const pName = store.periodNames[i-1] || `${i}교시`;
            const isSelected = (this.currentContext.source === 'schedule' && String(this.currentContext.period) === String(i)) ? 'selected' : '';
            periodOptions += `<option value="${i}" ${isSelected}>${pName}</option>`;
        }
        periodOptions += `<option value="journal" ${this.currentContext.source === 'journal' ? 'selected' : ''}>기록 (오늘 기록 칸)</option>`;

        const groupWarning = this.currentGroupId 
            ? `<div style="background:#f8fafc; padding:10px 14px; border-radius:6px; border:1px solid #e2e8f0; color:#475569; font-size:0.9rem; margin-bottom:15px; font-weight:bold;">안내: 공유 시간표에서 생성 중입니다. 데이터가 멤버에게 노출됩니다.</div>`
            : '';

        return `
            ${groupWarning}
            <div style="display:flex; flex-direction:column; gap:16px; margin-bottom:15px; max-height:60vh; overflow-y:auto; padding-right:5px; padding-bottom:5px; color:#334155;">
                
                <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:8px; padding:16px;">
                    <div style="margin-bottom:12px;">
                        <label style="font-weight:bold; font-size:0.95rem; display:block; margin-bottom:6px;">적용할 명렬표 확인</label>
                        <select id="eval-roster" onchange="window.EvaluationManager.handleRosterChange(this)" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:4px; outline:none; background:#f8fafc; color:#334155; cursor:pointer;">
                            ${rosterOptions}
                        </select>
                    </div>
                    <div>
                        <label style="font-weight:bold; font-size:0.95rem; display:block; margin-bottom:6px;">조사표 제목</label>
                        <input type="text" id="eval-title" placeholder="예: 1단원 평가, 준비물 체크" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:4px; outline:none; font-size:1rem; box-sizing:border-box; transition:0.2s;" onfocus="this.style.borderColor='#94a3b8'" onblur="this.style.borderColor='#cbd5e1'">
                    </div>
                </div>

                <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:8px; padding:16px;">
                    <div style="margin-bottom:15px;">
                        <label style="font-weight:bold; font-size:0.95rem; display:block; margin-bottom:8px;">유형 선택</label>
                        <div style="display:flex; gap:20px; font-size:0.95rem; padding:10px; background:#f8fafc; border-radius:4px; border:1px solid #f1f5f9;">
                            <label style="cursor:pointer; display:flex; align-items:center; gap:6px;"><input type="radio" name="eval-type" value="eval" checked onchange="window.EvaluationManager.toggleEvalType()" style="accent-color:#475569; width:16px; height:16px;"> 평가</label>
                            <label style="cursor:pointer; display:flex; align-items:center; gap:6px;"><input type="radio" name="eval-type" value="check" onchange="window.EvaluationManager.toggleEvalType()" style="accent-color:#475569; width:16px; height:16px;"> 체크(O/X)</label>
                            <label style="cursor:pointer; display:flex; align-items:center; gap:6px;"><input type="radio" name="eval-type" value="memo" onchange="window.EvaluationManager.toggleEvalType()" style="accent-color:#475569; width:16px; height:16px;"> 메모</label>
                        </div>
                    </div>

                    <div style="display:flex; gap:12px;">
                        <div style="flex:1;">
                            <label style="font-size:0.85rem; font-weight:bold; display:block; margin-bottom:4px;">교과</label>
                            <select id="eval-subject" style="width:100%; padding:8px; border-radius:4px; border:1px solid #cbd5e1; outline:none; background:#fff; cursor:pointer; color:#334155;">
                                <option value="">선택 안함</option>
                                ${subjOptions}
                            </select>
                        </div>
                        <div style="flex:1;">
                            <label style="font-size:0.85rem; font-weight:bold; display:block; margin-bottom:4px;">날짜</label>
                            <input type="date" id="eval-date" value="${this.currentDateStr}" style="width:100%; padding:8px; border-radius:4px; border:1px solid #cbd5e1; outline:none; font-family:inherit; color:#334155;">
                        </div>
                        <div style="flex:1;">
                            <label style="font-size:0.85rem; font-weight:bold; display:block; margin-bottom:4px;">위치(교시/기록)</label>
                            <select id="eval-period" style="width:100%; padding:8px; border-radius:4px; border:1px solid #cbd5e1; outline:none; background:#fff; cursor:pointer; color:#334155;">
                                ${periodOptions}
                            </select>
                        </div>
                    </div>
                </div>
                
                <div id="eval-detail-config" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:16px; display:flex; flex-direction:column; gap:14px;">
                    <div>
                        <label style="font-weight:bold; font-size:0.95rem; display:block; margin-bottom:8px;">평가 세부 설정 (중복 가능)</label>
                        <div style="display:flex; gap:15px; padding:10px; background:#fff; border-radius:4px; border:1px solid #e2e8f0;">
                            <label style="cursor:pointer; display:flex; align-items:center; gap:6px;"><input type="checkbox" id="eval-method-indiv" checked onchange="window.EvaluationManager.toggleMethod()" style="accent-color:#475569; width:16px; height:16px;"> 개인 평가</label>
                            <label style="cursor:pointer; display:flex; align-items:center; gap:6px;"><input type="checkbox" id="eval-method-group" onchange="window.EvaluationManager.toggleMethod()" style="accent-color:#475569; width:16px; height:16px;"> 조별 평가</label>
                        </div>
                    </div>

                    <div id="eval-group-settings" style="display:none; background:#fff; padding:12px; border:1px solid #e2e8f0; border-radius:6px;">
                        <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px; border-bottom:1px solid #f1f5f9; padding-bottom:10px;">
                            <label style="font-size:0.9rem; font-weight:bold;">조 갯수 설정:</label>
                            <input type="number" id="eval-group-count" value="4" min="1" max="20" onchange="window.EvaluationManager.renderDynamicGroups()" style="width:60px; padding:6px; border:1px solid #cbd5e1; border-radius:4px; text-align:center; font-weight:bold; outline:none; transition:0.2s;" onfocus="this.style.borderColor='#94a3b8'" onblur="this.style.borderColor='#cbd5e1'">
                        </div>
                        <div id="eval-group-list" style="display:flex; flex-direction:column; gap:8px;"></div>
                    </div>

                    <div id="eval-step-settings" style="background:#fff; padding:12px; border:1px solid #e2e8f0; border-radius:6px;">
                        <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px; border-bottom:1px solid #f1f5f9; padding-bottom:10px;">
                            <label style="font-size:0.9rem; font-weight:bold;">평가 단계 수:</label>
                            <select id="eval-step-count" onchange="window.EvaluationManager.renderDynamicSteps()" style="padding:6px; border:1px solid #cbd5e1; border-radius:4px; font-weight:bold; outline:none; cursor:pointer; color:#334155;">
                                <option value="2">2단계</option>
                                <option value="3" selected>3단계</option>
                                <option value="4">4단계</option>
                                <option value="5">5단계</option>
                            </select>
                        </div>
                        <div id="eval-step-list" style="display:flex; gap:8px; flex-wrap:wrap;"></div>
                    </div>
                </div>
            </div>

            <div style="display:flex; justify-content:flex-end; gap:10px; border-top:1px solid #e2e8f0; padding-top:15px; margin-top:5px;">
                <button onclick="document.getElementById('eval-creation-modal').remove()" style="padding:10px 20px; border:none; background:#f1f5f9; color:#475569; border-radius:6px; cursor:pointer; transition:0.2s;">취소</button>
                <button onclick="window.EvaluationManager.createEvaluation()" style="padding:10px 20px; border:none; background:#334155; color:white; border-radius:6px; font-weight:bold; cursor:pointer; transition:0.2s;">생성 완료</button>
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
            if (selectedRoster) activeStudents = (selectedRoster.students || []).filter(s => s.isActive !== false);
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
                    if (currentIdx < totalStudents) { members.push(activeStudents[currentIdx].num); currentIdx++; }
                }
                membersStr = members.join(', ');
            }
            html += `
                <div style="display:flex; gap:8px; align-items:center;">
                    <input type="text" id="eval-gname-${i}" value="${defaultName}" style="width:80px; padding:6px; color:#475569; background:#f8fafc; border:1px solid #e2e8f0; border-radius:4px; outline:none; text-align:center; transition:0.2s;" placeholder="조이름" onfocus="this.style.borderColor='#94a3b8'" onblur="this.style.borderColor='#e2e8f0'">
                    <input type="text" id="eval-gmembers-${i}" value="${membersStr}" placeholder="조원 번호 (예: 1, 2, 3)" style="flex:1; padding:6px 10px; border:1px solid #e2e8f0; border-radius:4px; outline:none; color:#475569; transition:0.2s;" onfocus="this.style.borderColor='#94a3b8'" onblur="this.style.borderColor='#e2e8f0'">
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
            html += `<input type="text" id="eval-step-name-${i}" value="${stepName}" style="flex:1; min-width:60px; padding:6px; color:#475569; background:#f8fafc; border:1px solid #e2e8f0; border-radius:4px; outline:none; text-align:center; transition:0.2s;" onfocus="this.style.borderColor='#94a3b8'" onblur="this.style.borderColor='#e2e8f0'">`;
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

        if (selectedPeriodVal === 'journal') finalSource = 'journal';
        else { finalSource = 'schedule'; finalPeriod = parseInt(selectedPeriodVal, 10); }
        
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

    applyToAll: function(field, value) {
        const table = document.getElementById('eval-viewer-table');
        if (!table) return;
        const inputs = table.querySelectorAll(`tbody [data-field="${field}"]`);
        inputs.forEach(inp => {
            if (inp.type === 'checkbox') inp.checked = value;
            else inp.value = value;
        });
    },

    openViewer: async function(dateStr, evalId) {
        this.currentDateStr = dateStr;
        this.currentEvalList = await dbAPI.loadEvaluations(dateStr, this.currentGroupId);
        
        const ev = this.currentEvalList.find(e => e.id === evalId);
        if (!ev) return alert("해당 평가 데이터를 찾을 수 없습니다.");

        const actualGroupId = (this.currentGroupId === 'personal' || this.currentGroupId === '') ? null : this.currentGroupId;
        const uid = window.auth?.currentUser?.uid;
        const isAuthor = !actualGroupId || !ev.authorId || !uid || ev.authorId === uid;

        const isEval = ev.type === 'eval';
        const isCheck = ev.type === 'check';
        const isMemo = ev.type === 'memo';
        const isIndiv = isEval && ev.methodObj?.indiv;
        const isGroup = isEval && ev.methodObj?.group;

        let rowsHtml = '';
        const disabledAttr = isAuthor ? '' : 'disabled';
        const readonlyAttr = isAuthor ? '' : 'readonly';
        const bgStyle = isAuthor ? '' : 'background:#f1f5f9; cursor:not-allowed; color:#94a3b8;';
        const inputBaseStyle = 'border:1px solid #e2e8f0; border-radius:4px; outline:none; transition:0.2s; color:#334155;';

        ev.studentsSnapshot.forEach(st => {
            const rec = ev.records[st.num] || {};
            let inputsHtml = '';
            
            if (isEval) {
                if (isGroup) {
                    const studentGroup = ev.groups?.find(g => g.members.includes(st.num));
                    const gName = studentGroup ? studentGroup.name : '';
                    inputsHtml += `<td style="padding:6px; border:1px solid #f1f5f9; border-bottom:1px solid #e2e8f0;"><input type="text" data-snum="${st.num}" data-field="groupName" value="${rec.groupName || gName}" style="width:40px; padding:6px; text-align:center; ${inputBaseStyle} ${bgStyle}" ${readonlyAttr} onfocus="this.style.borderColor='#94a3b8'" onblur="this.style.borderColor='#e2e8f0'"></td>`;
                    inputsHtml += `<td style="padding:6px; border:1px solid #f1f5f9; border-bottom:1px solid #e2e8f0;"><select data-snum="${st.num}" data-field="groupScore" style="padding:6px; cursor:pointer; ${inputBaseStyle} ${bgStyle}" ${disabledAttr}><option value=""></option>${ev.steps.map(s => `<option value="${s}" ${rec.groupScore===s?'selected':''}>${s}</option>`).join('')}</select></td>`;
                }
                if (isIndiv) {
                    inputsHtml += `<td style="padding:6px; border:1px solid #f1f5f9; border-bottom:1px solid #e2e8f0;"><select data-snum="${st.num}" data-field="indivScore" style="padding:6px; cursor:pointer; ${inputBaseStyle} ${bgStyle}" ${disabledAttr}><option value=""></option>${ev.steps.map(s => `<option value="${s}" ${rec.indivScore===s?'selected':''}>${s}</option>`).join('')}</select></td>`;
                }
                inputsHtml += `<td style="padding:6px; border:1px solid #f1f5f9; border-bottom:1px solid #e2e8f0;"><input type="text" data-snum="${st.num}" data-field="reason" value="${rec.reason || ''}" style="width:90%; padding:6px 8px; ${inputBaseStyle} ${bgStyle}" ${readonlyAttr} onfocus="this.style.borderColor='#94a3b8'" onblur="this.style.borderColor='#e2e8f0'"></td>`;
            } else if (isCheck) {
                inputsHtml += `<td style="padding:6px; border:1px solid #f1f5f9; border-bottom:1px solid #e2e8f0;"><input type="checkbox" data-snum="${st.num}" data-field="checked" ${rec.checked ? 'checked' : ''} style="width:20px;height:20px; accent-color:#475569; cursor:${isAuthor?'pointer':'not-allowed'};" ${disabledAttr}></td>`;
                inputsHtml += `<td style="padding:6px; border:1px solid #f1f5f9; border-bottom:1px solid #e2e8f0;"><input type="text" data-snum="${st.num}" data-field="reason" value="${rec.reason || ''}" style="width:90%; padding:6px 8px; ${inputBaseStyle} ${bgStyle}" ${readonlyAttr} onfocus="this.style.borderColor='#94a3b8'" onblur="this.style.borderColor='#e2e8f0'"></td>`;
            } else if (isMemo) {
                inputsHtml += `<td style="padding:6px; border:1px solid #f1f5f9; border-bottom:1px solid #e2e8f0;"><input type="text" data-snum="${st.num}" data-field="memo" value="${rec.memo || ''}" style="width:95%; padding:6px 8px; ${inputBaseStyle} ${bgStyle}" ${readonlyAttr} onfocus="this.style.borderColor='#94a3b8'" onblur="this.style.borderColor='#e2e8f0'"></td>`;
            }

            rowsHtml += `<tr style="transition:0.2s; background:#fff;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='#fff'"><td style="padding:8px 6px; border:1px solid #f1f5f9; border-bottom:1px solid #e2e8f0; color:#475569; background:#f8fafc;">${st.num}</td><td style="padding:8px 6px; border:1px solid #f1f5f9; border-bottom:1px solid #e2e8f0; color:#1e293b;">${st.name}</td>${inputsHtml}</tr>`;
        });

        let headersHtml = `<th style="padding:12px 8px; border:1px solid #e2e8f0; border-bottom:2px solid #cbd5e1; width:45px; color:#334155; background:#f8fafc; font-weight:normal;">번호</th><th style="padding:12px 8px; border:1px solid #e2e8f0; border-bottom:2px solid #cbd5e1; width:85px; color:#334155; background:#f8fafc; font-weight:normal;">이름</th>`;
        
        let applyAllHtml = `<tr style="background:#f8fafc;"><td colspan="2" style="padding:8px; color:#475569; border:1px solid #e2e8f0; border-bottom:2px solid #cbd5e1; text-align:center; font-size:0.9rem;">전체 일괄 적용</td>`;

        if (isEval) {
            if (isGroup) {
                headersHtml += `<th style="padding:12px 8px; border:1px solid #e2e8f0; border-bottom:2px solid #cbd5e1; color:#334155; background:#f8fafc; font-weight:normal;">조이름</th><th style="padding:12px 8px; border:1px solid #e2e8f0; border-bottom:2px solid #cbd5e1; color:#334155; background:#f8fafc; font-weight:normal;">조별 결과</th>`;
                applyAllHtml += `<td style="padding:6px; border:1px solid #e2e8f0; border-bottom:2px solid #cbd5e1;"><input type="text" placeholder="조이름" style="width:40px; padding:6px; text-align:center; border:1px solid #cbd5e1; border-radius:4px; outline:none;" onchange="window.EvaluationManager.applyToAll('groupName', this.value)"></td>`;
                applyAllHtml += `<td style="padding:6px; border:1px solid #e2e8f0; border-bottom:2px solid #cbd5e1;"><select onchange="window.EvaluationManager.applyToAll('groupScore', this.value)" style="padding:6px; border:1px solid #cbd5e1; border-radius:4px; color:#334155;"><option value="">선택</option>${ev.steps.map(s => `<option value="${s}">${s}</option>`).join('')}</select></td>`;
            }
            if (isIndiv) {
                headersHtml += `<th style="padding:12px 8px; border:1px solid #e2e8f0; border-bottom:2px solid #cbd5e1; color:#334155; background:#f8fafc; font-weight:normal;">개별 결과</th>`;
                applyAllHtml += `<td style="padding:6px; border:1px solid #e2e8f0; border-bottom:2px solid #cbd5e1;"><select onchange="window.EvaluationManager.applyToAll('indivScore', this.value)" style="padding:6px; border:1px solid #cbd5e1; border-radius:4px; color:#334155;"><option value="">선택</option>${ev.steps.map(s => `<option value="${s}">${s}</option>`).join('')}</select></td>`;
            }
            headersHtml += `<th style="padding:12px 8px; border:1px solid #e2e8f0; border-bottom:2px solid #cbd5e1; color:#334155; background:#f8fafc; font-weight:normal;">사유 / 메모</th>`;
            applyAllHtml += `<td style="padding:6px; border:1px solid #e2e8f0; border-bottom:2px solid #cbd5e1;"><input type="text" placeholder="일괄입력 후 Enter" onchange="window.EvaluationManager.applyToAll('reason', this.value)" style="width:90%; padding:6px; border:1px solid #cbd5e1; border-radius:4px; outline:none;"></td>`;
        } else if (isCheck) {
            headersHtml += `<th style="padding:12px 8px; border:1px solid #e2e8f0; border-bottom:2px solid #cbd5e1; color:#334155; background:#f8fafc; font-weight:normal;">체크(O/X)</th><th style="padding:12px 8px; border:1px solid #e2e8f0; border-bottom:2px solid #cbd5e1; color:#334155; background:#f8fafc; font-weight:normal;">사유 / 메모</th>`;
            applyAllHtml += `<td style="padding:6px; border:1px solid #e2e8f0; border-bottom:2px solid #cbd5e1;"><button onclick="window.EvaluationManager.applyToAll('checked', true)" style="padding:6px 10px; margin-right:4px; background:#475569; color:white; border:none; border-radius:4px; cursor:pointer;">전체 O</button><button onclick="window.EvaluationManager.applyToAll('checked', false)" style="padding:6px 10px; background:#94a3b8; color:white; border:none; border-radius:4px; cursor:pointer;">전체 X</button></td>`;
            applyAllHtml += `<td style="padding:6px; border:1px solid #e2e8f0; border-bottom:2px solid #cbd5e1;"><input type="text" placeholder="일괄입력 후 Enter" onchange="window.EvaluationManager.applyToAll('reason', this.value)" style="width:90%; padding:6px; border:1px solid #cbd5e1; border-radius:4px; outline:none;"></td>`;
        } else {
            headersHtml += `<th style="padding:12px 8px; border:1px solid #e2e8f0; border-bottom:2px solid #cbd5e1; color:#334155; background:#f8fafc; font-weight:normal;">개별 메모내용</th>`;
            applyAllHtml += `<td style="padding:6px; border:1px solid #e2e8f0; border-bottom:2px solid #cbd5e1;"><input type="text" placeholder="메모 일괄입력 후 Enter" onchange="window.EvaluationManager.applyToAll('memo', this.value)" style="width:95%; padding:6px; border:1px solid #cbd5e1; border-radius:4px; outline:none;"></td>`;
        }
        applyAllHtml += `</tr>`;

        const titleText = actualGroupId ? `${ev.title} (공유됨${isAuthor ? '' : ' - 읽기전용'})` : `${ev.title} (개인)`;
        
        const deleteBtnHtml = isAuthor ? `<button onclick="window.EvaluationManager.deleteEvaluation('${ev.id}')" style="padding:10px 16px; background:#fff; color:#ef4444; border:1px solid #fca5a5; border-radius:6px; cursor:pointer; transition:0.2s;">삭제</button>` : `<div></div>`;
        const saveBtnHtml = isAuthor ? `<button onclick="window.EvaluationManager.saveViewerData('${ev.id}')" style="padding:10px 24px; border:none; background:#334155; color:white; border-radius:6px; cursor:pointer; transition:0.2s;">저장 및 닫기</button>` : '';
        const cancelText = isAuthor ? '취소' : '닫기';

        const html = `
            <div style="max-height:60vh; overflow-y:auto; padding-right:5px; margin-bottom:15px; border-radius:8px; border:1px solid #e2e8f0; background:#fff;">
                <table style="width:100%; text-align:center; border-collapse:separate; border-spacing:0;" id="eval-viewer-table">
                    <thead style="position:sticky; top:0; z-index:10; background:#f8fafc;">
                        <tr>${headersHtml}</tr>
                        ${isAuthor ? applyAllHtml : ''}
                    </thead>
                    <tbody>${rowsHtml}</tbody>
                </table>
            </div>
            <div style="display:flex; justify-content:space-between; margin-top:15px; border-top:1px solid #e2e8f0; padding-top:15px;">
                ${deleteBtnHtml}
                <div style="display:flex; gap:10px;">
                    <button onclick="document.getElementById('eval-viewer-modal').remove()" style="padding:10px 20px; border:none; background:#f1f5f9; color:#475569; border-radius:6px; cursor:pointer; transition:0.2s;">${cancelText}</button>
                    ${saveBtnHtml}
                </div>
            </div>
        `;

        if (this.viewerModal) document.getElementById('eval-viewer-modal')?.remove();

        this.viewerModal = new window.Modal({
            id: 'eval-viewer-modal',
            title: titleText,
            width: '680px',
            content: html
        });
        this.viewerModal.open();
    },

    saveViewerData: async function(evalId) {
        const ev = this.currentEvalList.find(e => e.id === evalId);
        if (!ev) return;

        const actualGroupId = (this.currentGroupId === 'personal' || this.currentGroupId === '') ? null : this.currentGroupId;
        const uid = window.auth?.currentUser?.uid;
        if (actualGroupId && ev.authorId && uid && ev.authorId !== uid) {
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

        await dbAPI.saveEvaluations(this.currentDateStr, this.currentEvalList, actualGroupId);
        document.getElementById('eval-viewer-modal').remove();
        if (window.dayViewInstance && window.dayViewInstance.dateStr === this.currentDateStr) {
            window.dayViewInstance.refreshEvalBadges();
        }
    },

    deleteEvaluation: async function(evalId) {
        const ev = this.currentEvalList.find(e => e.id === evalId);
        if (!ev) return;

        const actualGroupId = (this.currentGroupId === 'personal' || this.currentGroupId === '') ? null : this.currentGroupId;
        const uid = window.auth?.currentUser?.uid;
        if (actualGroupId && ev.authorId && uid && ev.authorId !== uid) {
            return alert("권한이 없습니다. 본인이 작성한 조사표만 삭제할 수 있습니다.");
        }

        if (!confirm("정말 이 조사표를 완전히 삭제하시겠습니까?")) return;
        this.currentEvalList = this.currentEvalList.filter(e => e.id !== evalId);
        await dbAPI.saveEvaluations(this.currentDateStr, this.currentEvalList, actualGroupId);
        document.getElementById('eval-viewer-modal')?.remove();
        if (window.dayViewInstance && window.dayViewInstance.dateStr === this.currentDateStr) {
            window.dayViewInstance.refreshEvalBadges();
        }
    }
};

window.EvaluationManager = EvaluationManager;