// js/viewDay.js

class DayView extends window.BaseView {
  constructor(container) {
    super(container); // 부모(BaseView)의 기능을 물려받음
    this.currentEvents = [];
    this.currentJournals = [];
  }

  // 1. 유틸리티 메서드
  parseEvents(docData) {
    if (!docData) return [];
    if (docData.eventList && docData.eventList.length > 0) return docData.eventList;
    if (docData.eventText && docData.eventText.trim() !== '') return [{ label: '일정', content: docData.eventText }];
    return [];
  }

  // ==========================================================================
  // 👁️ 2. 일간 뷰어 렌더링 (부모의 showLoading 활용)
  // ==========================================================================
  async renderViewer() {
    this.showLoading('클라우드 데이터를 불러오는 중...'); // BaseView 상속 기능

    const dateStr = this.dateStr; // BaseView 상속 기능
    const dayData = await window.dbAPI.loadDayData(dateStr);
    const periods = dayData.periods || {};
    
    const eventDoc = await window.getUserCol('events').doc(dateStr).get();
    const events = eventDoc.exists ? this.parseEvents(eventDoc.data()) : [];
    
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
      for (let p = 1; p <= this.maxPeriod; p++) {
        const pData = periods[p] || {};
        const periodName = window.periodNames[p - 1] || p + '교시'; 
        const subject = pData.subject || '';
        const supplies = pData.supplies || '';
        const memo = pData.memo || '';

        const memoHtml = memo.trim() !== '' ? `<div class="period-memo" style="margin-top: 4px; font-size: 0.95rem; color: #475569;">📝 메모: ${memo}</div>` : '';
        const suppliesHtml = supplies.trim() !== '' ? `<div class="period-supplies" style="margin-top: 6px; font-size: 0.95rem;">📌 비고: ${supplies}</div>` : '';

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
    this.container.innerHTML = html;
  }

  // ==========================================================================
  // ✏️ 3. 일간 에디터 렌더링
  // ==========================================================================
  async renderEditor() {
    this.showLoading('편집 화면을 준비 중...');

    const dateStr = this.dateStr;
    const dayData = await window.dbAPI.loadDayData(dateStr);
    const periods = dayData.periods || {};
    
    const eventDoc = await window.getUserCol('events').doc(dateStr).get();
    const events = eventDoc.exists ? this.parseEvents(eventDoc.data()) : [];
    
    const validLabels = window.getEventLabels().map(l => l.name);
    const defaultLabel = validLabels[0] || '일정';

    // 객체 내부에 상태 저장
    this.currentEvents = events.length > 0 ? events : [{ label: defaultLabel, content: '' }];
    
    const journalDoc = await window.getUserCol('journals').doc(dateStr).get();
    const journals = journalDoc.exists ? journalDoc.data().entries || [] : [];
    this.currentJournals = journals.length > 0 ? journals : [{ label: '참고', content: '' }];

    let html = `<div class="day-viewer-container">`;

    html += `
      <div class="day-event-editor-section" style="background: #fff; padding: 15px; border-radius: 8px; border: 1px solid #cbd5e1; box-shadow: 0 1px 3px rgba(0,0,0,0.05); border-left: 5px solid #2563eb;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 15px;">
          <h3 style="font-size:1.2rem; color:#1e40af; margin:0; font-weight:bold;">📌 오늘의 일정/행사</h3>
        </div>
        <div id="event-entries-container"></div>
        <button onclick="window.dayViewInstance.addEventEntry()" style="width:100%; padding:10px; margin-top:5px; background:#eff6ff; color:#2563eb; border:2px dashed #bfdbfe; border-radius:8px; cursor:pointer; font-weight:bold; font-size:1rem; transition:0.2s;">+ 일정 칸 추가</button>
      </div>
    `;

    html += `
        <div class="table-container" style="margin-top:10px; ${window.showClass ? '' : 'display:none;'}">
          <table style="text-align: center;">
            <thead>
              <tr>
                <th style="width: 60px;">교시</th>
                <th style="width: 120px;">수업</th>
                <th>📝 메모</th>
                <th style="width: 25%;">📌 비고</th>
              </tr>
            </thead>
            <tbody>
    `;

    for (let p = 1; p <= this.maxPeriod; p++) {
      const pObj = periods[p] || {};
      const periodName = window.periodNames[p - 1] || p + '교시';
      html += `
              <tr data-period="${p}">
                <td class="period-cell" onclick="window.dayViewInstance.openClassSwapModal(${p})" style="cursor:pointer; color:#2563eb; text-decoration:underline; font-weight:900; font-size:0.9rem;" title="클릭하여 수업 이동/맞바꾸기">${periodName}</td>
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
        <button onclick="window.dayViewInstance.addJournalEntry()" style="width:100%; padding:10px; margin-top:5px; background:#fdf2f8; color:#be185d; border:2px dashed #f472b6; border-radius:8px; cursor:pointer; font-weight:bold; font-size:1rem; transition:0.2s;">+ 일지 칸 추가</button>
      </div>
    </div>`;
    
    this.container.innerHTML = html;
    
    setTimeout(() => {
      this.renderEventEntries();
      this.renderJournalEntries();
    }, 0);
  }

  // ==========================================================================
  // ⚙️ 4. 에디터 내부 관리 기능 (일정 / 일지 / 맞바꾸기)
  // ==========================================================================
  renderEventEntries() {
    const container = document.getElementById('event-entries-container');
    if(!container) return;
    
    const labelObjs = window.getEventLabels();
    let html = '';
    
    this.currentEvents.forEach((e, index) => {
        if (!labelObjs.some(l => l.name === e.label)) e.label = labelObjs[0] ? labelObjs[0].name : '';
        
        let options = labelObjs.map(l => `<option value="${l.name}" ${e.label === l.name ? 'selected' : ''}>${l.name}</option>`).join('');
        options += `<option disabled>──────────</option><option value="__setting__">⚙️ 라벨 설정...</option>`;
        
        const isSkip = window.isSkipLabel(e.label);
        const selBg = isSkip ? '#fee2e2' : '#eff6ff';
        const selColor = isSkip ? '#ef4444' : '#1e40af';
        
        html += `
        <div class="event-entry-block" data-index="${index}" style="display:flex; gap:10px; margin-bottom:10px; align-items:flex-start;">
            <select class="event-label-select" onchange="if(this.value === '__setting__') { window.openEventLabelModal(); this.value='${e.label}'; } else { window.dayViewInstance.syncEventInputs(); window.dayViewInstance.renderEventEntries(); }" style="padding:10px; border-radius:6px; border:1px solid #cbd5e1; outline:none; font-size:1rem; width:110px; flex-shrink:0; font-weight:bold; color:${selColor}; background:${selBg}; transition:0.2s;">
                ${options}
            </select>
            <textarea class="event-content-input" placeholder="일정 내용을 입력하세요." style="flex-grow:1; padding:10px 12px; border-radius:6px; border:1px solid #cbd5e1; outline:none; font-size:1.05rem; resize:none; overflow:hidden; min-height:45px; background:#f8fafc;" oninput="this.style.height=''; this.style.height = this.scrollHeight + 'px'">${e.content}</textarea>
            <button onclick="window.dayViewInstance.removeEventEntry(${index})" style="background:#f1f5f9; border:1px solid #cbd5e1; color:#ef4444; font-size:1.2rem; cursor:pointer; padding:6px 10px; border-radius:6px; transition:0.2s;" title="삭제">✖</button>
        </div>`;
    });
    container.innerHTML = html;
    setTimeout(() => container.querySelectorAll('.event-content-input').forEach(ta => { ta.style.height = ta.scrollHeight + 'px'; }), 0);
  }

  syncEventInputs() {
    const blocks = document.querySelectorAll('.event-entry-block');
    blocks.forEach((block, idx) => {
        const label = block.querySelector('.event-label-select').value;
        const content = block.querySelector('.event-content-input').value;
        if(this.currentEvents[idx]) {
            this.currentEvents[idx].label = label;
            this.currentEvents[idx].content = content;
        }
    });
  }

  addEventEntry() {
    this.syncEventInputs();
    const defaultLabel = window.getEventLabels()[0]?.name || '일정';
    this.currentEvents.push({ label: defaultLabel, content: '' });
    this.renderEventEntries();
  }

  removeEventEntry(index) {
    this.syncEventInputs();
    this.currentEvents.splice(index, 1);
    this.renderEventEntries();
  }

  renderJournalEntries() {
    const container = document.getElementById('journal-entries-container');
    if(!container) return;
    let labels = window.getJournalLabels().map(l => l.name);
    let html = '';
    this.currentJournals.forEach((j, index) => {
        let options = labels.map(l => `<option value="${l}" ${j.label === l ? 'selected' : ''}>${l}</option>`).join('');
        options += `<option disabled>──────────</option><option value="__setting__">⚙️ 라벨 설정...</option>`;
        
        html += `
        <div class="journal-entry-block" data-index="${index}" style="display:flex; gap:10px; margin-bottom:10px; align-items:flex-start;">
            <select class="journal-label-select" onchange="if(this.value === '__setting__') { window.openJournalLabelModal(); this.value='${j.label}'; } else { window.dayViewInstance.syncJournalInputs(); window.dayViewInstance.renderJournalEntries(); }" style="padding:10px; border-radius:6px; border:1px solid #cbd5e1; outline:none; font-size:1rem; width:110px; flex-shrink:0; font-weight:bold; color:#be185d; background:#fdf2f8;">
                ${options}
            </select>
            <textarea class="journal-content-input" placeholder="사건이나 감상 등을 편하게 작성하세요." style="flex-grow:1; padding:10px 12px; border-radius:6px; border:1px solid #cbd5e1; outline:none; font-size:1.05rem; resize:none; overflow:hidden; min-height:45px; background:#f8fafc;" oninput="this.style.height=''; this.style.height = this.scrollHeight + 'px'">${j.content}</textarea>
            <button onclick="window.dayViewInstance.removeJournalEntry(${index})" style="background:#f1f5f9; border:1px solid #cbd5e1; color:#ef4444; font-size:1.2rem; cursor:pointer; padding:6px 10px; border-radius:6px; transition:0.2s;" title="삭제">✖</button>
        </div>`;
    });
    container.innerHTML = html;
    setTimeout(() => container.querySelectorAll('.journal-content-input').forEach(ta => { ta.style.height = ta.scrollHeight + 'px'; }), 0);
  }

  syncJournalInputs() {
    const blocks = document.querySelectorAll('.journal-entry-block');
    blocks.forEach((block, idx) => {
        if(this.currentJournals[idx]) {
            this.currentJournals[idx].label = block.querySelector('.journal-label-select').value;
            this.currentJournals[idx].content = block.querySelector('.journal-content-input').value;
        }
    });
  }

  addJournalEntry() {
    this.syncJournalInputs();
    const defaultLabel = window.getJournalLabels()[0]?.name || '참고';
    this.currentJournals.push({ label: defaultLabel, content: '' });
    this.renderJournalEntries();
  }

  removeJournalEntry(index) {
    this.syncJournalInputs();
    this.currentJournals.splice(index, 1);
    this.renderJournalEntries();
  }

  openClassSwapModal(sourcePeriod) {
    const sourceDate = this.dateStr;
    const sourceName = window.periodNames[sourcePeriod - 1] || sourcePeriod + '교시'; 

    const modalHtml = `
    <div id="swap-modal" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:10002; display:flex; justify-content:center; align-items:center;">
        <div style="background:#fff; padding:25px; border-radius:12px; width:340px; box-shadow:0 10px 25px rgba(0,0,0,0.2);">
            <h3 style="margin-top:0; color:#1e40af; border-bottom:2px solid #bfdbfe; padding-bottom:10px;">🔄 ${sourceName} 이동/맞바꾸기</h3>
            <p style="font-size:0.95rem; color:#475569; margin-bottom:15px; line-height:1.4;">선택한 ${sourceName}의 내용을 아래 선택한 날짜/시간과 <b>서로 맞바꿉니다.</b></p>
            
            <div style="margin-bottom:15px;">
                <label style="display:block; font-weight:bold; margin-bottom:5px; color:#1e293b;">목표 날짜</label>
                <input type="date" id="swap-target-date" value="${sourceDate}" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:6px; font-size:1.05rem; outline:none;">
            </div>
            <div style="margin-bottom:25px;">
                <label style="display:block; font-weight:bold; margin-bottom:5px; color:#1e293b;">목표 시간</label>
                <select id="swap-target-period" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:6px; font-size:1.05rem; outline:none;">
                    ${window.periodNames.map((name, i) => `<option value="${i + 1}" ${i + 1 === sourcePeriod ? 'selected' : ''}>${name}</option>`).join('')}
                </select>
            </div>
            
            <div style="display:flex; justify-content:flex-end; gap:10px;">
                <button onclick="document.getElementById('swap-modal').remove()" style="padding:10px 16px; border:none; background:#f1f5f9; color:#475569; font-weight:bold; border-radius:6px; cursor:pointer; font-size:1rem;">취소</button>
                <button onclick="window.dayViewInstance.executeClassSwap(${sourcePeriod})" style="padding:10px 16px; border:none; background:#2563eb; color:#fff; font-weight:bold; border-radius:6px; cursor:pointer; font-size:1rem;">이동 실행</button>
            </div>
        </div>
    </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  }

  async executeClassSwap(sourcePeriod) {
    const sourceDate = this.dateStr;
    const targetDate = document.getElementById('swap-target-date').value;
    const targetPeriod = parseInt(document.getElementById('swap-target-period').value, 10);

    if (!targetDate) return alert("목표 날짜를 선택해주세요.");

    const currentDOMPeriods = {};
    for(let p=1; p<=this.maxPeriod; p++) {
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

        for(let p=1; p<=this.maxPeriod; p++) {
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
  }

  // ==========================================================================
  // 💾 5. 데이터 최종 저장 (부모의 save 메서드 구현)
  // ==========================================================================
  async save() {
    const dateStr = this.dateStr;

    this.syncEventInputs();
    const validEvents = this.currentEvents.filter(e => e.content.trim() !== '');
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

      if (isSkipDay) subject = ''; 
      periodsData[p] = { subject, memo, supplies };
    });

    await window.dbAPI.saveSchedule(dateStr, periodsData);
    
    this.syncJournalInputs();
    const validJournals = this.currentJournals.filter(j => j.content.trim() !== '');
    await window.getUserCol('journals').doc(dateStr).set({ entries: validJournals, updatedAt: Date.now() });
  }
}

// ==========================================================================
// 🔌 하위 호환성 유지 브릿지 (app.js가 수정 없이 그대로 동작하도록 연결)
// ==========================================================================
window.dayViewInstance = new DayView(document.getElementById("main-view"));

window.renderDayViewer = (container) => {
  window.dayViewInstance.container = container;
  window.dayViewInstance.renderViewer();
};

window.renderDayEditor = (container) => {
  window.dayViewInstance.container = container;
  window.dayViewInstance.renderEditor();
};

window.saveDayDataFromEditor = () => window.dayViewInstance.save();
