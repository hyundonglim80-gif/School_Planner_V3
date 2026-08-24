// js/modules/help.js

export const openHelpModal = function() {
    let existingModal = document.getElementById('help-modal');
    if (existingModal) existingModal.remove();

    const hideHelp = localStorage.getItem('workCalendar_hideHelp_v4') === 'true';

    const modalHtml = `
    <div id="help-modal" style="position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.5); z-index:10005; display:flex; justify-content:center; align-items:center; padding:15px; box-sizing:border-box;">
        <div style="background:#fff; padding:0; border-radius:12px; width:100%; max-width:650px; max-height:85vh; display:flex; flex-direction:column; box-shadow:0 10px 25px rgba(0,0,0,0.2); overflow:hidden;">
            
            <div style="background:#f8fafc; padding:20px; border-bottom:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center;">
                <h2 style="margin:0; color:#1e40af; font-size:1.4rem;">📖 School Planner 친절한 사용 설명서</h2>
                <button onclick="document.getElementById('help-modal').remove()" style="background:none; border:none; font-size:1.5rem; cursor:pointer; color:#64748b;" title="닫기">✖</button>
            </div>

            <div style="padding:20px; overflow-y:auto; line-height:1.6; color:#334155; font-size:0.95rem;">
                
                <div style="margin-bottom:25px;">
                    <h3 style="color:#2563eb; border-bottom:2px solid #bfdbfe; padding-bottom:5px; margin-top:0;">1. 🧭 기본 조작 방법</h3>
                    <ul style="padding-left:20px; margin-top:10px;">
                        <li style="margin-bottom:8px;"><b>작성하기와 보기 모드:</b> 글씨를 입력하려면 상단의 <b>[✏️ 작성]</b> 버튼을 눌러주세요. 다 쓰신 후 <b>[👁️ 뷰어]</b> 버튼을 누르면 깔끔하게 정리된 화면을 볼 수 있습니다.</li>
                        <li style="margin-bottom:8px;"><b>알아서 자동 저장:</b> 작성 모드에서 글을 쓰다가 다른 탭(주간, 월간 등)으로 이동하면 <b>저장 버튼을 누르지 않아도 알아서 안전하게 저장</b>됩니다.</li>
                        <li style="margin-bottom:8px;"><b>화면 넘기기:</b> 스마트폰에서는 책장을 넘기듯 <b>화면을 좌우로 스윽 밀어주시면(스와이프)</b> 이전/다음 날짜로 부드럽게 이동합니다.</li>
                        <li style="margin-bottom:8px;"><b>키보드 단축키 (컴퓨터용):</b> 
                            <br>• <b>Ctrl + 방향키(좌/우):</b> 이전/다음 날짜로 이동
                            <br>• <b>Shift + 방향키(좌/우):</b> 년/월/주/일/메모 탭으로 빠른 이동
                        </li>
                    </ul>
                </div>

                <div style="margin-bottom:25px;">
                    <h3 style="color:#059669; border-bottom:2px solid #a7f3d0; padding-bottom:5px;">2. ✅ 할 일(일정) 관리의 마법</h3>
                    <ul style="padding-left:20px; margin-top:10px;">
                        <li style="margin-bottom:8px;"><b>못다 한 일은 자동으로 내일로!:</b> '완료' 속성이 있는 일정을 오늘 다 끝내지 못하면, <b>➡️(미완료) 표시가 남고 다음 날로 할 일이 알아서 넘어갑니다(↪️이월됨).</b> 체크박스를 눌러 완료(✓)하면 더 이상 넘어가지 않습니다.</li>
                        <li style="margin-bottom:8px;"><b>여러 날에 걸친 일정 등록:</b> 라벨 설정에서 <b>달력 아이콘(📅)</b>이 켜진 라벨을 선택해보세요. 시작일과 종료일을 입력하면 한 번에 일정을 등록할 수 있습니다. <b>'주말 제외'</b>에 체크하면 평일에만 쏙쏙 들어갑니다.</li>
                        <li style="margin-bottom:8px;"><b>안전한 일정 지우기:</b> 복사되어 넘어온 일정이나 기간 일정을 지울(✖) 때는, <b>"이 날 하루만 지울지, 전부 다 지울지"</b> 물어보는 안전 팝업창이 뜨니 실수로 지울 걱정이 없습니다.</li>
                    </ul>
                </div>

                <div style="margin-bottom:25px;">
                    <h3 style="color:#d97706; border-bottom:2px solid #fde68a; padding-bottom:5px;">3. 🎒 우리 학교 맞춤형 시간표</h3>
                    <ul style="padding-left:20px; margin-top:10px;">
                        <li style="margin-bottom:8px;"><b>교시 수와 이름 내 마음대로!:</b> 오른쪽 위의 <b>[⋮ (점 세 개) 👉 ⚙️ 환경 설정]</b>을 누르시면 하루 수업을 몇 교시까지 할지 정할 수 있고, '아침활동', '방과후' 처럼 이름도 자유롭게 지을 수 있습니다.</li>
                        <li style="margin-bottom:8px;"><b>마우스 클릭으로 수업 맞바꾸기:</b> '일(Day)' 보기 화면에서 파란색 밑줄 친 교시 이름(예: <u>1교시</u>)을 마우스로 톡 눌러보세요. 다른 날짜나 다른 시간의 수업과 통째로 샥! 맞바꿀 수 있습니다.</li>
                        <li style="margin-bottom:8px;"><b>수업 없는 날 자동 비우기:</b> 라벨 설정에서 '수업 제외' 기능이 켜진 라벨(예: 전일행사, 휴일)을 선택하면 그 날은 알아서 시간표 칸이 비워집니다.</li>
                    </ul>
                </div>

                <div style="margin-bottom:20px;">
                    <h3 style="color:#7e22ce; border-bottom:2px solid #e9d5ff; padding-bottom:5px;">4. 🔍 쉽게 찾고 안전하게 보관하기</h3>
                    <ul style="padding-left:20px; margin-top:10px;">
                        <li style="margin-bottom:8px;"><b>어디에 적었더라? 바로 검색!:</b> 상단의 돋보기(🔍) 버튼을 누르거나 키보드 <b>/ (슬래시)</b>를 누르면 검색창이 열립니다. 라벨 버튼들을 꾹꾹 눌러서 원하는 기록만 쏙쏙 뽑아보세요.</li>
                        <li style="margin-bottom:8px;"><b>소중한 기록 백업하기:</b> 오른쪽 위 <b>[⋮ (점 세 개)]</b> 메뉴에서 내 데이터를 엑셀(CSV) 파일로 컴퓨터에 안전하게 내려받을 수 있습니다.</li>
                    </ul>
                </div>

            </div>

            <div style="background:#f8fafc; padding:15px 20px; border-top:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center;">
                <label style="display:flex; align-items:center; gap:6px; cursor:pointer; font-size:0.9rem; color:#475569; font-weight:bold;">
                    <input type="checkbox" id="chk-hide-help" ${hideHelp ? 'checked' : ''} style="width:16px; height:16px; accent-color:#2563eb;">
                    시작할 때 이 창 다시 보지 않기
                </label>
                <button id="btn-close-help" style="background:#2563eb; color:#fff; border:none; padding:10px 20px; border-radius:6px; font-weight:bold; cursor:pointer; font-size:1rem;">확인 (닫기)</button>
            </div>
            
        </div>
    </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    document.getElementById('btn-close-help').onclick = function() {
        const isChecked = document.getElementById('chk-hide-help').checked;
        localStorage.setItem('workCalendar_hideHelp_v4', isChecked ? 'true' : 'false');
        document.getElementById('help-modal').remove();
    };
};

// ==========================================================================
// 🌉 과도기 호환성 레이어 
// ==========================================================================
window.openHelpModal = openHelpModal;