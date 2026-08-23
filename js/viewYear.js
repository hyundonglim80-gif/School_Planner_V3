// js/viewYear.js

import { BaseView } from './components/BaseView.js';
import { store } from './core/store.js';
import { formatDate, getEventLabels, isRedDay, getHolidayName } from './core/utils.js';
import { dbAPI, getUserCol, getGroupCol } from './firebase.js'; 
import { generateEventBadgesHTML, formatEventListToText } from './core/eventUtils.js';
import { query, where, documentId, getDocs, doc, setDoc } from "firebase/firestore";

export class YearView extends BaseView {
  constructor(container) {
    super(container); 
    this.myGroups = [];
    this.scheduleGroupId = null; 
  }

  async changeScheduleWorkspace(newGroupId) {
      if (store.hasUnsavedChanges) {
          this.save(); 
      }
      this.scheduleGroupId = newGroupId || null;
      
      if (store.mode === 'editor') this.renderEditor();
      else this.renderViewer();
  }

  async fetchYearData(startStr, endStr) {
    try { this.myGroups = await dbAPI.loadMyGroups(); } catch(e) { this.myGroups = []; }

    const eMap = {}, sMap = {};

    const pEventsSnap = await getDocs(query(getUserCol('events'), where(documentId(), '>=', startStr), where(documentId(), '<=', endStr)));
    pEventsSnap.forEach(docSnap => {
        const data = docSnap.data();
        if (!eMap[docSnap.id]) eMap[docSnap.id] = { eventList: [] };
        let pList = data.eventList || (data.eventText ? window.parseRawEventTextToEventList(data.eventText) : []);
        pList.forEach(e => { e.sharedGroupId = null; eMap[docSnap.id].eventList.push(e); });
    });

    for (const g of this.myGroups) {
        const gEventsSnap = await getDocs(query(getGroupCol(g.id, 'events'), where(documentId(), '>=', startStr), where(documentId(), '<=', endStr)));
        gEventsSnap.forEach(docSnap => {
            const data = docSnap.data();
            if (!eMap[docSnap.id]) eMap[docSnap.id] = { eventList: [] };
            let gList = data.eventList || [];
            gList.forEach(e => { e.sharedGroupId = g.id; e.groupName = g.name; eMap[docSnap.id].eventList.push(e); });
        });
    }

    const scheduleCol = this.scheduleGroupId ? getGroupCol(this.scheduleGroupId, 'schedules') : getUserCol('schedules');
    const schedulesSnap = await getDocs(query(scheduleCol, where(documentId(), '>=', startStr), where(documentId(), '<=', endStr)));
    schedulesSnap.forEach(docSnap => { sMap[docSnap.id] = docSnap.data().periods || {}; });

    return { eMap, sMap };
  }

  async renderViewer() {
    this.showLoading('클라우드에서 연간 일정을 분석하여 불러오는 중...'); 

    if (!window.db) return;

    let allEvents = [];
    let wsSelectHtml = '';

    try {
      const targetY = this.currentDate ? this.currentDate.getFullYear() : new Date().getFullYear();
      const startStr = `${targetY}-03-01`;
      const febLastDay = new Date(targetY + 1, 2, 0).getDate();
      const endStr = `${targetY + 1}-02-${febLastDay}`;

      const { eMap, sMap } = await this.fetchYearData(startStr, endStr);
      const allDates = new Set([...Object.keys(eMap), ...Object.keys(sMap)]);

      const wsOptions = `<option value="">🔒 내 개인 시간표</option>` +
          this.myGroups.map(g => `<option value="${g.id}" ${this.scheduleGroupId === g.id ? 'selected' : ''}>👥 [${g.name}] 공유 시간표</option>`).join('');
      wsSelectHtml = `<select onchange="window.yearViewInstance.changeScheduleWorkspace(this.value)" style="padding:4px 8px; border-radius:6px; border:1px solid #cbd5e1; font-weight:bold; color:#0f766e; background:#f0fdf4; outline:none; cursor:pointer;">${wsOptions}</select>`;

      allDates.forEach(dateStr => {
        let hasContent = false;
        let htmlOutput = '';
        let processedEvents = [];

        const dayPeriods = sMap[dateStr] || {};
        let boxesHtml = '';
        let hasClass = false;

        for (let p = 1; p <= this.maxPeriod; p++) {
          const subject = dayPeriods[p] ? dayPeriods[p].subject : null;
          if (subject && subject.trim() !== '' && subject.toUpperCase() !== 'X') {
            const text = subject.trim();
            let fontSize = "0.75rem"; let letterSpacing = "normal";
            if (text.length === 3) { fontSize = "0.65rem"; letterSpacing = "-0.5px"; } 
            else if (text.length === 4) { fontSize = "0.55rem"; letterSpacing = "-1px"; } 
            else if (text.length >= 5) { fontSize = "0.45rem"; letterSpacing = "-1.5px"; }

            boxesHtml += `<div style="display:flex; align-items:center; justify-content:center; flex:1; min-width:0; height:22px; box-sizing:border-box; border:1px solid #6ee7b7; border-radius:4px; background:#ecfdf5; color:#047857; font-size:${fontSize}; font-weight:700; letter-spacing:${letterSpacing}; white-space:nowrap; overflow:hidden;" title="메모: ${dayPeriods[p].memo || '없음'}, 비고: ${dayPeriods[p].supplies || '없음'}">${text}</div>`;
            hasClass = true;
          } else {
            boxesHtml += `<div style="display:flex; align-items:center; justify-content:center; flex:1; min-width:0; height:22px; box-sizing:border-box; border:1px solid #e2e8f0; border-radius:4px; background:#f8fafc; color:#94a3b8; font-size:0.75rem; font-weight:700;">&nbsp;</div>`;
          }
        }

        let scheduleHtml = (hasClass && store.showClass) ? `<div style="display:flex; flex-wrap:nowrap; gap:2px; margin-top:4px; margin-bottom:4px; width:100%;">${boxesHtml}</div>` : '';
        if (scheduleHtml) {
            htmlOutput += scheduleHtml;
            hasContent = true;
        }

        if (eMap[dateStr] && eMap[dateStr].eventList && eMap[dateStr].eventList.length > 0) {
          processedEvents = eMap[dateStr].eventList.map(e => ({ 
              ...e, 
              labelIds: e.labelIds || [],
              content: (e.sharedGroupId ? `[👥 ${e.groupName}] ` : '') + e.content
          }));
          htmlOutput += generateEventBadgesHTML(processedEvents, dateStr, 'compact');
          hasContent = true;
        }
        
        if (hasContent) {
          allEvents.push({ dateStr: dateStr, htmlOutput: htmlOutput, events: processedEvents }); 
        }
      });
    } catch (error) {}

    allEvents.sort((a, b) => a.dateStr.localeCompare(b.dateStr));

    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const targetYear = this.currentDate ? this.currentDate.getFullYear() : new Date().getFullYear();
    const nextYear = targetYear + 1;

    const months = [
      { label: "3월", match: `${targetYear}-03-` }, { label: "4월", match: `${targetYear}-04-` },
      { label: "5월", match: `${targetYear}-05-` }, { label: "6월", match: `${targetYear}-06-` },
      { label: "7월", match: `${targetYear}-07-` }, { label: "8월", match: `${targetYear}-08-` },
      { label: "9월", match: `${targetYear}-09-` }, { label: "10월", match: `${targetYear}-10-` },
      { label: "11월", match: `${targetYear}-11-` }, { label: "12월", match: `${targetYear}-12-` },
      { label: "1월", match: `${nextYear}-01-` }, { label: "2월", match: `${nextYear}-02-` }
    ];

    let html = `
        <div style="display:flex; justify-content:flex-end; align-items:center; margin-bottom:8px; ${store.showClass ? '' : 'display:none;'}">
           <span style="font-size:0.85rem; color:#64748b; margin-right:8px; font-weight:bold;">작업 공간:</span> ${wsSelectHtml}
        </div>
        <div class="year-grid">
    `;
    const realTodayStr = formatDate(new Date());

    months.forEach(mObj => {
      const monthEvents = allEvents.filter(e => e.dateStr.startsWith(mObj.match));
      let eventListHtml = '';
      
      if (monthEvents.length > 0) {
        eventListHtml = monthEvents.map(e => {
          const parts = e.dateStr.split('-');
          const dayNum = parseInt(parts[2], 10);
          const dateObj = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, dayNum);
          const dayOfWeek = dayNames[dateObj.getDay()];
          
          const isTodayEvent = (e.dateStr === realTodayStr);
          const eventStyle = isTodayEvent 
              ? 'background-color:#eff6ff; padding:8px; border-radius:6px; border:2px solid #3b82f6; margin-bottom:10px;' 
              : 'margin-bottom:10px; border-bottom:1px dashed #e2e8f0; padding-bottom:6px;';

          let dateColor = '#2563eb'; 
          if (isRedDay(e.dateStr, e.events)) {
              dateColor = '#ef4444';
          } else if (dateObj.getDay() === 6) {
              dateColor = '#3b82f6';
          }

          return `<div style="${eventStyle}">
                    <div style="color:${dateColor}; font-weight:700; display:inline-block; cursor:pointer;" onclick="window.goToDay('${e.dateStr}')" title="${e.dateStr} 일 보기로 이동">${dayNum}일(${dayOfWeek})${isTodayEvent ? '🎯 오늘' : ''}</div>
                    <div style="margin-top:2px;">${e.htmlOutput}</div>
                  </div>`;
        }).join('');
      } else {
        eventListHtml = `<div style="text-align:center; color:#94a3b8; font-size:0.9rem; padding-top:10px;">일정 없음</div>`;
      }

      const isCurrentMonthCard = (mObj.match === `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-`);
      const cardClass = isCurrentMonthCard ? 'year-today-card' : '';

      html += `
        <div class="mini-month ${cardClass}" style="display:flex; flex-direction:column; gap:8px;">
          <h3 style="color:#1e40af; border-bottom:2px solid #bfdbfe; padding-bottom:4px; text-align:center;">${mObj.label}</h3>
          <div style="line-height:1.4;">${eventListHtml}</div>
        </div>`;
    });

    html += `</div>`;
    this.container.innerHTML = html;
  }

  async renderEditor() {
    this.showLoading('연간 일정 편집 시트를 불러오는 중...'); 

    if (!window.db) return;

    const currentYear = this.currentDate ? this.currentDate.getFullYear() : new Date().getFullYear();
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

    const startStr = `${currentYear}-03-01`;
    const nextYear = currentYear + 1;
    const febLastDay = new Date(nextYear, 2, 0).getDate();
    const endStr = `${nextYear}-02-${febLastDay}`;

    const { eMap, sMap } = await this.fetchYearData(startStr, endStr);

    const yearData = [];
    for (let month = 2; month <= 11; month++) {
      const year = currentYear;
      const lastDay = new Date(year, month + 1, 0).getDate();
      for (let d = 1; d <= lastDay; d++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        yearData.push({ year, month: month + 1, day: d, dateStr, data: { periods: sMap[dateStr] || {} }, eventData: eMap[dateStr] || {} });
      }
    }
    for (let month = 0; month <= 1; month++) {
      const year = currentYear + 1;
      const lastDay = new Date(year, month + 1, 0).getDate();
      for (let d = 1; d <= lastDay; d++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        yearData.push({ year, month: month + 1, day: d, dateStr, data: { periods: sMap[dateStr] || {} }, eventData: eMap[dateStr] || {} });
      }
    }

    this.renderedDateStrings = [];
    const masterLabels = getEventLabels(); 

    const wsOptions = `<option value="">🔒 내 개인 시간표</option>` +
        this.myGroups.map(g => `<option value="${g.id}" ${this.scheduleGroupId === g.id ? 'selected' : ''}>👥 [${g.name}] 공유 시간표</option>`).join('');
    const wsSelectHtml = `<select onchange="window.yearViewInstance.changeScheduleWorkspace(this.value)" style="padding:4px 8px; border-radius:6px; border:1px solid #cbd5e1; font-weight:bold; color:#0f766e; background:#f0fdf4; outline:none; cursor:pointer;">${wsOptions}</select>`;

    const rowsHtml = yearData.map(item => {
      const dateObj = new Date(item.year, item.month - 1, item.day);
      const dayOfWeekNum = dateObj.getDay();
      const dayOfWeek = dayNames[dayOfWeekNum];

      if (!this.isWeekendVisible && (dayOfWeekNum === 0 || dayOfWeekNum === 6)) return '';

      this.renderedDateStrings.push(item.dateStr);

      let eventList = item.eventData.eventList || [];
      window[`tempEvents_${item.dateStr}`] = eventList.map(e => {
          let labelIds = e.labelIds || [];
          if (labelIds.length === 0 && (e.labels || e.label)) {
              (e.labels || [e.label]).forEach(name => {
                  const match = masterLabels.find(l => l.name === name);
                  if (match && match.id && !labelIds.includes(match.id)) labelIds.push(match.id);
              });
          }
          return { ...e, labelIds, sharedGroupId: e.sharedGroupId || null, groupName: e.groupName || '' };
      });
      window[`tempSchedules_${item.dateStr}`] = item.data.periods || {};
      
      const compactEditorHtml = `<div id="compact-events-${item.dateStr}" style="display:flex; flex-direction:column; gap:4px;">${this.generateCompactEventEditor(item.dateStr)}</div>`; 

      const periods = window[`tempSchedules_${item.dateStr}`];
      const isRed = isRedDay(item.dateStr, window[`tempEvents_${item.dateStr}`]);
      const dateColor = isRed ? '#ef4444' : (dayOfWeekNum === 6 ? '#3b82f6' : '#1e40af');
      const dateNumColor = isRed ? '#ef4444' : (dayOfWeekNum === 6 ? '#3b82f6' : '#475569');

      const periodCellsHtml = Array.from({ length: this.maxPeriod }).map((_, pi) => {
           const pObj = periods[pi + 1] || {};
           let cellText = "";
           if (pObj.subject && pObj.subject.toUpperCase() !== 'X') cellText += `[${pObj.subject}] `;
           if (pObj.memo) cellText += pObj.memo + " ";
           if (pObj.supplies) cellText += `[${pObj.supplies}]`;
           
           return `<td class="editable-cell edit-class-cell" data-p="${pi + 1}" contenteditable="true" style="padding:6px; border:1px solid #cbd5e1; font-size:1rem; color:#047857; background:#ecfdf5; vertical-align:top; white-space:pre-wrap; text-align:left;" oninput="window.yearViewInstance.syncScheduleInputs()">${cellText.trim()}</td>`;
      }).join('');

      return `
        <tr data-year-date="${item.dateStr}">
          <td rowspan="${store.showClass ? 2 : 1}" style="padding:8px 4px; border:1px solid #cbd5e1; background:#f8fafc; vertical-align:middle; width:110px;">
            <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
              <span onclick="window.goToDay('${item.dateStr}')" style="font-size:1.2rem; font-weight:900; color:${dateNumColor}; line-height:1.1; cursor:pointer;" title="${item.dateStr} 일 보기로 이동">${item.month}월 ${item.day}일</span>
              <span style="font-size:0.95rem; font-weight:600; color:${dateColor}; line-height:1;">${dayOfWeek}</span>
            </div>
          </td>
          <td style="padding:4px; border:1px solid #cbd5e1; background:#f0f9ff; color:#0369a1; font-weight:bold; font-size:0.9rem; vertical-align:middle; width:60px; text-align:center;">
              일정<br>
              <button onclick="window.yearViewInstance.addCompactEvent('${item.dateStr}')" style="margin-top:6px; background:#e0f2fe; color:#0369a1; border:1px dashed #7dd3fc; border-radius:4px; padding:2px 8px; cursor:pointer; font-weight:bold; font-size:1.1rem; box-shadow:0 1px 2px rgba(0,0,0,0.05);" title="일정 추가">+</button>
          </td>
          <td colspan="${this.maxPeriod}" style="text-align:left; padding:6px 10px; background:#f0f9ff; vertical-align:top;">${compactEditorHtml}</td>
        </tr>
        <tr data-year-sub="${item.dateStr}" style="${store.showClass ? '' : 'display:none;'}">
          <td style="padding:4px; border:1px solid #cbd5e1; background:#ecfdf5; color:#047857; font-weight:bold; font-size:0.9rem; vertical-align:middle; width:60px; text-align:center;">수업</td>
          ${periodCellsHtml}
        </tr>`;
    }).join('');

    this.container.innerHTML = `
      <div class="table-container" style="background:#fff; padding:12px; border-radius:8px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <h3 style="margin:0; color:#1e293b; font-size:var(--font-header-title);">📅 ${currentYear}학년도 연간 일정/수업 편집 시트</h3>
            <div style="${store.showClass ? '' : 'display:none;'}">
                <span style="font-size:0.85rem; color:#64748b; margin-right:8px; font-weight:bold;">작업 공간:</span>
                ${wsSelectHtml}
            </div>
        </div>
        <table style="width:100%; border-collapse:collapse; text-align:center;">
          <thead>
            <tr style="background:#f1f5f9;">
              <th style="width:110px; padding:8px; border:1px solid #cbd5e1;">날짜</th>
              <th style="width:60px; padding:8px; border:1px solid #cbd5e1;">구분</th>
              <th colspan="${this.maxPeriod}" style="padding:8px; border:1px solid #cbd5e1;">📌 내용 (직접 수정)</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>`;
  }

  changeEventGroup(dateStr, idx, newGroupId) {
      store.hasUnsavedChanges = true;
      if (window[`tempEvents_${dateStr}`]?.[idx]) {
          window[`tempEvents_${dateStr}`][idx].sharedGroupId = newGroupId || null;
          const g = (this.myGroups || []).find(x => x.id === newGroupId);
          window[`tempEvents_${dateStr}`][idx].groupName = g ? g.name : '';
      }
  }

  generateCompactEventEditor(dateStr) {
      const list = window[`tempEvents_${dateStr}`] || [];
      const labelObjs = getEventLabels();
      const realTodayStr = formatDate(new Date());
      
      return list.map((e, idx) => {
          const eLabelIds = e.labelIds || [];
          const isCompleted = !!e.completed;
          const canComplete = eLabelIds.some(id => labelObjs.find(l => l.id === id)?.isForward);
          
          // 🌟 [V3.6 우측 정렬 버튼] 공유 대상을 칩 버튼 형태로 변경
          const groupButtonsHtml = `
              <div style="display:inline-flex; background:#f1f5f9; padding:2px; border-radius:6px; border:1px solid #cbd5e1; align-items:center;">
                  <div onclick="window.yearViewInstance.changeEventGroup('${dateStr}', ${idx}, null)" style="padding:3px 8px; font-size:0.75rem; border-radius:4px; cursor:pointer; font-weight:bold; transition:0.2s; ${e.sharedGroupId === null ? 'background:#fff; color:#2563eb; box-shadow:0 1px 3px rgba(0,0,0,0.1);' : 'color:#64748b;'}">🔒 개인</div>
                  ${(this.myGroups || []).map(g => `<div onclick="window.yearViewInstance.changeEventGroup('${dateStr}', ${idx}, '${g.id}')" style="padding:3px 8px; font-size:0.75rem; border-radius:4px; cursor:pointer; font-weight:bold; transition:0.2s; ${e.sharedGroupId === g.id ? 'background:#fff; color:#2563eb; box-shadow:0 1px 3px rgba(0,0,0,0.1);' : 'color:#64748b;'}">👥 ${g.name}</div>`).join('')}
              </div>
          `;

          let warningIcon = '';
          if (canComplete) {
              if (!isCompleted && dateStr < realTodayStr) warningIcon = `<span style="color:#ef4444; font-weight:bold; font-size:0.8rem; margin-left:8px; align-self:center;">➡️ (미완료)</span>`;
              else if (e.originalDate && e.originalDate < dateStr) warningIcon = `<span style="color:#2563eb; font-weight:bold; font-size:0.8rem; margin-left:8px; align-self:center;">↪️ (이월됨)</span>`;
          }

          const chipsHtml = labelObjs.map(lObj => 
              `<div class="label-chip ${eLabelIds.includes(lObj.id) ? 'active' : ''}" onclick="window.handleCompactLabelClick('${dateStr}', ${idx}, '${lObj.id}')" style="padding:2px 8px; font-size:0.8rem; min-width:auto; cursor:pointer;">${lObj.name}</div>`
          ).join('') + warningIcon;

          const checkboxHtml = canComplete 
              ? `<input type="checkbox" ${isCompleted ? 'checked' : ''} onchange="window.yearViewInstance.updateCompactEvent('${dateStr}', ${idx}, 'completed', this.checked); document.getElementById('compact-events-${dateStr}').innerHTML = window.yearViewInstance.generateCompactEventEditor('${dateStr}');" style="width:18px; height:18px; cursor:pointer; accent-color:#059669;" title="완료 체크">`
              : '';

          const inputStyle = (isCompleted && canComplete) ? 'text-decoration:line-through; color:#94a3b8; background:#e2e8f0;' : 'background:#fff; color:#1e293b;';
          const pureContent = (e.content || '').replace(/➡️\s*\(미완료\)/g, '').replace(/➡️\s*\(다음 날로 이월됨\)/g, '').replace(/↪️\s*/g, '').trim();

          return `
          <div class="compact-event-row" data-idx="${idx}" style="border:1px solid #cbd5e1; border-radius:6px; padding:8px; margin-bottom:8px; background:#f8fafc; display:flex; flex-direction:column; gap:6px; transition:0.2s;">
              <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                  <div class="label-chip-container" style="margin:0; display:flex; flex-wrap:wrap; gap:4px; align-items:center; flex:1;">
                      ${chipsHtml}
                  </div>
                  <!-- 🌟 우측에 공유 칩들과 삭제 버튼 나란히 배치 -->
                  <div style="display:flex; align-items:center; gap:8px; flex-shrink:0;">
                      ${groupButtonsHtml}
                      <button onclick="window.yearViewInstance.requestRemoveCompactEvent('${dateStr}', ${idx})" style="background:none; border:none; color:#ef4444; font-size:1.1rem; cursor:pointer; padding:0; line-height:1;" title="삭제">✖</button>
                  </div>
              </div>
              <div style="display:flex; align-items:flex-start; gap:8px; width:100%;">
                  ${canComplete ? `<div style="padding-top:8px;">${checkboxHtml}</div>` : ''}
                  <textarea placeholder="일정 내용을 입력하세요." style="flex:1; padding:6px 8px; font-size:0.95rem; border:1px solid #cbd5e1; border-radius:4px; outline:none; resize:none; min-height:40px; box-sizing:border-box; ${inputStyle}" onfocus="this.style.height = this.scrollHeight + 'px';" oninput="this.style.height = '40px'; this.style.height = this.scrollHeight + 'px'; window.yearViewInstance.updateCompactEvent('${dateStr}', ${idx}, 'content', this.value)">${pureContent}</textarea>
              </div>
          </div>`;
      }).join('');
  }

  syncCompactEventInputs(dateStr) {
      const container = document.getElementById(`compact-events-${dateStr}`);
      if (!container) return;
      container.querySelectorAll('textarea').forEach((ta, idx) => {
          if (window[`tempEvents_${dateStr}`]?.[idx]) window[`tempEvents_${dateStr}`][idx].content = ta.value;
      });
  }

  syncAllCompactEventInputs() {
      if (this.renderedDateStrings) {
          this.renderedDateStrings.forEach(dateStr => this.syncCompactEventInputs(dateStr));
      }
  }

  syncScheduleInputs() {
      document.querySelectorAll(`tr[data-year-sub]`).forEach(row => {
          const dateStr = row.getAttribute('data-year-sub');
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

  updateCompactEvent(dateStr, idx, field, value) {
      store.hasUnsavedChanges = true;
      if (window[`tempEvents_${dateStr}`]?.[idx]) window[`tempEvents_${dateStr}`][idx][field] = value;
  }

  addCompactEvent(dateStr) {
      this.syncCompactEventInputs(dateStr); 
      store.hasUnsavedChanges = true;
      window[`tempEvents_${dateStr}`] = window[`tempEvents_${dateStr}`] || [];
      window[`tempEvents_${dateStr}`].push({ labelIds: [], content: '', completed: false, sharedGroupId: null });
      document.getElementById(`compact-events-${dateStr}`).innerHTML = this.generateCompactEventEditor(dateStr);
  }

  requestRemoveCompactEvent(dateStr, idx) {
      this.syncCompactEventInputs(dateStr); 
      const ev = window[`tempEvents_${dateStr}`][idx];
      const isGrouped = !!ev.groupId; 
      
      const labelObjs = getEventLabels();
      const forwardLabelId = (ev.labelIds || []).find(id => labelObjs.find(l => l.id === id)?.isForward);
      const forwardLabelName = forwardLabelId ? labelObjs.find(l=>l.id===forwardLabelId).name : '';

      if (isGrouped && ev.groupId.startsWith('group_')) {
          window.showGroupDeleteModal(dateStr, ev.labelIds[0] || '', ev.content, ev.groupId, 
              () => window.render(), 
              () => this.removeCompactEvent(dateStr, idx)
          );
      } else if (forwardLabelId && ev.forwardChainId) {
          window.showForwardDeleteModal(dateStr, forwardLabelName, ev.content, ev.forwardChainId, () => window.render());
      } else {
          this.removeCompactEvent(dateStr, idx);
      }
  }

  removeCompactEvent(dateStr, idx) {
      store.hasUnsavedChanges = true;
      window[`tempEvents_${dateStr}`].splice(idx, 1);
      document.getElementById(`compact-events-${dateStr}`).innerHTML = this.generateCompactEventEditor(dateStr);
  }

  save() {
    if (!this.renderedDateStrings) return;
    this.syncScheduleInputs(); 
    this.syncAllCompactEventInputs();

    const snapshot = this.renderedDateStrings.map(dateStr => {
        const rawList = window[`tempEvents_${dateStr}`] || [];
        const validEvents = rawList
            .filter(e => e.content?.trim() || e.labelIds?.length > 0)
            .map(e => ({...e}));
        const periodsData = JSON.parse(JSON.stringify(window[`tempSchedules_${dateStr}`] || {}));
        return { dateStr, validEvents, periodsData };
    });

    const masterLabels = getEventLabels();
    
    snapshot.forEach(item => {
        const eventsByGroup = { 'personal': [] };
        this.myGroups.forEach(g => eventsByGroup[g.id] = []);

        item.validEvents.forEach(e => {
            const gId = e.sharedGroupId || 'personal';
            if (eventsByGroup[gId]) eventsByGroup[gId].push(e);
        });

        const pEvents = eventsByGroup['personal'];
        setDoc(doc(getUserCol('events'), item.dateStr), {
            eventList: pEvents,
            eventText: formatEventListToText(pEvents),
            updatedAt: Date.now()
        }, { merge: true }).catch(e => console.warn(e));

        this.myGroups.forEach(g => {
            const gEvents = eventsByGroup[g.id];
            setDoc(doc(getGroupCol(g.id, 'events'), item.dateStr), {
                eventList: gEvents,
                eventText: formatEventListToText(gEvents),
                updatedAt: Date.now()
            }, { merge: true }).catch(e => console.warn(e));
        });

        const isSkipDay = item.validEvents.some(e => e.labelIds?.some(id => masterLabels.find(l => l.id === id)?.isSkip));
        if (isSkipDay) {
            Object.values(item.periodsData).forEach(p => p.subject = '');
        }

        const scheduleCol = this.scheduleGroupId ? getGroupCol(this.scheduleGroupId, 'schedules') : getUserCol('schedules');
        setDoc(doc(scheduleCol, item.dateStr), {
            periods: item.periodsData,
            updatedAt: Date.now()
        }, { merge: true }).catch(e => console.warn(e));
    });
  }
}

const instance = new YearView(document.getElementById("main-view"));
Object.assign(window, {
    yearViewInstance: instance,
    renderYearViewer: (c) => { instance.container = c; instance.renderViewer(); },
    renderYearEditor: (c) => { instance.container = c; instance.renderEditor(); },
    saveYearDataFromEditor: () => instance.save()
});