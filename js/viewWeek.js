// js/viewWeek.js

class WeekView extends window.BaseView {
  constructor(container) {
    super(container); 
  }

  getWeekDates() {
    const dates = [];
    const tempDate = new Date(this.currentDate);
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
        day: dayNames[i], dayOfWeekNum: i,
        dateStr: window.formatDate(tempDate),
        dateDisplay: `${tempDate.getDate()}일`
      });
      tempDate.setDate(tempDate.getDate() + 1); 
    }
    return dates;
  }

  async renderViewer() {
    this.showLoading('클라우드에서 주간 데이터를 불러오는 중...'); 

    let html = `<div class="clean-viewer-board"><table><tbody>`;
    const realTodayStr = window.formatDate(new Date());

    for (const d of this.getWeekDates()) {
      const dayData = await window.dbAPI.loadDayData(d.dateStr);
      const eventDoc = await window.getUserCol('events').doc(d.dateStr).get();
      let eventHtml = '<span style="color:#94a3b8;">-</span>';
      let processedEvents = [];
      
      if (eventDoc.exists) {
        const eData = eventDoc.data();
        const finalEvents = eData.eventList || [];
        
        if (finalEvents.length > 0) {
            processedEvents = finalEvents.map(e => ({ ...e, labelIds: e.labelIds || [] }));
            eventHtml = window.generateEventBadgesHTML(processedEvents, d.dateStr); 
        }
      }

      const periods = dayData.periods || {};
      const isToday = (d.dateStr === realTodayStr);
      const todayClass = isToday ? 'week-today-cell' : '';

      let dateColor = '#1e40af';
      let dateNumColor = '#475569'; 
      if (window.isRedDay(d.dateStr, processedEvents)) {
          dateColor = '#ef4444'; 
          dateNumColor = '#ef4444'; 
      } else if (d.dayOfWeekNum === 6) {
          dateColor = '#3b82f6'; 
          dateNumColor = '#3b82f6'; 
      }

      const holidayName = window.getHolidayName(d.dateStr);
      const holidayHtml = holidayName ? `<span style="font-size:0.75rem; color:#ef4444; font-weight:bold; margin-top:2px;">${holidayName}</span>` : '';

      html += `
        <tr>
          <td rowspan="${window.showClass ? 3 : 1}" class="${todayClass}" style="width: 70px; vertical-align: middle; text-align: center; padding: 8px 4px;">
            <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
              <span onclick="window.goToDay('${d.dateStr}')" style="font-size:1.8rem; font-weight:900; color:${dateColor}; line-height:1; cursor: pointer;" title="${d.dateStr} 일 보기로 이동">${d.day}</span>
              <span style="font-size:0.95rem; font-weight:600; color:${dateNumColor}; line-height:1;">${d.dateDisplay}</span>
              ${holidayHtml}
            </div>
          </td>
          <td style="width: 50px; font-weight: bold; background: #eff6ff; color: #1e40af; vertical-align: middle; text-align: center;">일정</td>
          <td colspan="${this.maxPeriod}" style="text-align: left; padding: 8px 10px; background: #f8fafc;">
              ${eventHtml}
          </td>
        </tr>
        <tr style="${window.showClass ? '' : 'display:none;'}">
          <td rowspan="2" style="font-weight: bold; background: #f1f5f9; color: #475569; vertical-align: middle; text-align: center;">수업</td>
          ${(window.periodNames || ["1","2","3","4","5","6"]).map(name => `<td style="font-weight: bold; background: #f8fafc; color: #334155; width: ${100 / this.maxPeriod}%; text-align: center;">${name}</td>`).join('')}
        </tr>
        <tr style="${window.showClass ? '' : 'display:none;'}">
          ${Array.from({ length: this.maxPeriod }).map((_, i) => {
            const p = i + 1;
            const pObj = periods[p] || {};
            let content = '';
            
            if (pObj.subject && pObj.subject.toUpperCase() !== 'X') {
                content += `<div style="margin-bottom: 6px;"><span class="badge-tag">${pObj.subject}</span></div>`;
            }
            if (pObj.memo) {
                content += `<div class="clean-cell-memo" style="font-size:0.95rem; color:#334155;">${pObj.memo}</div>`;
            }
            if (pObj.supplies) {
                // 💡 [수정] 핀 아이콘 및 '비고:' 글자 제거, 디자인 유지
                content += `<div style="margin-top:6px; font-size:0.85rem; color:#b91c1c; font-weight:bold; background:#fef2f2; padding:4px; border-radius:4px;">${pObj.supplies}</div>`;
            }
            
            return `<td style="vertical-align: top; text-align: left; padding: 8px; height: var(--week-cell-height);">${content}</td>`;
          }).join('')}
        </tr>
      `;
    }
    html += `</tbody></table></div>`;
    this.container.innerHTML = html;
  }

  async renderEditor() {
    this.showLoading('편집 화면을 준비 중...');

    let html = `<div class="table-container"><table><tbody>`;
    const realTodayStr = window.formatDate(new Date());
    const masterLabels = window.getEventLabels(); 

    for (const d of this.getWeekDates()) {
      const dayData = await window.dbAPI.loadDayData(d.dateStr);
      
      const eventDoc = await window.getUserCol('events').doc(d.dateStr).get();
      let eventList = [];
      if (eventDoc.exists) {
        const eData = eventDoc.data();
        eventList = eData.eventList || [];
      }
      
      window[`tempEvents_${d.dateStr}`] = eventList.map(e => {
          let labelIds = e.labelIds || [];
          if (labelIds.length === 0 && (e.labels || e.label)) {
              let legacyNames = e.labels || [e.label];
              legacyNames.forEach(name => {
                  const match = masterLabels.find(l => l.name === name);
                  if (match && match.id && !labelIds.includes(match.id)) labelIds.push(match.id);
              });
          }
          return { ...e, labelIds: labelIds };
      });
      
      window[`tempSchedules_${d.dateStr}`] = dayData.periods || {};
      
      let compactEditorHtml = `<div id="compact-events-${d.dateStr}" style="display:flex; flex-direction:column; gap:4px;">`;
      compactEditorHtml += this.generateCompactEventEditor(d.dateStr);
      compactEditorHtml += `</div>`; 

      const periods = window[`tempSchedules_${d.dateStr}`];
      const isToday = (d.dateStr === realTodayStr);
      const todayClass = isToday ? 'week-today-cell' : '';

      let dateColor = '#1e40af';
      let dateNumColor = '#475569'; 
      if (window.isRedDay(d.dateStr, window[`tempEvents_${d.dateStr}`])) {
          dateColor = '#ef4444';
          dateNumColor = '#ef4444'; 
      } else if (d.dayOfWeekNum === 6) {
          dateColor = '#3b82f6';
          dateNumColor = '#3b82f6'; 
      }

      const holidayName = window.getHolidayName(d.dateStr);
      const holidayHtml = holidayName ? `<span style="font-size:0.75rem; color:#ef4444; font-weight:bold; margin-top:2px;">${holidayName}</span>` : '';

      html += `
        <tr data-week-date="${d.dateStr}">
          <td rowspan="${window.showClass ? 3 : 1}" class="${todayClass}" style="width: 70px; vertical-align: middle; text-align: center; padding: 8px 4px;">
            <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
              <span onclick="window.goToDay('${d.dateStr}')" style="font-size:1.8rem; font-weight:900; color:${dateColor}; line-height:1; cursor: pointer;" title="${d.dateStr} 일 보기로 이동">${d.day}</span>
              <span style="font-size:0.95rem; font-weight:600; color:${dateNumColor}; line-height:1;">${d.dateDisplay}</span>
              ${holidayHtml}
            </div>
          </td>
          <td style="width: 50px; font-weight: bold; background: #eff6ff; color: #1e40af; vertical-align: middle; text-align: center;">
              일정<br>
              <button onclick="window.weekViewInstance.addCompactEvent('${d.dateStr}')" style="margin-top:6px; background:#dbeafe; color:#2563eb; border:1px dashed #93c5fd; border-radius:4px; padding:2px 8px; cursor:pointer; font-weight:bold; font-size:1.1rem; box-shadow:0 1px 2px rgba(0,0,0,0.05);" title="일정 추가">+</button>
          </td>
          <td colspan="${this.maxPeriod}" style="text-align: left; padding: 8px 10px; background: #f8fafc;">
              ${compactEditorHtml}
          </td>
        </tr>
        <tr style="${window.showClass ? '' : 'display:none;'}">
          <td rowspan="2" style="font-weight: bold; background: #f1f5f9; color: #475569; vertical-align: middle; text-align: center;">수업</td>
          ${(window.periodNames || ["1","2","3","4","5","6"]).map(name => `<td style="font-weight: bold; background: #f8fafc; color: #334155; width: ${100 / this.maxPeriod}%; text-align: center;">${name}</td>`).join('')}
        </tr>
        <tr data-week-schedule-date="${d.dateStr}" style="${window.showClass ? '' : 'display:none;'}">
          ${Array.from({ length: this.maxPeriod }).map((_, i) => {
            const p = i + 1;
            const pObj = periods[p] || {};
            
            let cellText = "";
            if (pObj.subject && pObj.subject.toUpperCase() !== 'X') cellText += `[${pObj.subject}] `;
            if (pObj.memo) cellText += pObj.memo + " ";
            if (pObj.supplies) cellText += `[${pObj.supplies}]`;
            
            return `<td class="editable-cell week-period-cell" data-p="${p}" contenteditable="true" style="vertical-align: top; height: var(--week-cell-height); text-align: left; padding: 6px 8px; white-space: pre-wrap;" oninput="window.weekViewInstance.syncScheduleInputs()">${cellText.trim()}</td>`;
          }).join('')}
        </tr>
      `;
    }
    html += `</tbody></table></div>`;
    this.container.innerHTML = html;
  }

  generateCompactEventEditor(dateStr) {
      const list = window[`tempEvents_${dateStr}`] || [];
      const labelObjs = window.getEventLabels();
      const realTodayStr = window.formatDate(new Date());
      let html = '';
      
      list.forEach((e, idx) => {
          const eLabelIds = e.labelIds || [];
          const isCompleted = !!e.completed;
          const canComplete = eLabelIds.some(id => {
              const match = labelObjs.find(l => l.id === id);
              return match && match.isForward;
          });
          
          let warningIcon = '';
          if (canComplete) {
              if (!isCompleted && dateStr < realTodayStr) {
                  warningIcon = `<span style="color:#ef4444; font-weight:bold; font-size:0.8rem; margin-left:8px; align-self:center;">➡️ (미완료)</span>`;
              } else if (e.originalDate && e.originalDate < dateStr) {
                  warningIcon = `<span style="color:#2563eb; font-weight:bold; font-size:0.8rem; margin-left:8px; align-self:center;">↪️ (이월됨)</span>`;
              }
          }

          let chipsHtml = `<div class="label-chip-container" style="margin:0; display:flex; flex-wrap:wrap; gap:4px; margin-bottom:4px;">`;
          labelObjs.forEach(labelObj => {
              const isActive = eLabelIds.includes(labelObj.id);
              const activeClass = isActive ? 'active' : '';
              const clickCode = `window.handleCompactLabelClick('${dateStr}', ${idx}, '${labelObj.id}')`;
              chipsHtml += `<div class="label-chip ${activeClass}" onclick="${clickCode}" style="padding:2px 8px; font-size:0.8rem; min-width:auto; cursor:pointer;">${labelObj.name}</div>`;
          });
          if (warningIcon) chipsHtml += warningIcon;
          chipsHtml += `</div>`;

          const inputStyle = (isCompleted && canComplete) ? 'text-decoration:line-through; color:#94a3b8; background:#e2e8f0;' : 'background:#fff; color:#1e293b;';

          const checkboxHtml = canComplete 
              ? `<input type="checkbox" ${isCompleted ? 'checked' : ''} onchange="window.weekViewInstance ? window.weekViewInstance.updateCompactEvent('${dateStr}', ${idx}, 'completed', this.checked) : window.monthViewInstance.updateCompactEvent('${dateStr}', ${idx}, 'completed', this.checked); document.getElementById('compact-events-${dateStr}').innerHTML = window.weekViewInstance ? window.weekViewInstance.generateCompactEventEditor('${dateStr}') : window.monthViewInstance.generateCompactEventEditor('${dateStr}');" style="width:18px; height:18px; cursor:pointer; accent-color:#059669;" title="완료 체크">`
              : '';

          const pureContent = (e.content || '').replace(/➡️\s*\(미완료\)/g, '').replace(/➡️\s*\(다음 날로 이월됨\)/g, '').replace(/↪️\s*/g, '').trim();

          html += `
          <div class="compact-event-row" data-idx="${idx}" style="border:1px solid #cbd5e1; border-radius:6px; padding:8px; margin-bottom:8px; background:#f8fafc; display:flex; flex-direction:column; gap:6px;">
              <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                  <div style="display:flex; align-items:center; gap:8px;">
                      ${chipsHtml}
                  </div>
                  <button onclick="window.weekViewInstance ? window.weekViewInstance.requestRemoveCompactEvent('${dateStr}', ${idx}) : window.monthViewInstance.requestRemoveCompactEvent('${dateStr}', ${idx})" style="background:none; border:none; color:#ef4444; font-size:1.1rem; cursor:pointer; padding:0; line-height:1;" title="삭제">✖</button>
              </div>
              <div style="display:flex; align-items:flex-start; gap:8px; width:100%;">
                  ${canComplete ? `<div style="padding-top:8px;">${checkboxHtml}</div>` : ''}
                  <textarea placeholder="일정 내용을 입력하세요." style="flex:1; padding:6px 8px; font-size:0.95rem; border:1px solid #cbd5e1; border-radius:4px; outline:none; resize:none; min-height:40px; box-sizing:border-box; ${inputStyle}" onfocus="this.style.height = this.scrollHeight + 'px';" oninput="this.style.height = '40px'; this.style.height = this.scrollHeight + 'px'; window.weekViewInstance ? window.weekViewInstance.updateCompactEvent('${dateStr}', ${idx}, 'content', this.value) : window.monthViewInstance.updateCompactEvent('${dateStr}', ${idx}, 'content', this.value)">${pureContent}</textarea>
              </div>
          </div>`;
      });
      return html;
  }

  syncCompactEventInputs(dateStr) {
      const container = document.getElementById(`compact-events-${dateStr}`);
      if (!container) return;
      const textareas = container.querySelectorAll('textarea');
      textareas.forEach((ta, idx) => {
          if (window[`tempEvents_${dateStr}`] && window[`tempEvents_${dateStr}`][idx]) {
              window[`tempEvents_${dateStr}`][idx].content = ta.value;
          }
      });
  }

  syncAllCompactEventInputs() {
      const dates = this.getWeekDates();
      dates.forEach(d => this.syncCompactEventInputs(d.dateStr));
  }

  syncScheduleInputs() {
      const scheduleRows = document.querySelectorAll(`tr[data-week-schedule-date]`);
      scheduleRows.forEach(row => {
          const dateStr = row.getAttribute('data-week-schedule-date');
          const periodCells = row.querySelectorAll('.week-period-cell');
          
          if (!window[`tempSchedules_${dateStr}`]) {
              window[`tempSchedules_${dateStr}`] = {};
          }

          periodCells.forEach(cell => {
              const p = cell.getAttribute('data-p');
              let text = (cell.innerText || cell.textContent || '').trim();
              
              let subject = '', memo = '', supplies = '';

              if (text !== '') {
                  const lastMatch = text.match(/\[([^\]]+)\]\s*$/);
                  const allBrackets = text.match(/\[.*?\]/g);
                  if (allBrackets && allBrackets.length >= 2) {
                      supplies = lastMatch ? lastMatch[1].trim() : "";
                      text = text.replace(/\[([^\]]+)\]\s*$/, '').trim(); 
                  }
                  
                  const firstMatch = text.match(/^\[(.*?)\]/);
                  if (firstMatch) {
                      subject = firstMatch[1].trim();
                      memo = text.replace(/^\[(.*?)\]\s*/, '').trim();
                  } else {
                      memo = text;
                  }
              }
              
              let subjText = (subject.toUpperCase() === 'X') ? '' : subject;
              window[`tempSchedules_${dateStr}`][p] = { subject: subjText, memo: memo, supplies: supplies };
          });
      });
  }

  toggleCompactEventLabel(dateStr, idx, labelId) {
      this.syncCompactEventInputs(dateStr);
      window.hasUnsavedChanges = true;
      const ev = window[`tempEvents_${dateStr}`][idx];
      if (!ev) return;
      ev.labelIds = ev.labelIds || [];
      if (ev.labelIds.includes(labelId)) {
          ev.labelIds = ev.labelIds.filter(id => id !== labelId);
      } else {
          ev.labelIds.push(labelId);
      }
      document.getElementById(`compact-events-${dateStr}`).innerHTML = this.generateCompactEventEditor(dateStr);
  }

  updateCompactEvent(dateStr, idx, field, value) {
      window.hasUnsavedChanges = true;
      if (window[`tempEvents_${dateStr}`][idx]) {
          window[`tempEvents_${dateStr}`][idx][field] = value;
      }
  }

  addCompactEvent(dateStr) {
      this.syncCompactEventInputs(dateStr); 
      window.hasUnsavedChanges = true;
      if(!window[`tempEvents_${dateStr}`]) window[`tempEvents_${dateStr}`] = [];
      window[`tempEvents_${dateStr}`].push({ labelIds: [], content: '', completed: false });
      document.getElementById(`compact-events-${dateStr}`).innerHTML = this.generateCompactEventEditor(dateStr);
  }

  requestRemoveCompactEvent(dateStr, idx) {
      this.syncCompactEventInputs(dateStr); 
      const ev = window[`tempEvents_${dateStr}`][idx];
      const isGrouped = !!ev.groupId; 
      
      const labelObjs = window.getEventLabels();
      const forwardLabelId = (ev.labelIds || []).find(id => {
          const match = labelObjs.find(l => l.id === id);
          return match && match.isForward;
      });
      const forwardLabelName = forwardLabelId ? labelObjs.find(l=>l.id===forwardLabelId).name : '';

      if (isGrouped) {
          window.showGroupDeleteModal(dateStr, ev.labelIds[0] || '', ev.content, ev.groupId, 
              () => { window.render(); }, 
              () => { this.removeCompactEvent(dateStr, idx); }
          );
      } else if (forwardLabelId && ev.forwardChainId) {
          window.showForwardDeleteModal(dateStr, forwardLabelName, ev.content, ev.forwardChainId, 
              () => { window.render(); }
          );
      } else {
          this.removeCompactEvent(dateStr, idx);
      }
  }

  removeCompactEvent(dateStr, idx) {
      window.hasUnsavedChanges = true;
      window[`tempEvents_${dateStr}`].splice(idx, 1);
      document.getElementById(`compact-events-${dateStr}`).innerHTML = this.generateCompactEventEditor(dateStr);
  }

  save() {
    this.syncScheduleInputs();
    this.syncAllCompactEventInputs(); 
    
    const datesToSave = this.getWeekDates(); 

    const snapshot = datesToSave.map(d => {
        const dateStr = d.dateStr;
        const rawList = window[`tempEvents_${dateStr}`] || [];
        const validEvents = rawList
            .filter(e => (e.content || '').trim() !== '' || (e.labelIds && e.labelIds.length > 0))
            .map(e => ({...e}));
        const periodsData = JSON.parse(JSON.stringify(window[`tempSchedules_${dateStr}`] || {}));
        return { dateStr, validEvents, periodsData };
    });

    return (async () => {
        const masterLabels = window.getEventLabels();
        for (const item of snapshot) {
            const cleanEventText = window.formatEventListToText ? window.formatEventListToText(item.validEvents) : '';
            await window.getUserCol('events').doc(item.dateStr).set({
                eventList: item.validEvents,
                eventText: cleanEventText, 
                updatedAt: Date.now()
            });

            let isSkipDay = false;
            for (const e of item.validEvents) {
                if (e.labelIds && e.labelIds.some(id => {
                    const match = masterLabels.find(l => l.id === id);
                    return match && match.isSkip;
                })) {
                    isSkipDay = true; break;
                }
            }
            
            if (isSkipDay) {
                for (const p in item.periodsData) { item.periodsData[p].subject = ''; }
            }

            await window.dbAPI.saveSchedule(item.dateStr, item.periodsData);
        }
    })();
  }
}

window.weekViewInstance = new WeekView(document.getElementById("main-view"));
window.renderWeekViewer = (container) => { window.weekViewInstance.container = container; window.weekViewInstance.renderViewer(); };
window.renderWeekEditor = (container) => { window.weekViewInstance.container = container; window.weekViewInstance.renderEditor(); };
window.saveWeekDataFromEditor = () => window.weekViewInstance.save();

window.handleCompactLabelClick = async function(dateStr, idx, labelId) {
    if (window.weekViewInstance) window.weekViewInstance.syncCompactEventInputs(dateStr);
    window.hasUnsavedChanges = true;
    const ev = window[`tempEvents_${dateStr}`][idx];
    if (!ev) return;
    ev.labelIds = ev.labelIds || [];
    
    const isActive = ev.labelIds.includes(labelId);
    
    const labelObj = window.getEventLabels().find(l => l.id === labelId);
    const isPeriod = labelObj ? labelObj.isPeriod : false;
    const isRecur = labelObj ? labelObj.isRecur : false;
    const isForward = labelObj ? labelObj.isForward : false;

    if (isActive) {
        ev.labelIds = ev.labelIds.filter(id => id !== labelId);
    } else {
        if (isPeriod || isRecur) {
            const evContent = ev.content || '';
            const backupEvent = { ...ev };
            
            if(window.weekViewInstance) window.weekViewInstance.syncScheduleInputs();
            if(window.monthViewInstance) window.monthViewInstance.syncScheduleInputs();

            window[`tempEvents_${dateStr}`].splice(idx, 1);
            await window.saveCurrentViewData(true);
            
            const callback = function(isSaved){ 
                if(isSaved) {
                    window.render(); 
                } else {
                    if(!window[`tempEvents_${dateStr}`]) window[`tempEvents_${dateStr}`] = [];
                    window[`tempEvents_${dateStr}`].push(backupEvent);
                    window.saveCurrentViewData(true).then(() => window.render());
                }
            };

            if (isPeriod) {
                window.openPeriodModal(dateStr, labelObj.name, evContent, callback, labelId);
            } else if (isRecur) {
                window.openRecurringModal(dateStr, labelObj.name, evContent, callback, labelId);
            }
            return; 
        }
        
        if (isForward) {
            ev.labelIds = ev.labelIds.filter(id => {
                const lObj = window.getEventLabels().find(x => x.id === id);
                return !(lObj && (lObj.isPeriod || lObj.isRecur));
            });
        }
        
        ev.labelIds.push(labelId);
    }
    
    const container = document.getElementById(`compact-events-${dateStr}`);
    if (container) {
        container.innerHTML = window.weekViewInstance ? window.weekViewInstance.generateCompactEventEditor(dateStr) : (window.monthViewInstance ? window.monthViewInstance.generateCompactEventEditor(dateStr) : window.yearViewInstance.generateCompactEventEditor(dateStr));
    }
};
