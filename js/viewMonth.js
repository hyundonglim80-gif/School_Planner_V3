// js/viewMonth.js

import { BaseView } from './components/BaseView.js';
import { store } from './core/store.js';
import { formatDate, getEventLabels, isRedDay, getHolidayName } from './core/utils.js';
import { dbAPI, getUserCol } from './firebase.js';
import { generateEventBadgesHTML, formatEventListToText } from './core/eventUtils.js';
import { query, where, documentId, getDocs, doc, setDoc } from "firebase/firestore";

export class MonthView extends BaseView {
  constructor(container) {
    super(container); 
  }

  static setupGoToDay() {
    if (!window.goToDay) {
      window.goToDay = function(dateStr) {
        if (!dateStr) return;
        const parts = dateStr.split('-');
        if (parts.length === 3) {
          store.currentDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
          window.setScope('day');
        }
      };
    }
  }

  async fetchMonthData(startStr, endStr) {
    const [eventsSnap, schedulesSnap] = await Promise.all([
      getDocs(query(getUserCol('events'), where(documentId(), '>=', startStr), where(documentId(), '<=', endStr))),
      getDocs(query(getUserCol('schedules'), where(documentId(), '>=', startStr), where(documentId(), '<=', endStr)))
    ]);

    const eMap = {}, sMap = {};
    eventsSnap.forEach(docSnap => { eMap[docSnap.id] = docSnap.data(); });
    schedulesSnap.forEach(docSnap => { sMap[docSnap.id] = docSnap.data().periods || {}; });
    return { eMap, sMap };
  }

  async renderViewer() {
    this.showLoading('클라우드에서 월간 일정을 불러오는 중...'); 

    const y = store.currentDate.getFullYear();
    const m = store.currentDate.getMonth();
    const lastDate = new Date(y, m + 1, 0).getDate();
    const startStr = `${y}-${String(m+1).padStart(2, '0')}-01`;
    const endStr = `${y}-${String(m+1).padStart(2, '0')}-${String(lastDate).padStart(2, '0')}`;

    const { eMap, sMap } = await this.fetchMonthData(startStr, endStr);

    const daysList = this.isWeekendVisible ? ['일','월','화','수','목','금','토'] : ['월','화','수','목','금'];
    const daysHeaderHtml = daysList.map(d => {
        let color = d === '일' ? 'color:#ef4444;' : (d === '토' ? 'color:#3b82f6;' : '');
        return `<div class="cal-header" style="${color}">${d}</div>`;
    }).join('');
    
    const firstDay = new Date(y, m, 1).getDay(); 
    let padding = this.isWeekendVisible ? firstDay : (firstDay >= 1 && firstDay <= 5 ? firstDay - 1 : 0);
    const paddingHtml = Array.from({ length: padding }).map(() => `<div class="cal-day" style="background:#f8fafc;"></div>`).join('');

    const realTodayStr = formatDate(new Date());

    const daysHtml = Array.from({ length: lastDate }).map((_, i) => {
        const d = i + 1;
        const dateStr = `${y}-${String(m+1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const dayOfWeekNum = new Date(y, m, d).getDay();
        
        if (!this.isWeekendVisible && (dayOfWeekNum === 0 || dayOfWeekNum === 6)) return '';

        const finalEvents = eMap[dateStr]?.eventList || [];
        const processedEvents = finalEvents.length > 0 ? finalEvents.map(e => ({ ...e, labelIds: e.labelIds || [] })) : [];
        const eventHtml = processedEvents.length > 0 ? `<div style="margin-top:4px;">${generateEventBadgesHTML(processedEvents, dateStr, 'compact')}</div>` : '';

        const dayPeriods = sMap[dateStr] || {};
        let hasClass = false;
        
        const boxesHtml = Array.from({ length: this.maxPeriod }).map((_, pi) => {
            const p = pi + 1;
            const subject = dayPeriods[p]?.subject;
            if (subject && subject.trim() !== '' && subject.toUpperCase() !== 'X') {
                hasClass = true;
                const text = subject.trim();
                let fontSize = text.length >= 5 ? "0.45rem" : (text.length === 4 ? "0.55rem" : (text.length === 3 ? "0.65rem" : "0.75rem"));
                let letterSpacing = text.length >= 5 ? "-1.5px" : (text.length === 4 ? "-1px" : (text.length === 3 ? "-0.5px" : "normal"));
                return `<div style="display:flex; align-items:center; justify-content:center; flex:1; min-width:0; height:22px; box-sizing:border-box; border:1px solid #6ee7b7; border-radius:4px; background:#ecfdf5; color:#047857; font-size:${fontSize}; font-weight:700; letter-spacing:${letterSpacing}; white-space:nowrap; overflow:hidden;" title="메모: ${dayPeriods[p].memo || '없음'}, 비고: ${dayPeriods[p].supplies || '없음'}">${text}</div>`;
            }
            return `<div style="display:flex; align-items:center; justify-content:center; flex:1; min-width:0; height:22px; box-sizing:border-box; border:1px solid #e2e8f0; border-radius:4px; background:#f8fafc; color:#94a3b8; font-size:0.75rem; font-weight:700;">&nbsp;</div>`;
        }).join('');

        const scheduleHtml = (hasClass && store.showClass) ? `<div style="display:flex; flex-wrap:nowrap; gap:2px; margin-top:4px; margin-bottom:4px; width:100%;">${boxesHtml}</div>` : '';

        const isRed = isRedDay(dateStr, processedEvents);
        const dateColor = isRed ? '#ef4444' : (dayOfWeekNum === 6 ? '#3b82f6' : '#334155');
        const holidayName = getHolidayName(dateStr);
        const holidayHtml = holidayName ? `<div style="font-size:0.65rem; color:#ef4444; margin-top:1px; line-height:1;">${holidayName}</div>` : '';
        const todayClass = (dateStr === realTodayStr) ? 'month-today-cell' : '';

        return `
          <div class="cal-day ${todayClass}">
              <div style="font-weight:700; color:${dateColor}; font-size:1.1rem; display:inline-block; cursor:pointer;" onclick="window.goToDay('${dateStr}')" title="${dateStr} 일 보기로 이동">${d}${holidayHtml}</div>
              ${scheduleHtml}
              ${eventHtml}
          </div>`;
    }).join('');

    this.container.innerHTML = `<div class="calendar-grid" style="grid-template-columns: repeat(${this.isWeekendVisible ? 7 : 5}, 1fr);">${daysHeaderHtml}${paddingHtml}${daysHtml}</div>`;
  }

  async renderEditor() {
    this.showLoading('월간 편집 시트를 불러오는 중...');

    const y = store.currentDate.getFullYear();
    const m = store.currentDate.getMonth();
    const lastDate = new Date(y, m + 1, 0).getDate();
    const startStr = `${y}-${String(m+1).padStart(2, '0')}-01`;
    const endStr = `${y}-${String(m+1).padStart(2, '0')}-${String(lastDate).padStart(2, '0')}`;

    const { eMap, sMap } = await this.fetchMonthData(startStr, endStr);
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const masterLabels = getEventLabels(); 

    const rowsHtml = Array.from({ length: lastDate }).map((_, i) => {
        const d = i + 1;
        const dateStr = `${y}-${String(m+1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const dayOfWeekNum = new Date(y, m, d).getDay();
        const dayOfWeek = dayNames[dayOfWeekNum];

        if (!this.isWeekendVisible && (dayOfWeekNum === 0 || dayOfWeekNum === 6)) return '';

        const eventList = eMap[dateStr]?.eventList || [];
        const periods = sMap[dateStr] || {};

        window[`tempEvents_${dateStr}`] = eventList.map(e => {
            let labelIds = e.labelIds || [];
            if (labelIds.length === 0 && (e.labels || e.label)) {
                (e.labels || [e.label]).forEach(name => {
                    const match = masterLabels.find(l => l.name === name);
                    if (match && match.id && !labelIds.includes(match.id)) labelIds.push(match.id);
                });
            }
            return { ...e, labelIds };
        });
        window[`tempSchedules_${dateStr}`] = periods;
        
        // 🌟 [안전한 연결] 주간 뷰의 컴팩트 에디터 생성기를 그대로 활용하여 기능 동기화 보장
        const compactEditorHtml = `<div id="compact-events-${dateStr}" style="display:flex; flex-direction:column; gap:4px;">` + 
            (window.weekViewInstance ? window.weekViewInstance.generateCompactEventEditor(dateStr) : window.generateCompactEventEditor(dateStr)) + 
            `</div>`; 

        const isRed = isRedDay(dateStr, window[`tempEvents_${dateStr}`]);
        const dateColor = isRed ? '#ef4444' : (dayOfWeekNum === 6 ? '#3b82f6' : '#1e40af');
        const dateNumColor = isRed ? '#ef4444' : (dayOfWeekNum === 6 ? '#3b82f6' : '#475569');
        const holidayName = getHolidayName(dateStr);
        const holidayHtml = holidayName ? `<span style="font-size:0.75rem; color:#ef4444; font-weight:bold; margin-top:2px;">${holidayName}</span>` : '';

        const periodCellsHtml = Array.from({ length: this.maxPeriod }).map((_, pi) => {
            const pObj = periods[pi + 1] || {};
            let cellText = "";
            if (pObj.subject && pObj.subject.toUpperCase() !== 'X') cellText += `[${pObj.subject}] `;
            if (pObj.memo) cellText += pObj.memo + " ";
            if (pObj.supplies) cellText += `[${pObj.supplies}]`;
            
            return `<td class="editable-cell edit-class-cell" data-p="${pi + 1}" contenteditable="true" style="padding:6px; border:1px solid #cbd5e1; font-size:1rem; color:#047857; background:#ecfdf5; vertical-align:top; white-space:pre-wrap; text-align:left;" oninput="window.monthViewInstance.syncScheduleInputs()">${cellText.trim()}</td>`;
        }).join('');

        return `
        <tr data-month-date="${dateStr}">
          <td rowspan="${store.showClass ? 2 : 1}" style="padding:8px 4px; border:1px solid #cbd5e1; background:#f8fafc; vertical-align:middle; width:80px;">
            <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
              <span onclick="window.goToDay('${dateStr}')" style="font-size:1.8rem; font-weight:900; color:${dateNumColor}; line-height:1; cursor:pointer;" title="${dateStr} 일 보기로 이동">${d}</span>
              <span style="font-size:1rem; font-weight:600; color:${dateColor}; line-height:1;">${dayOfWeek}</span>
              ${holidayHtml}
            </div>
          </td>
          <td style="padding:4px; border:1px solid #cbd5e1; background:#f0f9ff; color:#0369a1; font-weight:bold; font-size:0.9rem; vertical-align:middle; width:60px; text-align:center;">
              일정<br>
              <button onclick="window.weekViewInstance ? window.weekViewInstance.addCompactEvent('${dateStr}') : window.addCompactEvent('${dateStr}')" style="margin-top:6px; background:#e0f2fe; color:#0369a1; border:1px dashed #7dd3fc; border-radius:4px; padding:2px 8px; cursor:pointer; font-weight:bold; font-size:1.1rem; box-shadow:0 1px 2px rgba(0,0,0,0.05);" title="일정 추가">+</button>
          </td>
          <td colspan="${this.maxPeriod}" style="text-align:left; padding:6px 10px; background:#f0f9ff; vertical-align:top;">${compactEditorHtml}</td>
        </tr>
        <tr data-month-sub="${dateStr}" style="${store.showClass ? '' : 'display:none;'}">
          <td style="padding:4px; border:1px solid #cbd5e1; background:#ecfdf5; color:#047857; font-weight:bold; font-size:0.9rem; vertical-align:middle; width:60px; text-align:center;">수업</td>
          ${periodCellsHtml}
        </tr>`;
    }).join('');

    this.container.innerHTML = `
      <div class="table-container" style="background:#fff; padding:12px; border-radius:8px;">
        <h3 style="margin-bottom:12px; color:#1e293b; font-size:var(--font-header-title);">📅 ${y}년 ${m+1}월 일정/수업 편집 시트</h3>
        <table style="width:100%; border-collapse:collapse; text-align:center;">
          <thead>
            <tr style="background:#f1f5f9;">
              <th style="width:80px; padding:8px; border:1px solid #cbd5e1;">날짜</th>
              <th style="width:60px; padding:8px; border:1px solid #cbd5e1;">구분</th>
              <th colspan="${this.maxPeriod}" style="padding:8px; border:1px solid #cbd5e1;">📌 내용 (직접 수정)</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>`;
  }

  syncScheduleInputs() {
      document.querySelectorAll(`tr[data-month-sub]`).forEach(row => {
          const dateStr = row.getAttribute('data-month-sub');
          window[`tempSchedules_${dateStr}`] = window[`tempSchedules_${dateStr}`] || {};

          row.querySelectorAll('.edit-class-cell').forEach(cell => {
              const p = cell.getAttribute("data-p");
              let text = cell.innerText?.trim() || "";
              let subject = '', memo = '', supplies = '';

              if (text !== '') {
                  const allBrackets = text.match(/\[.*?\]/g);
                  if (allBrackets && allBrackets.length >= 2) {
                      const lastMatch = text.match(/\[([^\]]+)\]\s*$/);
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
              window[`tempSchedules_${dateStr}`][p] = { subject: subject.toUpperCase() === 'X' ? '' : subject, memo, supplies };
          });
      });
  }

  // 🌟 [복구] 이전 코드와 동일하게 주간 뷰의 라벨 토글/삭제 엔진을 그대로 안전하게 활용
  toggleCompactEventLabel(dateStr, idx, labelId) {
      if(window.weekViewInstance) window.weekViewInstance.toggleCompactEventLabel(dateStr, idx, labelId);
  }
  updateCompactEvent(dateStr, idx, field, value) {
      if(window.weekViewInstance) window.weekViewInstance.updateCompactEvent(dateStr, idx, field, value);
  }
  
  requestRemoveCompactEvent(dateStr, idx) {
      if(window.weekViewInstance) {
          window.weekViewInstance.requestRemoveCompactEvent(dateStr, idx);
      } else {
          const ev = window[`tempEvents_${dateStr}`][idx];
          const isGrouped = !!ev.groupId;
          const labelObjs = getEventLabels();
          const forwardLabelId = (ev.labelIds || []).find(id => labelObjs.find(l => l.id === id)?.isForward);
          const forwardLabelName = forwardLabelId ? labelObjs.find(l=>l.id===forwardLabelId).name : '';

          if (isGrouped) {
              window.showGroupDeleteModal(dateStr, ev.labelIds[0]||'', ev.content, ev.groupId, 
                  () => window.render(), 
                  () => this.removeCompactEvent(dateStr, idx)
              );
          } else if (forwardLabelId && ev.forwardChainId) {
              window.showForwardDeleteModal(dateStr, forwardLabelName, ev.content, ev.forwardChainId, () => window.render());
          } else {
              this.removeCompactEvent(dateStr, idx);
          }
      }
  }

  removeCompactEvent(dateStr, idx) {
      if(window.weekViewInstance) {
          window.weekViewInstance.removeCompactEvent(dateStr, idx);
      } else {
          store.hasUnsavedChanges = true;
          window[`tempEvents_${dateStr}`].splice(idx, 1);
          window.render();
      }
  }

  async save() {
    this.syncScheduleInputs(); 
    const y = store.currentDate.getFullYear();
    const m = store.currentDate.getMonth();
    const lastDate = new Date(y, m + 1, 0).getDate();

    const snapshot = [];
    for(let i=1; i<=lastDate; i++) {
        const dateStr = `${y}-${String(m+1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        const rawList = window[`tempEvents_${dateStr}`];
        if (rawList !== undefined) {
            const validEvents = rawList
                .filter(e => e.content?.trim() || e.labelIds?.length > 0)
                .map(e => ({...e}));
            const periodsData = JSON.parse(JSON.stringify(window[`tempSchedules_${dateStr}`] || {}));
            snapshot.push({ dateStr, validEvents, periodsData });
        }
    }

    const masterLabels = getEventLabels();
    for (const item of snapshot) {
        const cleanEventText = formatEventListToText(item.validEvents);
        await setDoc(doc(getUserCol('events'), item.dateStr), {
            eventList: item.validEvents,
            eventText: cleanEventText,
            updatedAt: Date.now()
        });

        const isSkipDay = item.validEvents.some(e => e.labelIds?.some(id => masterLabels.find(l => l.id === id)?.isSkip));
        if (isSkipDay) {
            Object.values(item.periodsData).forEach(p => p.subject = '');
        }

        await dbAPI.saveSchedule(item.dateStr, item.periodsData);
    }
  }
}

MonthView.setupGoToDay();

// ==========================================================================
// 🌉 과도기 호환성 레이어 
// ==========================================================================
const instance = new MonthView(document.getElementById("main-view"));
Object.assign(window, {
    monthViewInstance: instance,
    renderMonthViewer: (c) => { instance.container = c; instance.renderViewer(); },
    renderMonthEditor: (c) => { instance.container = c; instance.renderEditor(); },
    saveMonthDataFromEditor: () => instance.save()
});