// js/modules/timetable.js

const TimetableModule = {
  modalInstance: null,
  timetableConfig: { 1: null, 2: null }, 

  getContentHTML: function() {
    const periodCount = window.periodNames ? window.periodNames.length : 6;
    const days = ['월', '화', '수', '목', '금'];
    const dayIds = ['mon', 'tue', 'wed', 'thu', 'fri'];
    
    let tableHtml = `<table class="timetable-input-table" style="width:100%; border-collapse:collapse; text-align:center; margin-top:10px;">
      <thead>
        <tr style="background:#f8fafc; border-bottom:2px solid #cbd5e1;">
          <th style="padding:10px; color:#475569; width:60px;">교시</th>
          ${days.map(d => `<th style="padding:10px; color:#475569;">${d}</th>`).join('')}
        </tr>
      </thead>
      <tbody>`;

    for (let p = 1; p <= periodCount; p++) {
      const pName = window.periodNames[p - 1] || `${p}교시`;
      tableHtml += `<tr style="border-bottom:1px solid #e2e8f0;">
        <td style="padding:8px; border:1px solid #cbd5e1; font-weight:bold; background:#f8fafc; color:#475569;">${pName}</td>`;
      for (let d = 0; d < 5; d++) {
        tableHtml += `<td style="padding:0; border:1px solid #cbd5e1;">
          <input type="text" id="tt-input-${dayIds[d]}-${p}" style="width:100%; padding:10px 4px; border:none; text-align:center; font-weight:bold; color:#1e40af; outline:none; background:transparent; font-size:1.05rem; transition:0.2s;" onfocus="this.style.background='#ffffcc'" onblur="this.style.background='transparent'">
        </td>`;
      }
      tableHtml += `</tr>`;
    }
    tableHtml += `</tbody></table>`;

    return `
      <div class="modal-info-box" style="display:flex; justify-content:space-between; align-items:center;">
        <div>
          <h4 style="margin:0 0 4px 0; color:#1e40af;">📅 2학기 시작일 설정</h4>
          <span style="font-size:0.85rem; color:#475569;">이 날짜를 기준으로 프로그램 전역의 1학기와 2학기를 구분합니다.</span>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          <input type="date" id="tt-sem2-start" style="padding:8px; border:1px solid #cbd5e1; border-radius:6px; outline:none; font-weight:bold; color:#1e293b;">
          <button onclick="TimetableModule.saveSem2Date()" class="modal-btn-secondary" style="padding:8px 16px;">적용</button>
        </div>
      </div>

      <div class="modal-info-box alt" style="padding-bottom:10px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; flex-wrap:wrap; gap:10px;">
          <div style="display:flex; gap:8px;">
            <button onclick="TimetableModule.saveTimetable(1)" style="background:#3b82f6; color:#fff; border:none; padding:8px 12px; border-radius:6px; font-weight:bold; cursor:pointer; font-size:0.95rem; box-shadow:0 1px 2px rgba(0,0,0,0.1);">💾 1학기 기준 시간표 저장</button>
            <button onclick="TimetableModule.saveTimetable(2)" style="background:#0284c7; color:#fff; border:none; padding:8px 12px; border-radius:6px; font-weight:bold; cursor:pointer; font-size:0.95rem; box-shadow:0 1px 2px rgba(0,0,0,0.1);">💾 2학기 기준 시간표 저장</button>
          </div>
          <div style="display:flex; gap:8px;">
            <button onclick="TimetableModule.loadTimetable(1)" style="background:#fff; color:#1e293b; border:1px solid #cbd5e1; padding:8px 12px; border-radius:6px; font-weight:bold; cursor:pointer; font-size:0.95rem; box-shadow:0 1px 2px rgba(0,0,0,0.05);">📂 1학기 기준 시간표 불러오기</button>
            <button onclick="TimetableModule.loadTimetable(2)" style="background:#fff; color:#1e293b; border:1px solid #cbd5e1; padding:8px 12px; border-radius:6px; font-weight:bold; cursor:pointer; font-size:0.95rem; box-shadow:0 1px 2px rgba(0,0,0,0.05);">📂 2학기 기준 시간표 불러오기</button>
          </div>
        </div>
        <div style="overflow-x:auto; border-radius:8px; background:#fff;">
          ${tableHtml}
        </div>
      </div>

      <div class="modal-info-box" style="border-left-color:#10b981; background:#ecfdf5;">
        <h4 style="margin:0 0 10px 0; color:#047857; border-bottom:1px solid #a7f3d0; padding-bottom:5px;">🚀 시간표 달력에 적용하기 (현재 화면의 시간표가 기준이 됩니다)</h4>
        
        <div style="display:flex; gap:10px; margin-bottom:12px;">
          <button onclick="TimetableModule.applyTimetable('sem1')" style="flex:1; background:#10b981; color:#fff; border:none; padding:12px; border-radius:8px; font-weight:bold; cursor:pointer; font-size:1.05rem; box-shadow:0 2px 4px rgba(0,0,0,0.1);">✨ 1학기 적용</button>
          <button onclick="TimetableModule.applyTimetable('sem2')" style="flex:1; background:#059669; color:#fff; border:none; padding:12px; border-radius:8px; font-weight:bold; cursor:pointer; font-size:1.05rem; box-shadow:0 2px 4px rgba(0,0,0,0.1);">✨ 2학기 적용</button>
        </div>

        <div style="display:flex; align-items:center; gap:10px; background:#fff; padding:10px 15px; border-radius:8px; border:1px solid #a7f3d0;">
          <span style="font-weight:bold; color:#047857;">기간 적용:</span>
          <input type="date" id="tt-apply-start" style="padding:8px; border:1px solid #cbd5e1; border-radius:4px; outline:none; flex:1;">
          <span style="font-weight:bold; color:#64748b;">~</span>
          <input type="date" id="tt-apply-end" style="padding:8px; border:1px solid #cbd5e1; border-radius:4px; outline:none; flex:1;">
          <button onclick="TimetableModule.applyTimetable('custom')" style="background:#047857; color:#fff; border:none; padding:8px 16px; border-radius:6px; font-weight:bold; cursor:pointer; box-shadow:0 1px 2px rgba(0,0,0,0.1);">기간 적용</button>
        </div>
      </div>
    `;
  },

  open: async function() {
    if (!this.modalInstance) {
      this.modalInstance = new window.Modal({
        id: 'timetable-modal-v5',
        title: '🗓️ 기준시간표 관리',
        width: '750px',
        content: this.getContentHTML()
      });
    }
    
    const dropdown = document.getElementById('more-dropdown');
    if (dropdown) dropdown.classList.add('hidden');

    this.modalInstance.open();
    await window.loadGlobalPreferences(); // 전역 환경설정 로드
    await this.initData();
  },

  initData: async function() {
    try {
      const doc = await window.getUserCol('settings').doc('timetable_config').get();
      if (doc.exists) this.timetableConfig = doc.data() || { 1: null, 2: null };

      // 💡 전역 엔진을 사용해 학년도와 2학기 시작일 계산
      const dates = window.getSemesterDates();
      document.getElementById('tt-sem2-start').value = window.formatDate(dates.sem2Start);
      
      this.loadTimetable(1);
    } catch(e) { console.error("초기화 오류:", e); }
  },

  saveSem2Date: async function() {
    const dateVal = document.getElementById('tt-sem2-start').value;
    if (!dateVal) return alert("날짜를 선택해주세요.");
    
    const parts = dateVal.split('-');
    const mmdd = `${parts[1]}-${parts[2]}`; // MM-DD 전역 저장
    
    try {
      await window.getUserCol('settings').doc('preferences').set({ sem2StartDate: mmdd }, { merge: true });
      window.sem2StartMMDD = mmdd; // 전역 변수 업데이트
      alert("✅ 2학기 시작일이 안전하게 적용되었습니다.");
    } catch(e) { alert("저장 실패!"); }
  },

  getTableData: function() {
    const periodCount = window.periodNames ? window.periodNames.length : 6;
    const days = ['mon', 'tue', 'wed', 'thu', 'fri'];
    const newData = {};
    
    days.forEach(day => {
      newData[day] = {};
      for (let p = 1; p <= periodCount; p++) {
        const input = document.getElementById(`tt-input-${day}-${p}`);
        if (input) newData[day][p] = input.value.trim();
      }
    });
    return newData;
  },

  saveTimetable: async function(semNum) {
    this.timetableConfig[semNum] = this.getTableData();
    try {
      await window.getUserCol('settings').doc('timetable_config').set(this.timetableConfig);
      alert(`✅ ${semNum}학기 기준 시간표가 성공적으로 클라우드에 저장되었습니다.`);
    } catch(e) { alert("저장 중 오류가 발생했습니다."); }
  },

  loadTimetable: function(semNum) {
    const data = this.timetableConfig[semNum];
    const periodCount = window.periodNames ? window.periodNames.length : 6;
    const days = ['mon', 'tue', 'wed', 'thu', 'fri'];

    for (let p = 1; p <= periodCount; p++) {
      days.forEach(day => {
        const input = document.getElementById(`tt-input-${day}-${p}`);
        if (input) {
          input.value = (data && data[day] && data[day][p]) ? data[day][p] : '';
        }
      });
    }
  },

  applyTimetable: async function(mode) {
    const tableData = this.getTableData(); 
    
    let hasContent = false;
    const days = ['mon', 'tue', 'wed', 'thu', 'fri'];
    for (const d of days) {
      if (tableData[d] && Object.values(tableData[d]).some(v => v !== '')) hasContent = true;
    }
    if (!hasContent && !confirm("화면의 시간표가 비어있습니다. 이대로 '빈 시간표'를 덮어씌우시겠습니까?")) return;

    // 💡 전역 엔진을 사용해 정확한 시작/종료일 획득
    const dates = window.getSemesterDates();
    let startObj, endObj;

    if (mode === 'sem1') {
      startObj = dates.sem1Start;
      endObj = dates.sem1End;
    } else if (mode === 'sem2') {
      startObj = dates.sem2Start;
      endObj = dates.sem2End;
    } else if (mode === 'custom') {
      const sStr = document.getElementById('tt-apply-start').value;
      const eStr = document.getElementById('tt-apply-end').value;
      if (!sStr || !eStr) return alert("적용할 기간의 시작일과 종료일을 모두 선택해주세요.");
      startObj = new Date(sStr);
      endObj = new Date(eStr);
      if (startObj > endObj) return alert("시작일이 종료일보다 늦을 수 없습니다.");
    }

    const title = mode === 'sem1' ? '1학기 전체' : (mode === 'sem2' ? '2학기 전체' : '선택한 기간');
    if (!confirm(`${title}에 현재 화면에 적혀있는 시간표를 일괄 적용하시겠습니까?\n(기존 입력된 수업 데이터는 덮어씌워지며, 휴일은 자동으로 건너뜁니다.)`)) return;

    const btn = event.target;
    const originalText = btn.innerText;
    btn.innerText = "⏳ 클라우드 동기화 중...";
    btn.disabled = true;

    try {
      const eventSnap = await window.getUserCol('events').get();
      const scheduleSnap = await window.getUserCol('schedules').get();
      
      const eventMap = {};
      eventSnap.forEach(doc => { eventMap[doc.id] = doc.data(); });
      
      const scheduleMap = {};
      scheduleSnap.forEach(doc => { scheduleMap[doc.id] = doc.data().periods || {}; });

      let batch = window.db.batch();
      let opCount = 0;
      let batchPromises = [];
      let appliedCount = 0;
      let skippedCount = 0;

      let cur = new Date(startObj);
      const periodCount = window.periodNames ? window.periodNames.length : 6;

      while (cur <= endObj) {
        const dayIndex = cur.getDay(); 
        
        if (dayIndex >= 1 && dayIndex <= 5) {
          const dateStr = window.formatDate(cur);
          const dayName = days[dayIndex - 1]; 
          
          let isSkip = false;
          const eData = eventMap[dateStr];
          if (eData) {
            let list = eData.eventList || [];
            if (list.length === 0 && eData.eventText) list = window.parseRawEventTextToEventList(eData.eventText);
            if (list.some(ev => window.isSkipLabel(ev.label))) isSkip = true;
          }

          const existingPeriods = scheduleMap[dateStr] || {};
          const newPeriods = {};

          for (let p = 1; p <= periodCount; p++) {
            newPeriods[p] = {
              subject: isSkip ? '' : (tableData[dayName][p] || ''),
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
        cur.setDate(cur.getDate() + 1);
      }

      if (opCount > 0) batchPromises.push(batch.commit());
      await Promise.all(batchPromises);

      alert(`🎉 일괄 적용 성공!\n- 시간표 적용된 날짜: ${appliedCount}일\n- 휴일/행사로 보호된 날짜: ${skippedCount}일`);
      this.modalInstance.close();
      window.render(); 

    } catch (err) {
      console.error(err);
      alert("시간표 적용 중 오류가 발생했습니다.");
    } finally {
      btn.innerText = originalText;
      btn.disabled = false;
    }
  }
};

window.openTimetableModal = () => TimetableModule.open();
