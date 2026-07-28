// js/viewWeek.js

window.getWeekDates = function() {
  const dates = [];
  const tempDate = new Date(window.currentDate);
  const day = tempDate.getDay();
  
  const diffToSun = tempDate.getDate() - day;
  tempDate.setDate(diffToSun); 

  const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
  
  for (let i = 0; i < 7; i++) {
    if (!window.showWeekend && (i === 0 || i === 6)) {
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
};

// ==========================================================================
// 👁️ 1. 주간 뷰어 모드 
// ==========================================================================
window.renderWeekViewer = async function(container) {
  container.innerHTML = `<p style="text-align:center; padding: 40px; color:#64748b; font-weight:bold; font-size:var(--font-base);">⏳ 클라우드에서 주간 데이터를 불러오는 중...</p>`;

  let html = `
    <div class="clean-viewer-board">
      <table>
        <tbody>
  `;

  const realTodayStr = window.formatDate(new Date());

  for (const d of window.getWeekDates()) {
    const dayData = await window.dbAPI.loadDayData(d.dateStr);
    
    // 💡 이벤트 리스트 로드 및 HTML 뱃지 생성
    const eventDoc = await window.getUserCol('events').doc(d.dateStr).get();
    let eventHtml = '<span style="color:#94a3b8;">-</span>';
    
    if (eventDoc.exists) {
      const eData = eventDoc.data();
      const parsedEvents = window.parseRawEventTextToEventList(eData.eventText || ''); 
      const finalEvents = (eData.eventList && eData.eventList.length > 0) ? eData.eventList : parsedEvents;
      
      if (finalEvents.length > 0) {
          eventHtml = window.generateEventBadgesHTML(finalEvents); // 🎯 뱃지로 변환
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
        <td rowspan="3" class="${todayClass}" onclick="window.goToDay('${d.dateStr}')" style="width: 70px; vertical-align: middle; text-align: center; padding: 8px 4px; cursor: pointer;" title="${d.dateStr} 일 보기로 이동">
          <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
            <span style="font-size:1.8rem; font-weight:900; color:${dateColor}; line-height:1;">${d.day}</span>
            <span style="font-size:0.95rem; font-weight:600; color:#475569; line-height:1;">${d.dateDisplay}</span>
          </div>
        </td>
        <td style="width: 50px; font-weight: bold; background: #eff6ff; color: #1e40af; vertical-align: middle; text-align: center;">일정</td>
        <td colspan="6" style="text-align: left; padding: 8px 10px; background: #f8fafc;">
            ${eventHtml}
        </td>
      </tr>
      <tr>
        <td rowspan="2" style="font-weight: bold; background: #f1f5f9; color: #475569; vertical-align: middle; text-align: center;">수업</td>
        ${[1, 2, 3, 4, 5, 6].map(p => `<td style="font-weight: bold; background: #f8fafc; color: #334155; width: 14%; text-align: center;">${p}교시</td>`).join('')}
      </tr>
      <tr>
        ${[1, 2, 3, 4, 5, 6].map(p => {
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
  container.innerHTML = html;
};

// ==========================================================================
// ✏️ 2. 주간 에디터 모드 (컴팩트 일정 입력 UI 적용)
// ==========================================================================
window.renderWeekEditor = async function(container) {
  container.innerHTML = `<p style="text-align:center; padding: 40px; color:#64748b; font-weight:bold; font-size:var(--font-base);">⏳ 편집 화면을 준비 중...</p>`;

  let html = `
    <div class="table-container">
      <table>
        <tbody>
  `;

  const realTodayStr = window.formatDate(new Date());

  for (const d of window.getWeekDates()) {
    const dayData = await window.dbAPI.loadDayData(d.dateStr);
    
    // DB 조회
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
    
    // 💡 에디터용 컴팩트 HTML 생성
    window[`tempEvents_${d.dateStr}`] = eventList; // 임시 메모리 저장
    let compactEditorHtml = `<div id="compact-events-${d.dateStr}" style="display:flex; flex-direction:column; gap:4px;">`;
    compactEditorHtml += window.generateCompactEventEditor(d.dateStr);
    compactEditorHtml += `</div>
        <button onclick="addCompactEvent('${d.dateStr}')" style="margin-top:4px; font-size:0.8rem; background:#e0f2fe; color:#2563eb; border:1px dashed #93c5fd; border-radius:4px; padding:2px 6px; cursor:pointer;">+ 일정 추가</button>
    `;

    const periods = dayData.periods || {};
    const isToday = (d.dateStr === realTodayStr);
    const todayClass = isToday ? 'week-today-cell' : '';

    let dateColor = '#1e40af';
    if (d.dayOfWeekNum === 0) dateColor = '#ef4444';
    else if (d.dayOfWeekNum === 6) dateColor = '#3b82f6';

    html += `
      <tr data-week-date="${d.dateStr}">
        <td rowspan="3" class="${todayClass}" onclick="window.goToDay('${d.dateStr}')" style="width: 70px; vertical-align: middle; text-align: center; padding: 8px 4px; cursor: pointer;" title="${d.dateStr} 일 보기로 이동">
          <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
            <span style="font-size:1.8rem; font-weight:900; color:${dateColor}; line-height:1;">${d.day}</span>
            <span style="font-size:0.95rem; font-weight:600; color:#475569; line-height:1;">${d.dateDisplay}</span>
          </div>
        </td>
        <td style="width: 50px; font-weight: bold; background: #eff6ff; color: #1e40af; vertical-align: middle; text-align: center;">일정</td>
        <td colspan="6" style="text-align: left; padding: 8px 10px; background: #f8fafc;">
            ${compactEditorHtml}
        </td>
      </tr>
      <tr>
        <td rowspan="2" style="font-weight: bold; background: #f1f5f9; color: #475569; vertical-align: middle; text-align: center;">수업</td>
        ${[1, 2, 3, 4, 5, 6].map(p => `<td style="font-weight: bold; background: #f8fafc; color: #334155; width: 14%; text-align: center;">${p}교시</td>`).join('')}
      </tr>
      <tr data-week-schedule-date="${d.dateStr}">
        ${[1, 2, 3, 4, 5, 6].map(p => {
          const pObj = periods[p] || {};
          const cellText = (pObj.subject ? `[${pObj.subject}] ` : '') + (pObj.memo || '');
          return `<td class="editable-cell week-period-cell" data-p="${p}" contenteditable="true" style="vertical-align: top; height: var(--week-cell-height); text-align: left; padding: 6px 8px; white-space: pre-wrap;">${cellText}</td>`;
        }).join('')}
      </tr>
    `;
  }

  html += `</tbody></table></div>`;
  container.innerHTML = html;
};

// 💡 컴팩트 에디터 그리기 헬퍼 함수
window.generateCompactEventEditor = function(dateStr) {
    const list = window[`tempEvents_${dateStr}`] || [];
    const labels = window.getEventLabels();
    let html = '';
    
    list.forEach((e, idx) => {
        let options = labels.map(l => `<option value="${l.name}" ${e.label === l.name ? 'selected' : ''}>${l.name}</option>`).join('');
        html += `
        <div class="compact-event-row" data-idx="${idx}" style="display:flex; gap:4px; align-items:center;">
            <select onchange="updateCompactEvent('${dateStr}', ${idx}, 'label', this.value)" style="padding:2px; font-size:0.85rem; border:1px solid #cbd5e1; border-radius:4px; background:#fff; color:#1e40af; outline:none;">
                ${options}
            </select>
            <input type="text" value="${e.content}" oninput="updateCompactEvent('${dateStr}', ${idx}, 'content', this.value)" placeholder="일정 입력" style="flex:1; padding:2px 4px; font-size:0.95rem; border:1px solid #cbd5e1; border-radius:4px; outline:none;">
            <button onclick="removeCompactEvent('${dateStr}', ${idx})" style="background:none; border:none; color:#ef4444; font-size:1rem; cursor:pointer;" title="삭제">✖</button>
        </div>`;
    });
    return html;
};

// 💡 컴팩트 에디터 제어 함수들
window.updateCompactEvent = function(dateStr, idx, field, value) {
    window.hasUnsavedChanges = true;
    window[`tempEvents_${dateStr}`][idx][field] = value;
};
window.addCompactEvent = function(dateStr) {
    window.hasUnsavedChanges = true;
    const defaultLabel = window.getEventLabels()[0]?.name || '일정';
    window[`tempEvents_${dateStr}`].push({ label: defaultLabel, content: '' });
    document.getElementById(`compact-events-${dateStr}`).innerHTML = window.generateCompactEventEditor(dateStr);
};
window.removeCompactEvent = function(dateStr, idx) {
    window.hasUnsavedChanges = true;
    window[`tempEvents_${dateStr}`].splice(idx, 1);
    document.getElementById(`compact-events-${dateStr}`).innerHTML = window.generateCompactEventEditor(dateStr);
};


// ==========================================================================
// 💾 3. 주간 일괄 저장 처리 함수
// ==========================================================================
window.saveWeekDataFromEditor = async function() {
  for (const d of window.getWeekDates()) {
    
    // 💡 임시 메모리에 있던 컴팩트 이벤트 리스트를 필터링하여 가져옴
    const rawList = window[`tempEvents_${d.dateStr}`] || [];
    const validEvents = rawList.filter(e => e.content.trim() !== '');
    const cleanEventText = window.formatEventListToText(validEvents);

    await window.getUserCol('events').doc(d.dateStr).set({
        eventList: validEvents,
        eventText: cleanEventText, 
        updatedAt: Date.now()
    });

    // 🎯 글로벌 헬퍼를 이용해 '수업 삭제' 속성 판별
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

        // 🎯 삭제 조건이면 텅 비움
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
};
