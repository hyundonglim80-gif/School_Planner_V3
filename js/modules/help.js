// js/modules/help.js

const HelpModule = {
  modalInstance: null,
  
  getContentHTML: function() {
    return `
      <div class="modal-help-container" style="padding-top: 5px;">
        
        <h3 class="modal-help-title" style="color:#0f766e; border-bottom-color:#99f6e4;">🔐 데이터 동기화 및 구글 로그인 안내</h3>
        <div style="background:#f0fdfa; padding:15px; border-radius:8px; margin-bottom:20px; border:1px solid #ccfbf1;">
          <ul style="padding-left: 20px; margin-bottom: 0; line-height:1.6; color:#0f766e;">
            <li><strong>구글 로그인 필수:</strong> School Planner는 선생님의 개인 구글 계정(드라이브, 캘린더, Tasks)과 직접 연동하여 모든 데이터를 <strong>선생님의 개인 클라우드에만 안전하게 저장</strong>합니다. 서버에 데이터를 수집하지 않으므로 구글 로그인이 필수입니다.</li>
            <li><strong>⚠️ '확인되지 않은 앱' 경고 화면 대처법:</strong> 
                <br>초기 로그인 시 구글에서 <span style="color:#ef4444; font-weight:bold;">'확인되지 않은 앱'</span> 또는 <span style="color:#ef4444; font-weight:bold;">'신뢰할 수 없는 사이트'</span>라는 경고 화면이 나타날 수 있습니다. 이는 개인 개발 앱에서 흔히 나타나는 구글의 기본 보안 알림입니다.
                <br>👉 당황하지 마시고 화면 왼쪽 하단의 <strong>[고급]</strong> 글씨를 클릭한 후, 맨 아래에 나타나는 <strong>[School Planner V3(으)로 이동(안전하지 않음)]</strong>을 클릭하시면 정상적으로 로그인 및 연동이 완료됩니다.</li>
            <li><strong>필수 권한 체크:</strong> 로그인 시 나타나는 팝업창에서 <strong>'구글 캘린더'</strong>, <strong>'Tasks(할 일)'</strong>, <strong>'Google 스프레드시트'</strong> 관련 권한 체크박스에 모두 체크해 주셔야 동기화 기능이 정상 작동합니다.</li>
          </ul>
        </div>

        <h3 class="modal-help-title">☁️ 클라우드 백업 및 동기화 (NEW)</h3>
        <ul style="padding-left: 20px; margin-bottom: 20px; line-height:1.6;">
          <li><strong>스프레드시트 다이렉트 백업:</strong> 내보내기/가져오기 메뉴에서 [📗 시트로 백업]을 누르면, 선생님의 구글 드라이브에 전용 백업 엑셀 파일이 자동 생성되고 데이터가 안전하게 저장됩니다.</li>
          <li><strong>스마트 병합 복원:</strong> 기존에 저장된 백업 시트에서 데이터를 불러올 때, <strong>삭제된 내용은 비우고 추가된 내용은 합치는 스마트 병합</strong> 기술이 적용되어 데이터가 꼬이지 않습니다.</li>
          <li><strong>구글 캘린더/Tasks 단방향 동기화:</strong> 웹 앱에 작성한 학사일정, 수업, 교단 일지를 구글 캘린더로 깔끔하게 전송하며, 메모는 구글 Tasks로 자동 연동됩니다.</li>
        </ul>

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
