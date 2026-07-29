const SearchModule = {
  modalInstance: null,
  filterIdCounter: 0,
  
  getContentHTML: function() {
    return `
      <div style="background:#f1f5f9; padding:15px; border-radius:8px; margin-bottom:15px;">
         <p style="margin:0; font-size:0.9rem; color:#64748b;">
            ➕ <strong>검색 조건 추가</strong> 버튼을 눌러 조건(라벨명, 내용)을 무한대로 조합할 수 있습니다.
         </p>
      </div>
      <div id="search-filters-container" style="display:flex; flex-direction:column; gap:10px; margin-bottom:15px;">
         </div>
      <button onclick="SearchModule.addFilter()" style="width:100%; padding:10px; background:#f8fafc; border:1px dashed #cbd5e1; border-radius:8px; color:#3b82f6; font-weight:bold; cursor:pointer; margin-bottom:20px; transition:0.2s;">
        + 검색 조건 추가
      </button>
      <button onclick="SearchModule.executeSearch()" style="width:100%; padding:12px; background:#1e40af; border:none; border-radius:8px; color:#fff; font-weight:bold; cursor:pointer; font-size:1.1rem; box-shadow:0 4px 6px rgba(0,0,0,0.1);">
        🔍 검색 실행
      </button>
      <div id="search-results-area" style="margin-top:20px; border-top:1px solid #e2e8f0; padding-top:15px; max-height:350px; overflow-y:auto;">
         </div>
    `;
  },

  open: function() {
    if (!this.modalInstance) {
      this.modalInstance = new window.Modal({
        id: 'search-modal-v2',
        title: '🔍 통합 고급 검색',
        width: '600px',
        content: this.getContentHTML()
      });
    }
    this.modalInstance.open();
    
    // 창을 열 때마다 초기화하고 기본 필터 1개 자동 생성
    const container = document.getElementById('search-filters-container');
    if (container) {
        container.innerHTML = ''; 
        this.filterIdCounter = 0;
        this.addFilter();
    }
    const resultsArea = document.getElementById('search-results-area');
    if(resultsArea) resultsArea.innerHTML = '';
  },

  addFilter: function() {
    const container = document.getElementById('search-filters-container');
    if (!container) return;
    
    const filterRow = document.createElement('div');
    filterRow.className = 'search-filter-item';
    filterRow.style.cssText = 'display:flex; gap:10px; align-items:center; background:#fff; padding:8px; border:1px solid #e2e8f0; border-radius:6px;';
    
    // 조건 삭제(✖) 버튼은 첫 번째 칸에는 띄우지 않음
    const deleteBtnHTML = this.filterIdCounter > 0 
        ? `<button onclick="this.parentElement.remove()" style="background:none; border:none; color:#ef4444; font-size:1.2rem; cursor:pointer;" title="조건 삭제">✖</button>`
        : `<div style="width:24px;"></div>`;

    filterRow.innerHTML = `
         <select class="filter-type" style="padding:8px; border-radius:4px; border:1px solid #cbd5e1; outline:none; background:#fff;">
           <option value="all">통합(라벨+내용)</option>
           <option value="label">라벨명</option>
           <option value="content">내용</option>
         </select>
         <input type="text" class="filter-keyword" placeholder="검색어 입력..." style="flex:1; padding:8px; border:1px solid #cbd5e1; border-radius:4px; outline:none;">
         ${deleteBtnHTML}
    `;
    container.appendChild(filterRow);
    this.filterIdCounter++;
  },

  executeSearch: async function() {
    const resultsArea = document.getElementById('search-results-area');
    resultsArea.innerHTML = '<p style="text-align:center; padding:20px; color:#64748b; font-weight:bold;">⏳ 클라우드에서 일정을 검색 중입니다...</p>';
    
    // 사용자 입력 조건 수집
    const filterElements = document.querySelectorAll('.search-filter-item');
    const filters = [];
    filterElements.forEach(el => {
        const keyword = el.querySelector('.filter-keyword').value.trim().toLowerCase();
        if (keyword) {
            filters.push({ type: el.querySelector('.filter-type').value, keyword: keyword });
        }
    });

    if (filters.length === 0) {
        resultsArea.innerHTML = '<p style="text-align:center; color:#ef4444; padding:10px;">⚠️ 검색어를 최소 1개 이상 입력해 주세요.</p>';
        return;
    }

    try {
        const snapshot = await window.getUserCol('events').get();
        let allData = [];
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const date = doc.id;
            if (data.eventList && Array.isArray(data.eventList)) {
                data.eventList.forEach(evt => allData.push({ date: date, label: evt.label || '', content: evt.content || '' }));
            } else if (data.eventText) {
                allData.push({ date: date, label: '일정', content: data.eventText }); // 레거시 데이터 호환
            }
        });

        // 다중 필터 적용 (AND 조건)
        let matchedResults = allData.filter(item => {
            const lbl = item.label.toLowerCase();
            const txt = item.content.toLowerCase();
            
            return filters.every(f => {
                if (f.type === 'label') return lbl.includes(f.keyword);
                if (f.type === 'content') return txt.includes(f.keyword);
                return lbl.includes(f.keyword) || txt.includes(f.keyword); 
            });
        });

        // 최신 날짜순 정렬
        matchedResults.sort((a, b) => b.date.localeCompare(a.date));
        this.renderResults(matchedResults, resultsArea);
        
    } catch(e) {
        resultsArea.innerHTML = '<p style="color:red; text-align:center;">🚨 검색 중 오류가 발생했습니다.</p>';
    }
  },

  renderResults: function(results, container) {
    if (results.length === 0) {
        container.innerHTML = '<p style="text-align:center; padding:20px; color:#64748b;">❌ 일치하는 일정이 없습니다.</p>';
        return;
    }

    let html = '<div style="display:flex; flex-direction:column; gap:10px;">';
    results.forEach(res => {
        // 클릭 시 해당 날짜로 이동하고, 열려있는 팝업은 자동 닫힘 (ModalManager 호출)
        html += `
            <div class="search-result-card" onclick="window.goToDay('${res.date}'); window.ModalManager.closeTop();" 
                 style="padding:12px; border:1px solid #e2e8f0; border-radius:8px; background:#fff; cursor:pointer; transition:all 0.2s; box-shadow:0 2px 4px rgba(0,0,0,0.05);">
                <div style="font-size:0.9rem; color:#3b82f6; font-weight:bold; margin-bottom:6px;">📅 ${res.date}</div>
                <div style="color:#334155; line-height:1.4;">
                    <span style="display:inline-block; padding:2px 8px; background:#dbeafe; color:#1e40af; border-radius:12px; font-size:0.8rem; margin-right:6px; font-weight:bold;">${res.label}</span>
                    ${res.content}
                </div>
            </div>
        `;
    });
    html += '</div><style>.search-result-card:hover { border-color:#3b82f6 !important; transform:translateY(-2px); }</style>';
    
    container.innerHTML = html;
  }
};

window.openSearchModal = () => SearchModule.open();
