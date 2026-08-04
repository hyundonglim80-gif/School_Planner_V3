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
    const weekDates = this.getWeekDates();

    // 주간 헤더
    html += `<tr class="week-header-row">`;
    weekDates.forEach(d => {
        const isToday = d.dateStr === realTodayStr ? 'today-highlight' : '';
        html += `<th class="${isToday}" style="text-align:center; padding:10px;">${d.day} (${d.dateDisplay})</th>`;
    });
    html += `</tr>`;

    // 일별 일정 & 수업 메모 불러오기
    const dayPromises = weekDates.map(d => Promise.all([
        window.dbAPI.loadDayData(d.dateStr),
        window.getUserCol('events').doc(d.dateStr).get()
    ]));

    const dayResults = await Promise.all(dayPromises);

    html += `<tr>`;
    weekDates.forEach((d, idx) => {
        const [dayData, eventSnap] = dayResults[idx];
        const eventData = eventSnap.exists ? eventSnap.data() : {};
        const events = this.parseEvents(eventData);

        html += `<td style="vertical-align:top; padding:8px; border:1px solid #e2e8f0; width:${100/weekDates.length}%;">`;
        
        // 일정 표시
        if (events.length > 0) {
            html += `<div style="margin-bottom:10px;">`;
            events.forEach(e => {
                const labels = e.labels || (e.label ? [e.label] : []);
                let labelBadges = '';
                labels.forEach(l => {
                    labelBadges += `<span class="badge" style="background:#dbeafe; color:#1e40af; font-size:0.75rem; padding:1px 5px; border-radius:3px; margin-right:3px;">${l}</span>`;
                });
                const isCompleted = !!e.completed;
                const textStyle = isCompleted ? 'text-decoration:line-through; color:#94a3b8;' : 'color:#1e293b;';
                html += `<div style="font-size:0.85rem; margin-bottom:4px; line-height:1.3;">
                    ${isCompleted ? '✅' : '▪️'} ${labelBadges}<span style="${textStyle}">${e.content || ''}</span>
                </div>`;
            });
            html += `</div>`;
        }

        // 수업 메모 표시
        const maxP = window.periodNames ? window.periodNames.length : 6;
        for (let p = 1; p <= maxP; p++) {
            const pName = (window.periodNames && window.periodNames[p - 1]) ? window.periodNames[p - 1] : `${p}교시`;
            const pData = (dayData.periods && dayData.periods[p]) ? dayData.periods[p] : { subject: '', memo: '' };
            if (pData.subject || pData.memo) {
                html += `<div style="background:#f8fafc; border-left:3px solid #2563eb; padding:4px 6px; margin-bottom:4px; border-radius:0 4px 4px 0; font-size:0.8rem;">
                    <span style="font-weight:bold; color:#2563eb;">[${pName} ${pData.subject || ''}]</span>
                    <span style="color:#334155;">${pData.memo || ''}</span>
                </div>`;
            }
        }

        html += `</td>`;
    });
    html += `</tr></tbody></table></div>`;

    this.container.innerHTML = html;
  }

  parseEvents(docData) {
    if (!docData) return [];
    if (docData.eventList && docData.eventList.length > 0) return docData.eventList;
    if (docData.eventText && docData.eventText.trim() !== '') return window.parseRawEventTextToEventList(docData.eventText);
    return [];
  }

  async renderEditor() {
    this.showLoading('주간 편집 시트를 불러오는 중입니다...');
    const weekDates = this.getWeekDates();

    const dayPromises = weekDates.map(d => Promise.all([
        window.dbAPI.loadDayData(d.dateStr),
        window.getUserCol('events').doc(d.dateStr).get()
    ]));

    const dayResults = await Promise.all(dayPromises);

    let html = `<div class="week-editor-board"><table><tbody>`;

    // 헤더
    html += `<tr class="week-header-row">`;
    weekDates.forEach(d => {
        html += `<th style="text-align:center; padding:10px; background:#f1f5f9;">${d.day} (${d.dateDisplay})</th>`;
    });
    html += `</tr>`;

    // 일정 및 시간표 편집 셀
    html += `<tr>`;
    weekDates.forEach((d, idx) => {
        const [dayData, eventSnap] = dayResults[idx];
        const eventData = eventSnap.exists ? eventSnap.data() : {};
        const events = this.parseEvents(eventData);

        window[`tempEvents_${d.dateStr}`] = JSON.parse(JSON.stringify(events));

        html += `<td style="vertical-align:top; padding:8px; border:1px solid #cbd5e1; width:${100/weekDates.length}%;">
            <div style="margin-bottom:12px; border-bottom:1px solid #e2e8f0; padding-bottom:8px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                    <span style="font-weight:bold; font-size:0.85rem; color:#1e293b;">📌 일정</span>
                    <button onclick="window.weekViewInstance.addCompactEvent('${d.dateStr}')" style="padding:2px 6px; background:#2563eb; color:#fff; border:none; border-radius:4px; font-size:0.75rem; cursor:pointer; font-weight:bold;">+ 추가</button>
                </div>
                <div id="compact-events-${d.dateStr}">
                    ${this.generateCompactEventEditor(d.dateStr)}
                </div>
            </div>

            <div style="font-weight:bold; font-size:0.85rem; color:#1e293b; margin-bottom:6px;">📚 수업 작성</div>`;

        const maxP = window.periodNames ? window.periodNames.length : 6;
        for (let p = 1; p <= maxP; p++) {
            const pName = (window.periodNames && window.periodNames[p - 1]) ? window.periodNames[p - 1] : `${p}교시`;
            const pData = (dayData.periods && dayData.periods[p]) ? dayData.periods[p] : { subject: '', memo: '' };

            html += `<div style="margin-bottom:6px; background:#f8fafc; padding:4px; border-radius:4px; border:1px solid #e2e8f0;" data-week-date="${d.dateStr}" data-p="${p}">
                <div style="font-size:0.75rem; font-weight:bold; color:#64748b; margin-bottom:2px;">${pName}</div>
                <input type="text" class="edit-subject" value="${pData.subject || ''}" placeholder="과목" style="width:100%; padding:3px 5px; font-size:0.8rem; border:1px solid #cbd5e1; border-radius:3px; margin-bottom:2px; box-sizing:border-box;">
                <input type="text" class="edit-memo" value="${pData.memo || ''}" placeholder="메모" style="width:100%; padding:3px 5px; font-size:0.8rem; border:1px solid #cbd5e1; border-radius:3px; box-sizing:border-box;">
            </div>`;
        }

        html += `</td>`;
    });
    html += `</tr></tbody></table></div>`;

    this.container.innerHTML = html;
  }

  // 🚀 컴팩트 일정 작성 뷰 (체크박스를 텍스트 작성 칸 바로 왼쪽에 배치)
  generateCompactEventEditor(dateStr) {
      const list = window[`tempEvents_${dateStr}`] || [];
      const labelObjs = window.getEventLabels();
      let html = '';
      
      list.forEach((e, idx) => {
          const eLabels = e.labels || (e.label ? [e.label] : []);
          
          let chipsHtml = `<div class="label-chip-container" style="margin:0; display:flex; flex-wrap:wrap; gap:4px; margin-bottom:4px;">`;
          labelObjs.forEach(labelObj => {
              const lName = labelObj.name;
              const isActive = eLabels.includes(lName);
              const activeClass = isActive ? 'active' : '';
              
              const clickCode = `window.handleCompactLabelClick('${dateStr}', ${idx}, '${lName}')`;
              chipsHtml += `<div class="label-chip ${activeClass}" onclick="${clickCode}" style="padding:2px 6px; font-size:0.75rem; cursor:pointer;">${lName}</div>`;
          });
          chipsHtml += `</div>`;

          const isCompleted = !!e.completed;
          const canComplete = eLabels.some(l => typeof window.isForwardLabel === 'function' && window.isForwardLabel(l));
          const inputStyle = (isCompleted && canComplete) ? 'text-decoration:line-through; color:#94a3b8; background:#e2e8f0;' : 'background:#fff; color:#1e293b;';

          const checkboxHtml = canComplete 
              ? `<input type="checkbox" ${isCompleted ? 'checked' : ''} onchange="window.weekViewInstance ? window.weekViewInstance.updateCompactEvent('${dateStr}', ${idx}, 'completed', this.checked) : window.monthViewInstance.updateCompactEvent('${dateStr}', ${idx}, 'completed', this.checked); document.getElementById('compact-events-${dateStr}').innerHTML = window.weekViewInstance ? window.weekViewInstance.generateCompactEventEditor('${dateStr}') : window.monthViewInstance.generateCompactEventEditor('${dateStr}');" style="width:16px; height:18px; cursor:pointer; accent-color:#059669; flex-shrink:0;" title="완료 체크">`
              : '';

          html += `
          <div class="compact-event-row" data-idx="${idx}" style="border:1px solid #cbd5e1; border-radius:6px; padding:6px; margin-bottom:6px; background:#fff; display:flex; flex-direction:column; gap:4px;">
              <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                  ${chipsHtml}
                  <button onclick="window.weekViewInstance ? window.weekViewInstance.requestRemoveCompactEvent('${dateStr}', ${idx}) : window.monthViewInstance.requestRemoveCompactEvent('${dateStr}', ${idx})" style="background:none; border:none; color:#ef4444; font-size:1rem; cursor:pointer; padding:0; line-height:1;" title="삭제">✖</button>
              </div>
              <div style="display:flex; align-items:center; gap:6px; width:100%;">
                  ${checkboxHtml}
                  <textarea placeholder="일정 내용을 입력하세요." style="flex:1; padding:4px 6px; font-size:0.85rem; border:1px solid #cbd5e1; border-radius:4px; outline:none; resize:none; min-height:36px; box-sizing:border-box; ${inputStyle}" onfocus="this.style.height = this.scrollHeight + 'px';" oninput="this.style.height = '36px'; this.style.height = this.scrollHeight + 'px'; window.weekViewInstance ? window.weekViewInstance.updateCompactEvent('${dateStr}', ${idx}, 'content', this.value) : window.monthViewInstance.updateCompactEvent('${dateStr}', ${idx}, 'content', this.value)">${e.content || ''}</textarea>
              </div>
          </div>`;
      });
      return html;
  }

  addCompactEvent(dateStr) {
      window[`tempEvents_${dateStr}`] = window[`tempEvents_${dateStr}`] || [];
      window[`tempEvents_${dateStr}`].push({ content: '', labels: [] });
      const el = document.getElementById(`compact-events-${dateStr}`);
      if (el) el.innerHTML = this.generateCompactEventEditor(dateStr);
  }

  updateCompactEvent(dateStr, idx, key, value) {
      if (window[`tempEvents_${dateStr}`] && window[`tempEvents_${dateStr}`][idx]) {
          window[`tempEvents_${dateStr}`][idx][key] = value;
          window.hasUnsavedChanges = true;
      }
  }

  // 🚀 기간 일정 삭제 시 다중 삭제 모달 호출
  requestRemoveCompactEvent(dateStr, idx) {
      const ev = window[`tempEvents_${dateStr}`][idx];
      const labelsToRender = ev.labels || (ev.label ? [ev.label] : []);
      const periodLabel = labelsToRender.find(l => typeof window.isPeriodLabel === 'function' && window.isPeriodLabel(l));

      if (periodLabel) {
          window.showPeriodDeleteModal(dateStr, periodLabel, ev.content, ev.groupId, () => {
              window.render();
          });
      } else {
          this.removeCompactEvent(dateStr, idx);
      }
  }

  removeCompactEvent(dateStr, idx) {
      if (window[`tempEvents_${dateStr}`]) {
          window[`tempEvents_${dateStr}`].splice(idx, 1);
          window.hasUnsavedChanges = true;
          const el = document.getElementById(`compact-events-${dateStr}`);
          if (el) el.innerHTML = this.generateCompactEventEditor(dateStr);
      }
  }

  async save() {
      const weekDates = this.getWeekDates();

      for (const d of weekDates) {
          const events = window[`tempEvents_${d.dateStr}`] || [];
          const validEvents = events.filter(e => (e.content && e.content.trim() !== '') || (e.labels && e.labels.length > 0));

          await window.getUserCol('events').doc(d.dateStr).set({
              eventList: validEvents,
              updatedAt: Date.now()
          });

          // 시간표 정보 저장
          const cells = document.querySelectorAll(`[data-week-date="${d.dateStr}"]`);
          const periodsData = {};
          cells.forEach(cell => {
              const p = cell.getAttribute("data-p");
              const subject = cell.querySelector(".edit-subject").value.trim();
              const memo = cell.querySelector(".edit-memo").value.trim();
              periodsData[p] = { subject, memo, supplies: '' };
          });

          await window.dbAPI.saveSchedule(d.dateStr, periodsData);
      }
  }
}

// 🚀 라벨 클릭 시 '기간' 속성 라벨이면 팝업 모달 실행
window.handleCompactLabelClick = function(dateStr, idx, lName) {
    window.hasUnsavedChanges = true;
    const ev = window[`tempEvents_${dateStr}`][idx];
    if (!ev) return;
    ev.labels = ev.labels || (ev.label ? [ev.label] : []);
    
    const isActive = ev.labels.includes(lName);
    
    if (isActive) {
        ev.labels = ev.labels.filter(l => l !== lName);
    } else {
        // 🚀 기간 라벨 클릭 시 기간 등록 모달 팝업 실행
        if (typeof window.isPeriodLabel === 'function' && window.isPeriodLabel(lName)) {
            const ta = document.querySelector(`.compact-event-row[data-idx="${idx}"] textarea`);
            window.openPeriodModal(dateStr, lName, ta ? ta.value : '', function(isSaved){ 
                if(isSaved) window.render(); 
            });
            return; 
        }
        
        if (typeof window.isForwardLabel === 'function' && window.isForwardLabel(lName)) {
            ev.labels = ev.labels.filter(l => !window.isPeriodLabel(l));
        }
        
        ev.labels.push(lName);
    }
    
    const container = document.getElementById(`compact-events-${dateStr}`);
    if (container) {
        const viewInst = window.weekViewInstance || window.monthViewInstance;
        if (viewInst) container.innerHTML = viewInst.generateCompactEventEditor(dateStr);
    }
};

window.weekViewInstance = new WeekView(document.getElementById("main-view"));
window.renderWeekViewer = (container) => { window.weekViewInstance.container = container; window.weekViewInstance.renderViewer(); };
window.renderWeekEditor = (container) => { window.weekViewInstance.container = container; window.weekViewInstance.renderEditor(); };
window.saveWeekDataFromEditor = () => window.weekViewInstance.save();
