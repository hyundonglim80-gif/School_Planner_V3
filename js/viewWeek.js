// js/viewWeek.js

window.getWeekDates = function() {
  const dates = [];
  const tempDate = new Date(window.currentDate);
  const day = tempDate.getDay();
  const diffToMon = tempDate.getDate() - day + (day === 0 ? -6 : 1);
  tempDate.setDate(diffToMon); 

  const dayNames = ["월", "화", "수", "목", "금"];
  for (let i = 0; i < 5; i++) {
    dates.push({
      day: dayNames[i],
      dateStr: window.formatDate(tempDate),
      dateDisplay: `${String(tempDate.getMonth()+1).padStart(2,'0')}/${String(tempDate.getDate()).padStart(2,'0')}`
    });
    tempDate.setDate(tempDate.getDate() + 1); 
  }
  return dates;
};

// 1. 주간 뷰어 모드 
window.renderWeekViewer = async function(container) {
  container.innerHTML = `<p style="text-align:center; padding: 40px; color:#64748b;">⏳ 클라우드에서 주간 데이터를 불러오는 중...</p>`;

  let html = `
    <div class="clean-viewer-board">
      <table style="min-width: 500px; text-align: center; border-collapse: collapse;">
        <tbody>
  `;

  const realTodayStr = window.formatDate(new Date()); // 💡 진짜 오늘 날짜 구하기

  for (const d of window.getWeekDates()) {
    const dayData = await window.dbAPI.loadDayData(d.dateStr);
    const eventText = dayData.eventText || '-';
    const periods = dayData.periods || {};

    // 💡 오늘 날짜인지 확인하여 스타일 결정
    const isToday = (d.dateStr === realTodayStr);
    const dateCellBg = isToday ? '#eff6ff' : '#f8fafc';
    const dateCellBorder = isToday ? '3px solid #2563eb' : '1px solid #cbd5e1';

    html += `
      <tr>
        <td rowspan="3" style="width: 50px; font-weight: bold; background: ${dateCellBg}; border:${dateCellBorder}; vertical-align: middle;">
          ${d.day}<br><span style="font-size:1.5rem; color:#64748b;">${d.dateDisplay}</span>
        </td>
        <td style="width: 50px; font-weight: bold; background: #eff6ff; color: #1e40af; border: 1px solid #cbd5e1; vertical-align: middle;">일정</td>
        <td colspan="6" style="text-align: left; padding: 8px 10px; font-size: 1.5rem; color: #0369a1; background: #f0f9ff; border: 1px solid #cbd5e1;">${eventText}</td>
      </tr>
      <tr>
        <td rowspan="2" style="font-weight: bold; background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; vertical-align: middle;">수업</td>
        ${[1, 2, 3, 4, 5, 6].map(p => `<td style="font-weight: bold; background: #f8fafc; color: #334155; width: 10%; border: 1px solid #cbd5e1;">${p}교시</td>`).join('')}
      </tr>
      <tr>
        ${[1, 2, 3, 4, 5, 6].map(p => {
          const pObj = periods[p] || {};
          return `<td style="vertical-align: top; height: 60px; text-align: left; padding: 8px; border: 1px solid #cbd5e1;">
              ${pObj.subject ? `<div style="margin-bottom: 4px;"><span class="badge-tag">${pObj.subject}</span></div>` : ''}
              ${pObj.memo ? `<div class="clean-cell-memo">${pObj.memo}</div>` : ''}
            </td>`;
        }).join('')}
      </tr>
    `;
  }

  html += `</tbody></table></div>`;
  container.innerHTML = html;
};

// 2. 주간 에디터 모드
window.renderWeekEditor = async function(container) {
  container.innerHTML = `<p style="text-align:center; padding: 40px; color:#64748b;">⏳ 편집 화면을 준비 중...</p>`;

  let html = `
    <div class="table-container">
      <table style="min-width: 800px; text-align: center; border-collapse: collapse;">
        <tbody>
  `;

  const realTodayStr = window.formatDate(new Date()); // 💡 진짜 오늘 날짜 구하기

  for (const d of window.getWeekDates()) {
    const dayData = await window.dbAPI.loadDayData(d.dateStr);
    const eventText = dayData.eventText || '';
    const periods = dayData.periods || {};

    // 💡 오늘 날짜인지 확인하여 스타일 결정
    const isToday = (d.dateStr === realTodayStr);
    const dateCellBg = isToday ? '#eff6ff' : '#f8fafc';
    const dateCellBorder = isToday ? '3px solid #2563eb' : '1px solid #cbd5e1';

    html += `
      <tr data-week-date="${d.dateStr}">
        <td rowspan="3" style="width: 60px; font-weight: bold; background: ${dateCellBg}; border:${dateCellBorder}; vertical-align: middle;">
          ${d.day}<br><span style="font-size:1.5rem; color:#64748b;">${d.dateDisplay}</span>
        </td>
        <td style="width: 50px; font-weight: bold; background: #eff6ff; color: #1e40af; border: 1px solid #cbd5e1; vertical-align: middle;">일정</td>
        <td colspan="6" class="editable-cell week-event-cell" contenteditable="true" style="text-align: left; padding: 8px 10px; font-size: 1.5rem; color: #0369a1; background: #f0f9ff; border: 1px solid #cbd5e1;">${eventText}</td>
      </tr>
      <tr>
        <td rowspan="2" style="font-weight: bold; background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; vertical-align: middle;">수업</td>
        ${[1, 2, 3, 4, 5, 6].map(p => `<td style="font-weight: bold; background: #f8fafc; color: #334155; width: 14%; border: 1px solid #cbd5e1;">${p}교시</td>`).join('')}
      </tr>
      <tr data-week-schedule-date="${d.dateStr}">
        ${[1, 2, 3, 4, 5, 6].map(p => {
          const pObj = periods[p] || {};
          const cellText = (pObj.subject ? `[${pObj.subject}] ` : '') + (pObj.memo || '');
          return `<td class="editable-cell week-period-cell" data-p="${p}" contenteditable="true" style="vertical-align: top; height: 60px; text-align: left; padding: 8px; border: 1px solid #cbd5e1; white-space: pre-wrap;">${cellText}</td>`;
        }).join('')}
      </tr>
    `;
  }

  html += `</tbody></table></div>`;
  container.innerHTML = html;
};

// 3. [저장 버튼 실행]
window.saveWeekDataFromEditor = async function() {
  for (const d of window.getWeekDates()) {
    const eventRow = document.querySelector(`tr[data-week-date="${d.dateStr}"]`);
    if (eventRow) {
      const eventCell = eventRow.querySelector('.week-event-cell');
      const eventText = eventCell ? (eventCell.innerText || eventCell.textContent || '').trim() : '';
      await window.dbAPI.saveEvent(d.dateStr, eventText);
    }

    const scheduleRow = document.querySelector(`tr[data-week-schedule-date="${d.dateStr}"]`);
    if (scheduleRow) {
      const periodsData = {};
      const periodCells = scheduleRow.querySelectorAll('.week-period-cell');

      periodCells.forEach(cell => {
        const p = cell.getAttribute('data-p');
        const text = (cell.innerText || cell.textContent || '').trim();
        
        let subject = '';
        let memo = text;

        const match = text.match(/^\[(.*?)\]\s*(.*)$/);
        if (match) {
          subject = match[1];
          memo = match[2];
        }

        periodsData[p] = { subject, memo, supplies: '' };
      });

      await window.dbAPI.saveSchedule(d.dateStr, periodsData);
    }
  }
};
