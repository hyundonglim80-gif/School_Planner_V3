// js/modules/evaluation.js
import { dbAPI } from '../api/database.js'; 
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

        const existingCreation = document.getElementById('eval-creation-modal');
        if (existingCreation) existingCreation.remove();

        this.creationModal = new window.Modal({
            id: 'eval-creation-modal',
            title: this.currentGroupId ? '새 조사표 생성 (공유됨)' : '새 조사표 생성 (개인)',
            width: '560px',
            content: this.getCreationHtml(defaultSubject)
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
        if (document.getElementById('eval-method-group')?.checked) this.renderDynamicGroups();
    },

    getCreationHtml: function(defaultSubject) {
        let rosterOptions = '<option value="">등록된 명렬표 없음 (먼저 등록해주세요)</option>';
        if (this.roster && this.roster.length > 0) {
             rosterOptions = this.roster.map((r, i) => `<option value="${i}">${r.year}학년도 ${r.grade}학년 ${r.classNum}반 (${r.students ? r.students.length : 0}명)</option>`).join('');
        }
        rosterOptions += `<option value="ADD_ROSTER" style="font-weight:bold; color:#475569;">새 학급(명렬표) 추가하기</option>`;

        const subjOptions = ['국어','도덕','사회','수학','과학','실과','체육','음악','미술','영어','창체'].map(s => `<option value="${s}" ${s===defaultSubject?'selected':''}>${s}</option>`).join('');

        const maxPeriod = store.periodNames ? store.periodNames.length : 6;
        let periodOptions = '';
        for (let i = 1; i <= maxPeriod; i++) {
            const isSelected = (this.currentContext.source === 'schedule' && String(this.currentContext.period) === String(i)) ? 'selected' : '';
            periodOptions += `<option value="${i}" ${isSelected}>${store.periodNames[i-1] || `${i}교시`}</option>`;
        }
        periodOptions += `<option value="journal" ${this.currentContext.source === 'journal' ? 'selected' : ''}>기록 (오늘 기록 칸)</option>`;

        const groupWarning = this.currentGroupId ? `<div class="eval-warning">안내: 공유 시간표에서 생성 중입니다. 데이터가 멤버에게 노출됩니다.</div>` : '';

        return `
            ${groupWarning}
            <div style="display:flex; flex-direction:column; max-height:60vh; overflow-y:auto; padding-right:5px; color:#334155;">
                
                <div class="eval-panel">
                    <div style="margin-bottom:12px;">
                        <label style="font-weight:bold; font-size:0.95rem; display:block; margin-bottom:6px;">적용할 명렬표 확인</label>
                        <select id="eval-roster" class="eval-input" onchange="window.EvaluationManager.handleRosterChange(this)">${rosterOptions}</select>
                    </div>
                    <div>
                        <label style="font-weight:bold; font-size:0.95rem; display:block; margin-bottom:6px;">조사표 제목</label>
                        <input type="text" id="eval-title" class="eval-input" placeholder="예: 1단원 평가, 준비물 체크">
                    </div>
                </div>

                <div class="eval-panel">
                    <div style="margin-bottom:15px;">
                        <label style="font-weight:bold; font-size:0.95rem; display:block; margin-bottom:8px;">유형 선택</label>
                        <div style="display:flex; gap:20px; background:#f8fafc; padding:10px; border-radius:4px;">
                            <label class="modal-checkbox-label"><input type="radio" name="eval-type" value="eval" checked onchange="window.EvaluationManager.toggleEvalType()" class="modal-checkbox"> 평가</label>
                            <label class="modal-checkbox-label"><input type="radio" name="eval-type" value="check" onchange="window.EvaluationManager.toggleEvalType()" class="modal-checkbox"> 체크(O/X)</label>
                            <label class="modal-checkbox-label"><input type="radio" name="eval-type" value="memo" onchange="window.EvaluationManager.toggleEvalType()" class="modal-checkbox"> 메모</label>
                        </div>
                    </div>

                    <div style="display:flex; gap:12px;">
                        <div style="flex:1;">
                            <label style="font-size:0.85rem; font-weight:bold; display:block; margin-bottom:4px;">교과</label>
                            <select id="eval-subject" class="eval-input" style="padding:8px;"><option value="">선택 안함</option>${subjOptions}</select>
                        </div>
                        <div style="flex:1;">
                            <label style="font-size:0.85rem; font-weight:bold; display:block; margin-bottom:4px;">날짜</label>
                            <input type="date" id="eval-date" class="eval-input" value="${this.currentDateStr}" style="padding:8px;">
                        </div>
                        <div style="flex:1;">
                            <label style="font-size:0.85rem; font-weight:bold; display:block; margin-bottom:4px;">위치(교시/기록)</label>
                            <select id="eval-period" class="eval-input" style="padding:8px;">${periodOptions}</select>
                        </div>
                    </div>
                </div>
                
                <div id="eval-detail-config" class="eval-panel" style="background:#f8fafc; gap:14px; display:flex; flex-direction:column;">
                    <div>
                        <label style="font-weight:bold; font-size:0.95rem; display:block; margin-bottom:8px;">평가 세부 설정 (중복 가능)</label>
                        <div style="display:flex; gap:15px; padding:10px; background:#fff; border-radius:4px; border:1px solid #e2e8f0;">
                            <label class="modal-checkbox-label"><input type="checkbox" id="eval-method-indiv" checked onchange="window.EvaluationManager.toggleMethod()" class="modal-checkbox"> 개인 평가</label>
                            <label class="modal-checkbox-label"><input type="checkbox" id="eval-method-group" onchange="window.EvaluationManager.toggleMethod()" class="modal-checkbox"> 조별 평가</label>
                        </div>
                    </div>

                    <div id="eval-group-settings" class="eval-panel" style="display:none; padding:12px; margin-bottom:0;">
                        <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px; border-bottom:1px solid #f1f5f9; padding-bottom:10px;">
                            <label style="font-size:0.9rem; font-weight:bold;">조 갯수 설정:</label>
                            <input type="number" id="eval-group-count" class="eval-input-small" value="4" min="1" max="20" onchange="window.EvaluationManager.renderDynamicGroups()" style="width:60px;">
                        </div>
                        <div id="eval-group-list" style="display:flex; flex-direction:column; gap:8px;"></div>
                    </div>

                    <div id="eval-step-settings" class="eval-panel" style="padding:12px; margin-bottom:0;">
                        <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px; border-bottom:1px solid #f1f5f9; padding-bottom:10px;">
                            <label style="font-size:0.9rem; font-weight:bold;">평가 단계 수:</label>
                            <select id="eval-step-count" class="eval-input-small" onchange="window.EvaluationManager.renderDynamicSteps()">
                                <option value="2">2단계</option><option value="3" selected>3단계</option><option value="4">4단계</option><option value="5">5단계</option>
                            </select>
                        </div>
                        <div id="eval-step-list" style="display:flex; gap:8px; flex-wrap:wrap;"></div>
                    </div>
                </div>
            </div>

            <div class="modal-footer-actions">
                <button onclick="document.getElementById('eval-creation-modal').remove()" class="modal-btn-secondary" style="background:#f1f5f9; color:#475569; margin-right:10px;">취소</button>
                <button onclick="window.EvaluationManager.createEvaluation()" class="modal-btn-primary">생성 완료</button>
            </div>
        `;
    },

    toggleEvalType: function() {
        const type = document.querySelector('input[name="eval-type"]:checked').value;
        const configDiv = document.getElementById('eval-detail-config');
        if (type === 'eval') { configDiv.style.display = 'flex'; this.toggleMethod(); } 
        else { configDiv.style.display = 'none'; }
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

        const totalStudents = activeStudents.length; let currentIdx = 0; let html = '';
        for(let i=0; i<count; i++) {
            const defaultName = String.fromCharCode(65 + i) + '조';
            let membersStr = '';
            if (totalStudents > 0) {
                const groupSize = Math.floor(totalStudents / count) + (i < (totalStudents % count) ? 1 : 0);
                const members = [];
                for(let j=0; j<groupSize; j++) { if (currentIdx < totalStudents) members.push(activeStudents[currentIdx++].num); }
                membersStr = members.join(', ');
            }
            html += `<div style="display:flex; gap:8px; align-items:center;"><input type="text" id="eval-gname-${i}" class="eval-input-small" value="${defaultName}" style="width:80px;"><input type="text" id="eval-gmembers-${i}" class="eval-input" value="${membersStr}" placeholder="조원 번호 (예: 1, 2, 3)" style="padding:6px 10px;"></div>`;
        }
        document.getElementById('eval-group-list').innerHTML = html;
    },

    renderDynamicSteps: function() {
        const count = parseInt(document.getElementById('eval-step-count').value, 10) || 3;
        const defaults = ['우수', '보통', '노력요함', '미흡', '매우미흡'];
        let html = '';
        for(let i=0; i<count; i++) {
            html += `<input type="text" id="eval-step-name-${i}" class="eval-input-small" value="${defaults[i] || `단계${i+1}`}">`;
        }
        document.getElementById('eval-step-list').innerHTML = html;
    },

    createEvaluation: async function() {
        const title = document.getElementById('eval-title').value.trim();
        if (!title) return alert("제목을 입력하세요.");

        const rosterIndex = document.getElementById('eval-roster').value;
        if (!rosterIndex || rosterIndex === 'ADD_ROSTER') return alert("적용할 명렬표를 선택해주세요.");

        const type = document.querySelector('input[name="eval-type"]:checked').value;
        const subject = document.getElementById('eval-subject').value;
        const dateStr = document.getElementById('eval-date').value || this.currentDateStr;
        const selectedPeriodVal = document.getElementById('eval-period').value;
        
        let finalSource = selectedPeriodVal === 'journal' ? 'journal' : 'schedule';
        let finalPeriod = selectedPeriodVal === 'journal' ? '' : parseInt(selectedPeriodVal, 10);
        let methodObj = { indiv: false, group: false }; let steps = [], groups = [];

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
            dateStr, periodStr: finalPeriod, context: { source: finalSource, period: finalPeriod },
            rosterMeta: { year: selectedRoster.year, grade: selectedRoster.grade, classNum: selectedRoster.classNum },
            studentsSnapshot, records: {} 
        };

        this.currentEvalList.push(newEval);
        await dbAPI.saveEvaluations(dateStr, this.currentEvalList, this.currentGroupId);
        document.getElementById('eval-creation-modal').remove();

        if (window.dayViewInstance && window.dayViewInstance.dateStr === dateStr) window.dayViewInstance.refreshEvalBadges();
        this.openViewer(dateStr, newEval.id);
    },

    applyToAll: function(field, value) {
        const table = document.getElementById('eval-viewer-table');
        if (!table) return;
        table.querySelectorAll(`tbody [data-field="${field}"]`).forEach(inp => {
            if (inp.type === 'checkbox') inp.checked = value; else inp.value = value;
        });
    },

    openViewer: async function(dateStr, evalId) {
        this.currentDateStr = dateStr;
        this.currentEvalList = await dbAPI.loadEvaluations(dateStr, this.currentGroupId);
        
        const ev = this.currentEvalList.find(e => e.id === evalId);
        if (!ev) return alert("해당 평가 데이터를 찾을 수 없습니다.");

        // 🌟 수정 1: 전역 캐시에 의존하지 않고 항상 DB에서 최신 명렬표를 강제로 재로드하여 동기화 보장
        try { this.roster = await dbAPI.loadRoster(); } catch(e) { this.roster = []; }

        if (ev.rosterMeta && this.roster) {
            const matchedRoster = this.roster.find(r => r.year == ev.rosterMeta.year && r.grade == ev.rosterMeta.grade && r.classNum == ev.rosterMeta.classNum);
            if (matchedRoster) {
                let isChanged = false;
                const activeCurrent = matchedRoster.students || [];

                // 1. 신규 전입생 추가 및 이름 변경 반영
                activeCurrent.forEach(currSt => {
                    const existing = ev.studentsSnapshot.find(s => s.num === currSt.num);
                    if (!existing) {
                        ev.studentsSnapshot.push({ num: currSt.num, name: currSt.name, gender: currSt.gender });
                        isChanged = true;
                    } else {
                        if (existing.name !== currSt.name && !existing.name.includes('(전출/삭제됨)')) {
                            existing.name = currSt.name;
                            isChanged = true;
                        } else if (existing.name.includes('(전출/삭제됨)')) {
                            existing.name = currSt.name; 
                            isChanged = true;
                        }
                    }
                });

                // 2. 전출생(삭제된 학생) 기록 보호용 태그 추가
                ev.studentsSnapshot.forEach(snapSt => {
                    const stillExists = activeCurrent.find(s => s.num === snapSt.num && s.isActive !== false);
                    if (!stillExists && !snapSt.name.includes('(전출/삭제됨)')) {
                        snapSt.name = snapSt.name + ' (전출/삭제됨)';
                        isChanged = true;
                    }
                });

                if (isChanged) {
                    ev.studentsSnapshot.sort((a, b) => a.num - b.num);
                    const actualGroupId = (this.currentGroupId === 'personal' || this.currentGroupId === '') ? null : this.currentGroupId;
                    await dbAPI.saveEvaluations(dateStr, this.currentEvalList, actualGroupId); 
                }
            }
        }

        const actualGroupId = (this.currentGroupId === 'personal' || this.currentGroupId === '') ? null : this.currentGroupId;
        const uid = window.auth?.currentUser?.uid;
        const isAuthor = !actualGroupId || !ev.authorId || !uid || ev.authorId === uid;

        const isEval = ev.type === 'eval'; const isCheck = ev.type === 'check'; const isMemo = ev.type === 'memo';
        const isIndiv = isEval && ev.methodObj?.indiv; const isGroup = isEval && ev.methodObj?.group;

        let rowsHtml = '';
        const disabledAttr = isAuthor ? '' : 'disabled'; const readonlyAttr = isAuthor ? '' : 'readonly';

        ev.studentsSnapshot.forEach(st => {
            const rec = ev.records[st.num] || {};
            let inputsHtml = '';
            
            if (isEval) {
                if (isGroup) {
                    const studentGroup = ev.groups?.find(g => g.members.includes(st.num));
                    inputsHtml += `<td><input type="text" data-snum="${st.num}" data-field="groupName" value="${rec.groupName || (studentGroup ? studentGroup.name : '')}" style="width:40px; text-align:center;" ${readonlyAttr}></td>`;
                    inputsHtml += `<td><select data-snum="${st.num}" data-field="groupScore" ${disabledAttr}><option value=""></option>${ev.steps.map(s => `<option value="${s}" ${rec.groupScore===s?'selected':''}>${s}</option>`).join('')}</select></td>`;
                }
                if (isIndiv) {
                    inputsHtml += `<td><select data-snum="${st.num}" data-field="indivScore" ${disabledAttr}><option value=""></option>${ev.steps.map(s => `<option value="${s}" ${rec.indivScore===s?'selected':''}>${s}</option>`).join('')}</select></td>`;
                }
                inputsHtml += `<td><input type="text" data-snum="${st.num}" data-field="reason" value="${rec.reason || ''}" ${readonlyAttr}></td>`;
            } else if (isCheck) {
                inputsHtml += `<td><input type="checkbox" data-snum="${st.num}" data-field="checked" ${rec.checked ? 'checked' : ''} style="width:20px;height:20px; accent-color:#475569;" ${disabledAttr}></td>`;
                inputsHtml += `<td><input type="text" data-snum="${st.num}" data-field="reason" value="${rec.reason || ''}" ${readonlyAttr}></td>`;
            } else if (isMemo) {
                inputsHtml += `<td><input type="text" data-snum="${st.num}" data-field="memo" value="${rec.memo || ''}" ${readonlyAttr}></td>`;
            }

            const isExited = st.name.includes('(전출/삭제됨)');
            rowsHtml += `<tr style="${isExited ? 'background:#f1f5f9; color:#94a3b8;' : ''}"><td style="color:#475569; background:#f8fafc;">${st.num}</td><td style="color:${isExited ? '#94a3b8' : '#1e293b'};">${st.name}</td>${inputsHtml}</tr>`;
        });

        let headersHtml = `<th style="width:45px;">번호</th><th style="width:85px;">이름</th>`;
        let applyAllHtml = `<tr style="background:#f8fafc;"><td colspan="2" style="padding:8px; color:#475569; border:1px solid #e2e8f0; border-bottom:2px solid #cbd5e1; text-align:center; font-size:0.9rem;">전체 일괄 적용</td>`;

        if (isEval) {
            if (isGroup) {
                headersHtml += `<th>조이름</th><th>조별 결과</th>`;
                applyAllHtml += `<td><input type="text" placeholder="조이름" style="width:40px; text-align:center;" onchange="window.EvaluationManager.applyToAll('groupName', this.value)"></td>`;
                applyAllHtml += `<td><select onchange="window.EvaluationManager.applyToAll('groupScore', this.value)"><option value="">선택</option>${ev.steps.map(s => `<option value="${s}">${s}</option>`).join('')}</select></td>`;
            }
            if (isIndiv) {
                headersHtml += `<th>개별 결과</th>`;
                applyAllHtml += `<td><select onchange="window.EvaluationManager.applyToAll('indivScore', this.value)"><option value="">선택</option>${ev.steps.map(s => `<option value="${s}">${s}</option>`).join('')}</select></td>`;
            }
            headersHtml += `<th>사유 / 메모</th>`;
            applyAllHtml += `<td><input type="text" placeholder="일괄입력 후 Enter" onchange="window.EvaluationManager.applyToAll('reason', this.value)"></td>`;
        } else if (isCheck) {
            headersHtml += `<th>체크(O/X)</th><th>사유 / 메모</th>`;
            applyAllHtml += `<td><button onclick="window.EvaluationManager.applyToAll('checked', true)" class="modal-btn-secondary" style="margin-right:4px;">전체 O</button><button onclick="window.EvaluationManager.applyToAll('checked', false)" class="modal-btn-secondary" style="background:#94a3b8;">전체 X</button></td>`;
            applyAllHtml += `<td><input type="text" placeholder="일괄입력 후 Enter" onchange="window.EvaluationManager.applyToAll('reason', this.value)"></td>`;
        } else {
            headersHtml += `<th>개별 메모내용</th>`;
            applyAllHtml += `<td><input type="text" placeholder="메모 일괄입력 후 Enter" onchange="window.EvaluationManager.applyToAll('memo', this.value)"></td>`;
        }
        applyAllHtml += `</tr>`;

        const titleText = actualGroupId ? `${ev.title} (공유됨${isAuthor ? '' : ' - 읽기전용'})` : `${ev.title} (개인)`;
        const deleteBtnHtml = isAuthor ? `<button onclick="window.EvaluationManager.deleteEvaluation('${ev.id}')" class="modal-delete-btn" style="padding:10px 16px; border:1px solid #fca5a5; border-radius:6px;">삭제</button>` : `<div></div>`;
        const saveBtnHtml = isAuthor ? `<button onclick="window.EvaluationManager.saveViewerData('${ev.id}')" class="modal-btn-primary">저장</button>` : ''; 

        // 🌟 수정 2: 메타데이터 수정 UI 블럭 추가
        const metaEditHtml = isAuthor ? this.getMetaEditHtml(ev) : '';

        const html = `
            ${metaEditHtml}
            <div style="max-height:60vh; overflow-y:auto; padding-right:5px; border-radius:8px; border:1px solid #e2e8f0; background:#fff;">
                <table class="eval-table" id="eval-viewer-table">
                    <thead><tr>${headersHtml}</tr>${isAuthor ? applyAllHtml : ''}</thead>
                    <tbody>${rowsHtml}</tbody>
                </table>
            </div>
            <div class="modal-footer-actions" style="justify-content:space-between; border-top:none;">
                ${deleteBtnHtml}
                <div style="display:flex; gap:10px;">
                    <button onclick="document.getElementById('eval-viewer-modal').remove()" class="modal-btn-secondary" style="background:#f1f5f9; color:#475569;">닫기</button> 
                    ${saveBtnHtml}
                </div>
            </div>
        `;

        if (this.viewerModal) document.getElementById('eval-viewer-modal')?.remove();
        this.viewerModal = new window.Modal({ id: 'eval-viewer-modal', title: titleText, width: '680px', content: html });
        this.viewerModal.open();
    },

    // 🌟 수정된 함수: 메타데이터 수정 블럭 생성 (학급 정보 추가)
    getMetaEditHtml: function(ev) {
        const subjOptions = ['국어','도덕','사회','수학','과학','실과','체육','음악','미술','영어','창체'].map(s => `<option value="${s}" ${s===ev.subject?'selected':''}>${s}</option>`).join('');
        
        const maxPeriod = store.periodNames ? store.periodNames.length : 6;
        let periodOptions = '';
        for (let i = 1; i <= maxPeriod; i++) {
            const isSelected = (ev.context.source === 'schedule' && String(ev.periodStr) === String(i)) ? 'selected' : '';
            periodOptions += `<option value="${i}" ${isSelected}>${store.periodNames[i-1] || `${i}교시`}</option>`;
        }
        periodOptions += `<option value="journal" ${ev.context.source === 'journal' ? 'selected' : ''}>기록 (오늘 기록 칸)</option>`;

        // 학급(명렬표) 옵션 렌더링
        let rosterOptions = '<option value="">명렬표 선택</option>';
        if (this.roster && this.roster.length > 0) {
            rosterOptions = this.roster.map((r, i) => {
                const isSelected = (ev.rosterMeta && ev.rosterMeta.year == r.year && ev.rosterMeta.grade == r.grade && ev.rosterMeta.classNum == r.classNum) ? 'selected' : '';
                return `<option value="${i}" ${isSelected}>${r.year}학년도 ${r.grade}학년 ${r.classNum}반 (${r.students ? r.students.length : 0}명)</option>`;
            }).join('');
        }

        return `
            <div style="margin-bottom:15px; border:1px solid #cbd5e1; border-radius:6px; background:#f8fafc; padding:12px;">
                <div style="display:flex; justify-content:space-between; align-items:center; cursor:pointer;" onclick="const d=document.getElementById('eval-meta-edit-panel'); d.style.display=d.style.display==='none'?'flex':'none';">
                    <span style="font-weight:bold; color:#1e40af; font-size:0.95rem;">⚙️ 기본 정보 수정</span>
                    <span style="color:#64748b; font-size:0.85rem;">▼ 펼치기</span>
                </div>
                <div id="eval-meta-edit-panel" style="display:none; flex-direction:column; gap:10px; margin-top:12px; border-top:1px dashed #cbd5e1; padding-top:12px;">
                    <div style="display:flex; gap:10px;">
                        <div style="flex:1;">
                            <label style="font-size:0.85rem; font-weight:bold; color:#475569; display:block; margin-bottom:4px;">조사표 제목</label>
                            <input type="text" id="edit-eval-title" value="${ev.title}" class="eval-input" style="padding:6px 10px;">
                        </div>
                        <div style="flex:1;">
                            <label style="font-size:0.85rem; font-weight:bold; color:#475569; display:block; margin-bottom:4px;">대상 학급(명렬표)</label>
                            <select id="edit-eval-roster" class="eval-input" style="padding:6px 10px;">${rosterOptions}</select>
                        </div>
                    </div>
                    <div style="display:flex; gap:10px;">
                        <div style="flex:1;">
                            <label style="font-size:0.85rem; font-weight:bold; color:#475569; display:block; margin-bottom:4px;">날짜</label>
                            <input type="date" id="edit-eval-date" value="${ev.dateStr}" class="eval-input" style="padding:6px 10px;">
                        </div>
                        <div style="flex:1;">
                            <label style="font-size:0.85rem; font-weight:bold; color:#475569; display:block; margin-bottom:4px;">위치</label>
                            <select id="edit-eval-period" class="eval-input" style="padding:6px 10px;">${periodOptions}</select>
                        </div>
                        <div style="flex:1;">
                            <label style="font-size:0.85rem; font-weight:bold; color:#475569; display:block; margin-bottom:4px;">교과</label>
                            <select id="edit-eval-subject" class="eval-input" style="padding:6px 10px;"><option value="">선택 안함</option>${subjOptions}</select>
                        </div>
                    </div>
                    <div style="text-align:right; margin-top:4px;">
                        <button onclick="window.EvaluationManager.saveMetaData('${ev.id}')" style="background:#2563eb; color:#fff; border:none; padding:6px 15px; border-radius:4px; font-weight:bold; cursor:pointer;">정보 업데이트</button>
                    </div>
                </div>
            </div>
        `;
    },

    // 🌟 수정된 함수: 메타데이터 업데이트 실행 (학급 변경 로직 포함)
    saveMetaData: async function(evalId) {
        const ev = this.currentEvalList.find(e => e.id === evalId);
        if (!ev) return;

        const newTitle = document.getElementById('edit-eval-title').value.trim();
        const newDate = document.getElementById('edit-eval-date').value;
        const newPeriodVal = document.getElementById('edit-eval-period').value;
        const newSubject = document.getElementById('edit-eval-subject').value;
        const newRosterIdx = document.getElementById('edit-eval-roster').value;

        if (!newTitle) return alert("제목을 입력하세요.");
        if (!newRosterIdx) return alert("대상 학급을 선택해주세요.");

        const selectedRoster = this.roster[parseInt(newRosterIdx, 10)];
        const isRosterChanged = !ev.rosterMeta || 
                                ev.rosterMeta.year != selectedRoster.year || 
                                ev.rosterMeta.grade != selectedRoster.grade || 
                                ev.rosterMeta.classNum != selectedRoster.classNum;

        // 학급이 변경되었을 경우 경고 및 데이터 스냅샷 교체 처리
        if (isRosterChanged) {
            if (!confirm("대상 학급을 변경하면 새 학급의 학생 명단으로 교체됩니다.\n(※ 기존에 입력된 평가 기록 중 번호가 일치하지 않는 학생의 데이터는 보이지 않게 됩니다.)\n정말 변경하시겠습니까?")) {
                return;
            }
            ev.rosterMeta = { year: selectedRoster.year, grade: selectedRoster.grade, classNum: selectedRoster.classNum };
            ev.studentsSnapshot = selectedRoster.students.filter(s => s.isActive !== false).map(s => ({ num: s.num, name: s.name, gender: s.gender }));
        }

        ev.title = newTitle;
        ev.subject = newSubject;
        
        // 날짜가 변경되었을 경우 데이터 이동 처리
        if (ev.dateStr !== newDate) {
            const actualGroupId = (this.currentGroupId === 'personal' || this.currentGroupId === '') ? null : this.currentGroupId;
            
            // 1. 기존 날짜에서 제거 및 저장
            this.currentEvalList = this.currentEvalList.filter(e => e.id !== evalId);
            await dbAPI.saveEvaluations(this.currentDateStr, this.currentEvalList, actualGroupId);
            
            // 2. 새 날짜로 데이터 세팅
            ev.dateStr = newDate;
            ev.periodStr = newPeriodVal === 'journal' ? '' : parseInt(newPeriodVal, 10);
            ev.context.source = newPeriodVal === 'journal' ? 'journal' : 'schedule';
            ev.context.period = ev.periodStr;

            // 3. 새 날짜에 데이터 로드 후 병합 저장
            const newDateList = await dbAPI.loadEvaluations(newDate, actualGroupId);
            newDateList.push(ev);
            await dbAPI.saveEvaluations(newDate, newDateList, actualGroupId);

            document.getElementById('eval-viewer-modal')?.remove();
            if (window.dayViewInstance && window.dayViewInstance.dateStr === this.currentDateStr) window.dayViewInstance.refreshEvalBadges();
            
            // 4. 새 날짜 기준으로 뷰어 다시 열기
            this.openViewer(newDate, evalId);
            if (window.showToast) window.showToast("날짜와 정보가 변경되어 이동되었습니다.");
        } else {
            ev.periodStr = newPeriodVal === 'journal' ? '' : parseInt(newPeriodVal, 10);
            ev.context.source = newPeriodVal === 'journal' ? 'journal' : 'schedule';
            ev.context.period = ev.periodStr;

            const actualGroupId = (this.currentGroupId === 'personal' || this.currentGroupId === '') ? null : this.currentGroupId;
            await dbAPI.saveEvaluations(this.currentDateStr, this.currentEvalList, actualGroupId);
            
            if (window.dayViewInstance && window.dayViewInstance.dateStr === this.currentDateStr) window.dayViewInstance.refreshEvalBadges();
            document.getElementById('eval-viewer-modal')?.remove();
            this.openViewer(this.currentDateStr, evalId);
            
            const msg = isRosterChanged ? "학급 및 기본 정보가 업데이트 되었습니다." : "기본 정보가 업데이트 되었습니다.";
            if (window.showToast) window.showToast(msg);
        }
    },

    saveViewerData: async function(evalId) {
        const ev = this.currentEvalList.find(e => e.id === evalId);
        if (!ev) return;
        const actualGroupId = (this.currentGroupId === 'personal' || this.currentGroupId === '') ? null : this.currentGroupId;

        const table = document.getElementById('eval-viewer-table');
        if (!table) return;

        ev.records = {};
        table.querySelectorAll('tbody input, tbody select').forEach(inp => {
            const sNum = parseInt(inp.getAttribute('data-snum'), 10);
            if (isNaN(sNum)) return;
            let val = inp.type === 'checkbox' ? inp.checked : inp.value.trim();
            if (inp.type !== 'checkbox' && !val) return; 

            if (!ev.records[sNum]) ev.records[sNum] = {};
            ev.records[sNum][inp.getAttribute('data-field')] = val;
        });

        await dbAPI.saveEvaluations(this.currentDateStr, this.currentEvalList, actualGroupId);
        
        if (window.dayViewInstance && window.dayViewInstance.dateStr === this.currentDateStr) window.dayViewInstance.refreshEvalBadges();
        
        if (window.showToast) window.showToast("성공적으로 저장되었습니다.");
        else alert("✅ 성공적으로 저장되었습니다.");
    },

    deleteEvaluation: async function(evalId) {
        if (!confirm("정말 이 조사표를 완전히 삭제하시겠습니까?")) return;
        const actualGroupId = (this.currentGroupId === 'personal' || this.currentGroupId === '') ? null : this.currentGroupId;
        
        this.currentEvalList = this.currentEvalList.filter(e => e.id !== evalId);
        await dbAPI.saveEvaluations(this.currentDateStr, this.currentEvalList, actualGroupId);
        document.getElementById('eval-viewer-modal')?.remove();
        if (window.dayViewInstance && window.dayViewInstance.dateStr === this.currentDateStr) window.dayViewInstance.refreshEvalBadges();
    }
};

window.EvaluationManager = EvaluationManager;