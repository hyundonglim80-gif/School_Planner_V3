const LabelManager = {
  eventModal: null,
  journalModal: null,

  // ====================================================
  // 🏷️ 1. 일정 라벨 (Event Labels) 관리
  // ====================================================
  getEventContentHTML: function() {
    return `
      <div style="background:#f1f5f9; padding:15px; border-radius:8px; margin-bottom:15px; border-left:4px solid #3b82f6;">
          <p style="margin:0; font-size:0.95rem; color:#334155; line-height:1.5;">
              <strong>[일정 라벨]</strong> 학교 행사나 개인 일정을 분류하는 태그입니다.<br>
              <span style="color:#ef4444; font-weight:bold;">'수업삭제'</span> 체크 시, 해당 라벨이 포함된 날짜는 시간표가 자동으로 X 처리됩니다.
          </p>
      </div>
      <div id="event-label-list-container" style="display:flex; flex-direction:column; gap:10px; max-height:250px; overflow-y:auto; margin-bottom:15px; padding-right:5px;"></div>
      
      <div style="display:flex; gap:10px; margin-bottom:20px; background:#f8fafc; padding:10px; border-radius:8px; border:1px solid #e2e8f0;">
          <input type="text" id="new-label-name" placeholder="새 라벨 이름..." style="flex:1; padding:8px; border:1px solid #cbd5e1; border-radius:4px; outline:none;">
          <label style="display:flex; align-items:center; gap:4px; font-size:0.85rem; color:#ef4444; cursor:pointer; font-weight:bold;">
              <input type="checkbox" id="new-label-skip" style="accent-color:#ef4444;"> 수업삭제
          </label>
          <button onclick="LabelManager.addNewEventLabel()" style="background:#3b82f6; color:#fff; border:none; padding:8px 12px; border-radius:4px; font-weight:bold; cursor:pointer;">추가</button>
      </div>
      
      <div style="border-top:1px solid #e2e8f0; padding-top:15px; display:flex; justify-content:flex-end;">
          <button onclick="LabelManager.saveEventLabels()" style="background:#2563eb; color:#fff; border:none; padding:10px 20px; border-radius:8px; font-weight:bold; cursor:pointer;">저장 및 적용</button>
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
    
    // 💡 최적화: innerHTML += 대신 map().join('')을 사용하여 렌더링 성능 대폭 향상
    container.innerHTML = window.tempEditingLabels.map((label, index) => {
        const skipChecked = label.isSkip ? 'checked' : '';
        const skipColor = label.isSkip ? '#ef4444' : '#64748b';
        return `
        <div style="display:flex; justify-content:space-between; align-items:center; background:#fff; padding:8px 12px; border-radius:6px; border:1px solid #e2e8f0;">
            <span style="font-weight:bold; color:#1e40af; font-size:1.05rem;">${label.name}</span>
            <div style="display:flex; align-items:center; gap:12px;">
                <label style="display:flex; align-items:center; gap:4px; font-size:0.85rem; color:${skipColor}; cursor:pointer;">
                    <input type="checkbox" onchange="window.tempEditingLabels[${index}].isSkip = this.checked; LabelManager.renderEventLabels();" ${skipChecked} style="accent-color:#ef4444;">
                    수업삭제
                </label>
                <button onclick="window.tempEditingLabels.splice(${index}, 1); LabelManager.renderEventLabels();" style="background:none; border:none; color:#ef4444; font-size:1.1rem; cursor:pointer;" title="삭제">✖</button>
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
      <div style="background:#fdf2f8; padding:15px; border-radius:8px; margin-bottom:15px; border-left:4px solid #be185d;">
          <p style="margin:0; font-size:0.95rem; color:#831843; line-height:1.5;">
              <strong>[일지 라벨]</strong> 학생 상담, 사건 사고, 업무 기록 등을 분류하는 태그입니다.
          </p>
      </div>
      <div id="journal-label-list-container" style="display:flex; flex-direction:column; gap:10px; max-height:250px; overflow-y:auto; margin-bottom:15px; padding-right:5px;"></div>
      
      <div style="display:flex; gap:10px; margin-bottom:20px; background:#f8fafc; padding:10px; border-radius:8px; border:1px solid #e2e8f0;">
          <input type="text" id="new-journal-label-name" placeholder="새 일지 라벨 이름..." style="flex:1; padding:8px; border:1px solid #cbd5e1; border-radius:4px; outline:none;">
          <button onclick="LabelManager.addNewJournalLabel()" style="background:#be185d; color:#fff; border:none; padding:8px 12px; border-radius:4px; font-weight:bold; cursor:pointer;">추가</button>
      </div>
      
      <div style="border-top:1px solid #e2e8f0; padding-top:15px; display:flex; justify-content:flex-end;">
          <button onclick="LabelManager.saveJournalLabels()" style="background:#9d174d; color:#fff; border:none; padding:10px 20px; border-radius:8px; font-weight:bold; cursor:pointer;">저장 및 적용</button>
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
    
    // 💡 최적화: innerHTML += 대신 map().join('') 사용
    container.innerHTML = window.tempEditingJournalLabels.map((label, index) => `
        <div style="display:flex; justify-content:space-between; align-items:center; background:#fff; padding:8px 12px; border-radius:6px; border:1px solid #fbcfe8;">
            <span style="font-weight:bold; color:#9d174d; font-size:1.05rem;">${label.name}</span>
            <button onclick="window.tempEditingJournalLabels.splice(${index}, 1); LabelManager.renderJournalLabels();" style="background:none; border:none; color:#ef4444; font-size:1.1rem; cursor:pointer;" title="삭제">✖</button>
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

// 드롭다운 메뉴 클릭 시 모달이 뜨도록 기존 함수 이름과 연결
window.openEventLabelModal = () => LabelManager.openEventModal();
window.openJournalLabelModal = () => LabelManager.openJournalModal();
