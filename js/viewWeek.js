// js/viewWeek.js

class WeekView extends window.BaseView {
  constructor(container) {
    super(container); // BaseView(부모) 상속
  }

  // 📅 주간 날짜 배열 계산 (기존 getWeekDates)
  getWeekDates() {
    const dates = [];
    const tempDate = new Date(this.currentDate);
    const day = tempDate.getDay();
    
    const diffToSun = tempDate.getDate() - day;
    tempDate.setDate(diffToSun); 

    const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
    
    for (let i = 0; i < 7; i++) {
      if (!this.isWeekendVisible && (i === 0 || i === 6)) {
        tempDate.setDate(tempDate.getDate() + 1);
        continue;
      }

      dates.push({
        day: dayNames[i],
        dayOfWeekNum: i,
        dateStr: window.formatDate(tempDate),
        dateDisplay: `${tempDate.getDate()}일`
      });
      tempDate.setDate(tempDate.getDate() + 1); 
    }
    return dates;
  }

  // ==========================================================================
  // 👁️ 1. 주간 뷰어 렌더링
  // ==========================================================================
  async renderViewer() {
    this.showLoading('클라우드에서 주간 데이터를 불러오는 중...'); // BaseView 기능 사용

    let html = `
      <div class="clean-viewer-board">
        <table>
          <tbody>
    `;

    const realTodayStr = window.formatDate(new Date());

    for (const d of this.getWeekDates()) {
      const dayData = await window.dbAPI.loadDayData(d.dateStr);
      
      const eventDoc = await window.getUserCol('events').doc(d.dateStr).get();
      let eventHtml = '<span style="color:#94a3b8;">-</span>';
      
      if (eventDoc.exists) {
        const eData = eventDoc.data();
        const parsedEvents = window.parseRawEventTextToEventList(eData.eventText || ''); 
        const finalEvents = (eData.eventList && eData.eventList.length > 0) ? eData.eventList : parsedEvents;
        
        if (finalEvents.length > 0) {
            eventHtml = window.generateEventBadgesHTML(finalEvents); 
        }
      }

      const periods = dayData.periods || {};
      const isToday = (d.dateStr === realTodayStr);
      const todayClass = isToday ? 'week-today-cell' : '';

      let dateColor = '#1e40af';
      if (d.dayOfWeekNum === 0) dateColor = '#ef4444';
      else if (d.dayOfWeekNum === 6) dateColor = '#3b82f6';

      html += `
        <tr>
          <td rowspan="${window.showClass ? 3 : 1}" class="${todayClass}" onclick="window.goToDay('${d.dateStr}')" style="width: 70px; vertical-align: middle; text-align: center; padding: 8px 4px; cursor: pointer;" title="${d.dateStr} 일 보기로 이동">
            <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
              <span style="font-size:1.8rem; font-weight:900; color:${dateColor}; line-height:1;">${d.day}</span>
              <span style="font-size:0.95rem; font-weight:600; color:#475569; line-height:1;">${d.dateDisplay}</span>
            </div>
          </td>
          <td style="width: 50px; font-weight: bold; background: #eff6ff; color: #1e40af; vertical-align: middle; text-align: center;">일정</td>
          <td colspan="${this.maxPeriod}" style="text-align: left; padding: 8px 10px; background: #f8fafc;">
              ${eventHtml}
          </td>
        </tr>
        <tr style="${window.showClass ? '' : 'display:none;'}">
          <td rowspan="2" style="font-weight: bold; background: #f1f5f9; color: #475569; vertical-align: middle; text-align: center;">수업</td>
          ${(window.periodNames || ["1","2","3","4","5","6"]).map(name => `<td style="font-weight: bold; background: #f8fafc; color: #334155; width: ${100 / this.maxPeriod}%; text-align: center;">${name}</td>`).join('')}
        </tr>
        <tr style="${window.showClass ? '' : 'display:none;'}">
          ${Array.from({ length: this.maxPeriod }).map((_, i) => {
            const p = i + 1;
            const pObj = periods[p] || {};
            let content = '';
            if (pObj.subject) content += `<div style="margin-bottom: 4px;"><span class="badge-tag">${pObj.subject}</span></div>`;
            if (pObj.memo) content += `<div class="clean-cell-memo">${pObj.memo}</div>`;
            return `<td style="vertical-align: top; text-align: left; padding: 6px 8px; height: var(--week-cell-height);">${content}</td>`;
          }).join('')}
        </tr>
      `;
    }

    html += `</tbody></table></div>`;
    this.container.innerHTML = html;
  }

  // ==========================================================================
  // ✏️ 2. 주간 에디터 렌더링
  // ==========================================================================
  async renderEditor() {
    this.showLoading('편집 화면을 준비 중...');

    let html = `
      <div class="table-container">
        <table>
          <tbody>
    `;

    const realTodayStr = window.formatDate(new Date());

    for (const d of this.getWeekDates()) {
      const dayData = await window.dbAPI.loadDayData(d.dateStr);
      
      const eventDoc = await window.getUserCol('events').doc(d.dateStr).get();
      let eventList = [];
      if (eventDoc.exists) {
        const eData = eventDoc.data();
        if (eData.eventList && eData.eventList.length > 0) {
          eventList = eData.eventList;
        } else if (eData.eventText) {
          eventList = window.parseRawEventTextToEventList(eData.eventText);
        }
      }
      
      // 상태 저장
      window[`tempEvents_${d.dateStr}`] = eventList; 
      
      let compactEditorHtml = `<div id="compact-events-${d.dateStr}" style="display:flex; flex-direction:column; gap:4px;">`;
      compactEditorHtml += this.generateCompactEventEditor(d.dateStr);
      compactEditorHtml += `</div>`; 

      const periods = dayData.periods || {};
      const isToday = (d.dateStr === realTodayStr);
      const todayClass = isToday ? 'week-today-cell' : '';

      let dateColor = '#1e40af';
      if (d.dayOfWeekNum === 0) dateColor = '#ef4444';
      else if (d.dayOfWeekNum === 6) dateColor = '#3b82f6';

      html += `
        <tr data-week-date="${d.dateStr}">
          <td rowspan="${window.showClass ? 3 : 1}" class="${todayClass}" onclick="window.goToDay('${d.dateStr}')" style="width: 70px; vertical-align: middle; text-align: center; padding: 8px 4px; cursor: pointer;" title="${d.dateStr} 일 보기로 이동">
            <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
              <span style="font-size:1.8rem; font-weight:900; color:${dateColor}; line-height:1;">${d.day}</span>
              <span style="font-size:0.95rem; font-weight:600; color:#475569; line-height:1;">${d.dateDisplay}</span>
            </div>
          </td>
          <td style="width: 50px; font-weight: bold; background: #eff6ff; color: #1e40af; vertical-align: middle; text-align: center;">
              일정<br>
              <button onclick="window.weekViewInstance.addCompactEvent('${d.dateStr}')" style="margin-top:6px; background:#dbeafe; color:#2563eb; border:1px dashed #93c5fd; border-radius:4px; padding:2px 8px; cursor:pointer; font-weight:bold; font-size:1.1rem; box-shadow:0 1px 2px rgba(0,0,0,0.05);" title="일정 추가">+</button>
          </td>
          <td colspan="${this.maxPeriod}" style="text-align: left; padding: 8px 10px; background: #f8fafc;">
              ${compactEditorHtml}
          </td>
        </tr>
        <tr style="${window.showClass ? '' : 'display:none;'}">
          <td rowspan="2" style="font-weight: bold; background: #f1f5f9; color: #475569; vertical-align: middle; text-align: center;">수업</td>
          ${(window.periodNames || ["1","2","3","4","5","6"]).map(name => `<td style="font-weight: bold; background: #f8fafc; color: #334155; width: ${100 / this.maxPeriod}%; text-align: center;">${name}</td>`).join('')}
        </tr>
        <tr data-week-schedule-date="${d.dateStr}" style="${window.showClass ? '' : 'display:none;'}">
          ${Array.from({ length: this.maxPeriod }).map((_, i) => {
            const p = i + 1;
            const pObj = periods[p] || {};
            const cellText = (pObj.subject ? `[${pObj.subject}] ` : '') + (pObj.memo || '');
            return `<td class="editable-cell week-period-cell" data-p="${p}" contenteditable="true" style="vertical-align: top; height: var(--week-cell-height); text-align: left; padding: 6px 8px; white-space: pre-wrap;">${cellText}</td>`;
          }).join('')}
        </tr>
      `;
    }

    html += `</tbody></table></div>`;
    this.container.innerHTML = html;
  }

  // ==========================================================================
  // ⚙️ 3. 주간 컴팩트 에디터 제어 헬퍼
  // ==========================================================================
  generateCompactEventEditor(dateStr) {
      const list = window[`tempEvents_${dateStr}`] || [];
      const labels = window.getEventLabels();
      let html = '';
      
      list.forEach((e, idx) => {
          let options = labels.map(l => `<option value="${l.name}" ${e.label === l.name ? 'selected' : ''}>${l.name}</option>`).join('');
          options += `<option disabled>──────────</option><option value="__setting__">⚙️ 라벨 설정...</option>`;

          html += `
          <div class="compact-event-row" data-idx="${idx}" style="display:flex; gap:4px; align-items:center;">
              <select onchange="if(this.value === '__setting__') { window.openEventLabelModal(); this.value='${e.label}'; } else { window.weekViewInstance.updateCompactEvent('${dateStr}', ${idx}, 'label', this.value); }" style="padding:2px; font-size:0.85rem; border:1px solid #cbd5e1; border-radius:4px; background:#fff; color:#1e40af; outline:none;">
                  ${options}
              </select>
              <input type="text" value="${e.content}" oninput="window.weekViewInstance.updateCompactEvent('${dateStr}', ${idx}, 'content', this.value)" placeholder="일정 입력" style="flex:1; padding:2px 4px; font-size:0.95rem; border:1px solid #cbd5e1; border-radius:4px; outline:none;">
              <button onclick="window.weekViewInstance.removeCompactEvent('${dateStr}', ${idx})" style="background:none; border:none; color:#ef4444; font-size:1rem; cursor:pointer;" title="삭제">✖</button>
          </div>`;
      });
      return html;
  }

  updateCompactEvent(dateStr, idx, field, value) {
      window.hasUnsavedChanges = true;
      window[`tempEvents_${dateStr}`][idx][field] = value;
  }

  addCompactEvent(dateStr) {
      window.hasUnsavedChanges = true;
      const defaultLabel = window.getEventLabels()[0]?.name || '일정';
      window[`tempEvents_${dateStr}`].push({ label: defaultLabel, content: '' });
      document.getElementById(`compact-events-${dateStr}`).innerHTML = this.generateCompactEventEditor(dateStr);
  }

  removeCompactEvent(dateStr, idx) {
      window.hasUnsavedChanges = true;
      window[`tempEvents_${dateStr}`].splice(idx, 1);
      document.getElementById(`compact-events-${dateStr}`).innerHTML = this.generateCompactEventEditor(dateStr);
  }

  // ==========================================================================
  // 💾 4. 주간 일괄 저장 처리 (부모의 save 메서드 구현)
  // ==========================================================================
  async save() {
    for (const d of this.getWeekDates()) {
      const rawList = window[`tempEvents_${d.dateStr}`] || [];
      const validEvents = rawList.filter(e => e.content.trim() !== '');
      const cleanEventText = window.formatEventListToText(validEvents);

      await window.getUserCol('events').doc(d.dateStr).set({
          eventList: validEvents,
          eventText: cleanEventText, 
          updatedAt: Date.now()
      });

      let isSkipDay = false;
      for (const e of validEvents) {
          if (window.isSkipLabel(e.label)) {
              isSkipDay = true;
              break;
          }
      }
      
      const scheduleRow = document.querySelector(`tr[data-week-schedule-date="${d.dateStr}"]`);
      
      if (scheduleRow) {
        let existingPeriods = {};
        try {
          const existingData = await window.dbAPI.loadDayData(d.dateStr);
          existingPeriods = existingData.periods || {};
        } catch(e) {}

        const periodsData = {};
        const periodCells = scheduleRow.querySelectorAll('.week-period-cell');

        periodCells.forEach(cell => {
          const p = cell.getAttribute('data-p');
          const text = (cell.innerText || cell.textContent || '').trim();
          
          let subject = '';
          let memo = text;

          const match = text.match(/^\[(.*?)\]\s*([\s\S]*)$/);
          if (match) {
            subject = match[1];
            memo = match[2];
          }

          if (isSkipDay) subject = '';

          periodsData[p] = { 
            subject: subject, 
            memo: memo, 
            supplies: existingPeriods[p] ? existingPeriods[p].supplies : ''
          };
        });

        await window.dbAPI.saveSchedule(d.dateStr, periodsData);
      }
    }
  }
}

// ==========================================================================
// 🔌 하위 호환성 유지 브릿지 (app.js 연동)
// ==========================================================================
window.weekViewInstance = new WeekView(document.getElementById("main-view"));

window.renderWeekViewer = (container) => {
  window.weekViewInstance.container = container;
  window.weekViewInstance.renderViewer();
};

window.renderWeekEditor = (container) => {
  window.weekViewInstance.container = container;
  window.weekViewInstance.renderEditor();
};

window.saveWeekDataFromEditor = () => window.weekViewInstance.save();
