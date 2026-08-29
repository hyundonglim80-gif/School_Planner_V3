// js/modules/help.js

export const openHelpModal = function() {
    let existingModal = document.getElementById('help-modal');
    if (existingModal) existingModal.remove();

    const hideHelp = localStorage.getItem('workCalendar_hideHelp_v6') === 'true';

    const modalHtml = `
    <div id="help-modal" style="position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.5); z-index:10005; display:flex; justify-content:center; align-items:center; padding:15px; box-sizing:border-box;">
        <div style="background:#fff; padding:0; border-radius:12px; width:100%; max-width:800px; max-height:88vh; display:flex; flex-direction:column; box-shadow:0 10px 25px rgba(0,0,0,0.2); overflow:hidden;">
            
            <div style="background:#f8fafc; padding:20px; border-bottom:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center;">
                <h2 style="margin:0; color:#1e40af; font-size:1.4rem;">📖 School Planner V3.7 종합 사용 설명서</h2>
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

                <!-- 2. 핵심 기능 관리 상세 가이드 -->
                <div style="margin-bottom:30px;">
                    <h3 style="color:#059669; border-bottom:2px solid #a7f3d0; padding-bottom:5px;">2. ⚙️ 핵심 기능 관리 상세 가이드 ([⋮] 더보기 메뉴)</h3>
                    <p style="margin:5px 0 10px 0; color:#64748b; font-size:0.9rem;">우측 상단의 더보기(⋮) 아이콘을 누르면 학교 업무와 학급 운영에 특화된 고급 관리 기능들을 사용할 수 있습니다.</p>
                    
                    <div style="margin-top:12px; display:flex; flex-direction:column; gap:12px;">
                        <div style="background:#f8fafc; padding:12px; border-radius:8px; border:1px solid #e2e8f0;">
                            <b style="color:#047857;">🏷️ 통합 라벨 관리:</b> 일정, 기록, 메모에 사용할 라벨의 색상과 특수한 속성을 설정하는 공간입니다.
                            <ul style="margin:6px 0 0 20px; padding:0; font-size:0.9rem; color:#475569;">
                                <li><b>수업삭제 (🚫):</b> 현장체험학습, 개교기념일 등 수업이 없는 날에 지정하면 시간표 칸이 자동으로 비워집니다.</li>
                                <li><b>완료 (✅):</b> 체크박스가 생성되는 일정입니다. 미완료 상태로 두면 다음 날짜로 자동 이월됩니다.</li>
                                <li><b>기간 (📅) / 반복 (🔁):</b> 연속된 기간 일정이나 매주/매월 반복되는 일정을 등록할 때 사용합니다.</li>
                            </ul>
                        </div>

                        <div style="background:#f8fafc; padding:12px; border-radius:8px; border:1px solid #e2e8f0;">
                            <b style="color:#047857;">🧑‍🤝‍🧑 학급 정보(명렬표) 관리:</b> 학생들의 번호, 이름 등을 등록하는 공간입니다. 연도별 또는 교과 전담인 경우 반별로 여러 개 등록할 수 있으며, 시간표 영역의 <b>[+ 조사표]</b> 체크리스트와 연동됩니다.
                        </div>

                        <div style="background:#f8fafc; padding:12px; border-radius:8px; border:1px solid #e2e8f0;">
                            <b style="color:#047857;">👥 공유 그룹 관리:</b> 동학년 선생님이나 업무팀 등과 일정을 공유하는 협업 공간입니다. 그룹을 만들면 발급되는 6자리 <b>'초대 코드'</b>를 동료에게 공유하여 즉시 가입시킬 수 있습니다.
                        </div>

                        <div style="background:#f8fafc; padding:12px; border-radius:8px; border:1px solid #e2e8f0;">
                            <b style="color:#047857;">🏫 시간표 적용:</b> 학기 초 기본 시간표 양식을 세팅한 뒤, 적용할 기간(예: 1학기 전체)을 선택해 캘린더에 일괄적으로 덮어씌울 수 있습니다.
                        </div>

                        <div style="background:#f8fafc; padding:12px; border-radius:8px; border:1px solid #e2e8f0;">
                            <b style="color:#047857;">💾 내보내기/가져오기 (백업 및 복원):</b> 구글 스프레드시트 또는 로컬 CSV 파일 형태로 데이터를 안전하게 백업하거나 복원합니다. 데이터 유실을 막기 위해 기존 데이터와 합치는 <b>'병합'</b>과 새로 덮어쓰는 <b>'완전 교체'</b>를 지원합니다.
                        </div>
                    </div>
                </div>

                <!-- 3. 일정/시간표/기록 그룹 공유 기능 상세 -->
                <div style="margin-bottom:30px;">
                    <h3 style="color:#d97706; border-bottom:2px solid #fde68a; padding-bottom:5px;">3. 👥 일정 · 시간표 · 기록 그룹 공유 기능 상세</h3>
                    <p style="margin:5px 0 10px 0; color:#64748b; font-size:0.9rem;">개인 자료는 🔒(파란색), 그룹 자료는 👥(초록색/분홍색) 아이콘으로 완벽히 분리되어 안전하게 협업할 수 있습니다.</p>

                    <div style="margin-top:12px; display:flex; flex-direction:column; gap:12px;">
                        <div style="background:#fefce8; padding:12px; border-radius:8px; border:1px solid #fef08a;">
                            <b style="color:#b45309;">📅 공유 일정 (오늘 할 일):</b> [👥 그룹명] 영역 아래에 일정을 추가하면 그룹원 모두의 캘린더에 실시간으로 반영됩니다. 누군가 체크박스를 완료(✅)하면 다른 선생님들의 화면에서도 즉시 반영됩니다. (동학년 행사, 학부모 총회 등에 활용)
                        </div>

                        <div style="background:#fefce8; padding:12px; border-radius:8px; border:1px solid #fef08a;">
                            <b style="color:#b45309;">🏫 공유 시간표:</b> 그룹 시간표에 과목, 메모, 준비물을 적어 동학년 혹은 전담 교사와 실시간으로 진도와 준비물을 공유할 수 있습니다. 조사표 체크리스트 데이터도 함께 공유됩니다.
                        </div>

                        <div style="background:#fefce8; padding:12px; border-radius:8px; border:1px solid #fef08a;">
                            <b style="color:#b45309;">📔 공유 기록 및 문서 첨부:</b> '오늘 기록' 또는 상단 '메모' 탭에서 구글 드라이브(📎)를 통해 회의록이나 학습지 파일을 첨부해 공유할 수 있습니다. 공유 메모 및 기록은 <b>작성자 본인만 수정·삭제가 가능</b>하여 데이터 훼손을 방지합니다.
                        </div>
                    </div>
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
        localStorage.setItem('workCalendar_hideHelp_v6', isChecked ? 'true' : 'false');
        document.getElementById('help-modal').remove();
    };
};

// ==========================================================================
// 🌉 과도기 호환성 레이어 
// ==========================================================================
window.openHelpModal = openHelpModal;
