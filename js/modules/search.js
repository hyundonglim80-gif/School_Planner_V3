import { store } from '../core/store.js';
import { parseLocalDate, formatDate, getSemesterDates, getEventLabels, getJournalLabels, getLabelStyle } from '../core/utils.js';
import { getUserCol } from '../firebase.js';
import { LabelManager } from './labels.js';
import { getDocs } from "firebase/firestore";

export const SearchModule = {
  modalInstance: null,
  filterIdCounter: 0,
  
  getContentHTML: function() {
    return `
      <div class="modal-info-box">
         <h4 style="margin-top:0; margin-bottom:10px; color:#1e40af; border-bottom:1px solid #bfdbfe; padding-bottom:5px;">검색 조건 설정 (다중 항목 선택 가능)</h4>
         <p style="margin:0; margin-bottom:10px; font-size:0.85rem; color:#475569;">원하는 항목 버튼을 여러 개 클릭하여 켜고 끌 수 있습니다.</p>
         
         <div id="search-filters-container" style="display:flex; flex-direction:column; gap:12px; margin-bottom:15px;"></div>
         <button onclick="SearchModule.addFilter()" class="modal-btn-dashed" style="margin-top:0;">+ 다른 검색어 조건 추가 (AND / OR)</button>
      </div>

      <div class="modal-info-box alt">
         <h4 style="margin-top:0; margin-bottom:10px; color:#1e40af; border-bottom:1px solid #bfdbfe; padding-bottom:5px;">검색 기간 설정</h4>
         <div style="display:flex; flex-direction:column; gap:10px;">
           <div style="display:flex; align-items:center; gap:10px;">
             <span style="font-weight:bold; width:80px;">기간 범위:</span>
             <select id="search-scope-select" onchange="SearchModule.toggleCustomDateSearch()" style="flex:1; padding:8px; border-radius:4px; border:1px solid #cbd5e1; outline:none; background:#fff; font-size:1rem; font-weight:bold;">
               <option value="year">해당 학년도 전체 (모든 데이터 검색)</option>
               <option value="sem1">1학기 (3월 ~ 개학 전)</option>
               <option value="sem2">2학기 (개학 ~ 2월 말)</option>
               <option value="month">해당 월</option>
               <option value="week">해당 주</option>
               <option value="day">해당 일</option>
               <option value="custom">직접 지정(Custom)...</option>
             </select>
           </div>
           
           <div id="custom-date-inputs" style="display:none; align-items:center; gap:10px;">
             <span style="font-weight:bold; width:80px; color:#64748b;">직접 지정:</span>
             <input type="date" id="search-start-date" style="flex:1; padding:8px; border:1px solid #cbd5e1; border-radius:4px; outline:none;">
             <span style="font-weight:bold; color:#64748b;">~</span>
             <input type="date" id="search-end-date" style="flex:1; padding:8px; border:1px solid #cbd5e1; border-radius:4px; outline:none;">
           </div>
         </div>
      </div>

      <button onclick="SearchModule.executeSearch()" class="search-execute-btn">
        조건에 맞는 데이터 찾기
      </button>

      <div id="search-results-count" style="font-weight:bold; color:#0f172a; margin-bottom:10px; font-size:0.95rem;"></div>
      <div id="search-results-area" class="search-results-area"></div>
    `;
  },

  open: async function() {
    if (!this.modalInstance) {
      this.modalInstance = new window.Modal({
        id: 'search-modal-v2',
        title: '통합 고급 검색',
        width: '650px',
        content: this.getContentHTML()
      });
    }
    
    if (window.loadGlobalPreferences) await window.loadGlobalPreferences();
    this.modalInstance.open();
    
    const select = document.getElementById('search-scope-select');
    if(select) { 
        select.value = 'year'; 
        this.toggleCustomDateSearch(); 
    }

    const container = document.getElementById('search-filters-container');
    if (container) {
        container.innerHTML = ''; 
        this.filterIdCounter = 0;
        this.addFilter(); 
    }
    
    document.getElementById('search-results-count').innerText = '';
    const resultsArea = document.getElementById('search-results-area');
    if(resultsArea) resultsArea.innerHTML = `<p style="text-align:center; color:#94a3b8; padding:20px;">항목과 기간을 설정한 뒤 '데이터 찾기'를 눌러주세요.</p>`;
  },

  toggleCustomDateSearch: function() {
    const scope = document.getElementById('search-scope-select').value;
    const customInputs = document.getElementById('custom-date-inputs');
    if (scope === 'custom') {
      customInputs.style.display = 'flex';
    } else {
      customInputs.style.display = 'none';
    }
  },

  toggleFilterChip: function(clickedChip) {
    const container = clickedChip.parentElement;
    const val = clickedChip.dataset.val;

    if (val === 'all') {
      const isNowActive = !clickedChip.classList.contains('active');
      container.querySelectorAll('.label-chip').forEach(chip => {
        if (isNowActive) chip.classList.add('active');
        else chip.classList.remove('active');
      });
    } else {
      clickedChip.classList.toggle('active');
      const allChip = container.querySelector('[data-val="all"]');
      const otherChips = Array.from(container.querySelectorAll('.label-chip:not([data-val="all"])'));
      
      const allActive = otherChips.every(c => c.classList.contains('active'));
      if (allActive) allChip.classList.add('active');
      else allChip.classList.remove('active');
    }
  },

  addFilter: function() {
    const container = document.getElementById('search-filters-container');
    if (!container) return;
    
    const filterRow = document.createElement('div');
    filterRow.className = 'modal-input-row alt search-filter-row';
    filterRow.style.flexDirection = 'column';
    filterRow.style.alignItems = 'stretch';
    filterRow.style.gap = '8px';
    
    const logicHTML = this.filterIdCounter > 0 
        ? `<select class="filter-logic" style="padding:4px 6px; border-radius:4px; border:1px solid #cbd5e1; outline:none; background:#f8fafc; font-weight:bold; color:#0f172a; cursor:pointer; flex-shrink:0;">
             <option value="AND">AND</option>
             <option value="OR">OR</option>
           </select>`
        : `<input type="hidden" class="filter-logic" value="AND">`; 

    const deleteBtnHTML = this.filterIdCounter > 0 
        ? `<button onclick="this.closest('.search-filter-row').remove()" class="modal-delete-btn" title="조건 삭제" style="flex-shrink:0; margin:0;">✖</button>`
        : ``;

    // 버튼 크기를 줄이고 한 줄에 담기 위해 인라인 스타일(padding, font-size, margin:0, nowrap) 적용
    filterRow.innerHTML = `
         <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
             <div class="filter-type-chips label-chip-container" style="margin:0; flex:1; display:flex; gap:4px; flex-wrap:nowrap; overflow-x:auto;">
               <span class="label-chip active" data-val="all" onclick="SearchModule.toggleFilterChip(this)" style="padding:3px 6px; font-size:0.75rem; margin:0; white-space:nowrap;">전체</span>
               <span class="label-chip active" data-val="task" onclick="SearchModule.toggleFilterChip(this)" style="padding:3px 6px; font-size:0.75rem; margin:0; white-space:nowrap;">메모</span>
               <span class="label-chip active" data-val="event" onclick="SearchModule.toggleFilterChip(this)" style="padding:3px 6px; font-size:0.75rem; margin:0; white-space:nowrap;">일정</span>
               <span class="label-chip active" data-val="journal" onclick="SearchModule.toggleFilterChip(this)" style="padding:3px 6px; font-size:0.75rem; margin:0; white-space:nowrap;">기록</span>
               <span class="label-chip active" data-val="subject" onclick="SearchModule.toggleFilterChip(this)" style="padding:3px 6px; font-size:0.75rem; margin:0; white-space:nowrap;">수업</span>
               <span class="label-chip active" data-val="memo" onclick="SearchModule.toggleFilterChip(this)" style="padding:3px 6px; font-size:0.75rem; margin:0; white-space:nowrap;">메모(수업)</span>
               <span class="label-chip active" data-val="supplies" onclick="SearchModule.toggleFilterChip(this)" style="padding:3px 6px; font-size:0.75rem; margin:0; white-space:nowrap;">비고</span>
               <span class="label-chip active" data-val="eval" onclick="SearchModule.toggleFilterChip(this)" style="padding:3px 6px; font-size:0.75rem; margin:0; white-space:nowrap;">조사표명</span>
             </div>
             <div style="display:flex; gap:6px; align-items:center; margin-left:8px; flex-shrink:0;">
                 ${logicHTML}
                 ${deleteBtnHTML}
             </div>
         </div>
         <input type="text" class="filter-keyword modal-input-text" placeholder="검색어 키워드 입력 후 엔터(Enter)..." style="width:100%;" onkeydown="if(event.key === 'Enter') { SearchModule.executeSearch(); event.preventDefault(); }">
    `;
    container.appendChild(filterRow);
    this.filterIdCounter++;
  },

  getSearchTargetDates: function() {
    const targetScope = document.getElementById('search-scope-select').value;
    const dates = [];
    const datesInfo = getSemesterDates(); 

    if (targetScope === 'year') {
      return 'ALL'; 
    }

    if (targetScope === 'custom') {
      const startStr = document.getElementById('search-start-date').value;
      const endStr = document.getElementById('search-end-date').value;
      if (!startStr || !endStr) { alert('검색할 시작 날짜와 종료 날짜를 모두 지정해주세요.'); return []; }
      
      let curDate = parseLocalDate(startStr);
      const endDate = parseLocalDate(endStr);
      if (curDate > endDate) { alert('시작 날짜가 종료 날짜보다 늦을 수 없습니다.'); return []; }
      
      while (curDate <= endDate) {
        dates.push({ dateStr: formatDate(curDate) });
        curDate.setDate(curDate.getDate() + 1);
      }
      return dates;
    }

    const pushDate = (dateObj) => dates.push({ dateStr: formatDate(dateObj) });

    if (targetScope === 'day') {
      pushDate(store.currentDate);
    } else if (targetScope === 'week') {
      const tempDate = new Date(store.currentDate);
      const diffToSun = tempDate.getDate() - tempDate.getDay();
      tempDate.setDate(diffToSun);
      for (let i = 0; i < 7; i++) {
        if (!store.showWeekend && (i === 0 || i === 6)) { tempDate.setDate(tempDate.getDate() + 1); continue; }
        pushDate(tempDate);
        tempDate.setDate(tempDate.getDate() + 1);
      }
    } else if (targetScope === 'month') {
      const curY = store.currentDate.getFullYear();
      const curM = store.currentDate.getMonth();
      const lastDate = new Date(curY, curM + 1, 0).getDate();
      for (let i = 1; i <= lastDate; i++) pushDate(new Date(curY, curM, i));
    } else if (targetScope === 'sem1') {
      let cur = new Date(datesInfo.sem1Start); 
      while (cur <= datesInfo.sem1End) { pushDate(new Date(cur)); cur.setDate(cur.getDate() + 1); }
    } else if (targetScope === 'sem2') {
      let cur = new Date(datesInfo.sem2Start); 
      while (cur <= datesInfo.sem2End) { pushDate(new Date(cur)); cur.setDate(cur.getDate() + 1); }
    }
    return dates;
  },

  executeSearch: async function() {
    const rows = document.querySelectorAll('.search-filter-row');
    const searchConditions = [];
    let allKeywords = [];
    
    rows.forEach(row => {
      const logic = row.querySelector('.filter-logic').value;
      const keyword = row.querySelector('.filter-keyword').value.trim().toLowerCase();
      const activeChips = Array.from(row.querySelectorAll('.filter-type-chips .label-chip.active'));
      const types = activeChips.map(c => c.dataset.val);
      
      if (types.length === 0) {
          alert("검색할 항목(일정, 기록 등)을 하나 이상 켜주세요.");
          return;
      }
      
      if (keyword) {
        searchConditions.push({ logic, types, keyword });
        allKeywords.push(keyword);
      }
    });

    if (searchConditions.length === 0) return alert("검색어를 한 글자 이상 입력해 주세요.");
    allKeywords = [...new Set(allKeywords)]; 

    const resultList = document.getElementById('search-results-area');
    const countText = document.getElementById('search-results-count');
    resultList.innerHTML = `<p style="text-align:center; color:#64748b; font-weight:bold; padding:30px;">⏳ 클라우드에서 데이터를 분석 중입니다...</p>`;
    countText.innerText = '';

    try {
        const [eventSnap, scheduleSnap, journalSnap, taskSnap, evalSnap] = await Promise.all([
            getDocs(getUserCol('events')),
            getDocs(getUserCol('schedules')),
            getDocs(getUserCol('journals')),
            getDocs(getUserCol('tasks')),
            getDocs(getUserCol('evaluations'))
        ]);
        
        let memoSnap = [];
        try { memoSnap = await getDocs(getUserCol('memos')); } catch(e) {}

        const masterEventLabels = getEventLabels();
        const masterJournalLabels = getJournalLabels();
        const masterMemoLabels = LabelManager ? LabelManager.getMemoLabels() : [];

        const taskList = [];
        const processMemoData = (docSnap, data) => {
            const arrayFields = ['tasks', 'memos', 'entries', 'list', 'items'];
            let hasArray = false;
            for (let field of arrayFields) {
                if (data[field] && Array.isArray(data[field])) {
                    hasArray = true;
                    data[field].forEach(item => {
                        if (item) {
                            const content = item.content || item.text || item.memo || item.title || '';
                            if (content.trim()) {
                                let labelNames = [];
                                if (item.labelIds) {
                                    labelNames = item.labelIds.map(id => {
                                        const lObj = masterMemoLabels.find(l => l.id === id || l.name === id);
                                        return lObj ? lObj.name : id;
                                    });
                                } else if (item.labels) {
                                    labelNames = item.labels;
                                } else if (item.label) {
                                    labelNames = [item.label];
                                }
                                
                                taskList.push({
                                    id: item.id || docSnap.id,
                                    content: content,
                                    labelNames: labelNames,
                                    completed: !!(item.completed || item.isDone || item.done || item.checked)
                                });
                            }
                        }
                    });
                }
            }
            
            if (!hasArray) {
                let contentParts = [];
                if (data.content) contentParts.push(data.content);
                if (data.text) contentParts.push(data.text);
                if (data.memo) contentParts.push(data.memo);
                if (data.title) contentParts.push(data.title);
                
                if (contentParts.length === 0) {
                    for (const key in data) {
                        if (typeof data[key] === 'string' && key !== 'id' && key !== 'createdAt' && key !== 'updatedAt') {
                            contentParts.push(data[key]);
                        }
                    }
                }
                
                const content = contentParts.join(' ');
                if (content.trim()) {
                    let labelNames = [];
                    if (data.labelIds) {
                        labelNames = data.labelIds.map(id => {
                            const lObj = masterMemoLabels.find(l => l.id === id || l.name === id);
                            return lObj ? lObj.name : id;
                        });
                    } else if (data.labels) {
                        labelNames = data.labels;
                    } else if (data.label) {
                        labelNames = [data.label];
                    }

                    taskList.push({
                        id: docSnap.id,
                        content: content,
                        labelNames: labelNames,
                        completed: !!(data.completed || data.isDone || data.done || data.checked)
                    });
                }
            }
        };

        try { taskSnap.forEach(docSnap => processMemoData(docSnap, docSnap.data())); } catch(e) {}
        try { memoSnap.forEach(docSnap => processMemoData(docSnap, docSnap.data())); } catch(e) {}

        const eventMap = {};
        eventSnap.forEach(docSnap => { 
            const data = docSnap.data();
            let text = '';
            let items = [];
            
            if (data.eventList && Array.isArray(data.eventList)) {
                items = data.eventList;
                text = data.eventList.map(e => {
                    let lNames = [];
                    if (e.labelIds) {
                        lNames = e.labelIds.map(id => {
                            const lObj = masterEventLabels.find(l => l.id === id || l.name === id);
                            return lObj ? lObj.name : id;
                        });
                    } else if (e.labels) {
                        lNames = e.labels;
                    } else if (e.label) {
                        lNames = [e.label];
                    }
                    
                    let lStr = lNames.length > 0 && lNames[0] !== '기타' ? `[${lNames.join(',')}] ` : '';
                    e.parsedLabelNames = lNames; 
                    return `${lStr}${e.content || ''}`;
                }).join(' / ');
            } else {
                text = data.eventText || '';
                if(text) items = [{content: text, parsedLabelNames: []}];
            }
            text = text.replace(/\[\]\s*/g, '').trim(); 
            eventMap[docSnap.id] = { text: text, items: items }; 
        });
        
        const scheduleMap = {};
        scheduleSnap.forEach(docSnap => { scheduleMap[docSnap.id] = docSnap.data().periods || {}; });
        
        const journalMap = {};
        journalSnap.forEach(docSnap => { journalMap[docSnap.id] = docSnap.data().entries || []; });

        const evalMap = {};
        evalSnap.forEach(docSnap => { evalMap[docSnap.id] = docSnap.data().evalList || []; });

        const targetDatesObj = this.getSearchTargetDates();
        let validDates = [];
        
        if (targetDatesObj === 'ALL') {
            const allSet = new Set([...Object.keys(eventMap), ...Object.keys(scheduleMap), ...Object.keys(journalMap), ...Object.keys(evalMap)]);
            validDates = Array.from(allSet);
        } else {
            validDates = targetDatesObj.map(item => item.dateStr);
        }

        const checkMatch = (text, keyword) => {
          if (!text) return false;
          return text.toLowerCase().includes(keyword);
        };

        const matchedResults = [];
        const maxPeriod = window.periodNames ? window.periodNames.length : 6;

        validDates.forEach(dateStr => {
          const dayEventObj = eventMap[dateStr] || {text: '', items: []};
          const dayEvent = dayEventObj.text;
          const dayPeriods = scheduleMap[dateStr] || {};
          const dayJournals = journalMap[dateStr] || [];
          const dayEvals = evalMap[dateStr] || [];
          
          let daySubjectText = []; let dayMemoText = []; let daySuppliesText = [];
          
          let dayJournalText = dayJournals.map(j => {
            let lNames = [];
            if (j.labelIds) {
                lNames = j.labelIds.map(id => {
                    const lObj = masterJournalLabels.find(l => l.id === id || l.name === id);
                    return lObj ? lObj.name : id;
                });
            } else if (j.labels) {
                lNames = j.labels;
            } else if (j.label) {
                lNames = [j.label];
            }
            j.parsedLabelNames = lNames; 
            let lStr = lNames.length > 0 ? lNames.join(', ') : '';
            return `[${lStr}] ${j.content}`;
          }).join(' ');

          let dayEvalText = dayEvals.map(e => e.title || '').join(' ');

          for (let p = 1; p <= maxPeriod; p++) {
            if (dayPeriods[p]) {
              if(dayPeriods[p].subject) daySubjectText.push(dayPeriods[p].subject);
              if(dayPeriods[p].memo) dayMemoText.push(dayPeriods[p].memo);
              if(dayPeriods[p].supplies) daySuppliesText.push(dayPeriods[p].supplies);
            }
          }

          const textMap = {
            'all': [dayEvent, daySubjectText.join(' '), dayMemoText.join(' '), daySuppliesText.join(' '), dayJournalText, dayEvalText].join(' '),
            'event': dayEvent,
            'journal': dayJournalText,
            'subject': daySubjectText.join(' '),
            'memo': dayMemoText.join(' '),
            'supplies': daySuppliesText.join(' '),
            'eval': dayEvalText, 
            'task': '' 
          };

          let isMatch = false;
          if (searchConditions.length > 0) {
              let currentResult = false;
              
              searchConditions[0].types.forEach(t => {
                  if (t === 'all') currentResult = currentResult || checkMatch(textMap['all'], searchConditions[0].keyword);
                  else currentResult = currentResult || checkMatch(textMap[t], searchConditions[0].keyword);
              });
              
              for (let i = 1; i < searchConditions.length; i++) {
                  const cond = searchConditions[i];
                  const prevLogic = searchConditions[i - 1].logic;
                  
                  let matchThisCond = false;
                  cond.types.forEach(t => {
                      if (t === 'all') matchThisCond = matchThisCond || checkMatch(textMap['all'], cond.keyword);
                      else matchThisCond = matchThisCond || checkMatch(textMap[t], cond.keyword);
                  });
                  
                  if (prevLogic === 'AND') {
                      currentResult = currentResult && matchThisCond;
                  } else if (prevLogic === 'OR') {
                      currentResult = currentResult || matchThisCond;
                  }
              }
              isMatch = currentResult;
          }

          if (isMatch) matchedResults.push({ dateStr, dayEventObj, dayPeriods, dayJournals, dayEvals });
        });

        const matchedTasks = [];
        taskList.forEach(task => {
          const taskText = [task.content, (task.labelNames || []).join(' ')].join(' ');
          const taskTextMap = {
            'all': taskText,
            'task': taskText,
            'event': '', 'journal': '', 'subject': '', 'memo': '', 'supplies': '', 'eval': ''
          };

          let isMatch = false;
          if (searchConditions.length > 0) {
            let currentResult = false;
            
            searchConditions[0].types.forEach(t => {
                if (t === 'all' || t === 'task') currentResult = currentResult || checkMatch(taskTextMap[t], searchConditions[0].keyword);
            });
            
            for (let i = 1; i < searchConditions.length; i++) {
              const cond = searchConditions[i];
              const prevLogic = searchConditions[i - 1].logic;
              
              let matchThisCond = false;
              cond.types.forEach(t => {
                  if (t === 'all' || t === 'task') matchThisCond = matchThisCond || checkMatch(taskTextMap[t], cond.keyword);
              });
              
              if (prevLogic === 'AND') currentResult = currentResult && matchThisCond;
              else if (prevLogic === 'OR') currentResult = currentResult || matchThisCond;
            }
            isMatch = currentResult;
          }
          if (isMatch) matchedTasks.push(task);
        });

        matchedResults.sort((a, b) => b.dateStr.localeCompare(a.dateStr));

        const highlight = (text) => {
          if (!text) return '';
          let res = text;
          allKeywords.forEach(k => {
            const safeK = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`(${safeK})`, 'gi');
            res = res.replace(regex, `<mark style="background-color:#fef08a; padding:0 2px; border-radius:3px; font-weight:bold; color:#1e293b;">$1</mark>`);
          });
          return res;
        };

        const totalCount = matchedResults.length + matchedTasks.length;
        countText.innerText = `총 ${totalCount}건의 데이터를 찾았습니다.`;
        
        if (totalCount === 0) {
          resultList.innerHTML = `<p style="text-align:center; color:#ef4444; font-size:1.1rem; padding:30px; font-weight:bold;">지정한 조건에 일치하는 결과가 없습니다.</p>`;
          return;
        }

        const tasksHtml = matchedTasks.map(task => {
            const labelsHtml = (task.labelNames || []).map(l => {
              const style = getLabelStyle ? getLabelStyle(l, 'memo') : { bg: '#dcfce7', text: '#166534', border: '#86efac' };
              return `<span style="display:inline-block; font-weight:bold; color:${style.text}; background:${style.bg}; padding:2px 8px; border-radius:12px; margin-right:6px; font-size:0.85rem; border:1px solid ${style.border};">${l}</span>`;
            }).join('');

            const textStyle = task.completed ? 'text-decoration:line-through; color:#94a3b8;' : 'color:#1e293b;';
            const statusText = task.completed ? '[완료]' : '[진행 중]';
            const statusColor = task.completed ? '#64748b' : '#ef4444';

            return `
              <div class="search-result-card" onclick="window.targetMemoId='${task.id}'; window.setScope('memo'); SearchModule.modalInstance.close();" style="border-left: 5px solid #10b981;">
                <div style="font-size:1.05rem; font-weight:900; color:#059669; border-bottom:1px solid #e2e8f0; padding-bottom:6px; margin-bottom:6px; display:flex; justify-content:space-between;">
                  <span>[메모]</span>
                  <span style="font-size:0.85rem; font-weight:bold; color:${statusColor};">${statusText}</span>
                </div>
                <div style="margin-bottom:6px;">${labelsHtml}</div>
                <div style="font-size:0.95rem; white-space:pre-wrap; ${textStyle}">${highlight(task.content)}</div>
              </div>`;
        }).join('');

        const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
        const datesHtml = matchedResults.map(res => {
          const dObj = parseLocalDate(res.dateStr);
          const dayName = dayNames[dObj.getDay()];
          const dateColor = dObj.getDay() === 0 ? '#ef4444' : dObj.getDay() === 6 ? '#3b82f6' : '#1e40af';

          let cardHtml = `
            <div class="search-result-card" onclick="window.goToDay('${res.dateStr}'); SearchModule.modalInstance.close();">
              <div style="font-size:1.1rem; font-weight:900; color:${dateColor}; border-bottom:1px solid #e2e8f0; padding-bottom:8px; margin-bottom:8px;">
                ${res.dateStr.replace(/-/g, '. ')} (${dayName})
              </div>`;

          if (res.dayEventObj && res.dayEventObj.items && res.dayEventObj.items.length > 0) {
            cardHtml += res.dayEventObj.items.map(e => {
              if (!e.content) return '';
              const lNames = e.parsedLabelNames || [];
              const lStr = lNames.join(', ');
              const mainLabel = lNames.length > 0 ? lNames[0] : '';
              const style = getLabelStyle ? getLabelStyle(mainLabel, 'event') : { bg: '#f0f9ff', text: '#0369a1', border: '#bae6fd' };
              
              return `
              <div style="display:flex; flex-direction:column; background:${style.bg}; padding:8px; border-radius:6px; margin-bottom:6px; border:1px dashed ${style.border};">
                <div style="font-weight:bold; color:${style.text}; margin-bottom:4px;">일정${lStr && lStr !== '기타' ? `(${highlight(lStr)})` : ''}:</div>
                <div style="font-size:0.95rem; color:#1e293b; white-space:pre-wrap;">${highlight(e.content)}</div>
              </div>`;
            }).join('');
          }

          for (let p = 1; p <= maxPeriod; p++) {
            const pData = res.dayPeriods[p];
            if (pData && (pData.subject || pData.memo || pData.supplies)) {
              const pName = window.periodNames ? window.periodNames[p-1] : p+'교시';
              cardHtml += `
              <div style="display:flex; flex-direction:column; background:#f8fafc; padding:8px; border-radius:6px; margin-bottom:6px; border:1px dashed #cbd5e1;">
                <div style="font-weight:bold; color:#0f172a; margin-bottom:4px;">${pName}: ${highlight(pData.subject)}</div>
                ${pData.memo ? `<div style="font-size:0.9rem; color:#475569; margin-bottom:2px;">수업 메모: ${highlight(pData.memo)}</div>` : ''}
                ${pData.supplies ? `<div style="font-size:0.9rem; color:#b45309;">비고: ${highlight(pData.supplies)}</div>` : ''}
              </div>`;
            }
          }
          
          if (res.dayJournals && res.dayJournals.length > 0) {
            cardHtml += res.dayJournals.map(j => {
              if (j.content || (j.parsedLabelNames && j.parsedLabelNames.length > 0)) {
                const lNames = j.parsedLabelNames || [];
                const lStr = lNames.join(', ');
                const mainLabel = lNames.length > 0 ? lNames[0] : '기타';
                const style = getLabelStyle ? getLabelStyle(mainLabel, 'journal') : { bg: '#fdf2f8', text: '#9d174d', border: '#fbcfe8' };
                
                return `
                <div style="display:flex; flex-direction:column; background:${style.bg}; padding:8px; border-radius:6px; margin-bottom:6px; border:1px dashed ${style.border};">
                  <div style="font-weight:bold; color:${style.text}; margin-bottom:4px;">기록${lStr && lStr !== '기타' ? `(${highlight(lStr)})` : ''}:</div>
                  <div style="font-size:0.95rem; color:#1e293b; white-space:pre-wrap;">${highlight(j.content)}</div>
                </div>`;
              }
              return '';
            }).join('');
          }

          if (res.dayEvals && res.dayEvals.length > 0) {
            cardHtml += res.dayEvals.map(e => {
              if (!e.title) return '';
              let badgeType = '';
              if (e.type === 'eval') badgeType = e.subject || '평가';
              else if (e.type === 'check') badgeType = '체크';
              else if (e.type === 'memo') badgeType = '메모';
              else badgeType = '기타';

              return `
              <div style="display:flex; flex-direction:column; background:#eff6ff; padding:8px; border-radius:6px; margin-bottom:6px; border:1px dashed #bfdbfe;">
                <div style="font-weight:bold; color:#1e40af; margin-bottom:4px;">📊 조사표 [${badgeType}]:</div>
                <div style="font-size:0.95rem; color:#1e293b; white-space:pre-wrap;">${highlight(e.title)}</div>
              </div>`;
            }).join('');
          }

          cardHtml += `</div>`;
          return cardHtml;
        }).join('');

        resultList.innerHTML = tasksHtml + datesHtml;
        
    } catch(e) {
        console.error("검색 오류", e);
        resultList.innerHTML = '<p style="color:#ef4444; text-align:center; font-weight:bold;">검색 중 오류가 발생했습니다.</p>';
    }
  }
};

window.SearchModule = SearchModule;
window.openSearchModal = () => SearchModule.open();
