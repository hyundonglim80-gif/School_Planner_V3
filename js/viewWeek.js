// js/viewWeek.js

class WeekView extends window.BaseView {
  constructor(container) {
    super(container); 
  }

  getWeekDates() {
    const dates = [];
    const tempDate = new Date(this.currentDate);
    const day = tempDate.getDay();
    
    const diffToSun = tempDate.getDate() - day;
    tempDate.setDate(diffToSun); 

    const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
    
    for (let i = 0; i < 7; i++) {
      // 💡 [핵심 버그 수정] this.isWeekendVisible이 아닌 전역 변수 window.showWeekend를 참조하도록 수정
      if (!window.showWeekend && (i === 0 || i === 6)) {
        tempDate.setDate(tempDate.getDate() + 1);
        continue;
      }
      dates.push({
        day: dayNames[i], dayOfWeekNum: i,
        dateStr: window.formatDate(tempDate),
        dateDisplay: `${tempDate.getDate()}일`
      });
      tempDate.setDate(tempDate.getDate() + 1); 
    }
    return dates;
  }

  async renderViewer() {
    this.showLoading('클라우드에서 주간 데이터를 불러오는 중...'); 

    let html = `<div class="clean-viewer-board"><table><tbody>`;
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
            let processedEvents = finalEvents.map(e => ({
                ...e,
                labels: (e.labels && e.labels.length > 0) ? e.labels : (e.label ? [e.label] : ['기타'])
            }));
            eventHtml = window.generateEventBadgesHTML(processedEvents, d.dateStr); 
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

  async renderEditor() {
    this.showLoading('편집 화면을 준비 중...');

    let html = `<div class="table-container"><table><tbody>`;
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

  generateCompactEventEditor(dateStr) {
      const list = window[`tempEvents_${dateStr}`] || [];
      const labelObjs = window.getEventLabels();
      let html = '';
      
      list.forEach((e, idx) => {
          const eLabels = (e.labels && e.labels.length > 0) ? e.labels : (e.label ? [e.label] : []);
          
          let chipsHtml = `<div class="label-chip-container" style="margin:0; display:flex; flex-wrap:wrap; gap:4px; margin-bottom:4px;">`;
          labelObjs.forEach(labelObj => {
              const lName = labelObj.name;
              const isActive = eLabels.includes(lName);
              const activeClass = isActive ? 'active' : '';
              
              // 💡 핵심: 칩 클릭 코드에 isPeriod 분기 추가
              const clickCode = `
                  if (typeof window.isPeriodLabel === 'function' && window.isPeriodLabel('${lName}')) {
                      const ta = document.querySelector('.compact-event-row[data-idx="${idx}"] textarea');
                      window.openPeriodModal('${dateStr}', '${lName}', ta ? ta.value : '', function(isSaved){ if(isSaved) window.render(); });
                  } else {
                      window.weekViewInstance ? window.weekViewInstance.toggleCompactEventLabel('${dateStr}', ${idx}, '${lName}') : window.monthViewInstance.toggleCompactEventLabel('${dateStr}', ${idx}, '${lName}');
                  }
              `;
              
              chipsHtml += `<div class="label-chip ${activeClass}" onclick="${clickCode}" style="padding:2px 8px; font-size:0.8rem; min-width:auto;">${lName}</div>`;
          });
          chipsHtml += `</div>`;

          const isCompleted = !!e.completed;
          // 💡 핵심: '완료(이월)' 속성을 가진 라벨만 체크박스 활성화 여부 판별
          const canComplete = (typeof window.isForwardLabel === 'function' && eLabels.length > 0) ? window.isForwardLabel(eLabels[0]) : false;

          const inputStyle = (isCompleted && canComplete) ? 'text-decoration:line-through; color:#94a3b8; background:#e2e8f0;' : 'background:#fff; color:#1e293b;';

          // 💡 핵심: 완료 속성에 따라 체크박스 표시 여부 결정
          const checkboxHtml = canComplete 
              ? `<input type="checkbox" ${isCompleted ? 'checked' : ''} onchange="window.weekViewInstance ? window.weekViewInstance.updateCompactEvent('${dateStr}', ${idx}, 'completed', this.checked) : window.monthViewInstance.updateCompactEvent('${dateStr}', ${idx}, 'completed', this.checked); document.getElementById('compact-events-${dateStr}').innerHTML = window.weekViewInstance ? window.weekViewInstance.generateCompactEventEditor('${dateStr}') : window.monthViewInstance.generateCompactEventEditor('${dateStr}');" style="width:16px; height:16px; cursor:pointer;" title="완료 체크">`
              : '';

          html += `
          <div class="compact-event-row" data-idx="${idx}" style="border:1px solid #cbd5e1; border-radius:6px; padding:8px; margin-bottom:8px; background:#f8fafc; display:flex; flex-direction:column; gap:6px;">
              <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                  ${chipsHtml}
                  <div style="display:flex; align-items:center; gap:6px; flex-shrink:0;">
                      ${checkboxHtml}
                      <button onclick="window.weekViewInstance ? window.weekViewInstance.removeCompactEvent('${dateStr}', ${idx}) : window.monthViewInstance.removeCompactEvent('${dateStr}', ${idx})" style="background:none; border:none; color:#ef4444; font-size:1.1rem; cursor:pointer; padding:0; line-height:1;" title="삭제">✖</button>
                  </div>
              </div>
              <textarea placeholder="일정 내용을 입력하세요." style="width:100%; padding:6px 8px; font-size:0.95rem; border:1px solid #cbd5e1; border-radius:4px; outline:none; resize:none; min-height:40px; box-sizing:border-box; ${inputStyle}" onfocus="this.style.height = this.scrollHeight + 'px';" oninput="this.style.height = '40px'; this.style.height = this.scrollHeight + 'px'; window.weekViewInstance ? window.weekViewInstance.updateCompactEvent('${dateStr}', ${idx}, 'content', this.value) : window.monthViewInstance.updateCompactEvent('${dateStr}', ${idx}, 'content', this.value)">${e.content || ''}</textarea>
          </div>`;
      });
      return html;
  }

  toggleCompactEventLabel(dateStr, idx, labelName) {
      window.hasUnsavedChanges = true;
      const ev = window[`tempEvents_${dateStr}`][idx];
      if (!ev) return;
      ev.labels = ev.labels || (ev.label ? [ev.label] : []);
      if (ev.labels.includes(labelName)) {
          ev.labels = ev.labels.filter(l => l !== labelName);
      } else {
          ev.labels.push(labelName);
      }
      document.getElementById(`compact-events-${dateStr}`).innerHTML = this.generateCompactEventEditor(dateStr);
  }

  updateCompactEvent(dateStr, idx, field, value) {
      window.hasUnsavedChanges = true;
      if (window[`tempEvents_${dateStr}`][idx]) {
          window[`tempEvents_${dateStr}`][idx][field] = value;
      }
  }

  addCompactEvent(dateStr) {
      window.hasUnsavedChanges = true;
      if(!window[`tempEvents_${dateStr}`]) window[`tempEvents_${dateStr}`] = [];
      window[`tempEvents_${dateStr}`].push({ labels: [], content: '', completed: false });
      document.getElementById(`compact-events-${dateStr}`).innerHTML = this.generateCompactEventEditor(dateStr);
  }

  removeCompactEvent(dateStr, idx) {
      window.hasUnsavedChanges = true;
      window[`tempEvents_${dateStr}`].splice(idx, 1);
      document.getElementById(`compact-events-${dateStr}`).innerHTML = this.generateCompactEventEditor(dateStr);
  }

  async save() {
    for (const d of this.getWeekDates()) {
      const rawList = window[`tempEvents_${d.dateStr}`] || [];
      // 💡 [핵심 버그 수정] 내용이 비어 있어도 라벨(태그)이 하나라도 체크되어 있다면 날아가지 않고 저장되도록 수정
      const validEvents = rawList.filter(e => e.content.trim() !== '' || (e.labels && e.labels.length > 0));
      const cleanEventText = window.formatEventListToText(validEvents);

      await window.getUserCol('events').doc(d.dateStr).set({
          eventList: validEvents,
          eventText: cleanEventText, 
          updatedAt: Date.now()
      });

      let isSkipDay = false;
      for (const e of validEvents) {
          if (e.labels && e.labels.some(l => window.isSkipLabel(l))) {
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
          
          let subject = ''; let memo = text;
          const match = text.match(/^\[(.*?)\]\s*([\s\S]*)$/);
          if (match) { subject = match[1]; memo = match[2]; }
          if (isSkipDay) subject = '';

          periodsData[p] = { 
            subject: subject, memo: memo, 
            supplies: existingPeriods[p] ? existingPeriods[p].supplies : ''
          };
        });
        await window.dbAPI.saveSchedule(d.dateStr, periodsData);
      }
    }
  }
}

window.weekViewInstance = new WeekView(document.getElementById("main-view"));
window.renderWeekViewer = (container) => { window.weekViewInstance.container = container; window.weekViewInstance.renderViewer(); };
window.renderWeekEditor = (container) => { window.weekViewInstance.container = container; window.weekViewInstance.renderEditor(); };
window.saveWeekDataFromEditor = () => window.weekViewInstance.save();
