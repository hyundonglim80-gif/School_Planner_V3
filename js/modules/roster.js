//js/modules/roster.js

import { dbAPI } from '../firebase.js';

export const RosterManager = {
    modalInstance: null,
    rosterList: [],
    currentIndex: 0,

    openModal: async function() {
        this.rosterList = await dbAPI.loadRoster();
        if (!this.rosterList || this.rosterList.length === 0) {
            this.rosterList = [{ year: new Date().getFullYear(), grade: '', classNum: '', students: [] }];
        }
        this.currentIndex = 0;

        const html = this.getModalHtml();

        const existing = document.getElementById('roster-modal');
        if (existing) existing.remove();

        this.modalInstance = new window.Modal({
            id: 'roster-modal',
            title: '🧑‍🤝‍🧑 학급 정보(명렬표) 관리',
            width: '600px',
            content: html
        });

        this.modalInstance.open();
        this.renderCurrentClass();
    },

    getModalHtml: function() {
        return `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; background:#e0f2fe; padding:10px; border-radius:8px; border:1px solid #bfdbfe;">
                <select id="roster-class-selector" onchange="window.RosterManager.changeClass(this.value)" style="padding:8px; font-weight:bold; outline:none; border-radius:4px; border:1px solid #93c5fd; color:#1e40af; flex:1; margin-right:10px;">
                </select>
                <div style="display:flex; gap:6px;">
                    <button onclick="window.RosterManager.addNewClass()" style="background:#2563eb; color:white; border:none; padding:6px 12px; border-radius:4px; font-weight:bold; cursor:pointer;" title="새로운 학급을 추가합니다.">+ 학급 추가</button>
                    <button onclick="window.RosterManager.deleteCurrentClass()" style="background:#ef4444; color:white; border:none; padding:6px 12px; border-radius:4px; font-weight:bold; cursor:pointer;" title="현재 화면에 열려있는 학급을 삭제합니다.">삭제</button>
                </div>
            </div>

            <div style="background:#f8fafc; padding:15px; border-radius:8px; border:1px solid #e2e8f0; margin-bottom:15px;">
                <div style="display:flex; gap:10px; align-items:center;">
                    <input type="number" id="roster-year" placeholder="학년도" onchange="window.RosterManager.updateClassMeta()" style="width:80px; padding:8px; border:1px solid #cbd5e1; border-radius:4px; outline:none;"> <span>학년도</span>
                    <input type="number" id="roster-grade" placeholder="학년" onchange="window.RosterManager.updateClassMeta()" style="width:60px; padding:8px; border:1px solid #cbd5e1; border-radius:4px; outline:none;"> <span>학년</span>
                    <input type="text" id="roster-class" placeholder="반/이름" onchange="window.RosterManager.updateClassMeta()" style="width:70px; padding:8px; border:1px solid #cbd5e1; border-radius:4px; outline:none;"> <span>반</span>
                </div>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <h4 style="margin:0; color:#0f172a;">📋 학생 명단</h4>
                <div style="display:flex; gap:6px; align-items:center;">
                    <input type="number" id="roster-add-count" placeholder="명수" min="1" style="width:60px; padding:4px; border:1px solid #cbd5e1; border-radius:4px; outline:none; text-align:center;" onkeydown="if(event.key==='Enter') window.RosterManager.addStudent()">
                    <button onclick="window.RosterManager.addStudent()" style="background:#f1f5f9; color:#475569; border:1px solid #cbd5e1; padding:4px 12px; border-radius:4px; cursor:pointer; font-size:0.9rem; font-weight:bold;">+ 학생 추가</button>
                </div>
            </div>

            <div id="roster-student-list" style="max-height:300px; overflow-y:auto; border:1px solid #e2e8f0; border-radius:8px; padding:10px; background:#fff;">
            </div>

            <div class="modal-footer-actions" style="margin-top:20px; display:flex; justify-content:flex-end; gap:10px;">
                <button onclick="window.RosterManager.modalInstance.close()" style="padding:10px 20px; border:none; background:#f1f5f9; color:#475569; border-radius:6px; font-weight:bold; cursor:pointer;">취소</button>
                <button onclick="window.RosterManager.saveRoster(event)" style="padding:10px 20px; border:none; background:#10b981; color:#fff; border-radius:6px; font-weight:bold; cursor:pointer;" title="명렬표 정보를 저장합니다.">저장 및 적용</button>
            </div>
        `;
    },

    renderCurrentClass: function() {
        const currentRoster = this.rosterList[this.currentIndex];
        if (!currentRoster.students) currentRoster.students = [];

        const selector = document.getElementById('roster-class-selector');
        if (selector) {
            selector.innerHTML = this.rosterList.map((r, i) => {
                const y = r.year || '?';
                const g = r.grade || '?';
                const c = r.classNum || '?';
                return `<option value="${i}" ${i === this.currentIndex ? 'selected' : ''}>${y}학년도 ${g}학년 ${c}반</option>`;
            }).join('');
        }

        const yInput = document.getElementById('roster-year');
        const gInput = document.getElementById('roster-grade');
        const cInput = document.getElementById('roster-class');
        if (yInput) yInput.value = currentRoster.year || '';
        if (gInput) gInput.value = currentRoster.grade || '';
        if (cInput) cInput.value = currentRoster.classNum || '';

        this.renderStudentList();
    },

    updateClassMeta: function() {
        const y = document.getElementById('roster-year').value.trim();
        const g = document.getElementById('roster-grade').value.trim();
        const c = document.getElementById('roster-class').value.trim();
        
        this.rosterList[this.currentIndex].year = y;
        this.rosterList[this.currentIndex].grade = g;
        this.rosterList[this.currentIndex].classNum = c;

        const selector = document.getElementById('roster-class-selector');
        if (selector && selector.options[this.currentIndex]) {
            selector.options[this.currentIndex].text = `${y || '?'}학년도 ${g || '?'}학년 ${c || '?'}반`;
        }
    },

    changeClass: function(index) {
        this.currentIndex = parseInt(index, 10);
        this.renderCurrentClass();
    },

    addNewClass: function() {
        this.rosterList.push({ year: new Date().getFullYear(), grade: '', classNum: '', students: [] });
        this.currentIndex = this.rosterList.length - 1;
        this.renderCurrentClass();
    },

    deleteCurrentClass: function() {
        if (!confirm("현재 선택된 학급 명렬표를 완전히 삭제하시겠습니까?\\n(이 작업은 하단 '저장' 버튼을 누르면 최종 반영됩니다.)")) return;
        this.rosterList.splice(this.currentIndex, 1);
        
        if (this.rosterList.length === 0) {
            this.rosterList.push({ year: new Date().getFullYear(), grade: '', classNum: '', students: [] });
        }
        this.currentIndex = 0;
        this.renderCurrentClass();
    },

    renderStudentList: function() {
        const container = document.getElementById('roster-student-list');
        const currentStudents = this.rosterList[this.currentIndex].students;
        
        if (!container) return;

        if (currentStudents.length === 0) {
            container.innerHTML = '<div style="text-align:center; color:#94a3b8; padding:20px;">등록된 학생이 없습니다. 우측 상단에서 직접 추가하세요.</div>';
            return;
        }

        container.innerHTML = currentStudents.map((st, idx) => `
            <div style="display:flex; gap:10px; margin-bottom:8px; align-items:center; padding:8px; background:#f8fafc; border-radius:6px; border:1px solid #f1f5f9; ${st.isActive === false ? 'opacity:0.5;' : ''}">
                <input type="number" value="${st.num || ''}" placeholder="번호" onchange="window.RosterManager.updateStudent(${idx}, 'num', this.value)" style="width:60px; padding:6px; border:1px solid #cbd5e1; border-radius:4px; outline:none;">
                <input type="text" value="${st.name || ''}" placeholder="이름" onchange="window.RosterManager.updateStudent(${idx}, 'name', this.value)" style="flex:1; padding:6px; border:1px solid #cbd5e1; border-radius:4px; outline:none;">
                <select onchange="window.RosterManager.updateStudent(${idx}, 'gender', this.value)" style="padding:6px; border:1px solid #cbd5e1; border-radius:4px; outline:none;">
                    <option value="">성별</option>
                    <option value="M" ${st.gender === 'M' ? 'selected' : ''}>남</option>
                    <option value="F" ${st.gender === 'F' ? 'selected' : ''}>여</option>
                </select>
                <select onchange="window.RosterManager.updateStudent(${idx}, 'isActive', this.value === 'true')" style="padding:6px; border:1px solid #cbd5e1; border-radius:4px; outline:none;" title="재학/전출 상태 관리">
                    <option value="true" ${st.isActive !== false ? 'selected' : ''}>재학</option>
                    <option value="false" ${st.isActive === false ? 'selected' : ''}>전출</option>
                </select>
                <button onclick="window.RosterManager.removeStudent(${idx})" style="background:none; border:none; color:#ef4444; font-size:1.2rem; cursor:pointer; padding:0 4px;" title="명단에서 삭제">✖</button>
            </div>
        `).join('');
    },

    updateStudent: function(idx, field, value) {
        if (field === 'num') value = parseInt(value, 10) || '';
        this.rosterList[this.currentIndex].students[idx][field] = value;
        if (field === 'isActive') this.renderStudentList();
    },

    addStudent: function() {
        const countInput = document.getElementById('roster-add-count');
        let addCount = 1;
        
        if (countInput && countInput.value) {
            addCount = parseInt(countInput.value, 10);
            if (isNaN(addCount) || addCount < 1) addCount = 1;
        }

        for (let i = 0; i < addCount; i++) {
            const nextNum = this.rosterList[this.currentIndex].students.length + 1;
            this.rosterList[this.currentIndex].students.push({ num: nextNum, name: '000', gender: '', isActive: true });
        }

        if (countInput) countInput.value = ''; 

        this.renderStudentList();
        
        setTimeout(() => {
            const container = document.getElementById('roster-student-list');
            if (container) container.scrollTop = container.scrollHeight;
        }, 50);
    },

    removeStudent: function(idx) {
        const studentName = this.rosterList[this.currentIndex].students[idx].name;
        if(confirm(`'${studentName === '000' || !studentName ? '이 학생' : studentName}'을(를) 명단에서 완전히 삭제하시겠습니까?\\n※ 이미 진행된 평가가 있다면 전출(숨김) 처리를 권장합니다.`)) {
            this.rosterList[this.currentIndex].students.splice(idx, 1);
            this.renderStudentList();
        }
    },

    saveRoster: async function(event) {
        this.rosterList.forEach(roster => {
            roster.students = (roster.students || []).filter(st => st.name && st.name.trim() !== '');
        });

        this.rosterList = this.rosterList.filter(r => r.grade || r.classNum || (r.students && r.students.length > 0));
        
        if(this.rosterList.length === 0) {
             this.rosterList.push({ year: new Date().getFullYear(), grade: '', classNum: '', students: [] });
        }

        const btn = event.target;
        const oldText = btn.innerText;
        btn.innerText = "저장 및 구글 시트 연동 중...";
        btn.disabled = true;

        try {
            await dbAPI.saveRoster(this.rosterList);

            if (window.BackupManager && typeof window.BackupManager.createClassSheet === 'function') {
                for (const roster of this.rosterList) {
                    const year = roster.year;
                    const grade = roster.grade;
                    const classNum = roster.classNum;
                    const activeStudents = (roster.students || []).filter(st => st.name && st.name.trim() !== '' && st.isActive !== false);

                    if (year && grade && classNum && activeStudents.length > 0) {
                        await window.BackupManager.createClassSheet(year, grade, classNum, activeStudents);
                    }
                }
            }

            this.modalInstance.close();
            if (typeof window.render === 'function') window.render();
            alert("✅ 명렬표 저장 및 구글 시트 연동이 완료되었습니다.");
        } catch (e) {
            console.error(e);
            alert("명렬표 저장 중 오류가 발생했습니다.");
        } finally {
            btn.innerText = oldText;
            btn.disabled = false;
        }
    }
};

window.RosterManager = RosterManager;