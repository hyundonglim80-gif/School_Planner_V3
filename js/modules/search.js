//js/modules/search.js

const SearchModule = {
  modalInstance: null,
  filterIdCounter: 0,
  
  getContentHTML: function() {
    return `
      <div class="modal-info-box">
         <p style="margin:0;">
            ➕ <strong>검색 조건 추가</strong> 버튼을 눌러 조건(라벨명, 내용)을 무한대로 조합할 수 있습니다.
         </p>
      </div>
      <div id="search-filters-container" style="display:flex; flex-direction:column; gap:10px; margin-bottom:15px;"></div>
      <button onclick="SearchModule.addFilter()" class="modal-btn-dashed" style="margin-bottom:20px;">
        + 검색 조건 추가
      </button>
      <button onclick="SearchModule.executeSearch()" class="search-execute-btn">
        🔍 검색 실행
      </button>
      <div id="search-results-area" class="search-results-area"></div>
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
    filterRow.className = 'modal-input-row alt';
    
    const deleteBtnHTML = this.filterIdCounter > 0 
        ? `<button onclick="this.parentElement.remove()" class="modal-delete-btn" title="조건 삭제">✖</button>`
        : `<div style="width:24px;"></div>`;

    filterRow.innerHTML = `
         <select class="filter-type" style="padding:8px; border-radius:4px; border:1px solid #cbd5e1; outline:none; background:#fff;">
           <option value="all">통합(라벨+내용)</option>
           <option value="label">라벨명</option>
           <option value="content">내용</option>
         </select>
         <input type="text" class="filter-keyword modal-input-text" placeholder="검색어 입력...">
         ${deleteBtnHTML}
    `;
    container.appendChild(filterRow);
    this.filterIdCounter++;
  },

  executeSearch: async function() {
    const resultsArea = document.getElementById('search-results-area');
    resultsArea.innerHTML = '<p style="text-align:center; padding:20px; color:#64748b; font-weight:bold;">⏳ 클라우드에서 일정을 검색 중입니다...</p>';
    
    const filterElements = document.querySelectorAll('.modal-input-row');
    const filters = [];
    filterElements.forEach(el => {
        const keywordInput = el.querySelector('.filter-keyword');
        if(!keywordInput) return;
        const keyword = keywordInput.value.trim().toLowerCase();
        if (keyword) {
            filters.push({ type: el.querySelector('.filter-type').value, keyword: keyword });
        }
    });

    if (filters.length === 0) {
        resultsArea.innerHTML = '<p style="text-align:center; color:#ef4444; padding:10px; font-weight:bold;">⚠️ 검색어를 최소 1개 이상 입력해 주세요.</p>';
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
                allData.push({ date: date, label: '일정', content: data.eventText });
            }
        });

        let matchedResults = allData.filter(item => {
            const lbl = item.label.toLowerCase();
            const txt = item.content.toLowerCase();
            
            return filters.every(f => {
                if (f.type === 'label') return lbl.includes(f.keyword);
                if (f.type === 'content') return txt.includes(f.keyword);
                return lbl.includes(f.keyword) || txt.includes(f.keyword); 
            });
        });

        matchedResults.sort((a, b) => b.date.localeCompare(a.date));
        this.renderResults(matchedResults, resultsArea);
        
    } catch(e) {
        resultsArea.innerHTML = '<p style="color:#ef4444; text-align:center; font-weight:bold;">🚨 검색 중 오류가 발생했습니다.</p>';
    }
  },

  renderResults: function(results, container) {
    if (results.length === 0) {
        container.innerHTML = '<p style="text-align:center; padding:20px; color:#64748b; font-weight:bold;">❌ 일치하는 일정이 없습니다.</p>';
        return;
    }

    let html = '<div style="display:flex; flex-direction:column; gap:10px;">';
    results.forEach(res => {
        html += `
            <div class="search-result-card" onclick="window.goToDay('${res.date}'); window.ModalManager.closeTop();">
                <div style="font-size:0.9rem; color:#3b82f6; font-weight:bold; margin-bottom:6px;">📅 ${res.date}</div>
                <div style="color:#334155; line-height:1.4;">
                    <span style="display:inline-block; padding:2px 8px; background:#dbeafe; color:#1e40af; border-radius:12px; font-size:0.8rem; margin-right:6px; font-weight:bold;">${res.label}</span>
                    ${res.content}
                </div>
            </div>
        `;
    });
    html += '</div>';
    
    container.innerHTML = html;
  }
};

window.openSearchModal = () => SearchModule.open();
