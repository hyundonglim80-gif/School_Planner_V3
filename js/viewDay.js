//js/viewDay.js

const CURRENT_DAY_STR = () => window.formatDate(window.currentDate);

window.parseEvents = function(docData) {
  if (!docData) return [];
  if (docData.eventList && docData.eventList.length > 0) return docData.eventList;
  if (docData.eventText && docData.eventText.trim() !== '') return [{ label: '일정', content: docData.eventText }];
  return [];
};

// ==========================================================================
// 👁️ 1. 일간 뷰어 모드 
// ==========================================================================
window.renderDayViewer = async function(container) {
  container.innerHTML = `<p style="text-align:center; padding: 40px; color:#64748b; font-weight:bold; font-size:var(--font-base);">⏳ 클라우드 데이터를 불러오는 중...</p>`;

  const dateStr = CURRENT_DAY_STR();
  const dayData = await window.dbAPI.loadDayData(dateStr);
  const periods = dayData.periods || {};
  
  const eventDoc = await window.getUserCol('events').doc(dateStr).get();
  const events = eventDoc.exists ? window.parseEvents(eventDoc.data()) : [];
  
  const journalDoc = await window.getUserCol('journals').doc(dateStr).get();
  const journals = journalDoc.exists ? journalDoc.data().entries || [] : [];

  let html = `<div class="day-viewer-container">`;

  html += `<div class="day-event-card" style="display: flex; align-items: flex-start; padding: 16px; border: 1px solid #cbd5e1; border-left: 5px solid #2563eb; border-radius: 8px; margin-bottom: 16px; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
            <div style="width: 80px; font-weight: 700; font-size: 1.1rem; color: #1e40af; flex-shrink: 0;">📌 일정</div>
            <div style="flex-grow: 1; padding-left:12px; border-left: 2px solid #e2e8f0;">`;
            
  if (events.length > 0) {
    html += window.generateEventBadgesHTML(events); 
  } else {
    html += `<div style="color:#94a3b8; font-size:1.05rem;">등록된 일정이 없습니다.</div>`;
  }
  html += `</div></div>`;
      
  // 💡 수업 숨기기 적용
  if (window.showClass) {
    html += `<div class="period-card-list">`;
    // 🎯 6교시 고정 대신 환경 설정의 명칭과 개수 배열을 사용
    for (let p = 1; p <= window.periodNames.length; p++) {
      const pData = periods[p] || {};
      const periodName = window.periodNames[p - 1]; // 아침활동 등 명칭 가져오기
      const subject = pData.subject || '';
      const supplies = pData.supplies || '';
      const memo = pData.memo || '';

      const memoHtml = memo.trim() !== '' ? `<div class="period-memo" style="margin-top: 4px; font-size: 0.95rem; color: #475569;">📝 메모: ${memo}</div>` : '';
      const suppliesHtml = supplies.trim() !== '' ? `<div class="period-supplies" style="margin-top: 6px; font-size: 0.95rem;">🎒 비고: ${supplies}</div>` : '';

      html += `
        <div class="day-period-card" style="padding: 12px; border: 1px solid #cbd5e1; border-radius: 8px; margin-bottom: 10px; background: #fff;">
          <div class="period-title" style="font-weight: 700; font-size: 1.1rem; color: #1e3a8a;">${periodName}: ${subject}</div>
          ${memoHtml}
          ${suppliesHtml}
        </div>
      `;
    }
    html += `</div>`;
  }

  if (journals.length > 0) {
    html += `<div class="day-journal-section" style="margin-top:20px;">
              <h3 style="font-size:1.2rem; color:#be185d; margin-bottom:10px;">📔 오늘의 일지</h3>`;
    journals.forEach(j => {
      html += `
        <div style="background:#fdf2f8; border:1px solid #f472b6; border-left:5px solid #be185d; border-radius:8px; padding:12px; margin-bottom:10px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
            <div style="font-weight:bold; color:#9d174d; margin-bottom:6px; font-size:1.05rem;">[${j.label}]</div>
            <div style="color:#831843; font-size:1.05rem; line-height:1.5; white-space:pre-wrap; word-break:break-all;">${j.content}</div>
        </div>`;
    });
    html += `</div>`;
  }

  html += `</div>`;
  container.innerHTML = html;
};

// ==========================================================================
// ✏️ 2. 일간 에디터 모드
// ==========================================================================
window.renderDayEditor = async function(container) {
  container.innerHTML = `<p style="text-align:center; padding: 40px; color:#64748b; font-weight:bold; font-size:var(--font-base);">⏳ 편집 화면을 준비 중...</p>`;

  const dateStr = CURRENT_DAY_STR();
  const dayData = await window.dbAPI.loadDayData(dateStr);
  const periods = dayData.periods || {};
  
  const eventDoc = await window.getUserCol('events').doc(dateStr).get();
  const events = eventDoc.exists ? window.parseEvents(eventDoc.data()) : [];
  
  const validLabels = window.getEventLabels().map(l => l.name);
  const defaultLabel = validLabels[0] || '일정';

  window.currentEvents = events.length > 0 ? events : [{ label: defaultLabel, content: '' }];
  
  const journalDoc = await window.getUserCol('journals').doc(dateStr).get();
  const journals = journalDoc.exists ? journalDoc.data().entries || [] : [];
  window.currentJournals = journals.length > 0 ? journals : [{ label: '참고', content: '' }];

  let html = `<div class="day-viewer-container">`;

  // 💡 라벨 설정 버튼 누르면 openEventLabelModal 함수가 정상 호출되도록 변경
  html += `
    <div class="day-event-editor-section" style="background: #fff; padding: 15px; border-radius: 8px; border: 1px solid #cbd5e1; box-shadow: 0 1px 3px rgba(0,0,0,0.05); border-left: 5px solid #2563eb;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 15px;">
        <h3 style="font-size:1.2rem; color:#1e40af; margin:0; font-weight:bold;">📌 오늘의 일정/행사</h3>
      </div>
      <div id="event-entries-container"></div>
      <button onclick="addEventEntry()" style="width:100%; padding:10px; margin-top:5px; background:#eff6ff; color:#2563eb; border:2px dashed #bfdbfe; border-radius:8px; cursor:pointer; font-weight:bold; font-size:1rem; transition:0.2s;">+ 일정 칸 추가</button>
    </div>
  `;

  // 💡 수업 숨기기 적용
  html += `
      <div class="table-container" style="margin-top:10px; ${window.showClass ? '' : 'display:none;'}">
        <table style="text-align: center;">
          <thead>
            <tr>
              <th style="width: 60px;">교시</th>
              <th style="width: 120px;">수업</th>
              <th>📝 메모</th>
              <th style="width: 25%;">🎒 비고</th>
            </tr>
          </thead>
          <tbody>
  `;

  // 🎯 에디터에서도 동적 배열 사용
  for (let p = 1; p <= window.periodNames.length; p++) {
    const pObj = periods[p] || {};
    const periodName = window.periodNames[p - 1]; // 명칭 가져오기
    html += `
            <tr data-period="${p}">
              <td class="period-cell" onclick="openClassSwapModal(${p})" style="cursor:pointer; color:#2563eb; text-decoration:underline; font-weight:900; font-size:0.9rem;" title="클릭하여 수업 이동/맞바꾸기">${periodName}</td>
              <td class="editable-cell cell-subject" contenteditable="true">${pObj.subject || ''}</td>
              <td class="editable-cell cell-memo" contenteditable="true" style="text-align: left;">${pObj.memo || ''}</td>
              <td class="editable-cell cell-supplies" contenteditable="true" style="color: #d97706; font-weight: 600; text-align: left;">${pObj.supplies || ''}</td>
            </tr>
    `;
  }
  html += `</tbody></table></div>`;

  html += `
    <div class="day-journal-editor-section" style="margin-top: 15px; background: #fff; padding: 15px; border-radius: 8px; border: 1px solid #cbd5e1; box-shadow: 0 1px 3px rgba(0,0,0,0.05); border-left: 5px solid #be185d;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 15px;">
        <h3 style="font-size:1.2rem; color:#be185d; margin:0; font-weight:bold;">📔 오늘의 일지 기록</h3>
      </div>
      <div id="journal-entries-container"></div>
      <button onclick="addJournalEntry()" style="width:100%; padding:10px; margin-top:5px; background:#fdf2f8; color:#be185d; border:2px dashed #f472b6; border-radius:8px; cursor:pointer; font-weight:bold; font-size:1rem; transition:0.2s;">+ 일지 칸 추가</button>
    </div>
  </div>`;
  
  container.innerHTML = html;
  
  setTimeout(() => {
    window.renderEventEntries();
    window.renderJournalEntries();
  }, 0);
};

// ... 나머지 코드는 기존과 완벽하게 동일하게 유지
window.renderEventEntries = function() {
  const container = document.getElementById('event-entries-container');
  if(!container) return;
  
  const labelObjs = window.getEventLabels();
  
  let html = '';
  window.currentEvents.forEach((e, index) => {
      if (!labelObjs.some(l => l.name === e.label)) {
          e.label = labelObjs[0] ? labelObjs[0].name : '';
      }
      
      let options = labelObjs.map(l => `<option value="${l.name}" ${e.label === l.name ? 'selected' : ''}>${l.name}</option>`).join('');
      options += `<option disabled>──────────</option>`;
      options += `<option value="__setting__">⚙️ 라벨 설정...</option>`;
      
      const isSkip = window.isSkipLabel(e.label);
      const selBg = isSkip ? '#fee2e2' : '#eff6ff';
      const selColor = isSkip ? '#ef4444' : '#1e40af';
      
      html += `
      <div class="event-entry-block" data-index="${index}" style="display:flex; gap:10px; margin-bottom:10px; align-items:flex-start;">
          <select class="event-label-select" onchange="if(this.value === '__setting__') { window.openEventLabelModal(); this.value='${e.label}'; } else { window.syncEventInputs(); window.renderEventEntries(); }" style="padding:10px; border-radius:6px; border:1px solid #cbd5e1; outline:none; font-size:1rem; width:110px; flex-shrink:0; font-weight:bold; color:${selColor}; background:${selBg}; transition:0.2s;">
              ${options}
          </select>
          <textarea class="event-content-input" placeholder="일정 내용을 입력하세요." style="flex-grow:1; padding:10px 12px; border-radius:6px; border:1px solid #cbd5e1; outline:none; font-size:1.05rem; resize:none; overflow:hidden; min-height:45px; background:#f8fafc;" oninput="this.style.height=''; this.style.height = this.scrollHeight + 'px'">${e.content}</textarea>
          <button onclick="removeEventEntry(${index})" style="background:#f1f5f9; border:1px solid #cbd5e1; color:#ef4444; font-size:1.2rem; cursor:pointer; padding:6px 10px; border-radius:6px; transition:0.2s;" title="삭제">✖</button>
      </div>`;
  });
  container.innerHTML = html;
  setTimeout(() => {
      container.querySelectorAll('.event-content-input').forEach(ta => { ta.style.height = ta.scrollHeight + 'px'; });
  }, 0);
};

window.syncEventInputs = function() {
  const blocks = document.querySelectorAll('.event-entry-block');
  blocks.forEach((block, idx) => {
      const label = block.querySelector('.event-label-select').value;
      const content = block.querySelector('.event-content-input').value;
      if(window.currentEvents[idx]) {
          window.currentEvents[idx].label = label;
          window.currentEvents[idx].content = content;
      }
  });
};

window.addEventEntry = function() {
  window.syncEventInputs();
  const defaultLabel = window.getEventLabels()[0]?.name || '일정';
  window.currentEvents.push({ label: defaultLabel, content: '' });
  window.renderEventEntries();
};

window.removeEventEntry = function(index) {
  window.syncEventInputs();
  window.currentEvents.splice(index, 1);
  window.renderEventEntries();
};

window.renderJournalEntries = function() {
  const container = document.getElementById('journal-entries-container');
  if(!container) return;
  let labels = window.getJournalLabels().map(l => l.name);
  let html = '';
  window.currentJournals.forEach((j, index) => {
      let options = labels.map(l => `<option value="${l}" ${j.label === l ? 'selected' : ''}>${l}</option>`).join('');
      options += `<option disabled>──────────</option>`;
      options += `<option value="__setting__">⚙️ 라벨 설정...</option>`;
      
      html += `
      <div class="journal-entry-block" data-index="${index}" style="display:flex; gap:10px; margin-bottom:10px; align-items:flex-start;">
          <select class="journal-label-select" onchange="if(this.value === '__setting__') { window.openJournalLabelModal(); this.value='${j.label}'; } else { window.syncJournalInputs(); window.renderJournalEntries(); }" style="padding:10px; border-radius:6px; border:1px solid #cbd5e1; outline:none; font-size:1rem; width:110px; flex-shrink:0; font-weight:bold; color:#be185d; background:#fdf2f8;">
              ${options}
          </select>
          <textarea class="journal-content-input" placeholder="사건이나 감상 등을 편하게 작성하세요." style="flex-grow:1; padding:10px 12px; border-radius:6px; border:1px solid #cbd5e1; outline:none; font-size:1.05rem; resize:none; overflow:hidden; min-height:45px; background:#f8fafc;" oninput="this.style.height=''; this.style.height = this.scrollHeight + 'px'">${j.content}</textarea>
          <button onclick="removeJournalEntry(${index})" style="background:#f1f5f9; border:1px solid #cbd5e1; color:#ef4444; font-size:1.2rem; cursor:pointer; padding:6px 10px; border-radius:6px; transition:0.2s;" title="삭제">✖</button>
      </div>`;
  });
  container.innerHTML = html;
  setTimeout(() => {
      container.querySelectorAll('.journal-content-input').forEach(ta => { ta.style.height = ta.scrollHeight + 'px'; });
  }, 0);
};

window.syncJournalInputs = function() {
  const blocks = document.querySelectorAll('.journal-entry-block');
  blocks.forEach((block, idx) => {
      const label = block.querySelector('.journal-label-select').value;
      const content = block.querySelector('.journal-content-input').value;
      if(window.currentJournals[idx]) {
          window.currentJournals[idx].label = label;
          window.currentJournals[idx].content = content;
      }
  });
};

window.addJournalEntry = function() {
  window.syncJournalInputs();
  const defaultLabel = window.getJournalLabels()[0]?.name || '참고';
  window.currentJournals.push({ label: defaultLabel, content: '' });
  window.renderJournalEntries();
};

window.removeJournalEntry = function(index) {
  window.syncJournalInputs();
  window.currentJournals.splice(index, 1);
  window.renderJournalEntries();
};

window.openClassSwapModal = function(sourcePeriod) {
  const sourceDate = CURRENT_DAY_STR();
  const sourceName = window.periodNames[sourcePeriod - 1] || sourcePeriod + '교시'; // 🎯 현재 누른 칸의 동적 이름 추출

  const modalHtml = `
  <div id="swap-modal" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:10002; display:flex; justify-content:center; align-items:center;">
      <div style="background:#fff; padding:25px; border-radius:12px; width:340px; box-shadow:0 10px 25px rgba(0,0,0,0.2);">
          <h3 style="margin-top:0; color:#1e40af; border-bottom:2px solid #bfdbfe; padding-bottom:10px;">🔄 ${sourceName} 이동/맞바꾸기</h3>
          <p style="font-size:0.95rem; color:#475569; margin-bottom:15px; line-height:1.4;">선택한 ${sourceName}의 내용(과목,메모,비고)을 아래 선택한 날짜/시간과 <b>서로 맞바꿉니다.</b></p>
          
          <div style="margin-bottom:15px;">
              <label style="display:block; font-weight:bold; margin-bottom:5px; color:#1e293b;">목표 날짜</label>
              <input type="date" id="swap-target-date" value="${sourceDate}" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:6px; font-size:1.05rem; outline:none;">
          </div>
          <div style="margin-bottom:25px;">
              <label style="display:block; font-weight:bold; margin-bottom:5px; color:#1e293b;">목표 시간</label>
              <select id="swap-target-period" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:6px; font-size:1.05rem; outline:none;">
                  ${window.periodNames.map((name, i) => {
                     let pIndex = i + 1;
                     return `<option value="${pIndex}" ${pIndex === sourcePeriod ? 'selected' : ''}>${name}</option>`;
                  }).join('')}
              </select>
          </div>
          
          <div style="display:flex; justify-content:flex-end; gap:10px;">
              <button onclick="document.getElementById('swap-modal').remove()" style="padding:10px 16px; border:none; background:#f1f5f9; color:#475569; font-weight:bold; border-radius:6px; cursor:pointer; font-size:1rem;">취소</button>
              <button onclick="executeClassSwap(${sourcePeriod})" style="padding:10px 16px; border:none; background:#2563eb; color:#fff; font-weight:bold; border-radius:6px; cursor:pointer; font-size:1rem;">이동 실행</button>
          </div>
      </div>
  </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHtml);
};

window.executeClassSwap = async function(sourcePeriod) {
  const sourceDate = CURRENT_DAY_STR();
  const targetDate = document.getElementById('swap-target-date').value;
  const targetPeriod = parseInt(document.getElementById('swap-target-period').value, 10);

  if (!targetDate) return alert("목표 날짜를 선택해주세요.");

  const currentDOMPeriods = {};
  // 🎯 여기서도 6 대신 환경설정 개수로 매칭
  for(let p=1; p<=window.periodNames.length; p++) {
      const row = document.querySelector(`tr[data-period="${p}"]`);
      currentDOMPeriods[p] = {
          subject: (row.querySelector(".cell-subject").innerText||'').trim(),
          memo: (row.querySelector(".cell-memo").innerText||'').trim(),
          supplies: (row.querySelector(".cell-supplies").innerText||'').trim()
      };
  }

  const sourceData = currentDOMPeriods[sourcePeriod];

  if (sourceDate === targetDate) {
      if (sourcePeriod === targetPeriod) {
          document.getElementById('swap-modal').remove();
          return;
      }
      const targetData = currentDOMPeriods[targetPeriod];
      currentDOMPeriods[targetPeriod] = sourceData;
      currentDOMPeriods[sourcePeriod] = targetData;

      for(let p=1; p<=6; p++) {
          const row = document.querySelector(`tr[data-period="${p}"]`);
          row.querySelector(".cell-subject").innerText = currentDOMPeriods[p].subject;
          row.querySelector(".cell-memo").innerText = currentDOMPeriods[p].memo;
          row.querySelector(".cell-supplies").innerText = currentDOMPeriods[p].supplies;
      }
  } else {
      document.getElementById('swap-modal').innerHTML = `<div style="background:#fff; padding:30px; border-radius:12px; font-weight:bold; color:#2563eb; font-size:1.2rem; box-shadow:0 10px 25px rgba(0,0,0,0.2);">⏳ 클라우드에서 타겟 데이터를 교환 중입니다...</div>`;

      const targetDoc = await window.getUserCol('schedules').doc(targetDate).get();
      const targetPeriodsDB = targetDoc.exists ? (targetDoc.data().periods || {}) : {};
      const targetData = targetPeriodsDB[targetPeriod] || {subject:'', memo:'', supplies:''};

      targetPeriodsDB[targetPeriod] = sourceData;
      await window.getUserCol('schedules').doc(targetDate).set({ periods: targetPeriodsDB, updatedAt: Date.now() });

      const sourceRow = document.querySelector(`tr[data-period="${sourcePeriod}"]`);
      sourceRow.querySelector(".cell-subject").innerText = targetData.subject;
      sourceRow.querySelector(".cell-memo").innerText = targetData.memo;
      sourceRow.querySelector(".cell-supplies").innerText = targetData.supplies;
      
      alert(`✅ ${targetDate}의 ${targetPeriod}교시와 성공적으로 맞바꿨습니다.\n(※ 현재 화면에 적용된 변경사항을 완전히 확정하려면 반드시 상단의 [💾 저장] 버튼을 눌러주세요)`);
  }
  
  const modal = document.getElementById('swap-modal');
  if(modal) modal.remove();
  
  window.hasUnsavedChanges = true; 
};

window.saveDayDataFromEditor = async function() {
  const dateStr = CURRENT_DAY_STR();

  window.syncEventInputs();
  const validEvents = window.currentEvents.filter(e => e.content.trim() !== '');
  const eventTextForLegacy = window.formatEventListToText(validEvents);
  
  await window.getUserCol('events').doc(dateStr).set({
      eventList: validEvents,
      eventText: eventTextForLegacy,
      updatedAt: Date.now()
  });

  let isSkipDay = false;
  for (const e of validEvents) {
      if (window.isSkipLabel(e.label)) {
          isSkipDay = true;
          break;
      }
  }

  const periodsData = {};
  const rows = document.querySelectorAll("tr[data-period]");
  
  rows.forEach(row => {
    const p = row.getAttribute("data-period");
    
    let subject = (row.querySelector(".cell-subject").innerText || '').trim();
    const memo = (row.querySelector(".cell-memo").innerText || '').trim();
    const supplies = (row.querySelector(".cell-supplies").innerText || '').trim();

    if (isSkipDay) {
      subject = ''; 
    }
    periodsData[p] = { subject, memo, supplies };
  });

  await window.dbAPI.saveSchedule(dateStr, periodsData);
  
  window.syncJournalInputs();
  const validJournals = window.currentJournals.filter(j => j.content.trim() !== '');
  await window.getUserCol('journals').doc(dateStr).set({ entries: validJournals, updatedAt: Date.now() });
};
