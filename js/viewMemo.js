// js/viewMemo.js

class MemoView extends window.BaseView {
  constructor(container) {
    super(container); // BaseView(부모) 상속
    this.currentLinks = [];
    this.memoItems = [];
    this.draggedMemoId = null;
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
  // 📝 2. 메모(업무 체크리스트) 렌더링 및 제어 로직
  // ==========================================================================
  async renderViewer() {
    this.showLoading('클라우드에서 메모와 링크를 불러오는 중입니다...'); // BaseView 기능
    this.memoItems = await window.dbAPI.loadMemos();

    let activeMemos = this.memoItems.filter(m => !m.completed).sort((a, b) => a.order - b.order);
    let completedMemos = this.memoItems.filter(m => m.completed).sort((a, b) => b.completedAt - a.completedAt);

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
          <div style="display:flex; gap:8px; margin-bottom:20px; align-items:flex-start;">
            <textarea id="memo-input-text" placeholder="새 할 일 추가 (Ctrl+Enter 저장 / 일반 Enter는 줄바꿈)" 
                   style="flex:1; padding:10px 12px; border:2px solid #e2e8f0; border-radius:8px; font-size:1.3rem; outline:none; resize:none; overflow:hidden; min-height:44px; height:44px; font-family:inherit; line-height:1.4; box-sizing:border-box;"
                   onkeydown="if(event.ctrlKey && event.key === 'Enter') { event.preventDefault(); window.memoViewInstance.addMemoItem(); }"
                   oninput="this.style.height='44px'; this.style.height = (this.scrollHeight > 44 ? this.scrollHeight : 44) + 'px'"></textarea>
            <button onclick="window.memoViewInstance.addMemoItem()" style="background:var(--primary-color); color:#fff; border:none; padding:0 20px; border-radius:8px; font-weight:700; cursor:pointer; font-size:1.2rem; height:44px; white-space:nowrap; box-sizing:border-box; display:flex; align-items:center;">추가</button>
          </div>
          
          <div class="section-title">진행 중인 업무 (${activeMemos.length})</div>
          <div id="active-memo-list">${activeMemos.length === 0 ? '<p style="text-align:center; color:#94a3b8; font-size:1.5rem;">모든 업무를 완료했습니다!</p>' : activeMemos.map((item, i) => this.generateMemoHTML(item, false)).join('')}</div>

          <div class="section-title" style="margin-top:30px; display:flex; justify-content:space-between; align-items:center; border-bottom: 2px solid #e2e8f0; padding-bottom: 4px;">
            <span>완료된 업무 (${completedMemos.length})</span>
            ${completedMemos.length > 0 ? `<button onclick="window.memoViewInstance.clearCompletedMemos()" style="background:#ef4444; color:#fff; border:none; padding:4px 10px; border-radius:6px; font-size:1.2rem; cursor:pointer;">🗑️ 전체 비우기</button>` : ''}
          </div>
          <div>${completedMemos.length === 0 ? '<p style="text-align:center; color:#94a3b8; font-size:1.5rem; margin-top:20px;">아직 완료된 항목이 없습니다.</p>' : completedMemos.map((item, i) => this.generateMemoHTML(item, true)).join('')}</div>
        </div>
      </div>
    `;
    this.container.innerHTML = html;
    this.renderLinks();
  }

  // (참고) 메모 뷰는 뷰어/에디터 구분이 없으므로 renderEditor도 똑같이 동작시킵니다.
  async renderEditor() {
    this.renderViewer();
  }

  generateMemoHTML(item, isCompleted) {
    const deleteBtnHtml = isCompleted ? `<button onclick="window.memoViewInstance.deleteMemoItem('${item.firestoreId}')" style="background:transparent; border:none; font-size:1.5rem; cursor:pointer;">🗑️</button>` : ``;
    let dragHandleHtml = '';
    let dragAttributes = '';
    
    if (!isCompleted) {
      dragAttributes = `draggable="true" ondragstart="window.memoViewInstance.handleDragStart(event, '${item.firestoreId}')" ondragover="window.memoViewInstance.handleDragOver(event)" ondrop="window.memoViewInstance.handleDrop(event, '${item.firestoreId}')"`;
      dragHandleHtml = `<span style="cursor:grab; font-size:1.8rem; color:#94a3b8; padding-right:8px; line-height:1;" title="드래그하여 순서 변경">≡</span>`;
    }

    return `
      <div class="memo-item" ${dragAttributes} style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%; padding: 8px 0; border-bottom: 1px dashed #f1f5f9; transition: background-color 0.2s;">
        <label style="display:flex; align-items:flex-start; gap:8px; cursor:pointer; flex: 1; padding-right: 10px; margin: 0; min-height: 24px;">
          <div style="padding-top:2px;">${dragHandleHtml}</div>
          <input type="checkbox" ${isCompleted ? 'checked' : ''} onchange="window.memoViewInstance.toggleMemoItem('${item.firestoreId}', ${item.completed})" style="width:20px; height:20px; accent-color:var(--primary-color); flex-shrink: 0; margin-top: 4px;">
          <span style="font-size:1.5rem; word-break: break-all; white-space: pre-wrap; line-height:1.4; ${isCompleted ? 'text-decoration:line-through; color:#94a3b8;' : 'color:#1e293b; font-weight:500;'}">${item.text}</span>
        </label>
        <div class="memo-controls" style="display: flex; justify-content: flex-end; padding-top:2px;">${deleteBtnHtml}</div>
      </div>
    `;
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

    const newMemo = { text: input.value.trim(), completed: false, order: -Date.now(), createdAt: Date.now() };
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

  async save() {
    // 메모 뷰는 저장 버튼을 누를 일이 없으므로 비워둡니다.
  }
}

// ==========================================================================
// 🔌 하위 호환성 유지 브릿지 (app.js 연동)
// ==========================================================================
window.memoViewInstance = new MemoView(document.getElementById("main-view"));

window.renderMemoView = (container) => {
  window.memoViewInstance.container = container;
  window.memoViewInstance.renderViewer();
};
