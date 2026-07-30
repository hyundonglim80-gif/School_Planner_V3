//js/modules/timetable.js

const TimetableModule = {
  modalInstance: null,
  timetableConfig: { 1: null, 2: null }, 

  getContentHTML: function() {
    return `
      <div class="modal-info-box alt">
        <p style="margin:0;">
          <strong>[기준시간표]</strong> 학기별 기본 시간표를 등록해두면, 원하는 기간에 일괄 적용할 수 있습니다.
        </p>
      </div>

      <div class="tt-action-row">
        <select id="tt-semester-select" onchange="TimetableModule.loadBaseTimetable()" style="padding:8px 12px; border-radius:6px; border:1px solid #cbd5e1; font-size:1rem; font-weight:bold; outline:none; cursor:pointer; background:#fff;">
          <option value="1">1학기 기준시간표</option>
          <option value="2">2학기 기준시간표</option>
        </select>
        <button onclick="TimetableModule.saveBaseTimetable()" class="modal-btn-primary">💾 시간표 저장</button>
      </div>

      <div style="overflow-x:auto; margin-bottom:20px; border:1px solid #e2e8f0; border-radius:8px; background:#fff;">
        <table class="timetable-input-table">
          <thead style="background:#f8fafc; border-bottom:2px solid #cbd5e1;">
            <tr>
              <th style="padding:10px; color:#475569;">교시</th>
              <th style="padding:10px; color:#475569;">월</th>
              <th style="padding:10px; color:#475569;">화</th>
              <th style="padding:10px; color:#475569;">수</th>
              <th style="padding:10px; color:#475569;">목</th>
              <th style="padding:10px; color:#475569;">금</th>
            </tr>
          </thead>
          <tbody id="tt-tbody">
          </tbody>
        </table>
      </div>

      <hr style="border:0; border-top:1px dashed #cbd5e1; margin:20px 0;">

      <h3 style="color:#0f172a; margin-top:0; font-size:1.1rem; margin-bottom:10px;">🚀 지정 기간 일괄 적용</h3>
      <div class="tt-apply-box">
        <select id="apply-semester" style="padding:8px; border-radius:4px; border:1px solid #cbd5e1; outline:none; background:#fff;">
          <option value="1">1학기 적용</option>
          <option value="2">2학기 적용</option>
        </select>
        <input type="date" id="apply-start-date" style="padding:8px; border:1px solid #cbd5e1; border-radius:4px; outline:none;">
        <span style="font-weight:bold; color:#64748b;">~</span>
        <input type="date" id="apply-end-date" style="padding:8px; border:1px solid #cbd5e1; border-radius:4px; outline:none;">
        <button onclick="TimetableModule.applyBaseTimetable()" class="modal-btn-primary success" style="flex-shrink:0;">일괄 적용 실행</button>
      </div>
    `;
  },

  open: function() {
    if (!this.modalInstance) {
      this.modalInstance = new window.Modal({
        id: 'timetable-modal-v2',
        title: '🗓️ 기준시간표 관리',
        width: '700px',
        content: this.getContentHTML()
      });
    }
    
    const dropdown = document.getElementById('more-dropdown');
    if (dropdown) dropdown.classList.add('hidden');

    this.modalInstance.open();
    this.renderTimetableGrid();
    
    this.fetchConfigFromDB().then(() => this.loadBaseTimetable());
  },

  renderTimetableGrid: function() {
    const tbody = document.getElementById('tt-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    const days = ['mon', 'tue', 'wed', 'thu', 'fri'];

    const maxPeriod = window.periodNames ? window.periodNames.length : 6;

    for (let p = 1; p <= maxPeriod; p++) {
      let tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid #e2e8f0';
      
      let tdP = document.createElement('td');
      tdP.textContent = (window.periodNames && window.periodNames[p-1]) || p + '교시';
      tdP.style.fontWeight = 'bold';
      tdP.style.background = '#f8fafc';
      tdP.style.padding = '8px';
      tdP.style.color = '#334155';
      tr.appendChild(tdP);
      
      days.forEach(day => {
        let td = document.createElement('td');
        td.style.padding = '0';
        td.innerHTML = `<input type="text" id="tt-input-${day}-${p}" placeholder="" style="width:100%; border:none; background:transparent; text-align:center; font-size:1.05rem; outline:none; padding:10px 4px; color:#1e40af; font-weight:bold; transition:0.2s;" onfocus="this.style.background='#ffffcc';" onblur="this.style.background='transparent';">`;
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    }
  },

  fetchConfigFromDB: async function() {
    try {
      const doc = await window.getUserCol('settings').doc('timetable_config').get();
      if (doc.exists) {
        this.timetableConfig = doc.data() || { 1: null, 2: null };
      }
    } catch(e) {
      console.error("기준시간표 로드 오류", e);
    }
  },

  loadBaseTimetable: function() {
    const sem = document.getElementById('tt-semester-select').value;
    const data = this.timetableConfig[sem];
    const days = ['mon', 'tue', 'wed', 'thu', 'fri'];
    const maxPeriod = window.periodNames ? window.periodNames.length : 6;

    for (let p = 1; p <= maxPeriod; p++) {
      days.forEach(day => {
        const input = document.getElementById(`tt-input-${day}-${p}`);
        if (input) {
          input.value = (data && data[day] && data[day][p]) ? data[day][p] : '';
        }
      });
    }
  },

  saveBaseTimetable: async function() {
    const sem = document.getElementById('tt-semester-select').value;
    const days = ['mon', 'tue', 'wed', 'thu', 'fri'];
    const maxPeriod = window.periodNames ? window.periodNames.length : 6;
    const newData = {};

    days.forEach(day => {
      newData[day] = {};
      for (let p = 1; p <= maxPeriod; p++) {
        const input = document.getElementById(`tt-input-${day}-${p}`);
        if (input) newData[day][p] = input.value.trim();
      }
    });

    this.timetableConfig[sem] = newData;

    try {
      await window.getUserCol('settings').doc('timetable_config').set(this.timetableConfig);
      alert(`✅ ${sem}학기 기준시간표가 성공적으로 저장되었습니다.`);
    } catch(e) {
      alert('저장 중 오류가 발생했습니다.');
    }
  },

  applyBaseTimetable: async function() {
    const sem = document.getElementById('apply-semester').value;
    const startDateStr = document.getElementById('apply-start-date').value;
    const endDateStr = document.getElementById('apply-end-date').value;

    if (!startDateStr || !endDateStr) return alert("시작일과 종료일을 모두 선택해 주세요.");
    
    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);
    if (startDate > endDate) return alert("시작일은 종료일보다 이전이어야 합니다.");
    
    if (!confirm(`${startDateStr} ~ ${endDateStr} 기간 동안 ${sem}학기 기준시간표를 일괄 적용하시겠습니까?`)) return;

    const semData = this.timetableConfig[sem];
    if (!semData) return alert("해당 학기의 기준시간표가 먼저 등록되어야 합니다.");

    const dayMap = { 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri' };
    let appliedCount = 0, skippedCount = 0;
    const operations = [];
    let curr = new Date(startDate);
    const maxPeriod = window.periodNames ? window.periodNames.length : 6;

    const modalBody = document.getElementById('timetable-modal-v2').querySelector('.modal-body');
    if (modalBody) modalBody.style.opacity = '0.5';

    try {
        while (curr <= endDate) {
          const dayOfWeek = curr.getDay();
          if (dayOfWeek >= 1 && dayOfWeek <= 5) {
            const dateStr = window.formatDate(curr);
            const dayName = dayMap[dayOfWeek];
            
            const eventDoc = await window.getUserCol('events').doc(dateStr).get();
            const eventText = eventDoc.exists ? (eventDoc.data().eventText || '') : '';
            
            const isSkipDay = window.checkSkipConditionFromText 
              ? window.checkSkipConditionFromText(eventText) 
              : (eventText.includes('(휴일)') || eventText.includes('(행사)') || eventText.includes('[전일행사]'));

            const scheduleDoc = await window.getUserCol('schedules').doc(dateStr).get();
            let periods = scheduleDoc.exists ? (scheduleDoc.data().periods || {}) : {};
            
            for(let p=1; p<=maxPeriod; p++) {
              if(!periods[p]) periods[p] = { subject:'', memo:'', supplies:'' };
              
              if (isSkipDay) {
                periods[p].subject = '';
              } else {
                periods[p].subject = (semData[dayName] && semData[dayName][p] !== undefined) ? semData[dayName][p] : '';
              }
            }

            const sRef = window.getUserCol('schedules').doc(dateStr);
            operations.push({ type: 'set', ref: sRef, data: { periods: periods, updatedAt: Date.now() } });
            
            if (isSkipDay) skippedCount++;
            else appliedCount++;
          }
          curr.setDate(curr.getDate() + 1);
        }

        if (window.executeBatchOperations) {
          await window.executeBatchOperations(operations);
        } else {
            console.error("executeBatchOperations is missing!");
            alert("일괄 적용 처리 모듈을 찾을 수 없습니다.");
            return;
        }
        
        alert(`🎉 일괄 적용 완료!\n- 적용된 일수: ${appliedCount}일\n- 휴일/행사로 비워진 일수: ${skippedCount}일`);
        
        if (typeof window.saveCurrentViewData === 'function' && window.currentMode === 'editor') {
          window.saveCurrentViewData();
        }
        this.modalInstance.close();
        if (typeof window.render === 'function') window.render();

    } catch(e) {
        alert('적용 중 오류가 발생했습니다.');
        console.error(e);
    } finally {
        if (modalBody) modalBody.style.opacity = '1';
    }
  }
};

window.openTimetableModal = () => TimetableModule.open();
