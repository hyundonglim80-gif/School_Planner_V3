// js/modules/evaluations.js

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

    openCreationModal: async function(dateStr, source, period = null, defaultSubject = '') {
        this.currentDateStr = dateStr || formatDate(new Date());
        this.currentContext = { source, period: period || '' };
        
        this.currentEvalList = await dbAPI.loadEvaluations(this.currentDateStr);
        this.roster = await dbAPI.loadRoster();

        const html = this.getCreationHtml(defaultSubject);
        
        const existingCreation = document.getElementById('eval-creation-modal');
        if (existingCreation) existingCreation.remove();

        this.creationModal = new window.Modal({
            id: 'eval-creation-modal',
            title: '📊 새 조사표',
            width: '550px',
            content: html
        });
        
        this.creationModal.open();
        this.toggleEvalType();
    },

    handleRosterChange: function(selectEl) {
        if (selectEl.value === 'ADD_ROSTER') {
            document.getElementById('eval-creation-modal')?.remove();
            
            const rosterBtn = Array.from(document.querySelectorAll('.dropdown-item')).find(btn => btn.textContent.includes('학급') || btn.textContent.includes('명렬표') || btn.textContent.includes('가져오기'));
            
            if (rosterBtn) {
                rosterBtn.click();
            } else if (typeof window.BackupManager !== 'undefined' && window.BackupManager.openModal) {
                window.BackupManager.openModal();
            } else if (typeof window.openSettingsModal === 'function') {
                window.openSettingsModal();
            } else if (typeof window.openRosterModal === 'function') {
                window.openRosterModal();
            } else {
                alert("명렬표(학급 정보) 관리 메뉴를 찾을 수 없습니다. 더보기(⋮) 메뉴를 확인해주세요.");
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

        return `
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
                        <div id="eval-group-list" style="display:flex; flex-direction:column; gap:6px;">
                        </div>
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
                        <div id="eval-step-list" style="display:flex; gap:6px; flex-wrap:wrap;">
                        </div>
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

            if (!methodObj.indiv && !methodObj.group) return alert("평가 방식을 최소 하나 이상 선택하세요.");

            const stepCount = parseInt(document.getElementById('eval-step-count').value, 10) || 0;
            for(let i=0; i<stepCount; i++) {
                const sval = document.getElementById(`eval-step-name-${i}`).value.trim();
                if(sval) steps.push(sval);
            }

            if (methodObj.group) {
                const groupCount = parseInt(document.getElementById('eval-group-count').value, 10) || 0;
                for(let i=0; i<groupCount; i++) {
                    const gname = document.getElementById(`eval-gname-${i}`).value.trim();
                    const gmembers = document.getElementById(`eval-gmembers-${i}`).value;
                    const membersArr = gmembers.split(new RegExp("[,\\s/]+")).map(n => parseInt(n, 10)).filter(n => !isNaN(n));
                    if(gname) groups.push({ name: gname, members: membersArr });
                }
            }
        }

        const selectedRoster = this.roster[parseInt(rosterIndex, 10)];
        const activeStudents = (selectedRoster.students || []).filter(s => s.isActive !== false);

        if (activeStudents.length === 0) return alert("선택한 명렬표에 활성 상태인 학생이 없습니다.");

        const newEval = {
            id: 'eval_' + Date.now().toString(36),
            title,
            type,
            subject,
            methodObj,
            steps,
            groups,
            rosterMeta: { year: selectedRoster.year, grade: selectedRoster.grade, classNum: selectedRoster.classNum },
            dateStr: dateStr,
            periodStr: finalPeriod ? String(finalPeriod) : '',
            context: { source: finalSource, period: finalPeriod },
            studentsSnapshot: activeStudents, 
            records: {}
        };

        const submitBtn = document.querySelector('#eval-creation-modal button:last-child');
        if(submitBtn) { submitBtn.innerText = "저장 중..."; submitBtn.disabled = true; }

        try {
            if (dateStr === this.currentDateStr) {
                this.currentEvalList.push(newEval);
                await dbAPI.saveEvaluations(this.currentDateStr, this.currentEvalList);
            } else {
                const targetEvalList = await dbAPI.loadEvaluations(dateStr) || [];
                targetEvalList.push(newEval);
                await dbAPI.saveEvaluations(dateStr, targetEvalList);
            }
        } catch(e) {
            console.error(e);
        }
        
        const creationModalEl = document.getElementById('eval-creation-modal');
        if (creationModalEl) creationModalEl.remove();
        
        if (dateStr === this.currentDateStr && window.dayViewInstance && typeof window.dayViewInstance.refreshEvalBadges === 'function') {
            await window.dayViewInstance.refreshEvalBadges();
        } else if (typeof window.render === 'function') {
            window.render();
        }

        setTimeout(() => {
            window.EvaluationManager.openViewer(dateStr, newEval.id);
        }, 100);
    },

    openViewer: async function(dateStr, evalId) {
        this.currentDateStr = dateStr;
        this.currentEvalList = await dbAPI.loadEvaluations(dateStr);
        const evalData = this.currentEvalList.find(e => e.id === evalId);
        if (!evalData) return alert("조사표를 찾을 수 없습니다.");

        const html = this.getViewerHtml(evalData);
        
        const existingViewer = document.getElementById('eval-viewer-modal');
        if (existingViewer) existingViewer.remove();

        this.viewerModal = new window.Modal({
            id: 'eval-viewer-modal',
            title: `📊 ${evalData.title}`,
            width: '650px',
            content: html
        });
        this.viewerModal.open();
    },

    onReasonChange: function(evalId, studentNum, value) {
        if (value === '기타_직접입력') {
            const custom = prompt("미평가 사유를 직접 입력하세요:");
            if (custom !== null && custom.trim() !== "") {
                this.updateRecord(evalId, studentNum, 'reason', custom.trim());
            } else {
                this.updateRecord(evalId, studentNum, 'reason', '');
            }
        } else {
            this.updateRecord(evalId, studentNum, 'reason', value);
        }
    },

    getViewerHtml: function(evalData) {
        let listHtml = '';
        const students = evalData.studentsSnapshot || [];
        const isEval = evalData.type === 'eval';
        const isIndiv = isEval ? (evalData.methodObj ? evalData.methodObj.indiv : (evalData.method !== 'group')) : false;
        const isGroup = isEval ? (evalData.methodObj ? evalData.methodObj.group : (evalData.method === 'group')) : false;

        students.forEach(st => {
            const rec = evalData.records[st.num] || {};
            
            if (isGroup && rec.groupName === undefined) {
                const foundG = evalData.groups.find(g => g.members.includes(st.num));
                if (foundG) rec.groupName = foundG.name;
            }

            let inputUI = '';
            
            const reasonVal = rec.reason || '';
            const reasonSelect = `
                <select onchange="window.EvaluationManager.onReasonChange('${evalData.id}', ${st.num}, this.value)" style="padding:4px; font-size:0.8rem; border-radius:4px; border:1px solid #cbd5e1; outline:none; max-width:90px;">
                    <option value="">사유(선택)</option>
                    <option value="결석" ${reasonVal==='결석'?'selected':''}>결석</option>
                    <option value="부상" ${reasonVal==='부상'?'selected':''}>부상</option>
                    <option value="기타_직접입력">기타(직접입력)</option>
                    ${reasonVal && reasonVal!=='결석' && reasonVal!=='부상' ? `<option value="${reasonVal}" selected>${reasonVal}</option>` : ''}
                </select>
            `;

            if (evalData.type === 'check') {
                const isChecked = rec.checked ? 'checked' : '';
                inputUI = `
                    <div style="display:flex; align-items:center; gap:10px;">
                        <input type="checkbox" onchange="window.EvaluationManager.updateRecord('${evalData.id}', ${st.num}, 'checked', this.checked)" ${isChecked} style="width:20px; height:20px; accent-color:#2563eb; cursor:pointer;">
                        ${reasonSelect}
                    </div>`;
            } else if (evalData.type === 'memo') {
                inputUI = `<input type="text" value="${rec.memo || ''}" onchange="window.EvaluationManager.updateRecord('${evalData.id}', ${st.num}, 'memo', this.value)" placeholder="내용 입력" style="flex:1; padding:4px 8px; border:1px solid #cbd5e1; border-radius:4px; outline:none;">`;
            } else {
                let indivHtml = '', groupHtml = '';
                
                if (isIndiv) {
                    let curIndiv = rec.indivScore || rec.score || '';
                    let btns = evalData.steps.map(step => {
                        const active = curIndiv === step;
                        return `<button onclick="window.EvaluationManager.updateRecord('${evalData.id}', ${st.num}, 'indivScore', '${step}')" style="padding:4px 6px; font-size:0.8rem; background:${active?'#10b981':'#f1f5f9'}; color:${active?'#fff':'#475569'}; border:1px solid #cbd5e1; border-radius:4px; cursor:pointer;">${step}</button>`;
                    }).join('');
                    indivHtml = `<div style="display:flex; align-items:center; gap:4px;"><span style="font-size:0.75rem; color:#64748b;">[개인]</span>${btns}</div>`;
                }
                if (isGroup) {
                    let curGroup = rec.groupScore || '';
                    let btns = evalData.steps.map(step => {
                        const active = curGroup === step;
                        return `<button onclick="window.EvaluationManager.updateRecord('${evalData.id}', ${st.num}, 'groupScore', '${step}')" style="padding:4px 6px; font-size:0.8rem; background:${active?'#f59e0b':'#f1f5f9'}; color:${active?'#fff':'#475569'}; border:1px solid #cbd5e1; border-radius:4px; cursor:pointer;">${step}</button>`;
                    }).join('');
                    groupHtml = `<div style="display:flex; align-items:center; gap:4px;"><span style="font-size:0.75rem; color:#64748b;">[조별]</span>${btns}</div>`;
                }

                const groupInput = isGroup ? `<input type="text" value="${rec.groupName || ''}" onchange="window.EvaluationManager.updateRecord('${evalData.id}', ${st.num}, 'groupName', this.value)" placeholder="조명" style="width:50px; padding:4px; border:1px solid #cbd5e1; border-radius:4px; text-align:center; font-size:0.8rem;">` : '';

                inputUI = `
                    <div style="display:flex; flex-direction:column; gap:4px; align-items:flex-end;">
                        <div style="display:flex; gap:8px; align-items:center;">
                            ${groupInput}
                            <div style="display:flex; flex-direction:column; gap:4px;">${groupHtml}${indivHtml}</div>
                            ${reasonSelect}
                        </div>
                    </div>
                `;
            }

            listHtml += `
                <div style="display:flex; align-items:center; padding:8px; border-bottom:1px solid #f1f5f9; gap:10px;">
                    <div style="width:80px; font-weight:bold; color:#475569;">${st.num}. ${st.name}</div>
                    <div style="flex:1; display:flex; justify-content:flex-end;">${inputUI}</div>
                </div>
            `;
        });

        const typeMap = { 'eval': '평가', 'check': '체크(O/X)', 'memo': '메모' };
        const displayType = typeMap[evalData.type] || evalData.type;

        // 🌟 [핵심 변경] 상단 제목 영역에 대상 명렬표 정보 표시 추가
        let classInfoStr = '';
        if (evalData.rosterMeta && evalData.rosterMeta.year) {
            classInfoStr = `<br><span style="color:#2563eb; font-size:0.85rem;">🧑‍🤝‍🧑 학급: ${evalData.rosterMeta.year}학년도 ${evalData.rosterMeta.grade}학년 ${evalData.rosterMeta.classNum}반</span>`;
        }

        let batchUI = '';
        if (evalData.type === 'check') {
            batchUI = `
                <div style="display:flex; align-items:center; justify-content:space-between; padding:8px; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:6px; margin-bottom:10px;">
                    <span style="font-weight:bold; color:#166534; font-size:0.9rem;">🚀 일괄 적용 (전체 학생)</span>
                    <div style="display:flex; gap:10px;">
                        <button onclick="window.EvaluationManager.batchUpdate('${evalData.id}', 'checked', true)" style="padding:4px 8px; font-size:0.85rem; background:#22c55e; color:#fff; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">전체 선택(O)</button>
                        <button onclick="window.EvaluationManager.batchUpdate('${evalData.id}', 'checked', false)" style="padding:4px 8px; font-size:0.85rem; background:#f1f5f9; color:#475569; border:1px solid #cbd5e1; border-radius:4px; cursor:pointer; font-weight:bold;">전체 해제(X)</button>
                    </div>
                </div>
            `;
        } else if (evalData.type === 'memo') {
            batchUI = `
                <div style="display:flex; align-items:center; justify-content:space-between; padding:8px; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:6px; margin-bottom:10px; gap:10px;">
                    <span style="font-weight:bold; color:#166534; font-size:0.9rem; white-space:nowrap;">🚀 일괄 적용 (전체 학생)</span>
                    <div style="display:flex; flex:1; gap:4px;">
                        <input type="text" id="batch-memo-input" placeholder="전체 학생에게 동일하게 입력할 내용" style="flex:1; padding:4px 8px; border:1px solid #cbd5e1; border-radius:4px; outline:none; font-size:0.85rem;">
                        <button onclick="window.EvaluationManager.batchUpdate('${evalData.id}', 'memo', document.getElementById('batch-memo-input').value)" style="padding:4px 12px; font-size:0.85rem; background:#22c55e; color:#fff; border:none; border-radius:4px; cursor:pointer; font-weight:bold; white-space:nowrap;">적용</button>
                    </div>
                </div>
            `;
        } else {
            let batchIndiv = '', batchGroup = '';
            if (isGroup) {
                let btns = evalData.steps.map(step => `<button onclick="window.EvaluationManager.batchUpdate('${evalData.id}', 'groupScore', '${step}')" style="padding:4px 8px; font-size:0.85rem; background:#fff; color:#b45309; border:1px solid #fcd34d; border-radius:4px; cursor:pointer; font-weight:bold;">${step}</button>`).join('');
                batchGroup = `<div style="display:flex; align-items:center; gap:4px;"><span style="font-size:0.75rem; color:#92400e; font-weight:bold;">[조별]</span>${btns}</div>`;
            }
            if (isIndiv) {
                let btns = evalData.steps.map(step => `<button onclick="window.EvaluationManager.batchUpdate('${evalData.id}', 'indivScore', '${step}')" style="padding:4px 8px; font-size:0.85rem; background:#fff; color:#047857; border:1px solid #6ee7b7; border-radius:4px; cursor:pointer; font-weight:bold;">${step}</button>`).join('');
                batchIndiv = `<div style="display:flex; align-items:center; gap:4px;"><span style="font-size:0.75rem; color:#166534; font-weight:bold;">[개인]</span>${btns}</div>`;
            }
            batchUI = `
                <div style="display:flex; align-items:center; justify-content:space-between; padding:8px; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:6px; margin-bottom:10px;">
                    <span style="font-weight:bold; color:#166534; font-size:0.9rem;">🚀 일괄 적용</span>
                    <div style="display:flex; flex-direction:column; gap:4px; align-items:flex-end;">
                        ${batchGroup}
                        ${batchIndiv}
                    </div>
                </div>
            `;
        }

        return `
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
                <div style="font-size:0.9rem; color:#64748b; font-weight:bold; line-height:1.4;">
                    유형: ${displayType} ${isEval ? ` | 교과: ${evalData.subject||'없음'} | 일시: ${evalData.dateStr}` : ''}
                    ${classInfoStr}
                </div>
                <button onclick="window.EvaluationManager.deleteEvaluation('${evalData.id}')" style="background:none; border:none; color:#ef4444; cursor:pointer; font-size:0.9rem; font-weight:bold; flex-shrink:0; margin-left:10px;">🗑️ 전체 삭제</button>
            </div>
            
            ${batchUI}

            <div id="eval-records-container" style="max-height:400px; overflow-y:auto; border:1px solid #e2e8f0; border-radius:6px; padding:10px; background:#fff;">
                ${listHtml}
            </div>
            <div style="text-align:right; margin-top:10px;">
                <span style="font-size:0.85rem; color:#10b981; font-weight:bold;">✅ 입력 시 자동으로 저장됩니다.</span>
            </div>
        `;
    },

    batchUpdate: async function(evalId, field, value) {
        const evalData = this.currentEvalList.find(e => e.id === evalId);
        if (!evalData) return;

        const students = evalData.studentsSnapshot || [];
        
        students.forEach(st => {
            if (!evalData.records[st.num]) evalData.records[st.num] = {};
            evalData.records[st.num][field] = value;
        });

        const container = document.getElementById('eval-records-container');
        let scrollTop = 0;
        if (container) scrollTop = container.scrollTop;

        const html = this.getViewerHtml(evalData);
        const modalBody = document.querySelector('#eval-viewer-modal .modal-body');
        if (modalBody) {
            modalBody.innerHTML = html;
            const newContainer = document.getElementById('eval-records-container');
            if (newContainer) newContainer.scrollTop = scrollTop;
        }

        dbAPI.saveEvaluations(this.currentDateStr, this.currentEvalList).catch(e => console.warn(e));
    },

    updateRecord: async function(evalId, studentNum, field, value) {
        const evalData = this.currentEvalList.find(e => e.id === evalId);
        if (!evalData) return;

        if (!evalData.records[studentNum]) evalData.records[studentNum] = {};
        
        if ((field === 'indivScore' || field === 'groupScore' || field === 'score') && evalData.records[studentNum][field] === value) {
            evalData.records[studentNum][field] = '';
        } else {
            evalData.records[studentNum][field] = value;
        }

        const container = document.getElementById('eval-records-container');
        let scrollTop = 0;
        if (container) scrollTop = container.scrollTop;

        const html = this.getViewerHtml(evalData);
        const modalBody = document.querySelector('#eval-viewer-modal .modal-body');
        if (modalBody) {
            modalBody.innerHTML = html;
            const newContainer = document.getElementById('eval-records-container');
            if (newContainer) newContainer.scrollTop = scrollTop;
        }

        dbAPI.saveEvaluations(this.currentDateStr, this.currentEvalList).catch(e => console.warn(e));
    },

    deleteEvaluation: async function(evalId) {
        if (!confirm("이 조사표를 완전히 삭제하시겠습니까?")) return;
        this.currentEvalList = this.currentEvalList.filter(e => e.id !== evalId);
        
        await dbAPI.saveEvaluations(this.currentDateStr, this.currentEvalList);
        
        const existingViewer = document.getElementById('eval-viewer-modal');
        if (existingViewer) existingViewer.remove();
        
        if (window.dayViewInstance && typeof window.dayViewInstance.refreshEvalBadges === 'function') {
            await window.dayViewInstance.refreshEvalBadges();
        } else if (typeof window.render === 'function') {
            window.render();
        }
    }
};

window.EvaluationManager = EvaluationManager;
