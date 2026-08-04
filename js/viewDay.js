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
                  selectedLabelsArray = selectedLabelsArray.filter(l => l !== labelText);
                  onChangeCallback(selectedLabelsArray);
                  this.renderLabelChips(containerElement, allLabelsObj, selectedLabelsArray, onChangeCallback);
              } else {
                  // 🚀 '기간' 속성 라벨 클릭 시 기간 등록 모달 실행
                  if (typeof window.isPeriodLabel === 'function' && window.isPeriodLabel(labelText)) {
                      const block = containerElement.closest('.event-entry-block');
                      const ta = block ? block.querySelector('.event-content-input') : null;
                      const textVal = ta ? ta.value : '';
                      window.openPeriodModal(this.dateStr, labelText, textVal, (isSaved) => {
                          if (isSaved) window.render();
                      });
                      return;
                  }
                  
                  selectedLabelsArray.push(labelText);
                  onChangeCallback(selectedLabelsArray);
                  this.renderLabelChips(containerElement, allLabelsObj, selectedLabelsArray, onChangeCallback);
              }
          });

          containerElement.appendChild(chip);
      });
  }

  async renderViewer() {
    this.showLoading('클라우드에서 일간 데이터를 불러오는 중...');
    const dayData = await window.dbAPI.loadDayData(this.dateStr);
    const eventSnap = await window.getUserCol('events').doc(this.dateStr).get();
    const eventData = eventSnap.exists ? eventSnap.data() : {};
    const events = this.parseEvents(eventData);

    const journalSnap = await window.getUserCol('journals').doc(this.dateStr).get();
    const journals = (journalSnap.exists && journalSnap.data().entries) ? journalSnap.data().entries : [];

    let html = `<div class="day-view-board" style="max-width:800px; margin:0 auto; padding:15px;">`;

    // 일간 일정 뷰어
    html += `<div style="background:#fff; border-radius:12px; padding:20px; box-shadow:0 2px 8px rgba(0,0,0,0.05); margin-bottom:20px;">
        <h3 style="margin-top:0; color:#1e293b; border-bottom:2px solid #e2e8f0; padding-bottom:10px;">📌 오늘의 일정</h3>`;
    
    if (events.length === 0) {
        html += `<p style="color:#94a3b8; text-align:center; padding:10px 0;">등록된 일정이 없습니다.</p>`;
    } else {
        html += `<ul style="list-style:none; padding:0; margin:0;">`;
        events.forEach(e => {
            const labels = e.labels || (e.label ? [e.label] : []);
            let labelBadges = '';
            labels.forEach(l => {
                labelBadges += `<span class="badge" style="background:#dbeafe; color:#1e40af; font-size:0.8rem; padding:2px 8px; border-radius:4px; margin-right:6px;">${l}</span>`;
            });
            const isCompleted = !!e.completed;
            const textStyle = isCompleted ? 'text-decoration:line-through; color:#94a3b8;' : 'color:#1e293b;';
            html += `<li style="padding:10px; border-bottom:1px solid #f1f5f9; display:flex; align-items:center; gap:8px;">
                ${isCompleted ? '✅' : '▪️'} ${labelBadges}<span style="${textStyle} font-size:1rem;">${e.content || ''}</span>
            </li>`;
        });
        html += `</ul>`;
    }
    html += `</div>`;

    // 시간표 및 수업 메모 뷰어
    html += `<div style="background:#fff; border-radius:12px; padding:20px; box-shadow:0 2px 8px rgba(0,0,0,0.05); margin-bottom:20px;">
        <h3 style="margin-top:0; color:#1e293b; border-bottom:2px solid #e2e8f0; padding-bottom:10px;">📚 수업 및 활동 메모</h3>
        <table style="width:100%; border-collapse:collapse;">
            <thead>
                <tr style="background:#f8fafc; border-bottom:2px solid #cbd5e1;">
                    <th style="padding:10px; width:80px; text-align:center;">교시</th>
                    <th style="padding:10px; width:120px; text-align:center;">과목</th>
                    <th style="padding:10px; text-align:left;">수업 메모</th>
                    <th style="padding:10px; width:120px; text-align:left;">준비물</th>
                </tr>
            </thead>
            <tbody>`;

    const maxP = window.periodNames ? window.periodNames.length : 6;
    for (let p = 1; p <= maxP; p++) {
        const pName = (window.periodNames && window.periodNames[p - 1]) ? window.periodNames[p - 1] : `${p}교시`;
        const pData = (dayData.periods && dayData.periods[p]) ? dayData.periods[p] : { subject: '', memo: '', supplies: '' };
        html += `<tr style="border-bottom:1px solid #e2e8f0;">
            <td style="padding:10px; text-align:center; font-weight:bold; color:#475569; background:#f8fafc;">${pName}</td>
            <td style="padding:10px; text-align:center; font-weight:bold; color:#2563eb;">${pData.subject || '-'}</td>
            <td style="padding:10px; color:#334155;">${pData.memo || ''}</td>
            <td style="padding:10px; color:#e11d48; font-size:0.9rem;">${pData.supplies || ''}</td>
        </tr>`;
    }
    html += `</tbody></table></div>`;

    // 학급 일지 뷰어
    html += `<div style="background:#fff; border-radius:12px; padding:20px; box-shadow:0 2px 8px rgba(0,0,0,0.05);">
        <h3 style="margin-top:0; color:#1e293b; border-bottom:2px solid #e2e8f0; padding-bottom:10px;">📝 학급 일지 및 기록</h3>`;
    if (journals.length === 0) {
        html += `<p style="color:#94a3b8; text-align:center; padding:10px 0;">등록된 일지가 없습니다.</p>`;
    } else {
        html += `<ul style="list-style:none; padding:0; margin:0;">`;
        journals.forEach(j => {
            const jLabels = j.labels || (j.label ? [j.label] : []);
            let jBadges = '';
            jLabels.forEach(l => {
                jBadges += `<span class="badge" style="background:#fef3c7; color:#92400e; font-size:0.8rem; padding:2px 8px; border-radius:4px; margin-right:6px;">${l}</span>`;
            });
            html += `<li style="padding:10px; border-bottom:1px solid #f1f5f9; font-size:0.95rem; color:#334155;">
                ${jBadges}${j.content || ''}
            </li>`;
        });
        html += `</ul>`;
    }
    html += `</div></div>`;

    this.container.innerHTML = html;
  }

  async renderEditor() {
    this.showLoading('일간 편집 시트를 불러오는 중입니다...');
    const dayData = await window.dbAPI.loadDayData(this.dateStr);
    const eventSnap = await window.getUserCol('events').doc(this.dateStr).get();
    const eventData = eventSnap.exists ? eventSnap.data() : {};
    this.currentEvents = this.parseEvents(eventData);

    const journalSnap = await window.getUserCol('journals').doc(this.dateStr).get();
    this.currentJournals = (journalSnap.exists && journalSnap.data().entries) ? journalSnap.data().entries : [];

    let html = `
    <div class="day-editor-board" style="max-width:800px; margin:0 auto; padding:15px;">
        <div style="background:#fff; border-radius:12px; padding:20px; box-shadow:0 2px 8px rgba(0,0,0,0.05); margin-bottom:20px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; border-bottom:2px solid #e2e8f0; padding-bottom:10px;">
                <h3 style="margin:0; color:#1e293b;">📌 일정 작성</h3>
                <button id="btn-add-event-entry" style="padding:6px 12px; background:#2563eb; color:#fff; border:none; border-radius:6px; cursor:pointer; font-weight:bold;">+ 일정 추가</button>
            </div>
            <div id="event-entries-container"></div>
        </div>

        <div style="background:#fff; border-radius:12px; padding:20px; box-shadow:0 2px 8px rgba(0,0,0,0.05); margin-bottom:20px;">
            <h3 style="margin-top:0; color:#1e293b; border-bottom:2px solid #e2e8f0; padding-bottom:10px;">📚 수업 및 활동 작성</h3>
            <table style="width:100%; border-collapse:collapse;">
                <thead>
                    <tr style="background:#f8fafc; border-bottom:2px solid #cbd5e1;">
                        <th style="padding:10px; width:80px; text-align:center;">교시</th>
                        <th style="padding:10px; width:130px; text-align:center;">과목</th>
                        <th style="padding:10px; text-align:left;">수업 메모</th>
                        <th style="padding:10px; width:130px; text-align:left;">준비물</th>
                    </tr>
                </thead>
                <tbody>`;

    const maxP = window.periodNames ? window.periodNames.length : 6;
    for (let p = 1; p <= maxP; p++) {
        const pName = (window.periodNames && window.periodNames[p - 1]) ? window.periodNames[p - 1] : `${p}교시`;
        const pData = (dayData.periods && dayData.periods[p]) ? dayData.periods[p] : { subject: '', memo: '', supplies: '' };
        html += `<tr data-period="${p}" style="border-bottom:1px solid #e2e8f0;">
            <td style="padding:10px; text-align:center; font-weight:bold; color:#475569; background:#f8fafc;">${pName}</td>
            <td style="padding:6px;"><input type="text" class="cell-subject" value="${pData.subject || ''}" style="width:100%; padding:6px; border:1px solid #cbd5e1; border-radius:4px; box-sizing:border-box;"></td>
            <td style="padding:6px;"><input type="text" class="cell-memo" value="${pData.memo || ''}" style="width:100%; padding:6px; border:1px solid #cbd5e1; border-radius:4px; box-sizing:border-box;"></td>
            <td style="padding:6px;"><input type="text" class="cell-supplies" value="${pData.supplies || ''}" style="width:100%; padding:6px; border:1px solid #cbd5e1; border-radius:4px; box-sizing:border-box;"></td>
        </tr>`;
    }

    html += `</tbody></table></div>

        <div style="background:#fff; border-radius:12px; padding:20px; box-shadow:0 2px 8px rgba(0,0,0,0.05);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; border-bottom:2px solid #e2e8f0; padding-bottom:10px;">
                <h3 style="margin:0; color:#1e293b;">📝 학급 일지 작성</h3>
                <button id="btn-add-journal-entry" style="padding:6px 12px; background:#059669; color:#fff; border:none; border-radius:6px; cursor:pointer; font-weight:bold;">+ 일지 추가</button>
            </div>
            <div id="journal-entries-container"></div>
        </div>
    </div>`;

    this.container.innerHTML = html;

    this.renderEventEntries();
    this.renderJournalEntries();

    document.getElementById('btn-add-event-entry').onclick = () => {
        this.syncEventInputs();
        this.currentEvents.push({ content: '', labels: [] });
        this.renderEventEntries();
    };

    document.getElementById('btn-add-journal-entry').onclick = () => {
        this.syncJournalInputs();
        this.currentJournals.push({ content: '', labels: [] });
        this.renderJournalEntries();
    };
  }

  syncEventInputs() {
      const container = document.getElementById('event-entries-container');
      if (!container) return;
      const blocks = container.querySelectorAll('.event-entry-block');
      blocks.forEach((block, idx) => {
          if (this.currentEvents[idx]) {
              const ta = block.querySelector('.event-content-input');
              if (ta) this.currentEvents[idx].content = ta.value;
              const chk = block.querySelector('.event-complete-check');
              if (chk) this.currentEvents[idx].completed = chk.checked;
          }
      });
  }

  syncJournalInputs() {
      const container = document.getElementById('journal-entries-container');
      if (!container) return;
      const blocks = container.querySelectorAll('.journal-entry-block');
      blocks.forEach((block, idx) => {
          if (this.currentJournals[idx]) {
              const ta = block.querySelector('.journal-content-input');
              if (ta) this.currentJournals[idx].content = ta.value;
          }
      });
  }

  renderEventEntries() {
    const container = document.getElementById('event-entries-container');
    if (!container) return;
    const labelObjs = window.getEventLabels();
    
    container.innerHTML = '';
    
    this.currentEvents.forEach((e, index) => {
        const block = document.createElement('div');
        block.className = "event-entry-block";
        block.style.cssText = "border:1px solid #cbd5e1; border-radius:8px; padding:10px; margin-bottom:12px; background:#f8fafc;";
        
        const topRow = document.createElement('div');
        topRow.style.cssText = "display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; width:100%;";
        
        const leftGroup = document.createElement('div');
        leftGroup.style.cssText = "display:flex; align-items:center; gap:8px;";

        const chipContainer = document.createElement('div');
        chipContainer.className = "label-chip-container";
        chipContainer.style.margin = "0";
        this.renderLabelChips(chipContainer, labelObjs, e.labels || [], (newLabels) => {
            this.currentEvents[index].labels = newLabels;
        });

        leftGroup.appendChild(chipContainer);

        const actions = document.createElement('div');
        actions.style.display = "flex";
        actions.style.gap = "8px";
        actions.innerHTML = `<button class="delete-btn" style="background:#fff; border:1px solid #cbd5e1; color:#ef4444; cursor:pointer; padding:4px 8px; border-radius:6px;" title="삭제">✖</button>`;

        topRow.appendChild(leftGroup);
        topRow.appendChild(actions);

        const isCompleted = !!e.completed;
        const canComplete = e.labels && e.labels.some(l => typeof window.isForwardLabel === 'function' && window.isForwardLabel(l));
        const inputStyle = (isCompleted && canComplete) ? 'text-decoration:line-through; color:#94a3b8; background:#e2e8f0;' : 'background:#fff; color:#1e293b;';

        // 🚀 일정 작성 칸 바로 왼쪽에 완료 체크박스 배치
        const bottomRow = document.createElement('div');
        bottomRow.style.cssText = "display:flex; align-items:center; gap:8px; width:100%;";

        if (canComplete) {
            const chk = document.createElement('input');
            chk.type = "checkbox";
            chk.className = "event-complete-check";
            chk.checked = isCompleted;
            chk.style.cssText = "width:18px; height:18px; cursor:pointer; accent-color:#059669; flex-shrink:0;";
            chk.title = "완료 처리";
            chk.addEventListener('change', () => { 
                this.syncEventInputs(); 
                this.renderEventEntries(); 
            });
            bottomRow.appendChild(chk);
        }
        
        const ta = document.createElement('textarea');
        ta.className = "event-content-input";
        ta.placeholder = "일정 내용을 입력하세요.";
        ta.style.cssText = `flex:1; padding:10px; border-radius:6px; border:1px solid #cbd5e1; outline:none; font-size:1.05rem; resize:none; overflow:hidden; min-height:45px; box-sizing:border-box; ${inputStyle}`;
        ta.value = e.content || '';
        
        ta.addEventListener('input', () => { ta.style.height = ''; ta.style.height = ta.scrollHeight + 'px'; });
        ta.addEventListener('change', () => this.syncEventInputs());

        // 🚀 기간 일정 삭제 시 다중 삭제 모달 호출
        actions.querySelector('.delete-btn').addEventListener('click', () => {
            const ev = this.currentEvents[index];
            const labelsToRender = ev.labels || (ev.label ? [ev.label] : []);
            const periodLabel = labelsToRender.find(l => typeof window.isPeriodLabel === 'function' && window.isPeriodLabel(l));

            if (periodLabel) {
                window.showPeriodDeleteModal(this.dateStr, periodLabel, ev.content, ev.groupId, () => {
                    window.render();
                });
            } else {
                this.removeEventEntry(index);
            }
        });

        bottomRow.appendChild(ta);

        block.appendChild(topRow);
        block.appendChild(bottomRow);
        container.appendChild(block);
        
        setTimeout(() => { ta.style.height = ta.scrollHeight + 'px'; }, 0);
    });
  }

  removeEventEntry(idx) {
      this.syncEventInputs();
      this.currentEvents.splice(idx, 1);
      this.renderEventEntries();
  }

  renderJournalEntries() {
      const container = document.getElementById('journal-entries-container');
      if (!container) return;
      const labelObjs = window.getJournalLabels ? window.getJournalLabels() : [];

      container.innerHTML = '';
      this.currentJournals.forEach((j, index) => {
          const block = document.createElement('div');
          block.className = "journal-entry-block";
          block.style.cssText = "border:1px solid #cbd5e1; border-radius:8px; padding:10px; margin-bottom:12px; background:#f8fafc;";

          const topRow = document.createElement('div');
          topRow.style.cssText = "display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;";

          const chipContainer = document.createElement('div');
          chipContainer.className = "label-chip-container";
          this.renderLabelChips(chipContainer, labelObjs, j.labels || [], (newLabels) => {
              this.currentJournals[index].labels = newLabels;
          });

          const delBtn = document.createElement('button');
          delBtn.style.cssText = "background:#fff; border:1px solid #cbd5e1; color:#ef4444; cursor:pointer; padding:4px 8px; border-radius:6px;";
          delBtn.innerText = "✖";
          delBtn.onclick = () => {
              this.syncJournalInputs();
              this.currentJournals.splice(index, 1);
              this.renderJournalEntries();
          };

          topRow.appendChild(chipContainer);
          topRow.appendChild(delBtn);

          const ta = document.createElement('textarea');
          ta.className = "journal-content-input";
          ta.placeholder = "일지 내용을 입력하세요.";
          ta.style.cssText = "width:100%; padding:10px; border-radius:6px; border:1px solid #cbd5e1; outline:none; font-size:1rem; resize:none; min-height:50px; box-sizing:border-box;";
          ta.value = j.content || '';
          ta.addEventListener('input', () => { ta.style.height = ''; ta.style.height = ta.scrollHeight + 'px'; });
          ta.addEventListener('change', () => this.syncJournalInputs());

          block.appendChild(topRow);
          block.appendChild(ta);
          container.appendChild(block);

          setTimeout(() => { ta.style.height = ta.scrollHeight + 'px'; }, 0);
      });
  }

  async save() {
    this.syncEventInputs();
    this.syncJournalInputs();

    const validEvents = this.currentEvents.filter(e => (e.content && e.content.trim() !== '') || (e.labels && e.labels.length > 0));
    await window.getUserCol('events').doc(this.dateStr).set({
        eventList: validEvents,
        updatedAt: Date.now()
    });

    const periodsData = {};
    const rows = document.querySelectorAll("tr[data-period]");
    rows.forEach(row => {
      const p = row.getAttribute("data-period");
      const subject = (row.querySelector(".cell-subject").value || '').trim();
      const memo = (row.querySelector(".cell-memo").value || '').trim();
      const supplies = (row.querySelector(".cell-supplies").value || '').trim();
      periodsData[p] = { subject, memo, supplies };
    });

    await window.dbAPI.saveSchedule(this.dateStr, periodsData);

    const validJournals = this.currentJournals.filter(j => (j.content && j.content.trim() !== '') || (j.labels && j.labels.length > 0));
    await window.getUserCol('journals').doc(this.dateStr).set({ entries: validJournals, updatedAt: Date.now() });
  }
}

window.dayViewInstance = new DayView(document.getElementById("main-view"));
window.renderDayViewer = (container) => { window.dayViewInstance.container = container; window.dayViewInstance.renderViewer(); };
window.renderDayEditor = (container) => { window.dayViewInstance.container = container; window.dayViewInstance.renderEditor(); };
window.saveDayDataFromEditor = () => window.dayViewInstance.save();
