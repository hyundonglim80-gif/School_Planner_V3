// js/modules/timetable.js

import { store } from '../core/store.js';
import { formatDate, parseLocalDate, isRedDay } from '../core/utils.js'; 
import { parseRawEventTextToEventList } from '../core/eventManager.js'; 
import { getUserCol } from '../api/database.js'; // 🌟 신규 경로
import { db } from '../api/firebaseInit.js'; // 🌟 신규 경로
import { doc, getDocs, setDoc, query, where, documentId, writeBatch } from "firebase/firestore"; 

export const TimetableModule = {
  modalInstance: null,
  
  editingNames: [],
  editingData: { mon: {}, tue: {}, wed: {}, thu: {}, fri: {} },
  currentTemplateName: "1학기 시간표", 

  getContentHTML: function() {
    const days = ['mon', 'tue', 'wed', 'thu', 'fri'];
    const dayLabels = ['월', '화', '수', '목', '금'];
    
    const tbodyHtml = this.editingNames.map((pName, index) => {
      const p = index + 1;
      const tdsHtml = days.map(d => {
        const val = this.editingData[d] ? (this.editingData[d][p] || '') : '';
        return `
          <td style="padding:8px; border:1px solid #f1f5f9;">
            <input type="text" id="tt-input-${d}-${p}" value="${val}" placeholder="입력" onchange="window.TimetableModule.updateData('${d}', ${p}, this.value)" style="width:100%; padding:10px 4px; border:1px solid #e2e8f0; border-radius:6px; text-align:center; font-weight:bold; color:#1e40af; outline:none; background:#f8fafc; font-size:1.05rem; transition:0.2s; cursor:text; box-shadow:inset 0 1px 2px rgba(0,0,0,0.02);" onfocus="this.style.background='#ffffcc'; this.style.borderColor='#fbbf24';" onblur="this.style.background='#f8fafc'; this.style.borderColor='#e2e8f0';">
          </td>`;
      }).join('');

      return `
        <tr style="border-bottom:1px solid #e2e8f0;">
          <td style="padding:8px; border-right:1px solid #e2e8f0; background:#f8fafc;">
            <input type="text" value="${pName}" id="tt-name-${p}" onchange="window.TimetableModule.updatePeriodName(${index}, this.value)" style="width:100%; padding:8px 4px; border:1px dashed #94a3b8; border-radius:6px; text-align:center; font-weight:900; color:#475569; outline:none; background:#ffffff; font-size:0.95rem; cursor:text; box-shadow:inset 0 1px 2px rgba(0,0,0,0.05);" onfocus="this.style.border='1px solid #2563eb'" onblur="this.style.border='1px dashed #94a3b8'">
          </td>
          ${tdsHtml}
        </tr>`;
    }).join('');

    let tableHtml = `
      <table class="timetable-input-table" style="width:100%; border-collapse:collapse; text-align:center; margin-top:10px;">
        <thead>
          <tr style="background:#f8fafc; border-bottom:2px solid #cbd5e1;">
            <th style="padding:4px; color:#475569; width:65px; border-right:1px solid #e2e8f0; vertical-align:middle;">
              <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px;">
                <span style="font-size:0.85rem; font-weight:bold;">교시</span>
                <div style="display:flex; gap:2px;">
                  <button onclick="window.TimetableModule.addRow()" style="background:#f1f5f9; color:#334155; border:1px solid #cbd5e1; border-radius:4px; width:22px; height:22px; display:flex; justify-content:center; align-items:center; cursor:pointer; font-weight:bold; font-size:1.1rem; padding:0; line-height:1;" title="교시 추가">+</button>
                  <button onclick="window.TimetableModule.removeRow()" style="background:#fef2f2; color:#ef4444; border:1px solid #fca5a5; border-radius:4px; width:22px; height:22px; display:flex; justify-content:center; align-items:center; cursor:pointer; font-weight:bold; font-size:1.1rem; padding:0; line-height:1;" title="맨 아래 삭제">-</button>
                </div>
              </div>
            </th>
            ${dayLabels.map(d => `<th style="padding:10px; color:#475569;">${d}</th>`).join('')}
          </tr>
        </thead>
        <tbody id="tt-editor-tbody">${tbodyHtml}</tbody>
      </table>`;

    let templateOptions = '';
    const tplKeys = Object.keys(store.timetableTemplates);
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
        <button onclick="window.TimetableModule.saveSemesterDates()" class="modal-btn-secondary" style="height:100%; margin-left:10px;">학사일정<br>저장</button>
      </div>

      <div class="modal-info-box alt" style="padding-bottom:15px; border-top:2px solid #e2e8f0; margin-top:0;">
        <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:10px; gap:10px;">
          <div style="flex:1;">
            <span style="font-weight:bold; color:#1e293b; font-size:0.9rem; display:block; margin-bottom:4px;">저장된 시간표 목록</span>
            <div style="display:flex; gap:6px;">
                <select id="tt-template-select" onchange="window.TimetableModule.loadSelectedTemplate()" style="flex:1; padding:8px; border-radius:6px; border:1px solid #cbd5e1; font-size:0.95rem; font-weight:bold; color:#1e40af; outline:none;">
                    ${templateOptions}
                </select>
            </div>
          </div>
          <div style="display:flex; flex-direction:column; gap:4px; align-items:flex-end;">
            <button onclick="window.TimetableModule.saveAsNewTemplate()" style="background:#2563eb; color:#fff; border:none; padding:8px 12px; border-radius:6px; font-weight:bold; cursor:pointer; font-size:0.9rem; box-shadow:0 1px 2px rgba(0,0,0,0.1);">💾 현재 표를 새로 저장 (이름 지정)</button>
            <button onclick="window.TimetableModule.deleteSelectedTemplate()" style="background:transparent; color:#ef4444; border:none; padding:4px 8px; font-weight:bold; cursor:pointer; font-size:0.8rem; text-decoration:underline;">현재 표시된 템플릿 삭제</button>
          </div>
        </div>

        <div style="overflow-x:auto; border-radius:8px; background:#fff; margin-bottom:10px;">
          ${tableHtml}
        </div>
      </div>

      <div class="modal-info-box" style="border-left-color:#10b981; background:#ecfdf5; margin-top:0;">
        <h4 style="margin:0 0 10px 0; color:#047857; border-bottom:1px solid #a7f3d0; padding-bottom:5px;">🚀 시간표 달력에 적용하기 (위에 표시된 표가 그대로 복사됩니다)</h4>
        
        <div style="display:flex; gap:10px; margin-bottom:12px;">
          <button onclick="window.TimetableModule.setApplyDates('sem1')" style="flex:1; background:#fff; color:#059669; border:2px solid #10b981; padding:8px; border-radius:8px; font-weight:bold; cursor:pointer; font-size:0.95rem;">👉 1학기 기간 셋팅</button>
          <button onclick="window.TimetableModule.setApplyDates('sem2')" style="flex:1; background:#fff; color:#059669; border:2px solid #10b981; padding:8px; border-radius:8px; font-weight:bold; cursor:pointer; font-size:0.95rem;">👉 2학기 기간 셋팅</button>
        </div>

        <div style="display:flex; align-items:center; gap:10px; background:#fff; padding:10px 15px; border-radius:8px; border:1px solid #a7f3d0;">
          <span style="font-weight:bold; color:#047857;">기간:</span>
          <input type="date" id="tt-apply-start" style="padding:8px; border:1px solid #cbd5e1; border-radius:4px; outline:none; flex:1;">
          <span style="font-weight:bold; color:#64748b;">~</span>
          <input type="date" id="tt-apply-end" style="padding:8px; border:1px solid #cbd5e1; border-radius:4px; outline:none; flex:1;">
          <button onclick="window.TimetableModule.applyTimetableToCalendar()" style="background:#047857; color:#fff; border:none; padding:8px 16px; border-radius:6px; font-weight:bold; cursor:pointer; box-shadow:0 1px 2px rgba(0,0,0,0.2); font-size:1.05rem;">이 기간에 덮어쓰기</button>
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
        content: '<div id="timetable-master-content"></div>' 
      });
    }
    
    const dropdown = document.getElementById('more-dropdown');
    if (dropdown) dropdown.classList.add('hidden');

    this.modalInstance.open();
    
    if (Object.keys(store.timetableTemplates).length === 0) {
        store.timetableTemplates["1학기 시간표"] = { names: [...store.periodNames], data: {} };
        store.timetableTemplates["2학기 시간표"] = { names: [...store.periodNames], data: {} };
        this.currentTemplateName = "1학기 시간표";
    } else {
        this.currentTemplateName = Object.keys(store.timetableTemplates)[0];
    }
    
    this.loadTemplateToEditor(this.currentTemplateName);
    this.refreshModalContent();

    document.getElementById('tt-sem1-start').value = store.semesterConfig.sem1Start || '';
    document.getElementById('tt-sem1-end').value = store.semesterConfig.sem1End || '';
    document.getElementById('tt-sem2-start').value = store.semesterConfig.sem2Start || '';
    document.getElementById('tt-sem2-end').value = store.semesterConfig.sem2End || '';
  },

  refreshModalContent: function() {
      const container = document.getElementById('timetable-master-content');
      if (container) container.innerHTML = this.getContentHTML();
  },

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

  loadTemplateToEditor: function(name) {
      const tpl = store.timetableTemplates[name];
      if (!tpl) return;
      this.editingNames = [...(tpl.names || store.periodNames)];
      this.editingData = JSON.parse(JSON.stringify(tpl.data || { mon: {}, tue: {}, wed: {}, thu: {}, fri: {} }));
      this.currentTemplateName = name;
  },

  loadSelectedTemplate: function() {
      const select = document.getElementById('tt-template-select');
      if (!select || !select.value) return;
      this.loadTemplateToEditor(select.value);
      this.refreshModalContent();
  },

  syncToCloud: async function() {
      try {
          await setDoc(doc(getUserCol('settings'), 'timetable_v5'), {
              templates: store.timetableTemplates,
              semesterConfig: store.semesterConfig,
              currentNames: store.periodNames,
              updatedAt: Date.now()
          }, { merge: true });
          if (typeof window.loadSettings === 'function') await window.loadSettings();
      } catch(e) { console.error("시간표 클라우드 저장 실패:", e); }
  },

  saveAsNewTemplate: async function() {
      const newName = prompt("저장할 시간표의 이름을 입력하세요.\n(예: 1학기 지필평가, 단축수업 시간표 등)", this.currentTemplateName);
      if (!newName || !newName.trim()) return;
      
      const cleanName = newName.trim();
      store.timetableTemplates[cleanName] = {
          names: [...this.editingNames],
          data: JSON.parse(JSON.stringify(this.editingData))
      };
      
      this.currentTemplateName = cleanName;
      await this.syncToCloud();
      this.refreshModalContent();
      alert(`✅ [${cleanName}] 시간표가 저장되었습니다.`);
  },

  deleteSelectedTemplate: async function() {
      const select = document.getElementById('tt-template-select');
      const targetName = select ? select.value : this.currentTemplateName;
      
      if (Object.keys(store.timetableTemplates).length <= 1) return alert("최소 1개의 템플릿은 남아있어야 합니다.");
      
      if (confirm(`현재 표시된 [${targetName}] 시간표를 삭제하시겠습니까?`)) {
          delete store.timetableTemplates[targetName];
          this.currentTemplateName = Object.keys(store.timetableTemplates)[0];
          this.loadTemplateToEditor(this.currentTemplateName);
          this.refreshModalContent();
          await this.syncToCloud();
      }
  },

  saveSemesterDates: async function() {
      const s1 = document.getElementById('tt-sem1-start').value;
      const e1 = document.getElementById('tt-sem1-end').value;
      const s2 = document.getElementById('tt-sem2-start').value;
      const e2 = document.getElementById('tt-sem2-end').value;

      if (!s1 || !e1 || !s2 || !e2) return alert("1학기와 2학기의 모든 날짜를 빠짐없이 지정해주세요.");

      store.semesterConfig = { sem1Start: s1, sem1End: e1, sem2Start: s2, sem2End: e2 };
      await this.syncToCloud();
      alert("✅ 학사일정(학기 날짜)이 클라우드에 저장되었습니다.");
  },

  setApplyDates: function(term) {
      if (!store.semesterConfig.sem1Start) return alert("먼저 상단에서 학사일정(학기) 날짜를 지정하고 [저장]을 눌러주세요.");
      
      const applyStart = document.getElementById('tt-apply-start');
      const applyEnd = document.getElementById('tt-apply-end');
      
      if (term === 'sem1') {
          applyStart.value = store.semesterConfig.sem1Start;
          applyEnd.value = store.semesterConfig.sem1End;
      } else {
          applyStart.value = store.semesterConfig.sem2Start;
          applyEnd.value = store.semesterConfig.sem2End;
      }
  },

  applyTimetableToCalendar: async function() {
    const sStr = document.getElementById('tt-apply-start').value;
    const eStr = document.getElementById('tt-apply-end').value;
    
    if (!sStr || !eStr) return alert("적용할 기간의 시작일과 종료일을 모두 선택해주세요.");
    
    const startObj = parseLocalDate(sStr);
    const endObj = parseLocalDate(eStr);
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
      const [eventsSnap, schedulesSnap] = await Promise.all([
          getDocs(query(getUserCol('events'), where(documentId(), '>=', sStr), where(documentId(), '<=', eStr))),
          getDocs(query(getUserCol('schedules'), where(documentId(), '>=', sStr), where(documentId(), '<=', eStr)))
      ]);
      
      const eventMap = {};
      eventsSnap.forEach(docSnap => { eventMap[docSnap.id] = docSnap.data(); });
      
      const scheduleMap = {};
      schedulesSnap.forEach(docSnap => { scheduleMap[docSnap.id] = docSnap.data().periods || {}; });

      let batch = writeBatch(db);
      let opCount = 0; let batchPromises = [];
      let appliedCount = 0; let skippedCount = 0;

      let cur = new Date(startObj);
      const periodCount = this.editingNames.length;
      const days = ['mon', 'tue', 'wed', 'thu', 'fri'];

      store.periodNames = [...this.editingNames];
      await this.syncToCloud(); 

      while (cur <= endObj) {
        const dayIndex = cur.getDay(); 
        
        if (dayIndex >= 1 && dayIndex <= 5) {
          const dateStr = formatDate(cur);
          if (dateStr <= eStr) { 
              const dayName = days[dayIndex - 1]; 
              
              let isSkip = false;
              const eData = eventMap[dateStr];
              let listForCheck = [];
              if (eData) {
                  listForCheck = eData.eventList || [];
                  if (listForCheck.length === 0 && eData.eventText) listForCheck = parseRawEventTextToEventList(eData.eventText);
              }
              if (isRedDay(dateStr, listForCheck)) isSkip = true;

              const existingPeriods = scheduleMap[dateStr] || {};
              const newPeriods = {};

              for (let p = 1; p <= periodCount; p++) {
                newPeriods[p] = {
                  subject: isSkip ? '' : ((this.editingData[dayName] || {})[p] || ''),
                  memo: existingPeriods[p] ? existingPeriods[p].memo : '', 
                  supplies: existingPeriods[p] ? existingPeriods[p].supplies : ''
                };
              }

              const docRef = doc(getUserCol('schedules'), dateStr);
              batch.set(docRef, { periods: newPeriods, updatedAt: Date.now() }, { merge: true });
              
              if (isSkip) skippedCount++;
              else appliedCount++;

              opCount++;
              if (opCount >= 400) {
                batchPromises.push(batch.commit());
                batch = writeBatch(db);
                opCount = 0;
              }
          }
        }
        cur.setDate(cur.getDate() + 1);
      }

      if (opCount > 0) batchPromises.push(batch.commit());
      await Promise.all(batchPromises);

      this.modalInstance.close();
      alert(`✅ 시간표 덮어쓰기 완료!\n- 적용된 날짜: ${appliedCount}일\n- 제외된 날짜(휴일 등): ${skippedCount}일`);
      if (typeof window.render === 'function') window.render();

    } catch(e) {
      console.error("시간표 일괄 적용 에러:", e);
      alert("적용 중 오류가 발생했습니다.");
    } finally {
      btn.innerText = originalText;
      btn.disabled = false;
    }
  }
};

window.TimetableModule = TimetableModule;
window.openTimetableModal = () => TimetableModule.open();