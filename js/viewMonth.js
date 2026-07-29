//js/viewMonth.js

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

// ==========================================================================
// 👁️ 1. 월간 뷰어 모드
// ==========================================================================
window.renderMonthViewer = async function(container) {
  container.innerHTML = `<p style="text-align:center; padding: 40px; color:#64748b; font-weight:bold; font-size:var(--font-base);">⏳ 클라우드에서 월간 일정을 불러오는 중...</p>`;

  if (!window.db) return;

  let html = `<div class="calendar-grid" style="grid-template-columns: repeat(${window.showWeekend ? 7 : 5}, 1fr);">`;
  
  const days = window.showWeekend ? ['일','월','화','수','목','금','토'] : ['월','화','수','목','금'];
  days.forEach(d => {
    let colorStyle = '';
    if (d === '일') colorStyle = 'color:#ef4444;';
    else if (d === '토') colorStyle = 'color:#3b82f6;';
    html += `<div class="calendar-header" style="${colorStyle}">${d}</div>`;
  });

  const y = window.currentDate.getFullYear();
  const m = window.currentDate.getMonth();
  const firstDay = new Date(y, m, 1).getDay();
  const lastDate = new Date(y, m + 1, 0).getDate();

  let currentDay = 1;
  let row = 0;
  const todayStr = window.formatDate(new Date());

  const dayDataPromises = [];
  for (let i = 1; i <= lastDate; i++) {
      dayDataPromises.push(window.dbAPI.loadDayData(window.formatDate(new Date(y, m, i))));
  }
  const monthDataArray = await Promise.all(dayDataPromises);

  const eventSnap = await window.getUserCol('events')
      .where(firebase.firestore.FieldPath.documentId(), '>=', window.formatDate(new Date(y, m, 1)))
      .where(firebase.firestore.FieldPath.documentId(), '<=', window.formatDate(new Date(y, m, lastDate)))
      .get();
      
  const eventMap = {};
  eventSnap.forEach(doc => { eventMap[doc.id] = doc.data(); });

  while (currentDay <= lastDate) {
    for (let i = 0; i < 7; i++) {
      if (!window.showWeekend && (i === 0 || i === 6)) {
        if (row === 0 && i < firstDay) {}
        else if (currentDay <= lastDate) { currentDay++; }
        continue;
      }

      if (row === 0 && i < firstDay) {
        html += `<div class="calendar-cell empty-cell"></div>`;
      } else if (currentDay > lastDate) {
        html += `<div class="calendar-cell empty-cell"></div>`;
      } else {
        const dateObj = new Date(y, m, currentDay);
        const dateStr = window.formatDate(dateObj);
        const isToday = (dateStr === todayStr);
        const todayClass = isToday ? 'month-today-cell' : '';

        let dateColor = '#334155';
        if (i === 0) dateColor = '#ef4444';
        else if (i === 6) dateColor = '#3b82f6';

        let dayHtml = `<div class="calendar-cell ${todayClass}" onclick="window.goToDay('${dateStr}')" style="cursor:pointer; display:flex; flex-direction:column;">`;
        dayHtml += `<div class="month-date-number" style="color:${dateColor};">${currentDay}</div>`;

        const eData = eventMap[dateStr];
        if (eData) {
            let events = eData.eventList || window.parseRawEventTextToEventList(eData.eventText || '');
            if (events.length > 0) {
                dayHtml += `<div class="month-events-wrapper">`;
                events.forEach(e => {
                    if (e.content.trim() !== '') {
                        const isSkip = window.isSkipLabel(e.label);
                        const bg = isSkip ? '#fee2e2' : '#eff6ff';
                        const border = isSkip ? '#fca5a5' : '#bfdbfe';
                        const color = isSkip ? '#ef4444' : '#2563eb';
                        dayHtml += `<div style="font-size:0.75rem; background:${bg}; border:1px solid ${border}; color:${color}; padding:2px 4px; border-radius:4px; margin-bottom:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="[${e.label}] ${e.content}"><b>[${e.label}]</b> ${e.content}</div>`;
                    }
                });
                dayHtml += `</div>`;
            }
        }

        if (window.showClass) {
          const dayData = monthDataArray[currentDay - 1] || {};
          const periods = dayData.periods || {};
          dayHtml += `<div class="month-class-wrapper" style="margin-top:auto;">`;
          // 💡 수정: 6교시 하드코딩 제거 및 설정된 명칭 배열 사용
          for (let p = 1; p <= window.periodNames.length; p++) {
            if (periods[p] && periods[p].subject) {
              // 명칭이 너무 길 수 있으므로 숫자 인덱스와 과목명을 결합하거나 심플하게 표시
              dayHtml += `<div style="font-size:0.75rem; color:#475569; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${window.periodNames[p-1]}: ${periods[p].subject}">${p}. ${periods[p].subject}</div>`;
            }
          }
          dayHtml += `</div>`;
        }

        dayHtml += `</div>`;
        html += dayHtml;
        currentDay++;
      }
    }
    row++;
  }
  html += `</div>`;
  container.innerHTML = html;
};

// ==========================================================================
// ✏️ 2. 월간 에디터 모드
// ==========================================================================
window.renderMonthEditor = async function(container) {
  container.innerHTML = `<p style="text-align:center; padding: 40px; color:#64748b; font-weight:bold; font-size:var(--font-base);">⏳ 월간 편집 시트를 불러오는 중입니다...</p>`;

  if (!window.db) return;

  const y = window.currentDate.getFullYear();
  const m = window.currentDate.getMonth();
  const lastDate = new Date(y, m + 1, 0).getDate();

  const dayPromises = [];
  for(let i=1; i<=lastDate; i++) {
      dayPromises.push(window.dbAPI.loadDayData(window.formatDate(new Date(y, m, i))));
  }
  const monthDataArray = await Promise.all(dayPromises);

  const eventSnap = await window.getUserCol('events')
      .where(firebase.firestore.FieldPath.documentId(), '>=', window.formatDate(new Date(y, m, 1)))
      .where(firebase.firestore.FieldPath.documentId(), '<=', window.formatDate(new Date(y, m, lastDate)))
      .get();
      
  const eventMap = {};
  eventSnap.forEach(doc => { eventMap[doc.id] = doc.data(); });

  let html = `
    <div class="table-container month-editor-table">
      <table>
        <thead>
          <tr>
            <th style="width: 10%;">날짜</th>
            <th style="width: 15%;">일정 및 행사</th>
  `;

  // 💡 수정: 에디터 헤더 동적 생성
  if (window.showClass) {
     window.periodNames.forEach(name => {
         html += `<th>${name}</th>`;
     });
  }

  html += `
          </tr>
        </thead>
        <tbody>
  `;

  const todayStr = window.formatDate(new Date());
  const dayNames = ['일','월','화','수','목','금','토'];

  for (let i = 1; i <= lastDate; i++) {
    const dateObj = new Date(y, m, i);
    const dayOfWeekNum = dateObj.getDay();

    if (!window.showWeekend && (dayOfWeekNum === 0 || dayOfWeekNum === 6)) continue;

    const dateStr = window.formatDate(dateObj);
    const dayStr = dayNames[dayOfWeekNum];

    const isToday = (dateStr === todayStr);
    const todayClass = isToday ? 'month-today-cell' : '';

    let dateColor = '#1e40af';
    if (dayOfWeekNum === 0) dateColor = '#ef4444';
    else if (dayOfWeekNum === 6) dateColor = '#3b82f6';

    let eData = eventMap[dateStr] || null;
    let events = eData ? window.parseRawEventTextToEventList(eData.eventText || '') : [];
    if(eData && eData.eventList && eData.eventList.length > 0) events = eData.eventList;

    window[`tempMonthEvents_${dateStr}`] = events.length > 0 ? events : [{ label: window.getEventLabels()[0]?.name || '일정', content: '' }];

    html += `
      <tr data-month-sub="${dateStr}">
        <td class="${todayClass}" style="font-weight:900; font-size: 1.1rem; color:${dateColor}; vertical-align:middle; text-align:center;">
          <div style="font-size: 1.1rem;">${m+1}/${i}</div>
          <div style="font-size: 0.85rem; margin-top:4px;">(${dayStr})</div>
        </td>
        <td class="${todayClass}" style="vertical-align: top; padding: 8px;">
          <div id="month-event-editor-${dateStr}" style="display:flex; flex-direction:column; gap:6px;"></div>
          <button onclick="addMonthEventEntry('${dateStr}')" style="width:100%; padding:6px; margin-top:6px; font-size:0.85rem; background:#eff6ff; color:#2563eb; border:1px dashed #bfdbfe; border-radius:4px; cursor:pointer;">+ 추가</button>
        </td>
    `;

    if (window.showClass) {
      const dayData = monthDataArray[i - 1] || {};
      const periods = dayData.periods || {};
      // 💡 수정: 에디터 수정 셀을 교시 설정 개수에 맞춰 렌더링
      for (let p = 1; p <= window.periodNames.length; p++) {
        const subject = periods[p] ? periods[p].subject : '';
        html += `<td class="edit-class-cell editable-cell ${todayClass}" data-p="${p}" contenteditable="true" style="text-align:center; vertical-align:middle;">${subject}</td>`;
      }
    }

    html += `</tr>`;
  }

  html += `</tbody></table></div>`;
  container.innerHTML = html;

  setTimeout(() => {
    for (let i = 1; i <= lastDate; i++) {
      const dateObj = new Date(y, m, i);
      if (!window.showWeekend && (dateObj.getDay() === 0 || dateObj.getDay() === 6)) continue;
      window.renderMonthEventEntries(window.formatDate(dateObj));
    }
  }, 0);
};

window.renderMonthEventEntries = function(dateStr) {
  const container = document.getElementById(`month-event-editor-${dateStr}`);
  if(!container) return;
  const events = window[`tempMonthEvents_${dateStr}`] || [];
  const labelObjs = window.getEventLabels();

  let html = '';
  events.forEach((e, idx) => {
      let options = labelObjs.map(l => `<option value="${l.name}" ${e.label === l.name ? 'selected' : ''}>${l.name}</option>`).join('');
      options += `<option disabled>──────────</option><option value="__setting__">⚙️ 설정...</option>`;

      const isSkip = window.isSkipLabel(e.label);
      const selBg = isSkip ? '#fee2e2' : '#eff6ff';
      const selColor = isSkip ? '#ef4444' : '#1e40af';

      html += `
      <div class="month-event-entry-block" data-idx="${idx}" style="display:flex; flex-direction:column; gap:4px; padding:4px; background:#f8fafc; border:1px solid #cbd5e1; border-radius:4px;">
        <div style="display:flex; justify-content:space-between; gap:4px;">
          <select onchange="if(this.value === '__setting__'){ window.openEventLabelModal(); this.value='${e.label}'; } else { window.syncMonthEventInputs('${dateStr}'); window.renderMonthEventEntries('${dateStr}'); }" style="padding:2px; font-size:0.8rem; border-radius:4px; border:1px solid #cbd5e1; background:${selBg}; color:${selColor}; font-weight:bold; outline:none; flex:1;">
            ${options}
          </select>
          <button onclick="removeMonthEventEntry('${dateStr}', ${idx})" style="background:none; border:none; color:#ef4444; cursor:pointer; font-size:0.9rem;" title="삭제">✖</button>
        </div>
        <textarea placeholder="내용" style="width:100%; padding:4px; font-size:0.85rem; border:1px solid #cbd5e1; border-radius:4px; resize:none; overflow:hidden; min-height:24px; outline:none;" oninput="this.style.height=''; this.style.height = this.scrollHeight + 'px'">${e.content}</textarea>
      </div>`;
  });
  container.innerHTML = html;
  setTimeout(() => {
      container.querySelectorAll('textarea').forEach(ta => { ta.style.height = ta.scrollHeight + 'px'; });
  }, 0);
};

window.syncMonthEventInputs = function(dateStr) {
  const container = document.getElementById(`month-event-editor-${dateStr}`);
  if(!container) return;
  const blocks = container.querySelectorAll('.month-event-entry-block');
  const events = window[`tempMonthEvents_${dateStr}`];
  blocks.forEach(block => {
      const idx = block.getAttribute('data-idx');
      const label = block.querySelector('select').value;
      const content = block.querySelector('textarea').value;
      if(events[idx]) {
          events[idx].label = label;
          events[idx].content = content;
      }
  });
};

window.addMonthEventEntry = function(dateStr) {
  window.syncMonthEventInputs(dateStr);
  window[`tempMonthEvents_${dateStr}`].push({ label: window.getEventLabels()[0]?.name || '일정', content: '' });
  window.renderMonthEventEntries(dateStr);
};

window.removeMonthEventEntry = function(dateStr, idx) {
  window.syncMonthEventInputs(dateStr);
  window[`tempMonthEvents_${dateStr}`].splice(idx, 1);
  window.renderMonthEventEntries(dateStr);
};

// ==========================================================================
// 💾 3. 월간 편집 저장 처리 함수
// ==========================================================================
window.saveMonthDataFromEditor = async function() {
  const y = window.currentDate.getFullYear();
  const m = window.currentDate.getMonth();
  const lastDate = new Date(y, m + 1, 0).getDate();

  for (let i = 1; i <= lastDate; i++) {
    const dateObj = new Date(y, m, i);
    if (!window.showWeekend && (dateObj.getDay() === 0 || dateObj.getDay() === 6)) continue;

    const dateStr = window.formatDate(dateObj);

    window.syncMonthEventInputs(dateStr);
    const validEvents = (window[`tempMonthEvents_${dateStr}`] || []).filter(e => e.content.trim() !== '');
    const cleanEventText = window.formatEventListToText(validEvents);

    await window.getUserCol('events').doc(dateStr).set({
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

    const row = document.querySelector(`tr[data-month-sub="${dateStr}"]`);
    if (row && window.showClass) {
      let existingPeriods = {};
      try {
        const existingData = await window.dbAPI.loadDayData(dateStr);
        existingPeriods = existingData.periods || {};
      } catch(e) {}

      const periodsData = {};
      const classCells = row.querySelectorAll('.edit-class-cell');

      classCells.forEach(cell => {
         const p = cell.getAttribute("data-p");
         const subjRaw = (cell.innerText || cell.textContent || "").trim();
         let subjText = (subjRaw.toUpperCase() === 'X' || subjRaw === '') ? '' : subjRaw;

         if (isSkipDay) subjText = '';

         // 💡 수정: 동적으로 생성된 교시 번호에 맞춰 안전하게 저장
         periodsData[p] = {
            subject: subjText,
            memo: existingPeriods[p] ? existingPeriods[p].memo : '',
            supplies: existingPeriods[p] ? existingPeriods[p].supplies : ''
         };
      });

      await window.dbAPI.saveSchedule(dateStr, periodsData);
    }
  }
};
