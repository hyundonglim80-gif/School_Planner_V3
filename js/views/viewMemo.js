// js/views/viewMemo.js
import { BaseView } from '../components/BaseView.js';
import { store } from '../core/store.js';
import { dbAPI, getUserCol } from '../api/database.js'; 
import { auth } from '../api/firebaseInit.js'; 
import { driveAPI } from '../api/driveAPI.js'; 
import { doc, getDoc, setDoc } from "firebase/firestore";

export class MemoView extends BaseView {
  constructor(container) {
    super(container);
    this.currentLinks = [];
    this.memoItems = [];
    this.draggedMemoId = null;
    this.currentNewLabels = []; 
    this.AVAILABLE_LABELS = [];
    this.currentFilter = '전체'; 
    this.pendingAttachments = []; 
    this.isUploading = false;
    this.myGroups = [];
    this.currentNewMemoGroupId = null; 
    this.activeGroupFilters = null;
    this.isAllGroupsVisible = true;
    this.lastInteractedMemo = null; // 🌟 라벨 팝업 유지용 상태 변수 추가
  }

  loadMemoLabels() {
      const savedLabels = JSON.parse(localStorage.getItem('workCalendar_memoLabels'));
      if (savedLabels && savedLabels.length > 0) {
          this.AVAILABLE_LABELS = savedLabels.map(l => typeof l === 'string' ? { id: 'memo_' + l, name: l, color: 'gray' } : l);
      } else {
          this.AVAILABLE_LABELS = [
              { id: 'memo_1', name: '긴급', color: 'red' }, { id: 'memo_2', name: '중요', color: 'orange' },
              { id: 'memo_3', name: '학급운영', color: 'blue' }, { id: 'memo_4', name: '학부모상담', color: 'green' },
              { id: 'memo_5', name: '수업준비', color: 'purple' }, { id: 'memo_6', name: '행정업무', color: 'gray' },
              { id: 'memo_7', name: '개인', color: 'indigo' }
          ];
      }
  }

  setFilter(labelName) {
      this.currentFilter = labelName;
      this._drawHTML();
  }

  toggleGroupFilter(groupId) {
      if (!this.activeGroupFilters) this.activeGroupFilters = ['personal'];
      if (this.activeGroupFilters.includes(groupId)) {
          if (this.activeGroupFilters.length > 1) this.activeGroupFilters = this.activeGroupFilters.filter(id => id !== groupId);
      } else this.activeGroupFilters.push(groupId);
      this._drawHTML();
  }

  renderLabelChips(containerElement, selectedLabelsArray, onChangeCallback) {
    if (!containerElement) return;
    containerElement.innerHTML = '';
    containerElement.style.margin = "0"; containerElement.style.display = "flex";
    containerElement.style.flexWrap = "wrap"; containerElement.style.gap = "4px";
    const palette = window.LABEL_PALETTE || {};

    this.AVAILABLE_LABELS.forEach(labelObj => {
        const labelName = labelObj.name;
        const chip = document.createElement('div');
        chip.className = 'label-chip'; chip.innerText = labelName;
        const colorStyle = palette[labelObj.color] || palette['purple'];

        if (selectedLabelsArray.includes(labelName)) {
            chip.classList.add('active');
            chip.style.backgroundColor = colorStyle.bg; chip.style.color = colorStyle.text; chip.style.borderColor = colorStyle.border;
        }
        
        chip.addEventListener('click', () => {
            if (selectedLabelsArray.includes(labelName)) {
                selectedLabelsArray = selectedLabelsArray.filter(l => l !== labelName);
                chip.classList.remove('active');
                chip.style.backgroundColor = ''; chip.style.color = ''; chip.style.borderColor = '';
            } else {
                selectedLabelsArray.push(labelName);
                chip.classList.add('active');
                chip.style.backgroundColor = colorStyle.bg; chip.style.color = colorStyle.text; chip.style.borderColor = colorStyle.border;
            }
            if (onChangeCallback) onChangeCallback(selectedLabelsArray);
        });
        containerElement.appendChild(chip);
    });
  }

  // 🌟 (신규 메모용) 상단 파일 업로드
  async handleFileUpload(inputElement) {
      const files = inputElement.files;
      if (!files || files.length === 0) return;
      
      this.isUploading = true; 
      this.renderViewer(); 

      try {
          const uploadedFiles = await driveAPI.uploadFiles(files);
          if (!this.pendingAttachments) this.pendingAttachments = [];
          this.pendingAttachments.push(...uploadedFiles);
          store.hasUnsavedChanges = true;
      } catch (error) {
          console.error("파일 업로드 실패:", error);
          alert("파일 업로드 중 오류가 발생했습니다.");
      } finally {
          this.isUploading = false; 
          inputElement.value = ''; 
          this.renderViewer(); 
      }
  }
  
  cancelPendingAttachment(index) {
      if (this.pendingAttachments && this.pendingAttachments[index]) {
          const target = this.pendingAttachments[index];
          driveAPI.deleteFile(target.id).catch(e => console.warn(e));
          this.pendingAttachments.splice(index, 1);
          
          const input = document.getElementById("memo-input-text");
          store.hasUnsavedChanges = (input && input.value.trim() !== '') || (this.pendingAttachments.length > 0);
          this.renderViewer();
      }
  }

  // 🌟 [추가됨] (기존 메모용) 파일 첨부 업로드 함수
  async handleMemoItemAttachmentUpload(firestoreId, inputEl) {
      const files = inputEl.files;
      if (!files || files.length === 0) return;

      const item = this.memoItems.find(m => m.firestoreId === firestoreId);
      if (!item) return;

      item.isUploading = true;
      this._drawHTML();

      try {
          const uploadedFiles = await driveAPI.uploadFiles(files);
          if (!item.attachments) item.attachments = [];
          item.attachments.push(...uploadedFiles);
          await dbAPI.updateMemo(firestoreId, { attachments: item.attachments }, item.groupId);
      } catch (err) {
          console.error(err);
          alert("파일 업로드 중 오류가 발생했습니다: " + err.message);
      } finally {
          item.isUploading = false;
          inputEl.value = '';
          this._drawHTML();
      }
  }

  // 🌟 [추가됨] (기존 메모용) 첨부파일 삭제 함수
  removeMemoAttachment(firestoreId, aIdx) {
      if (confirm("첨부된 파일 링크를 삭제하시겠습니까?\n(※ 구글 드라이브의 실제 파일은 삭제되지 않습니다.)")) {
          const item = this.memoItems.find(m => m.firestoreId === firestoreId);
          if (item && item.attachments) {
              const targetAttachment = item.attachments[aIdx];
              if (targetAttachment && targetAttachment.id) {
                  driveAPI.deleteFile(targetAttachment.id).catch(e => console.warn(e));
              }
              item.attachments.splice(aIdx, 1);
              dbAPI.updateMemo(firestoreId, { attachments: item.attachments }, item.groupId).catch(e => console.warn(e));
              this._drawHTML();
          }
      }
  }

  async fetchAllMemos() {
      try { this.myGroups = await dbAPI.loadMyGroups(); } catch(e) { this.myGroups = []; }
      let allMemos = [];
      try {
          allMemos = await dbAPI.loadMemos(); 
          for (const group of this.myGroups) {
              const groupMemos = await dbAPI.loadGroupMemos(group.id);
              groupMemos.forEach(m => { m.groupName = group.name; });
              allMemos = allMemos.concat(groupMemos);
          }
      } catch (e) {
          if (window.promptOfflineSync && await window.promptOfflineSync(this, 'renderViewer')) {
              return null; 
          }
      }
      return allMemos;
  }

  async renderViewer() {
    setTimeout(() => {
        const headers = document.querySelectorAll('h1, h2, h3, .page-title, #page-title, .title');
        headers.forEach(el => {
            if (el.textContent && el.textContent.includes('할 일 및 메모')) { el.textContent = ''; if (el.nextElementSibling) el.nextElementSibling.textContent = ''; }
        });
    }, 10);

    if (window.targetMemoId) this.currentFilter = '전체'; 

    if (!this.memoItems || this.memoItems.length === 0) {
        this.showLoading('클라우드에서 데이터(개인 및 공유)를 불러오는 중입니다...');
        const data = await this.fetchAllMemos();
        if (data === null) return; 
        this.memoItems = data;
        this.loadMemoLabels(); this._drawHTML();
    } else {
        this.fetchAllMemos().then(data => {
            if (data === null) return; 
            this.memoItems = data; this.loadMemoLabels();
            if (!this.isUploading) this._drawHTML(); 
        });
    }
  }

  autoResizeTextarea(textarea) {
      store.hasUnsavedChanges = (textarea.value.trim() !== '' || (this.pendingAttachments && this.pendingAttachments.length > 0));
      textarea.style.height = '50px'; 
      if (textarea.scrollHeight > 50) textarea.style.height = textarea.scrollHeight + 'px'; 
  }

  setNewMemoGroup(groupId) {
      this.currentNewMemoGroupId = groupId;
      document.querySelectorAll('.group-toggle-chip').forEach(el => {
          const val = el.getAttribute('data-value');
          const targetVal = groupId === null ? 'personal' : String(groupId);
          if (val === targetVal) el.classList.add('active');
          else el.classList.remove('active');
      });
  }

  _drawHTML() {
    if (!this.activeGroupFilters) this.activeGroupFilters = ['personal', ...this.myGroups.map(g => g.id)];
    this.isAllGroupsVisible = this.activeGroupFilters.length === (this.myGroups.length + 1);

    let filteredMemos = this.memoItems.filter(m => {
        const gId = m.groupId || 'personal';
        if (!this.activeGroupFilters.includes(gId)) return false;
        if (this.currentFilter !== '전체' && (!m.labels || !m.labels.includes(this.currentFilter))) return false;
        return true;
    });

    let activeMemos = filteredMemos.filter(m => !m.completed).sort((a, b) => a.order - b.order);
    let completedMemos = filteredMemos.filter(m => m.completed).sort((a, b) => b.completedAt - a.completedAt);
    const allActiveMemos = this.memoItems.filter(m => !m.completed);
    
    const allCount = allActiveMemos.length;
    const labelCounts = {};
    this.AVAILABLE_LABELS.forEach(lObj => { labelCounts[lObj.name] = allActiveMemos.filter(m => m.labels && m.labels.includes(lObj.name)).length; });

    const groupCounts = { personal: 0 }; this.myGroups.forEach(g => groupCounts[g.id] = 0);
    allActiveMemos.forEach(m => { const gId = m.groupId || 'personal'; if (groupCounts[gId] !== undefined) groupCounts[gId]++; });

    const isPersonalActive = this.activeGroupFilters.includes('personal');
    const personalGroupHtml = `
        <div class="label-chip ${isPersonalActive ? 'active' : ''}" onclick="window.memoViewInstance.toggleGroupFilter('personal')" style="justify-content:space-between; display:flex; align-items:center;">
            <span>🔒 개인</span><span style="background:rgba(0,0,0,0.1); padding:2px 8px; border-radius:12px; font-size:0.75rem; color:inherit;">${groupCounts['personal']}</span>
        </div>`;

    const myGroupsHtml = this.myGroups.map(g => {
        const isActive = this.activeGroupFilters.includes(g.id);
        return `
            <div class="label-chip ${isActive ? 'active' : ''}" onclick="window.memoViewInstance.toggleGroupFilter('${g.id}')" style="justify-content:space-between; display:flex; align-items:center;">
                <span>👥 ${g.name}</span><span style="background:rgba(0,0,0,0.1); padding:2px 8px; border-radius:12px; font-size:0.75rem; color:inherit;">${groupCounts[g.id]}</span>
            </div>`;
    }).join('');

    let attachmentPreviewHtml = '';
    if (this.isUploading) {
        attachmentPreviewHtml = `<div style="padding: 10px; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; color: #3b82f6; font-weight: bold; text-align: center; margin-top: 5px;">⏳ 구글 드라이브로 파일 업로드 중...</div>`;
    } else if (this.pendingAttachments && this.pendingAttachments.length > 0) {
        attachmentPreviewHtml = `<div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:8px;">` + this.pendingAttachments.map((a, idx) => {
            const downloadUrl = a.downloadLink || `https://drive.google.com/uc?export=download&id=${a.id}`;
            return `
            <div onclick="window.handleAttachmentClick('${a.name}', '${a.webViewLink}', '${downloadUrl}')" style="display:inline-flex; align-items:center; gap:6px; padding:4px 8px; background:#f8fafc; border:1px solid #cbd5e1; border-radius:6px; font-size:0.85rem; color:#0f172a; cursor:pointer;">
                <img src="${a.iconLink || 'https://upload.wikimedia.org/wikipedia/commons/1/12/Google_Drive_icon_%282020%29.svg'}" style="width:16px; height:16px;">
                <span data-tooltip="${a.name}" style="max-width:150px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-weight:bold;">${a.name}</span>
                <button onclick="event.stopPropagation(); window.memoViewInstance.cancelPendingAttachment(${idx})" style="background:#ef4444; color:white; border:none; border-radius:50%; width:16px; height:16px; font-size:10px; cursor:pointer; display:flex; align-items:center; justify-content:center; margin-left:4px;" title="첨부 링크 삭제">✖</button>
            </div>`;
        }).join('') + `</div>`;
    }

    const newMemoGroupChipsHtml = `
        <div class="group-toggle-wrap">
            <button class="group-toggle-chip ${!this.currentNewMemoGroupId ? 'active' : ''}" data-value="personal" onclick="window.memoViewInstance.setNewMemoGroup(null)">🔒 개인 메모</button>
            ${this.myGroups.map(g => `<button class="group-toggle-chip ${this.currentNewMemoGroupId === g.id ? 'active' : ''}" data-value="${g.id}" onclick="window.memoViewInstance.setNewMemoGroup('${g.id}')">👥 ${g.name} 공유</button>`).join('')}
        </div>
    `;

    let html = `
      <div class="memo-layout-container">
        <div class="memo-card-panel" style="padding: 15px 20px;">
          <div class="memo-panel-header">
            <h3 style="margin:0; font-size:1.2rem; color:#1e40af; display:flex; align-items:center; gap:6px;">🔗 자주 쓰는 문서/링크</h3>
            <button onclick="window.QuickLinksManager.openSettingsModal()" class="modal-btn-secondary" style="background:#f1f5f9; color:#334155; border:1px solid #cbd5e1; font-weight:bold;">⚙️ 링크 설정</button>
          </div>
          <div id="quick-links-container" style="display:flex; flex-wrap:wrap; align-items:center;"></div>
        </div>

        <div class="memo-card-panel">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
              <div id="memo-add-labels" class="label-chip-container" style="flex: 1; margin: 0; padding-right: 10px;"></div>
              <div style="display:flex; align-items:center; gap:8px;">
                  ${newMemoGroupChipsHtml}
                  <button onclick="window.openMemoLabelModal()" class="memo-btn-icon" style="height:auto; padding:6px 12px; font-size:0.85rem; font-weight:bold;">⚙️ 설정</button>
              </div>
          </div>
          <div class="memo-add-controls">
            <textarea id="memo-input-text" class="memo-textarea" placeholder="새 할 일이나 공유할 메모를 추가하세요" 
                   onkeydown="if(event.ctrlKey && event.key === 'Enter') { event.preventDefault(); window.memoViewInstance.addMemoItem(); }"
                   oninput="window.memoViewInstance.autoResizeTextarea(this)"></textarea>
            
            <button onclick="document.getElementById('memo-file-upload').click()" class="memo-btn-icon" title="파일/문서 첨부">📎</button>
            <input type="file" id="memo-file-upload" multiple style="display:none;" onchange="window.memoViewInstance.handleFileUpload(this)">
            
            <button onclick="window.memoViewInstance.addMemoItem()" class="memo-btn-submit">추가</button>
          </div>
          ${attachmentPreviewHtml}
        </div>

        <div class="memo-content-layout">
            <div class="memo-sidebar">
                <div style="font-weight:bold; color:#1e40af; border-bottom:2px solid #f1f5f9; padding-bottom:8px; margin-bottom:4px;">📁 라벨 필터</div>
                <div class="label-chip ${this.currentFilter === '전체' ? 'active' : ''}" onclick="window.memoViewInstance.setFilter('전체')" style="justify-content:space-between; display:flex; align-items:center;">
                    <span>👀 전체</span><span style="background:rgba(0,0,0,0.1); padding:2px 8px; border-radius:12px; font-size:0.75rem; font-weight:bold; color:inherit;">${allCount}</span>
                </div>
                ${this.AVAILABLE_LABELS.map(lObj => `
                    <div class="label-chip ${this.currentFilter === lObj.name ? 'active' : ''}" onclick="window.memoViewInstance.setFilter('${lObj.name}')" style="justify-content:space-between; display:flex; align-items:center;">
                        <span>${lObj.name}</span><span style="background:rgba(0,0,0,0.1); padding:2px 8px; border-radius:12px; font-size:0.75rem; font-weight:bold; color:inherit;">${labelCounts[lObj.name]}</span>
                    </div>`).join('')}

                <div style="font-weight:bold; color:#0f766e; border-bottom:2px solid #f1f5f9; padding-bottom:8px; margin-top:12px; margin-bottom:4px;">👥 그룹 필터</div>
                ${personalGroupHtml}
                ${myGroupsHtml}
            </div>

            <div class="memo-main-area">
                <div style="margin-bottom:5px; font-weight:bold; font-size:1.1rem; color:#0f172a;">진행 (${activeMemos.length})</div>
                <div id="active-memo-list">${activeMemos.length === 0 ? `<p style="text-align:center; color:#94a3b8; font-size:1.1rem; padding: 20px 0;">조건에 맞는 메모가 없습니다.</p>` : activeMemos.map((item, i) => this.generateMemoHTML(item, false)).join('')}</div>

                <div style="margin-top:30px; display:flex; justify-content:space-between; align-items:center; border-bottom: 2px solid #e2e8f0; padding-bottom: 4px; font-weight:bold; font-size:1.1rem; color:#0f172a;">
                  <span>완료 (${completedMemos.length})</span>
                  ${completedMemos.length > 0 ? `<button onclick="window.memoViewInstance.clearCompletedMemos()" class="modal-delete-btn" style="background:#ef4444; color:#fff; padding:4px 10px; border-radius:6px; font-size:1rem;">🗑️ 전체 비우기</button>` : ''}
                </div>
                <div>${completedMemos.length === 0 ? '<p style="text-align:center; color:#94a3b8; font-size:1.1rem; margin-top:20px;">아직 완료된 항목이 없습니다.</p>' : completedMemos.map((item, i) => this.generateMemoHTML(item, true)).join('')}</div>
            </div>
        </div>
      </div>
    `;
    this.container.innerHTML = html;
    
    this.currentNewLabels = this.currentFilter !== '전체' ? [this.currentFilter] : (this.AVAILABLE_LABELS.length > 0 ? [this.AVAILABLE_LABELS[0].name] : []);
    this.renderLabelChips(document.getElementById('memo-add-labels'), this.currentNewLabels, (updatedLabels) => {
        this.currentNewLabels = updatedLabels;
    });

    if (window.QuickLinksManager) window.QuickLinksManager.renderLinks();

    if (window.targetMemoId) {
        const targetId = window.targetMemoId; window.targetMemoId = null; 
        setTimeout(() => {
            const targetEl = document.getElementById(`memo-card-${targetId}`);
            if (targetEl) {
                targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                const originalBg = targetEl.style.backgroundColor || '';
                targetEl.style.transition = 'background-color 0.4s ease';
                targetEl.style.backgroundColor = '#fef08a'; 
                setTimeout(() => { targetEl.style.backgroundColor = originalBg; setTimeout(() => { targetEl.style.transition = ''; }, 400); }, 1200);
            }
        }, 300); 
    }
  }

  async renderEditor() { this.renderViewer(); }

  generateMemoHTML(item, isCompleted) {
    const uid = auth?.currentUser?.uid;
    const isAuthor = !item.authorId || !uid || item.authorId === uid;

    const deleteBtnHtml = isAuthor ? `<button onclick="window.memoViewInstance.deleteMemoItem('${item.firestoreId}')" class="modal-delete-btn" title="삭제" style="font-size:1.3rem; margin-left:4px; padding:0; line-height:1;">🗑️</button>` : '';

    let dragHandleHtml = ''; let dragAttributes = '';
    if (!isCompleted && this.currentFilter === '전체' && this.isAllGroupsVisible && isAuthor) {
      dragAttributes = `draggable="true" ondragstart="window.memoViewInstance.handleDragStart(event, '${item.firestoreId}')" ondragover="window.memoViewInstance.handleDragOver(event)" ondrop="window.memoViewInstance.handleDrop(event, '${item.firestoreId}')"`;
      dragHandleHtml = `<span style="cursor:grab; font-size:1.8rem; color:#94a3b8; padding-right:8px; line-height:1;" title="드래그하여 순서 변경">≡</span>`;
    } else {
      let titleMsg = isAuthor ? '필터 적용 중에는 순서 변경 불가' : '읽기 전용 메모는 순서 변경 불가';
      dragHandleHtml = `<span style="font-size:1.8rem; color:#cbd5e1; padding-right:8px; line-height:1; cursor:not-allowed;" title="${titleMsg}">≡</span>`;
    }

    const labels = item.labels || [];
    const palette = window.LABEL_PALETTE || {};
    const knownLabelNames = this.AVAILABLE_LABELS.map(l => l.name);
    const unknownLabels = labels.filter(l => !knownLabelNames.includes(l));
    
    let allLabelsHtml = this.AVAILABLE_LABELS.map(lObj => {
        const lName = lObj.name; const isActive = labels.includes(lName);
        const colorStyle = palette[lObj.color] || palette['purple'];
        const activeStyle = isActive ? `background-color: ${colorStyle.bg}; color: ${colorStyle.text}; border-color: ${colorStyle.border}; font-weight: bold;` : ``;
        const clickAction = (isCompleted || !isAuthor) ? '' : `onclick="window.memoViewInstance.toggleMemoItemLabel('${item.firestoreId}', '${lName}')"`;
        const cursorStyle = (isCompleted || !isAuthor) ? 'cursor: default;' : 'cursor: pointer;';
        return `<div class="label-chip ${isActive ? 'active' : ''}" ${clickAction} style="padding: 2px 8px; font-size: 0.8rem; min-width: auto; ${activeStyle} ${cursorStyle}">${lName}</div>`;
    }).join('');

    unknownLabels.forEach(lName => { allLabelsHtml += `<div class="label-chip active" style="padding: 2px 8px; font-size: 0.8rem; min-width: auto; background-color: #f1f5f9; color: #475569; border-color: #cbd5e1; font-weight: bold; cursor: default;">${lName}</div>`; });

    let groupButtonsHtml = '';
    if (isAuthor) {
        groupButtonsHtml = `
            <div class="group-toggle-wrap" style="margin:0;">
                <button class="group-toggle-chip ${!item.groupId ? 'active' : ''}" onclick="window.memoViewInstance.changeMemoGroup('${item.firestoreId}', null)">🔒 개인</button>
                ${this.myGroups.map(g => `<button class="group-toggle-chip ${item.groupId === g.id ? 'active' : ''}" onclick="window.memoViewInstance.changeMemoGroup('${item.firestoreId}', '${g.id}')">👥 ${g.name}</button>`).join('')}
            </div>`;
    } else {
        groupButtonsHtml = `<div style="padding:3px 8px; font-size:0.75rem; border-radius:4px; font-weight:bold; background:#e0f2fe; color:#0369a1; border:1px solid #bae6fd;">👥 ${item.groupName} (읽기전용)</div>`;
    }
        
    let attachmentsHtml = '';
    if (item.attachments && item.attachments.length > 0) {
        attachmentsHtml = `<div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:8px;">` + item.attachments.map((a, aIdx) => {
            const downloadUrl = a.downloadLink || `https://drive.google.com/uc?export=download&id=${a.id}`;
            const delBtn = isAuthor && !isCompleted ? `<button onclick="event.stopPropagation(); window.memoViewInstance.removeMemoAttachment('${item.firestoreId}', ${aIdx})" style="background:#ef4444; color:white; border:none; border-radius:50%; width:16px; height:16px; font-size:10px; cursor:pointer; display:flex; align-items:center; justify-content:center; margin-left:4px;" title="첨부 링크 삭제">✖</button>` : '';
            return `
            <div onclick="window.handleAttachmentClick('${a.name}', '${a.webViewLink}', '${downloadUrl}')" style="display:inline-flex; align-items:center; gap:6px; padding:4px 10px; background:#f8fafc; border:1px solid #cbd5e1; border-radius:6px; font-size:0.85rem; color:#0f172a; cursor:pointer; font-weight:bold; transition:0.2s;" onmouseover="this.style.background='#e2e8f0'" onmouseout="this.style.background='#f8fafc'">
                <img src="${a.iconLink || 'https://upload.wikimedia.org/wikipedia/commons/1/12/Google_Drive_icon_%282020%29.svg'}" style="width:16px; height:16px;">
                <span data-tooltip="${a.name}" style="max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${a.name}</span>
                ${delBtn}
            </div>`;
        }).join('') + `</div>`;
    } else if (item.imageUrl) {
        attachmentsHtml = `<div style="margin-top: 8px;"><img src="${item.imageUrl}" onclick="window.openImageViewer('${item.imageUrl}')" style="max-height: 80px; border-radius: 6px; border: 1px solid #cbd5e1; cursor: zoom-in; box-shadow: 0 1px 3px rgba(0,0,0,0.1);"></div>`;
    }

    const textStatusClass = isCompleted ? 'completed' : (isAuthor ? 'active' : 'readonly');
    
    // 🌟 [UI 개선] 등록된 메모는 포커스 될 때만 라벨 버튼을 표출하고, 우측에 첨부 버튼 고정
    const hasAttachments = (item.attachments && item.attachments.length > 0) || item.imageUrl ? 'true' : 'false';
    const isRegistered = (item.text || '').trim() !== '' || hasAttachments === 'true';
    const forceShow = this.lastInteractedMemo === item.firestoreId;
    const hideCondition = isRegistered && !forceShow && isAuthor && !isCompleted;
    const finalLabelsDisplay = hideCondition ? 'none' : 'flex';

    const focusHandler = `document.getElementById('memo-labels-${item.firestoreId}').style.display='flex'; window.memoViewInstance.lastInteractedMemo='${item.firestoreId}';`;
    const blurHandler = `window.memoViewInstance.updateMemoText('${item.firestoreId}', this.innerText); setTimeout(() => { if(window.memoViewInstance.lastInteractedMemo !== '${item.firestoreId}') { const el = document.getElementById('memo-labels-${item.firestoreId}'); if(el) el.style.display='none'; } }, 250);`;
    const editableAttr = (isCompleted || !isAuthor) ? '' : `contenteditable="true" onfocus="${focusHandler}" onblur="${blurHandler}" onkeydown="if(event.ctrlKey && event.key === 'Enter') { event.preventDefault(); this.blur(); }"`;

    const uploadId = `memo-upload-${item.firestoreId}`;
    const isUploadingHtml = item.isUploading ? `<div style="margin-top:8px; font-size:0.85rem; color:#2563eb; font-weight:bold; display:flex; align-items:center; gap:6px;">⏳ 구글 드라이브로 파일 업로드 중...</div>` : '';

    return `
      <div id="memo-card-${item.firestoreId}" class="memo-item-row" style="position:relative; padding-top:12px;" ${dragAttributes}>
        <!-- Top Right Delete Button -->
        ${isAuthor ? `<div style="position:absolute; top:8px; right:8px;">${deleteBtnHtml}</div>` : ''}
        
        <!-- Middle Row: Labels, Group, Attach Button -->
        // [추가된 부분] 공유 그룹일 때 작성자 배지 생성 로직을 return 템플릿 직전에 추가
            const isSharedGroup = item.groupId && item.groupId !== 'personal';
            const authorBadge = (isSharedGroup && item.authorId)
                ? `<div style="padding:3px 8px; font-size:0.75rem; border-radius:4px; font-weight:bold; background:#f1f5f9; color:#475569; border:1px solid #cbd5e1;" title="작성자 고유ID">👤 ${item.authorId.substring(0, 6)}</div>`
                : '';

            return `
              <div id="memo-card-${item.firestoreId}" class="memo-item-row" style="position:relative; padding-top:12px;" ${dragAttributes}>
                <!-- Top Right Delete Button -->
                ${isAuthor ? `<div style="position:absolute; top:8px; right:8px;">${deleteBtnHtml}</div>` : ''}
                
                <!-- Middle Row: Labels, Group, Attach Button -->
                <div style="display:flex; justify-content:space-between; align-items:flex-start; padding-right:24px; min-height:24px; margin-bottom:8px;">
                    <div id="memo-labels-${item.firestoreId}" class="label-chip-container" style="margin:0; display:${finalLabelsDisplay}; flex-wrap:wrap; gap:4px; transition:0.2s; flex:1;">
                        ${allLabelsHtml}
                    </div>
                    
                    <div style="display:flex; align-items:center; gap:8px; flex-shrink:0; margin-left:8px;">
                        ${groupButtonsHtml}
                        ${authorBadge} <!-- [추가된 부분] 그룹 버튼과 첨부 버튼 사이에 삽입 -->
                        ${isAuthor && !isCompleted ? `
                        <button onclick="document.getElementById('${uploadId}').click()" style="background:#f1f5f9; color:#475569; border:1px solid #cbd5e1; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:0.85rem; display:flex; align-items:center; gap:4px; box-shadow:0 1px 2px rgba(0,0,0,0.05); transition:0.2s;" title="파일 첨부">📎 첨부</button>
                        <input type="file" id="${uploadId}" multiple style="display:none;" onchange="window.memoViewInstance.handleMemoItemAttachmentUpload('${item.firestoreId}', this)">
                        ` : ''}
                    </div>
                </div>
        
        <!-- Checkbox, Drag Handle, Text, Attachments -->
        <div style="display: flex; align-items: flex-start; gap: 8px; width: 100%;">
          <div style="padding-top:2px;">${dragHandleHtml}</div>
          <input type="checkbox" ${isCompleted ? 'checked' : ''} ${!isAuthor ? 'disabled' : ''} onchange="window.memoViewInstance.toggleMemoItem('${item.firestoreId}', ${item.completed})" style="width:20px; height:20px; accent-color:var(--primary-color); flex-shrink: 0; margin-top: 4px; cursor:pointer;">
          <div style="flex: 1; display: flex; flex-direction: column; min-width: 0;">
             <span id="memo-span-${item.firestoreId}" ${editableAttr} class="memo-text-content ${textStatusClass}" style="outline:none;">${item.text}</span>
             ${isUploadingHtml}
             ${attachmentsHtml}
          </div>
        </div>
      </div>
    `;
  }

  toggleMemoItem(firestoreId, currentStatus) {
    const isNowCompleted = !currentStatus;
    const target = this.memoItems.find(m => m.firestoreId === firestoreId);
    if (target) {
        target.completed = isNowCompleted;
        target.completedAt = isNowCompleted ? Date.now() : null;
        this._drawHTML();
        dbAPI.updateMemo(firestoreId, { completed: isNowCompleted, completedAt: isNowCompleted ? Date.now() : null }, target.groupId).catch(e => console.warn(e));
    }
  }

  async changeMemoGroup(firestoreId, newGroupId) {
      const item = this.memoItems.find(m => m.firestoreId === firestoreId);
      if (!item) return;
      const oldGroupId = item.groupId || null; const targetGroupId = newGroupId || null;
      if (oldGroupId === targetGroupId) return;

      const dataToMove = {
          text: item.text, completed: item.completed, order: item.order, createdAt: item.createdAt,
          updatedAt: Date.now(), labels: item.labels || [], attachments: item.attachments || [], authorId: item.authorId || auth?.currentUser?.uid 
      };
      if (item.completedAt) dataToMove.completedAt = item.completedAt;

      try {
          await dbAPI.deleteMemo(firestoreId, oldGroupId);
          await dbAPI.addMemo(dataToMove, targetGroupId);
          this.renderViewer();
      } catch (e) { alert("공유 상태를 변경하는 중 오류가 발생했습니다."); }
  }

  toggleMemoItemLabel(firestoreId, labelName) {
      const item = this.memoItems.find(m => m.firestoreId === firestoreId);
      if (!item) return;
      this.lastInteractedMemo = firestoreId; 
      
      let labels = item.labels || [];
      if (labels.includes(labelName)) labels = labels.filter(l => l !== labelName);
      else labels.push(labelName);
      item.labels = labels; 
      
      dbAPI.updateMemo(firestoreId, { labels: labels }, item.groupId).catch(e => console.warn(e)); 
      this._drawHTML();
      
      setTimeout(() => {
          const span = document.getElementById(`memo-span-${firestoreId}`);
          if (span) {
              span.focus();
              if (typeof window.getSelection !== "undefined" && typeof document.createRange !== "undefined") {
                  const range = document.createRange();
                  range.selectNodeContents(span);
                  range.collapse(false);
                  const sel = window.getSelection();
                  sel.removeAllRanges();
                  sel.addRange(range);
              }
          }
      }, 50);
  }

  updateMemoText(firestoreId, newText) {
    const text = newText.trim();
    const target = this.memoItems.find(m => m.firestoreId === firestoreId);
    if (!text && target && (!target.attachments || target.attachments.length === 0)) { alert("메모 내용이나 파일은 필수입니다."); this.renderViewer(); return; }
    if (target && target.text !== text) {
        target.text = text; dbAPI.updateMemo(firestoreId, { text: text }, target.groupId).catch(e => console.warn(e)); 
    }
  }

  handleDragStart(event, id) { this.draggedMemoId = id; event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', id); }
  handleDragOver(event) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; }

  handleDrop(event, targetId) {
    event.preventDefault();
    if (!this.draggedMemoId || this.draggedMemoId === targetId) return;

    let activeMemos = this.memoItems.filter(m => !m.completed).sort((a, b) => a.order - b.order);
    const draggedIndex = activeMemos.findIndex(m => m.firestoreId === this.draggedMemoId);
    const targetIndex = activeMemos.findIndex(m => m.firestoreId === targetId);
    if (draggedIndex === -1 || targetIndex === -1) return;

    const [draggedItem] = activeMemos.splice(draggedIndex, 1);
    activeMemos.splice(targetIndex, 0, draggedItem);
    activeMemos.forEach((memo, index) => { memo.order = index; });

    this._drawHTML();
    activeMemos.forEach(memo => { dbAPI.updateMemo(memo.firestoreId, { order: memo.order }, memo.groupId).catch(e => console.warn(e)); });
    this.draggedMemoId = null;
  }

  addMemoItem() {
    const input = document.getElementById("memo-input-text");
    if (!input) return;
    const text = input.value.trim();
    if (!text && (!this.pendingAttachments || this.pendingAttachments.length === 0)) return;

    const newMemo = { 
        text: text, completed: false, order: -Date.now(), createdAt: Date.now(),
        labels: [...this.currentNewLabels], 
        attachments: [...(this.pendingAttachments || [])],
        authorId: auth?.currentUser?.uid
    };
    
    input.value = ""; input.style.height = '50px'; 
    this.pendingAttachments = []; store.hasUnsavedChanges = false; 

    dbAPI.addMemo(newMemo, this.currentNewMemoGroupId).catch(e => console.warn(e));
    setTimeout(() => this.renderViewer(), 100);
  }

  deleteMemoItem(firestoreId) {
    if(confirm("이 메모를 완전히 삭제하시겠습니까?\n(첨부된 구글 드라이브 파일도 함께 영구 삭제됩니다)")) {
      const target = this.memoItems.find(m => m.firestoreId === firestoreId);
      
      if (target && target.attachments && target.attachments.length > 0) {
          target.attachments.forEach(a => driveAPI.deleteFile(a.id).catch(e => console.warn(e)));
      }
      
      this.memoItems = this.memoItems.filter(m => m.firestoreId !== firestoreId);
      this._drawHTML();
      dbAPI.deleteMemo(firestoreId, target ? target.groupId : null).catch(e=>console.warn(e)); 
    }
  }

  clearCompletedMemos() {
    const completedMemos = this.memoItems.filter(m => m.completed);
    if (completedMemos.length === 0) return;
    const uid = auth?.currentUser?.uid;
    const myCompletedMemos = completedMemos.filter(m => !m.authorId || !uid || m.authorId === uid);

    if (myCompletedMemos.length === 0) return alert("비울 수 있는 완료된 본인 메모가 없습니다.");
    if(confirm(`완료된 내 업무 ${myCompletedMemos.length}개를 모두 삭제하시겠습니까?\n(포함된 첨부파일도 모두 영구 삭제됩니다)`)) {
      this.memoItems = this.memoItems.filter(m => !myCompletedMemos.includes(m));
      this._drawHTML();
      myCompletedMemos.forEach(memo => {
          if (memo.attachments && memo.attachments.length > 0) {
              memo.attachments.forEach(a => driveAPI.deleteFile(a.id).catch(e => console.warn(e)));
          }
          dbAPI.deleteMemo(memo.firestoreId, memo.groupId).catch(e=>console.warn(e));
      });
    }
  }

  save() {}
}

window.manageMemoLabels = function() {
    if (typeof window.LabelManager !== 'undefined' && window.LabelManager.openUnifiedLabelModal) {
        window.LabelManager.openUnifiedLabelModal('event');
    } else if (window.openMemoLabelModal) { window.openMemoLabelModal(); }
};

window.openImageViewer = function(url) {
    const modal = document.getElementById('image-viewer-modal');
    const img = document.getElementById('full-size-image');
    if (modal && img) { img.src = url; modal.classList.remove('hidden'); modal.style.display = 'flex'; }
};

window.memoViewInstance = new MemoView(document.getElementById("main-view"));
window.renderMemoView = (container) => { window.memoViewInstance.container = container; window.memoViewInstance.renderViewer(); };
