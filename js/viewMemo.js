// js/viewMemo.js

// ==========================================================================
// 🔗 0. 자주 쓰는 링크 (즐겨찾기) 관리 시스템 (하나의 팝업창으로 통합)
// ==========================================================================
window.loadLinks = async function() {
  try {
    const doc = await window.getUserCol('settings').doc('user_links').get();
    if (doc.exists) return doc.data().links || [];
  } catch (e) { console.error("링크 불러오기 오류:", e); }
  return [];
};

window.saveLinks = async function(linksArray) {
  try { await window.getUserCol('settings').doc('user_links').set({ links: linksArray }); } 
  catch (e) { alert("링크를 저장하는 중 오류가 발생했습니다."); }
};

window.renderLinks = async function() {
  const container = document.getElementById('quick-links-container');
  if (!container) return;
  const links = await window.loadLinks();
  window.currentLinks = links; 

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
            <button onclick="editLink(${index})" style="background:none; border:none; cursor:pointer; font-size:1rem; padding:2px;" title="수정">✏️</button>
            <button onclick="deleteLink(${index})" style="background:none; border:none; cursor:pointer; font-size:1rem; padding:2px;" title="삭제">❌</button>
          </div>
        </div>`;
    });
  }
  container.innerHTML = html;
};

// 🎯 통합 팝업 모달창 띄우기
window.openAddLinkModal = function(editIndex = -1) {
  const isEdit = editIndex > -1;
  const links = window.currentLinks || [];
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
                <button onclick="saveLinkFromModal(${editIndex})" style="padding:8px 16px; border:none; background:#2563eb; color:#fff; border-radius:6px; font-weight:bold; cursor:pointer;">저장</button>
            </div>
        </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHtml);
};

window.saveLinkFromModal = async function(editIndex) {
  const name = document.getElementById('link-name').value.trim();
  let url = document.getElementById('link-url').value.trim();

  if (!name || !url) return alert("이름과 주소를 모두 입력해주세요.");
  if (!url.startsWith('http://') && !url.startsWith('https://')) url = 'https://' + url;

  const links = window.currentLinks || [];
  if (editIndex > -1) {
    links[editIndex] = { name, url };
  } else {
    links.push({ name, url });
  }
  
  await window.saveLinks(links);
  document.getElementById('link-modal').remove();
  window.renderLinks();
};

window.addNewLink = () => window.openAddLinkModal(-1);
window.editLink = (idx) => window.openAddLinkModal(idx);

window.deleteLink = async function(index) {
  const links = window.currentLinks || [];
  const targetName = links[index]?.name;
  if (confirm(`[${targetName}] 링크를 삭제하시겠습니까?`)) {
    links.splice(index, 1);
    await window.saveLinks(links);
    window.renderLinks();
  }
};

// ==========================================================================
// 📝 1. 메모(업무 및 수업 체크리스트) 메인 화면 그리기
// ==========================================================================
window.renderMemoView = async function(container) {
  container.innerHTML = `<p style="text-align:center; padding: 40px; color:#64748b; font-weight:bold;">⏳ 클라우드에서 메모와 링크를 불러오는 중입니다...</p>`;
  window.memoItems = await window.dbAPI.loadMemos();

  let activeMemos = window.memoItems.filter(m => !m.completed).sort((a, b) => a.order - b.order);
  let completedMemos = window.memoItems.filter(m => m.completed).sort((a, b) => b.completedAt - a.completedAt);

  let html = `
    <div style="max-width:800px; margin:0 auto; display:flex; flex-direction:column; gap:15px;">
      
      <div style="background:#fff; padding:15px 20px; border-radius:12px; border:1px solid var(--border-color); box-shadow:0 1px 3px rgba(0,0,0,0.05);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:2px solid #f1f5f9; padding-bottom:8px;">
          <h3 style="margin:0; font-size:1.2rem; color:#1e40af; display:flex; align-items:center; gap:6px;">🔗 자주 쓰는 문서/링크</h3>
          <button onclick="addNewLink()" style="background:#f1f5f9; color:#334155; border:1px solid #cbd5e1; padding:4px 10px; border-radius:6px; font-weight:bold; cursor:pointer; font-size:0.9rem; transition:0.2s;">+ 링크 추가</button>
        </div>
        <div id="quick-links-container" style="display:flex; flex-wrap:wrap; align-items:center;"></div>
      </div>

      <div style="background:#fff; padding:20px; border-radius:12px; border:1px solid var(--border-color); box-shadow:0 1px 3px rgba(0,0,0,0.05);">
        <div style="display:flex; gap:8px; margin-bottom:20px; align-items:flex-start;">
          <textarea id="memo-input-text" placeholder="새 할 일 추가 (Ctrl+Enter 저장 / 일반 Enter는 줄바꿈)" 
                 style="flex:1; padding:10px 12px; border:2px solid #e2e8f0; border-radius:8px; font-size:1.3rem; outline:none; resize:none; overflow:hidden; min-height:44px; height:44px; font-family:inherit; line-height:1.4; box-sizing:border-box;"
                 onkeydown="if(event.ctrlKey && event.key === 'Enter') { event.preventDefault(); addMemoItem(); }"
                 oninput="this.style.height='44px'; this.style.height = (this.scrollHeight > 44 ? this.scrollHeight : 44) + 'px'"></textarea>
          <button onclick="addMemoItem()" style="background:var(--primary-color); color:#fff; border:none; padding:0 20px; border-radius:8px; font-weight:700; cursor:pointer; font-size:1.2rem; height:44px; white-space:nowrap; box-sizing:border-box; display:flex; align-items:center;">추가</button>
        </div>
        
        <div class="section-title">진행 중인 업무 (${activeMemos.length})</div>
        <div id="active-memo-list">${activeMemos.length === 0 ? '<p style="text-align:center; color:#94a3b8; font-size:1.5rem;">모든 업무를 완료했습니다!</p>' : activeMemos.map((item, i) => generateMemoHTML(item, i, activeMemos.length, false)).join('')}</div>

        <div class="section-title" style="margin-top:30px; display:flex; justify-content:space-between; align-items:center; border-bottom: 2px solid #e2e8f0; padding-bottom: 4px;">
          <span>완료된 업무 (${completedMemos.length})</span>
          ${completedMemos.length > 0 ? `<button onclick="clearCompletedMemos()" style="background:#ef4444; color:#fff; border:none; padding:4px 10px; border-radius:6px; font-size:1.2rem; cursor:pointer;">🗑️ 전체 비우기</button>` : ''}
        </div>
        <div>${completedMemos.length === 0 ? '<p style="text-align:center; color:#94a3b8; font-size:1.5rem; margin-top:20px;">아직 완료된 항목이 없습니다.</p>' : completedMemos.map((item, i) => generateMemoHTML(item, i, completedMemos.length, true)).join('')}</div>
      </div>
    </div>
  `;
  container.innerHTML = html;
  window.renderLinks();
};

window.generateMemoHTML = function(item, index, totalLength, isCompleted) {
  const deleteBtnHtml = isCompleted ? `<button onclick="deleteMemoItem('${item.firestoreId}')" style="background:transparent; border:none; font-size:1.5rem; cursor:pointer;">🗑️</button>` : ``;
  let dragHandleHtml = '';
  let dragAttributes = '';
  
  if (!isCompleted) {
    dragAttributes = `draggable="true" ondragstart="handleDragStart(event, '${item.firestoreId}')" ondragover="handleDragOver(event)" ondrop="handleDrop(event, '${item.firestoreId}')"`;
    dragHandleHtml = `<span style="cursor:grab; font-size:1.8rem; color:#94a3b8; padding-right:8px; line-height:1;" title="드래그하여 순서 변경">≡</span>`;
  }

  return `
    <div class="memo-item" ${dragAttributes} style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%; padding: 8px 0; border-bottom: 1px dashed #f1f5f9; transition: background-color 0.2s;">
      <label style="display:flex; align-items:flex-start; gap:8px; cursor:pointer; flex: 1; padding-right: 10px; margin: 0; min-height: 24px;">
        <div style="padding-top:2px;">${dragHandleHtml}</div>
        <input type="checkbox" ${isCompleted ? 'checked' : ''} onchange="toggleMemoItem('${item.firestoreId}', ${item.completed})" style="width:20px; height:20px; accent-color:var(--primary-color); flex-shrink: 0; margin-top: 4px;">
        <span style="font-size:1.5rem; word-break: break-all; white-space: pre-wrap; line-height:1.4; ${isCompleted ? 'text-decoration:line-through; color:#94a3b8;' : 'color:#1e293b; font-weight:500;'}">${item.text}</span>
      </label>
      <div class="memo-controls" style="display: flex; justify-content: flex-end; padding-top:2px;">${deleteBtnHtml}</div>
    </div>
  `;
};

let draggedMemoId = null;

window.handleDragStart = function(event, id) {
  draggedMemoId = id;
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', id); 
};
window.handleDragOver = function(event) {
  event.preventDefault(); 
  event.dataTransfer.dropEffect = 'move';
};
window.handleDrop = async function(event, targetId) {
  event.preventDefault();
  if (!draggedMemoId || draggedMemoId === targetId) return;

  let activeMemos = window.memoItems.filter(m => !m.completed).sort((a, b) => a.order - b.order);
  const draggedIndex = activeMemos.findIndex(m => m.firestoreId === draggedMemoId);
  const targetIndex = activeMemos.findIndex(m => m.firestoreId === targetId);
  if (draggedIndex === -1 || targetIndex === -1) return;

  const [draggedItem] = activeMemos.splice(draggedIndex, 1);
  activeMemos.splice(targetIndex, 0, draggedItem);
  activeMemos.forEach((memo, index) => { memo.order = index; });

  window.renderMemoView(document.getElementById("main-view"));
  try {
    await Promise.all(activeMemos.map(memo => window.dbAPI.updateMemo(memo.firestoreId, { order: memo.order })));
  } catch (error) { console.error("순서 저장 중 오류 발생:", error); }
  draggedMemoId = null;
};

window.addMemoItem = async function() {
  const input = document.getElementById("memo-input-text");
  if (!input || !input.value.trim()) return;

  const newMemo = { text: input.value.trim(), completed: false, order: -Date.now(), createdAt: Date.now() };
  input.value = "저장 중..."; input.disabled = true;

  await window.dbAPI.addMemo(newMemo); 
  window.renderMemoView(document.getElementById("main-view")); 
};

window.toggleMemoItem = async function(firestoreId, currentStatus) {
  const isNowCompleted = !currentStatus;
  await window.dbAPI.updateMemo(firestoreId, { completed: isNowCompleted, completedAt: isNowCompleted ? Date.now() : null });
  window.renderMemoView(document.getElementById("main-view"));
};

window.deleteMemoItem = async function(firestoreId) {
  if(confirm("이 메모를 완전히 삭제하시겠습니까?")) {
    await window.dbAPI.deleteMemo(firestoreId);
    window.renderMemoView(document.getElementById("main-view"));
  }
};

window.clearCompletedMemos = async function() {
  const completedMemos = window.memoItems.filter(m => m.completed);
  if (completedMemos.length === 0) return;
  if(confirm(`완료된 업무 ${completedMemos.length}개를 모두 삭제하시겠습니까?\n(이 작업은 되돌릴 수 없습니다)`)) {
    await Promise.all(completedMemos.map(memo => window.dbAPI.deleteMemo(memo.firestoreId)));
    window.renderMemoView(document.getElementById("main-view"));
  }
};
