// js/viewWeek.js

/**
 * 💡 현재 선택된 날짜 기준으로 이번 주 [월, 화, 수, 목, 금] 날짜 배열 자동 생성
 */
window.getWeekDates = function() {
  const dates = [];
  const tempDate = new Date(window.currentDate);
  const day = tempDate.getDay();
  const diffToMon = tempDate.getDate() - day + (day === 0 ? -6 : 1);
  tempDate.setDate(diffToMon); // 월요일로 맞춤

  const dayNames = ["월", "화", "수", "목", "금"];
  for (let i = 0; i < 5; i++) {
    dates.push({
      day: dayNames[i],
      dateStr: window.formatDate(tempDate),
      // 💡 월 표기를 빼고 'O일' 형태로만 출력하도록 수정
      dateDisplay: `${tempDate.getDate()}일`
    });
    tempDate.setDate(tempDate.getDate() + 1); // 하루씩 더함
  }
  return dates;
};

// ==========================================================================
// 👁️ 1. 주간 뷰어 모드 (오늘 날짜 강조 + 클라우드 수업/메모 조회)
// ==========================================================================
window.renderWeekViewer = async function(container) {
  container.innerHTML = `<p style="text-align:center; padding: 40px; color:#64748b; font-weight:bold; font-size:var(--font-base);">⏳ 클라우드에서 주간 데이터를 불러오는 중...</p>`;

  let html = `
    <div class="clean-viewer-board">
      <table>
        <tbody>
  `;

  const realTodayStr = window.formatDate(new Date()); // 오늘 날짜 감지

  for (const d of window.getWeekDates()) {
    const dayData = await window.dbAPI.loadDayData(d.dateStr);
    const eventText = dayData.eventText || '-';
    const periods = dayData.periods || {};

    // 오늘 날짜 셀 테두리 및 배경 강조 처리
    const isToday = (d.dateStr === realTodayStr);
    const todayClass = isToday ? 'week-today-cell' : '';

    html += `
      <tr>
        <td rowspan="3" class="${todayClass}" style="width: 70px; vertical-align: middle; text-align: center; padding: 8px 4px;">
          <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
            <span style="font-size:1.8rem; font-weight:900; color:#1e40af; line-height:1;">${d.day}</span>
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
// ✏️ 2. 주간 에디터 모드 (스프레드시트 형태 직접 입력)
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
    const eventText = dayData.eventText || '';
    const periods = dayData.periods || {};

    const isToday = (d.dateStr === realTodayStr);
    const todayClass = isToday ? 'week-today-cell' : '';

    html += `
      <tr data-week-date="${d.dateStr}">
        <td rowspan="3" class="${todayClass}" style="width: 70px; vertical-align: middle; text-align: center; padding: 8px 4px;">
          <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
            <span style="font-size:1.8rem; font-weight:900; color:#1e40af; line-height:1;">${d.day}</span>
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
// 💾 3. 주간 일괄 저장 처리 함수 (💡 휴일/행사 수업 자동 삭제 로직 추가)
// ==========================================================================
window.saveWeekDataFromEditor = async function() {
  for (const d of window.getWeekDates()) {
    let eventText = '';

    // 1) 날짜별 일정 저장
    const eventRow = document.querySelector(`tr[data-week-date="${d.dateStr}"]`);
    if (eventRow) {
      const eventCell = eventRow.querySelector('.week-event-cell');
      eventText = eventCell ? (eventCell.innerText || eventCell.textContent || '').trim() : '';
      await window.dbAPI.saveEvent(d.dateStr, eventText);
    }

    // 💡 [B방식 적용] 일정에 '(휴일)' 또는 '(행사)' 포함 여부 검사
    const isSkipDay = eventText.includes('(휴일)') || eventText.includes('(행사)');

    // 2) 날짜별 교시 수업/메모 저장
    const scheduleRow = document.querySelector(`tr[data-week-schedule-date="${d.dateStr}"]`);
    if (scheduleRow) {
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

        // 🎯 휴일이나 행사일이면 수업 과목을 비움
        if (isSkipDay) {
          subject = '';
        }

        periodsData[p] = { subject, memo, supplies: '' };
      });

      await window.dbAPI.saveSchedule(d.dateStr, periodsData);
    }
  }
};
