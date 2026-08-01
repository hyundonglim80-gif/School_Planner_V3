// js/modules/help.js

const HelpModule = {
  modalInstance: null,
  
  getContentHTML: function() {
    return `
      <div class="modal-help-container" style="padding-top: 5px;">
        <h3 class="modal-help-title">⌨️ 핵심 단축키 및 제스처</h3>
        <ul style="padding-left: 20px; margin-bottom: 20px; line-height:1.6;">
          <li><strong>Ctrl + 방향키(좌/우):</strong> 이전/다음 날짜(또는 주, 월)로 빠르게 이동</li>
          <li><strong>Ctrl + 방향키(상/하):</strong> 보기 모드(상) / 수정 모드(하) 전환</li>
          <li><strong>Shift + 방향키(좌/우):</strong> 메모/년/월/주/일 보기 탭 간 빠른 이동</li>
          <li><strong>/ (슬래시):</strong> 통합 다중 검색창 열기</li>
          <li><strong>Esc:</strong> 열려있는 팝업창 모두 닫기</li>
          <li><strong>📱 모바일 스와이프:</strong> 스마트폰 화면에서 좌우로 밀어 날짜나 보기 형식을 부드럽게 넘기기</li>
        </ul>

        <h3 class="modal-help-title">📝 더욱 스마트해진 '메모' 탭 활용법</h3>
        <ul style="padding-left: 20px; margin-bottom: 20px; line-height:1.6;">
          <li><strong>스마트 레이아웃:</strong> 화면 좌측의 '라벨 필터(개수 표시)'와 우측의 '진행/완료 목록'으로 공간이 나뉘어 할 일을 직관적으로 파악할 수 있습니다.</li>
          <li><strong>자동 저장:</strong> 메모 창에 글을 쓰거나 사진을 올리다가 다른 탭(주, 월 등)으로 이동해도 <strong>자동으로 내용이 추가(저장)</strong>되어 데이터가 날아가지 않습니다.</li>
          <li><strong>문서/링크 모음:</strong> 최상단의 '자주 쓰는 문서/링크'에 나이스(NEIS), 쿨메신저 등 자주 접속하는 사이트를 등록해두고 클릭 한 번에 이동하세요.</li>
        </ul>

        <h3 class="modal-help-title">🗓️ 시간표 관리 및 '수업 교환'</h3>
        <ul style="padding-left: 20px; margin-bottom: 20px; line-height:1.6;">
          <li><strong>수업 시수 자유 설정:</strong> 우측 상단 [⋮] 메뉴 > [⚙️ 환경 설정]에서 아침활동, 1교시, 방과후 등 학교 운영에 맞는 명칭과 교시 개수를 설정하세요.</li>
          <li><strong>기준 시간표 일괄 적용:</strong> 학기 초 1/2학기 기준 시간표를 등록해두고 기간을 적용하면, 행사나 휴일(수업 삭제 라벨)을 똑똑하게 피해서 시간표를 자동으로 채워줍니다.</li>
          <li><strong>🔄 수업 교환 (일간 보기):</strong> '일(Day)' 보기 수정 화면에서 교시명(예: 1교시)을 클릭하면, 다른 날짜나 시간의 수업과 서로 내용을 간편하게 맞바꿀 수 있습니다.</li>
        </ul>

        <h3 class="modal-help-title">🏷️ 라벨 커스텀 및 '기록'</h3>
        <ul style="padding-left: 20px; margin-bottom: 20px; line-height:1.6;">
          <li><strong>명칭 변경:</strong> 기존의 '일지' 메뉴가 범용적인 활용을 위해 <strong>'기록'</strong>으로 변경되었습니다. 학급의 하루나 상담 내용을 자유롭게 남겨보세요.</li>
          <li><strong>수업 삭제 라벨:</strong> 일정 라벨 설정 시 <span style="color:#ef4444; font-weight:bold;">'수업삭제'</span>에 체크한 라벨(예: 휴일, 전일행사)을 등록하면 해당 날짜의 시간표 칸이 자동으로 비워집니다.</li>
          <li><strong>라벨 순서 변경:</strong> 모든 라벨 설정 모달창에서 왼쪽의 '≡' 아이콘을 드래그하여 나만의 순서대로 라벨을 재배치할 수 있습니다.</li>
        </ul>

        <h3 class="modal-help-title">🔍 다중 조건 검색 및 💾 데이터 내보내기</h3>
        <ul style="padding-left: 20px; margin-bottom: 20px; line-height:1.6;">
          <li><strong>고급 통합 검색:</strong> 단축키 [ / ]를 눌러 일정, 기록, 수업, 수업 메모 등 검색 분야를 지정하고 AND / OR 조건을 무한대로 엮어 원하는 데이터를 정확히 찾아냅니다.</li>
          <li><strong>안전한 백업/복원:</strong> [일정 및 기록]은 물론, [할일 및 메모] 데이터까지 언제든 엑셀(CSV) 파일로 안전하게 개인 PC에 다운로드하고 복원할 수 있습니다.</li>
        </ul>
      </div>
    `;
  },

  open: function() {
    if (!this.modalInstance) {
      this.modalInstance = new window.Modal({
        id: 'help-modal-v4', 
        title: '📖 사용 설명서',
        width: '650px',
        content: this.getContentHTML(),
      });
    }
    
    this.modalInstance.open();
    
    // 💡 [핵심] 모달창이 열린 직후, 제목줄(header)을 찾아 X버튼 왼쪽에 체크박스 삽입
    const modalEl = document.getElementById('help-modal-v4');
    if (modalEl) {
        const header = modalEl.querySelector('.modal-header');
        // 아직 체크박스가 안 들어갔다면 추가
        if (header && !document.getElementById('chk-hide-help')) {
            const chkContainer = document.createElement('div');
            // 제목과 X버튼 사이 우측으로 정렬
            chkContainer.style.cssText = "display:flex; align-items:center; margin-right:15px; margin-left:auto;";
            chkContainer.innerHTML = `
                <label style="cursor: pointer; font-size: 0.9rem; font-weight: bold; color: #ef4444; display: flex; align-items: center; gap: 6px;" title="체크하면 다음 접속 시부터 이 창이 자동으로 뜨지 않습니다.">
                    <input type="checkbox" id="chk-hide-help" style="width: 16px; height: 16px; cursor: pointer; accent-color: #ef4444;"> 
                    이 창을 다시 보지 않기
                </label>
            `;
            const closeBtn = header.querySelector('.btn-close-modal');
            header.insertBefore(chkContainer, closeBtn);

            // 이벤트 바인딩
            const chk = document.getElementById('chk-hide-help');
            chk.checked = localStorage.getItem('workCalendar_hideHelp_v4') === 'true';
            chk.onchange = () => {
                if (chk.checked) localStorage.setItem('workCalendar_hideHelp_v4', 'true');
                else localStorage.removeItem('workCalendar_hideHelp_v4');
            };
        }
    }
  }
};

window.openHelpModal = () => HelpModule.open();
