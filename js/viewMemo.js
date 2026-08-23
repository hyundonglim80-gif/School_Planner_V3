// js/viewMemo.js

import { BaseView } from './components/BaseView.js';
import { store } from './core/store.js';
import { dbAPI, getUserCol } from './firebase.js';
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
    
    this.pendingImageUrl = null;
    this.isUploading = false;

    this.myGroups = [];
    // 🌟 [V3.6] 새 메모 작성 시 선택된 공유 대상을 기억
    this.currentNewMemoGroupId = null; 
  }

  loadMemoLabels() {
      const savedLabels = JSON.parse(localStorage.getItem('workCalendar_memoLabels'));
      if (savedLabels && savedLabels.length > 0) {
          this.AVAILABLE_LABELS = savedLabels.map(l => typeof l === 'string' ? { id: 'memo_' + l, name: l, color: 'gray' } : l);
      } else {
          this.AVAILABLE_LABELS = [
              { id: 'memo_1', name: '긴급', color: 'red' },
              { id: 'memo_2', name: '중요', color: 'orange' },
              { id: 'memo_3', name: '학급운영', color: 'blue' },
              { id: 'memo_4', name: '학부모상담', color: 'green' },
              { id: 'memo_5', name: '수업준비', color: 'purple' },
              { id: 'memo_6', name: '행정업무', color: 'gray' },
              { id: 'memo_7', name: '개인', color: 'indigo' }
          ];
      }
  }

  setFilter(labelName) {
      this.currentFilter = labelName;
      this.renderViewer();
  }

  async loadLinks() {
    try {
      const docSnap = await getDoc(doc(getUserCol('settings'), 'user_links'));
      if (docSnap.exists()) return docSnap.data().links || [];
    } catch (e) { console.error("링크 불러오기 오류:", e); }
    return [];
  }

  async saveLinks(linksArray) {
    setDoc(doc(getUserCol('settings'), 'user_links'), { links: linksArray }).catch(e => console.warn(e)); 
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

  saveLinkFromModal(editIndex) {
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
    
    this.saveLinks(links); 
    document.getElementById('link-modal').remove();
    this.renderLinks();
  }

  deleteLink(index) {
    const links = this.currentLinks || [];
    const targetName = links[index]?.name;
    if (confirm(`[${targetName}] 링크를 삭제하시겠습니까?`)) {
      links.splice(index, 1);
      this.saveLinks(links); 
      this.renderLinks();
    }
  }

  renderLabelChips(containerElement, selectedLabelsArray, onChangeCallback) {
    if (!containerElement) return;
    containerElement.innerHTML = '';
    containerElement.style.margin = "0";
    containerElement.style.display = "flex";
    containerElement.style.flexWrap = "wrap";
    containerElement.style.gap = "4px";

    const palette = window.LABEL_PALETTE || {};

    this.AVAILABLE_LABELS.forEach(labelObj => {
        const labelName = labelObj.name;
        const chip = document.createElement('div');
        chip.className = 'label-chip';
        chip.innerText = labelName;
        
        const colorStyle = palette[labelObj.color] || palette['purple'];

        if (selectedLabelsArray.includes(labelName)) {
            chip.classList.add('active');
            chip.style.backgroundColor = colorStyle.bg;
            chip.style.color = colorStyle.text;
            chip.style.borderColor = colorStyle.border;
        }
        
        chip.addEventListener('click', () => {
            if (selectedLabelsArray.includes(labelName)) {
                selectedLabelsArray = selectedLabelsArray.filter(l => l !== labelName);
                chip.classList.remove('active');
                chip.style.backgroundColor = '';
                chip.style.color = '';
                chip.style.borderColor = '';
            } else {
                selectedLabelsArray.push(labelName);
                chip.classList.add('active');
                chip.style.backgroundColor = colorStyle.bg;
                chip.style.color = colorStyle.text;
                chip.style.borderColor = colorStyle.border;
            }
            if (onChangeCallback) onChangeCallback(selectedLabelsArray);
        });
        
        containerElement.appendChild(chip);
    });
  }

  async handleImageUpload(inputElement) {
      const file = inputElement.files[0];
      if (!file) return;
      
      if (!file.type.startsWith('image/')) {
          alert('이미지 파일만 업로드할 수 있습니다.');
          inputElement.value = '';
          return;
      }

      this.isUploading = true;
      this.renderViewer(); 

      try {
          this.pendingImageUrl = await dbAPI.uploadImage(file);
          store.hasUnsavedChanges = true;
      } catch (error) {
          console.error("이미지 업로드 실패:", error);
          alert("이미지 업로드 중 오류가 발생했습니다.");
          this.pendingImageUrl = null;
      } finally {
          this.isUploading = false;
          inputElement.value = ''; 
          this.renderViewer(); 
      }
  }
  
  cancelPendingImage() {
      if (this.pendingImageUrl) {
          dbAPI.deleteImage(this.pendingImageUrl).catch(e => console.warn(e));
          this.pendingImageUrl = null;
          const input = document.getElementById("memo-input-text");
          store.hasUnsavedChanges = (input && input.value.trim() !== '');
          this.renderViewer();
      }
  }

  async fetchAllMemos() {
      try { this.myGroups = await dbAPI.loadMyGroups(); } catch(e) { this.myGroups = []; }
      
      let allMemos = await dbAPI.loadMemos(); 
      
      for (const group of this.myGroups) {
          const groupMemos = await dbAPI.loadGroupMemos(group.id);
          groupMemos.forEach(m => { m.groupName = group.name; });
          allMemos = allMemos.concat(groupMemos);
      }
      return allMemos;
  }

  async renderViewer() {
    setTimeout(() => {
        const headers = document.querySelectorAll('h1, h2, h3, .page-title, #page-title, .title');
        headers.forEach(el => {
            if (el.textContent && el.textContent.includes('할 일 및 메모')) {
                el.textContent = ''; 
                if (el.nextElementSibling) el.nextElementSibling.textContent = ''; 
            }
        });
    }, 10);

    if (window.targetMemoId) {
        this.currentFilter = '전체'; 
    }

    if (!this.memoItems || this.memoItems.length === 0) {
        this.showLoading('클라우드에서 데이터(개인 및 공유)를 불러오는 중입니다...');
        this.memoItems = await this.fetchAllMemos();
        this.loadMemoLabels();
        this._drawHTML();
    } else {
        this.fetchAllMemos().then(data => {
            this.memoItems = data;
            this.loadMemoLabels();
            if (!this.isUploading) this._drawHTML(); 
        });
    }
  }

  autoResizeTextarea(textarea) {
      store.hasUnsavedChanges = (textarea.value.trim() !== '' || this.pendingImageUrl !== null);
      textarea.style.height = '50px'; 
      if (textarea.scrollHeight > 50) {
          textarea.style.height = textarea.scrollHeight + 'px'; 
      }
  }

  // 🌟 [새 메모 전용] 작성 영역의 공유 버튼을 클릭했을 때 처리하는 함수
  setNewMemoGroup(groupId) {
      this.currentNewMemoGroupId = groupId;
      
      // UI를 수동으로 갱신하여 텍스트 입력창 포커스가 유지되도록 함
      document.querySelectorAll('.new-memo-group-chip').forEach(el => {
          const val = el.getAttribute('data-value');
          const targetVal = groupId === null ? 'personal' : String(groupId);
          if (val === targetVal) {
              el.style.background = '#fff';
              el.style.color = '#2563eb';
              el.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
          } else {
              el.style.background = 'transparent';
              el.style.color = '#64748b';
              el.style.boxShadow = 'none';
          }
      });
  }

  _drawHTML() {
    let filteredMemos = this.memoItems;
    if (this.currentFilter !== '전체') {
        filteredMemos = filteredMemos.filter(m => m.labels && m.labels.includes(this.currentFilter));
    }

    let activeMemos = filteredMemos.filter(m => !m.completed).sort((a, b) => a.order - b.order);
    let completedMemos = filteredMemos.filter(m => m.completed).sort((a, b) => b.completedAt - a.completedAt);

    const allCount = this.memoItems.length;
    const labelCounts = {};
    this.AVAILABLE_LABELS.forEach(lObj => {
        labelCounts[lObj.name] = this.memoItems.filter(m => m.labels && m.labels.includes(lObj.name)).length;
    });

    let imageAttachmentHtml = '';
    if (this.isUploading) {
        imageAttachmentHtml = `<div style="padding: 10px; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; color: #3b82f6; font-weight: bold; text-align: center; margin-top: 5px;">⏳ 사진 압축 및 업로드 중...</div>`;
    } else if (this.pendingImageUrl) {
        imageAttachmentHtml = `
            <div style="position: relative; display: inline-block; margin-top: 8px;">
                <img src="${this.pendingImageUrl}" style="height: 60px; border-radius: 6px; border: 1px solid #cbd5e1; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <button onclick="window.memoViewInstance.cancelPendingImage()" style="position: absolute; top: -8px; right: -8px; background: #ef4444; color: white; border: none; border-radius: 50%; width: 20px; height: 20px; font-size: 10px; cursor: pointer; box-shadow: 0 1px 2px rgba(0,0,0,0.2);">✖</button>
            </div>
        `;
    }

    // 🌟 [V3.6] 버튼형 공유 대상 선택 UI 생성
    const newMemoGroupChipsHtml = `
        <div style="display:inline-flex; background:#f1f5f9; padding:3px; border-radius:8px; border:1px solid #cbd5e1; align-items:center; margin-right:8px;">
            <div class="new-memo-group-chip" data-value="personal" onclick="window.memoViewInstance.setNewMemoGroup(null)" style="padding:4px 10px; font-size:0.85rem; border-radius:6px; cursor:pointer; font-weight:bold; transition:0.2s; ${this.currentNewMemoGroupId === null ? 'background:#fff; color:#2563eb; box-shadow:0 1px 3px rgba(0,0,0,0.1);' : 'color:#64748b;'}">🔒 개인</div>
            ${this.myGroups.map(g => `<div class="new-memo-group-chip" data-value="${g.id}" onclick="window.memoViewInstance.setNewMemoGroup('${g.id}')" style="padding:4px 10px; font-size:0.85rem; border-radius:6px; cursor:pointer; font-weight:bold; transition:0.2s; ${this.currentNewMemoGroupId === g.id ? 'background:#fff; color:#2563eb; box-shadow:0 1px 3px rgba(0,0,0,0.1);' : 'color:#64748b;'}">👥 ${g.name}</div>`).join('')}
        </div>
    `;

    let html = `
      <div style="max-width:1050px; margin:0 auto; display:flex; flex-direction:column; gap:20px;">
        
        <div style="background:#fff; padding:15px 20px; border-radius:12px; border:1px solid var(--border-color); box-shadow:0 1px 3px rgba(0,0,0,0.05);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:2px solid #f1f5f9; padding-bottom:8px;">
            <h3 style="margin:0; font-size:1.2rem; color:#1e40af; display:flex; align-items:center; gap:6px;">🔗 자주 쓰는 문서/링크</h3>
            <button onclick="window.memoViewInstance.openAddLinkModal(-1)" style="background:#f1f5f9; color:#334155; border:1px solid #cbd5e1; padding:4px 10px; border-radius:6px; font-weight:bold; cursor:pointer; font-size:0.9rem; transition:0.2s;">+ 링크 추가</button>
          </div>
          <div id="quick-links-container" style="display:flex; flex-wrap:wrap; align-items:center;"></div>
        </div>

        <div style="background:#fff; padding:20px; border-radius:12px; border:1px solid var(--border-color); box-shadow:0 1px 3px rgba(0,0,0,0.05);">
          
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
              <div id="memo-add-labels" class="label-chip-container" style="flex: 1; margin: 0; padding-right: 10px;"></div>
              
              <!-- 🌟 버튼 칩들을 우측 정렬로 배치 -->
              <div style="display:flex; align-items:center; gap:8px;">
                  ${newMemoGroupChipsHtml}
                  <button onclick="window.openMemoLabelModal()" style="background:#f8fafc; color:#475569; border:1px solid #cbd5e1; padding:6px 12px; border-radius:6px; font-size:0.85rem; cursor:pointer; font-weight: bold; transition: 0.2s; flex-shrink: 0;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='#f8fafc'">⚙️ 설정</button>
              </div>
          </div>

          <div style="display:flex; gap:8px; margin-bottom:5px; align-items:flex-start;">
            <textarea id="memo-input-text" placeholder="새 할 일이나 공유할 메모를 추가하세요" 
                   style="flex:1; padding:12px; border:2px solid #e2e8f0; border-radius:8px; font-size:1.1rem; outline:none; resize:none; overflow:hidden; min-height:50px; height:50px; font-family:inherit; line-height:1.4; box-sizing:border-box;"
                   onkeydown="if(event.ctrlKey && event.key === 'Enter') { event.preventDefault(); window.memoViewInstance.addMemoItem(); }"
                   oninput="window.memoViewInstance.autoResizeTextarea(this)"></textarea>
            
            <button onclick="document.getElementById('memo-image-upload').click()" style="background:#f1f5f9; color:#475569; border:1px solid #cbd5e1; padding:0 12px; border-radius:8px; cursor:pointer; font-size:1.2rem; height:50px; display:flex; align-items:center; justify-content:center;" title="사진 첨부">🖼️</button>
            <input type="file" id="memo-image-upload" accept="image/*" style="display:none;" onchange="window.memoViewInstance.handleImageUpload(this)">
            
            <button onclick="window.memoViewInstance.addMemoItem()" style="background:var(--primary-color); color:#fff; border:none; padding:0 20px; border-radius:8px; font-weight:700; cursor:pointer; font-size:1.2rem; height:50px; white-space:nowrap; box-sizing:border-box; display:flex; align-items:center;">추가</button>
          </div>
          
          ${imageAttachmentHtml}
        </div>

        <div style="display:flex; align-items:flex-start; gap:20px; width:100%; flex-wrap:wrap;">
            <div style="flex: 1 1 120px; max-width: 150px; min-width: 100px; background: #fff; padding: 15px; border-radius: 12px; border: 1px solid var(--border-color); box-shadow: 0 1px 3px rgba(0,0,0,0.05); position: sticky; top: 80px; display: flex; flex-direction: column; gap: 8px;">
                <div style="font-weight:bold; color:#1e40af; border-bottom:2px solid #f1f5f9; padding-bottom:8px; margin-bottom:4px;">📁 라벨 필터</div>
                <div class="label-chip ${this.currentFilter === '전체' ? 'active' : ''}" onclick="window.memoViewInstance.setFilter('전체')" style="justify-content:space-between; display:flex; align-items:center; cursor:pointer;">
                    <span>👀 전체</span>
                    <span style="background:rgba(0,0,0,0.1); padding:2px 8px; border-radius:12px; font-size:0.75rem; font-weight:bold; color:inherit;">${allCount}</span>
                </div>
                ${this.AVAILABLE_LABELS.map(lObj => `
                    <div class="label-chip ${this.currentFilter === lObj.name ? 'active' : ''}" onclick="window.memoViewInstance.setFilter('${lObj.name}')" style="justify-content:space-between; display:flex; align-items:center; cursor:pointer;">
                        <span>${lObj.name}</span>
                        <span style="background:rgba(0,0,0,0.1); padding:2px 8px; border-radius:12px; font-size:0.75rem; font-weight:bold; color:inherit;">${labelCounts[lObj.name]}</span>
                    </div>
                `).join('')}
            </div>

            <div style="flex: 3 1 500px; min-width:0; background:#fff; padding:20px; border-radius:12px; border:1px solid var(--border-color); box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                <div class="section-title" style="margin-bottom:5px; font-weight:bold; font-size:1.1rem; color:#0f172a;">진행 (${activeMemos.length})</div>
                <div id="active-memo-list">${activeMemos.length === 0 ? `<p style="text-align:center; color:#94a3b8; font-size:1.1rem; padding: 20px 0;">${this.currentFilter !== '전체' ? '해당 라벨의 업무가 없습니다.' : '모든 업무를 완료했습니다!'}</p>` : activeMemos.map((item, i) => this.generateMemoHTML(item, false)).join('')}</div>

                <div class="section-title" style="margin-top:30px; display:flex; justify-content:space-between; align-items:center; border-bottom: 2px solid #e2e8f0; padding-bottom: 4px; font-weight:bold; font-size:1.1rem; color:#0f172a;">
                  <span>완료 (${completedMemos.length})</span>
                  ${completedMemos.length > 0 ? `<button onclick="window.memoViewInstance.clearCompletedMemos()" style="background:#ef4444; color:#fff; border:none; padding:4px 10px; border-radius:6px; font-size:1rem; cursor:pointer;">🗑️ 전체 비우기</button>` : ''}
                </div>
                <div>${completedMemos.length === 0 ? '<p style="text-align:center; color:#94a3b8; font-size:1.1rem; margin-top:20px;">아직 완료된 항목이 없습니다.</p>' : completedMemos.map((item, i) => this.generateMemoHTML(item, true)).join('')}</div>
            </div>
        </div>
      </div>
    `;
    this.container.innerHTML = html;
    
    this.currentNewLabels = this.currentFilter !== '전체' ? [this.currentFilter] : [];
    this.renderLabelChips(document.getElementById('memo-add-labels'), this.currentNewLabels, (updatedLabels) => {
        this.currentNewLabels = updatedLabels;
    });

    this.renderLinks();

    if (window.targetMemoId) {
        const targetId = window.targetMemoId;
        window.targetMemoId = null; 
        setTimeout(() => {
            const targetEl = document.getElementById(`memo-card-${targetId}`);
            if (targetEl) {
                targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                const originalBg = targetEl.style.backgroundColor || '';
                targetEl.style.transition = 'background-color 0.4s ease';
                targetEl.style.backgroundColor = '#fef08a'; 
                setTimeout(() => {
                    targetEl.style.backgroundColor = originalBg;
                    setTimeout(() => { targetEl.style.transition = ''; }, 400);
                }, 1200);
            }
        }, 300); 
    }
  }

  async renderEditor() {
    this.renderViewer();
  }

  generateMemoHTML(item, isCompleted) {
    const deleteBtnHtml = `<button onclick="window.memoViewInstance.deleteMemoItem('${item.firestoreId}')" style="background:transparent; border:none; font-size:1.3rem; cursor:pointer; padding:0; margin-left:4px;" title="삭제">🗑️</button>`;

    let dragHandleHtml = '';
    let dragAttributes = '';
    
    if (!isCompleted && this.currentFilter === '전체') {
      dragAttributes = `draggable="true" ondragstart="window.memoViewInstance.handleDragStart(event, '${item.firestoreId}')" ondragover="window.memoViewInstance.handleDragOver(event)" ondrop="window.memoViewInstance.handleDrop(event, '${item.firestoreId}')"`;
      dragHandleHtml = `<span style="cursor:grab; font-size:1.8rem; color:#94a3b8; padding-right:8px; line-height:1;" title="드래그하여 순서 변경">≡</span>`;
    } else if (!isCompleted) {
      dragHandleHtml = `<span style="font-size:1.8rem; color:#cbd5e1; padding-right:8px; line-height:1; cursor:not-allowed;" title="필터 적용 중에는 순서 변경 불가">≡</span>`;
    }

    const editableAttr = isCompleted ? '' : `contenteditable="true" onkeydown="if(event.ctrlKey && event.key === 'Enter') { event.preventDefault(); this.blur(); }"`;

    const labels = item.labels || [];
    const palette = window.LABEL_PALETTE || {};

    const knownLabelNames = this.AVAILABLE_LABELS.map(l => l.name);
    const unknownLabels = labels.filter(l => !knownLabelNames.includes(l));
    
    let allLabelsHtml = this.AVAILABLE_LABELS.map(lObj => {
        const lName = lObj.name;
        const isActive = labels.includes(lName);
        const colorStyle = palette[lObj.color] || palette['purple'];
        const activeStyle = isActive 
            ? `background-color: ${colorStyle.bg}; color: ${colorStyle.text}; border-color: ${colorStyle.border}; font-weight: bold;` 
            : `background-color: #f8fafc; color: #94a3b8; border-color: #e2e8f0; opacity: 0.5;`;
        const clickAction = isCompleted ? '' : `onclick="window.memoViewInstance.toggleMemoItemLabel('${item.firestoreId}', '${lName}')"`;
        const cursorStyle = isCompleted ? 'cursor: default;' : 'cursor: pointer;';
        
        return `<div class="label-chip ${isActive ? 'active' : ''}" ${clickAction} style="padding: 2px 8px; font-size: 0.8rem; min-width: auto; ${activeStyle} ${cursorStyle}" title="${isCompleted ? '' : '클릭하여 라벨 변경'}">${lName}</div>`;
    }).join('');

    unknownLabels.forEach(lName => {
        allLabelsHtml += `<div class="label-chip active" style="padding: 2px 8px; font-size: 0.8rem; min-width: auto; background-color: #f1f5f9; color: #475569; border-color: #cbd5e1; font-weight: bold; cursor: default;" title="다른 사용자의 라벨입니다.">${lName}</div>`;
    });

    const labelsContainerHtml = `
        <div style="margin-bottom: 6px; display: flex; flex-wrap: wrap; gap: 6px; align-items:center;">
            ${allLabelsHtml}
        </div>
    `;

    // 🌟 목록에 렌더링된 메모별 공유 그룹 버튼 칩 (우측 정렬용)
    const groupButtonsHtml = `
        <div style="display:inline-flex; background:#f1f5f9; padding:2px; border-radius:6px; border:1px solid #cbd5e1; align-items:center;">
            <div onclick="window.memoViewInstance.changeMemoGroup('${item.firestoreId}', null)" style="padding:3px 8px; font-size:0.75rem; border-radius:4px; cursor:pointer; font-weight:bold; transition:0.2s; ${item.groupId === null ? 'background:#fff; color:#2563eb; box-shadow:0 1px 3px rgba(0,0,0,0.1);' : 'color:#64748b;'}">🔒 개인</div>
            ${this.myGroups.map(g => `<div onclick="window.memoViewInstance.changeMemoGroup('${item.firestoreId}', '${g.id}')" style="padding:3px 8px; font-size:0.75rem; border-radius:4px; cursor:pointer; font-weight:bold; transition:0.2s; ${item.groupId === g.id ? 'background:#fff; color:#2563eb; box-shadow:0 1px 3px rgba(0,0,0,0.1);' : 'color:#64748b;'}">👥 ${g.name}</div>`).join('')}
        </div>
    `;
        
    const imageHtml = item.imageUrl 
        ? `<div style="margin-top: 8px;">
               <img src="${item.imageUrl}" onclick="window.openImageViewer('${item.imageUrl}')" style="max-height: 80px; border-radius: 6px; border: 1px solid #cbd5e1; cursor: zoom-in; box-shadow: 0 1px 3px rgba(0,0,0,0.1); transition: 0.2s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
           </div>` 
        : '';

    return `
      <div id="memo-card-${item.firestoreId}" class="memo-item" ${dragAttributes} style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%; padding: 12px 0; border-bottom: 1px dashed #f1f5f9; transition: background-color 0.2s;">
        <div style="display:flex; align-items:flex-start; gap:8px; flex: 1; padding-right: 10px; margin: 0; min-height: 24px;">
          <div style="padding-top:2px;">${dragHandleHtml}</div>
          <input type="checkbox" ${isCompleted ? 'checked' : ''} onchange="window.memoViewInstance.toggleMemoItem('${item.firestoreId}', ${item.completed})" style="width:20px; height:20px; accent-color:var(--primary-color); flex-shrink: 0; margin-top: 4px; cursor:pointer;">
          
          <div style="flex: 1; display: flex; flex-direction: column;">
             ${labelsContainerHtml}
             <span ${editableAttr} style="font-size:1.5rem; word-break: break-all; white-space: pre-wrap; line-height:1.4; outline:none; display:block; min-height:1.5rem; width:100%; ${isCompleted ? 'text-decoration:line-through; color:#94a3b8;' : 'color:#1e293b; font-weight:500; cursor:text; padding:2px 4px; border-radius:4px;'} " onfocus="this.style.backgroundColor='#f1f5f9'" onblur="this.style.backgroundColor='transparent'; window.memoViewInstance.updateMemoText('${item.firestoreId}', this.innerText)">${item.text}</span>
             ${imageHtml}
          </div>
        </div>
        
        <!-- 🌟 우측 정렬된 컨트롤 영역 -->
        <div class="memo-controls" style="display: flex; align-items: center; gap: 8px; padding-top:2px; flex-wrap:wrap; justify-content:flex-end;">
            ${groupButtonsHtml}
            ${deleteBtnHtml}
        </div>
      </div>
    `;
  }

  async changeMemoGroup(firestoreId, newGroupId) {
      const item = this.memoItems.find(m => m.firestoreId === firestoreId);
      if (!item) return;

      const oldGroupId = item.groupId || null;
      const targetGroupId = newGroupId || null;

      if (oldGroupId === targetGroupId) return;

      const dataToMove = {
          text: item.text,
          completed: item.completed,
          order: item.order,
          createdAt: item.createdAt,
          updatedAt: Date.now(),
          labels: item.labels || [],
          imageUrl: item.imageUrl || ''
      };

      if (item.completedAt) dataToMove.completedAt = item.completedAt;

      try {
          await dbAPI.deleteMemo(firestoreId, oldGroupId);
          await dbAPI.addMemo(dataToMove, targetGroupId);
          this.renderViewer();
      } catch (e) {
          console.error("메모 공유 상태 변경 오류:", e);
          alert("공유 상태를 변경하는 중 오류가 발생했습니다.");
      }
  }

  toggleMemoItemLabel(firestoreId, labelName) {
      const item = this.memoItems.find(m => m.firestoreId === firestoreId);
      if (!item) return;
      
      let labels = item.labels || [];
      if (labels.includes(labelName)) {
          labels = labels.filter(l => l !== labelName);
      } else {
          labels.push(labelName);
      }
      item.labels = labels;
      this._drawHTML();

      dbAPI.updateMemo(firestoreId, { labels: labels }, item.groupId).catch(e => console.warn(e)); 
  }

  updateMemoText(firestoreId, newText) {
    const text = newText.trim();
    const target = this.memoItems.find(m => m.firestoreId === firestoreId);
    
    if (!text && target && !target.imageUrl) {
        alert("메모 내용이나 이미지는 필수입니다. (비워둘 수 없습니다)");
        this.renderViewer(); 
        return;
    }

    if (target && target.text !== text) {
        target.text = text;
        dbAPI.updateMemo(firestoreId, { text: text }, target.groupId).catch(e => console.warn(e)); 
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
    
    activeMemos.forEach(memo => {
        dbAPI.updateMemo(memo.firestoreId, { order: memo.order }, memo.groupId).catch(e => console.warn(e));
    });
    this.draggedMemoId = null;
  }

  addMemoItem() {
    const input = document.getElementById("memo-input-text");
    if (!input) return;
    
    const text = input.value.trim();
    if (!text && !this.pendingImageUrl) return;

    const targetGroupId = this.currentNewMemoGroupId; // 🌟 칩 버튼에서 선택된 ID 활용

    const newMemo = { 
        text: text, 
        completed: false, 
        order: -Date.now(), 
        createdAt: Date.now(),
        labels: [...this.currentNewLabels],
        imageUrl: this.pendingImageUrl
    };
    
    input.value = "";
    input.style.height = '50px'; 
    this.pendingImageUrl = null;
    store.hasUnsavedChanges = false; 

    dbAPI.addMemo(newMemo, targetGroupId).catch(e => console.warn(e));
    setTimeout(() => this.renderViewer(), 100);
  }

  toggleMemoItem(firestoreId, currentStatus) {
    const isNowCompleted = !currentStatus;
    const target = this.memoItems.find(m => m.firestoreId === firestoreId);
    
    if (target) {
        target.completed = isNowCompleted;
        target.completedAt = isNowCompleted ? Date.now() : null;
        this._drawHTML();
        dbAPI.updateMemo(firestoreId, { completed: isNowCompleted, completedAt: isNowCompleted ? Date.now() : null }, target.groupId).catch(e=>console.warn(e));
    }
  }

  deleteMemoItem(firestoreId) {
    if(confirm("이 메모를 완전히 삭제하시겠습니까? (첨부된 이미지도 함께 삭제됩니다)")) {
      const target = this.memoItems.find(m => m.firestoreId === firestoreId);
      const groupId = target ? target.groupId : null;

      this.memoItems = this.memoItems.filter(m => m.firestoreId !== firestoreId);
      this._drawHTML();
      dbAPI.deleteMemo(firestoreId, groupId).catch(e=>console.warn(e)); 
    }
  }

  clearCompletedMemos() {
    const completedMemos = this.memoItems.filter(m => m.completed);
    if (completedMemos.length === 0) return;
    
    if(confirm(`완료된 업무 ${completedMemos.length}개를 모두 삭제하시겠습니까?\n(이 작업은 되돌릴 수 없습니다)`)) {
      this.memoItems = this.memoItems.filter(m => !m.completed);
      this._drawHTML();
      completedMemos.forEach(memo => dbAPI.deleteMemo(memo.firestoreId, memo.groupId).catch(e=>console.warn(e)));
    }
  }

  save() {}
}

window.manageMemoLabels = function() {
    if (typeof window.LabelManager !== 'undefined' && window.LabelManager.openUnifiedLabelModal) {
        window.LabelManager.openUnifiedLabelModal('memo');
    } else if (window.openMemoLabelModal) {
        window.openMemoLabelModal();
    }
};

window.openImageViewer = function(url) {
    const modal = document.getElementById('image-viewer-modal');
    const img = document.getElementById('full-size-image');
    if (modal && img) {
        img.src = url;
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
    }
};

window.memoViewInstance = new MemoView(document.getElementById("main-view"));

window.renderMemoView = (container) => {
  window.memoViewInstance.container = container;
  window.memoViewInstance.renderViewer();
};