// js/modules/labels.js

const LabelManager = {
  eventModal: null,
  journalModal: null,
  memoModal: null, // 💡 메모 모달 추가
  
  // 드래그 앤 드롭 상태 관리
  draggedIdx: null,
  draggedType: null,

  // 색상 한글 매핑
  colorNames: {
      red: '빨강', orange: '주황', yellow: '노랑', green: '초록',
      blue: '파랑', indigo: '남색', purple: '보라', gray: '회색'
  },

  // 신규 추가 시 사용하는 동그란 색상 팔레트
  getColorPickerHTML: function(idPrefix, defaultColor = 'blue') {
      let html = '<div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:8px;">';
      for (const [key, val] of Object.entries(window.LABEL_PALETTE)) {
          const isChecked = key === defaultColor;
          html += `
              <div onclick="LabelManager.selectColor('${idPrefix}', '${key}')" 
                   id="${idPrefix}-color-${key}" title="${this.colorNames[key]}"
                   style="width:26px; height:26px; border-radius:50%; background:${val.bg}; border:2px solid ${isChecked ? val.text : val.border}; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:0.2s;">
                  <span style="display:${isChecked ? 'block' : 'none'}; color:${val.text}; font-size:12px; font-weight:bold;">✔</span>
              </div>
          `;
      }
      html += `<input type="hidden" id="${idPrefix}-selected-color" value="${defaultColor}"></div>`;
      return html;
  },

  selectColor: function(idPrefix, colorKey) {
      document.getElementById(`${idPrefix}-selected-color`).value = colorKey;
      for (const key of Object.keys(window.LABEL_PALETTE)) {
          const div = document.getElementById(`${idPrefix}-color-${key}`);
          if (div) {
              if (key === colorKey) {
                  div.style.border = `2px solid ${window.LABEL_PALETTE[key].text}`;
                  div.innerHTML = `<span style="display:block; color:${window.LABEL_PALETTE[key].text}; font-size:12px; font-weight:bold;">✔</span>`;
              } else {
                  div.style.border = `2px solid ${window.LABEL_PALETTE[key].border}`;
                  div.innerHTML = `<span style="display:none;"></span>`;
              }
          }
      }
  },

  // 🖱️ 드래그 앤 드롭 핸들러
  handleDragStart: function(e, idx, type) {
      this.draggedIdx = idx;
      this.draggedType = type;
      e.dataTransfer.effectAllowed = 'move';
      e.target.closest('.modal-input-row').style.opacity = '0.5';
  },
  handleDragOver: function(e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
  },
  handleDrop: function(e, targetIdx, type) {
      e.preventDefault();
      if (this.draggedType !== type || this.draggedIdx === null) return;
      if (this.draggedIdx === targetIdx) return;
      
      // 💡 1번(인덱스 0) 기본 라벨 방어
      if (targetIdx === 0 || this.draggedIdx === 0) {
          alert("기본 라벨은 위치를 변경할 수 없습니다.");
          if (type === 'event') this.renderEventLabels(); 
          else if (type === 'journal') this.renderJournalLabels();
          else this.renderMemoLabels();
          return;
      }

      let arr;
      if (type === 'event') arr = window.tempEditingLabels;
      else if (type === 'journal') arr = window.tempEditingJournalLabels;
      else arr = window.tempEditingMemoLabels;

      const item = arr.splice(this.draggedIdx, 1)[0];
      arr.splice(targetIdx, 0, item);

      this.draggedIdx = null;
      if (type === 'event') this.renderEventLabels();
      else if (type === 'journal') this.renderJournalLabels();
      else this.renderMemoLabels();
  },

  // ====================================================
  // 🏷️ 1. 일정 라벨 (Event Labels) 관리
  // ====================================================
  getEventContentHTML: function() {
    return `
      <div class="modal-info-box">
          <p style="margin:0;">
              <strong>[일정 라벨]</strong> 왼쪽의 '≡' 아이콘을 드래그하여 순서를 바꾸거나, 이름을 클릭해 바로 수정할 수 있습니다.<br>
              수정/삭제된 라벨을 쓰던 기존 일정은 자동으로 <strong>기본 라벨</strong>로 덮어써집니다.
          </p>
      </div>
      <div id="event-label-list-container" class="modal-list-container" style="max-height: 250px; padding-right:8px;"></div>
      
      <div class="modal-input-row alt" style="flex-direction:column; align-items:stretch; gap:10px; margin-bottom:20px; border-top:2px solid #cbd5e1;">
          <div style="display:flex; gap:10px; align-items:center; width:100%;">
              <input type="text" id="new-label-name" placeholder="새 라벨 이름 추가..." class="modal-input-text">
              <label class="modal-checkbox-label alert">
                  <input type="checkbox" id="new-label-skip" class="modal-checkbox"> 수업삭제
              </label>
              <button onclick="LabelManager.addNewEventLabel()" class="modal-btn-secondary" style="flex-shrink:0;">추가</button>
          </div>
          <div style="padding-left:4px;">
              <span style="font-size:0.85rem; font-weight:bold; color:#64748b;">🎨 새 라벨 색상:</span>
              ${this.getColorPickerHTML('event', 'blue')}
          </div>
      </div>
      
      <div class="modal-footer-actions">
          <button onclick="LabelManager.saveEventLabels(event)" class="modal-btn-primary">저장 및 클라우드 반영</button>
      </div>
    `;
  },

  openEventModal: function() {
    if (!this.eventModal) {
      this.eventModal = new window.Modal({
        id: 'event-label-modal-v4',
        title: '🏷️ 일정 라벨 설정',
        width: '500px',
        content: this.getEventContentHTML()
      });
    }
    window.tempEditingLabels = JSON.parse(JSON.stringify(window.getEventLabels()));
    this.eventModal.open();
    this.renderEventLabels();
  },

  renderEventLabels: function() {
    const container = document.getElementById('event-label-list-container');
    if (!container) return;
    
    container.innerHTML = window.tempEditingLabels.map((label, index) => {
        const isDefault = index === 0;
        const skipChecked = label.isSkip ? 'checked' : '';
        const skipColor = label.isSkip ? '#ef4444' : '#64748b';
        const style = window.LABEL_PALETTE[label.color || 'blue'] || window.LABEL_PALETTE['blue'];
        
        const dragHandle = isDefault 
            ? `<span style="width:20px; display:inline-block; text-align:center; color:#cbd5e1;">🔒</span>` 
            : `<span style="font-size:1.4rem; color:#94a3b8; cursor:grab; padding-right:4px; line-height:1;" title="드래그하여 순서 변경">≡</span>`;
        
        const dragAttrs = isDefault ? '' : `draggable="true" ondragstart="LabelManager.handleDragStart(event, ${index}, 'event')" ondragover="LabelManager.handleDragOver(event)" ondrop="LabelManager.handleDrop(event, ${index}, 'event')" ondragend="this.style.opacity='1';"`;
        
        const nameInputHTML = isDefault
            ? `<input type="text" value="${label.name}" readonly title="기본 라벨은 이름을 변경할 수 없습니다." style="width:90px; padding:6px; border:none; background:transparent; font-weight:bold; color:#1e293b; outline:none; cursor:not-allowed;">`
            : `<input type="text" value="${label.name}" onchange="window.tempEditingLabels[${index}].name = this.value.trim(); LabelManager.renderEventLabels();" style="width:90px; padding:6px; border:1px solid #cbd5e1; border-radius:4px; outline:none; font-weight:bold; color:#1e293b; transition:0.2s;" onfocus="this.style.borderColor='#3b82f6';">`;

        const colorSelectHTML = `
            <select onchange="window.tempEditingLabels[${index}].color = this.value; LabelManager.renderEventLabels();" style="padding:6px; border-radius:4px; border:1px solid ${style.border}; background:${style.bg}; color:${style.text}; font-weight:bold; outline:none; cursor:pointer;">
                ${Object.keys(window.LABEL_PALETTE).map(k => `<option value="${k}" ${label.color === k ? 'selected' : ''}>${LabelManager.colorNames[k]}</option>`).join('')}
            </select>
        `;

        const actionHTML = isDefault 
            ? `<span style="font-size:0.8rem; color:#94a3b8; font-weight:bold; background:#f1f5f9; padding:4px 6px; border-radius:4px;">기본</span>` 
            : `<button onclick="window.tempEditingLabels.splice(${index}, 1); LabelManager.renderEventLabels();" class="modal-delete-btn" style="padding:4px;" title="삭제">✖</button>`;

        return `
        <div class="modal-input-row" ${dragAttrs} style="transition:0.2s;">
            <div style="display:flex; align-items:center;">${dragHandle}</div>
            ${nameInputHTML}
            ${colorSelectHTML}
            <div style="flex:1;"></div>
            <div style="display:flex; align-items:center; gap:8px;">
                <label class="modal-checkbox-label" style="color:${skipColor}; margin-right:4px;">
                    <input type="checkbox" onchange="window.tempEditingLabels[${index}].isSkip = this.checked; LabelManager.renderEventLabels();" ${skipChecked} class="modal-checkbox"> 수업삭제
                </label>
                ${actionHTML}
            </div>
        </div>`;
    }).join('');
  },

  addNewEventLabel: function() {
    const nameInput = document.getElementById('new-label-name');
    const skipCheck = document.getElementById('new-label-skip');
    const colorInput = document.getElementById('event-selected-color');
    const name = nameInput.value.trim();
    const color = colorInput.value;
    
    if (!name) return alert("라벨 이름을 입력하세요.");
    if (window.tempEditingLabels.some(l => l.name === name)) return alert("이미 존재하는 라벨입니다.");
    
    window.tempEditingLabels.push({ name: name, isSkip: skipCheck.checked, color: color });
    nameInput.value = '';
    skipCheck.checked = false;
    this.renderEventLabels();
  },

  saveEventLabels: async function(e) {
    if (window.tempEditingLabels.length === 0) return alert("최소 1개의 라벨은 있어야 합니다.");
    
    for (let i=0; i<window.tempEditingLabels.length; i++) {
        if (!window.tempEditingLabels[i].name.trim()) return alert(`${i+1}번째 라벨의 이름이 비어있습니다.`);
    }
    
    const oldLabels = window.getEventLabels().map(l => l.name);
    const newLabels = window.tempEditingLabels.map(l => l.name);
    const deletedLabels = oldLabels.filter(l => !newLabels.includes(l));
    const defaultLabel = newLabels[0]; 

    localStorage.setItem('workCalendar_eventLabels_v4', JSON.stringify(window.tempEditingLabels));
    
    if (deletedLabels.length > 0) {
        const btn = e.target;
        btn.textContent = "클라우드 갱신 중...";
        btn.disabled = true;
        
        try {
            const snap = await window.getUserCol('events').get();
            let batch = window.db.batch();
            let opCount = 0;
            let batchPromises = [];

            snap.forEach(doc => {
                const data = doc.data();
                let changed = false;
                let list = data.eventList || [];
                if (list.length === 0 && data.eventText) list = window.parseRawEventTextToEventList(data.eventText);

                list.forEach(ev => {
                    if (deletedLabels.includes(ev.label)) {
                        ev.label = defaultLabel; 
                        changed = true;
                    }
                });

                if (changed) {
                    const newText = window.formatEventListToText(list);
                    batch.update(doc.ref, { eventList: list, eventText: newText, updatedAt: Date.now() });
                    opCount++;
                    if (opCount >= 400) { 
                        batchPromises.push(batch.commit());
                        batch = window.db.batch();
                        opCount = 0;
                    }
                }
            });
            if (opCount > 0) batchPromises.push(batch.commit());
            await Promise.all(batchPromises);
        } catch(err) {
            console.error("일정 라벨 자동 업데이트 실패", err);
        }
    }

    this.eventModal.close();
    alert("라벨 설정이 성공적으로 적용되었습니다.");
    window.render(); 
  },

  // ====================================================
  // 📔 2. 일지 라벨 (Journal Labels) 관리
  // ====================================================
  getJournalContentHTML: function() {
    return `
      <div class="modal-info-box journal">
          <p style="margin:0;">
              <strong>[일지 라벨]</strong> 왼쪽 '≡' 아이콘을 끌어서 순서를 바꾸거나 이름을 클릭해 수정하세요.<br>
              삭제/수정된 라벨을 쓰던 기존 일지는 <strong>기본 라벨</strong>로 통합됩니다.
          </p>
      </div>
      <div id="journal-label-list-container" class="modal-list-container" style="max-height: 250px; padding-right:8px;"></div>
      
      <div class="modal-input-row alt" style="flex-direction:column; align-items:stretch; gap:10px; margin-bottom:20px; border-top:2px solid #cbd5e1;">
          <div style="display:flex; gap:10px; align-items:center; width:100%;">
              <input type="text" id="new-journal-label-name" placeholder="새 일지 라벨 이름 추가..." class="modal-input-text">
              <button onclick="LabelManager.addNewJournalLabel()" class="modal-btn-secondary journal" style="flex-shrink:0;">추가</button>
          </div>
          <div style="padding-left:4px;">
              <span style="font-size:0.85rem; font-weight:bold; color:#64748b;">🎨 새 라벨 색상:</span>
              ${this.getColorPickerHTML('journal', 'purple')}
          </div>
      </div>
      
      <div class="modal-footer-actions">
          <button onclick="LabelManager.saveJournalLabels(event)" class="modal-btn-primary journal">저장 및 클라우드 반영</button>
      </div>
    `;
  },

  openJournalModal: function() {
    if (!this.journalModal) {
      this.journalModal = new window.Modal({
        id: 'journal-label-modal-v4',
        title: '📔 일지 라벨 설정',
        width: '500px',
        content: this.getJournalContentHTML()
      });
    }
    window.tempEditingJournalLabels = JSON.parse(JSON.stringify(window.getJournalLabels()));
    this.journalModal.open();
    this.renderJournalLabels();
  },

  renderJournalLabels: function() {
    const container = document.getElementById('journal-label-list-container');
    if (!container) return;
    
    container.innerHTML = window.tempEditingJournalLabels.map((label, index) => {
        const isDefault = index === 0;
        const style = window.LABEL_PALETTE[label.color || 'purple'] || window.LABEL_PALETTE['purple'];
        
        const dragHandle = isDefault 
            ? `<span style="width:20px; display:inline-block; text-align:center; color:#cbd5e1;">🔒</span>` 
            : `<span style="font-size:1.4rem; color:#94a3b8; cursor:grab; padding-right:4px; line-height:1;" title="드래그하여 순서 변경">≡</span>`;
        
        const dragAttrs = isDefault ? '' : `draggable="true" ondragstart="LabelManager.handleDragStart(event, ${index}, 'journal')" ondragover="LabelManager.handleDragOver(event)" ondrop="LabelManager.handleDrop(event, ${index}, 'journal')" ondragend="this.style.opacity='1';"`;
        
        const nameInputHTML = isDefault
            ? `<input type="text" value="${label.name}" readonly title="기본 라벨은 이름을 변경할 수 없습니다." style="width:110px; padding:6px; border:none; background:transparent; font-weight:bold; color:#1e293b; outline:none; cursor:not-allowed;">`
            : `<input type="text" value="${label.name}" onchange="window.tempEditingJournalLabels[${index}].name = this.value.trim(); LabelManager.renderJournalLabels();" style="width:110px; padding:6px; border:1px solid #cbd5e1; border-radius:4px; outline:none; font-weight:bold; color:#1e293b; transition:0.2s;" onfocus="this.style.borderColor='#be185d';">`;

        const colorSelectHTML = `
            <select onchange="window.tempEditingJournalLabels[${index}].color = this.value; LabelManager.renderJournalLabels();" style="padding:6px; border-radius:4px; border:1px solid ${style.border}; background:${style.bg}; color:${style.text}; font-weight:bold; outline:none; cursor:pointer;">
                ${Object.keys(window.LABEL_PALETTE).map(k => `<option value="${k}" ${label.color === k ? 'selected' : ''}>${LabelManager.colorNames[k]}</option>`).join('')}
            </select>
        `;

        const actionHTML = isDefault 
            ? `<span style="font-size:0.8rem; color:#94a3b8; font-weight:bold; background:#f1f5f9; padding:4px 6px; border-radius:4px;">기본</span>` 
            : `<button onclick="window.tempEditingJournalLabels.splice(${index}, 1); LabelManager.renderJournalLabels();" class="modal-delete-btn" style="padding:4px;" title="삭제">✖</button>`;

        return `
        <div class="modal-input-row journal" ${dragAttrs} style="transition:0.2s;">
            <div style="display:flex; align-items:center;">${dragHandle}</div>
            ${nameInputHTML}
            ${colorSelectHTML}
            <div style="flex:1;"></div>
            ${actionHTML}
        </div>`;
    }).join('');
  },

  addNewJournalLabel: function() {
    const nameInput = document.getElementById('new-journal-label-name');
    const colorInput = document.getElementById('journal-selected-color');
    const name = nameInput.value.trim();
    const color = colorInput.value;
    
    if (!name) return alert("라벨 이름을 입력하세요.");
    if (window.tempEditingJournalLabels.some(l => l.name === name)) return alert("이미 존재하는 라벨입니다.");
    
    window.tempEditingJournalLabels.push({ name: name, color: color });
    nameInput.value = '';
    this.renderJournalLabels();
  },

  saveJournalLabels: async function(e) {
    if (window.tempEditingJournalLabels.length === 0) return alert("최소 1개의 일지 라벨은 있어야 합니다.");
    
    for (let i=0; i<window.tempEditingJournalLabels.length; i++) {
        if (!window.tempEditingJournalLabels[i].name.trim()) return alert(`${i+1}번째 라벨의 이름이 비어있습니다.`);
    }
    
    const oldLabels = window.getJournalLabels().map(l => l.name);
    const newLabels = window.tempEditingJournalLabels.map(l => l.name);
    const deletedLabels = oldLabels.filter(l => !newLabels.includes(l));
    const defaultLabel = newLabels[0];

    localStorage.setItem('workCalendar_journalLabels_v4', JSON.stringify(window.tempEditingJournalLabels));
    
    if (deletedLabels.length > 0) {
        const btn = e.target;
        btn.textContent = "클라우드 갱신 중...";
        btn.disabled = true;

        try {
            const snap = await window.getUserCol('journals').get();
            let batch = window.db.batch();
            let opCount = 0;
            let batchPromises = [];

            snap.forEach(doc => {
                const data = doc.data();
                let changed = false;
                let list = data.entries || [];

                list.forEach(j => {
                    if (deletedLabels.includes(j.label)) {
                        j.label = defaultLabel; 
                        changed = true;
                    }
                });

                if (changed) {
                    batch.update(doc.ref, { entries: list, updatedAt: Date.now() });
                    opCount++;
                    if (opCount >= 400) {
                        batchPromises.push(batch.commit());
                        batch = window.db.batch();
                        opCount = 0;
                    }
                }
            });
            if (opCount > 0) batchPromises.push(batch.commit());
            await Promise.all(batchPromises);
        } catch(err) {
            console.error("일지 라벨 자동 업데이트 실패", err);
        }
    }

    this.journalModal.close();
    alert("일지 라벨 설정이 성공적으로 저장되었습니다.");
    window.render(); 
  },

  // ====================================================
  // 📝 3. 메모 라벨 (Memo Labels) 관리 [신규 추가됨]
  // ====================================================
  getMemoLabels: function() {
      const saved = JSON.parse(localStorage.getItem('workCalendar_memoLabels'));
      if (saved && saved.length > 0) {
          return saved.map(item => typeof item === 'string' ? { name: item, color: 'blue' } : item);
      }
      return [
          { name: '긴급', color: 'red' }, { name: '중요', color: 'orange' },
          { name: '학급운영', color: 'green' }, { name: '학부모상담', color: 'purple' },
          { name: '수업준비', color: 'blue' }, { name: '행정업무', color: 'gray' }, { name: '개인', color: 'indigo' }
      ];
  },

  getMemoContentHTML: function() {
    return `
      <div class="modal-info-box" style="background: #ecfdf5; border-left-color: #10b981; color: #065f46;">
          <p style="margin:0;">
              <strong>[메모 라벨]</strong> 메모를 분류할 태그(Chip)들을 관리합니다.<br>
              삭제된 라벨을 사용 중이던 기존 메모는 라벨이 해제됩니다.
          </p>
      </div>
      <div id="memo-label-list-container" class="modal-list-container" style="max-height: 250px; padding-right:8px;"></div>
      
      <div class="modal-input-row alt" style="flex-direction:column; align-items:stretch; gap:10px; margin-bottom:20px; border-top:2px solid #cbd5e1;">
          <div style="display:flex; gap:10px; align-items:center; width:100%;">
              <input type="text" id="new-memo-label-name" placeholder="새 메모 라벨 추가..." class="modal-input-text" onkeydown="if(event.key==='Enter') LabelManager.addNewMemoLabel()">
              <button onclick="LabelManager.addNewMemoLabel()" class="modal-btn-secondary success" style="flex-shrink:0; background:#10b981;">추가</button>
          </div>
          <div style="padding-left:4px;">
              <span style="font-size:0.85rem; font-weight:bold; color:#64748b;">🎨 태그 색상 (향후 업데이트용):</span>
              ${this.getColorPickerHTML('memo', 'green')}
          </div>
      </div>
      
      <div class="modal-footer-actions">
          <button onclick="LabelManager.saveMemoLabels(event)" class="modal-btn-primary success" style="background:#059669;">저장 및 적용</button>
      </div>
    `;
  },

  openMemoModal: function() {
    if (!this.memoModal) {
      this.memoModal = new window.Modal({
        id: 'memo-label-modal-v4',
        title: '📝 메모 라벨 설정',
        width: '500px',
        content: this.getMemoContentHTML()
      });
    }
    window.tempEditingMemoLabels = JSON.parse(JSON.stringify(this.getMemoLabels()));
    this.memoModal.open();
    this.renderMemoLabels();
  },

  renderMemoLabels: function() {
    const container = document.getElementById('memo-label-list-container');
    if (!container) return;
    
    container.innerHTML = window.tempEditingMemoLabels.map((label, index) => {
        const isDefault = index === 0;
        const style = window.LABEL_PALETTE[label.color || 'blue'] || window.LABEL_PALETTE['blue'];
        
        const dragHandle = isDefault 
            ? `<span style="width:20px; display:inline-block; text-align:center; color:#cbd5e1;">🔒</span>` 
            : `<span style="font-size:1.4rem; color:#94a3b8; cursor:grab; padding-right:4px; line-height:1;" title="드래그하여 순서 변경">≡</span>`;
        
        const dragAttrs = isDefault ? '' : `draggable="true" ondragstart="LabelManager.handleDragStart(event, ${index}, 'memo')" ondragover="LabelManager.handleDragOver(event)" ondrop="LabelManager.handleDrop(event, ${index}, 'memo')" ondragend="this.style.opacity='1';"`;
        
        const nameInputHTML = isDefault
            ? `<input type="text" value="${label.name}" readonly title="기본 라벨은 이름을 변경할 수 없습니다." style="width:110px; padding:6px; border:none; background:transparent; font-weight:bold; color:#1e293b; outline:none; cursor:not-allowed;">`
            : `<input type="text" value="${label.name}" onchange="window.tempEditingMemoLabels[${index}].name = this.value.trim(); LabelManager.renderMemoLabels();" style="width:110px; padding:6px; border:1px solid #cbd5e1; border-radius:4px; outline:none; font-weight:bold; color:#1e293b; transition:0.2s;" onfocus="this.style.borderColor='#10b981';">`;

        const colorSelectHTML = `
            <select onchange="window.tempEditingMemoLabels[${index}].color = this.value; LabelManager.renderMemoLabels();" style="padding:6px; border-radius:4px; border:1px solid ${style.border}; background:${style.bg}; color:${style.text}; font-weight:bold; outline:none; cursor:pointer;">
                ${Object.keys(window.LABEL_PALETTE).map(k => `<option value="${k}" ${label.color === k ? 'selected' : ''}>${LabelManager.colorNames[k]}</option>`).join('')}
            </select>
        `;

        const actionHTML = isDefault 
            ? `<span style="font-size:0.8rem; color:#94a3b8; font-weight:bold; background:#f1f5f9; padding:4px 6px; border-radius:4px;">기본</span>` 
            : `<button onclick="window.tempEditingMemoLabels.splice(${index}, 1); LabelManager.renderMemoLabels();" class="modal-delete-btn" style="padding:4px;" title="삭제">✖</button>`;

        return `
        <div class="modal-input-row" ${dragAttrs} style="transition:0.2s; border-left: 3px solid #10b981;">
            <div style="display:flex; align-items:center;">${dragHandle}</div>
            ${nameInputHTML}
            ${colorSelectHTML}
            <div style="flex:1;"></div>
            ${actionHTML}
        </div>`;
    }).join('');
  },

  addNewMemoLabel: function() {
    const nameInput = document.getElementById('new-memo-label-name');
    const colorInput = document.getElementById('memo-selected-color');
    const name = nameInput.value.trim();
    const color = colorInput.value || 'blue';
    
    if (!name) return alert("라벨 이름을 입력하세요.");
    if (window.tempEditingMemoLabels.some(l => l.name === name)) return alert("이미 존재하는 라벨입니다.");
    
    window.tempEditingMemoLabels.push({ name: name, color: color });
    nameInput.value = '';
    this.renderMemoLabels();
  },

  saveMemoLabels: async function(e) {
    if (window.tempEditingMemoLabels.length === 0) return alert("최소 1개의 메모 라벨은 있어야 합니다.");
    
    for (let i=0; i<window.tempEditingMemoLabels.length; i++) {
        if (!window.tempEditingMemoLabels[i].name.trim()) return alert(`${i+1}번째 라벨의 이름이 비어있습니다.`);
    }
    
    localStorage.setItem('workCalendar_memoLabels', JSON.stringify(window.tempEditingMemoLabels));
    
    this.memoModal.close();
    alert("메모 라벨 설정이 성공적으로 저장되었습니다.");
    
    if (window.currentScope === 'memo' && window.memoViewInstance) {
        window.memoViewInstance.renderViewer();
    }
  }
};

// ====================================================
// 전역 브릿지 함수 (HTML에서 호출 가능하도록)
// ====================================================
window.openEventLabelModal = () => LabelManager.openEventModal();
window.openJournalLabelModal = () => LabelManager.openJournalModal();
window.openMemoLabelModal = () => LabelManager.openMemoModal(); // 💡 새로 추가!

// 💡 메모 뷰의 [⚙️ 설정] 버튼과 연결되는 하위 호환성 브릿지
window.manageMemoLabels = () => LabelManager.openMemoModal();
