// js/modules/help.js

export const openHelpModal = function() {
    let existingModal = document.getElementById('help-modal');
    if (existingModal) {
        existingModal.remove();
        if (window.decreaseModalCount) window.decreaseModalCount();
    }

    const hideHelp = localStorage.getItem('workCalendar_hideHelp_v7') === 'true';

    // 💡 [핵심 수정] Header와 Footer에 flex-shrink: 0 을 주어 크기를 고정하고, 중간 내용물(flex:1)만 스크롤되도록 적용했습니다.
    const modalHtml = `
    <div id="help-modal" style="position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.5); z-index:10005; display:flex; justify-content:center; align-items:center; padding:15px; box-sizing:border-box;">
        <div style="background:#fff; padding:0; border-radius:12px; width:100%; max-width:850px; max-height:88vh; display:flex; flex-direction:column; box-shadow:0 10px 25px rgba(0,0,0,0.2); overflow:hidden;">
            
            <div style="flex-shrink:0; background:#f8fafc; padding:20px; border-bottom:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <h2 style="margin:0 0 4px 0; color:#1e40af; font-size:1.35rem;">📖 School Planner V3.7 (SP3.7) 사용 설명서</h2>
                    <p style="margin:0; color:#64748b; font-size:0.9rem;">바쁜 학급 운영과 행정 업무를 스마트하고 안전하게 관리하는 핵심 가이드입니다.</p>
                </div>
                <button id="btn-help-x" style="background:none; border:none; font-size:1.5rem; cursor:pointer; color:#64748b;" title="닫기">✖</button>
            </div>

            <div style="flex:1; min-height:0; padding:25px; overflow-y:auto; line-height:1.6; color:#334155; font-size:0.95rem;">
                
                <div style="margin-bottom:25px;">
                    <h3 style="color:#2563eb; border-bottom:2px solid #bfdbfe; padding-bottom:5px; margin-top:0;">1. 상단 기본 메뉴 및 설정</h3>
                    <p style="margin:5px 0 8px 0; color:#64748b; font-size:0.9rem;">화면 맨 위쪽에 항상 떠 있는 컨트롤 패널로, 전반적인 앱 상태를 관리합니다.</p>
                    <ul style="padding-left:20px; margin:5px 0;">
                        <li style="margin-bottom:6px;"><b>네트워크 상태 (🌐/✈️):</b> 현재 온라인인지 오프라인인지 표시합니다. 클릭하여 모드를 전환할 수 있으며, 오프라인 모드일 때는 수동 동기화(🔄) 버튼이 나타나 원할 때만 클라우드와 데이터를 맞출 수 있습니다.</li>
                        <li style="margin-bottom:6px;"><b>D-Day 설정:</b> 학사 일정이나 중요 행사의 디데이를 설정하고 표시합니다.</li>
                        <li style="margin-bottom:6px;"><b>빠른 동기화 (📅):</b> 현재 화면에 작성된 일정을 구글 캘린더와 즉시 연동합니다.</li>
                        <li style="margin-bottom:6px;"><b>검색 (🔍):</b> 과거의 메모나 일정을 빠르게 찾아볼 수 있습니다.</li>
                        <li style="margin-bottom:6px;"><b>보기 단위 전환:</b> 하루 / 주간 / 월간 / 년간 / 메모 버튼을 눌러 원하는 기간 단위로 화면을 이동합니다.</li>
                    </ul>
                </div>

                <div style="margin-bottom:25px;">
                    <h3 style="color:#2563eb; border-bottom:2px solid #bfdbfe; padding-bottom:5px; margin-top:0;">2. 뷰어(보기)와 에디터(작성) 모드</h3>
                    <p style="margin:5px 0 8px 0; color:#64748b; font-size:0.9rem;">SP3.7은 실수로 내용이 지워지는 것을 방지하기 위해 두 가지 모드를 분리하여 운영합니다.</p>
                    <ul style="padding-left:20px; margin:5px 0;">
                        <li style="margin-bottom:6px;"><b>👁️ 보기 모드:</b> 화면을 깔끔하게 조회하는 읽기 전용 상태입니다.</li>
                        <li style="margin-bottom:6px;"><b>✏️ 작성 모드:</b> 일지, 시간표, 메모 등을 수정할 수 있는 상태입니다. 작성을 마치고 다른 탭으로 이동하면 자동으로 저장됩니다. (수동으로 '저장' 버튼을 누르셔도 됩니다.)</li>
                        <li style="margin-bottom:6px;"><b>보기 옵션 토글:</b>
                            <ul style="margin-top:4px; padding-left:15px;">
                                <li><b>주말 숨기기/보이기:</b> 주말 일정을 화면에서 켜거나 끕니다.</li>
                                <li><b>수업 숨기기/보이기:</b> 캘린더 뷰에서 수업(시간표) 영역만 접어둘 수 있습니다.</li>
                            </ul>
                        </li>
                    </ul>
                </div>

                <div style="margin-bottom:25px;">
                    <h3 style="color:#059669; border-bottom:2px solid #a7f3d0; padding-bottom:5px;">3. 핵심 기능 관리 (⋮ 더보기 메뉴 상세 가이드)</h3>
                    <p style="margin:5px 0 12px 0; color:#64748b; font-size:0.9rem;">우측 상단의 더보기(⋮) 아이콘을 누르면 학교 업무와 학급 운영에 특화된 고급 관리 기능들을 사용할 수 있습니다.</p>
                    
                    <div style="display:flex; flex-direction:column; gap:12px;">
                        <div style="background:#f8fafc; padding:12px; border-radius:8px; border:1px solid #e2e8f0;">
                            <b style="color:#047857;">🏷️ 3-1. 통합 라벨 관리</b>
                            <p style="margin:4px 0 6px 0; font-size:0.9rem; color:#475569;">일정, 기록, 메모에 사용할 라벨의 색상과 특수한 속성을 설정하는 공간입니다. 단순한 분류를 넘어 일정의 작동 방식을 결정합니다.</p>
                            <ul style="margin:0 0 0 20px; padding:0; font-size:0.9rem; color:#334155;">
                                <li><b>수업삭제 (🚫):</b> 현장체험학습, 개교기념일 등 수업이 없는 날에 이 라벨을 쓰면, 해당 날짜의 시간표(수업) 칸이 자동으로 비워집니다.</li>
                                <li><b>완료 (✅):</b> 체크박스가 생성되는 일정입니다. 그날 끝내지 못하고 미완료 상태로 두면, 다음 날짜로 일정이 자동으로 넘어갑니다 (이월 기능).</li>
                                <li><b>기간 (📅) / 반복 (🔁):</b> 며칠에 걸친 연속된 일정이나, 매주/매월 반복되는 일정을 등록할 때 사용합니다.</li>
                            </ul>
                        </div>

                        <div style="background:#f8fafc; padding:12px; border-radius:8px; border:1px solid #e2e8f0;">
                            <b style="color:#047857;">🧑‍🤝‍🧑 3-2. 학급 정보(명렬표) 관리</b>
                            <p style="margin:4px 0 6px 0; font-size:0.9rem; color:#475569;">학급 아이들의 명렬표를 등록하고 관리합니다. 한 번 등록해 두면 앱 내의 '조사표(체크리스트)' 기능과 연동되어 매우 편리합니다.</p>
                            <ul style="margin:0 0 0 20px; padding:0; font-size:0.9rem; color:#334155;">
                                <li><b>다중 명렬표 지원:</b> 연도별, 혹은 교과 전담인 경우 반별로 여러 개의 명렬표를 등록해 두고 필요할 때 선택해서 쓸 수 있습니다.</li>
                                <li><b>활용:</b> 시간표 영역에서 [+ 조사표] 버튼을 눌러 과제 제출, 준비물 지참 여부, 조별 평가 등을 기록할 때 명렬표가 자동으로 불러와집니다.</li>
                            </ul>
                        </div>

                        <div style="background:#f8fafc; padding:12px; border-radius:8px; border:1px solid #e2e8f0;">
                            <b style="color:#047857;">👥 3-3. 공유 그룹 관리</b>
                            <p style="margin:4px 0 6px 0; font-size:0.9rem; color:#475569;">동학년 선생님, 혹은 업무팀 등 동료들과 일정 및 업무 일지를 공유할 수 있는 협업 공간입니다.</p>
                            <ul style="margin:0 0 0 20px; padding:0; font-size:0.9rem; color:#334155;">
                                <li><b>새 그룹 만들기:</b> 그룹을 생성하면 영문/숫자로 된 6자리 '초대 코드'가 발급됩니다.</li>
                                <li><b>코드로 가입하기:</b> 동료 선생님이 전달해 준 6자리 코드를 입력하면 즉시 그룹에 가입되며, 화면에서 해당 그룹의 일정을 켜고 끌 수 있습니다.</li>
                            </ul>
                        </div>

                        <div style="background:#f8fafc; padding:12px; border-radius:8px; border:1px solid #e2e8f0;">
                            <b style="color:#047857;">🏫 3-4. 시간표 적용</b>
                            <p style="margin:4px 0 6px 0; font-size:0.9rem; color:#475569;">학기 초에 확정된 기본 시간표를 특정 기간 동안 일괄적으로 캘린더에 덮어씌우는 기능입니다.</p>
                            <ul style="margin:0 0 0 20px; padding:0; font-size:0.9rem; color:#334155;">
                                <li>요일별 1~6교시(또는 설정된 교시) 기본 과목을 세팅해 둡니다.</li>
                                <li>적용할 기간(예: 1학기 전체)을 선택하고 적용하면, 하나씩 입력할 필요 없이 캘린더에 기본 과목이 모두 채워집니다.</li>
                            </ul>
                        </div>

                        <div style="background:#f8fafc; padding:12px; border-radius:8px; border:1px solid #e2e8f0;">
                            <b style="color:#047857;">💾 3-5. 내보내기 / 가져오기 (데이터 백업 및 복원)</b>
                            <p style="margin:4px 0 6px 0; font-size:0.9rem; color:#475569;">소중한 기록을 안전하게 백업하고, 다른 기기로 이동하거나 복원할 때 사용하는 핵심 데이터 관리 도구입니다.</p>
                            <ul style="margin:0 0 0 20px; padding:0; font-size:0.9rem; color:#334155;">
                                <li><b>구글 시트 연동 (📗):</b> 클릭 한 번으로 내 구글 드라이브의 스프레드시트에 모든 일지와 명렬표, 조사표 기록이 표 형태로 백업됩니다. 반대로 구글 시트에서 수정하고 가져올 수도 있습니다.</li>
                                <li><b>로컬 CSV (💾):</b> 오프라인 엑셀 파일 형태로 데이터를 다운로드하거나 업로드합니다.</li>
                                <li><b>동기화 방식 선택:</b> 기존 데이터를 유지하며 새로운 내용만 합치는 '병합' 방식과, 모든 데이터를 지우고 새로 덮어쓰는 '완전 교체' 방식을 지원하여 데이터가 꼬이는 것을 방지합니다.</li>
                            </ul>
                        </div>
                    </div>
                </div>

                <div style="margin-bottom:25px;">
                    <h3 style="color:#d97706; border-bottom:2px solid #fde68a; padding-bottom:5px;">4. 👥 그룹 공유 기능 상세 가이드 (일정 / 시간표 / 기록)</h3>
                    <p style="margin:5px 0 10px 0; color:#64748b; font-size:0.9rem;">SP3.7에서는 개인 프라이버시를 보호하면서도 필요한 정보만 동료들과 선택적으로 공유할 수 있는 '독립된 다중 작업공간(Workspace)' 방식을 사용합니다. 화면 곳곳에서 개인 자료는 🔒(파란색), 그룹 자료는 👥(초록색/분홍색) 아이콘으로 명확하게 구분됩니다.</p>

                    <div style="display:flex; flex-direction:column; gap:12px; margin-top:10px;">
                        <div style="background:#fefce8; padding:12px; border-radius:8px; border:1px solid #fef08a;">
                            <b style="color:#b45309;">📅 1. 공유 일정 (동학년/업무팀 행사 관리)</b>
                            <p style="margin:4px 0 4px 0; font-size:0.9rem; color:#475569;">각 날짜의 '📌 오늘 할 일' 영역은 소속된 그룹별로 별도의 박스로 나뉘어 표시됩니다.</p>
                            <ul style="margin:0 0 0 20px; padding:0; font-size:0.9rem; color:#334155;">
                                <li><b>일정 추가 및 구분:</b> [🔒 개인] 영역은 나에게만 보이고, [👥 그룹명] 아래의 [+ 일정 추가]를 눌러 작성하면 그룹원 모두의 캘린더에 실시간으로 나타납니다.</li>
                                <li><b>완료 상태 실시간 공유:</b> 누군가 공유 일정의 체크박스를 완료(✅) 처리하면, 다른 선생님들의 화면에서도 줄이 그어지며 완료 처리됩니다.</li>
                                <li><b>👨‍🏫 활용 예시:</b> 현장체험학습 답사, 학년 협의회, 학부모 총회 등 공통 행사 일정 공유</li>
                            </ul>
                        </div>

                        <div style="background:#fefce8; padding:12px; border-radius:8px; border:1px solid #fef08a;">
                            <b style="color:#b45309;">🏫 2. 공유 시간표 (교과 전담 및 공통 수업 연동)</b>
                            <p style="margin:4px 0 4px 0; font-size:0.9rem; color:#475569;">시간표 영역 역시 개인 시간표와 그룹 시간표의 행(Row)이 위아래로 나란히 배치되어 한눈에 비교할 수 있습니다.</p>
                            <ul style="margin:0 0 0 20px; padding:0; font-size:0.9rem; color:#334155;">
                                <li><b>수업 내용 공유:</b> 그룹 시간표에 과목명, 메모, 준비물을 적으면 그룹원 모두의 시간표에 그대로 반영됩니다.</li>
                                <li><b>조사표(체크리스트) 연동:</b> 공유 시간표 칸에서 [+ 조사표]를 만들어 과제 제출 여부 등을 체크하면 이 데이터도 그룹원들과 공유됩니다.</li>
                                <li><b>👨‍🏫 활용 예시:</b> 동학년 공통 수업 진도/준비물 공유, 담임과 전담 교사 간 수행평가 일정 연동</li>
                            </ul>
                        </div>

                        <div style="background:#fefce8; padding:12px; border-radius:8px; border:1px solid #fef08a;">
                            <b style="color:#b45309;">📔 3. 공유 기록 및 메모 (회의록 및 학생 상담 기록)</b>
                            <p style="margin:4px 0 4px 0; font-size:0.9rem; color:#475569;">'하루 보기'의 [📔 오늘 기록] 영역과 상단의 [메모] 탭에서도 그룹별 공유가 지원됩니다.</p>
                            <ul style="margin:0 0 0 20px; padding:0; font-size:0.9rem; color:#334155;">
                                <li><b>문서 및 파일 첨부 공유 (📎):</b> 구글 드라이브 연동 파일 첨부로 학습지 파일이나 회의록 문서를 동료들이 클릭 한 번으로 열람할 수 있습니다.</li>
                                <li><b>메모 공간 이동:</b> 개인 공간(🔒)에 적어둔 메모를 하단의 [👥 그룹명] 버튼을 눌러 즉시 공유 공간으로 올리거나 내릴 수 있습니다.</li>
                                <li><b>읽기 전용 보호:</b> 그룹 메모라도 '작성자 본인'만 수정·삭제할 수 있어 데이터가 안전하게 보호됩니다.</li>
                            </ul>
                        </div>

                        <div style="background:#f1f5f9; padding:10px 12px; border-radius:6px; font-size:0.9rem; color:#475569;">
                            💡 <b>[Tip] 필터링 기능 (원하는 정보만 골라 보기):</b> 화면 우측 상단의 [필터 아이콘]이나 메모 탭 좌측의 [그룹 필터]를 클릭해 특정 그룹을 끄면 화면에서 즉시 숨겨지며 내 개인 일정에 집중할 수 있습니다.
                        </div>
                    </div>
                </div>

                <div style="margin-bottom:15px;">
                    <h3 style="color:#7e22ce; border-bottom:2px solid #e9d5ff; padding-bottom:5px;">5. 업무 효율을 높여주는 키보드 단축키</h3>
                    <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px; margin-top:10px;">
                        <table style="width:100%; border-collapse:collapse; font-size:0.9rem;">
                            <tr style="border-bottom:1px solid #cbd5e1; background:#f1f5f9;">
                                <th style="padding:6px; text-align:left; color:#1e293b;">기능</th>
                                <th style="padding:6px; text-align:left; color:#1e293b;">단축키</th>
                                <th style="padding:6px; text-align:left; color:#1e293b;">설명</th>
                            </tr>
                            <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:6px;">모드 전환</td><td style="padding:6px; font-weight:bold; color:#2563eb;">Ctrl + ⬆️</td><td style="padding:6px; color:#64748b;">보기 모드로 전환</td></tr>
                            <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:6px;">작성 및 저장</td><td style="padding:6px; font-weight:bold; color:#2563eb;">Ctrl + ⬇️</td><td style="padding:6px; color:#64748b;">작성 모드 전환 (또는 수정 내용 저장)</td></tr>
                            <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:6px;">항목 추가/저장</td><td style="padding:6px; font-weight:bold; color:#2563eb;">Ctrl + Enter</td><td style="padding:6px; color:#64748b;">저장 완료 (메모 페이지에서는 새 메모 추가)</td></tr>
                            <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:6px;">오늘로 이동</td><td style="padding:6px; font-weight:bold; color:#2563eb;">Ctrl + Space</td><td style="padding:6px; color:#64748b;">오늘 날짜의 화면으로 즉시 복귀</td></tr>
                            <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:6px;">날짜 이동</td><td style="padding:6px; font-weight:bold; color:#2563eb;">Ctrl + ⬅️ / ➡️</td><td style="padding:6px; color:#64748b;">이전 날짜(기간) / 다음 날짜(기간)로 이동</td></tr>
                            <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:6px;">화면(탭) 이동</td><td style="padding:6px; font-weight:bold; color:#2563eb;">Shift + 1 ~ 5</td><td style="padding:6px; color:#64748b;">하루(1), 주간(2), 월간(3), 년간(4), 메모(5)로 화면 이동</td></tr>
                            <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:6px;">검색창 열기</td><td style="padding:6px; font-weight:bold; color:#2563eb;">Shift + &#96;</td><td style="padding:6px; color:#64748b;">검색창 활성화</td></tr>
                            <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:6px;">주말 표시 토글</td><td style="padding:6px; font-weight:bold; color:#2563eb;">Shift + ⬆️ / ⬇️</td><td style="padding:6px; color:#64748b;">주말 숨기기 / 보이기</td></tr>
                            <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:6px;">수업 표시 토글</td><td style="padding:6px; font-weight:bold; color:#2563eb;">Alt + ⬆️ / ⬇️</td><td style="padding:6px; color:#64748b;">수업 숨기기 / 보이기</td></tr>
                            <tr><td style="padding:6px;">빠른 동기화</td><td style="padding:6px; font-weight:bold; color:#2563eb;">Ctrl + Shift + Enter</td><td style="padding:6px; color:#64748b;">구글 캘린더 즉시 연동</td></tr>
                        </table>
                    </div>
                </div>

            </div>

            <div style="flex-shrink:0; background:#f8fafc; padding:15px 20px; border-top:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center;">
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
    if (window.increaseModalCount) window.increaseModalCount(); 

    const closeModal = () => {
        const modal = document.getElementById('help-modal');
        if (modal) {
            const isChecked = document.getElementById('chk-hide-help').checked;
            localStorage.setItem('workCalendar_hideHelp_v7', isChecked ? 'true' : 'false');
            modal.remove();
            if (window.decreaseModalCount) window.decreaseModalCount(); 
            document.removeEventListener('keydown', handleEsc); 
        }
    };

    const handleEsc = (e) => {
        if (e.key === 'Escape') closeModal();
    };
    document.addEventListener('keydown', handleEsc);

    document.getElementById('help-modal').addEventListener('click', (e) => {
        if (e.target.id === 'help-modal') closeModal();
    });

    document.getElementById('btn-close-help').onclick = closeModal;
    document.getElementById('btn-help-x').onclick = closeModal;
};

window.openHelpModal = openHelpModal;
