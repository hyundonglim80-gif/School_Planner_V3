const LabelManager = {
  eventModal: null,
  journalModal: null,
  memoModal: null, 
  
  draggedIdx: null,
  draggedType: null,

  colorNames: {
      red: '빨강', orange: '주황', yellow: '노랑', green: '초록',
      blue: '파랑', indigo: '남색', purple: '보라', gray: '회색'
  },

  getColorPickerHTML: function(idPrefix, defaultColor = 'blue') {
      let html = '<div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:8px;">';
      const palette = window.LABEL_PALETTE || {
          red: { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' },
          orange: { bg: '#ffedd5', text: '#9a3412', border: '#fdba74' },
          yellow: { bg: '#fef9c3', text: '#854d0e', border: '#fde047' },
          green: { bg: '#dcfce7', text: '#166534', border: '#86efac' },
          blue: { bg: '#dbeafe', text: '#1e40af', border: '#93c5fd' },
          indigo: { bg: '#e0e7ff', text: '#3730a3', border: '#a5b4fc' },
          purple: { bg: '#f3e8ff', text: '#6b21a8', border: '#d8b4fe' },
          gray: { bg: '#f1f5f9', text: '#334155', border: '#cbd5e1' }
      };

      for (const [key, val] of Object.entries(palette)) {
          const isChecked = key === defaultColor;
          html += `
              <div onclick="LabelManager.selectColor('${idPrefix}', '${key}')" 
                   id="${idPrefix}-color-${key}" title="${this.colorNames[key] || key}"
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
      const palette = window.LABEL_PALETTE || {
          red: { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' },
          orange: { bg: '#ffedd5', text: '#9a3412', border: '#fdba74' },
          yellow: { bg: '#fef9c3', text: '#854d0e', border: '#fde047' },
          green: { bg: '#dcfce7', text: '#166534', border: '#86efac' },
          blue: { bg: '#dbeafe', text: '#1e40af', border: '#93c5fd' },
          indigo: { bg: '#e0e7ff', text: '#3730a3', border: '#a5b4fc' },
          purple: { bg: '#f3e8ff', text: '#6b21a8', border: '#d8b4fe' },
          gray: { bg: '#f1f5f9', text: '#334155', border: '#cbd5e1' }
      };
      for (const key of Object.keys(palette)) {
          const div = document.getElementById(`${idPrefix}-color-${key}`);
          if (div) {
              if (key === colorKey) {
                  div.style.border = `2px solid ${palette[key].text}`;
                  div.innerHTML = `<span style="display:block; color:${palette[key].text}; font-size:12px; font-weight:bold;">✔</span>`;
              } else {
                  div.style.border = `2px solid ${palette[key].border}`;
                  div.innerHTML = `<span style="display:none;"></span>`;
              }
          }
      }
  },

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
  // 🏷️ 1. 일정 라벨 관리
  // ====================================================
  getEventContentHTML: function() {
    return `
      <div class="modal-info-box">
          <p style="margin:0;">
              <strong>[일정 라벨]</strong> 왼쪽 '≡'를 끌어 순서를 바꾸거나 이름을 클릭해 수정하세요.<br>
              💡 <b>기간:</b> 선택 시 며칠부터 며칠까지인지 달력 팝업이 뜹니다.<br>
              💡 <b>완료(이월):</b> 클릭해서 완료(✓) 할 수 있으며, 미완료 시 다음 날로 넘어갑니다.
          </p>
      </div>
      <div id="event-label-list-container" class="modal-list-container" style="max-height: 250px; padding-right:8px;"></div>
      
      <div class="modal-input-row alt" style="flex-direction:column; align-items:stretch; gap:10px; margin-bottom:20px; border-top:2px solid #cbd5e1;">
          <div style="display:flex; gap:10px; align-items:center; width:100%;">
              <input type="text" id="new-label-name" placeholder="새 라벨 (예: 방학)" class="modal-input-text" style="flex:1;">
              
              <div style="display:flex; gap:12px; align-items:center; text-align:center;">
                  <label style="display:flex; flex-direction:column; align-items:center; font-size:0.75rem; font-weight:bold; color:#2563eb; cursor:pointer;">
                      <span>기간</span><input type="checkbox" id="new-label-period" class="modal-checkbox" style="margin-top:2px;">
                  </label>
                  <label style="display:flex; flex-direction:column; align-items:center; font-size:0.75rem; font-weight:bold; color:#059669; cursor:pointer;">
                      <span>완료</span><input type="checkbox" id="new-label-forward" class="modal-checkbox" style="margin-top:2px;">
                  </label>
                  <label style="display:flex; flex-direction:column; align-items:center; font-size:0.75rem; font-weight:bold; color:#ef4444; cursor:pointer;">
                      <span>수업삭제</span><input type="checkbox" id="new-label-skip" class="modal-checkbox" style="margin-top:2px;">
                  </label>
              </div>
              <button onclick="LabelManager.addNewEventLabel()" class="modal-btn-secondary" style="flex-shrink:0;">추가</button>
          </div>
          <div style="padding-left:4px;">
              <span style="font-size:0.85rem; font-weight:bold; color:#64748b;">🎨 라벨 색상:</span>
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
    // 💡 [핵심] 기존 이름을 추적하여 덮어씌울 수 있도록 originalName 추가
    window.tempEditingLabels = window.getEventLabels().map(l => ({...l, originalName: l.name}));
    this.eventModal.open();
    this.renderEventLabels();
  },

  renderEventLabels: function() {
    const container = document.getElementById('event-label-list-container');
    if (!container) return;
    const palette = window.LABEL_PALETTE || {};
    
    container.innerHTML = window.tempEditingLabels.map((label, index) => {
        const periodChecked = label.isPeriod ? 'checked' : '';
        const forwardChecked = label.isForward ? 'checked' : '';
        const skipChecked = label.isSkip ? 'checked' : '';
        const style = palette[label.color || 'blue'] || { border: '#93c5fd', bg: '#dbeafe', text: '#1e40af' };
        
        return `
        <div class="modal-input-row" draggable="true" ondragstart="LabelManager.handleDragStart(event, ${index}, 'event')" ondragover="LabelManager.handleDragOver(event)" ondrop="LabelManager.handleDrop(event, ${index}, 'event')" ondragend="this.style.opacity='1';" style="transition:0.2s;">
            <div style="display:flex; align-items:center;"><span style="font-size:1.4rem; color:#94a3b8; cursor:grab; padding-right:4px;">≡</span></div>
            <input type="text" value="${label.name}" onchange="window.tempEditingLabels[${index}].name = this.value.trim(); LabelManager.renderEventLabels();" style="width:80px; padding:4px; border:1px solid #cbd5e1; border-radius:4px; outline:none; font-weight:bold; color:#1e293b;">
            <select onchange="window.tempEditingLabels[${index}].color = this.value; LabelManager.renderEventLabels();" style="padding:4px; border-radius:4px; border:1px solid ${style.border}; background:${style.bg}; color:${style.text}; font-weight:bold; outline:none; cursor:pointer; width:65px;">
                ${Object.keys(this.colorNames).map(k => `<option value="${k}" ${label.color === k ? 'selected' : ''}>${LabelManager.colorNames[k]}</option>`).join('')}
            </select>
            <div style="flex:1;"></div>
            <div style="display:flex; gap:10px; align-items:center; text-align:center;">
                <label style="display:flex; flex-direction:column; align-items:center; font-size:0.7rem; font-weight:bold; color:${label.isPeriod ? '#2563eb' : '#94a3b8'}; cursor:pointer;" title="기간 달력 사용">
                    <span>기간</span><input type="checkbox" onchange="window.tempEditingLabels[${index}].isPeriod = this.checked; LabelManager.renderEventLabels();" ${periodChecked} class="modal-checkbox" style="margin-top:2px;">
                </label>
                <label style="display:flex; flex-direction:column; align-items:center; font-size:0.7rem; font-weight:bold; color:${label.isForward ? '#059669' : '#94a3b8'}; cursor:pointer;" title="체크박스 및 미완료 이월">
                    <span>완료</span><input type="checkbox" onchange="window.tempEditingLabels[${index}].isForward = this.checked; LabelManager.renderEventLabels();" ${forwardChecked} class="modal-checkbox" style="margin-top:2px;">
                </label>
                <label style="display:flex; flex-direction:column; align-items:center; font-size:0.7rem; font-weight:bold; color:${label.isSkip ? '#ef4444' : '#94a3b8'}; cursor:pointer;" title="해당일 수업 숨김">
                    <span>삭제</span><input type="checkbox" onchange="window.tempEditingLabels[${index}].isSkip = this.checked; LabelManager.renderEventLabels();" ${skipChecked} class="modal-checkbox" style="margin-top:2px;">
                </label>
            </div>
            <button onclick="window.tempEditingLabels.splice(${index}, 1); LabelManager.renderEventLabels();" class="modal-delete-btn" style="padding:4px; margin-left:4px;" title="삭제">✖</button>
        </div>`;
    }).join('');
  },

  addNewEventLabel: function() {
    const nameInput = document.getElementById('new-label-name');
    const periodCheck = document.getElementById('new-label-period');
    const forwardCheck = document.getElementById('new-label-forward');
    const skipCheck = document.getElementById('new-label-skip');
    const colorInput = document.getElementById('event-selected-color');
    const name = nameInput.value.trim();
    const color = colorInput ? colorInput.value : 'blue';
    
    if (!name) return alert("라벨 이름을 입력하세요.");
    if (window.tempEditingLabels.some(l => l.name === name)) return alert("이미 존재하는 라벨입니다.");
    
    window.tempEditingLabels.push({ 
        name: name, 
        isPeriod: periodCheck.checked,
        isForward: forwardCheck.checked, 
        isSkip: skipCheck.checked, 
        color: color, 
        originalName: null 
    });
    nameInput.value = ''; periodCheck.checked = false; forwardCheck.checked = false; skipCheck.checked = false;
    this.renderEventLabels();
  },

  saveEventLabels: async function(e) {
    for (let i=0; i<window.tempEditingLabels.length; i++) {
        if (!window.tempEditingLabels[i].name.trim()) return alert(`${i+1}번째 라벨의 이름이 비어있습니다.`);
    }
    
    // 💡 변경된 이름 추적 맵 생성
    const renameMap = {};
    window.tempEditingLabels.forEach(l => {
        if (l.originalName && l.originalName !== l.name) {
            renameMap[l.originalName] = l.name;
        }
    });

    const newLabels = window.tempEditingLabels.map(l => l.name);
    const oldLabelsData = JSON.parse(localStorage.getItem('workCalendar_eventLabels_v4'));
    const oldLabels = oldLabelsData ? oldLabelsData.map(l => l.name) : (window.getEventLabels ? window.getEventLabels().map(l=>l.name) : []);
    
    // 완전히 삭제된 라벨 찾기 (이름 변경 대상 제외)
    const deletedLabels = oldLabels.filter(oldName => !newLabels.includes(oldName) && !renameMap[oldName]);

    // LocalStorage 저장용 데이터 정제 (originalName 제거)
    const dataToSave = window.tempEditingLabels.map(({originalName, ...rest}) => rest);
    localStorage.setItem('workCalendar_eventLabels_v4', JSON.stringify(dataToSave));
    
    // 💡 변경 사항이 있거나 완전 삭제된 항목이 있을 때만 클라우드 업데이트 실행
    if (deletedLabels.length > 0 || Object.keys(renameMap).length > 0) {
        const btn = e.target;
        const originalText = btn.textContent;
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
                
                if (list.length === 0 && data.eventText && window.parseRawEventTextToEventList) {
                    list = window.parseRawEventTextToEventList(data.eventText);
                }

                list.forEach(ev => {
                    let evLabels = ev.labels || (ev.label ? [ev.label] : []);
                    const originalLength = evLabels.length;
                    let changedThisEv = false;
                    
                    // 1. 이름이 바뀐 라벨 적용
                    evLabels = evLabels.map(l => {
                        if (renameMap[l]) { changedThisEv = true; return renameMap[l]; }
                        return l;
                    });
                    
                    // 2. 삭제된 라벨 제거
                    const filteredLabels = evLabels.filter(l => !deletedLabels.includes(l));
                    if (filteredLabels.length !== evLabels.length) {
                        changedThisEv = true;
                        evLabels = filteredLabels;
                    }
                    
                    if (changedThisEv || evLabels.length !== originalLength) {
                        ev.labels = evLabels;
                        ev.label = evLabels[0] || ''; 
                        changed = true;
                    }
                });

                if (changed) {
                    const updateData = { eventList: list, updatedAt: Date.now() };
                    if (window.formatEventListToText) updateData.eventText = window.formatEventListToText(list);
                    batch.update(doc.ref, updateData);
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
        btn.textContent = originalText;
        btn.disabled = false;
    }

    this.eventModal.close();
    alert("일정 라벨 설정이 저장되었습니다.");
    if (typeof window.render === 'function') window.render(); 
  },

  // ====================================================
  // 📔 2. 기록 라벨 관리
  // ====================================================
  getJournalContentHTML: function() {
    return `
      <div class="modal-info-box journal">
          <p style="margin:0;">
              <strong>[기록 라벨]</strong> 왼쪽 '≡' 아이콘을 끌어서 순서를 바꾸거나 이름을 클릭해 수정하세요.<br>
              수정되거나 삭제된 라벨을 사용 중이던 기존 기록은 자동으로 새 라벨로 <strong>변경되거나 해제</strong>됩니다.
          </p>
      </div>
      <div id="journal-label-list-container" class="modal-list-container" style="max-height: 250px; padding-right:8px;"></div>
      
      <div class="modal-input-row alt" style="flex-direction:column; align-items:stretch; gap:10px; margin-bottom:20px; border-top:2px solid #cbd5e1;">
          <div style="display:flex; gap:10px; align-items:center; width:100%;">
              <input type="text" id="new-journal-label-name" placeholder="새 기록 라벨 이름 추가..." class="modal-input-text">
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
        title: '📔 기록 라벨 설정',
        width: '500px',
        content: this.getJournalContentHTML()
      });
    }
    window.tempEditingJournalLabels = window.getJournalLabels().map(l => ({...l, originalName: l.name}));
    this.journalModal.open();
    this.renderJournalLabels();
  },

  renderJournalLabels: function() {
    const container = document.getElementById('journal-label-list-container');
    if (!container) return;
    const palette = window.LABEL_PALETTE || {};
    
    container.innerHTML = window.tempEditingJournalLabels.map((label, index) => {
        const style = palette[label.color || 'purple'] || { border: '#d8b4fe', bg: '#f3e8ff', text: '#6b21a8' };
        
        const dragHandle = `<span style="font-size:1.4rem; color:#94a3b8; cursor:grab; padding-right:4px; line-height:1;">≡</span>`;
        const dragAttrs = `draggable="true" ondragstart="LabelManager.handleDragStart(event, ${index}, 'journal')" ondragover="LabelManager.handleDragOver(event)" ondrop="LabelManager.handleDrop(event, ${index}, 'journal')" ondragend="this.style.opacity='1';"`;
        
        const nameInputHTML = `<input type="text" value="${label.name}" onchange="window.tempEditingJournalLabels[${index}].name = this.value.trim(); LabelManager.renderJournalLabels();" style="width:110px; padding:6px; border:1px solid #cbd5e1; border-radius:4px; outline:none; font-weight:bold; color:#1e293b;">`;

        const colorSelectHTML = `
            <select onchange="window.tempEditingJournalLabels[${index}].color = this.value; LabelManager.renderJournalLabels();" style="padding:6px; border-radius:4px; border:1px solid ${style.border}; background:${style.bg}; color:${style.text}; font-weight:bold; outline:none; cursor:pointer;">
                ${Object.keys(this.colorNames).map(k => `<option value="${k}" ${label.color === k ? 'selected' : ''}>${this.colorNames[k]}</option>`).join('')}
            </select>
        `;

        const actionHTML = `<button onclick="window.tempEditingJournalLabels.splice(${index}, 1); LabelManager.renderJournalLabels();" class="modal-delete-btn" style="padding:4px;" title="삭제">✖</button>`;

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
    const color = colorInput ? colorInput.value : 'purple';
    
    if (!name) return alert("라벨 이름을 입력하세요.");
    if (window.tempEditingJournalLabels.some(l => l.name === name)) return alert("이미 존재하는 라벨입니다.");
    
    window.tempEditingJournalLabels.push({ name: name, color: color, originalName: null });
    nameInput.value = '';
    this.renderJournalLabels();
  },

  saveJournalLabels: async function(e) {
    for (let i=0; i<window.tempEditingJournalLabels.length; i++) {
        if (!window.tempEditingJournalLabels[i].name.trim()) return alert(`${i+1}번째 라벨의 이름이 비어있습니다.`);
    }
    
    const renameMap = {};
    window.tempEditingJournalLabels.forEach(l => {
        if (l.originalName && l.originalName !== l.name) {
            renameMap[l.originalName] = l.name;
        }
    });

    const newLabels = window.tempEditingJournalLabels.map(l => l.name);
    const oldLabelsData = JSON.parse(localStorage.getItem('workCalendar_journalLabels_v4'));
    const oldLabels = oldLabelsData ? oldLabelsData.map(l => l.name) : (window.getJournalLabels ? window.getJournalLabels().map(l=>l.name) : []);
    const deletedLabels = oldLabels.filter(oldName => !newLabels.includes(oldName) && !renameMap[oldName]);

    const dataToSave = window.tempEditingJournalLabels.map(({originalName, ...rest}) => rest);
    localStorage.setItem('workCalendar_journalLabels_v4', JSON.stringify(dataToSave));
    
    if (deletedLabels.length > 0 || Object.keys(renameMap).length > 0) {
        const btn = e.target;
        const originalText = btn.textContent;
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
                    let jLabels = j.labels || (j.label ? [j.label] : []);
                    const originalLength = jLabels.length;
                    let changedThisEv = false;
                    
                    jLabels = jLabels.map(l => {
                        if (renameMap[l]) { changedThisEv = true; return renameMap[l]; }
                        return l;
                    });
                    
                    const filteredLabels = jLabels.filter(l => !deletedLabels.includes(l));
                    if (filteredLabels.length !== jLabels.length) {
                        changedThisEv = true;
                        jLabels = filteredLabels;
                    }
                    
                    if (changedThisEv || jLabels.length !== originalLength) {
                        j.labels = jLabels;
                        j.label = jLabels[0] || '';
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
            console.error("기록 라벨 자동 업데이트 실패", err);
        }
        btn.textContent = originalText;
        btn.disabled = false;
    }

    this.journalModal.close();
    alert("기록 라벨 설정이 저장되었습니다.");
    if (typeof window.render === 'function') window.render(); 
  },

  // ====================================================
  // 📝 3. 메모 라벨 관리
  // ====================================================
  getMemoLabels: function() {
      const saved = JSON.parse(localStorage.getItem('workCalendar_memoLabels'));
      if (saved && saved.length > 0) {
          return saved.map(item => typeof item === 'string' ? { name: item, color: 'green' } : item);
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
              왼쪽 '≡'를 끌어 순서를 바꾸거나 이름을 수정할 수 있습니다. 수정/삭제된 라벨은 기존 메모에서도 <strong>변경/해제</strong>됩니다.
          </p>
      </div>
      <div id="memo-label-list-container" class="modal-list-container" style="max-height: 250px; padding-right:8px;"></div>
      
      <div class="modal-input-row alt" style="flex-direction:column; align-items:stretch; gap:10px; margin-bottom:20px; border-top:2px solid #cbd5e1;">
          <div style="display:flex; gap:10px; align-items:center; width:100%;">
              <input type="text" id="new-memo-label-name" placeholder="새 메모 라벨 추가..." class="modal-input-text" onkeydown="if(event.key==='Enter') LabelManager.addNewMemoLabel()">
              <button onclick="LabelManager.addNewMemoLabel()" class="modal-btn-secondary success" style="flex-shrink:0; background:#10b981;">추가</button>
          </div>
          <div style="padding-left:4px;">
              <span style="font-size:0.85rem; font-weight:bold; color:#64748b;">🎨 태그 색상:</span>
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
    window.tempEditingMemoLabels = this.getMemoLabels().map(l => ({...l, originalName: l.name}));
    this.memoModal.open();
    this.renderMemoLabels();
  },

  renderMemoLabels: function() {
    const container = document.getElementById('memo-label-list-container');
    if (!container) return;
    const palette = window.LABEL_PALETTE || {};
    
    container.innerHTML = window.tempEditingMemoLabels.map((label, index) => {
        const style = palette[label.color || 'green'] || { border: '#86efac', bg: '#dcfce7', text: '#166534' };
        
        const dragHandle = `<span style="font-size:1.4rem; color:#94a3b8; cursor:grab; padding-right:4px; line-height:1;" title="드래그하여 순서 변경">≡</span>`;
        const dragAttrs = `draggable="true" ondragstart="LabelManager.handleDragStart(event, ${index}, 'memo')" ondragover="LabelManager.handleDragOver(event)" ondrop="LabelManager.handleDrop(event, ${index}, 'memo')" ondragend="this.style.opacity='1';"`;
        
        const nameInputHTML = `<input type="text" value="${label.name}" onchange="window.tempEditingMemoLabels[${index}].name = this.value.trim(); LabelManager.renderMemoLabels();" style="width:110px; padding:6px; border:1px solid #cbd5e1; border-radius:4px; outline:none; font-weight:bold; color:#1e293b;">`;

        const colorSelectHTML = `
            <select onchange="window.tempEditingMemoLabels[${index}].color = this.value; LabelManager.renderMemoLabels();" style="padding:6px; border-radius:4px; border:1px solid ${style.border}; background:${style.bg}; color:${style.text}; font-weight:bold; outline:none; cursor:pointer;">
                ${Object.keys(this.colorNames).map(k => `<option value="${k}" ${label.color === k ? 'selected' : ''}>${this.colorNames[k]}</option>`).join('')}
            </select>
        `;

        const actionHTML = `<button onclick="window.tempEditingMemoLabels.splice(${index}, 1); LabelManager.renderMemoLabels();" class="modal-delete-btn" style="padding:4px;" title="삭제">✖</button>`;

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
    const color = colorInput ? colorInput.value : 'green';
    
    if (!name) return alert("라벨 이름을 입력하세요.");
    if (window.tempEditingMemoLabels.some(l => l.name === name)) return alert("이미 존재하는 라벨입니다.");
    
    window.tempEditingMemoLabels.push({ name: name, color: color, originalName: null });
    nameInput.value = '';
    this.renderMemoLabels();
  },

  saveMemoLabels: async function(e) {
    for (let i=0; i<window.tempEditingMemoLabels.length; i++) {
        if (!window.tempEditingMemoLabels[i].name.trim()) return alert(`${i+1}번째 라벨의 이름이 비어있습니다.`);
    }
    
    const renameMap = {};
    window.tempEditingMemoLabels.forEach(l => {
        if (l.originalName && l.originalName !== l.name) {
            renameMap[l.originalName] = l.name;
        }
    });

    const newLabels = window.tempEditingMemoLabels.map(l => l.name);
    const oldLabelsData = JSON.parse(localStorage.getItem('workCalendar_memoLabels'));
    let oldLabels = [];
    if (oldLabelsData && oldLabelsData.length > 0) {
        oldLabels = oldLabelsData.map(item => typeof item === 'string' ? item : item.name);
    } else {
        oldLabels = ['긴급', '중요', '학급운영', '학부모상담', '수업준비', '행정업무', '개인'];
    }
    
    const deletedLabels = oldLabels.filter(oldName => !newLabels.includes(oldName) && !renameMap[oldName]);

    const dataToSave = window.tempEditingMemoLabels.map(({originalName, ...rest}) => rest);
    localStorage.setItem('workCalendar_memoLabels', JSON.stringify(dataToSave));
    
    if (deletedLabels.length > 0 || Object.keys(renameMap).length > 0) {
        const btn = e.target;
        const originalText = btn.textContent;
        btn.textContent = "클라우드 갱신 중...";
        btn.disabled = true;

        try {
            const snap = await window.getUserCol('tasks').get();
            let batch = window.db.batch();
            let opCount = 0;
            let batchPromises = [];

            snap.forEach(doc => {
                const data = doc.data();
                let mLabels = data.labels || (data.label ? [data.label] : []);
                const origLen = mLabels.length;
                let changedThis = false;

                mLabels = mLabels.map(l => {
                    if (renameMap[l]) { changedThis = true; return renameMap[l]; }
                    return l;
                });

                const filtered = mLabels.filter(l => !deletedLabels.includes(l));
                if (filtered.length !== mLabels.length) {
                    changedThis = true;
                    mLabels = filtered;
                }

                if (changedThis) {
                    batch.update(doc.ref, { labels: mLabels, updatedAt: Date.now() });
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
            console.error("메모 라벨 자동 업데이트 실패", err);
        }
        btn.textContent = originalText;
        btn.disabled = false;
    }

    this.memoModal.close();
    alert("메모 라벨 설정이 성공적으로 저장되었습니다.");
    
    if (typeof window.render === 'function') {
        window.render(); 
    } else if (window.memoViewInstance) {
        window.memoViewInstance.renderViewer();
    }
  }
};

window.openEventLabelModal = () => LabelManager.openEventModal();
window.openJournalLabelModal = () => LabelManager.openJournalModal();
window.openMemoLabelModal = () => LabelManager.openMemoModal(); 
window.manageMemoLabels = () => LabelManager.openMemoModal();
