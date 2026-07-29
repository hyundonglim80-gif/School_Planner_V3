//js/viewWeek.js

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
        <thead>
          <tr>
            <th style="width: 10%;">날짜</th>
            <th style="width: 15%;">일정 및 행사</th>
  `;
  
  // 💡 수정: 6교시 하드코딩 제거 (설정된 교시 이름으로 헤더 동적 생성)
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

  const realTodayStr = window.formatDate(new Date());

  for (const d of window.getWeekDates()) {
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
        <td class="${todayClass}" style="font-weight:900; font-size: 1.1rem; color:${dateColor}; vertical-align:middle; text-align:center;">
          <div style="font-size: 1.2rem;">${d.dateDisplay}</div>
          <div style="font-size: 0.9rem; margin-top:4px;">(${d.day})</div>
        </td>
        <td class="event-td ${todayClass}" style="vertical-align: top; padding: 10px;">
          ${eventHtml}
        </td>
    `;

    if (window.showClass) {
      // 💡 수정: 6교시 고정 해제, periodNames 배열 길이만큼 렌더링
      for (let p = 1; p <= window.periodNames.length; p++) {
        const pObj = periods[p] || {};
        let content = '';
        if (pObj.subject) content += `<div style="margin-bottom: 4px;"><span class="badge-tag">${pObj.subject}</span></div>`;
        if (pObj.memo) content += `<div class="clean-cell-memo">${pObj.memo}</div>`;
        
        html += `<td class="${todayClass}" style="vertical-align: top; text-align: left; padding: 6px 8px; height: var(--week-cell-height);">${content}</td>`;
      }
    }
    
    html += `</tr>`;
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
        <thead>
          <tr>
            <th style="width: 10%;">날짜</th>
            <th style="width: 15%;">일정 및 행사</th>
  `;
  
  // 💡 수정: 에디터에서도 헤더 동적 생성
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

  const realTodayStr = window.formatDate(new Date());

  for (const d of window.getWeekDates()) {
    const dayData = await window.dbAPI.loadDayData(d.dateStr);
    
    const eventDoc = await window.getUserCol('events').doc(d.dateStr).get();
    let eData = eventDoc.exists ? eventDoc.data() : null;
    let events = eData ? window.parseRawEventTextToEventList(eData.eventText || '') : [];
    if(eData && eData.eventList && eData.eventList.length > 0) events = eData.eventList;

    window[`tempEvents_${d.dateStr}`] = events.length > 0 ? events : [{ label: window.getEventLabels()[0]?.name || '일정', content: '' }];

    const periods = dayData.periods || {};
    const isToday = (d.dateStr === realTodayStr);
    const todayClass = isToday ? 'week-today-cell' : '';

    let dateColor = '#1e40af';
    if (d.dayOfWeekNum === 0) dateColor = '#ef4444';
    else if (d.dayOfWeekNum === 6) dateColor = '#3b82f6';

    html += `
      <tr data-week-schedule-date="${d.dateStr}">
        <td class="${todayClass}" style="font-weight:900; font-size: 1.1rem; color:${dateColor}; vertical-align:middle; text-align:center;">
          <div style="font-size: 1.2rem;">${d.dateDisplay}</div>
          <div style="font-size: 0.9rem; margin-top:4px;">(${d.day})</div>
        </td>
        <td class="${todayClass}" style="vertical-align: top; padding: 8px;">
          <div id="week-event-editor-${d.dateStr}" style="display:flex; flex-direction:column; gap:6px;"></div>
          <button onclick="addWeekEventEntry('${d.dateStr}')" style="width:100%; padding:6px; margin-top:6px; font-size:0.85rem; background:#eff6ff; color:#2563eb; border:1px dashed #bfdbfe; border-radius:4px; cursor:pointer;">+ 일정 추가</button>
        </td>
    `;

    if (window.showClass) {
      // 💡 수정: 에디터 수정 셀 동적 렌더링
      for (let p = 1; p <= window.periodNames.length; p++) {
        const pObj = periods[p] || {};
        let cellText = pObj.subject ? `[${pObj.subject}]` : '';
        if (pObj.memo) cellText += cellText ? `\n${pObj.memo}` : pObj.memo;
        
        html += `<td class="week-period-cell editable-cell ${todayClass}" data-p="${p}" contenteditable="true" style="vertical-align: top; height: var(--week-cell-height); text-align: left; padding: 6px 8px; white-space: pre-wrap;">${cellText}</td>`;
      }
    }
    
    html += `</tr>`;
  }
  
  html += `</tbody></table></div>`;
  container.innerHTML = html;

  setTimeout(() => {
    window.getWeekDates().forEach(d => {
      window.renderWeekEventEntries(d.dateStr);
    });
  }, 0);
};

window.renderWeekEventEntries = function(dateStr) {
  const container = document.getElementById(`week-event-editor-${dateStr}`);
  if(!container) return;
  const events = window[`tempEvents_${dateStr}`] || [];
  const labelObjs = window.getEventLabels();
  
  let html = '';
  events.forEach((e, idx) => {
      let options = labelObjs.map(l => `<option value="${l.name}" ${e.label === l.name ? 'selected' : ''}>${l.name}</option>`).join('');
      options += `<option disabled>──────────</option><option value="__setting__">⚙️ 설정...</option>`;
      
      const isSkip = window.isSkipLabel(e.label);
      const selBg = isSkip ? '#fee2e2' : '#eff6ff';
      const selColor = isSkip ? '#ef4444' : '#1e40af';
      
      html += `
      <div class="week-event-entry-block" data-idx="${idx}" style="display:flex; flex-direction:column; gap:4px; padding:6px; background:#f8fafc; border:1px solid #cbd5e1; border-radius:6px;">
        <div style="display:flex; justify-content:space-between; gap:4px;">
          <select onchange="if(this.value === '__setting__'){ window.openEventLabelModal(); this.value='${e.label}'; } else { window.syncWeekEventInputs('${dateStr}'); window.renderWeekEventEntries('${dateStr}'); }" style="padding:4px; font-size:0.8rem; border-radius:4px; border:1px solid #cbd5e1; background:${selBg}; color:${selColor}; font-weight:bold; outline:none; flex:1;">
            ${options}
          </select>
          <button onclick="removeWeekEventEntry('${dateStr}', ${idx})" style="background:none; border:none; color:#ef4444; cursor:pointer; font-size:1rem;" title="삭제">✖</button>
        </div>
        <textarea placeholder="내용" style="width:100%; padding:6px; font-size:0.9rem; border:1px solid #cbd5e1; border-radius:4px; resize:none; overflow:hidden; min-height:30px; outline:none;" oninput="this.style.height=''; this.style.height = this.scrollHeight + 'px'">${e.content}</textarea>
      </div>`;
  });
  container.innerHTML = html;
  setTimeout(() => {
      container.querySelectorAll('textarea').forEach(ta => { ta.style.height = ta.scrollHeight + 'px'; });
  }, 0);
};

window.syncWeekEventInputs = function(dateStr) {
  const container = document.getElementById(`week-event-editor-${dateStr}`);
  if(!container) return;
  const blocks = container.querySelectorAll('.week-event-entry-block');
  const events = window[`tempEvents_${dateStr}`];
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

window.addWeekEventEntry = function(dateStr) {
  window.syncWeekEventInputs(dateStr);
  window[`tempEvents_${dateStr}`].push({ label: window.getEventLabels()[0]?.name || '일정', content: '' });
  window.renderWeekEventEntries(dateStr);
};

window.removeWeekEventEntry = function(dateStr, idx) {
  window.syncWeekEventInputs(dateStr);
  window[`tempEvents_${dateStr}`].splice(idx, 1);
  window.renderWeekEventEntries(dateStr);
};

// ==========================================================================
// 💾 3
