const LabelManager = {
  eventModal: null,
  journalModal: null,

  getColorPickerHTML: function(idPrefix, defaultColor = 'blue') {
      let html = '<div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:8px;">';
      for (const [key, val] of Object.entries(window.LABEL_PALETTE)) {
          const isChecked = key === defaultColor;
          html += `
              <div onclick="LabelManager.selectColor('${idPrefix}', '${key}')" 
                   id="${idPrefix}-color-${key}" title="${key}"
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

  // ====================================================
  // 🏷️ 1. 일정 라벨 (Event Labels) 관리
  // ====================================================
  getEventContentHTML: function() {
    return `
      <div class="modal-info-box">
          <p style="margin:0;">
              <strong>[일정 라벨]</strong> 라벨을 삭제하면 기존에 해당 라벨로 작성된 일정은 자동으로 첫 번째 '기본 라벨'로 변경됩니다.<br>
              <span style="color:#ef4444; font-weight:bold;">'수업삭제'</span> 체크 시, 해당 라벨 날짜는 시간표가 비워집니다.
          </p>
      </div>
      <div id="event-label-list-container" class="modal-list-container" style="max-height: 200px;"></div>
      
      <div class="modal-input-row alt" style="flex-direction:column; align-items:stretch; gap:10px; margin-bottom:20px;">
          <div style="display:flex; gap:10px; align-items:center; width:100%;">
              <input type="text" id="new-label-name" placeholder="새 라벨 이름..." class="modal-input-text">
              <label class="modal-checkbox-label alert">
                  <input type="checkbox" id="new-label-skip" class="modal-checkbox"> 수업삭제
              </label>
              <button onclick="LabelManager.addNewEventLabel()" class="modal-btn-secondary" style="flex-shrink:0;">추가</button>
          </div>
          <div style="padding-left:4px;">
              <span style="font-size:0.85rem; font-weight:bold; color:#64748b;">🎨 라벨 색상 선택:</span>
              ${this.getColorPickerHTML('event', 'blue')}
          </div>
      </div>
      
      <div class="modal-footer-actions">
          <button onclick="LabelManager.saveEventLabels(event)" class="modal-btn-primary">저장 및 적용</button>
      </div>
    `;
  },

  openEventModal: function() {
    if (!this.eventModal) {
      this.eventModal = new window.Modal({
        id: 'event-label-modal-v3',
        title: '🏷️ 일정 라벨 설정',
        width: '450px',
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
        const skipChecked = label.isSkip ? 'checked' : '';
        const skipColor = label.isSkip ? '#ef4444' : '#64748b';
        const style = window.LABEL_PALETTE[label.color || 'blue'] || window.LABEL_PALETTE['blue'];
        
        // 💡 핵심: 1번째(index 0) 기본 라벨은 삭제 버튼을 숨기고 안내 배지 표시
        const deleteBtnHTML = index === 0 
            ? `<span style="font-size:0.8rem; color:#94a3b8; font-weight:bold; background:#f1f5f9; padding:3px 6px; border-radius:4px;">기본 (삭제불가)</span>` 
            : `<button onclick="window.tempEditingLabels.splice(${index}, 1); LabelManager.renderEventLabels();" class="modal-delete-btn" title="삭제">✖</button>`;

        return `
        <div class="modal-input-row">
            <span class="modal-item-text" style="background:${style.bg}; color:${style.text}; border:1px solid ${style.border}; padding:2px 8px; border-radius:4px; font-size:0.9rem;">${label.name}</span>
            <div style="flex:1;"></div>
            <div style="display:flex; align-items:center; gap:12px;">
                <label class="modal-checkbox-label" style="color:${skipColor};">
                    <input type="checkbox" onchange="window.tempEditingLabels[${index}].isSkip = this.checked; LabelManager.renderEventLabels();" ${skipChecked} class="modal-checkbox">
                    수업삭제
                </label>
                ${deleteBtnHTML}
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

  // 💡 삭제된 라벨이 있을 경우 클라우드(DB)에서 과거 일정들을 찾아내어 기본 라벨로 변경하는 로직
  saveEventLabels: async function(e) {
    if (window.tempEditingLabels.length === 0) return alert("최소 1개의 라벨은 있어야 합니다.");
    
    const oldLabels = window.getEventLabels().map(l => l.name);
    const newLabels = window.tempEditingLabels.map(l => l.name);
    const deletedLabels = oldLabels.filter(l => !newLabels.includes(l));
    const defaultLabel = newLabels[0]; // 무조건 남게 되는 첫 번째 라벨

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
                
                if (list.length === 0 && data.eventText) {
                    list = window.parseRawEventTextToEventList(data.eventText);
                }

                list.forEach(ev => {
                    if (deletedLabels.includes(ev.label)) {
                        ev.label = defaultLabel; // 삭제된 라벨을 기본 라벨로 변경
                        changed = true;
                    }
                });

                if (changed) {
                    const newText = window.formatEventListToText(list);
                    batch.update(doc.ref, { eventList: list, eventText: newText, updatedAt: Date.now() });
                    opCount++;
                    if (opCount >= 400) { // 파이어베이스 일괄 처리 한도 대응
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
              <strong>[일지 라벨]</strong> 라벨 삭제 시 기존 일지는 자동으로 '기본 라벨'로 대체됩니다.
          </p>
      </div>
      <div id="journal-label-list-container" class="modal-list-container" style="max-height: 200px;"></div>
      
      <div class="modal-input-row alt" style="flex-direction:column; align-items:stretch; gap:10px; margin-bottom:20px;">
          <div style="display:flex; gap:10px; align-items:center; width:100%;">
              <input type="text" id="new-journal-label-name" placeholder="새 일지 라벨 이름..." class="modal-input-text">
              <button onclick="LabelManager.addNewJournalLabel()" class="modal-btn-secondary journal" style="flex-shrink:0;">추가</button>
          </div>
          <div style="padding-left:4px;">
              <span style="font-size:0.85rem; font-weight:bold; color:#64748b;">🎨 라벨 색상 선택:</span>
              ${this.getColorPickerHTML('journal', 'purple')}
          </div>
      </div>
      
      <div class="modal-footer-actions">
          <button onclick="LabelManager.saveJournalLabels(event)" class="modal-btn-primary journal">저장 및 적용</button>
      </div>
    `;
  },

  openJournalModal: function() {
    if (!this.journalModal) {
      this.journalModal = new window.Modal({
        id: 'journal-label-modal-v3',
        title: '📔 일지 라벨 설정',
        width: '450px',
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
        const style = window.LABEL_PALETTE[label.color || 'purple'] || window.LABEL_PALETTE['purple'];
        
        // 💡 일지도 마찬가지로 1번째(index 0) 라벨은 삭제 버튼 숨김
        const deleteBtnHTML = index === 0 
            ? `<span style="font-size:0.8rem; color:#94a3b8; font-weight:bold; background:#f1f5f9; padding:3px 6px; border-radius:4px;">기본 (삭제불가)</span>` 
            : `<button onclick="window.tempEditingJournalLabels.splice(${index}, 1); LabelManager.renderJournalLabels();" class="modal-delete-btn" title="삭제">✖</button>`;

        return `
        <div class="modal-input-row journal">
            <span class="modal-item-text journal" style="background:${style.bg}; color:${style.text}; border:1px solid ${style.border}; padding:2px 8px; border-radius:4px; font-size:0.9rem;">${label.name}</span>
            <div style="flex:1;"></div>
            ${deleteBtnHTML}
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
                        j.label = defaultLabel; // 삭제된 라벨을 기본 라벨로 덮어쓰기
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
  }
};

window.openEventLabelModal = () => LabelManager.openEventModal();
window.openJournalLabelModal = () => LabelManager.openJournalModal();
