// js/modules/search.js

const SearchModule = {
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
               <option value="year">해당 학년도 전체</option>
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
    
    await window.loadGlobalPreferences();
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
        ? `<select class="filter-logic" style="padding:6px; border-radius:4px; border:1px solid #cbd5e1; outline:none; background:#f8fafc; font-weight:bold; color:#0f172a; cursor:pointer; flex-shrink:0;">
             <option value="AND">AND</option>
             <option value="OR">OR</option>
           </select>`
        : `<input type="hidden" class="filter-logic" value="AND">`; 

    const deleteBtnHTML = this.filterIdCounter > 0 
        ? `<button onclick="this.closest('.search-filter-row').remove()" class="modal-delete-btn" title="조건 삭제" style="flex-shrink:0;">✖</button>`
        : ``;

    filterRow.innerHTML = `
         <div style="display:flex; justify-content:space-between; align-items:flex-start; width:100%;">
             <div class="filter-type-chips label-chip-container" style="margin:0; flex:1;">
               <span class="label-chip active" data-val="all" onclick="SearchModule.toggleFilterChip(this)">전체</span>
               <span class="label-chip active" data-val="task" onclick="SearchModule.toggleFilterChip(this)">메모</span>
               <span class="label-chip active" data-val="event" onclick="SearchModule.toggleFilterChip(this)">일정</span>
               <span class="label-chip active" data-val="journal" onclick="SearchModule.toggleFilterChip(this)">기록</span>
               <span class="label-chip active" data-val="subject" onclick="SearchModule.toggleFilterChip(this)">수업</span>
               <span class="label-chip active" data-val="memo" onclick="SearchModule.toggleFilterChip(this)">메모(수업)</span>
               <span class="label-chip active" data-val="supplies" onclick="SearchModule.toggleFilterChip(this)">비고</span>
             </div>
             <div style="display:flex; gap:8px; align-items:center; margin-left:10px;">
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
    const datesInfo = window.getSemesterDates(); 

    if (targetScope === 'custom') {
      const startStr = document.getElementById('search-start-date').value;
      const endStr = document.getElementById('search-end-date').value;
      if (!startStr || !endStr) { alert('검색할 시작 날짜와 종료 날짜를 모두 지정해주세요.'); return []; }
      
      let curDate = window.parseLocalDate(startStr);
      const endDate = window.parseLocalDate(endStr);
      if (curDate > endDate) { alert('시작 날짜가 종료 날짜보다 늦을 수 없습니다.'); return []; }
      
      while (curDate <= endDate) {
        dates.push({ dateStr: window.formatDate(curDate) });
        curDate.setDate(curDate.getDate() + 1);
      }
      return dates;
    }

    const pushDate = (dateObj) => dates.push({ dateStr: window.formatDate(dateObj) });

    if (targetScope === 'day') {
      pushDate(window.currentDate);
    } else if (targetScope === 'week') {
      const tempDate = new Date(window.currentDate);
      const diffToSun = tempDate.getDate() - tempDate.getDay();
      tempDate.setDate(diffToSun);
      for (let i = 0; i < 7; i++) {
        if (!window.showWeekend && (i === 0 || i === 6)) { tempDate.setDate(tempDate.getDate() + 1); continue; }
        pushDate(tempDate);
        tempDate.setDate(tempDate.getDate() + 1);
      }
    } else if (targetScope === 'month') {
      const curY = window.currentDate.getFullYear();
      const curM = window.currentDate.getMonth();
      const lastDate = new Date(curY, curM + 1, 0).getDate();
      for (let i = 1; i <= lastDate; i++) pushDate(new Date(curY, curM, i));
    } else if (targetScope === 'year') {
      let cur = new Date(datesInfo.yearStart);
      while (cur <= datesInfo.yearEnd) { pushDate(new Date(cur)); cur.setDate(cur.getDate() + 1); }
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
        const eventSnap = await window.getUserCol('events').get();
        const scheduleSnap = await window.getUserCol('schedules').get();
        const journalSnap = await window.getUserCol('journals').get();
        const taskSnap = await window.getUserCol('tasks').get(); 

        const masterEventLabels = window.getEventLabels();
        const masterJournalLabels = window.getJournalLabels();
        const masterMemoLabels = window.LabelManager ? window.LabelManager.getMemoLabels() : [];

        // 메모(Tasks) 파싱 (ID 호환 지원)
        const taskList = [];
        const processMemoData = (doc, data) => {
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
                                    id: item.id || doc.id,
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
                        id: doc.id,
                        content: content,
                        labelNames: labelNames,
                        completed: !!(data.completed || data.isDone || data.done || data.checked)
                    });
                }
            }
        };

        try { taskSnap.forEach(doc => processMemoData(doc, doc.data())); } catch(e) {}
        try { const memoSnap = await window.getUserCol('memos').get(); memoSnap.forEach(doc => processMemoData(doc, doc.data())); } catch(e) {}

        // 일정(Events) 파싱 (ID 호환 지원)
        const eventMap = {};
        eventSnap.forEach(doc => { 
            const data = doc.data();
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
                    e.parsedLabelNames = lNames; // 임시 저장
                    return `${lStr}${e.content}`;
                }).join(' / ');
            } else {
                text = data.eventText || '';
                if(text) items = [{content: text, parsedLabelNames: []}];
            }
            text = text.replace(/\[\]\s*/g, '').trim(); 
            eventMap[doc.id] = { text: text, items: items }; 
        });
        
        const scheduleMap = {};
        scheduleSnap.forEach(doc => { scheduleMap[doc.id] = doc.data().periods || {}; });
        
        // 기록(Journals) 파싱
        const journalMap = {};
        journalSnap.forEach(doc => { journalMap[doc.id] = doc.data().entries || []; });

        const targetDatesObj = this.getSearchTargetDates();
        const validDates = targetDatesObj.map(item => item.dateStr);

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
            j.parsedLabelNames = lNames; // 임시 저장
            let lStr = lNames.length > 0 ? lNames.join(', ') : '';
            return `[${lStr}] ${j.content}`;
          }).join(' ');

          for (let p = 1; p <= maxPeriod; p++) {
            if (dayPeriods[p]) {
              if(dayPeriods[p].subject) daySubjectText.push(dayPeriods[p].subject);
              if(dayPeriods[p].memo) dayMemoText.push(dayPeriods[p].memo);
              if(dayPeriods[p].supplies) daySuppliesText.push(dayPeriods[p].supplies);
            }
          }

          const textMap = {
            'all': [dayEvent, daySubjectText.join(' '), dayMemoText.join(' '), daySuppliesText.join(' '), dayJournalText].join(' '),
            'event': dayEvent,
            'journal': dayJournalText,
            'subject': daySubjectText.join(' '),
            'memo': dayMemoText.join(' '),
            'supplies': daySuppliesText.join(' '),
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

          if (isMatch) matchedResults.push({ dateStr, dayEventObj, dayPeriods, dayJournals });
        });

        // 태스크(메모) 검색 체크
        const matchedTasks = [];
        taskList.forEach(task => {
          const taskText = [task.content, (task.labelNames || []).join(' ')].join(' ');
          const taskTextMap = {
            'all': taskText,
            'task': taskText,
            'event': '', 'journal': '', 'subject': '', 'memo': '', 'supplies': ''
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
        resultList.innerHTML = '';

        if (totalCount === 0) {
          resultList.innerHTML = `<p style="text-align:center; color:#ef4444; font-size:1.1rem; padding:30px; font-weight:bold;">지정한 조건에 일치하는 결과가 없습니다.</p>`;
          return;
        }

        // 결과 렌더링: 메모(Tasks)
        if (matchedTasks.length > 0) {
          matchedTasks.forEach(task => {
            const labelsHtml = (task.labelNames || []).map(l => {
              const style = window.getLabelStyle ? window.getLabelStyle(l, 'memo') : { bg: '#dcfce7', text: '#166534', border: '#86efac' };
              return `<span style="display:inline-block; font-weight:bold; color:${style.text}; background:${style.bg}; padding:2px 8px; border-radius:12px; margin-right:6px; font-size:0.85rem; border:1px solid ${style.border};">${l}</span>`;
            }).join('');

            const textStyle = task.completed ? 'text-decoration:line-through; color:#94a3b8;' : 'color:#1e293b;';
            const statusText = task.completed ? '[완료]' : '[진행 중]';
            const statusColor = task.completed ? '#64748b' : '#ef4444';

            let taskCardHtml = `
              <div class="search-result-card" onclick="window.setScope('memo'); window.ModalManager ? window.ModalManager.closeTop() : SearchModule.modalInstance.close();" style="border-left: 5px solid #10b981;">
                <div style="font-size:1.05rem; font-weight:900; color:#059669; border-bottom:1px solid #e2e8f0; padding-bottom:6px; margin-bottom:6px; display:flex; justify-content:space-between;">
                  <span>[메모]</span>
                  <span style="font-size:0.85rem; font-weight:bold; color:${statusColor};">${statusText}</span>
                </div>
                <div style="margin-bottom:6px;">${labelsHtml}</div>
                <div style="font-size:0.95rem; white-space:pre-wrap; ${textStyle}">${highlight(task.content)}</div>
              </div>
            `;
            resultList.innerHTML += taskCardHtml;
          });
        }

        const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
        matchedResults.forEach(res => {
          const dObj = window.parseLocalDate(res.dateStr);
          const dayName = dayNames[dObj.getDay()];
          const dateColor = dObj.getDay() === 0 ? '#ef4444' : dObj.getDay() === 6 ? '#3b82f6' : '#1e40af';

          let cardHtml = `
            <div class="search-result-card" onclick="window.goToDay('${res.dateStr}'); window.ModalManager ? window.ModalManager.closeTop() : SearchModule.modalInstance.close();">
              <div style="font-size:1.1rem; font-weight:900; color:${dateColor}; border-bottom:1px solid #e2e8f0; padding-bottom:8px; margin-bottom:8px;">
                ${res.dateStr.replace(/-/g, '. ')} (${dayName})
              </div>
          `;

          if (res.dayEventObj && res.dayEventObj.items && res.dayEventObj.items.length > 0) {
            res.dayEventObj.items.forEach(e => {
              if (!e.content) return;
              
              let lNames = e.parsedLabelNames || [];
              let lStr = lNames.join(', ');
              const mainLabel = lNames.length > 0 ? lNames[0] : '';
              
              const style = window.getLabelStyle ? window.getLabelStyle(mainLabel, 'event') : { bg: '#f0f9ff', text: '#0369a1', border: '#bae6fd' };
              
              let eText = `<div style="display:flex; flex-direction:column; background:${style.bg}; padding:8px; border-radius:6px; margin-bottom:6px; border:1px dashed ${style.border};">`;
              if (lStr && lStr !== '기타') {
                  eText += `<div style="font-weight:bold; color:${style.text}; margin-bottom:4px;">일정(${highlight(lStr)}):</div>`;
              } else {
                  eText += `<div style="font-weight:bold; color:${style.text}; margin-bottom:4px;">일정:</div>`;
              }
              eText += `<div style="font-size:0.95rem; color:#1e293b; white-space:pre-wrap;">${highlight(e.content)}</div>`;
              eText += `</div>`;
              cardHtml += eText;
            });
          }

          for (let p = 1; p <= maxPeriod; p++) {
            const pData = res.dayPeriods[p];
            if (pData && (pData.subject || pData.memo || pData.supplies)) {
              let pText = `<div style="display:flex; flex-direction:column; background:#f8fafc; padding:8px; border-radius:6px; margin-bottom:6px; border:1px dashed #cbd5e1;">`;
              pText += `<div style="font-weight:bold; color:#0f172a; margin-bottom:4px;">${window.periodNames ? window.periodNames[p-1] : p+'교시'}: ${highlight(pData.subject)}</div>`;
              if (pData.memo) pText += `<div style="font-size:0.9rem; color:#475569; margin-bottom:2px;">수업 메모: ${highlight(pData.memo)}</div>`;
              if (pData.supplies) pText += `<div style="font-size:0.9rem; color:#b45309;">비고: ${highlight(pData.supplies)}</div>`;
              pText += `</div>`;
              cardHtml += pText;
            }
          }
          
          if (res.dayJournals && res.dayJournals.length > 0) {
            res.dayJournals.forEach(j => {
              if (j.content || (j.parsedLabelNames && j.parsedLabelNames.length > 0)) {
                let lStr = (j.parsedLabelNames || []).join(', ');
                let mainLabel = (j.parsedLabelNames && j.parsedLabelNames.length > 0) ? j.parsedLabelNames[0] : '기타';
                const style = window.getLabelStyle ? window.getLabelStyle(mainLabel, 'journal') : { bg: '#fdf2f8', text: '#9d174d', border: '#fbcfe8' };
                
                let jText = `<div style="display:flex; flex-direction:column; background:${style.bg}; padding:8px; border-radius:6px; margin-bottom:6px; border:1px dashed ${style.border};">`;
                
                if (lStr && lStr !== '기타') {
                    jText += `<div style="font-weight:bold; color:${style.text}; margin-bottom:4px;">기록(${highlight(lStr)}):</div>`;
                } else {
                    jText += `<div style="font-weight:bold; color:${style.text}; margin-bottom:4px;">기록:</div>`;
                }
                
                jText += `<div style="font-size:0.95rem; color:#1e293b; white-space:pre-wrap;">${highlight(j.content)}</div>`;
                jText += `</div>`;
                cardHtml += jText;
              }
            });
          }

          cardHtml += `</div>`;
          resultList.innerHTML += cardHtml;
        });
        
    } catch(e) {
        console.error("검색 오류", e);
        resultList.innerHTML = '<p style="color:#ef4444; text-align:center; font-weight:bold;">검색 중 오류가 발생했습니다.</p>';
    }
  }
};

window.openSearchModal = () => SearchModule.open();
