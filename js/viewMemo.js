// js/viewMemo.js

// 1. 메모 화면 그리기
window.renderMemoView = async function(container) {
  container.innerHTML = `<p style="text-align:center; padding: 40px; color:#64748b; font-weight:bold;">⏳ 클라우드에서 메모를 불러오는 중입니다...</p>`;

  window.memoItems = await window.dbAPI.loadMemos();

  let activeMemos = window.memoItems.filter(m => !m.completed).sort((a, b) => a.order - b.order);
  let completedMemos = window.memoItems.filter(m => m.completed).sort((a, b) => b.completedAt - a.completedAt);

  let html = `
    <div style="background:#fff; padding:20px; border-radius:12px; border:1px solid var(--border-color); max-width:800px; margin:0 auto;">
      <div style="display:flex; gap:8px; margin-bottom:20px;">
        <input type="text" id="memo-input-text" placeholder="새 할 일 추가 (엔터 입력)..." 
               style="flex:1; padding:10px; border:2px solid #e2e8f0; border-radius:8px; font-size:1.5rem; outline:none;"
               onkeypress="if(event.key === 'Enter') addMemoItem()">
        <button onclick="addMemoItem()" style="background:var(--primary-color); color:#fff; border:none; padding:10px 20px; border-radius:8px; font-weight:700; cursor:pointer;">추가</button>
      </div>
      
      <div class="section-title">진행 중인 업무 (${activeMemos.length})</div>
      <div id="active-memo-list">${activeMemos.length === 0 ? '<p style="text-align:center; color:#94a3b8; font-size:1.5rem;">모든 업무를 완료했습니다!</p>' : activeMemos.map((item, i) => generateMemoHTML(item, i, activeMemos.length, false)).join('')}</div>

      <div class="section-title" style="margin-top:30px; display:flex; justify-content:space-between; align-items:center; border-bottom: 2px solid #e2e8f0; padding-bottom: 4px;">
        <span>완료된 업무 (${completedMemos.length})</span>
        ${completedMemos.length > 0 ? `<button onclick="clearCompletedMemos()" style="background:#ef4444; color:#fff; border:none; padding:4px 10px; border-radius:6px; font-size:1.2rem; cursor:pointer;">🗑️ 전체 비우기</button>` : ''}
      </div>
      <div>${completedMemos.length === 0 ? '<p style="text-align:center; color:#94a3b8; font-size:1.5rem; margin-top:20px;">아직 완료된 항목이 없습니다.</p>' : completedMemos.map((item, i) => generateMemoHTML(item, i, completedMemos.length, true)).join('')}</div>
    </div>
  `;
  container.innerHTML = html;
};

// HTML 생성 도우미 함수 (Firestore ID 기준 적용 및 우측 정렬 강제 적용)
window.generateMemoHTML = function(item, index, totalLength, isCompleted) {
  // 완료된 항목에만 우측 끝에 배치될 삭제 버튼 생성
  const deleteBtnHtml = isCompleted 
    ? `<button onclick="deleteMemoItem('${item.firestoreId}')" style="background:transparent; border:none; font-size:1.5rem; cursor:pointer;">🗑️</button>` 
    : ``;

  return `
    <div class="memo-item" style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
      <label style="display:flex; align-items:center; gap:12px; cursor:pointer; flex: 1; padding-right: 10px;">
        <input type="checkbox" ${isCompleted ? 'checked' : ''} onchange="toggleMemoItem('${item.firestoreId}', ${item.completed})" style="width:20px; height:20px; accent-color:var(--primary-color); flex-shrink: 0;">
        <span style="font-size:1.5rem; word-break: keep-all; ${isCompleted ? 'text-decoration:line-through; color:#94a3b8;' : 'color:#1e293b; font-weight:500;'}">${item.text}</span>
      </label>
      
      <div class="memo-controls" style="display: flex; justify-content: flex-end;">
        ${deleteBtnHtml}
      </div>
    </div>
  `;
};

// 2. 파이어베이스에 새 메모 추가
window.addMemoItem = async function() {
  const input = document.getElementById("memo-input-text");
  if (!input || !input.value.trim()) return;

  const newMemo = {
    text: input.value.trim(),
    completed: false,
    order: window.memoItems.length,
    createdAt: Date.now()
  };

  input.value = "저장 중..."; 
  input.disabled = true;

  await window.dbAPI.addMemo(newMemo); 
  window.render(); 
};

// 3. 파이어베이스의 메모 상태(완료/미완료) 변경
window.toggleMemoItem = async function(firestoreId, currentStatus) {
  const isNowCompleted = !currentStatus;
  await window.dbAPI.updateMemo(firestoreId, {
    completed: isNowCompleted,
    completedAt: isNowCompleted ? Date.now() : null
  });
  window.render();
};

// 4. 파이어베이스에서 메모 삭제
window.deleteMemoItem = async function(firestoreId) {
  if(confirm("이 메모를 완전히 삭제하시겠습니까?")) {
    await window.dbAPI.deleteMemo(firestoreId);
    window.render();
  }
};

// 5. 완료된 메모 전체 삭제 (휴지통 비우기)
window.clearCompletedMemos = async function() {
  // 완료된 항목들만 모아서 가져오기
  const completedMemos = window.memoItems.filter(m => m.completed);
  if (completedMemos.length === 0) return;
  
  if(confirm(`완료된 업무 ${completedMemos.length}개를 모두 삭제하시겠습니까?\n(이 작업은 되돌릴 수 없습니다)`)) {
    // 모든 삭제 요청을 동시에 처리하여 속도 최적화 (Promise.all)
    await Promise.all(completedMemos.map(memo => window.dbAPI.deleteMemo(memo.firestoreId)));
    
    // 삭제 완료 후 화면 새로고침
    window.render();
  }
};
