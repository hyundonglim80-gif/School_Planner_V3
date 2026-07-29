//js/viewYear.js

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
// 👁️ 1. 연간 뷰어 모드 (기존 로직 유지)
// ==========================================================================
window.renderYearViewer = async function(container) {
  container.innerHTML = `<p style="text-align:center; padding: 40px; color:#64748b; font-weight:bold; font-size:var(--font-base);">⏳ 클라우드에서 연간 일정을 분석하여 불러오는 중...</p>`;

  if (!window.db) return;

  const y = window.currentDate.getFullYear();
  let html = `<div class="year-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px;">`;

  const eventSnap = await window.getUserCol('events')
      .where(firebase.firestore.FieldPath.documentId(), '>=', `${y}-01-01`)
      .where(firebase.firestore.FieldPath.documentId(), '<=', `${y}-12-31`)
      .get();
      
  const eventMap = {};
  eventSnap.forEach(doc => { eventMap[doc.id] = doc.data(); });

  for (let m = 0; m < 12; m++) {
    const lastDate = new Date(y, m + 1, 0).getDate();
    
    let monthHtml = `<div class="year-month-card" style="background:#fff; border:1px solid #cbd5e1; border-radius:8px; padding:15px; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
                        <h3 style="margin-top:0; color:#1e40af; border-bottom:2px solid #e2e8f0; padding-bottom:8px; text-align:center;">${m + 1}월</h3>
                        <div style="display:flex; flex-direction:column; gap:8px;">`;

    let hasEvents = false;
    for (let d = 1; d <= lastDate; d++) {
      const dateObj = new Date(y, m, d);
      const dayOfWeekNum = dateObj.getDay();
      
      if (!window.showWeekend && (dayOfWeekNum === 0 || dayOfWeekNum === 6)) continue;

      const dateStr = window.formatDate(dateObj);
      const eData = eventMap[dateStr];
      
      if (eData) {
        let events = eData.eventList || window.parseRawEventTextToEventList(eData.eventText || '');
        let validEvents = events.filter(e => e.content.trim() !== '');
        
        if (validEvents.length > 0) {
          hasEvents = true;
          let dayColor = '#334155';
          if (dayOfWeekNum === 0) dayColor = '#ef4444';
          else if (dayOfWeekNum === 6) dayColor = '#3b82f6';
          
          monthHtml += `<div class="year-event-item" style="display:flex; align-items:flex-start; gap:8px; font-size:0.95rem;">
                          <div style="font-weight:bold; color:${dayColor}; width:35px; flex-shrink:0; cursor:pointer; text-decoration:underline;" onclick="window.goToDay('${dateStr}')" title="해당 일자로 이동">${d}일</div>
                          <div style="flex-grow:1;">${window.generateEventBadgesHTML(validEvents)}</div>
                        </div>`;
        }
      }
    }
    
    if (!hasEvents) {
       monthHtml += `<div style="color:#94a3b8; font-size:0.9rem; text-align:center; padding:10px 0;">등록된 일정이 없습니다.</div>`;
    }
    monthHtml += `</div></div>`;
    html += monthHtml;
  }
  html += `</div>`;
  container.innerHTML = html;
};

// ==========================================================================
// ✏️ 2. 연간 에디터 모드
// ==========================================================================
window.renderYearEditor = async function(container) {
  container.innerHTML = `<p style="text-align:center; padding: 40px; color:#64748b; font-weight:bold; font-size:var(--font-base);">⏳ 연간 편집 시트를 불러오는 중입니다...</p>`;

  if (!window.db) return;

  const y = window.currentDate.getFullYear();
  let html = `<div class="table-container year-editor-table">
                <table>
                  <thead>
                    <tr>
                      <th style="width: 10%;">날짜</th>
                      <th style="width: 25%;">일정 및 행사</th>`;
  
  // 💡 수정: 연간 에디터에서도 설정된 시수 배열 길이에 맞춰 헤더를 동적 생성
  if (window.showClass) {
     window.periodNames.forEach(name => {
         html += `<th>${name}</th>`;
     });
  }
  
  html += `</tr></thead><tbody>`;

  const eventSnap = await window.getUserCol('events')
      .where(firebase.firestore.FieldPath.documentId(), '>=', `${y}-01-01`)
      .where(firebase.firestore.FieldPath.documentId(), '<=', `${y}-12-31`)
      .get();
      
  const eventMap = {};
  eventSnap.forEach(doc => { eventMap[doc.id] = doc.data(); });

  const scheduleSnap = await window.getUserCol('schedules')
      .where(firebase.firestore.FieldPath.documentId(), '>=', `${y}-01-01`)
      .where(firebase.firestore.FieldPath.documentId(), '<=', `${y}-12-31`)
      .get();
  const scheduleMap = {};
  scheduleSnap.forEach(doc => { scheduleMap[doc.id] = doc.data().periods || {}; });

  const dayNames = ['일','월','화','수','목','금','토'];
  const todayStr = window.formatDate(new Date());

  for (let m = 0; m < 12; m++) {
    const lastDate = new Date(y, m + 1, 0).getDate();
    const colspanCount = window.showClass ? window.periodNames.length + 2 : 2;
    
    html += `<tr style="background:#f1f5f9;"><td colspan="${colspanCount}" style="font-weight:bold; color:#0f172a; text-align:center; padding:12px; font-size:1.1rem;">📅 ${y}년 ${m + 1}월</td></tr>`;

    for (let d = 1; d <= lastDate; d++) {
      const dateObj = new Date(y, m, d);
      const dayOfWeekNum = dateObj.getDay();

      if (!window.showWeekend && (dayOfWeekNum === 0 || dayOfWeekNum === 6)) continue;

      const dateStr = window.formatDate(dateObj);
      const dayStr = dayNames[dayOfWeekNum];
      const isToday = (dateStr === todayStr);
      const todayClass = isToday ? 'year-today-cell' : '';

      let dateColor = '#1e40af';
      if (dayOfWeekNum === 0) dateColor = '#ef4444';
      else if (dayOfWeekNum === 6) dateColor = '#3b82f6';

      let eData = eventMap[dateStr] || null;
      let events = eData ? window.parseRawEventTextToEventList(eData.eventText || '') : [];
      if(eData && eData.eventList && eData.eventList.length > 0) events = eData.eventList;

      window[`tempYearEvents_${dateStr}`] = events.length > 0 ? events : [{ label: window.getEventLabels()[0]?.name || '일정', content: '' }];

      html += `
        <tr data-year-sub="${dateStr}">
          <td class="${todayClass}" style="font-weight:900; font-size: 1.1rem; color:${dateColor}; vertical-align:middle; text-align:center;">
            <div>${m+1}/${d}</div>
            <div style="font-size: 0.85rem; margin-top:4px;">(${dayStr})</div>
          </td>
          <td class="${todayClass}" style="vertical-align: top; padding: 8px;">
            <div id="year-event-editor-${dateStr}" style="display:flex; flex-direction:column; gap:4px;"></div>
            <button onclick="addYearEventEntry('${dateStr}')" style="width:100%; padding:6px; margin-top:4px; font-size:0.85rem; background:#eff6ff; color:#2563eb; border:1px dashed #bfdbfe; border-radius:4px; cursor:pointer;">+ 일정 추가</button>
          </td>
      `;

      if (window.showClass) {
        const periods = scheduleMap[dateStr] || {};
        // 💡 수정: 에디터 수정 셀을 6교시 고정이 아닌 교시 설정 개수에 맞춰 렌더링
        for (let p = 1; p <= window.periodNames.length; p++) {
          const subject = periods[p] ? periods[p].subject : '';
          html += `<td class="edit-class-cell editable-cell ${todayClass}" data-p="${p}" contenteditable="true" style="text-align:center; vertical-align:middle;">${subject}</td>`;
        }
      }

      html += `</tr>`;
    }
  }

  html += `</tbody></table></div>`;
  container.innerHTML = html;

  setTimeout(() => {
    for (let m = 0; m < 12; m++) {
      const lastDate = new Date(y, m + 1, 0).getDate();
      for (let d = 1; d <= lastDate; d++) {
        const dateObj = new Date(y, m, d);
        if (!window.showWeekend && (dateObj.getDay() === 0 || dateObj.getDay() === 6)) continue;
        window.renderYearEventEntries(window.formatDate(dateObj));
      }
    }
  }, 0);
};

window.renderYearEventEntries = function(dateStr) {
  const container = document.getElementById(`year-event-editor-${dateStr}`);
  if(!container) return;
  const events = window[`tempYearEvents_${dateStr}`] || [];
  const labelObjs = window.getEventLabels();

  let html = '';
  events.forEach((e, idx) => {
      let options = labelObjs.map(l => `<option value="${l.name}" ${e.label === l.name ? 'selected' : ''}>${l.name}</option>`).join('');
      options += `<option disabled>──────────</option><option value="__setting__">⚙️ 설정...</option>`;

      const isSkip = window.isSkipLabel(e.label);
      const selBg = isSkip ? '#fee2e2' : '#eff6ff';
      const selColor = isSkip ? '#ef4444' : '#1e40af';

      html += `
      <div class="year-event-entry-block" data-idx="${idx}" style="display:flex; flex-direction:column; gap:4px; padding:4px; background:#f8fafc; border:1px solid #cbd5e1; border-radius:4px;">
        <div style="display:flex; justify-content:space-between; gap:4px;">
          <select onchange="if(this.value === '__setting__'){ window.openEventLabelModal(); this.value='${e.label}'; } else { window.syncYearEventInputs('${dateStr}'); window.renderYearEventEntries('${dateStr}'); }" style="padding:2px; font-size:0.8rem; border-radius:4px; border:1px solid #cbd5e1; background:${selBg}; color:${selColor}; font-weight:bold; outline:none; flex:1;">
            ${options}
          </select>
          <button onclick="removeYearEventEntry('${dateStr}', ${idx})" style="background:none; border:none; color:#ef4444; cursor:pointer; font-size:0.9rem;" title="삭제">✖</button>
        </div>
        <textarea placeholder="내용" style="width:100%; padding:4px; font-size:0.85rem; border:1px solid #cbd5e1; border-radius:4px; resize:none; overflow:hidden; min-height:24px; outline:none;" oninput="this.style.height=''; this.style.height = this.scrollHeight + 'px'">${e.content}</textarea>
      </div>`;
  });
  container.innerHTML = html;
  setTimeout(() => {
      container.querySelectorAll('textarea').forEach(ta => { ta.style.height = ta.scrollHeight + 'px'; });
  }, 0);
};

window.syncYearEventInputs = function(dateStr) {
  const container = document.getElementById(`year-event-editor-${dateStr}`);
  if(!container) return;
  const blocks = container.querySelectorAll('.year-event-entry-block');
  const events = window[`tempYearEvents_${dateStr}`];
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

window.addYearEventEntry = function(dateStr) {
  window.syncYearEventInputs(dateStr);
  window[`tempYearEvents_${dateStr}`].push({ label: window.getEventLabels()[0]?.name || '일정', content: '' });
  window.renderYearEventEntries(dateStr);
};

window.removeYearEventEntry = function(dateStr, idx) {
  window.syncYearEventInputs(dateStr);
  window[`tempYearEvents_${dateStr}`].splice(idx, 1);
  window.renderYearEventEntries(dateStr);
};

// ==========================================================================
// 💾 3. 연간 편집 저장 처리 함수
// ==========================================================================
window.saveYearDataFromEditor = async function() {
  const y = window.currentDate.getFullYear();

  for (let m = 0; m < 12; m++) {
    const lastDate = new Date(y, m + 1, 0).getDate();

    for (let d = 1; d <= lastDate; d++) {
      const dateObj = new Date(y, m, d);
      if (!window.showWeekend && (dateObj.getDay() === 0 || dateObj.getDay() === 6)) continue;

      const dateStr = window.formatDate(dateObj);
      
      window.syncYearEventInputs(dateStr);
      const events = window[`tempYearEvents_${dateStr}`];
      if (!events) continue; 
      
      const validEvents = events.filter(e => e.content.trim() !== '');
      const cleanEventText = window.formatEventListToText(validEvents);

      const subRow = document.querySelector(`tr[data-year-sub="${dateStr}"]`);
      if (subRow) {
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

         if (window.showClass) {
           let existingPeriods = {};
           try {
             const existingData = await window.dbAPI.loadDayData(dateStr);
             existingPeriods = existingData.periods || {};
           } catch(e) {}

           const classCells = subRow.querySelectorAll(".edit-class-cell");
           const periodsData = {};
           
           classCells.forEach(cell => {
              const p = cell.getAttribute("data-p");
              const subjRaw = (cell.innerText || cell.textContent || "").trim();
              let subjText = (subjRaw.toUpperCase() === 'X' || subjRaw === '') ? '' : subjRaw;

              if (isSkipDay) subjText = '';

              // 💡 수정: 동적 교시 배열(p 인덱스)에 맞춰 데이터 안전하게 취합
              periodsData[p] = {
                 subject: subjText,
                 memo: existingPeriods[p] ? existingPeriods[p].memo : '',
                 supplies: existingPeriods[p] ? existingPeriods[p].supplies : ''
              };
           });

           await window.dbAPI.saveSchedule(dateStr, periodsData);
         }
      }
    }
  }
};
