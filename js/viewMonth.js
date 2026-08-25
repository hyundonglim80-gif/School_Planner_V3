// js/viewMonth.js

import { BaseView } from './components/BaseView.js';
import { store } from './core/store.js';
import { formatDate, getEventLabels, isRedDay, getHolidayName } from './core/utils.js';
import { dbAPI, getUserCol, getGroupCol } from './firebase.js'; 
import { generateEventBadgesHTML, formatEventListToText } from './core/eventUtils.js';
import { query, where, documentId, getDocs, doc, setDoc } from "firebase/firestore";

export class MonthView extends BaseView {
  constructor(container) {
    super(container); 
    this.myGroups = [];
    this.scheduleGroupId = null; // 에디터 모드 전용(단일 선택)
    this.activeFilters = null; // 🌟 뷰어/에디터 통합 필터
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

  // 🌟 [핵심 변경] 단일 통합 필터 HTML 생성 (index.html 슬롯에 삽입)
  getUnifiedFilterHtml() {
      let isPersonalActive = false;
      let activeGroupIds = [];

      if (store.mode === 'editor') {
          isPersonalActive = (this.scheduleGroupId === null);
          if (this.scheduleGroupId) activeGroupIds.push(this.scheduleGroupId);
      } else {
          if (!this.activeFilters) this.activeFilters = ['personal', ...this.myGroups.map(g => g.id)];
          isPersonalActive = this.activeFilters.includes('personal');
          activeGroupIds = this.activeFilters;
      }

      let html = `<div style="display:inline-flex; align-items:center; gap:4px; background:#f8fafc; padding:3px 6px; border-radius:8px; border:1px solid #e2e8f0;">`;
      html += `<div onclick="window.toggleUnifiedFilter('personal')" style="padding:4px 10px; font-size:0.8rem; border-radius:6px; cursor:pointer; font-weight:bold; transition:0.2s; ${isPersonalActive ? 'background:#3b82f6; color:#fff; box-shadow:0 1px 2px rgba(0,0,0,0.1);' : 'background:transparent; color:#64748b;'}">🔒 개인</div>`;

      this.myGroups.forEach(g => {
          const isActive = activeGroupIds.includes(g.id);
          html += `<div onclick="window.toggleUnifiedFilter('${g.id}')" style="padding:4px 10px; font-size:0.8rem; border-radius:6px; cursor:pointer; font-weight:bold; transition:0.2s; ${isActive ? 'background:#10b981; color:#fff; box-shadow:0 1px 2px rgba(0,0,0,0.1);' : 'background:transparent; color:#64748b;'}">👥 ${g.name}</div>`;
      });
      html += `</div>`;
      return html;
  }

  async fetchMonthData(startStr, endStr) {
    try { this.myGroups = await dbAPI.loadMyGroups(); } catch(e) { this.myGroups = []; }

    const eMap = {}, sMap = {};
    const promises = [];

    promises.push(
        getDocs(query(getUserCol('events'), where(documentId(), '>=', startStr), where(documentId(), '<=', endStr))).then(snap => {
            snap.forEach(docSnap => {
                const data = docSnap.data();
                if (!eMap[docSnap.id]) eMap[docSnap.id] = { eventList: [] };
                let pList = data.eventList || (data.eventText ? window.parseRawEventTextToEventList(data.eventText) : []);
                pList.forEach(e => { e.sharedGroupId = null; eMap[docSnap.id].eventList.push(e); });
            });
        }).catch(e => console.warn(e))
    );

    for (const g of this.myGroups) {
        promises.push(
            getDocs(query(getGroupCol(g.id, 'events'), where(documentId(), '>=', startStr), where(documentId(), '<=', endStr))).then(snap => {
                snap.forEach(docSnap => {
                    const data = docSnap.data();
                    if (!eMap[docSnap.id]) eMap[docSnap.id] = { eventList: [] };
                    let gList = data.eventList || [];
                    gList.forEach(e => { e.sharedGroupId = g.id; e.groupName = g.name; eMap[docSnap.id].eventList.push(e); });
                });
            }).catch(e => console.warn(e))
        );
    }

    promises.push(
        getDocs(query(getUserCol('schedules'), where(documentId(), '>=', startStr), where(documentId(), '<=', endStr))).then(snap => {
            snap.forEach(docSnap => {
                if (!sMap[docSnap.id]) sMap[docSnap.id] = {};
                sMap[docSnap.id]['personal'] = docSnap.data().periods || {};
            });
        }).catch(e => console.warn(e))
    );

    for (const g of this.myGroups) {
        promises.push(
            getDocs(query(getGroupCol(g.id, 'schedules'), where(documentId(), '>=', startStr), where(documentId(), '<=', endStr))).then(snap => {
                snap.forEach(docSnap => {
                    if (!sMap[docSnap.id]) sMap[docSnap.id] = {};
                    sMap[docSnap.id][g.id] = docSnap.data().periods || {};
                });
            }).catch(e => console.warn(e))
        );
    }

    await Promise.all(promises);
    return { eMap, sMap };
  }

  async renderViewer() {
    this.showLoading('클라우드에서 월간 일정을 불러오는 중...'); 

    if (this.container) {
        this.container.style.overflow = 'visible';
    }

    const y = store.currentDate.getFullYear();
    const m = store.currentDate.getMonth();
    const lastDate = new Date(y, m + 1, 0).getDate();
    const startStr = `${y}-${String(m+1).padStart(2, '0')}-01`;
    const endStr = `${y}-${String(m+1).padStart(2, '0')}-${String(lastDate).padStart(2, '0')}`;

    const { eMap, sMap } = await this.fetchMonthData(startStr, endStr);

    if (!this.activeFilters) this.activeFilters = ['personal', ...this.myGroups.map(g => g.id)];

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
        
        const filteredEvents = finalEvents.filter(e => this.activeFilters.includes(e.sharedGroupId || 'personal'));
        const processedEvents = filteredEvents.length > 0 ? filteredEvents.map(e => ({ 
            ...e, 
            labelIds: e.labelIds || [],
            content: (e.sharedGroupId ? `<span style="display:inline-block; padding:2px 6px; font-size:0.75rem; border-radius:4px; background:#e0f2fe; color:#0369a1; border:1px solid #bae6fd; margin-right:4px; vertical-align:middle; font-weight:bold;">👥 ${e.groupName}</span> ` : '') + e.content
        })) : [];
        
        const eventHtml = processedEvents.length > 0 ? `<div style="margin-top:4px;">${generateEventBadgesHTML(processedEvents, dateStr, 'compact')}</div>` : '';

        let hasClass = false;
        let boxesHtml = Array.from({ length: this.maxPeriod }).map((_, pi) => {
            const p = pi + 1;
            let pTexts = [];
            
            this.activeFilters.forEach(filterId => {
                const subj = sMap[dateStr]?.[filterId]?.[p]?.subject;
                if (subj && subj.trim() !== '' && subj.toUpperCase() !== 'X') {
                    let prefix = this.activeFilters.length > 1 ? (filterId === 'personal' ? '🔒 ' : '👥 ') : '';
                    pTexts.push(prefix + subj.trim());
                }
            });

            if (pTexts.length > 0) {
                hasClass = true;
                const text = pTexts.join(' / ');
                let fontSize = text.length >= 5 ? "0.45rem" : (text.length === 4 ? "0.55rem" : (text.length === 3 ? "0.65rem" : "0.75rem"));
                let letterSpacing = text.length >= 5 ? "-1.5px" : (text.length === 4 ? "-1px" : (text.length === 3 ? "-0.5px" : "normal"));
                return `<div style="display:flex; align-items:center; justify-content:center; flex:1; min-width:0; height:22px; box-sizing:border-box; border:1px solid #6ee7b7; border-radius:4px; background:#ecfdf5; color:#047857; font-size:${fontSize}; font-weight:700; letter-spacing:${letterSpacing}; white-space:nowrap; overflow:hidden;" title="${text}">${text}</div>`;
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

    this.container.innerHTML = `
        <div class="calendar-grid" style="grid-template-columns: repeat(${this.isWeekendVisible ? 7 : 5}, 1fr);">${daysHeaderHtml}${paddingHtml}${daysHtml}</div>
    `;

    // 🌟 글로벌 필터 슬롯에 필터 HTML 주입
    const filterSlot = document.getElementById('global-unified-filter-slot');
    if (filterSlot) filterSlot.innerHTML = this.getUnifiedFilterHtml();
  }

  async renderEditor() {
    this.showLoading('월간 편집 시트를 불러오는 중...');

    if (this.container) {
        this.container.style.overflow = 'visible';
    }

    const y = store.currentDate.getFullYear();
    const m = store.currentDate.getMonth();
    const lastDate = new Date(y, m + 1, 0).getDate();
    const startStr = `${y}-${String(m+1).padStart(2, '0')}-01`;
    const endStr = `${y}-${String(m+1).padStart(2, '0')}-${String(lastDate).padStart(2, '0')}`;

    const { eMap, sMap } = await this.fetchMonthData(startStr, endStr);
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const masterLabels = getEventLabels(); 
    const maxP = store.periodNames ? store.periodNames.length : 6;

    if (!this.activeFilters) {
        this.activeFilters = ['personal', ...this.myGroups.map(g => g.id)];
    }

    const rowsHtml = Array.from({ length: lastDate }).map((_, i) => {
        const d = i + 1;
        const dateStr = `${y}-${String(m+1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const dayOfWeekNum = new Date(y, m, d).getDay();
        const dayOfWeek = dayNames[dayOfWeekNum];

        if (!this.isWeekendVisible && (dayOfWeekNum === 0 || dayOfWeekNum === 6)) return '';

        const eventList = eMap[dateStr]?.eventList || [];
        const periods = sMap[dateStr]?.[this.scheduleGroupId || 'personal'] || {};

        window[`tempEvents_${dateStr}`] = eventList.map(e => {
            let labelIds = e.labelIds || [];
            if (labelIds.length === 0 && (e.labels || e.label)) {
                (e.labels || [e.label]).forEach(name => {
                    const match = masterLabels.find(l => l.name === name);
                    if (match && match.id && !labelIds.includes(match.id)) labelIds.push(match.id);
                });
            }
            return { ...e, labelIds, sharedGroupId: e.sharedGroupId || null, groupName: e.groupName || '' };
        });
        window[`tempSchedules_${dateStr}`] = periods;
        
        const compactEditorHtml = `<div id="compact-events-${dateStr}" style="display:flex; flex-direction:column; gap:4px;">` + 
            this.generateCompactEventEditor(dateStr) + 
            `</div>`; 

        const isRed = isRedDay(dateStr, window[`tempEvents_${dateStr}`]);
        const dateColor = isRed ? '#ef4444' : (dayOfWeekNum === 6 ? '#3b82f6' : '#1e40af');
        const dateNumColor = isRed ? '#ef4444' : (dayOfWeekNum === 6 ? '#3b82f6' : '#475569');
        const holidayName = getHolidayName(dateStr);
        const holidayHtml = holidayName ? `<span style="font-size:0.75rem; color:#ef4444; font-weight:bold; margin-top:2px;">${holidayName}</span>` : '';

        const periodCellsHtml = Array.from({ length: maxP }).map((_, pi) => {
            const pObj = periods[pi + 1] || {};
            let cellText = "";
            if (pObj.subject && pObj.subject.toUpperCase() !== 'X') cellText += `[${pObj.subject}] `;
            if (pObj.memo) cellText += pObj.memo + " ";
            if (pObj.supplies) cellText += `[${pObj.supplies}]`;
            
            return `<td class="editable-cell edit-class-cell" data-p="${pi + 1}" contenteditable="true" style="padding:6px; border:1px solid #cbd5e1; font-size:1rem; color:#047857; background:#ecfdf5; vertical-align:top; white-space:pre-wrap; text-align:left;" oninput="window.monthViewInstance.syncScheduleInputs()">${cellText.trim()}</td>`;
        }).join('');

        return `
        <tr data-month-date="${dateStr}">
          <td rowspan="${store.showClass ? 2 : 1}" style="padding:8px 4px; border:1px solid #cbd5e1; background:#f8fafc; vertical-align:middle; width:80px; position: static !important; z-index: auto !important; transform: none !important;">
            <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
              <span onclick="window.goToDay('${dateStr}')" style="font-size:1.8rem; font-weight:900; color:${dateNumColor}; line-height:1; cursor:pointer;" title="${dateStr} 일 보기로 이동">${d}</span>
              <span style="font-size:1rem; font-weight:600; color:${dateColor}; line-height:1;">${dayOfWeek}</span>
              ${holidayHtml}
            </div>
          </td>
          <td style="padding:4px; border:1px solid #cbd5e1; background:#f0f9ff; color:#0369a1; font-weight:bold; font-size:0.9rem; vertical-align:middle; width:60px; text-align:center; position: static !important; z-index: auto !important; transform: none !important;">
              일정<br>
              <button onclick="window.monthViewInstance.addCompactEvent('${dateStr}')" style="margin-top:6px; background:#e0f2fe; color:#0369a1; border:1px dashed #7dd3fc; border-radius:4px; padding:2px 8px; cursor:pointer; font-weight:bold; font-size:1.1rem; box-shadow:0 1px 2px rgba(0,0,0,0.05);" title="일정 추가">+</button>
          </td>
          <td colspan="${maxP}" style="text-align:left; padding:6px 10px; background:#f0f9ff; vertical-align:top; position: static !important; z-index: auto !important; transform: none !important;">${compactEditorHtml}</td>
        </tr>
        <tr data-month-sub="${dateStr}" style="${store.showClass ? '' : 'display:none;'}">
          <td style="padding:4px; border:1px solid #cbd5e1; background:#ecfdf5; color:#047857; font-weight:bold; font-size:0.9rem; vertical-align:middle; width:60px; text-align:center; position: static !important; z-index: auto !important; transform: none !important;">수업</td>
          ${periodCellsHtml}
        </tr>`;
    }).join('');

    // 🌟 [에디터 모드] <th> 고정을 막기 위해 <td>와 <tbody>를 사용
    this.container.innerHTML = `
      <div class="table-container" style="background:#fff; padding:12px; border-radius:8px; overflow:visible;">
        <table id="month-editor-table" style="width:100%; border-collapse:collapse; text-align:center;">
          <tbody style="border-bottom: 2px solid #cbd5e1;">
            <tr style="background:#f1f5f9; position: static !important; transform: none !important;">
              <td style="width:80px; padding:8px; border:1px solid #cbd5e1; font-weight:bold; color:#1e293b; position: static !important; top: auto !important; z-index: auto !important;">날짜</td>
              <td style="width:60px; padding:8px; border:1px solid #cbd5e1; font-weight:bold; color:#1e293b; position: static !important; top: auto !important; z-index: auto !important;">구분</td>
              <td colspan="${maxP}" style="padding:8px; border:1px solid #cbd5e1; font-weight:bold; color:#1e293b; position: static !important; top: auto !important; z-index: auto !important;">📌 내용 (직접 수정)</td>
            </tr>
          </tbody>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>`;
      
    // 🌟 글로벌 필터 슬롯에 필터 HTML 주입
    const filterSlot = document.getElementById('global-unified-filter-slot');
    if (filterSlot) filterSlot.innerHTML = this.getUnifiedFilterHtml();
  }

  changeEventGroup(dateStr, idx, newGroupId) {
      this.syncCompactEventInputs(dateStr);
      store.hasUnsavedChanges = true;
      if (window[`tempEvents_${dateStr}`]?.[idx]) {
          window[`tempEvents_${dateStr}`][idx].sharedGroupId = newGroupId || null;
          const g = (this.myGroups || []).find(x => x.id === newGroupId);
          window[`tempEvents_${dateStr}`][idx].groupName = g ? g.name : '';
          
          const container = document.getElementById(`compact-events-${dateStr}`);
          if (container) {
              container.innerHTML = this.generateCompactEventEditor(dateStr);
          }
      }
  }

  generateCompactEventEditor(dateStr) {
      const list = window[`tempEvents_${dateStr}`] || [];
      const labelObjs = getEventLabels();
      const realTodayStr = formatDate(new Date());
      const uid = window.auth?.currentUser?.uid;
      const inst = 'window.monthViewInstance';
      
      const currentFilter = store.mode === 'editor' ? (this.scheduleGroupId || 'personal') : null;

      return list.map((e, idx) => {
          // 🌟 에디터 모드에서는 현재 선택된 작업공간만 보이도록 필터링
          const isVisible = store.mode === 'editor' 
              ? ((e.sharedGroupId || 'personal') === currentFilter) 
              : this.activeFilters.includes(e.sharedGroupId || 'personal');
              
          const displayStyle = isVisible ? 'display:flex;' : 'display:none;';
          const isAuthor = !e.authorId || !uid || e.authorId === uid;

          const eLabelIds = e.labelIds || [];
          const isCompleted = !!e.completed;
          const canComplete = eLabelIds.some(id => labelObjs.find(l => l.id === id)?.isForward);
          
          let groupButtonsHtml = '';
          if (isAuthor) {
              groupButtonsHtml = `
                  <div style="display:inline-flex; background:#f1f5f9; padding:2px; border-radius:6px; border:1px solid #cbd5e1; align-items:center;">
                      <div onclick="${inst}.changeEventGroup('${dateStr}', ${idx}, null)" style="padding:3px 8px; font-size:0.75rem; border-radius:4px; cursor:pointer; font-weight:bold; transition:0.2s; ${!e.sharedGroupId ? 'background:#fff; color:#2563eb; box-shadow:0 1px 3px rgba(0,0,0,0.1);' : 'color:#64748b;'}">🔒 개인</div>
                      ${(this.myGroups || []).map(g => `<div onclick="${inst}.changeEventGroup('${dateStr}', ${idx}, '${g.id}')" style="padding:3px 8px; font-size:0.75rem; border-radius:4px; cursor:pointer; font-weight:bold; transition:0.2s; ${e.sharedGroupId === g.id ? 'background:#fff; color:#2563eb; box-shadow:0 1px 3px rgba(0,0,0,0.1);' : 'color:#64748b;'}">👥 ${g.name}</div>`).join('')}
                  </div>
              `;
          } else {
              groupButtonsHtml = `<div style="padding:3px 8px; font-size:0.75rem; border-radius:4px; font-weight:bold; background:#e0f2fe; color:#0369a1; border:1px solid #bae6fd;">👥 ${e.groupName} (읽기전용)</div>`;
          }

          let warningIcon = '';
          if (canComplete) {
              if (!isCompleted && dateStr < realTodayStr) warningIcon = `<span style="color:#ef4444; font-weight:bold; font-size:0.8rem; margin-left:8px; align-self:center;">➡️ (미완료)</span>`;
              else if (e.originalDate && e.originalDate < dateStr) warningIcon = `<span style="color:#2563eb; font-weight:bold; font-size:0.8rem; margin-left:8px; align-self:center;">↪️ (이월됨)</span>`;
          }

          const chipsHtml = labelObjs.map(lObj => {
              const chipClickAttr = isAuthor ? `onclick="window.monthViewInstance.toggleCompactEventLabel('${dateStr}', ${idx}, '${lObj.id}')"` : '';
              const chipCursorStyle = isAuthor ? 'cursor:pointer;' : 'cursor:not-allowed; opacity:0.8;';
              return `<div class="label-chip ${eLabelIds.includes(lObj.id) ? 'active' : ''}" ${chipClickAttr} style="padding:2px 8px; font-size:0.8rem; min-width:auto; ${chipCursorStyle}">${lObj.name}</div>`;
          }).join('') + warningIcon;

          const checkboxHtml = canComplete 
              ? `<input type="checkbox" ${isCompleted ? 'checked' : ''} ${!isAuthor ? 'disabled' : ''} onchange="${inst}.updateCompactEvent('${dateStr}', ${idx}, 'completed', this.checked); document.getElementById('compact-events-${dateStr}').innerHTML = ${inst}.generateCompactEventEditor('${dateStr}');" style="width:18px; height:18px; cursor:pointer; accent-color:#059669;" title="완료 체크">`
              : '';

          const textBaseStyle = (isCompleted && canComplete) ? 'text-decoration:line-through; color:#94a3b8; background:#e2e8f0;' : 'background:#fff; color:#1e293b;';
          const textStyle = !isAuthor ? 'background:#f1f5f9; color:#64748b; cursor:not-allowed;' : textBaseStyle;
          const pureContent = (e.content || '').replace(/➡️\s*\(미완료\)/g, '').replace(/➡️\s*\(다음 날로 이월됨\)/g, '').replace(/↪️\s*/g, '').trim();

          const deleteBtnHtml = isAuthor 
                ? `<button onclick="${inst}.requestRemoveCompactEvent('${dateStr}', ${idx})" style="background:none; border:none; color:#ef4444; font-size:1.1rem; cursor:pointer; padding:0; line-height:1;" title="삭제">✖</button>`
                : '';

          return `
          <div class="compact-event-row" data-idx="${idx}" style="${displayStyle} border:1px solid #cbd5e1; border-radius:6px; padding:8px; margin-bottom:8px; background:#f8fafc; flex-direction:column; gap:6px; transition:0.2s;">
              <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                  <div class="label-chip-container" style="margin:0; display:flex; flex-wrap:wrap; gap:4px; align-items:center; flex:1;">
                      ${chipsHtml}
                  </div>
                  <div style="display:flex; align-items:center; gap:8px; flex-shrink:0;">
                      ${groupButtonsHtml}
                      ${deleteBtnHtml}
                  </div>
              </div>
              <div style="display:flex; align-items:flex-start; gap:8px; width:100%;">
                  ${checkboxHtml}
                  <textarea ${!isAuthor ? 'readonly' : ''} placeholder="${isAuthor ? '일정 내용을 입력하세요.' : '권한이 없습니다.'}" style="flex:1; padding:6px 8px; font-size:0.95rem; border:1px solid #cbd5e1; border-radius:4px; outline:none; resize:none; min-height:40px; box-sizing:border-box; ${textStyle}" onfocus="this.style.height = this.scrollHeight + 'px';" oninput="this.style.height = '40px'; this.style.height = this.scrollHeight + 'px'; ${inst}.updateCompactEvent('${dateStr}', ${idx}, 'content', this.value)">${pureContent}</textarea>
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
      document.querySelectorAll('[id^="compact-events-"]').forEach(el => {
          const dateStr = el.id.replace('compact-events-', '');
          this.syncCompactEventInputs(dateStr);
      });
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

  toggleCompactEventLabel(dateStr, idx, labelId) {
      const scopeInstance = window[`${store.scope}ViewInstance`];
      if (scopeInstance) scopeInstance.syncCompactEventInputs(dateStr);
      store.hasUnsavedChanges = true;
      
      const ev = window[`tempEvents_${dateStr}`]?.[idx];
      if (!ev) return;
      ev.labelIds = ev.labelIds || [];
      
      const isActive = ev.labelIds.includes(labelId);
      const labelObj = getEventLabels().find(l => l.id === labelId);

      if (isActive) {
          ev.labelIds = ev.labelIds.filter(id => id !== labelId);
      } else {
          if (labelObj?.isPeriod || labelObj?.isRecur) {
              const evContent = ev.content || '';
              const backupEvent = { ...ev };
              
              if (scopeInstance && typeof scopeInstance.syncScheduleInputs === 'function') {
                  scopeInstance.syncScheduleInputs();
              }

              window[`tempEvents_${dateStr}`].splice(idx, 1);
              window.saveCurrentViewData(true);
              
              const callback = (isSaved) => { 
                  if(isSaved) window.render(); 
                  else {
                      window[`tempEvents_${dateStr}`] = window[`tempEvents_${dateStr}`] || [];
                      window[`tempEvents_${dateStr}`].push(backupEvent);
                      window.saveCurrentViewData(true);
                      setTimeout(() => window.render(), 100);
                  }
              };

              labelObj.isPeriod 
                  ? window.openPeriodModal(dateStr, labelObj.name, evContent, callback, labelId)
                  : window.openRecurringModal(dateStr, labelObj.name, evContent, callback, labelId);
              return; 
          }
          
          if (labelObj?.isForward) {
              ev.labelIds = ev.labelIds.filter(id => {
                  const lObj = getEventLabels().find(x => x.id === id);
                  return !(lObj && (lObj.isPeriod || lObj.isRecur));
              });
          }
          ev.labelIds.push(labelId);
      }
      
      const container = document.getElementById(`compact-events-${dateStr}`);
      if (container && scopeInstance) {
          container.innerHTML = scopeInstance.generateCompactEventEditor(dateStr);
      }
  }

  updateCompactEvent(dateStr, idx, field, value) {
      store.hasUnsavedChanges = true;
      if (window[`tempEvents_${dateStr}`]?.[idx]) window[`tempEvents_${dateStr}`][idx][field] = value;
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
    if (this.isRendering) {
        alert('화면을 로딩 중입니다. 렌더링이 완료된 후 저장해 주세요.');
        return;
    }

    this.syncScheduleInputs(); 
    this.syncAllCompactEventInputs();

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
                .map(e => ({
                    ...e,
                    id: e.id || 'ev_' + Date.now() + Math.random().toString(36).substr(2,5),
                    authorId: e.authorId || window.auth?.currentUser?.uid
                }));
            const periodsData = JSON.parse(JSON.stringify(window[`tempSchedules_${dateStr}`] || {}));
            snapshot.push({ dateStr, validEvents, periodsData });
        }
    }

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
            eventText: window.formatEventListToText ? window.formatEventListToText(pEvents) : '',
            updatedAt: Date.now()
        }, { merge: true }).catch(e => console.warn(e));

        this.myGroups.forEach(g => {
            const gEvents = eventsByGroup[g.id];
            setDoc(doc(getGroupCol(g.id, 'events'), item.dateStr), {
                eventList: gEvents,
                eventText: window.formatEventListToText ? window.formatEventListToText(gEvents) : '',
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

MonthView.setupGoToDay();

const instance = new MonthView(document.getElementById("main-view"));
Object.assign(window, {
    monthViewInstance: instance,
    renderMonthViewer: (c) => { instance.container = c; instance.renderViewer(); },
    renderMonthEditor: (c) => { instance.container = c; instance.renderEditor(); },
    saveMonthDataFromEditor: () => instance.save()
});
