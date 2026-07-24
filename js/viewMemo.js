// js/viewMemo.js

window.renderMemoView = function(container) {  
  let activeMemos = memoItems.filter(m => !m.completed).sort((a, b) => a.order - b.order);
  let completedMemos = memoItems.filter(m => m.completed).sort((a, b) => b.completedAt - a.completedAt);

  let html = `
    <div style="background:#fff; padding:20px; border-radius:12px; border:1px solid var(--border-color); max-width:800px; margin:0 auto;">
      <div style="display:flex; gap:8px; margin-bottom:20px;">
        <input type="text" id="memo-input-text" placeholder="새 할 일 추가 (엔터 입력)..." 
               style="flex:1; padding:10px; border:2px solid #e2e8f0; border-radius:8px; font-size:0.95rem; outline:none;"
               onkeypress="if(event.key === 'Enter') addMemoItem()">
        <button onclick="addMemoItem()" style="background:var(--primary-color); color:#fff; border:none; padding:10px 20px; border-radius:8px; font-weight:700; cursor:pointer;">추가</button>
      </div>
      
      <div class="section-title">진행 중인 업무 (${activeMemos.length})</div>
      <div>${activeMemos.length===0 ? '<p style="text-align:center; color:#94a3b8; font-size:0.9rem;">모든 업무를 완료했습니다!</p>' : activeMemos.map((item, i) => generateMemoHTML(item, i, activeMemos.length, false)).join('')}</div>

      <div class="section-title" style="margin-top:30px;">완료된 업무 (${completedMemos.length})</div>
      <div>${completedMemos.length===0 ? '<p style="text-align:center; color:#94a3b8; font-size:0.9rem;">아직 완료된 항목이 없습니다.</p>' : completedMemos.map((item, i) => generateMemoHTML(item, i, completedMemos.length, true)).join('')}</div>
    </div>
  `;
  container.innerHTML = html;
}

window.generateMemoHTML = function(item, index, totalLength, isCompleted) {    
  return `
    <div class="memo-item">
      <label style="display:flex; align-items:center; gap:12px; cursor:pointer; flex:1;">
        <input type="checkbox" ${isCompleted ? 'checked' : ''} onchange="toggleMemoItem(${item.id})" style="width:20px; height:20px; accent-color:var(--primary-color);">
        <span style="font-size:0.95rem; ${isCompleted ? 'text-decoration:line-through; color:#94a3b8;' : 'color:#1e293b; font-weight:500;'}">${item.text}</span>
      </label>
      <div class="memo-controls">
        ${!isCompleted ? `
          <button class="move-btn" onclick="moveMemo(${item.id}, -1)" ${index === 0 ? 'disabled style="opacity:0.3;"' : ''}>▲</button>
          <button class="move-btn" onclick="moveMemo(${item.id}, 1)" ${index === totalLength - 1 ? 'disabled style="opacity:0.3;"' : ''}>▼</button>
        ` : ''}
        <button onclick="deleteMemoItem(${item.id})" style="background:transparent; border:none; color:#ef4444; font-size:1.2rem; cursor:pointer; margin-left:8px;">&times;</button>
      </div>
    </div>
  `;
}

window.addMemoItem = function() {      
  const input = document.getElementById("memo-input-text");
  if (!input || !input.value.trim()) return;
  const activeMemos = memoItems.filter(m => !m.completed);
  const minOrder = activeMemos.length > 0 ? Math.min(...activeMemos.map(m => m.order)) : 0;
  memoItems.push({ id: Date.now(), text: input.value.trim(), completed: false, order: minOrder - 1, createdAt: Date.now() });
  render();
}

window.toggleMemoItem = function(id) {      
  const item = memoItems.find(m => m.id === id);
  if (item) {
    item.completed = !item.completed;
    if(item.completed) item.completedAt = Date.now();
    render();
  }
}

window.deleteMemoItem = function(id) { memoItems = memoItems.filter(m => m.id !== id); render(); }

window.moveMemo = function(id, direction) {
  let activeMemos = memoItems.filter(m => !m.completed).sort((a, b) => a.order - b.order);
  const currentIndex = activeMemos.findIndex(m => m.id === id);
  if (currentIndex < 0) return;
  const targetIndex = currentIndex + direction;
  if (targetIndex < 0 || targetIndex >= activeMemos.length) return;
  const tempOrder = activeMemos[currentIndex].order;
  activeMemos[currentIndex].order = activeMemos[targetIndex].order;
  activeMemos[targetIndex].order = tempOrder;
  render();
}
