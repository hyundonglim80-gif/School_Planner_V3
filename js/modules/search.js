const SearchModule = {
  modalInstance: null,
  filterIdCounter: 0,
  
  getContentHTML: function() {
    return `
      <div class="modal-info-box">
         <h4 style="margin-top:0; margin-bottom:10px; color:#1e40af; border-bottom:1px solid #bfdbfe; padding-bottom:5px;">📅 검색 기간 설정</h4>
         <div style="display:flex; flex-direction:column; gap:10px;">
           <div style="display:flex; align-items:center; gap:10px;">
             <span style="font-weight:bold; width:80px;">기간 범위:</span>
             <select id="search-scope-select" onchange="SearchModule.toggleCustomDateSearch()" style="flex:1; padding:8px; border-radius:4px; border:1px solid #cbd5e1; outline:none; background:#fff;">
               <option value="current" id="search-scope-current-opt">현재 선택 범위 (기본)</option>
               <option value="year">해당 학년도 전체</option>
               <option value="sem1">1학기</option>
               <option value="sem2">2학기</option>
               <option value="month">해당 월 전체</option>
               <option value="week">해당 주 전체</option>
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

      <div class="modal-info-box alt">
         <h4 style="margin-top:0; margin-bottom:10px; color:#1e40af; border-bottom:1px solid #bfdbfe; padding-bottom:5px;">➕ 검색 조건 설정 (다중 조건 가능)</h4>
         <p style="margin:0; margin-bottom:10px; font-size:0.85rem;">[조건 추가] 버튼을 눌러 라벨명이나 내용으로 세부 검색 조건을 무한대로 조합할 수 있습니다.</p>
         
         <div id="search-filters-container" style="display:flex; flex-direction:column; gap:10px; margin-bottom:15px;"></div>
         <button onclick="SearchModule.addFilter()" class="modal-btn-dashed" style="margin-top:0;">+ 검색 조건 추가</button>
      </div>

      <button onclick="SearchModule.executeSearch()" class="search-execute-btn">
        🔍 조건에 맞는 데이터 찾기
      </button>

      <div id="search-results-count" style="font-weight:bold; color:#0f172a; margin-bottom:10px; font-size:0.95rem;"></div>
      <div id="search-results-area" class="search-results-area"></div>
    `;
  },

  open: function() {
    if (!this.modalInstance) {
      this.modalInstance = new window.Modal({
        id: 'search-modal-v2',
        title: '🔍 통합 고급 검색',
        width: '650px', // UI가 커져서 창 너비를 조금 늘렸습니다.
        content: this.getContentHTML()
      });
    }
    this.modalInstance.open();
    
    // 모달 열 때마다 초기화 (기존 기간 안내 텍스트 갱신 포함)
    const scopeNames = { 'year': '해당 학년도', 'month': '해당 월', 'week': '해당 주', 'day': '해당 일', 'memo': '메모' };
    const currentLabel = scopeNames[window.currentScope] ? `현재 화면 범위 (${scopeNames[window.currentScope]})` : '현재 선택 범위 (기본)';
    const scopeOpt = document.getElementById('search-scope-current-opt');
    if(scopeOpt) scopeOpt.innerText = currentLabel;

    const select = document.getElementById('search-scope-select');
    if(select) { select.value = 'current'; this.toggleCustomDateSearch(); }

    const container = document.getElementById('search-filters-container');
    if (container) {
        container.innerHTML = ''; 
        this.filterIdCounter = 0;
        this.addFilter(); // 기본 필터 1개 생성
    }
    
    document.getElementById('search-results-count').innerText = '';
    const resultsArea = document.getElementById('search-results-area');
    if(resultsArea) resultsArea.innerHTML = `<p style="text-align:center; color:#94a3b8; padding:20px;">위에서 기간과 항목을 설정한 뒤 '데이터 찾기'를 눌러주세요.</p>`;
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

  addFilter: function() {
    const container = document.getElementById('search-filters-container');
    if (!container) return;
    
    const filterRow = document.createElement('div');
    filterRow.className = 'modal-input-row alt';
    
    const deleteBtnHTML = this.filterIdCounter > 0 
        ? `<button onclick="this.parentElement.remove()" class="modal-delete-btn" title="조건 삭제">✖</button>`
        : `<div style="width:24px;"></div>`; // 첫 번째 줄은 ✖ 버튼 자리 비우기

    filterRow.innerHTML = `
         <select class="filter-type" style="padding:8px; border-radius:4px; border:1px solid #cbd5e1; outline:none; background:#fff; font-weight:bold; color:#1e40af;">
           <option value="all">통합(라벨+내용)</option>
           <option value="event">일정</option>
           <option value="subject">과목명</option>
           <option value="memo">수업 메모</option>
           <option value="supplies">준비물</option>
           <option value="journal">일지</option>
         </select>
         <input type="text" class="filter-keyword modal-input-text" placeholder="검색어 입력... (띄어쓰기 없이 '/'로 여러 단어 구분 입력 가능)">
         ${deleteBtnHTML}
    `;
    container.appendChild(filterRow);
    this.filterIdCounter++;
  },

  getSearchTargetDates: function(eventMap) {
    const scopeSelect = document.getElementById('search-scope-select');
    let targetScope = scopeSelect ? scopeSelect.value : 'current';
    if (targetScope === 'current') targetScope = window.currentScope;

    const dates = [];
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

    // 1. 직접 지정
    if (targetScope === 'custom') {
      const startStr = document.getElementById('search-start-date').value;
      const endStr = document.getElementById('search-end-date').value;
      if (!startStr || !endStr) { alert('검색할 시작 날짜와 종료 날짜를 모두 지정해주세요.'); return []; }
      
      let curDate = new Date(startStr);
      const endDate = new Date(endStr);
      if (curDate > endDate) { alert('시작 날짜가 종료 날짜보다 늦을 수 없습니다.'); return []; }
      
      while (curDate <= endDate) {
        dates.push({ dateStr: window.formatDate(curDate) });
        curDate.setDate(curDate.getDate() + 1);
      }
      return dates;
    }

    // 2. 학년도 및 학기 관련 날짜 산출 (3월 시작 기준)
    const y = window.currentDate.getFullYear();
    const m = window.currentDate.getMonth(); 
    const startYear = m <= 1 ? y - 1 : y; // 1~2월이면 작년 3월이 시작년도

    let sem2StartDate = new Date(startYear, 7, 16); // 기본 2학기 시작 (8월 16일)
    if (eventMap) {
       let found = false;
       for (let mth = 7; mth <= 8; mth++) { 
          const daysInMonth = new Date(startYear, mth + 1, 0).getDate();
          for (let d = 1; d <= daysInMonth; d++) {
             const checkDate = window.formatDate(new Date(startYear, mth, d));
             if (eventMap[checkDate] && (eventMap[checkDate].includes('개학') || eventMap[checkDate].includes('2학기 시작'))) {
                 sem2StartDate = new Date(startYear, mth, d);
                 found = true; break;
             }
          }
          if(found) break;
       }
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
      for (let monthIdx = 3; monthIdx <= 14; monthIdx++) {
        let targetY = startYear; let targetM = monthIdx;
        if (monthIdx > 12) { targetY = startYear + 1; targetM = monthIdx - 12; }
        const lastDate = new Date(targetY, targetM, 0).getDate();
        for (let i = 1; i <= lastDate; i++) pushDate(new Date(targetY, targetM - 1, i));
      }
    } else if (targetScope === 'sem1') {
      let cur = new Date(startYear, 2, 1); 
      while (cur < sem2StartDate) { pushDate(new Date(cur)); cur.setDate(cur.getDate() + 1); }
    } else if (targetScope === 'sem2') {
      let cur = new Date(sem2StartDate);
      const endOfAcademicYear = new Date(startYear + 1, 2, 0); 
      while (cur <= endOfAcademicYear) { pushDate(new Date(cur)); cur.setDate(cur.getDate() + 1); }
    }

    return dates;
  },

  executeSearch: async function() {
    const rows = document.querySelectorAll('#active-search-fields .modal-input-row, #search-filters-container .modal-input-row');
    if (rows.length === 0) return alert("검색할 항목을 먼저 추가해 주세요.");

    const searchConditions = [];
    let allKeywords = [];
    
    rows.forEach(row => {
      const typeSelect = row.querySelector('.filter-type');
      const keywordInput = row.querySelector('.filter-keyword');
      if(!typeSelect || !keywordInput) return;

      const type = typeSelect.value;
      const inputVal = keywordInput.value;
      
      // 슬래시(/)를 기준으로 여러 단어 OR 검색 지원
      const keywords = inputVal.split('/').map(k => k.trim()).filter(k => k !== '');
      
      if (keywords.length > 0) {
        searchConditions.push({ type, keywords, logic: 'OR' });
        allKeywords.push(...keywords);
      }
    });

    if (searchConditions.length === 0) return alert("검색어를 한 글자 이상 입력해 주세요.");
    
    allKeywords = [...new Set(allKeywords)]; // 중복 키워드 제거용 (하이라이트 용도)

    const resultList = document.getElementById('search-results-area');
    const countText = document.getElementById('search-results-count');
    resultList.innerHTML = `<p style="text-align:center; color:#64748b; font-weight:bold; padding:30px;">⏳ 클라우드에서 검색 기간의 일정을 분석 중입니다...</p>`;
    countText.innerText = '';

    try {
        const eventSnap = await window.getUserCol('events').get();
        const scheduleSnap = await window.getUserCol('schedules').get();
        const journalSnap = await window.getUserCol('journals').get();

        const eventMap = {};
        eventSnap.forEach(doc => { eventMap[doc.id] = doc.data().eventText || ''; });
        
        const scheduleMap = {};
        scheduleSnap.forEach(doc => { scheduleMap[doc.id] = doc.data().periods || {}; });
        
        const journalMap = {};
        journalSnap.forEach(doc => { journalMap[doc.id] = doc.data().entries || []; });

        const targetDatesObj = this.getSearchTargetDates(eventMap);
        if (targetDatesObj.length === 0) {
            resultList.innerHTML = `<p style="text-align:center; color:#ef4444; font-weight:bold; padding:20px;">검색할 기간에 포함되는 날짜가 없습니다.</p>`;
            return; 
        }
        
        const validDates = targetDatesObj.map(item => item.dateStr);

        const checkMatch = (text, params) => {
          if (!text) return false;
          const lowerText = text.toLowerCase();
          if (params.logic === 'OR') return params.keywords.some(k => lowerText.includes(k.toLowerCase()));
          return false;
        };

        const matchedResults = [];
        const maxPeriod = window.periodNames ? window.periodNames.length : 6;

        validDates.forEach(dateStr => {
          const dayEvent = eventMap[dateStr] || '';
          const dayPeriods = scheduleMap[dateStr] || {};
          const dayJournals = journalMap[dateStr] || [];
          
          let daySubjectText = []; let dayMemoText = []; let daySuppliesText = [];
          let dayJournalText = dayJournals.map(j => `[${j.label}] ${j.content}`).join(' ');

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
            'subject': daySubjectText.join(' '),
            'memo': dayMemoText.join(' '),
            'supplies': daySuppliesText.join(' '),
            'journal': dayJournalText
          };

          // AND 조건 (추가된 필터를 모두 만족해야 함)
          let isMatch = true;
          for (const cond of searchConditions) {
            const textToSearch = textMap[cond.type];
            if (!checkMatch(textToSearch, cond)) {
              isMatch = false; break; 
            }
          }

          if (isMatch) matchedResults.push({ dateStr, dayEvent, dayPeriods, dayJournals });
        });

        // 최신 날짜가 위로 오도록 정렬
        matchedResults.sort((a, b) => b.dateStr.localeCompare(a.dateStr));

        // 하이라이트 함수
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

        countText.innerText = `💡 총 ${matchedResults.length}건의 데이터를 찾았습니다.`;
        resultList.innerHTML = '';

        if (matchedResults.length === 0) {
          resultList.innerHTML = `<p style="text-align:center; color:#ef4444; font-size:1.1rem; padding:30px; font-weight:bold;">❌ 지정한 기간 내에 일치하는 결과가 없습니다.</p>`;
          return;
        }

        const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

        matchedResults.forEach(res => {
          const dObj = new Date(res.dateStr);
          const dayName = dayNames[dObj.getDay()];
          const dateColor = dObj.getDay() === 0 ? '#ef4444' : dObj.getDay() === 6 ? '#3b82f6' : '#1e40af';

          let cardHtml = `
            <div class="search-result-card" onclick="window.goToDay('${res.dateStr}'); window.ModalManager.closeTop();">
              <div style="font-size:1.1rem; font-weight:900; color:${dateColor}; border-bottom:1px solid #e2e8f0; padding-bottom:8px; margin-bottom:8px;">
                📅 ${res.dateStr.replace(/-/g, '. ')} (${dayName})
              </div>
          `;

          if (res.dayEvent) {
            cardHtml += `<div style="margin-bottom:6px; color:#0369a1; font-weight:bold;">📍 일정: <span style="font-weight:normal; color:#334155;">${highlight(res.dayEvent)}</span></div>`;
          }

          for (let p = 1; p <= maxPeriod; p++) {
            const pData = res.dayPeriods[p];
            if (pData && (pData.subject || pData.memo || pData.supplies)) {
              let pText = `<div style="display:flex; flex-direction:column; background:#f8fafc; padding:8px; border-radius:6px; margin-bottom:6px; border:1px dashed #cbd5e1;">`;
              pText += `<div style="font-weight:bold; color:#0f172a; margin-bottom:4px;">[${window.periodNames ? window.periodNames[p-1] : p+'교시'}] ${highlight(pData.subject)}</div>`;
              if (pData.memo) pText += `<div style="font-size:0.9rem; color:#475569; margin-bottom:2px;">📝 메모: ${highlight(pData.memo)}</div>`;
              if (pData.supplies) pText += `<div style="font-size:0.9rem; color:#b45309;">🎒 준비물: ${highlight(pData.supplies)}</div>`;
              pText += `</div>`;
              cardHtml += pText;
            }
          }
          
          if (res.dayJournals && res.dayJournals.length > 0) {
            res.dayJournals.forEach(j => {
              if (j.content || j.label) {
                let jText = `<div style="display:flex; flex-direction:column; background:#fdf2f8; padding:8px; border-radius:6px; margin-bottom:6px; border:1px dashed #f472b6;">`;
                jText += `<div style="font-weight:bold; color:#be185d; margin-bottom:4px;">[일지: ${highlight(j.label)}]</div>`;
                jText += `<div style="font-size:0.95rem; color:#831843;">${highlight(j.content)}</div>`;
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
        resultList.innerHTML = '<p style="color:#ef4444; text-align:center; font-weight:bold;">🚨 검색 중 오류가 발생했습니다.</p>';
    }
  }
};

window.openSearchModal = () => SearchModule.open();
