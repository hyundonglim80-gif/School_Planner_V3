// js/viewMemo.js

class MemoView extends window.BaseView {
  constructor(container) {
    super(container);
    this.currentLinks = [];
    this.memoItems = [];
    this.draggedMemoId = null;
    
    this.currentNewLabels = []; 
    // 💡 초기화 시 기본 라벨을 설정하되, 로드될 때 localStorage 값을 가져옵니다.
    this.AVAILABLE_LABELS = [];
    
    // 💡 라벨 모아보기(필터) 상태 저장용 변수
    this.currentFilter = '전체'; 
  }

  // 💡 로컬 스토리지에서 커스텀 메모 라벨 목록을 불러오는 함수
  loadMemoLabels() {
      const savedLabels = JSON.parse(localStorage.getItem('workCalendar_memoLabels'));
      if (savedLabels && savedLabels.length > 0) {
          this.AVAILABLE_LABELS = savedLabels;
      } else {
          this.AVAILABLE_LABELS = ['긴급', '중요', '학급운영', '학부모상담', '수업준비', '행정업무', '개인'];
      }
  }

  // 💡 특정 라벨만 모아보기 위한 필터 설정 함수
  setFilter(labelName) {
      this.currentFilter = labelName;
      this.renderViewer();
  }

  // ==========================================================================
  // 🔗 1. 자주 쓰는 링크 (즐겨찾기) 관리 로직
  // ==========================================================================
  async loadLinks() {
    try {
      const doc = await window.getUserCol('settings').doc('user_links').get();
      if (doc.exists) return doc.data().links || [];
    } catch (e) { console.error("링크 불러오기 오류:", e); }
    return [];
  }

  async saveLinks(linksArray) {
    try { await window.getUserCol('settings').doc('user_links').set({ links: linksArray }); } 
    catch (e) { alert("링크를 저장하는 중 오류가 발생했습니다."); }
  }

  async renderLinks() {
    const container = document.getElementById('quick-links-container');
    if (!container) return;
    const links = await this.loadLinks();
    this.currentLinks = links; 

    let html = '';
    if (links.length === 0) {
      html = `<span style="color:#94a3b8; font-size:0.95rem;">등록된 링크가 없습니다. 우측 버튼을 눌러 추가해보세요.</span>`;
    } else {
      links.forEach((link, index) => {
        html += `
          <div class="quick-link-item" style="position:relative; display:inline-flex; align-items:center; background:#eff6ff; border:1px solid #bfdbfe; border-radius:20px; padding:6px 14px; margin-right:8px; margin-bottom:8px; transition:0.2s; cursor:pointer; box-shadow:0 1px 2px rgba(0,0,0,0.05);"
               onmouseenter="this.querySelector('.link-controls').style.display='flex';"
               onmouseleave="this.querySelector('.link-controls').style.display='none';">
            <a href="${link.url}" target="_blank" style="text-decoration:none; color:#1e40af; font-weight:700; font-size:1.05rem; display:flex; align-items:center; gap:6px;">🔗 ${link.name}</a>
            <div class="link-controls" style="display:none; position:absolute; right:-10px; top:-10px; background:#fff; border:1px solid #cbd5e1; border-radius:12px; padding:2px 4px; box-shadow:0 2px 4px rgba(0,0,0,0.1); gap:4px; z-index:10;">
              <button onclick="window.memoViewInstance.openAddLinkModal(${index})" style="background:none; border:none; cursor:pointer; font-size:1rem; padding:2px;" title="수정">✏️</button>
              <button onclick="window.memoViewInstance.deleteLink(${index})" style="background:none; border:none; cursor:pointer; font-size:1rem; padding:2px;" title="삭제">❌</button>
            </div>
          </div>`;
      });
    }
    container.innerHTML = html;
  }

  openAddLinkModal(editIndex = -1) {
    const isEdit = editIndex > -1;
    const links = this.currentLinks || [];
    const target = isEdit ? links[editIndex] : {name: '', url: ''};

    const modalHtml = `
      <div id="link-modal" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:10002; display:flex; justify-content:center; align-items:center;">
          <div style="background:#fff; padding:25px; border-radius:12px; width:320px; box-shadow:0 10px 25px rgba(0,0,0,0.2);">
              <h3 style="margin-top:0; color:#1e40af; border-bottom:2px solid #e2e8f0; padding-bottom:10px;">${isEdit ? '링크 수정' : '새 링크 추가'}</h3>
              <label style="display:block; font-weight:bold; margin-bottom:5px; color:#475569;">문서/사이트 이름</label>
              <input type="text" id="link-name" value="${target.name}" placeholder="예: 구글 시트 양식" style="width:100%; padding:10px; margin-bottom:15px; border:1px solid #cbd5e1; border-radius:6px; box-sizing:border-box; outline:none;">
              <label style="display:block; font-weight:bold; margin-bottom:5px; color:#475569;">웹 주소(URL)</label>
              <input type="text" id="link-url" value="${target.url}" placeholder="예: docs.google.com/..." style="width:100%; padding:10px; margin-bottom:20px; border:1px solid #cbd5e1; border-radius:6px; box-sizing:border-box; outline:none;">
              <div style="display:flex; justify-content:flex-end; gap:10px;">
                  <button onclick="document.getElementById('link-modal').remove()" style="padding:8px 16px; border:none; background:#f1f5f9; color:#475569; border-radius:6px; font-weight:bold; cursor:pointer;">취소</button>
                  <button onclick="window.memoViewInstance.saveLinkFromModal(${editIndex})" style="padding:8px 16px; border:none; background:#2563eb; color:#fff; border-radius:6px; font-weight:bold; cursor:pointer;">저장</button>
              </div>
          </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  }

  async saveLinkFromModal(editIndex) {
    const name = document.getElementById('link-name').value.trim();
    let url = document.getElementById('link-url').value.trim();

    if (!name || !url) return alert("이름과 주소를 모두 입력해주세요.");
    if (!url.startsWith('http://') && !url.startsWith('https://')) url = 'https://' + url;

    const links = this.currentLinks || [];
    if (editIndex > -1) {
      links[editIndex] = { name, url };
    } else {
      links.push({ name, url });
    }
    
    await this.saveLinks(links);
    document.getElementById('link-modal').remove();
    this.renderLinks();
  }

  async deleteLink(index) {
    const links = this.currentLinks || [];
    const targetName = links[index]?.name;
    if (confirm(`[${targetName}] 링크를 삭제하시겠습니까?`)) {
      links.splice(index, 1);
      await this.saveLinks(links);
      this.renderLinks();
    }
  }

  // ==========================================================================
  // 🏷️ 다중 라벨 칩 렌더링 시스템
  // ==========================================================================
  renderLabelChips(containerElement, selectedLabelsArray, onChangeCallback) {
    if (!containerElement) return;
    containerElement.innerHTML = '';
    
    this.AVAILABLE_LABELS.forEach(labelText => {
        const chip = document.createElement('div');
        chip.className = 'label-chip';
        chip.innerText = labelText;
        
        if (selectedLabelsArray.includes(labelText)) {
            chip.classList.add('active');
        }
        
        chip.addEventListener('click', () => {
            if (selectedLabelsArray.includes(labelText)) {
                selectedLabelsArray = selectedLabelsArray.filter(l => l !== labelText);
                chip.classList.remove('active');
            } else {
                selectedLabelsArray.push(labelText);
                chip.classList.add('active');
            }
            if (onChangeCallback) onChangeCallback(selectedLabelsArray);
        });
        
        containerElement.appendChild(chip);
    });
  }

  // ==========================================================================
  // 📝 2. 메모(업무 체크리스트) 렌더링 및 제어 로직
  // ==========================================================================
  async renderViewer() {
    this.showLoading('클라우드에서 메모와 링크를 불러오는 중입니다...');
    
    // 💡 그리기 직전에 최신 라벨 목록을 로드합니다.
    this.loadMemoLabels();
    
    this.memoItems = await window.dbAPI.loadMemos();

    // 💡 사용자가 선택한 라벨(currentFilter)에 따라 데이터를 필터링합니다.
    let filteredMemos = this.memoItems;
    if (this.currentFilter !== '전체') {
        filteredMemos = filteredMemos.filter(m => m.labels && m.labels.includes(this.currentFilter));
    }

    let activeMemos = filteredMemos.filter(m => !m.completed).sort((a, b) => a.order - b.order);
    let completedMemos = filteredMemos.filter(m => m.completed).sort((a, b) => b.completedAt - a.completedAt);

    // 💡 라벨 필터 버튼 HTML 생성 (가로 스크롤 가능하게 배치)
    const filterHtml = `
      <div style="display:flex; gap:6px; overflow-x:auto; padding-bottom:10px; margin-bottom:10px;">
          <div class="label-chip ${this.currentFilter === '전체' ? 'active' : ''}" onclick="window.memoViewInstance.setFilter('전체')">👀 전체보기</div>
          ${this.AVAILABLE_LABELS.map(l => `<div class="label-chip ${this.currentFilter === l ? 'active' : ''}" onclick="window.memoViewInstance.setFilter('${l}')">${l}</div>`).join('')}
      </div>
    `;

    let html = `
      <div style="max-width:800px; margin:0 auto; display:flex; flex-direction:column; gap:15px;">
        
        <div style="background:#fff; padding:15px 20px; border-radius:12px; border:1px solid var(--border-color); box-shadow:0 1px 3px rgba(0,0,0,0.05);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:2px solid #f1f5f9; padding-bottom:8px;">
            <h3 style="margin:0; font-size:1.2rem; color:#1e40af; display:flex; align-items:center; gap:6px;">🔗 자주 쓰는 문서/링크</h3>
            <button onclick="window.memoViewInstance.openAddLinkModal(-1)" style="background:#f1f5f9; color:#334155; border:1px solid #cbd5e1; padding:4px 10px; border-radius:6px; font-weight:bold; cursor:pointer; font-size:0.9rem; transition:0.2s;">+ 링크 추가</button>
          </div>
          <div id="quick-links-container" style="display:flex; flex-wrap:wrap; align-items:center;"></div>
        </div>

        <div style="background:#fff; padding:20px; border-radius:12px; border:1px solid var(--border-color); box-shadow:0 1px 3px rgba(0,0,0,0.05);">
          
          <div style="display:flex; gap:8px; margin-bottom:10px; align-items:flex-start;">
            <textarea id="memo-input-text" placeholder="새 할 일 추가 (Ctrl+Enter 저장 / 일반 Enter는 줄바꿈)" 
                   style="flex:1; padding:10px 12px; border:2px solid #e2e8f0; border-radius:8px; font-size:1.3rem; outline:none; resize:none; overflow:hidden; min-height:44px; height:44px; font-family:inherit; line-height:1.4; box-sizing:border-box;"
                   onkeydown="if(event.ctrlKey && event.key === 'Enter') { event.preventDefault(); window.memoViewInstance.addMemoItem(); }"
                   oninput="this.style.height='44px'; this.style.height = (this.scrollHeight > 44 ? this.scrollHeight : 44) + 'px'"></textarea>
            <button onclick="window.memoViewInstance.addMemoItem()" style="background:var(--primary-color); color:#fff; border:none; padding:0 20px; border-radius:8px; font-weight:700; cursor:pointer; font-size:1.2rem; height:44px; white-space:nowrap; box-sizing:border-box; display:flex; align-items:center;">추가</button>
          </div>

          <div style="display: flex; justify-content: flex-end; margin-bottom: 2px;">
              <button onclick="window.manageMemoLabels()" style="background:#f8fafc; color:#475569; border:1px solid #cbd5e1; padding:4px 10px; border-radius:6px; font-size:0.85rem; cursor:pointer; font-weight: bold; transition: 0.2s;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='#f8fafc'">⚙️ 라벨 설정</button>
          </div>

          <div id="memo-add-labels" class="label-chip-container" style="margin-bottom: 25px; padding-bottom: 10px; border-bottom: 1px solid #f1f5f9;"></div>
          
          <div style="margin-top:10px; margin-bottom:5px;">
              ${filterHtml}
          </div>

          <div class="section-title" style="margin-bottom:5px;">진행 중인 업무 (${activeMemos.length})</div>
          <div id="active-memo-list">${activeMemos.length === 0 ? `<p style="text-align:center; color:#94a3b8; font-size:1.2rem; padding: 20px 0;">${this.currentFilter !== '전체' ? '해당 라벨의 업무가 없습니다.' : '모든 업무를 완료했습니다!'}</p>` : activeMemos.map((item, i) => this.generateMemoHTML(item, false)).join('')}</div>

          <div class="section-title" style="margin-top:30px; display:flex; justify-content:space-between; align-items:center; border-bottom: 2px solid #e2e8f0; padding-bottom: 4px;">
            <span>완료된 업무 (${completedMemos.length})</span>
            ${completedMemos.length > 0 ? `<button onclick="window.memoViewInstance.clearCompletedMemos()" style="background:#ef4444; color:#fff; border:none; padding:4px 10px; border-radius:6px; font-size:1.2rem; cursor:pointer;">🗑️ 전체 비우기</button>` : ''}
          </div>
          <div>${completedMemos.length === 0 ? '<p style="text-align:center; color:#94a3b8; font-size:1.2rem; margin-top:20px;">아직 완료된 항목이 없습니다.</p>' : completedMemos.map((item, i) => this.generateMemoHTML(item, true)).join('')}</div>
        </div>
      </div>
    `;
    this.container.innerHTML = html;
    
    // 신규 작성 시 현재 필터링된 라벨이 있으면 기본으로 선택해줍니다.
    this.currentNewLabels = this.currentFilter !== '전체' ? [this.currentFilter] : [];
    this.renderLabelChips(document.getElementById('memo-add-labels'), this.currentNewLabels, (updatedLabels) => {
        this.currentNewLabels = updatedLabels;
    });

    this.renderLinks();
  }

  async renderEditor() {
    this.renderViewer();
  }

  generateMemoHTML(item, isCompleted) {
    const deleteBtnHtml = `<button onclick="window.memoViewInstance.deleteMemoItem('${item.firestoreId}')" style="background:transparent; border:none; font-size:1.3rem; cursor:pointer;" title="삭제">🗑️</button>`;
    const editLabelBtnHtml = isCompleted ? '' : `<button onclick="window.memoViewInstance.openMemoLabelModal('${item.firestoreId}')" style="background:transparent; border:none; font-size:1.2rem; cursor:pointer; margin-right:4px;" title="라벨 수정">🏷️</button>`;

    let dragHandleHtml = '';
    let dragAttributes = '';
    
    // 전체보기 모드일 때만 드래그 앤 드롭 순서 변경 허용 (필터링 중 순서 꼬임 방지)
    if (!isCompleted && this.currentFilter === '전체') {
      dragAttributes = `draggable="true" ondragstart="window.memoViewInstance.handleDragStart(event, '${item.firestoreId}')" ondragover="window.memoViewInstance.handleDragOver(event)" ondrop="window.memoViewInstance.handleDrop(event, '${item.firestoreId}')"`;
      dragHandleHtml = `<span style="cursor:grab; font-size:1.8rem; color:#94a3b8; padding-right:8px; line-height:1;" title="드래그하여 순서 변경">≡</span>`;
    } else if (!isCompleted) {
      dragHandleHtml = `<span style="font-size:1.8rem; color:#cbd5e1; padding-right:8px; line-height:1; cursor:not-allowed;" title="필터 적용 중에는 순서 변경 불가">≡</span>`;
    }

    const editableAttr = isCompleted ? '' : `contenteditable="true" onblur="window.memoViewInstance.updateMemoText('${item.firestoreId}', this.innerText)" onkeydown="if(event.ctrlKey && event.key === 'Enter') { event.preventDefault(); this.blur(); }"`;

    const labels = item.labels || [];
    const labelsHtml = labels.length > 0 
        ? `<div style="margin-top: 6px; display: flex; flex-wrap: wrap; gap: 6px;">` + 
          labels.map(l => `<span class="badge-tag" style="background-color: var(--tag-bg); color: var(--tag-color); font-size: 0.8rem; padding: 2px 8px; border-radius: 12px; font-weight: 600;">${l}</span>`).join('') + 
          `</div>`
        : '';

    return `
      <div class="memo-item" ${dragAttributes} style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%; padding: 12px 0; border-bottom: 1px dashed #f1f5f9; transition: background-color 0.2s;">
        <div style="display:flex; align-items:flex-start; gap:8px; flex: 1; padding-right: 10px; margin: 0; min-height: 24px;">
          <div style="padding-top:2px;">${dragHandleHtml}</div>
          <input type="checkbox" ${isCompleted ? 'checked' : ''} onchange="window.memoViewInstance.toggleMemoItem('${item.firestoreId}', ${item.completed})" style="width:20px; height:20px; accent-color:var(--primary-color); flex-shrink: 0; margin-top: 4px; cursor:pointer;">
          
          <div style="flex: 1; display: flex; flex-direction: column;">
             <span ${editableAttr} style="font-size:1.5rem; word-break: break-all; white-space: pre-wrap; line-height:1.4; outline:none; ${isCompleted ? 'text-decoration:line-through; color:#94a3b8;' : 'color:#1e293b; font-weight:500; cursor:text; padding:2px 4px; border-radius:4px;'} " onfocus="this.style.backgroundColor='#f1f5f9'" onblur="this.style.backgroundColor='transparent'; window.memoViewInstance.updateMemoText('${item.firestoreId}', this.innerText)">${item.text}</span>
             ${labelsHtml}
          </div>
        </div>
        
        <div class="memo-controls" style="display: flex; justify-content: flex-end; padding-top:2px; align-items: flex-start;">
            ${editLabelBtnHtml}
            ${deleteBtnHtml}
        </div>
      </div>
    `;
  }

  openMemoLabelModal(firestoreId) {
      const item = this.memoItems.find(m => m.firestoreId === firestoreId);
      if (!item) return;
      let tempLabels = [...(item.labels || [])];
      const modalHtml = `
        <div id="memo-label-modal" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:10005; display:flex; justify-content:center; align-items:center;">
            <div style="background:#fff; padding:25px; border-radius:12px; width:340px; box-shadow:0 10px 25px rgba(0,0,0,0.2);">
                <h3 style="margin-top:0; color:#1e40af; border-bottom:2px solid #e2e8f0; padding-bottom:10px; margin-bottom: 15px;">🏷️ 라벨 수정</h3>
                <div id="modal-label-chips" class="label-chip-container" style="margin-bottom: 25px;"></div>
                <div style="display:flex; justify-content:flex-end; gap:10px;">
                    <button onclick="document.getElementById('memo-label-modal').remove()" style="padding:8px 16px; border:none; background:#f1f5f9; color:#475569; border-radius:6px; font-weight:bold; cursor:pointer;">취소</button>
                    <button onclick="window.memoViewInstance.saveMemoLabels('${firestoreId}')" style="padding:8px 16px; border:none; background:#4CAF50; color:#fff; border-radius:6px; font-weight:bold; cursor:pointer;">저장</button>
                </div>
            </div>
        </div>
      `;
      document.body.insertAdjacentHTML('beforeend', modalHtml);
      this.tempEditingLabels = tempLabels;
      this.renderLabelChips(document.getElementById('modal-label-chips'), this.tempEditingLabels, (newLabels) => {
          this.tempEditingLabels = newLabels;
      });
  }

  async saveMemoLabels(firestoreId) {
      const newLabels = this.tempEditingLabels || [];
      try {
          await window.dbAPI.updateMemo(firestoreId, { labels: newLabels });
          document.getElementById('memo-label-modal').remove();
          this.renderViewer(); 
      } catch(e) {
          console.error("라벨 저장 오류", e);
          alert("라벨 저장에 실패했습니다.");
      }
  }

  async updateMemoText(firestoreId, newText) {
    const text = newText.trim();
    if (!text) {
        alert("메모 내용은 비워둘 수 없습니다.");
        this.renderViewer(); 
        return;
    }
    const target = this.memoItems.find(m => m.firestoreId === firestoreId);
    if (target && target.text !== text) {
        target.text = text;
        try { await window.dbAPI.updateMemo(firestoreId, { text: text }); } 
        catch (e) { console.error("메모 수정 오류", e); }
    }
  }

  handleDragStart(event, id) {
    this.draggedMemoId = id;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', id); 
  }

  handleDragOver(event) {
    event.preventDefault(); 
    event.dataTransfer.dropEffect = 'move';
  }

  async handleDrop(event, targetId) {
    event.preventDefault();
    if (!this.draggedMemoId || this.draggedMemoId === targetId) return;

    let activeMemos = this.memoItems.filter(m => !m.completed).sort((a, b) => a.order - b.order);
    const draggedIndex = activeMemos.findIndex(m => m.firestoreId === this.draggedMemoId);
    const targetIndex = activeMemos.findIndex(m => m.firestoreId === targetId);
    if (draggedIndex === -1 || targetIndex === -1) return;

    const [draggedItem] = activeMemos.splice(draggedIndex, 1);
    activeMemos.splice(targetIndex, 0, draggedItem);
    activeMemos.forEach((memo, index) => { memo.order = index; });

    this.renderViewer();
    try {
      await Promise.all(activeMemos.map(memo => window.dbAPI.updateMemo(memo.firestoreId, { order: memo.order })));
    } catch (error) { console.error("순서 저장 중 오류 발생:", error); }
    this.draggedMemoId = null;
  }

  async addMemoItem() {
    const input = document.getElementById("memo-input-text");
    if (!input || !input.value.trim()) return;

    const newMemo = { 
        text: input.value.trim(), 
        completed: false, 
        order: -Date.now(), 
        createdAt: Date.now(),
        labels: [...this.currentNewLabels] 
    };
    input.value = "저장 중..."; input.disabled = true;

    await window.dbAPI.addMemo(newMemo); 
    this.renderViewer(); 
  }

  async toggleMemoItem(firestoreId, currentStatus) {
    const isNowCompleted = !currentStatus;
    await window.dbAPI.updateMemo(firestoreId, { completed: isNowCompleted, completedAt: isNowCompleted ? Date.now() : null });
    this.renderViewer();
  }

  async deleteMemoItem(firestoreId) {
    if(confirm("이 메모를 완전히 삭제하시겠습니까?")) {
      await window.dbAPI.deleteMemo(firestoreId);
      this.renderViewer();
    }
  }

  async clearCompletedMemos() {
    const completedMemos = this.memoItems.filter(m => m.completed);
    if (completedMemos.length === 0) return;
    if(confirm(`완료된 업무 ${completedMemos.length}개를 모두 삭제하시겠습니까?\n(이 작업은 되돌릴 수 없습니다)`)) {
      await Promise.all(completedMemos.map(memo => window.dbAPI.deleteMemo(memo.firestoreId)));
      this.renderViewer();
    }
  }

  async save() {}
}

// ==========================================================================
// 💡 전역 메모 라벨 관리 함수 (index.html 메뉴와 연결됨)
// ==========================================================================
window.manageMemoLabels = function() {
    // 1. 기존 라벨 불러오기
    let labels = JSON.parse(localStorage.getItem('workCalendar_memoLabels')) || ['긴급', '중요', '학급운영', '학부모상담', '수업준비', '행정업무', '개인'];
    let currentStr = labels.join(', ');
    
    // 2. 프롬프트 창으로 사용자 입력 받기
    let result = prompt("💡 메모의 종류(라벨)를 쉼표(,)로 구분하여 입력해주세요.", currentStr);
    
    // 3. 입력값이 있으면 쉼표 기준으로 자르고 빈 값 제거 후 저장
    if(result !== null) {
        let newLabels = result.split(',').map(s => s.trim()).filter(s => s !== '');
        if(newLabels.length > 0) {
            localStorage.setItem('workCalendar_memoLabels', JSON.stringify(newLabels));
            // 현재 화면이 메모 화면이라면 즉시 새로고침 반영
            if (window.currentScope === 'memo' && window.memoViewInstance) {
                window.memoViewInstance.renderViewer();
            }
            alert("메모 라벨이 성공적으로 업데이트되었습니다!");
        } else {
            alert("라벨은 최소 1개 이상 입력해야 합니다.");
        }
    }
};

window.memoViewInstance = new MemoView(document.getElementById("main-view"));

window.renderMemoView = (container) => {
  window.memoViewInstance.container = container;
  window.memoViewInstance.renderViewer();
};
