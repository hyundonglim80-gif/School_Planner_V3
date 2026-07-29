// 환경 설정 기능만 전담하는 독립 모듈
const SettingsModule = {
  modalInstance: null,
  
  // 팝업창 HTML 내용 구성 (기존 index.html 내용과 완벽 동일)
  getContentHTML: function() {
    return `
      <div style="background:#f1f5f9; padding:15px; border-radius:8px; margin-bottom:15px; border-left:4px solid #3b82f6;">
          <p style="margin:0; color:#334155; font-size:0.95rem; line-height:1.5;">
              <strong>[시수 설정]</strong> 학교마다 다른 수업 시간을 자유롭게 변경하세요.<br>
              이곳에 등록된 개수와 순서에 맞춰 화면 칸이 자연스럽게 분할됩니다.
          </p>
      </div>
      <div id="settings-period-list" style="display:flex; flex-direction:column; gap:10px;"></div>
      <button onclick="SettingsModule.addPeriodInput()" style="margin-top:15px; width:100%; padding:10px; border:1px dashed #cbd5e1; background:#f8fafc; color:#3b82f6; border-radius:8px; cursor:pointer; font-weight:bold; transition: 0.2s;">
          + 새로운 시간/활동 추가
      </button>
      <div style="margin-top:20px; padding-top:15px; border-top:1px solid #e2e8f0; display:flex; justify-content:flex-end;">
          <button onclick="SettingsModule.saveSettings(event)" style="background:#2563eb; color:#fff; border:none; padding:10px 20px; border-radius:8px; font-weight:bold; cursor:pointer;">저장 및 적용</button>
      </div>
    `;
  },

  open: function() {
    // 팝업이 아직 생성되지 않았다면 최초 1회 생성
    if (!this.modalInstance) {
      this.modalInstance = new window.Modal({
        id: 'settings-modal-v2',
        title: '⚙️ 환경 설정 (수업 명칭/시수)',
        width: '450px',
        content: this.getContentHTML()
      });
    }
    
    // 글로벌에 저장된 시수 불러오기
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
        <div style="display:flex; gap:10px; align-items:center; background:#fff; border:1px solid #e2e8f0; padding:8px 12px; border-radius:6px;">
            <span style="font-weight:bold; color:#64748b; width:20px;">${index + 1}</span>
            <input type="text" id="temp-period-input-${index}" value="${name}" 
                   onchange="window.tempPeriodNames[${index}]=this.value"
                   style="flex:1; padding:6px; border:1px solid #cbd5e1; border-radius:4px; font-size:1rem;">
            <button onclick="SettingsModule.removePeriodInput(${index})" style="background:none; border:none; color:#ef4444; font-size:1.2rem; cursor:pointer;" title="삭제">✖</button>
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
      this.modalInstance.close(); // 저장 완료 후 모달 닫기
      window.render(); // 메인 화면 다시 그리기
    } catch (e) {
      alert("설정 저장에 실패했습니다.");
    } finally {
      btn.textContent = "저장 및 적용";
      btn.disabled = false;
    }
  }
};

// 전역에서 접근할 수 있도록 연결 (드롭다운 메뉴에서 클릭 시 실행용)
window.openSettingsModal = () => SettingsModule.open();