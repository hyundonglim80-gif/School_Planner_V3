// js/viewDay.js

class DayView extends window.BaseView {
  constructor(container) {
    super(container);
    this.currentEvents = [];
    this.currentJournals = [];
  }

  parseEvents(docData) {
    if (!docData) return [];
    if (docData.eventList && docData.eventList.length > 0) return docData.eventList;
    if (docData.eventText && docData.eventText.trim() !== '') return window.parseRawEventTextToEventList(docData.eventText);
    return [];
  }

  renderLabelChips(containerElement, allLabelsObj, selectedLabelsArray, onChangeCallback) {
      if (!containerElement) return;
      containerElement.innerHTML = '';
      containerElement.style.margin = "0";

      allLabelsObj.forEach(labelObj => {
          const labelText = labelObj.name;
          const chip = document.createElement('div');
          chip.className = 'label-chip';
          chip.innerText = labelText;
          if (selectedLabelsArray.includes(labelText)) {
              chip.classList.add('active');
          }
          
          chip.addEventListener('click', () => {
              const isActive = selectedLabelsArray.includes(labelText);
              
              if (isActive) {
                  // 이미 켜져있으면 끕니다.
                  selectedLabelsArray = selectedLabelsArray.filter(l => l !== labelText);
              } else {
                  // 기간 라벨이면 팝업 호출
                  if (window.isPeriodLabel && window.isPeriodLabel(labelText)) {
                      const textarea = chip.closest('.event-entry-block').querySelector('.event-content-input');
                      window.openPeriodModal(window.dayViewInstance.dateStr, labelText, textarea ? textarea.value : '', function(isSaved) {
                          if(isSaved) window.render();
                      });
                      return;
                  }
                  
                  // 완료 속성 라벨이면 기간 라벨 밀어내기 (상호 배타)
                  if (window.isForwardLabel && window.isForwardLabel(labelText)) {
                      selectedLabelsArray = selectedLabelsArray.filter(l => !window.isPeriodLabel(l));
                  }
                  
                  selectedLabelsArray.push(labelText);
              }
              
              if (onChangeCallback) onChangeCallback(selectedLabelsArray);
              // 확실한 화면 업데이트를 위해 에디터 블록 렌더링 호출
              window.dayViewInstance.renderEventEntries();
          });
          containerElement.appendChild(chip);
      });
  }

  async renderViewer() {
    this.showLoading('클라우드 데이터를 불러오는 중...'); 

    const dateStr = this.dateStr; 
    const dayData = await window.dbAPI.loadDayData(dateStr);
    const periods = dayData.periods || {};
    
    const eventDoc = await window.getUserCol('events').doc(dateStr).get();
    const events = eventDoc.exists ? this.parseEvents(eventDoc.data()) : [];
    
    const journalDoc = await window.getUserCol('journals').doc(dateStr).get();
    const journals = journalDoc.exists ? journalDoc.data().entries || [] : [];

    let html = `<div class="day-viewer-container">`;

    // --- 1. 일정 뷰어 영역 ---
    html += `<div class="day-event-card" style="display: flex; align-items: flex-start; padding: 16px; border: 1px solid #cbd5e1; border-left: 5px solid #2563eb; border-radius: 8px; margin-bottom: 16px; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
              <div style="width: 110px; font-weight: 700; font-size: 1.1rem; color: #1e40af; flex-shrink: 0;">📌 오늘 할 일</div>
              <div style="flex-grow: 1; padding-left:12px; border-left: 2px solid #e2e8f0;">`;
              
    if (events.length > 0) {
      let processedEvents = events.map(e => ({
          ...e,
          labels: (e.labels && e.labels.length > 0) ? e.labels : (e.label ? [e.label] : ['기타'])
      }));
      html += window.generateEventBadgesHTML(processedEvents, dateStr);
    } else {
      html += `<div style="color:#94a3b8; font-size:1.05rem;">등록된 일정이 없습니다.</div>`;
    }
    html += `</div></div>`;
        
    // --- 2. 시간표 뷰어 영역 ---
    if (window.showClass) {
      html += `<div class="period-card-list">`;
      for (let p = 1; p <= this.maxPeriod; p++) {
        const pData = periods[p] || {};
        const periodName = window.periodNames[p - 1] || p + '교시'; 
        const subject = pData.subject || '';
        const supplies = pData.supplies || '';
        const memo = pData.memo || '';

        const memoHtml = memo.trim() !== '' ? `<div class="period-memo" style="margin-top: 4px; font-size: 0.95rem; color: #475569;">📝 수업 메모: ${memo}</div>` : '';
        const suppliesHtml = supplies.trim() !== '' ? `<div class="period-supplies" style="margin-top: 6px; font-size: 0.95rem; color: #b45309;">📌 비고: ${supplies}</div>` : '';

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

    // --- 3. 기록 뷰어 영역 ---
    if (journals.length > 0) {
      html += `<div class="day-journal-section" style="margin-top:20px;">
                <h3 style="font-size:1.2rem; color:#be185d; margin-bottom:10px;">📔 오늘 기록</h3>`;
      
      journals.forEach(j => {
        let labels = j.labels || (j.label ? [j.label] : []); 
        if (labels.length === 0) labels = ['참고'];

        const mainStyle = window.getLabelStyle(labels[0], 'journal');
        
        const labelsHtml = labels.map(l => {
             const s = window.getLabelStyle(l, 'journal');
             return `<span style="display:inline-block; font-weight:bold; color:${s.text}; background:${s.bg}; padding:2px 8px; border-radius:12px; margin-right:6px; font-size:0.9rem; border:1px solid ${s.border};">${l}</span>`;
        }).join('');

        html += `
          <div style="background:#fff; border:1px solid ${mainStyle.border}; border-left:5px solid ${mainStyle.text}; border-radius:8px; padding:12px; margin-bottom:10px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
              <div style="margin-bottom:8px;">${labelsHtml}</div>
              <div style="color:#1e293b; font-size:1.05rem; line-height:1.5; white-space:pre-wrap; word-break:break-all;">${j.content}</div>
          </div>`;
      });
      html += `</div>`;
    }

    html += `</div>`;
    this.container.innerHTML = html;
  }

  async renderEditor() {
    this.showLoading('편집 화면을 준비 중...');

    const dateStr = this.dateStr;
    const dayData = await window.dbAPI.loadDayData(dateStr);
    const periods = dayData.periods || {};
    
    const eventDoc = await window.getUserCol('events').doc(dateStr).get();
    const events = eventDoc.exists ? this.parseEvents(eventDoc.data()) : [];
    
    this.currentEvents = events.map(e => ({
        ...e,
        labels: e.labels || (e.label ? [e.label] : [])
    }));
    if (this.currentEvents.length === 0) this.currentEvents.push({ labels: [], content: '', completed: false });
    
    const journalDoc = await window.getUserCol('journals').doc(dateStr).get();
    const journals = journalDoc.exists ? journalDoc.data().entries || [] : [];
    
    this.currentJournals = journals.map(j => ({
        ...j,
        labels: j.labels || (j.label ? [j.label] : [])
    }));
    if (this.currentJournals.length === 0) this.currentJournals.push({ labels: [], content: '' });

    let html = `<div class="day-viewer-container">`;

    // --- 1. 일정 에디터 영역 ---
    html += `
      <div class="day-event-editor-section" style="background: #fff; padding: 15px; border-radius: 8px; border: 1px solid #cbd5e1; box-shadow: 0 1px 3px rgba(0,0,0,0.05); border-left: 5px solid #2563eb;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 15px;">
          <h3 style="font-size:1.2rem; color:#1e40af; margin:0; font-weight:bold;">📌 오늘 할 일</h3>
          <button onclick="window.openEventLabelModal()" style="background:#f8fafc; border:1px solid #cbd5e1; padding:4px 10px; border-radius:6px; cursor:pointer; font-size:0.85rem; font-weight:bold;">⚙️ 설정</button>
        </div>
        <div id="event-entries-container"></div>
        <button onclick="window.dayViewInstance.addEventEntry()" style="width:100%; padding:10px; margin-top:5px; background:#eff6ff; color:#2563eb; border:2px dashed #bfdbfe; border-radius:8px; cursor:pointer; font-weight:bold; font-size:1rem; transition:0.2s;">+ 일정 추가</button>
      </div>
    `;

    // --- 2. 시간표 에디터 영역 ---
    html += `
        <div class="table-container" style="margin-top:10px; ${window.showClass ? '' : 'display:none;'}">
          <table style="text-align: center;">
            <thead>
              <tr>
                <th style="width: 60px;">교시</th>
                <th style="width: 120px;">수업</th>
                <th>📝 수업 메모</th>
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
                <td class="period-cell" onclick="window.dayViewInstance.openClassSwapModal(${p})" style="cursor:pointer; color:#2563eb; text-decoration:underline; font-weight:900; font-size:0.9rem;" title="클릭하여 교환">${periodName}</td>
                <td class="editable-cell cell-subject" contenteditable="true">${pObj.subject || ''}</td>
                <td class="editable-cell cell-memo" contenteditable="true" style="text-align: left;">${pObj.memo || ''}</td>
                <td class="editable-cell cell-supplies" contenteditable="true" style="color: #d97706; font-weight: 600; text-align: left;">${pObj.supplies || ''}</td>
              </tr>
      `;
    }
    html += `</tbody></table></div>`;

    // --- 3. 기록 에디터 영역 ---
    html += `
      <div class="day-journal-editor-section" style="margin-top: 15px; background: #fff; padding: 15px; border-radius: 8px; border: 1px solid #cbd5e1; box-shadow: 0 1px 3px rgba(0,0,0,0.05); border-left: 5px solid #be185d;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 15px;">
          <h3 style="font-size:1.2rem; color:#be185d; margin:0; font-weight:bold;">📔 오늘 기록</h3>
          <button onclick="window.openJournalLabelModal()" style="background:#fdf2f8; border:1px solid #fbcfe8; padding:4px 10px; border-radius:6px; cursor:pointer; font-size:0.85rem; font-weight:bold; color:#be185d;">⚙️ 설정</button>
        </div>
        <div id="journal-entries-container"></div>
        <button onclick="window.dayViewInstance.addJournalEntry()" style="width:100%; padding:10px; margin-top:5px; background:#fdf2f8; color:#be185d; border:2px dashed #f472b6; border-radius:8px; cursor:pointer; font-weight:bold; font-size:1rem; transition:0.2s;">+ 기록 추가</button>
      </div>
    </div>`;
    
    this.container.innerHTML = html;
    
    setTimeout(() => {
      this.renderEventEntries();
      this.renderJournalEntries();
    }, 0);
  }

  renderEventEntries() {
    const container = document.getElementById('event-entries-container');
    if(!container) return;
    const labelObjs = window.getEventLabels();
    
    container.innerHTML = '';
    
    this.currentEvents.forEach((e, index) => {
        const block = document.createElement('div');
        block.className = "event-entry-block";
        block.style.cssText = "border:1px solid #cbd5e1; border-radius:8px; padding:10px; margin-bottom:12px; background:#f8fafc;";
        
        const topRow = document.createElement('div');
        topRow.style.cssText = "display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;";
        
        const chipContainer = document.createElement('div');
        chipContainer.className = "label-chip-container";
        chipContainer.style.margin = "0";
        
        this.renderLabelChips(chipContainer, labelObjs, e.labels, (newLabels) => {
            this.currentEvents[index].labels = newLabels;
        });

        const actions = document.createElement('div');
        actions.style.display = "flex";
        actions.style.gap = "8px";
        
        const isCompleted = !!e.completed;
        // 완료 속성이 있을 때만 체크박스 표시
        const canComplete = (typeof window.isForwardLabel === 'function' && e.labels && e.labels.length > 0) ? window.isForwardLabel(e.labels[0]) : false;
        const inputStyle = (isCompleted && canComplete) ? 'text-decoration:line-through; color:#94a3b8; background:#e2e8f0;' : 'background:#fff; color:#1e293b;';

        const checkboxHtml = canComplete 
            ? `<label style="display:flex; align-items:center; gap:4px; cursor:pointer; padding:4px 8px; background:#fff; border:1px solid #cbd5e1; border-radius:6px;">
                 <input type="checkbox" class="event-complete-check" ${isCompleted ? 'checked' : ''} style="width:16px; height:16px; cursor:pointer;">
                 <span style="font-size:0.85rem; font-weight:bold; color:${isCompleted ? '#059669' : '#64748b'};">완료</span>
               </label>`
            : '';

        actions.innerHTML = `
            ${checkboxHtml}
            <button class="delete-btn" style="background:#fff; border:1px solid #cbd5e1; color:#ef4444; cursor:pointer; padding:4px 8px; border-radius:6px;">✖</button>
        `;

        topRow.appendChild(chipContainer);
        topRow.appendChild(actions);
        
        const ta = document.createElement('textarea');
        ta.className = "event-content-input";
        ta.placeholder = "일정 내용을 입력하세요.";
        ta.style.cssText = `width:100%; padding:10px; border-radius:6px; border:1px solid #cbd5e1; outline:none; font-size:1.05rem; resize:none; overflow:hidden; min-height:45px; box-sizing:border-box; ${inputStyle}`;
        ta.value = e.content;
        
        ta.addEventListener('input', () => { ta.style.height = ''; ta.style.height = ta.scrollHeight + 'px'; });
        ta.addEventListener('change', () => this.syncEventInputs());
        
        if (canComplete) {
            actions.querySelector('.event-complete-check').addEventListener('change', () => { this.syncEventInputs(); this.renderEventEntries(); });
        }
        actions.querySelector('.delete-btn').addEventListener('click', () => this.removeEventEntry(index));

        block.appendChild(topRow);
        block.appendChild(ta);
        container.appendChild(block);
        
        setTimeout(() => { ta.style.height = ta.scrollHeight + 'px'; }, 0);
    });
  }

  syncEventInputs() {
    const blocks = document.querySelectorAll('.event-entry-block');
    blocks.forEach((block, idx) => {
        if(this.currentEvents[idx]) {
            this.currentEvents[idx].content = block.querySelector('.event-content-input').value;
            const chk = block.querySelector('.event-complete-check');
            if(chk) this.currentEvents[idx].completed = chk.checked;
        }
    });
  }

  addEventEntry() {
    this.syncEventInputs();
    this.currentEvents.push({ labels: [], content: '', completed: false });
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
    const labelObjs = window.getJournalLabels();
    
    container.innerHTML = '';
    
    this.currentJournals.forEach((j, index) => {
        const block = document.createElement('div');
        block.className = "journal-entry-block";
        block.style.cssText = "border:1px solid #fbcfe8; border-radius:8px; padding:10px; margin-bottom:12px; background:#fdf2f8;";
        
        const topRow = document.createElement('div');
        topRow.style.cssText = "display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;";
        
        const chipContainer = document.createElement('div');
        chipContainer.className = "label-chip-container";
        chipContainer.style.margin = "0";
        
        this.renderLabelChips(chipContainer, labelObjs, j.labels, (newLabels) => {
            this.currentJournals[index].labels = newLabels;
        });

        const delBtn = document.createElement('button');
        delBtn.innerHTML = "✖";
        delBtn.style.cssText = "background:#fff; border:1px solid #fbcfe8; color:#ef4444; cursor:pointer; padding:4px 8px; border-radius:6px;";
        delBtn.addEventListener('click', () => this.removeJournalEntry(index));

        topRow.appendChild(chipContainer);
        topRow.appendChild(delBtn);
        
        const ta = document.createElement('textarea');
        ta.className = "journal-content-input";
        ta.placeholder = "사건이나 감상 등을 편하게 작성하세요.";
        ta.style.cssText = `width:100%; padding:10px; border-radius:6px; border:1px solid #fbcfe8; outline:none; font-size:1.05rem; resize:none; overflow:hidden; min-height:45px; box-sizing:border-box; background:#fff;`;
        ta.value = j.content;
        
        ta.addEventListener('input', () => { ta.style.height = ''; ta.style.height = ta.scrollHeight + 'px'; });
        ta.addEventListener('change', () => this.syncJournalInputs());

        block.appendChild(topRow);
        block.appendChild(ta);
        container.appendChild(block);
        
        setTimeout(() => { ta.style.height = ta.scrollHeight + 'px'; }, 0);
    });
  }

  syncJournalInputs() {
    const blocks = document.querySelectorAll('.journal-entry-block');
    blocks.forEach((block, idx) => {
        if(this.currentJournals[idx]) {
            this.currentJournals[idx].content = block.querySelector('.journal-content-input').value;
        }
    });
  }

  addJournalEntry() {
    this.syncJournalInputs();
    this.currentJournals.push({ labels: [], content: '' });
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
            <h3 style="margin-top:0; color:#1e40af; border-bottom:2px solid #bfdbfe; padding-bottom:10px;">🔄 ${sourceName} 교환</h3>
            <p style="font-size:0.95rem; color:#475569; margin-bottom:15px;">선택한 ${sourceName}의 내용을 다른 날짜/시간과 서로 맞바꿉니다.</p>
            <div style="margin-bottom:15px;">
                <label style="display:block; font-weight:bold; margin-bottom:5px;">목표 날짜</label>
                <input type="date" id="swap-target-date" value="${sourceDate}" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:6px;">
            </div>
            <div style="margin-bottom:25px;">
                <label style="display:block; font-weight:bold; margin-bottom:5px;">목표 시간</label>
                <select id="swap-target-period" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:6px;">
                    ${window.periodNames.map((name, i) => `<option value="${i + 1}" ${i + 1 === sourcePeriod ? 'selected' : ''}>${name}</option>`).join('')}
                </select>
            </div>
            <div style="display:flex; justify-content:flex-end; gap:10px;">
                <button onclick="document.getElementById('swap-modal').remove()" style="padding:10px 16px; border:none; background:#f1f5f9; font-weight:bold; border-radius:6px; cursor:pointer;">취소</button>
                <button onclick="window.dayViewInstance.executeClassSwap(${sourcePeriod})" style="padding:10px 16px; border:none; background:#2563eb; color:#fff; font-weight:bold; border-radius:6px; cursor:pointer;">이동 실행</button>
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
        document.getElementById('swap-modal').innerHTML = `<div style="background:#fff; padding:30px; border-radius:12px; font-weight:bold; color:#2563eb; text-align:center;">⏳ 클라우드 통신 중...</div>`;

        const targetDoc = await window.getUserCol('schedules').doc(targetDate).get();
        const targetPeriodsDB = targetDoc.exists ? (targetDoc.data().periods || {}) : {};
        const targetData = targetPeriodsDB[targetPeriod] || {subject:'', memo:'', supplies:''};

        targetPeriodsDB[targetPeriod] = sourceData;
        await window.getUserCol('schedules').doc(targetDate).set({ periods: targetPeriodsDB, updatedAt: Date.now() });

        const sourceRow = document.querySelector(`tr[data-period="${sourcePeriod}"]`);
        sourceRow.querySelector(".cell-subject").innerText = targetData.subject;
        sourceRow.querySelector(".cell-memo").innerText = targetData.memo;
        sourceRow.querySelector(".cell-supplies").innerText = targetData.supplies;
        
        alert(`✅ 변경되었습니다! \n반드시 상단의 [💾 저장] 버튼을 누르세요.`);
    }
    
    const modal = document.getElementById('swap-modal');
    if(modal) modal.remove();
    
    window.hasUnsavedChanges = true; 
  }

  async save() {
    const dateStr = this.dateStr;

    this.syncEventInputs();
    const validEvents = this.currentEvents.filter(e => e.content.trim() !== '' || (e.labels && e.labels.length > 0));
    
    const eventTextForLegacy = validEvents.map(e => {
       const labels = e.labels && e.labels.length > 0 ? e.labels.map(l => `[${l}]`).join(' ') : '';
       return `${labels} ${e.content}`;
    }).join('\n');
    
    await window.getUserCol('events').doc(dateStr).set({
        eventList: validEvents,
        eventText: eventTextForLegacy,
        updatedAt: Date.now()
    });

    let isSkipDay = false;
    for (const e of validEvents) {
        if (e.labels && e.labels.some(l => window.isSkipLabel(l))) {
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
    const validJournals = this.currentJournals.filter(j => j.content.trim() !== '' || (j.labels && j.labels.length > 0));
    await window.getUserCol('journals').doc(dateStr).set({ entries: validJournals, updatedAt: Date.now() });
  }
}

window.dayViewInstance = new DayView(document.getElementById("main-view"));
window.renderDayViewer = (container) => { window.dayViewInstance.container = container; window.dayViewInstance.renderViewer(); };
window.renderDayEditor = (container) => { window.dayViewInstance.container = container; window.dayViewInstance.renderEditor(); };
window.saveDayDataFromEditor = () => window.dayViewInstance.save();
    }

    // --- 3. 기록 뷰어 영역 ---
    if (journals.length > 0) {
      html += `<div class="day-journal-section" style="margin-top:20px;">
                <h3 style="font-size:1.2rem; color:#be185d; margin-bottom:10px;">📔 오늘 기록</h3>`;
      
      journals.forEach(j => {
        let labels = j.labels || (j.label ? [j.label] : []); 
        if (labels.length === 0) labels = ['참고'];

        const mainStyle = window.getLabelStyle(labels[0], 'journal');
        
        const labelsHtml = labels.map(l => {
             const s = window.getLabelStyle(l, 'journal');
             return `<span style="display:inline-block; font-weight:bold; color:${s.text}; background:${s.bg}; padding:2px 8px; border-radius:12px; margin-right:6px; font-size:0.9rem; border:1px solid ${s.border};">${l}</span>`;
        }).join('');

        html += `
          <div style="background:#fff; border:1px solid ${mainStyle.border}; border-left:5px solid ${mainStyle.text}; border-radius:8px; padding:12px; margin-bottom:10px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
              <div style="margin-bottom:8px;">${labelsHtml}</div>
              <div style="color:#1e293b; font-size:1.05rem; line-height:1.5; white-space:pre-wrap; word-break:break-all;">${j.content}</div>
          </div>`;
      });
      html += `</div>`;
    }

    html += `</div>`;
    this.container.innerHTML = html;
  }

  async renderEditor() {
    this.showLoading('편집 화면을 준비 중...');

    const dateStr = this.dateStr;
    const dayData = await window.dbAPI.loadDayData(dateStr);
    const periods = dayData.periods || {};
    
    const eventDoc = await window.getUserCol('events').doc(dateStr).get();
    const events = eventDoc.exists ? this.parseEvents(eventDoc.data()) : [];
    
    this.currentEvents = events.map(e => ({
        ...e,
        labels: e.labels || (e.label ? [e.label] : [])
    }));
    if (this.currentEvents.length === 0) this.currentEvents.push({ labels: [], content: '', completed: false });
    
    const journalDoc = await window.getUserCol('journals').doc(dateStr).get();
    const journals = journalDoc.exists ? journalDoc.data().entries || [] : [];
    
    this.currentJournals = journals.map(j => ({
        ...j,
        labels: j.labels || (j.label ? [j.label] : [])
    }));
    if (this.currentJournals.length === 0) this.currentJournals.push({ labels: [], content: '' });

    let html = `<div class="day-viewer-container">`;

    // --- 1. 일정 에디터 영역 ---
    html += `
      <div class="day-event-editor-section" style="background: #fff; padding: 15px; border-radius: 8px; border: 1px solid #cbd5e1; box-shadow: 0 1px 3px rgba(0,0,0,0.05); border-left: 5px solid #2563eb;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 15px;">
          <h3 style="font-size:1.2rem; color:#1e40af; margin:0; font-weight:bold;">📌 오늘 할 일</h3>
          <button onclick="window.openEventLabelModal()" style="background:#f8fafc; border:1px solid #cbd5e1; padding:4px 10px; border-radius:6px; cursor:pointer; font-size:0.85rem; font-weight:bold;">⚙️ 설정</button>
        </div>
        <div id="event-entries-container"></div>
        <button onclick="window.dayViewInstance.addEventEntry()" style="width:100%; padding:10px; margin-top:5px; background:#eff6ff; color:#2563eb; border:2px dashed #bfdbfe; border-radius:8px; cursor:pointer; font-weight:bold; font-size:1rem; transition:0.2s;">+ 일정 추가</button>
      </div>
    `;

    // --- 2. 시간표 에디터 영역 ---
    html += `
        <div class="table-container" style="margin-top:10px; ${window.showClass ? '' : 'display:none;'}">
          <table style="text-align: center;">
            <thead>
              <tr>
                <th style="width: 60px;">교시</th>
                <th style="width: 120px;">수업</th>
                <th>📝 수업 메모</th>
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
                <td class="period-cell" onclick="window.dayViewInstance.openClassSwapModal(${p})" style="cursor:pointer; color:#2563eb; text-decoration:underline; font-weight:900; font-size:0.9rem;" title="클릭하여 교환">${periodName}</td>
                <td class="editable-cell cell-subject" contenteditable="true">${pObj.subject || ''}</td>
                <td class="editable-cell cell-memo" contenteditable="true" style="text-align: left;">${pObj.memo || ''}</td>
                <td class="editable-cell cell-supplies" contenteditable="true" style="color: #d97706; font-weight: 600; text-align: left;">${pObj.supplies || ''}</td>
              </tr>
      `;
    }
    html += `</tbody></table></div>`;

    // --- 3. 기록 에디터 영역 ---
    html += `
      <div class="day-journal-editor-section" style="margin-top: 15px; background: #fff; padding: 15px; border-radius: 8px; border: 1px solid #cbd5e1; box-shadow: 0 1px 3px rgba(0,0,0,0.05); border-left: 5px solid #be185d;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 15px;">
          <h3 style="font-size:1.2rem; color:#be185d; margin:0; font-weight:bold;">📔 오늘 기록</h3>
          <button onclick="window.openJournalLabelModal()" style="background:#fdf2f8; border:1px solid #fbcfe8; padding:4px 10px; border-radius:6px; cursor:pointer; font-size:0.85rem; font-weight:bold; color:#be185d;">⚙️ 설정</button>
        </div>
        <div id="journal-entries-container"></div>
        <button onclick="window.dayViewInstance.addJournalEntry()" style="width:100%; padding:10px; margin-top:5px; background:#fdf2f8; color:#be185d; border:2px dashed #f472b6; border-radius:8px; cursor:pointer; font-weight:bold; font-size:1rem; transition:0.2s;">+ 기록 추가</button>
      </div>
    </div>`;
    
    this.container.innerHTML = html;
    
    setTimeout(() => {
      this.renderEventEntries();
      this.renderJournalEntries();
    }, 0);
  }

  renderEventEntries() {
    const container = document.getElementById('event-entries-container');
    if(!container) return;
    const labelObjs = window.getEventLabels();
    
    container.innerHTML = '';
    
    this.currentEvents.forEach((e, index) => {
        const block = document.createElement('div');
        block.className = "event-entry-block";
        block.style.cssText = "border:1px solid #cbd5e1; border-radius:8px; padding:10px; margin-bottom:12px; background:#f8fafc;";
        
        const topRow = document.createElement('div');
        topRow.style.cssText = "display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;";
        
        const chipContainer = document.createElement('div');
        chipContainer.className = "label-chip-container";
        chipContainer.style.margin = "0";
        
        this.renderLabelChips(chipContainer, labelObjs, e.labels, (newLabels) => {
            this.currentEvents[index].labels = newLabels;
        });

        const actions = document.createElement('div');
        actions.style.display = "flex";
        actions.style.gap = "8px";
        
        const isCompleted = !!e.completed;
        const inputStyle = isCompleted ? 'text-decoration:line-through; color:#94a3b8; background:#e2e8f0;' : 'background:#fff; color:#1e293b;';

        actions.innerHTML = `
            <label style="display:flex; align-items:center; gap:4px; cursor:pointer; padding:4px 8px; background:#fff; border:1px solid #cbd5e1; border-radius:6px;">
                <input type="checkbox" class="event-complete-check" ${isCompleted ? 'checked' : ''} style="width:16px; height:16px; cursor:pointer;">
                <span style="font-size:0.85rem; font-weight:bold; color:${isCompleted ? '#059669' : '#64748b'};">완료</span>
            </label>
            <button class="delete-btn" style="background:#fff; border:1px solid #cbd5e1; color:#ef4444; cursor:pointer; padding:4px 8px; border-radius:6px;">✖</button>
        `;

        topRow.appendChild(chipContainer);
        topRow.appendChild(actions);
        
        const ta = document.createElement('textarea');
        ta.className = "event-content-input";
        ta.placeholder = "일정 내용을 입력하세요.";
        ta.style.cssText = `width:100%; padding:10px; border-radius:6px; border:1px solid #cbd5e1; outline:none; font-size:1.05rem; resize:none; overflow:hidden; min-height:45px; box-sizing:border-box; ${inputStyle}`;
        ta.value = e.content;
        
        ta.addEventListener('input', () => { ta.style.height = ''; ta.style.height = ta.scrollHeight + 'px'; });
        ta.addEventListener('change', () => this.syncEventInputs());
        actions.querySelector('.event-complete-check').addEventListener('change', () => { this.syncEventInputs(); this.renderEventEntries(); });
        actions.querySelector('.delete-btn').addEventListener('click', () => this.removeEventEntry(index));

        block.appendChild(topRow);
        block.appendChild(ta);
        container.appendChild(block);
        
        setTimeout(() => { ta.style.height = ta.scrollHeight + 'px'; }, 0);
    });
  }

  syncEventInputs() {
    const blocks = document.querySelectorAll('.event-entry-block');
    blocks.forEach((block, idx) => {
        if(this.currentEvents[idx]) {
            this.currentEvents[idx].content = block.querySelector('.event-content-input').value;
            this.currentEvents[idx].completed = block.querySelector('.event-complete-check')?.checked || false;
        }
    });
  }

  addEventEntry() {
    this.syncEventInputs();
    this.currentEvents.push({ labels: [], content: '', completed: false });
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
    const labelObjs = window.getJournalLabels();
    
    container.innerHTML = '';
    
    this.currentJournals.forEach((j, index) => {
        const block = document.createElement('div');
        block.className = "journal-entry-block";
        block.style.cssText = "border:1px solid #fbcfe8; border-radius:8px; padding:10px; margin-bottom:12px; background:#fdf2f8;";
        
        const topRow = document.createElement('div');
        topRow.style.cssText = "display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;";
        
        const chipContainer = document.createElement('div');
        chipContainer.className = "label-chip-container";
        chipContainer.style.margin = "0";
        
        this.renderLabelChips(chipContainer, labelObjs, j.labels, (newLabels) => {
            this.currentJournals[index].labels = newLabels;
        });

        const delBtn = document.createElement('button');
        delBtn.innerHTML = "✖";
        delBtn.style.cssText = "background:#fff; border:1px solid #fbcfe8; color:#ef4444; cursor:pointer; padding:4px 8px; border-radius:6px;";
        delBtn.addEventListener('click', () => this.removeJournalEntry(index));

        topRow.appendChild(chipContainer);
        topRow.appendChild(delBtn);
        
        const ta = document.createElement('textarea');
        ta.className = "journal-content-input";
        ta.placeholder = "사건이나 감상 등을 편하게 작성하세요.";
        ta.style.cssText = `width:100%; padding:10px; border-radius:6px; border:1px solid #fbcfe8; outline:none; font-size:1.05rem; resize:none; overflow:hidden; min-height:45px; box-sizing:border-box; background:#fff;`;
        ta.value = j.content;
        
        ta.addEventListener('input', () => { ta.style.height = ''; ta.style.height = ta.scrollHeight + 'px'; });
        ta.addEventListener('change', () => this.syncJournalInputs());

        block.appendChild(topRow);
        block.appendChild(ta);
        container.appendChild(block);
        
        setTimeout(() => { ta.style.height = ta.scrollHeight + 'px'; }, 0);
    });
  }

  syncJournalInputs() {
    const blocks = document.querySelectorAll('.journal-entry-block');
    blocks.forEach((block, idx) => {
        if(this.currentJournals[idx]) {
            this.currentJournals[idx].content = block.querySelector('.journal-content-input').value;
        }
    });
  }

  addJournalEntry() {
    this.syncJournalInputs();
    this.currentJournals.push({ labels: [], content: '' });
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
            <h3 style="margin-top:0; color:#1e40af; border-bottom:2px solid #bfdbfe; padding-bottom:10px;">🔄 ${sourceName} 교환</h3>
            <p style="font-size:0.95rem; color:#475569; margin-bottom:15px;">선택한 ${sourceName}의 내용을 다른 날짜/시간과 서로 맞바꿉니다.</p>
            <div style="margin-bottom:15px;">
                <label style="display:block; font-weight:bold; margin-bottom:5px;">목표 날짜</label>
                <input type="date" id="swap-target-date" value="${sourceDate}" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:6px;">
            </div>
            <div style="margin-bottom:25px;">
                <label style="display:block; font-weight:bold; margin-bottom:5px;">목표 시간</label>
                <select id="swap-target-period" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:6px;">
                    ${window.periodNames.map((name, i) => `<option value="${i + 1}" ${i + 1 === sourcePeriod ? 'selected' : ''}>${name}</option>`).join('')}
                </select>
            </div>
            <div style="display:flex; justify-content:flex-end; gap:10px;">
                <button onclick="document.getElementById('swap-modal').remove()" style="padding:10px 16px; border:none; background:#f1f5f9; font-weight:bold; border-radius:6px; cursor:pointer;">취소</button>
                <button onclick="window.dayViewInstance.executeClassSwap(${sourcePeriod})" style="padding:10px 16px; border:none; background:#2563eb; color:#fff; font-weight:bold; border-radius:6px; cursor:pointer;">이동 실행</button>
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
        document.getElementById('swap-modal').innerHTML = `<div style="background:#fff; padding:30px; border-radius:12px; font-weight:bold; color:#2563eb; text-align:center;">⏳ 클라우드 통신 중...</div>`;

        const targetDoc = await window.getUserCol('schedules').doc(targetDate).get();
        const targetPeriodsDB = targetDoc.exists ? (targetDoc.data().periods || {}) : {};
        const targetData = targetPeriodsDB[targetPeriod] || {subject:'', memo:'', supplies:''};

        targetPeriodsDB[targetPeriod] = sourceData;
        await window.getUserCol('schedules').doc(targetDate).set({ periods: targetPeriodsDB, updatedAt: Date.now() });

        const sourceRow = document.querySelector(`tr[data-period="${sourcePeriod}"]`);
        sourceRow.querySelector(".cell-subject").innerText = targetData.subject;
        sourceRow.querySelector(".cell-memo").innerText = targetData.memo;
        sourceRow.querySelector(".cell-supplies").innerText = targetData.supplies;
        
        alert(`✅ 변경되었습니다! \n반드시 상단의 [💾 저장] 버튼을 누르세요.`);
    }
    
    const modal = document.getElementById('swap-modal');
    if(modal) modal.remove();
    
    window.hasUnsavedChanges = true; 
  }

  async save() {
    const dateStr = this.dateStr;

    this.syncEventInputs();
    // 💡 [핵심 버그 수정] 내용이 비어 있어도 라벨(태그)이 하나라도 체크되어 있다면 날아가지 않고 저장되도록 수정
    const validEvents = this.currentEvents.filter(e => e.content.trim() !== '' || (e.labels && e.labels.length > 0));
    
    const eventTextForLegacy = validEvents.map(e => {
       const labels = e.labels && e.labels.length > 0 ? e.labels.map(l => `[${l}]`).join(' ') : '';
       return `${labels} ${e.content}`;
    }).join('\n');
    
    await window.getUserCol('events').doc(dateStr).set({
        eventList: validEvents,
        eventText: eventTextForLegacy,
        updatedAt: Date.now()
    });

    let isSkipDay = false;
    for (const e of validEvents) {
        if (e.labels && e.labels.some(l => window.isSkipLabel(l))) {
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
    // 💡 [핵심 버그 수정] 기록 역시 라벨만 지정해두면 저장되도록 수정
    const validJournals = this.currentJournals.filter(j => j.content.trim() !== '' || (j.labels && j.labels.length > 0));
    await window.getUserCol('journals').doc(dateStr).set({ entries: validJournals, updatedAt: Date.now() });
  }
}

window.dayViewInstance = new DayView(document.getElementById("main-view"));
window.renderDayViewer = (container) => { window.dayViewInstance.container = container; window.dayViewInstance.renderViewer(); };
window.renderDayEditor = (container) => { window.dayViewInstance.container = container; window.dayViewInstance.renderEditor(); };
window.saveDayDataFromEditor = () => window.dayViewInstance.save();
