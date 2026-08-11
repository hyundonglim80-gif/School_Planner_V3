// js/modules/settings.js

const SettingsModule = {
  modalInstance: null,
  
  getContentHTML: function() {
    return `
      <div class="modal-info-box">
          <p style="margin:0;">
              <strong>[시수 설정]</strong> 학교마다 다른 수업 시간을 자유롭게 변경하세요.<br>
              이곳에 등록된 개수와 순서에 맞춰 화면 칸이 자연스럽게 분할됩니다.
          </p>
      </div>
      <div id="settings-period-list" class="modal-list-container"></div>
      <button onclick="SettingsModule.addPeriodInput()" class="modal-btn-dashed">
          + 새로운 시간/활동 추가
      </button>
      <div class="modal-footer-actions">
          <button onclick="SettingsModule.saveSettings(event)" class="modal-btn-primary">저장 및 적용</button>
      </div>
    `;
  },

  open: function() {
    if (!this.modalInstance) {
      this.modalInstance = new window.Modal({
        id: 'settings-modal-v2',
        title: '⚙️ 환경 설정 (수업 명칭/시수)',
        width: '450px',
        content: this.getContentHTML()
      });
    }
    window.tempPeriodNames = window.periodNames && window.periodNames.length > 0 
      ? [...window.periodNames] 
      : ["1", "2", "3", "4", "5", "6"];
      
    this.modalInstance.open();
    this.renderPeriods();
  },

  renderPeriods: function() {
    const listDiv = document.getElementById('settings-period-list');
    if (!listDiv) return;
    
    listDiv.innerHTML = window.tempPeriodNames.map((name, index) => `
        <div class="modal-input-row">
            <span style="font-weight:bold; color:#64748b; width:20px;">${index + 1}</span>
            <input type="text" id="temp-period-input-${index}" value="${name}" 
                   onchange="window.tempPeriodNames[${index}]=this.value"
                   class="modal-input-text">
            <button onclick="SettingsModule.removePeriodInput(${index})" class="modal-delete-btn" title="삭제">✖</button>
        </div>
    `).join('');
  },

  addPeriodInput: function() {
    window.tempPeriodNames.push(`새 시간 ${window.tempPeriodNames.length + 1}`);
    this.renderPeriods();
  },

  removePeriodInput: function(index) {
    if (window.tempPeriodNames.length <= 1) {
      alert("최소 1개의 시간은 존재해야 합니다.");
      return;
    }
    window.tempPeriodNames.splice(index, 1);
    this.renderPeriods();
  },

  saveSettings: async function(event) {
    const finalNames = window.tempPeriodNames.map(n => n.trim()).filter(n => n !== '');
    if (finalNames.length === 0) return alert("최소 1개의 유효한 명칭을 입력해야 합니다.");

    const btn = event.target;
    btn.textContent = "저장 중...";
    btn.disabled = true;

    try {
      await window.getUserCol('settings').doc('preferences').set({
          periodNames: finalNames,
          updatedAt: Date.now()
      }, { merge: true });

      window.periodNames = [...finalNames];
      this.modalInstance.close(); 
      window.render(); 
    } catch (e) {
      alert("설정 저장에 실패했습니다.");
    } finally {
      btn.textContent = "저장 및 적용";
      btn.disabled = false;
    }
  }
};

window.openSettingsModal = () => SettingsModule.open();

// ==========================================================================
// 💡 [UX 개선] 외부 영역 클릭 및 ESC 키 입력 시 '더보기' 메뉴 닫기 로직
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    
    // 1. 바탕화면 아무 곳이나 클릭 시 닫기
    document.addEventListener('click', function(event) {
        const dropdown = document.getElementById('more-dropdown');
        const container = document.getElementById('more-menu-container'); // index.html에 추가한 래퍼 ID
        
        // 클릭한 곳이 메뉴 내부나 '⋮' 버튼이 아니면서 메뉴가 열려있다면 닫기
        if (dropdown && !dropdown.classList.contains('hidden')) {
            if (container && !container.contains(event.target)) {
                dropdown.classList.add('hidden');
            }
        }
    });

    // 2. ESC 키보드 입력 시 닫기
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            const dropdown = document.getElementById('more-dropdown');
            if (dropdown && !dropdown.classList.contains('hidden')) {
                dropdown.classList.add('hidden');
            }
        }
    });
});
