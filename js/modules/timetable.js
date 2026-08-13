// js/modules/timetable.js

const TimetableModule = {
  modalInstance: null,
  
  // 현재 팝업창에서 편집 중인 시간표 데이터 메모리
  editingNames: [],
  editingData: { mon: {}, tue: {}, wed: {}, thu: {}, fri: {} },
  currentTemplateName: "1학기 시간표", 

  getContentHTML: function() {
    const days = ['mon', 'tue', 'wed', 'thu', 'fri'];
    const dayLabels = ['월', '화', '수', '목', '금'];
    
    // 💡 중앙 에디터 표 (테이블) 동적 생성 (UI 대폭 개선됨)  
    let tableHtml = `<table class="timetable-input-table" style="width:100%; border-collapse:collapse; text-align:center; margin-top:10px;">
      <thead>
        <tr style="background:#f8fafc; border-bottom:2px solid #cbd5e1;">
          <th style="padding:10px; color:#475569; width:110px; border-right:1px solid #e2e8f0;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span></span>
              <div style="display:flex; gap:4px;">

              </div>
            </div>
          </th>
          ${dayLabels.map(d => `<th style="padding:10px; color:#475569;">${d}</th>`).join('')}
        </tr>
      </thead>
      <tbody id="tt-editor-tbody">`;

    this.editingNames.forEach((pName, index) => {
      const p = index + 1;
      tableHtml += `<tr style="border-bottom:1px solid #e2e8f0;">
        <td style="padding:8px; border-right:1px solid #e2e8f0; background:#f8fafc;">
          <input type="text" value="${pName}" id="tt-name-${p}" onchange="TimetableModule.updatePeriodName(${index}, this.value)" style="width:100%; padding:8px 4px; border:1px dashed #94a3b8; border-radius:6px; text-align:center; font-weight:900; color:#475569; outline:none; background:#ffffff; font-size:0.95rem; cursor:text; box-shadow:inset 0 1px 2px rgba(0,0,0,0.05);" onfocus="this.style.border='1px solid #2563eb'" onblur="this.style.border='1px dashed #94a3b8'">
        </td>`;
      for (let d = 0; d < 5; d++) {
        const val = this.editingData[days[d]] ? (this.editingData[days[d]][p] || '') : '';
        tableHtml += `<td style="padding:8px; border:1px solid #f1f5f9;">
          <input type="text" id="tt-input-${days[d]}-${p}" value="${val}" placeholder="입력" onchange="TimetableModule.updateData('${days[d]}', ${p}, this.value)" style="width:100%; padding:10px 4px; border:1px solid #e2e8f0; border-radius:6px; text-align:center; font-weight:bold; color:#1e40af; outline:none; background:#f8fafc; font-size:1.05rem; transition:0.2s; cursor:text; box-shadow:inset 0 1px 2px rgba(0,0,0,0.02);" onfocus="this.style.background='#ffffcc'; this.style.borderColor='#fbbf24';" onblur="this.style.background='#f8fafc'; this.style.borderColor='#e2e8f0';">
        </td>`;
      }
      tableHtml += `</tr>`;
    });
    tableHtml += `</tbody></table>`;

    // 💡 등록된 템플릿 목록 불러오기
    let templateOptions = '';
    const tplKeys = Object.keys(window.timetableTemplates);
    if (tplKeys.length === 0) {
        templateOptions = `<option value="">저장된 시간표가 없습니다</option>`;
    } else {
        tplKeys.forEach(k => {
            templateOptions += `<option value="${k}" ${k === this.currentTemplateName ? 'selected' : ''}>📄 ${k}</option>`;
        });
    }

    return `
      <div class="modal-info-box" style="display:flex; justify-content:space-between; align-items:center; background:#eff6ff; border-left-color:#2563eb;">
        <div style="flex:1;">
          <h4 style="margin:0 0 6px 0; color:#1e40af;">📅 학사일정 (학기) 설정</h4>
          <div style="display:flex; flex-direction:column; gap:6px; font-size:0.9rem; font-weight:bold; color:#475569;">
              <div style="display:flex; align-items:center; gap:8px;">
                  <span style="width:50px;">1학기:</span>
                  <input type="date" id="tt-sem1-start" style="padding:4px; border:1px solid #cbd5e1; border-radius:4px; outline:none;"> ~ 
                  <input type="date" id="tt-sem1-end" style="padding:4px; border:1px solid #cbd5e1; border-radius:4px; outline:none;">
              </div>
              <div style="display:flex; align-items:center; gap:8px;">
                  <span style="width:50px;">2학기:</span>
                  <input type="date" id="tt-sem2-start" style="padding:4px; border:1px solid #cbd5e1; border-radius:4px; outline:none;"> ~ 
                  <input type="date" id="tt-sem2-end" style="padding:4px; border:1px solid #cbd5e1; border-radius:4px; outline:none;">
              </div>
          </div>
        </div>
        <button onclick="TimetableModule.saveSemesterDates()" class="modal-btn-secondary" style="height:100%; margin-left:10px;">학사일정<br>저장</button>
      </div>

      <div class="modal-info-box alt" style="padding-bottom:15px; border-top:2px solid #e2e8f0; margin-top:0;">
        <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:10px; gap:10px;">
          <div style="flex:1;">
            <span style="font-weight:bold; color:#1e293b; font-size:0.9rem; display:block; margin-bottom:4px;">저장된 시간표 목록</span>
            <div style="display:flex; gap:6px;">
                <select id="tt-template-select" style="flex:1; padding:8px; border-radius:6px; border:1px solid #cbd5e1; font-size:0.95rem; font-weight:bold; color:#1e40af; outline:none;">
                    ${templateOptions}
                </select>
                <button onclick="TimetableModule.loadSelectedTemplate()" style="background:#f1f5f9; color:#334155; border:1px solid #cbd5e1; padding:0 12px; border-radius:6px; font-weight:bold; cursor:pointer;">불러오기</button>
            </div>
          </div>
          <div style="display:flex; flex-direction:column; gap:4px; align-items:flex-end;">
            <button onclick="TimetableModule.saveAsNewTemplate()" style="background:#2563eb; color:#fff; border:none; padding:8px 12px; border-radius:6px; font-weight:bold; cursor:pointer; font-size:0.9rem; box-shadow:0 1px 2px rgba(0,0,0,0.1);">💾 현재 표를 새로 저장 (이름 지정)</button>
            <button onclick="TimetableModule.deleteSelectedTemplate()" style="background:transparent; color:#ef4444; border:none; padding:4px 8px; font-weight:bold; cursor:pointer; font-size:0.8rem; text-decoration:underline;">현재 선택된 템플릿 삭제</button>
          </div>
        </div>

        <div style="overflow-x:auto; border-radius:8px; background:#fff; margin-bottom:10px;">
          ${tableHtml}
        </div>
        
        <div style="display:flex; justify-content:center; gap:10px;">
            <button onclick="TimetableModule.addRow()" style="background:#f8fafc; border:1px dashed #94a3b8; color:#334155; padding:6px 16px; border-radius:6px; font-weight:bold; cursor:pointer; font-size:0.9rem;">➕ 교시 추가</button>
            <button onclick="TimetableModule.removeRow()" style="background:#fff1f2; border:1px dashed #fca5a5; color:#e11d48; padding:6px 16px; border-radius:6px; font-weight:bold; cursor:pointer; font-size:0.9rem;">➖ 맨 아래 삭제</button>
        </div>
      </div>

      <div class="modal-info-box" style="border-left-color:#10b981; background:#ecfdf5; margin-top:0;">
        <h4 style="margin:0 0 10px 0; color:#047857; border-bottom:1px solid #a7f3d0; padding-bottom:5px;">🚀 시간표 달력에 적용하기 (위에 표시된 표가 그대로 복사됩니다)</h4>
        
        <div style="display:flex; gap:10px; margin-bottom:12px;">
          <button onclick="TimetableModule.setApplyDates('sem1')" style="flex:1; background:#fff; color:#059669; border:2px solid #10b981; padding:8px; border-radius:8px; font-weight:bold; cursor:pointer; font-size:0.95rem;">👉 1학기 기간 셋팅</button>
          <button onclick="TimetableModule.setApplyDates('sem2')" style="flex:1; background:#fff; color:#059669; border:2px solid #10b981; padding:8px; border-radius:8px; font-weight:bold; cursor:pointer; font-size:0.95rem;">👉 2학기 기간 셋팅</button>
        </div>

        <div style="display:flex; align-items:center; gap:10px; background:#fff; padding:10px 15px; border-radius:8px; border:1px solid #a7f3d0;">
          <span style="font-weight:bold; color:#047857;">기간:</span>
          <input type="date" id="tt-apply-start" style="padding:8px; border:1px solid #cbd5e1; border-radius:4px; outline:none; flex:1;">
          <span style="font-weight:bold; color:#64748b;">~</span>
          <input type="date" id="tt-apply-end" style="padding:8px; border:1px solid #cbd5e1; border-radius:4px; outline:none; flex:1;">
          <button onclick="TimetableModule.applyTimetableToCalendar()" style="background:#047857; color:#fff; border:none; padding:8px 16px; border-radius:6px; font-weight:bold; cursor:pointer; box-shadow:0 1px 2px rgba(0,0,0,0.2); font-size:1.05rem;">이 기간에 덮어쓰기</button>
        </div>
      </div>
    `;
  },

  open: async function() {
    if (!this.modalInstance) {
      this.modalInstance = new window.Modal({
        id: 'timetable-modal-v5',
        title: '🗓️ 시간표 마스터 모듈',
        width: '750px',
        content: '<div id="timetable-master-content"></div>' // 껍데기만 먼저 만듦
      });
    }
    
    const dropdown = document.getElementById('more-dropdown');
    if (dropdown) dropdown.classList.add('hidden');

    this.modalInstance.open();
    
    // 데이터 로드 및 초기화
    if (Object.keys(window.timetableTemplates).length === 0) {
        // 처음 접속한 유저를 위한 기초 템플릿 생성
        window.timetableTemplates["1학기 시간표"] = { names: [...window.periodNames], data: {} };
        window.timetableTemplates["2학기 시간표"] = { names: [...window.periodNames], data: {} };
        this.currentTemplateName = "1학기 시간표";
    } else {
        this.currentTemplateName = Object.keys(window.timetableTemplates)[0];
    }
    
    this.loadTemplateToEditor(this.currentTemplateName);
    this.refreshModalContent();

    // 상단 학사일정 Input에 값 채우기
    document.getElementById('tt-sem1-start').value = window.semesterConfig.sem1Start || '';
    document.getElementById('tt-sem1-end').value = window.semesterConfig.sem1End || '';
    document.getElementById('tt-sem2-start').value = window.semesterConfig.sem2Start || '';
    document.getElementById('tt-sem2-end').value = window.semesterConfig.sem2End || '';
  },

  refreshModalContent: function() {
      const container = document.getElementById('timetable-master-content');
      if (container) container.innerHTML = this.getContentHTML();
  },

  // -----------------------------------------
  // 에디터(표) 기능
  // -----------------------------------------
  updatePeriodName: function(index, value) {
      this.editingNames[index] = value.trim() || `${index+1}교시`;
  },
  updateData: function(day, period, value) {
      if (!this.editingData[day]) this.editingData[day] = {};
      this.editingData[day][period] = value.trim();
  },
  addRow: function() {
      this.editingNames.push(`${this.editingNames.length + 1}교시`);
      this.refreshModalContent();
  },
  removeRow: function() {
      if (this.editingNames.length <= 1) return alert("최소 1줄의 시간표는 존재해야 합니다.");
      const p = this.editingNames.length;
      this.editingNames.pop();
      ['mon','tue','wed','thu','fri'].forEach(d => {
          if (this.editingData[d] && this.editingData[d][p] !== undefined) delete this.editingData[d][p];
      });
      this.refreshModalContent();
  },

  // -----------------------------------------
  // 템플릿 기능
  // -----------------------------------------
  loadTemplateToEditor: function(name) {
      const tpl = window.timetableTemplates[name];
      if (!tpl) return;
      this.editingNames = [...(tpl.names || window.periodNames)];
      this.editingData = JSON.parse(JSON.stringify(tpl.data || { mon: {}, tue: {}, wed: {}, thu: {}, fri: {} }));
      this.currentTemplateName = name;
  },

  loadSelectedTemplate: function() {
      const select = document.getElementById('tt-template-select');
      if (!select || !select.value) return;
      this.loadTemplateToEditor(select.value);
      this.refreshModalContent();
  },

  saveAsNewTemplate: async function() {
      const newName = prompt("저장할 시간표의 이름을 입력하세요.\n(예: 1학기 지필평가, 단축수업 시간표 등)", this.currentTemplateName);
      if (!newName || !newName.trim()) return;
      
      const cleanName = newName.trim();
      window.timetableTemplates[cleanName] = {
          names: [...this.editingNames],
          data: JSON.parse(JSON.stringify(this.editingData))
      };
      
      this.currentTemplateName = cleanName;
      await this.syncToCloud();
      this.refreshModalContent();
      alert(`✅ [${cleanName}] 시간표가 저장되었습니다.`);
  },

  deleteSelectedTemplate: async function() {
      if (Object.keys(window.timetableTemplates).length <= 1) return alert("최소 1개의 템플릿은 남아있어야 합니다.");
      if (confirm(`현재 선택된 [${this.currentTemplateName}] 시간표를 삭제하시겠습니까?`)) {
          delete window.timetableTemplates[this.currentTemplateName];
          this.currentTemplateName = Object.keys(window.timetableTemplates)[0];
          this.loadTemplateToEditor(this.currentTemplateName);
          await this.syncToCloud();
          this.refreshModalContent();
      }
  },

  // -----------------------------------------
  // 학사일정(학기 날짜) 기능
  // -----------------------------------------
  saveSemesterDates: async function() {
      const s1 = document.getElementById('tt-sem1-start').value;
      const e1 = document.getElementById('tt-sem1-end').value;
      const s2 = document.getElementById('tt-sem2-start').value;
      const e2 = document.getElementById('tt-sem2-end').value;

      if (!s1 || !e1 || !s2 || !e2) return alert("1학기와 2학기의 모든 날짜를 빠짐없이 지정해주세요.");

      window.semesterConfig = { sem1Start: s1, sem1End: e1, sem2Start: s2, sem2End: e2 };
      await this.syncToCloud();
      alert("✅ 학사일정(학기 날짜)이 클라우드에 저장되었습니다.");
  },

  setApplyDates: function(term) {
      if (!window.semesterConfig.sem1Start) return alert("먼저 상단에서 학사일정(학기) 날짜를 지정하고 [저장]을 눌러주세요.");
      
      const applyStart = document.getElementById('tt-apply-start');
      const applyEnd = document.getElementById('tt-apply-end');
      
      if (term === 'sem1') {
          applyStart.value = window.semesterConfig.sem1Start;
          applyEnd.value = window.semesterConfig.sem1End;
      } else {
          applyStart.value = window.semesterConfig.sem2Start;
          applyEnd.value = window.semesterConfig.sem2End;
      }
  },

  // -----------------------------------------
  // 달력에 덮어쓰기 (실행 엔진)
  // -----------------------------------------
  applyTimetableToCalendar: async function() {
    const sStr = document.getElementById('tt-apply-start').value;
    const eStr = document.getElementById('tt-apply-end').value;
    
    if (!sStr || !eStr) return alert("적용할 기간의 시작일과 종료일을 모두 선택해주세요.");
    
    const startObj = new Date(sStr);
    const endObj = new Date(eStr);
    if (startObj > endObj) return alert("시작일이 종료일보다 늦을 수 없습니다.");

    let hasContent = false;
    ['mon', 'tue', 'wed', 'thu', 'fri'].forEach(d => {
      if (this.editingData[d] && Object.values(this.editingData[d]).some(v => v !== '')) hasContent = true;
    });
    if (!hasContent && !confirm("화면의 시간표가 비어있습니다. 이대로 '빈 시간표'를 덮어씌우시겠습니까?")) return;

    if (!confirm(`지정한 기간(${sStr} ~ ${eStr})에\n현재 화면의 시간표를 일괄 덮어쓰기 하시겠습니까?\n\n(※ 기존에 적혀있던 과목명은 덮어씌워지며, 공휴일은 자동으로 건너뜁니다.)`)) return;

    const btn = event.target;
    const originalText = btn.innerText;
    btn.innerText = "⏳ 덮어쓰기 중...";
    btn.disabled = true;

    try {
      const eventSnap = await window.getUserCol('events').where(firebase.firestore.FieldPath.documentId(), '>=', sStr).get();
      const scheduleSnap = await window.getUserCol('schedules').where(firebase.firestore.FieldPath.documentId(), '>=', sStr).get();
      
      const eventMap = {};
      eventSnap.forEach(doc => { eventMap[doc.id] = doc.data(); });
      
      const scheduleMap = {};
      scheduleSnap.forEach(doc => { scheduleMap[doc.id] = doc.data().periods || {}; });

      let batch = window.db.batch();
      let opCount = 0; let batchPromises = [];
      let appliedCount = 0; let skippedCount = 0;

      let cur = new Date(startObj);
      const periodCount = this.editingNames.length;
      const days = ['mon', 'tue', 'wed', 'thu', 'fri'];

      // 💡 현재 팝업에 떠있는 교시명(이름)을 메인 설정에도 덮어씌워 줍니다. (표시 호환성용)
      window.periodNames = [...this.editingNames];

      while (cur <= endObj) {
        const dayIndex = cur.getDay(); 
        
        if (dayIndex >= 1 && dayIndex <= 5) {
          const dateStr = window.formatDate(cur);
          if (dateStr <= eStr) { // 오버플로우 방지
              const dayName = days[dayIndex - 1]; 
              
              // 휴일 확인 로직 (utils.js의 isRedDay 활용)
              let isSkip = false;
              const eData = eventMap[dateStr];
              let listForCheck = [];
              if (eData) {
                  listForCheck = eData.eventList || [];
                  if (listForCheck.length === 0 && eData.eventText) listForCheck = window.parseRawEventTextToEventList(eData.eventText);
              }
              if (window.isRedDay(dateStr, listForCheck)) isSkip = true;

              const existingPeriods = scheduleMap[dateStr] || {};
              const newPeriods = {};

              for (let p = 1; p <= periodCount; p++) {
                newPeriods[p] = {
                  subject: isSkip ? '' : (this.editingData[dayName][p] || ''),
                  memo: existingPeriods[p] ? existingPeriods[p].memo : '', 
                  supplies: existingPeriods[p] ? existingPeriods[p].supplies : ''
                };
              }

              const docRef = window.getUserCol('schedules').doc(dateStr);
              batch.set(docRef, { periods: newPeriods, updatedAt: Date.now() }, { merge: true });
              
              if (isSkip) skippedCount++;
              else appliedCount++;

              opCount++;
              if (opCount >= 400) {
                batchPromises.push(batch.commit());
                batch = window.db.batch();
                opCount = 0;
              }
          }
        }
        cur.setDate(cur.getDate() + 1);
      }

      if (opCount > 0) batchPromises.push(batch.commit());
      await Promise.all(batchPromises);

      // 마지막으로 설정값(교시명 변경점 등) 확실히 동기화
      await this.syncToCloud();

      alert(`🎉 일괄 적용 성공!\n- 성공적으로 적용된 평일: ${appliedCount}일\n- 휴일로 보호되어 건너뛴 날: ${skippedCount}일`);
      this.modalInstance.close();
      window.render(); 

    } catch (err) {
      console.error(err);
      alert("적용 중 오류가 발생했습니다.");
    } finally {
      btn.innerText = originalText;
      btn.disabled = false;
    }
  },

  // -----------------------------------------
  // 클라우드 동기화 (저장) 함수
  // -----------------------------------------
  syncToCloud: async function() {
      if (!window.auth || !window.auth.currentUser) return;
      try {
          await window.getUserCol('settings').doc('timetable_v5').set({
              semesterConfig: window.semesterConfig,
              templates: window.timetableTemplates,
              currentNames: window.periodNames, // 현재 기준 이름 (달력 표시용)
              updatedAt: Date.now()
          }, { merge: true });
      } catch (e) {
          console.error("Timetable Sync Error:", e);
      }
  }
};

window.openTimetableModal = () => TimetableModule.open();
window.openSettingsModal = () => TimetableModule.open(); // 기존 세팅 버튼 눌러도 이거 띄우게 호환성 유지
