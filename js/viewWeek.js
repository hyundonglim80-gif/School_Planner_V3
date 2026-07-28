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
// 👁️ 1. 주간 뷰어 모드 (뱃지 렌더링 적용)
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
      const parsedEvents = window.parseRawEventTextToEventList(eData.eventText || ''); // 하위호환
      const finalEvents = (eData.eventList && eData.eventList.length > 0) ? eData.eventList : parsedEvents;
      
      if (finalEvents.length > 0) {
          eventHtml = window.generateEventBadgesHTML(finalEvents); // 🎯 공통 뱃지 생성기 사용
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
        <td colspan="6" style="text-align: left; padding: 8px 10px; background: #f0f9ff;">${eventHtml}</td>
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
// ✏️ 2. 주간 에디터 모드 (다중 텍스트 파싱)
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
    
    const eventDoc = await window.getUserCol('events').doc(d.dateStr).get();
    let eventText = '';
    if (eventDoc.exists) {
      const eData = eventDoc.data();
      if (eData.eventList && eData.eventList.length > 0) {
        eventText = window.formatEventListToText(eData.eventList); // 편집창엔 [라벨] 텍스트 로 표시
      } else if (eData.eventText) {
        eventText = eData.eventText;
      }
    }

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
        <td colspan="6" class="editable-cell week-event-cell" contenteditable="true" style="text-align: left; padding: 8px 10px; font-size: var(--week-event-font-size); color: #0369a1; background: #f0f9ff; white-space:pre-wrap;">${eventText}</td>
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

// ==========================================================================
// 💾 3. 주간 일괄 저장 처리 함수 (동적 라벨 확인 로직 적용)
// ==========================================================================
window.saveWeekDataFromEditor = async function() {
  for (const d of window.getWeekDates()) {
    let eventTextRaw = '';

    const eventRow = document.querySelector(`tr[data-week-date="${d.dateStr}"]`);
    if (eventRow) {
      const eventCell = eventRow.querySelector('.week-event-cell');
      eventTextRaw = eventCell ? (eventCell.innerText || eventCell.textContent || '').trim() : '';
      
      const parsedEventList = window.parseRawEventTextToEventList(eventTextRaw);
      const cleanEventText = window.formatEventListToText(parsedEventList);

      await window.getUserCol('events').doc(d.dateStr).set({
          eventList: parsedEventList,
          eventText: cleanEventText, 
          updatedAt: Date.now()
      });
      
      eventTextRaw = cleanEventText; // 재할당
    }

    // 🎯 글로벌 헬퍼를 이용해 텍스트 내에 '수업 삭제' 속성을 가진 라벨이 있는지 확인
    const isSkipDay = window.checkSkipConditionFromText(eventTextRaw);
    
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

        // 🎯 삭제 조건 라벨이 있다면 과목(Subject)을 텅 비움
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
