// js/viewDay.js

class DayView extends window.BaseView {
  constructor(container) {
    super(container);
    this.currentEvents = [];
    this.currentJournals = [];
    this.currentSchedules = {};
  }

  parseEvents(docData) {
    if (!docData) return [];
    if (docData.eventList && docData.eventList.length > 0) return docData.eventList;
    return [];
  }

  // 💡 ID 기반으로 칩 렌더링
  renderLabelChips(containerElement, allLabelsObj, selectedLabelIdsArray, onChangeCallback, onSpecialLabelRequest) {
      if (!containerElement) return;
      containerElement.innerHTML = '';
      containerElement.style.margin = "0";

      allLabelsObj.forEach(labelObj => {
          const labelId = labelObj.id;
          const labelText = labelObj.name;
          const isPeriod = labelObj.isPeriod;
          const isRecur = labelObj.isRecur;
          const isForward = labelObj.isForward;

          const chip = document.createElement('div');
          chip.className = 'label-chip';
          chip.innerText = labelText;
          
          if (selectedLabelIdsArray.includes(labelId)) {
              chip.classList.add('active');
          }
          
          chip.addEventListener('click', () => {
              const isActive = selectedLabelIdsArray.includes(labelId);
              
              if (isActive) {
                  selectedLabelIdsArray = selectedLabelIdsArray.filter(id => id !== labelId);
              } else {
                  if (isPeriod || isRecur) {
                      if (onSpecialLabelRequest) {
                          onSpecialLabelRequest(labelText, isPeriod ? 'period' : 'recur', labelId);
                      }
                      return;
                  }
                  
                  if (isForward) {
                      selectedLabelIdsArray = selectedLabelIdsArray.filter(id => {
                          const lObj = allLabelsObj.find(x => x.id === id);
                          return !(lObj && (lObj.isPeriod || lObj.isRecur));
                      });
                  }
                  
                  selectedLabelIdsArray.push(labelId);
              }
              
              if (onChangeCallback) onChangeCallback(selectedLabelIdsArray);
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

    html += `<div class="day-event-card" style="display: flex; align-items: flex-start; padding: 16px; border: 1px solid #cbd5e1; border-left: 5px solid #2563eb; border-radius: 8px; margin-bottom: 16px; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
              <div style="width: 110px; font-weight: 700; font-size: 1.1rem; color: #1e40af; flex-shrink: 0;">📌 오늘 할 일</div>
              <div style="flex-grow: 1; padding-left:12px; border-left: 2px solid #e2e8f0;">`;
              
    if (events.length > 0) {
      let processedEvents = events.map(e => ({ ...e, labelIds: e.labelIds || [] }));
      // 💡 유틸리티 함수도 ID 배열을 받아서 처리하도록 호환 (앱 단에서 보완 예정)
      html += window.generateEventBadgesHTML(processedEvents, dateStr);
    } else {
      html += `<div style="color:#94a3b8; font-size:1.05rem;">등록된 일정이 없습니다.</div>`;
    }
    html += `</div></div>`;
        
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

    if (journals.length > 0) {
      html += `<div class="day-journal-section" style="margin-top:20px;">
                <h3 style="font-size:1.2rem; color:#be185d; margin-bottom:10px;">📔 오늘 기록</h3>`;
      
      const masterJournalLabels = window.getJournalLabels();
      journals.forEach(j => {
        let labelIds = j.labelIds || []; 

        const firstLabel = labelIds.length > 0 ? masterJournalLabels.find(l => l.id === labelIds[0]) : null;
        const mainStyle = firstLabel ? window.getLabelStyle(firstLabel.id, 'journal') : { bg: '#fdf2f8', text: '#9d174d', border: '#fbcfe8' };
        
        const labelsHtml = labelIds.map(id => {
             const lbl = masterJournalLabels.find(l => l.id === id);
             if(!lbl) return '';
             const s = window.getLabelStyle(id, 'journal');
             return `<span style="display:inline-block; font-weight:bold; color:${s.text}; background:${s.bg}; padding:2px 8px; border-radius:12px; margin-right:6px; font-size:0.9rem; border:1px solid ${s.border};">${lbl.name}</span>`;
        }).join('');

        html += `
          <div style="background:#fff; border:1px solid ${mainStyle.border}; border-left:5px solid ${mainStyle.text}; border-radius:8px; padding:12px; margin-bottom:10px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
              ${labelsHtml ? `<div style="margin-bottom:8px;">${labelsHtml}</div>` : ''}
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
    this.currentSchedules = periods;
    
    const eventDoc = await window.getUserCol('events').doc(dateStr).get();
    const events = eventDoc.exists ? this.parseEvents(eventDoc.data()) : [];
    
    this.currentEvents = events.map(e => ({ ...e, labelIds: e.labelIds || [] }));
    if (this.currentEvents.length === 0) this.currentEvents.push({ labelIds: [], content: '', completed: false });
    
    const journalDoc = await window.getUserCol('journals').doc(dateStr).get();
    const journals = journalDoc.exists ? journalDoc.data().entries || [] : [];
    
    this.currentJournals = journals.map(j => ({ ...j, labelIds: j.labelIds || [] }));
    if (this.currentJournals.length === 0) this.currentJournals.push({ labelIds: [], content: '' });

    let html = `<div class="day-viewer-container">`;

    html += `
      <div class="day-event-editor-section" style="background: #fff; padding: 15px; border-radius: 8px; border: 1px solid #cbd5e1; box-shadow: 0 1px 3px rgba(0,0,0,0.05); border-left: 5px solid #2563eb;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 15px; width: 100%; box-sizing: border-box;">
          <h3 style="font-size:1.2rem; color:#1e40af; margin:0; font-weight:bold;">📌 오늘 할 일</h3>
          <button onclick="window.openEventLabelModal()" style="background:#f8fafc; border:1px solid #cbd5e1; padding:4px 10px; border-radius:6px; cursor:pointer; font-size:0.85rem; font-weight:bold;">⚙️ 설정</button>
        </div>
        <div id="event-entries-container" style="width: 100%;"></div>
        <button onclick="window.dayViewInstance.addEventEntry()" style="width:100%; padding:10px; margin-top:5px; background:#eff6ff; color:#2563eb; border:2px dashed #bfdbfe; border-radius:8px; cursor:pointer; font-weight:bold; font-size:1rem; transition:0.2s;">+ 일정 추가</button>
      </div>
    `;

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
                <td class="editable-cell cell-subject" contenteditable="true" oninput="window.dayViewInstance.syncScheduleInputs()">${pObj.subject || ''}</td>
                <td class="editable-cell cell-memo" contenteditable="true" style="text-align: left;" oninput="window.dayViewInstance.syncScheduleInputs()">${pObj.memo || ''}</td>
                <td class="editable-cell cell-supplies" contenteditable="true" style="color: #d97706; font-weight: 600; text-align: left;" oninput="window.dayViewInstance.syncScheduleInputs()">${pObj.supplies || ''}</td>
              </tr>
      `;
    }
    html += `</tbody></table></div>`;

    html += `
      <div class="day-journal-editor-section" style="margin-top: 15px; background: #fff; padding: 15px; border-radius: 8px; border: 1px solid #cbd5e1; box-shadow: 0 1px 3px rgba(0,0,0,0.05); border-left: 5px solid #be185d;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 15px; width: 100%; box-sizing: border-box;">
          <h3 style="font-size:1.2rem; color:#be185d; margin:0; font-weight:bold;">📔 오늘 기록</h3>
          <button onclick="window.openJournalLabelModal()" style="background:#fdf2f8; border:1px solid #fbcfe8; padding:4px 10px; border-radius:6px; cursor:pointer; font-size:0.85rem; font-weight:bold; color:#be185d;">⚙️ 설정</button>
        </div>
        <div id="journal-entries-container" style="width: 100%;"></div>
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
    const realTodayStr = window.formatDate(new Date());
    
    container.innerHTML = '';
    
    this.currentEvents.forEach((e, index) => {
        const block = document.createElement('div');
        block.className = "event-entry-block";
        block.style.cssText = "border:1px solid #cbd5e1; border-radius:8px; padding:10px; margin-bottom:12px; background:#f8fafc;";
        
        const topRow = document.createElement('div');
        topRow.style.cssText = "display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px; width:100%;";
        
        const chipContainer = document.createElement('div');
        chipContainer.className = "label-chip-container";
        chipContainer.style.margin = "0";

        const isCompleted = !!e.completed;
        const canComplete = e.labelIds && e.labelIds.some(id => {
            const match = labelObjs.find(l => l.id === id);
            return match && match.isForward;
        });
        
        let warningIcon = '';
        if (canComplete) {
            if (!isCompleted && this.dateStr < realTodayStr) {
                warningIcon = `<span style="color:#ef4444; font-weight:bold; font-size:0.8rem; margin-left:8px; align-self:center;">➡️ (미완료)</span>`;
            } else if (e.originalDate && e.originalDate < this.dateStr) {
                warningIcon = `<span style="color:#2563eb; font-weight:bold; font-size:0.8rem; margin-left:8px; align-self:center;">↪️ (이월됨)</span>`;
            }
        }

        this.renderLabelChips(chipContainer, labelObjs, e.labelIds, 
            (newLabelIds) => {
                this.currentEvents[index].labelIds = newLabelIds;
            },
            async (labelText, popupType, labelId) => {
                const content = this.currentEvents[index].content;
                const backupEvent = { ...this.currentEvents[index] };
                this.syncEventInputs();
                this.syncScheduleInputs(); 
                this.currentEvents.splice(index, 1);
                await window.saveCurrentViewData(true); 
                
                const callback = function(isSaved) {
                    if(!isSaved) {
                        window.dayViewInstance.currentEvents.push(backupEvent);
                        window.saveCurrentViewData(true).then(() => window.render());
                    } else {
                        window.render();
                    }
                };

                if (popupType === 'period') {
                    window.openPeriodModal(window.dayViewInstance.dateStr, labelText, content, callback, labelId);
                } else if (popupType === 'recur') {
                    window.openRecurringModal(window.dayViewInstance.dateStr, labelText, content, callback, labelId);
                }
            }
        );

        if (warningIcon) chipContainer.innerHTML += warningIcon;

        const actions = document.createElement('div');
        actions.style.display = "flex";
        actions.style.gap = "8px";
        actions.innerHTML = `<button class="delete-btn" style="background:#fff; border:1px solid #cbd5e1; color:#ef4444; cursor:pointer; padding:4px 8px; border-radius:6px;">✖</button>`;

        topRow.appendChild(chipContainer);
        topRow.appendChild(actions);

        const contentRow = document.createElement('div');
        contentRow.style.cssText = "display:flex; align-items:flex-start; gap:8px; width:100%;";

        const inputStyle = (isCompleted && canComplete) ? 'text-decoration:line-through; color:#94a3b8; background:#e2e8f0;' : 'background:#fff; color:#1e293b;';

        if (canComplete) {
            const chkWrapper = document.createElement('div');
            chkWrapper.style.paddingTop = "10px";
            chkWrapper.innerHTML = `<input type="checkbox" class="event-complete-check" ${isCompleted ? 'checked' : ''} style="width:18px; height:18px; cursor:pointer; accent-color:#059669;" title="완료 처리">`;
            contentRow.appendChild(chkWrapper);
            
            chkWrapper.querySelector('.event-complete-check').addEventListener('change', () => { this.syncEventInputs(); this.renderEventEntries(); });
        }

        actions.querySelector('.delete-btn').addEventListener('click', () => {
            const ev = this.currentEvents[index];
            const isGrouped = !!ev.groupId;
            const forwardLabelId = (ev.labelIds || []).find(id => {
                const match = labelObjs.find(l => l.id === id);
                return match && match.isForward;
            });
            const forwardLabelName = forwardLabelId ? labelObjs.find(l=>l.id===forwardLabelId).name : '';

            if (isGrouped) {
                window.showGroupDeleteModal(this.dateStr, ev.labelIds[0]||'', ev.content, ev.groupId, 
                    () => { window.render(); }, 
                    () => { this.removeEventEntry(index); }
                );
            } else if (forwardLabelId && ev.forwardChainId) {
                window.showForwardDeleteModal(this.dateStr, forwardLabelName, ev.content, ev.forwardChainId, 
                    () => { window.render(); }
                );
            } else {
                this.removeEventEntry(index);
            }
        });
        
        const ta = document.createElement('textarea');
        ta.className = "event-content-input";
        ta.placeholder = "일정 내용을 입력하세요.";
        ta.style.cssText = `flex:1; padding:10px; border-radius:6px; border:1px solid #cbd5e1; outline:none; font-size:1.05rem; resize:none; overflow:hidden; min-height:45px; box-sizing:border-box; ${inputStyle}`;
        ta.value = (e.content || '').replace(/➡️\s*\(미완료\)/g, '').replace(/➡️\s*\(다음 날로 이월됨\)/g, '').replace(/↪️\s*/g, '').trim();
        
        ta.addEventListener('input', () => { ta.style.height = ''; ta.style.height = ta.scrollHeight + 'px'; });
        ta.addEventListener('change', () => this.syncEventInputs());
        
        contentRow.appendChild(ta);

        block.appendChild(topRow);
        block.appendChild(contentRow);
        container.appendChild(block);
        
        setTimeout(() => { ta.style.height = ta.scrollHeight + 'px'; }, 0);
    });
  }

  syncScheduleInputs() {
      const rows = document.querySelectorAll("tr[data-period]");
      if (rows.length === 0) return;
      
      rows.forEach(row => {
          const p = row.getAttribute("data-period");
          const subject = (row.querySelector(".cell-subject").innerText || '').trim();
          const memo = (row.querySelector(".cell-memo").innerText || '').trim();
          const supplies = (row.querySelector(".cell-supplies").innerText || '').trim();
          this.currentSchedules[p] = { subject, memo, supplies };
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
    this.currentEvents.push({ labelIds: [], content: '', completed: false });
    this.renderEventEntries();
  }

  removeEventEntry(index) {
    this.syncEventInputs();
    this.currentEvents.splice(index, 1);
    window.hasUnsavedChanges = true; 
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
        topRow.style.cssText = "display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; width:100%;";
        
        const chipContainer = document.createElement('div');
        chipContainer.className = "label-chip-container";
        chipContainer.style.margin = "0";
        
        this.renderLabelChips(chipContainer, labelObjs, j.labelIds, (newLabelIds) => {
            this.currentJournals[index].labelIds = newLabelIds;
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
    this.currentJournals.push({ labelIds: [], content: '' });
    this.renderJournalEntries();
  }

  removeJournalEntry(index) {
    this.syncJournalInputs();
    this.currentJournals.splice(index, 1);
    window.hasUnsavedChanges = true;
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

    this.syncScheduleInputs();
    const sourceData = this.currentSchedules[sourcePeriod];

    if (sourceDate === targetDate) {
        if (sourcePeriod === targetPeriod) {
            document.getElementById('swap-modal').remove();
            return;
        }
        const targetData = this.currentSchedules[targetPeriod];
        this.currentSchedules[targetPeriod] = sourceData;
        this.currentSchedules[sourcePeriod] = targetData;

        for(let p=1; p<=this.maxPeriod; p++) {
            const row = document.querySelector(`tr[data-period="${p}"]`);
            if(row) {
                row.querySelector(".cell-subject").innerText = this.currentSchedules[p].subject;
                row.querySelector(".cell-memo").innerText = this.currentSchedules[p].memo;
                row.querySelector(".cell-supplies").innerText = this.currentSchedules[p].supplies;
            }
        }
    } else {
        document.getElementById('swap-modal').innerHTML = `<div style="background:#fff; padding:30px; border-radius:12px; font-weight:bold; color:#2563eb; text-align:center;">⏳ 클라우드 통신 중...</div>`;

        const targetDoc = await window.getUserCol('schedules').doc(targetDate).get();
        const targetPeriodsDB = targetDoc.exists ? (targetDoc.data().periods || {}) : {};
        const targetData = targetPeriodsDB[targetPeriod] || {subject:'', memo:'', supplies:''};

        targetPeriodsDB[targetPeriod] = sourceData;
        await window.getUserCol('schedules').doc(targetDate).set({ periods: targetPeriodsDB, updatedAt: Date.now() });

        this.currentSchedules[sourcePeriod] = targetData;

        const sourceRow = document.querySelector(`tr[data-period="${sourcePeriod}"]`);
        if(sourceRow) {
            sourceRow.querySelector(".cell-subject").innerText = targetData.subject;
            sourceRow.querySelector(".cell-memo").innerText = targetData.memo;
            sourceRow.querySelector(".cell-supplies").innerText = targetData.supplies;
        }
        
        alert(`✅ 변경되었습니다! \n반드시 상단의 [💾 저장] 버튼을 누르세요.`);
    }
    
    const modal = document.getElementById('swap-modal');
    if(modal) modal.remove();
    
    window.hasUnsavedChanges = true; 
  }

  save() {
    const targetDateStr = this.dateStr;
    this.syncEventInputs();
    this.syncScheduleInputs();
    this.syncJournalInputs();

    const validEvents = this.currentEvents
        .filter(e => (e.content || '').trim() !== '' || (e.labelIds && e.labelIds.length > 0))
        .map(e => ({...e}));
    const periodsData = JSON.parse(JSON.stringify(this.currentSchedules || {}));
    const validJournals = this.currentJournals
        .filter(j => (j.content || '').trim() !== '' || (j.labelIds && j.labelIds.length > 0))
        .map(j => ({...j}));

    return (async () => {
        // ID 환경에서 텍스트 변환은 보완용 래퍼 사용
        const eventTextForLegacy = window.formatEventListToText ? window.formatEventListToText(validEvents) : '';
        await window.getUserCol('events').doc(targetDateStr).set({
            eventList: validEvents,
            eventText: eventTextForLegacy,
            updatedAt: Date.now()
        });

        let isSkipDay = false;
        const masterLabels = window.getEventLabels();
        for (const e of validEvents) {
            if (e.labelIds && e.labelIds.some(id => {
                const match = masterLabels.find(l => l.id === id);
                return match && match.isSkip;
            })) {
                isSkipDay = true; break;
            }
        }

        if (isSkipDay) {
            for (const p in periodsData) { periodsData[p].subject = ''; }
        }

        await window.dbAPI.saveSchedule(targetDateStr, periodsData);
        await window.getUserCol('journals').doc(targetDateStr).set({ entries: validJournals, updatedAt: Date.now() });
    })();
  }
}

window.dayViewInstance = new DayView(document.getElementById("main-view"));
window.renderDayViewer = (container) => { window.dayViewInstance.container = container; window.dayViewInstance.renderViewer(); };
window.renderDayEditor = (container) => { window.dayViewInstance.container = container; window.dayViewInstance.renderEditor(); };
window.saveDayDataFromEditor = () => window.dayViewInstance.save();
