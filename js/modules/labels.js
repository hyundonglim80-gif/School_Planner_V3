//js/modules/labels.js

const LabelManager = {
  eventModal: null,
  journalModal: null,

  // ====================================================
  // 🏷️ 1. 일정 라벨 (Event Labels) 관리
  // ====================================================
  getEventContentHTML: function() {
    return `
      <div class="modal-info-box">
          <p style="margin:0;">
              <strong>[일정 라벨]</strong> 학교 행사나 개인 일정을 분류하는 태그입니다.<br>
              <span style="color:#ef4444; font-weight:bold;">'수업삭제'</span> 체크 시, 해당 라벨이 포함된 날짜는 시간표가 자동으로 X 처리됩니다.
          </p>
      </div>
      <div id="event-label-list-container" class="modal-list-container"></div>
      
      <div class="modal-input-row alt" style="margin-bottom:20px;">
          <input type="text" id="new-label-name" placeholder="새 라벨 이름..." class="modal-input-text">
          <label class="modal-checkbox-label alert">
              <input type="checkbox" id="new-label-skip" class="modal-checkbox"> 수업삭제
          </label>
          <button onclick="LabelManager.addNewEventLabel()" class="modal-btn-secondary">추가</button>
      </div>
      
      <div class="modal-footer-actions">
          <button onclick="LabelManager.saveEventLabels()" class="modal-btn-primary">저장 및 적용</button>
      </div>
    `;
  },

  openEventModal: function() {
    if (!this.eventModal) {
      this.eventModal = new window.Modal({
        id: 'event-label-modal-v2',
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
        return `
        <div class="modal-input-row">
            <span class="modal-item-text">${label.name}</span>
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
    const name = nameInput.value.trim();
    
    if (!name) return alert("라벨 이름을 입력하세요.");
    if (window.tempEditingLabels.some(l => l.name === name)) return alert("이미 존재하는 라벨입니다.");
    
    window.tempEditingLabels.push({ name: name, isSkip: skipCheck.checked });
    nameInput.value = '';
    skipCheck.checked = false;
    this.renderEventLabels();
  },

  saveEventLabels: function() {
    if (window.tempEditingLabels.length === 0) return alert("최소 1개의 라벨은 있어야 합니다.");
    localStorage.setItem('workCalendar_eventLabels_v2', JSON.stringify(window.tempEditingLabels));
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
      <div id="journal-label-list-container" class="modal-list-container"></div>
      
      <div class="modal-input-row alt" style="margin-bottom:20px;">
          <input type="text" id="new-journal-label-name" placeholder="새 일지 라벨 이름..." class="modal-input-text">
          <button onclick="LabelManager.addNewJournalLabel()" class="modal-btn-secondary journal">추가</button>
      </div>
      
      <div class="modal-footer-actions">
          <button onclick="LabelManager.saveJournalLabels()" class="modal-btn-primary journal">저장 및 적용</button>
      </div>
    `;
  },

  openJournalModal: function() {
    if (!this.journalModal) {
      this.journalModal = new window.Modal({
        id: 'journal-label-modal-v2',
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
    
    container.innerHTML = window.tempEditingJournalLabels.map((label, index) => `
        <div class="modal-input-row journal">
            <span class="modal-item-text journal">${label.name}</span>
            <button onclick="window.tempEditingJournalLabels.splice(${index}, 1); LabelManager.renderJournalLabels();" class="modal-delete-btn" title="삭제">✖</button>
        </div>
    `).join('');
  },

  addNewJournalLabel: function() {
    const nameInput = document.getElementById('new-journal-label-name');
    const name = nameInput.value.trim();
    
    if (!name) return alert("라벨 이름을 입력하세요.");
    if (window.tempEditingJournalLabels.some(l => l.name === name)) return alert("이미 존재하는 라벨입니다.");
    
    window.tempEditingJournalLabels.push({ name: name });
    nameInput.value = '';
    this.renderJournalLabels();
  },

  saveJournalLabels: function() {
    if (window.tempEditingJournalLabels.length === 0) return alert("최소 1개의 일지 라벨은 있어야 합니다.");
    localStorage.setItem('workCalendar_journalLabels', JSON.stringify(window.tempEditingJournalLabels));
    this.journalModal.close();
    alert("일지 라벨 설정이 성공적으로 저장되었습니다.");
    window.render(); 
  }
};

window.openEventLabelModal = () => LabelManager.openEventModal();
window.openJournalLabelModal = () => LabelManager.openJournalModal();
