// js/viewWeek.js

// 💡 [전역 헬퍼] 다중 일정(라벨/내용)과 텍스트를 상호 변환하는 아주 똑똑한 엔진입니다.
if (!window.parseRawEventTextToEventList) {
  window.parseRawEventTextToEventList = function(rawText) {
      if (!rawText || !rawText.trim()) return [];
      const lines = rawText.split('\n');
      const eventList = [];
      lines.forEach(line => {
          let t = line.trim();
          if(!t) return;
          // [라벨] 내용 형태인지 정규식으로 검사
          const match = t.match(/^\[(.*?)\]\s*(.*)$/);
          if (match) {
              eventList.push({ label: match[1].trim(), content: match[2].trim() });
          } else {
              // 괄호가 없다면 똑똑하게 판단 (기존 (휴일) 등은 전일행사로 취급)
              if (t.includes('(휴일)') || t.includes('(행사)')) {
                  eventList.push({ label: '전일행사', content: t });
              } else {
                  eventList.push({ label: '일정', content: t });
              }
          }
      });
      return eventList;
  };

  window.formatEventListToText = function(eventList) {
      if (!eventList || eventList.length === 0) return '';
      return eventList.map(e => `[${e.label}] ${e.content}`).join('\n');
  };
}

if (!window.goToDay) {
  window.goToDay = function(dateStr) {
    if (!dateStr) return;
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      window.currentDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      window.setScope('day');
    }
  };
}

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
// 👁️ 1. 주간 뷰어 모드 (일정 텍스트 그대로 표시 - 라벨 적용됨)
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
    
    // DB의 events 컬렉션에서 다중 일정을 불러와서 예쁜 텍스트로 합칩니다.
    const eventDoc = await window.getUserCol('events').doc(d.dateStr).get();
    let eventText = '-';
    if (eventDoc.exists) {
      const eData = eventDoc.data();
      if (eData.eventList && eData.eventList.length > 0) {
        eventText = window.formatEventListToText(eData.eventList);
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
      <tr>
        <td rowspan="3" class="${todayClass}" onclick="window.goToDay('${d.dateStr}')" style="width: 70px; vertical-align: middle; text-align: center; padding: 8px 4px; cursor: pointer;" title="${d.dateStr} 일 보기로 이동">
          <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
            <span style="font-size:1.8rem; font-weight:900; color:${dateColor}; line-height:1;">${d.day}</span>
            <span style="font-size:0.95rem; font-weight:600; color:#475569; line-height:1;">${d.dateDisplay}</span>
          </div>
        </td>
        <td style="width: 50px; font-weight: bold; background: #eff6ff; color: #1e40af; vertical-align: middle; text-align: center;">일정</td>
        <td colspan="6" style="text-align: left; padding: 8px 10px; font-size: var(--week-event-font-size); color: #0369a1; background: #f0f9ff; white-space: pre-wrap;">${eventText}</td>
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
// ✏️ 2. 주간 에디터 모드
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
    let eventText = '';
    if (eventDoc.exists) {
      const eData = eventDoc.data();
      if (eData.eventList && eData.eventList.length > 0) {
        eventText = window.formatEventListToText(eData.eventList);
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
        <td colspan="6" class="editable-cell week-event-cell" contenteditable="true" style="text-align: left; padding: 8px 10px; font-size: var(--week-event-font-size); color: #0369a1; background: #f0f9ff;">${eventText}</td>
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
// 💾 3. 주간 일괄 저장 처리 함수 ([전일행사] 처리 로직 완벽 적용)
// ==========================================================================
window.saveWeekDataFromEditor = async function() {
  for (const d of window.getWeekDates()) {
    let eventText = '';

    const eventRow = document.querySelector(`tr[data-week-date="${d.dateStr}"]`);
    if (eventRow) {
      const eventCell = eventRow.querySelector('.week-event-cell');
      eventText = eventCell ? (eventCell.innerText || eventCell.textContent || '').trim() : '';
      
      // 💡 [핵심] 주간 화면에서 수정된 다중 줄 텍스트를 구조화된 배열로 변환하여 DB에 저장
      const parsedEventList = window.parseRawEventTextToEventList(eventText);
      const cleanEventText = window.formatEventListToText(parsedEventList);

      await window.getUserCol('events').doc(d.dateStr).set({
          eventList: parsedEventList,
          eventText: cleanEventText, // 구버전 호환용 텍스트
          updatedAt: Date.now()
      });
      
      eventText = cleanEventText; // 아래 수업 지우기 판단을 위해 갱신
    }

    // 🎯 '전일행사' 자동 수업 삭제 필터 적용
    const isSkipDay = eventText.includes('(휴일)') || eventText.includes('(행사)') || eventText.includes('[전일행사]');
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

        // 🎯 전일행사면 과목(Subject)을 텅 비움
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
