//js/modules/search.js

const SearchModule = {
  modalInstance: null,
  filterIdCounter: 0,
  
  getContentHTML: function() {
    return `
      <div class="modal-info-box">
         <h4 style="margin-top:0; margin-bottom:10px; color:#1e40af; border-bottom:1px solid #bfdbfe; padding-bottom:5px;">➕ 검색 조건 설정 (다중 조건 AND/OR)</h4>
         <p style="margin:0; margin-bottom:10px; font-size:0.85rem; color:#475569;">조건을 무한대로 추가하고 AND(그리고) / OR(또는)로 정밀하게 검색하세요.</p>
         
         <div id="search-filters-container" style="display:flex; flex-direction:column; gap:10px; margin-bottom:15px;"></div>
         <button onclick="SearchModule.addFilter()" class="modal-btn-dashed" style="margin-top:0;">+ 검색 조건 추가</button>
      </div>

      <div class="modal-info-box alt">
         <h4 style="margin-top:0; margin-bottom:10px; color:#1e40af; border-bottom:1px solid #bfdbfe; padding-bottom:5px;">📅 검색 기간 설정</h4>
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
        width: '650px',
        content: this.getContentHTML()
      });
    }
    this.modalInstance.open();
    
    // 💡 모달을 열 때 기본값을 항상 'year(해당 학년도 전체)'로 설정
    const select = document.getElementById('search-scope-select');
    if(select) { 
        select.value = 'year'; 
        this.toggleCustomDateSearch(); 
    }

    const container = document.getElementById('search-filters-container');
    if (container) {
        container.innerHTML = ''; 
        this.filterIdCounter = 0;
        this.addFilter(); // 기본 필터 1개 자동 생성
    }
    
    document.getElementById('search-results-count').innerText = '';
    const resultsArea = document.getElementById('search-results-area');
    if(resultsArea) resultsArea.innerHTML = `<p style="text-align:center; color:#94a3b8; padding:20px;">조건과 기간을 설정한 뒤 '데이터 찾기'를 눌러주세요.</p>`;
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
    filterRow.className = 'modal-input-row alt search-filter-row';
    
    // 💡 첫 번째 줄은 [기본 검색조건] 텍스트를 아예 지우고, 줄맞춤을 위한 빈 공간(div)만 넣었습니다.
    const logicHTML = this.filterIdCounter > 0 
        ? `<select class="filter-logic" style="padding:8px; border-radius:4px; border:1px solid #cbd5e1; outline:none; background:#f8fafc; font-weight:bold; color:#0f172a; cursor:pointer;">
             <option value="AND">AND (그리고)</option>
             <option value="OR">OR (또는)</option>
           </select>`
        : `<input type="hidden" class="filter-logic" value="AND"><div style="width:115px;"></div>`; 

    const deleteBtnHTML = this.filterIdCounter > 0 
        ? `<button onclick="this.parentElement.remove()" class="modal-delete-btn" title="조건 삭제">✖</button>`
        : `<div style="width:24px;"></div>`;

    // 💡 기본 검색 조건 옵션을 '전체(all)'로 유지
    filterRow.innerHTML = `
         ${logicHTML}
         <select class="filter-type" style="padding:8px; border-radius:4px; border:1px solid #cbd5e1; outline:none; background:#fff; font-weight:bold; color:#1e40af; cursor:pointer;">
           <option value="all">전체</option>
           <option value="event">일정</option>
           <option value="journal">일지</option>
           <option value="subject">수업</option>
           <option value="memo">메모(수업)</option>
           <option value="supplies">비고</option> 
         </select>
         <input type="text" class="filter-keyword modal-input-text" placeholder="키워드 입력... (띄어쓰기 없이 '/'로 여러 단어 검색 가능)">
         ${deleteBtnHTML}
    `;
    container.appendChild(filterRow);
    this.filterIdCounter++;
  },

  getSearchTargetDates: function(eventMap) {
    const targetScope = document.getElementById('search-scope-select').value;
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
    const startYear = m <= 1 ? y - 1 : y; 

    // 2학기 개학식 찾기 (기본값 8월 16일)
    let sem2StartDate = new Date(startYear, 7, 16); 
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
      let cur = new Date(startYear, 2, 1); // 3월 1일 시작
      while (cur < sem2StartDate) { pushDate(new Date(cur)); cur.setDate(cur.getDate() + 1); }
    } else if (targetScope === 'sem2') {
      let cur = new Date(sem2StartDate); // 개학일 시작
      const endOfAcademicYear = new Date(startYear + 1, 2, 0); // 다음 해 2월 말일
      while (cur <= endOfAcademicYear) { pushDate(new Date(cur)); cur.setDate(cur.getDate() + 1); }
    }

    return dates;
  },

  executeSearch: async function() {
    const rows = document.querySelectorAll('.search-filter-row');
    const searchConditions = [];
    let allKeywords = [];
    
    // 사용자가 입력한 검색 조건 수집
    rows.forEach(row => {
      const logic = row.querySelector('.filter-logic').value;
      const type = row.querySelector('.filter-type').value;
      const keyword = row.querySelector('.filter-keyword').value.trim().toLowerCase();
      
      if (keyword) {
        searchConditions.push({ logic, type, keyword });
        allKeywords.push(keyword);
      }
    });

    if (searchConditions.length === 0) return alert("검색어를 한 글자 이상 입력해 주세요.");
    allKeywords = [...new Set(allKeywords)]; // 하이라이트용 중복 제거

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

        const checkMatch = (text, keyword) => {
          if (!text) return false;
          return text.toLowerCase().includes(keyword);
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
            'journal': dayJournalText,
            'subject': daySubjectText.join(' '),
            'memo': dayMemoText.join(' '),
            'supplies': daySuppliesText.join(' ')
          };

          // 💡 AND / OR 다중 조건 동적 평가 엔진
          let isMatch = false;
          if (searchConditions.length > 0) {
              // 첫 번째 조건 평가
              let currentResult = checkMatch(textMap[searchConditions[0].type], searchConditions[0].keyword);
              
              // 두 번째 조건부터 AND/OR 결합
              for (let i = 1; i < searchConditions.length; i++) {
                  const cond = searchConditions[i];
                  const matchThis = checkMatch(textMap[cond.type], cond.keyword);
                  
                  if (cond.logic === 'AND') {
                      currentResult = currentResult && matchThis;
                  } else if (cond.logic === 'OR') {
                      currentResult = currentResult || matchThis;
                  }
              }
              isMatch = currentResult;
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
              if (pData.supplies) pText += `<div style="font-size:0.9rem; color:#b45309;">📌 비고: ${highlight(pData.supplies)}</div>`;
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
