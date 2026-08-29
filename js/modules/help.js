// js/modules/help.js

export const openHelpModal = function() {
    let existingModal = document.getElementById('help-modal');
    if (existingModal) existingModal.remove();

    const hideHelp = localStorage.getItem('workCalendar_hideHelp_v5') === 'true';

    const modalHtml = `
    <div id="help-modal" style="position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.5); z-index:10005; display:flex; justify-content:center; align-items:center; padding:15px; box-sizing:border-box;">
        <div style="background:#fff; padding:0; border-radius:12px; width:100%; max-width:750px; max-height:85vh; display:flex; flex-direction:column; box-shadow:0 10px 25px rgba(0,0,0,0.2); overflow:hidden;">
            
            <div style="background:#f8fafc; padding:20px; border-bottom:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center;">
                <h2 style="margin:0; color:#1e40af; font-size:1.4rem;">📖 School Planner V3.7 상세 사용 설명서</h2>
                <button onclick="document.getElementById('help-modal').remove()" style="background:none; border:none; font-size:1.5rem; cursor:pointer; color:#64748b;" title="닫기">✖</button>
            </div>

            <div style="padding:25px; overflow-y:auto; line-height:1.6; color:#334155; font-size:0.95rem;">
                
                <!-- 1. 기본 조작 및 모드 -->
                <div style="margin-bottom:30px;">
                    <h3 style="color:#2563eb; border-bottom:2px solid #bfdbfe; padding-bottom:5px; margin-top:0;">1. 🧭 기본 조작 방법 및 모드</h3>
                    <ul style="padding-left:20px; margin-top:10px;">
                        <li style="margin-bottom:8px;"><b>작성하기와 보기 모드:</b> 글씨를 입력하려면 상단의 <b>[✏️ 작성]</b> 버튼을 눌러주세요. 작성을 마치고 다른 탭으로 이동하면 <b>저장 버튼을 누르지 않아도 알아서 안전하게 자동 저장</b>됩니다.</li>
                        <li style="margin-bottom:8px;"><b>화면 넘기기 (스와이프):</b> 스마트폰 등 모바일 환경에서는 책장을 넘기듯 화면을 좌우로 밀어주시면 이전/다음 날짜로 부드럽게 이동합니다.</li>
                        <li style="margin-bottom:8px;"><b>오프라인 캐시 및 동기화:</b> 인터넷이 안 되는 환경에서도 기기에 저장된 데이터로 즉시 작동하며, 상단 네트워크 버튼(🌐/✈️)을 통해 필요할 때만 수동 동기화를 진행할 수 있습니다.</li>
                    </ul>
                </div>

                <!-- 2. 핵심 기능 관리 (더보기 메뉴) -->
                <div style="margin-bottom:30px;">
                    <h3 style="color:#059669; border-bottom:2px solid #a7f3d0; padding-bottom:5px;">2. ⚙️ 핵심 기능 관리 ([⋮] 더보기 메뉴)</h3>
                    <p style="margin:5px 0 10px 0; color:#64748b; font-size:0.9rem;">우측 상단의 더보기(⋮) 아이콘을 누르면 학교 업무에 특화된 고급 관리 메뉴를 만날 수 있습니다.</p>
                    <ul style="padding-left:20px; margin-top:5px;">
                        <li style="margin-bottom:8px;"><b>🏷️ 통합 라벨 관리:</b> 일정, 기록, 메모에 붙일 라벨의 색상과 특수 속성(수업 제외, 완료/이월, 기간, 반복 등)을 지정합니다.</li>
                        <li style="margin-bottom:8px;"><b>🧑‍🤝‍🧑 학급 정보(명렬표) 관리:</b> 학생들의 번호, 이름 등을 등록하여 시간표의 '조사표(체크리스트)' 기능과 연동합니다.</li>
                        <li style="margin-bottom:8px;"><b>👥 공유 그룹 관리:</b> 6자리 초대 코드를 통해 동학년, 업무팀 선생님들과 그룹을 맺고 일정을 공유합니다.</li>
                        <li style="margin-bottom:8px;"><b>🏫 시간표 적용:</b> 학기 초 기본 시간표 양식을 불러와 특정 기간에 일괄적으로 캘린더에 적용합니다.</li>
                        <li style="margin-bottom:8px;"><b>💾 내보내기/가져오기:</b> 구글 스프레드시트 또는 로컬 파일(CSV) 형태로 데이터를 안전하게 백업 및 복원합니다.</li>
                    </ul>
                </div>

                <!-- 3. 일정/시간표/기록 그룹 공유 기능 -->
                <div style="margin-bottom:30px;">
                    <h3 style="color:#d97706; border-bottom:2px solid #fde68a; padding-bottom:5px;">3. 👥 일정 · 시간표 · 기록 그룹 공유 기능</h3>
                    <ul style="padding-left:20px; margin-top:10px;">
                        <li style="margin-bottom:8px;"><b>공유 일정:</b> [👥 그룹명] 영역 아래에 일정을 추가하면, 그룹원 모두의 캘린더에 실시간으로 반영되며 완료(✅) 상태도 함께 공유됩니다.</li>
                        <li style="margin-bottom:8px;"><b>공유 시간표:</b> 동학년 공통 수업이나 전담 교사와의 수업 진도·준비물을 그룹 시간표에 적어 함께 공유하고 관리할 수 있습니다.</li>
                        <li style="margin-bottom:8px;"><b>공유 기록 및 문서 첨부:</b> 회의록이나 학습지 파일을 구글 드라이브(📎)로 첨부하여 공유할 수 있습니다. 공유 메모는 <b>작성자 본인만 수정/삭제 가능</b>하여 데이터가 안전하게 보호됩니다.</li>
                    </ul>
                </div>

                <!-- 4. 업무 효율을 높여주는 키보드 단축키 -->
                <div style="margin-bottom:20px;">
                    <h3 style="color:#7e22ce; border-bottom:2px solid #e9d5ff; padding-bottom:5px;">4. ⌨️ 업무 효율을 높여주는 키보드 단축키</h3>
                    <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px; margin-top:10px;">
                        <table style="width:100%; border-collapse:collapse; font-size:0.9rem;">
                            <tr style="border-bottom:1px solid #cbd5e1; background:#f1f5f9;">
                                <th style="padding:6px; text-align:left; color:#1e293b;">기능</th>
                                <th style="padding:6px; text-align:left; color:#1e293b;">단축키</th>
                            </tr>
                            <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:6px;">보기 모드 전환</td><td style="padding:6px; font-weight:bold; color:#2563eb;">Ctrl + ⬆️</td></tr>
                            <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:6px;">작성 모드 전환 (또는 저장)</td><td style="padding:6px; font-weight:bold; color:#2563eb;">Ctrl + ⬇️ (또는 Ctrl + Enter)</td></tr>
                            <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:6px;">오늘 날짜로 즉시 이동</td><td style="padding:6px; font-weight:bold; color:#2563eb;">Ctrl + Space</td></tr>
                            <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:6px;">이전 / 다음 기간 이동</td><td style="padding:6px; font-weight:bold; color:#2563eb;">Ctrl + ⬅️ / ➡️</td></tr>
                            <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:6px;">화면(탭) 이동 (하루~메모)</td><td style="padding:6px; font-weight:bold; color:#2563eb;">Shift + 1 ~ 5</td></tr>
                            <!-- 💡 백틱 기호를 파싱 오류 방지를 위해 HTML 엔티티(&#96;)로 교체했습니다. -->
                            <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:6px;">검색창 열기</td><td style="padding:6px; font-weight:bold; color:#2563eb;">Shift + &#96; (물결표 키)</td></tr>
                            <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:6px;">주말 표시 토글</td><td style="padding:6px; font-weight:bold; color:#2563eb;">Shift + ⬆️ / ⬇️</td></tr>
                            <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:6px;">수업 표시 토글</td><td style="padding:6px; font-weight:bold; color:#2563eb;">Alt + ⬆️ / ⬇️</td></tr>
                            <tr><td style="padding:6px;">구글 캘린더 빠른 동기화</td><td style="padding:6px; font-weight:bold; color:#2563eb;">Ctrl + Shift + Enter</td></tr>
                        </table>
                    </div>
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
        localStorage.setItem('workCalendar_hideHelp_v5', isChecked ? 'true' : 'false');
        document.getElementById('help-modal').remove();
    };
};

// ==========================================================================
// 🌉 과도기 호환성 레이어 
// ==========================================================================
window.openHelpModal = openHelpModal;
