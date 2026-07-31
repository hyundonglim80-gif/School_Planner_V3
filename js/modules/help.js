// js/modules/help.js

const HelpModule = {
  modalInstance: null,
  
  getContentHTML: function() {
    return `
      <div class="modal-help-container">
        <h3 class="modal-help-title">⌨️ 핵심 단축키</h3>
        <ul style="padding-left: 20px; margin-bottom: 20px;">
          <li><strong>Ctrl + 방향키(좌/우):</strong> 이전/다음 날짜(또는 주, 월)로 빠르게 이동</li>
          <li><strong>Ctrl + 방향키(상/하):</strong> 뷰어 모드(상) / 에디터 모드(하) 전환</li>
          <li><strong>Ctrl + Enter:</strong> 현재 작성 중인 내용 즉시 저장</li>
          <li><strong>Shift + 방향키(좌/우):</strong> 일/주/월/년 보기 형식 빠르게 넘기기</li>
          <li><strong>/ (슬래시):</strong> 통합 검색창 열기</li>
          <li><strong>Esc:</strong> 열려있는 팝업창 모두 닫기</li>
        </ul>

        <h3 class="modal-help-title">⚙️ 화면 분할 및 수업 시수 설정</h3>
        <p style="margin-bottom: 20px;">우측 상단 <strong>[⋮] 메뉴 > [⚙️ 환경 설정]</strong>에서 '아침활동', '1교시', '방과후' 등 학교에 맞는 수업 시간 명칭과 개수를 자유롭게 추가하세요. 설정된 개수에 맞춰 화면 칸이 자동으로 분할됩니다.</p>

        <h3 class="modal-help-title">🏷️ 일정 라벨과 '수업 삭제' 기능</h3>
        <p style="margin-bottom: 20px;">우측 상단 메뉴 <strong>[🏷️ 일정 라벨 관리]</strong>에서 자주 쓰는 태그를 만들 수 있습니다. 특히 <span style="color:#ef4444; font-weight:bold;">'수업삭제'</span> 속성이 체크된 라벨(예: 휴일, 전일행사)을 일정에 등록하면, 해당 날짜의 시간표는 자동으로 비워집니다.</p>

        <h3 class="modal-help-title">🗓️ 기준 시간표 일괄 적용</h3>
        <p style="margin-bottom: 20px;">학기 초 <strong>[🗓️ 기준 시간표 등록]</strong>에서 학급 시간표를 한 번만 저장해 두세요. 이후 적용할 기간을 선택하고 일괄 적용을 누르면, 휴일/행사 날짜를 똑똑하게 피해서 시간표가 자동으로 채워집니다.</p>

        <h3 class="modal-help-title">💾 데이터 동기화 및 백업</h3>
        <p style="margin-bottom: 20px;">모든 데이터는 클라우드에 실시간 저장되어 PC와 모바일에서 즉시 연동됩니다. <strong>[데이터 백업(CSV)]</strong>을 통해 엑셀 파일로 개인 보관하거나 대량 수정 후 업로드할 수 있습니다.</p>

        <h3 class="modal-help-title">📱 모바일 스와이프 제스처</h3>
        <p style="margin-bottom: 20px;">스마트폰 화면에서는 <strong>좌우로 밀기(스와이프)</strong>를 통해 이전/다음 날짜나 다른 보기 형식으로 부드럽게 화면을 넘길 수 있습니다.</p>
        
        <div class="modal-help-footer">
            <label class="modal-help-checkbox-label">
                <input type="checkbox" id="chk-hide-help" class="modal-help-checkbox"> 
                이 창을 다시 보지 않기
            </label>
        </div>
      </div>
    `;
  },

  open: function() {
    if (!this.modalInstance) {
      this.modalInstance = new window.Modal({
        id: 'help-modal-v2',
        title: '📖 사용 설명서 및 단축키 안내',
        width: '600px',
        content: this.getContentHTML(),
        onClose: () => {
          const chk = document.getElementById('chk-hide-help');
          if (chk && chk.checked) {
            localStorage.setItem('workCalendar_hideHelp_v3', 'true');
          }
        }
      });
    }
    
    this.modalInstance.open();
    const chk = document.getElementById('chk-hide-help');
    if (chk) {
      chk.checked = localStorage.getItem('workCalendar_hideHelp_v3') === 'true';
    }
  }
};

window.openHelpModal = () => HelpModule.open();
