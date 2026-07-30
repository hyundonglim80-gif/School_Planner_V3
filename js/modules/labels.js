const LabelManager = {
  eventModal: null,
  journalModal: null,

  // 🎨 동그란 색상 선택기 UI 생성 함수
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
              <strong>[일정 라벨]</strong> 학교 행사나 개인 일정을 분류하는 태그입니다.<br>
              <span style="color:#ef4444; font-weight:bold;">'수업삭제'</span> 체크 시, 해당 라벨이 포함된 날짜는 시간표가 자동으로 비워집니다.
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
          <button onclick="LabelManager.saveEventLabels()" class="modal-btn-primary">저장 및 적용</button>
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
        
        return `
        <div class="modal-input-row">
            <span class="modal-item-text" style="background:${style.bg}; color:${style.text}; border:1px solid ${style.border}; padding:2px 8px; border-radius:4px; font-size:0.9rem;">${label.name}</span>
            <div style="flex:1;"></div>
            <div style="display:flex; align-items:center; gap:12px;">
                <label class="modal-checkbox-label" style="color:${skipColor};">
                    <input type="checkbox" onchange="window.tempEditingLabels[${index}].isSkip = this.checked; LabelManager.renderEventLabels();" ${skipChecked} class="modal-checkbox">
                    수업삭제
                </label>
                <button onclick="window.tempEditingLabels.splice(${index}, 1); LabelManager.renderEventLabels();" class="modal-delete-btn" title="삭제">✖</button>
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

  saveEventLabels: function() {
    if (window.tempEditingLabels.length === 0) return alert("최소 1개의 라벨은 있어야 합니다.");
    localStorage.setItem('workCalendar_eventLabels_v4', JSON.stringify(window.tempEditingLabels));
    this.eventModal.close();
    alert("라벨 설정이 저장되었습니다.");
    window.render(); 
  },

  // ====================================================
  // 📔 2. 일지 라벨 (Journal Labels) 관리
  // ====================================================
  getJournalContentHTML: function() {
    return `
      <div class="modal-info-box journal">
          <p style="margin:0;">
              <strong>[일지 라벨]</strong> 학생 상담, 사건 사고, 업무 기록 등을 분류하는 태그입니다.
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
          <button onclick="LabelManager.saveJournalLabels()" class="modal-btn-primary journal">저장 및 적용</button>
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
        return `
        <div class="modal-input-row journal">
            <span class="modal-item-text journal" style="background:${style.bg}; color:${style.text}; border:1px solid ${style.border}; padding:2px 8px; border-radius:4px; font-size:0.9rem;">${label.name}</span>
            <div style="flex:1;"></div>
            <button onclick="window.tempEditingJournalLabels.splice(${index}, 1); LabelManager.renderJournalLabels();" class="modal-delete-btn" title="삭제">✖</button>
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

  saveJournalLabels: function() {
    if (window.tempEditingJournalLabels.length === 0) return alert("최소 1개의 일지 라벨은 있어야 합니다.");
    localStorage.setItem('workCalendar_journalLabels_v4', JSON.stringify(window.tempEditingJournalLabels));
    this.journalModal.close();
    alert("일지 라벨 설정이 성공적으로 저장되었습니다.");
    window.render(); 
  }
};

window.openEventLabelModal = () => LabelManager.openEventModal();
window.openJournalLabelModal = () => LabelManager.openJournalModal();
