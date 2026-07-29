const HelpModule = {
  modalInstance: null,
  
  getContentHTML: function() {
    return `
      <div style="line-height: 1.6; color: #334155;">
        <h3 style="color:#1e40af; margin-top:0;">⌨️ 핵심 단축키</h3>
        <ul style="padding-left: 20px; margin-bottom: 20px;">
          <li><strong>Ctrl + 방향키(좌/우):</strong> 이전/다음 날짜(또는 주, 월)로 빠르게 이동</li>
          <li><strong>Ctrl + Enter:</strong> 현재 작성 중인 내용 저장 (방해되는 팝업창 없음)</li>
          <li><strong>Esc:</strong> 열려있는 팝업창 닫기</li>
        </ul>
        <h3 style="color:#1e40af;">⚙️ 나만의 수업 시수 및 명칭 설정</h3>
        <div style="background:#dcfce7; padding:15px; border-radius:8px; border-left:4px solid #22c55e; margin-bottom: 20px;">
          <p style="margin:0; font-size:0.95rem;">
            <strong>우측 상단 [⋮] 메뉴 > [⚙️ 환경 설정]</strong>에서 우리 학교에 맞는 수업 시간(예: 아침활동, 7교시, 방과후 등)을 자유롭게 추가하고 이름을 변경할 수 있습니다.
          </p>
        </div>
        <h3 style="color:#1e40af;">💡 모바일 및 추가 팁</h3>
        <ul style="padding-left: 20px; margin-bottom: 0;">
          <li>스마트폰 화면에서는 <strong>좌우로 밀기(스와이프)</strong>를 통해 화면을 넘길 수 있습니다.</li>
          <li>검색 창에서는 '항목 추가'를 통해 여러 단어를 조합하여 상세하게 검색할 수 있습니다.</li>
        </ul>
      </div>
    `;
  },

  open: function() {
    if (!this.modalInstance) {
      this.modalInstance = new window.Modal({
        id: 'help-modal-v2',
        title: '📖 사용 설명서 및 단축키 안내',
        width: '500px',
        content: this.getContentHTML()
      });
    }
    this.modalInstance.open();
  }
};

window.openHelpModal = () => HelpModule.open();
