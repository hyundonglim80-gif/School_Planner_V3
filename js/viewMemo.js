// js/viewMemo.js

// 1. 메모 화면 그리기
window.renderMemoView = async function(container) {
  container.innerHTML = `<p style="text-align:center; padding: 40px; color:#64748b; font-weight:bold;">⏳ 클라우드에서 메모를 불러오는 중입니다...</p>`;

  window.memoItems = await window.dbAPI.loadMemos();

  // 진행 중인 업무 (순서 오름차순 정렬)
  let activeMemos = window.memoItems.filter(m => !m.completed).sort((a, b) => a.order - b.order);
  // 완료된 업무 (최근 완료순 정렬)
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

// HTML 생성 도우미 함수 (드래그 앤 드롭 속성 추가)
window.generateMemoHTML = function(item, index, totalLength, isCompleted) {
  // 완료된 항목 삭제 버튼
  const deleteBtnHtml = isCompleted 
    ? `<button onclick="deleteMemoItem('${item.firestoreId}')" style="background:transparent; border:none; font-size:1.5rem; cursor:pointer;">🗑️</button>` 
    : ``;

  // 💡 드래그 앤 드롭을 위한 세 줄 아이콘(≡) 핸들 생성 (진행 중인 업무에만 표시)
  let dragHandleHtml = '';
  let dragAttributes = '';
  
  if (!isCompleted) {
    // 💡 HTML5 표준 Drag & Drop 이벤트 연결
    dragAttributes = `draggable="true" ondragstart="handleDragStart(event, '${item.firestoreId}')" ondragover="handleDragOver(event)" ondrop="handleDrop(event, '${item.firestoreId}')"`;
    dragHandleHtml = `<span style="cursor:grab; font-size:1.8rem; color:#94a3b8; padding-right:8px; line-height:1;" title="드래그하여 순서 변경">≡</span>`;
  }

  return `
    <div class="memo-item" ${dragAttributes} style="display: flex; justify-content: space-between; align-items: center; width: 100%; padding: 8px 0; border-bottom: 1px dashed #f1f5f9; transition: background-color 0.2s;">
      <label style="display:flex; align-items:center; gap:8px; cursor:pointer; flex: 1; padding-right: 10px; margin: 0;">
        ${dragHandleHtml}
        <input type="checkbox" ${isCompleted ? 'checked' : ''} onchange="toggleMemoItem('${item.firestoreId}', ${item.completed})" style="width:20px; height:20px; accent-color:var(--primary-color); flex-shrink: 0;">
        <span style="font-size:1.5rem; word-break: keep-all; ${isCompleted ? 'text-decoration:line-through; color:#94a3b8;' : 'color:#1e293b; font-weight:500;'}">${item.text}</span>
      </label>
      
      <div class="memo-controls" style="display: flex; justify-content: flex-end;">
        ${deleteBtnHtml}
      </div>
    </div>
  `;
};

// ==========================================
// 🚀 [신규] 드래그 앤 드롭(Drag & Drop) 처리 함수 모음
// ==========================================

// 현재 드래그 중인 메모의 ID를 저장하는 전역 변수
let draggedMemoId = null;

// 1) 드래그를 시작할 때
window.handleDragStart = function(event, id) {
  draggedMemoId = id;
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', id); // 호환성을 위한 더미 데이터
};

// 2) 드래그한 항목이 다른 항목 위를 지나갈 때 (Drop 허용 설정)
window.handleDragOver = function(event) {
  event.preventDefault(); // 기본 이벤트를 막아야 Drop이 가능합니다.
  event.dataTransfer.dropEffect = 'move';
};

// 3) 드래그한 항목을 특정 위치에 놓았을 때(Drop)
window.handleDrop = async function(event, targetId) {
  event.preventDefault();
  
  // 드래그된 항목이 없거나 자기 자신 위에 놓은 경우 무시
  if (!draggedMemoId || draggedMemoId === targetId) return;

  // 진행 중인 메모만 가져오기
  let activeMemos = window.memoItems.filter(m => !m.completed).sort((a, b) => a.order - b.order);
  
  const draggedIndex = activeMemos.findIndex(m => m.firestoreId === draggedMemoId);
  const targetIndex = activeMemos.findIndex(m => m.firestoreId === targetId);

  if (draggedIndex === -1 || targetIndex === -1) return;

  // 💡 배열 내에서 요소의 위치 변경 (드래그된 항목을 뽑아서 타겟 위치에 끼워넣기)
  const [draggedItem] = activeMemos.splice(draggedIndex, 1);
  activeMemos.splice(targetIndex, 0, draggedItem);

  // 💡 새롭게 정렬된 순서대로 order 값을 0, 1, 2... 순으로 일괄 재부여
  activeMemos.forEach((memo, index) => {
    memo.order = index;
  });

  // 변경된 순서를 사용자 화면에 즉시 렌더링
  window.render();

  // 클라우드 데이터베이스에 변경된 순서(order) 일괄 업데이트
  try {
    await Promise.all(activeMemos.map(memo => 
      window.dbAPI.updateMemo(memo.firestoreId, { order: memo.order })
    ));
  } catch (error) {
    console.error("순서 저장 중 오류 발생:", error);
  }

  draggedMemoId = null; // 초기화
};
// ==========================================


// 2. 파이어베이스에 새 메모 추가
window.addMemoItem = async function() {
  const input = document.getElementById("memo-input-text");
  if (!input || !input.value.trim()) return;

  const newMemo = {
    text: input.value.trim(),
    completed: false,
    order: -Date.now(), // 💡 새 메모는 마이너스 값으로 무조건 최상단에 배치
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
  const completedMemos = window.memoItems.filter(m => m.completed);
  if (completedMemos.length === 0) return;
  
  if(confirm(`완료된 업무 ${completedMemos.length}개를 모두 삭제하시겠습니까?\n(이 작업은 되돌릴 수 없습니다)`)) {
    await Promise.all(completedMemos.map(memo => window.dbAPI.deleteMemo(memo.firestoreId)));
    window.render();
  }
};
