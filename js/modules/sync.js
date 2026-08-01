// js/modules/sync.js

// ==========================================================================
// 🔄 구글 캘린더 & Tasks 단방향 동기화 모듈 (Web -> Google)
// ==========================================================================

window.openGoogleSyncModal = function() {
    // 1. 구글 API 토큰 유무 확인 (보안)
    const token = sessionStorage.getItem('google_api_token');
    if (!token) {
        if (confirm("구글 캘린더/Tasks 동기화를 위한 권한(토큰)이 없습니다.\n안전한 데이터 전송을 위해 확인을 눌러 다시 한 번 로그인해 주세요.\n(로그인 창에서 '캘린더' 및 'Tasks' 권한 체크박스를 반드시 선택해주세요.)")) {
            window.signInWithGoogle();
        }
        return;
    }

    // 2. 모달창 UI 생성
    let existingModal = document.getElementById('google-sync-modal');
    if (existingModal) existingModal.remove();

    const todayStr = window.formatDate(window.currentDate);
    const modalHtml = `
    <div id="google-sync-modal" class="modal-overlay">
        <div class="modal-content" style="max-width: 500px;">
            <div class="modal-header">
                <h2>📅 구글 서비스 동기화 (단방향)</h2>
                <button class="btn-close-modal" onclick="document.getElementById('google-sync-modal').remove()">×</button>
            </div>
            <div class="modal-body">
                <div class="modal-info-box" style="margin-bottom: 20px;">
                    웹사이트의 데이터를 선생님의 <b>개인 구글 계정</b>으로 동기화합니다.<br>
                    - 일정/수업/일지 ➔ <b>[School Planner V3] 전용 캘린더</b><br>
                    - 메모 ➔ <b>[School Planner 메모] 구글 Tasks</b>
                </div>
                
                <h3 class="modal-item-text" style="margin-bottom: 10px;">1. 동기화 기간 선택 (캘린더용)</h3>
                <div style="display:flex; gap:10px; margin-bottom:20px;">
                    <input type="date" id="sync-start-date" class="modal-input-text" value="${todayStr}">
                    <span style="align-self:center;">~</span>
                    <input type="date" id="sync-end-date" class="modal-input-text" value="${todayStr}">
                </div>

                <h3 class="modal-item-text" style="margin-bottom: 10px;">2. 동기화 항목 선택</h3>
                <div style="display:flex; flex-direction:column; gap:10px; background:#f8fafc; padding:15px; border-radius:8px; border:1px solid #e2e8f0;">
                    <label class="modal-checkbox-label" style="font-size:1rem; color:#1e293b;">
                        <input type="checkbox" id="sync-chk-event" class="modal-checkbox" checked style="width:18px; height:18px;">
                        [캘린더] 일정 & 행사 기록
                    </label>
                    <label class="modal-checkbox-label" style="font-size:1rem; color:#1e293b;">
                        <input type="checkbox" id="sync-chk-class" class="modal-checkbox" checked style="width:18px; height:18px;">
                        [캘린더] 시간표 및 수업 메모/준비물
                    </label>
                    <label class="modal-checkbox-label" style="font-size:1rem; color:#1e293b;">
                        <input type="checkbox" id="sync-chk-journal" class="modal-checkbox" checked style="width:18px; height:18px;">
                        [캘린더] 업무 일지 및 기록
                    </label>
                    <hr style="border:0; border-top:1px dashed #cbd5e1; margin:5px 0;">
                    <label class="modal-checkbox-label" style="font-size:1rem; color:#0f766e;">
                        <input type="checkbox" id="sync-chk-tasks" class="modal-checkbox" checked style="width:18px; height:18px;">
                        [Tasks] 웹 메모 데이터를 구글 할 일(Tasks)로 덮어쓰기
                    </label>
                </div>

                <div id="sync-progress-area" class="hidden" style="margin-top: 20px; text-align:center;">
                    <div style="color:#2563eb; font-weight:bold; margin-bottom:8px;" id="sync-status-text">동기화 준비 중...</div>
                    <div style="width:100%; background:#e2e8f0; height:10px; border-radius:5px; overflow:hidden;">
                        <div id="sync-progress-bar" style="width:0%; height:100%; background:#2563eb; transition:0.3s;"></div>
                    </div>
                </div>

                <div class="modal-footer-actions">
                    <button id="btn-run-sync" class="modal-btn-primary" onclick="window.executeGoogleSync()">🚀 동기화 시작</button>
                </div>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
};

// --------------------------------------------------------------------------
// 🛠️ 실제 API 통신 및 동기화 로직
// --------------------------------------------------------------------------
window.executeGoogleSync = async function() {
    const token = sessionStorage.getItem('google_api_token');
    if (!token) { alert("토큰이 만료되었습니다. 다시 로그인해주세요."); return; }

    const startStr = document.getElementById('sync-start-date').value;
    const endStr = document.getElementById('sync-end-date').value;
    
    const syncEvent = document.getElementById('sync-chk-event').checked;
    const syncClass = document.getElementById('sync-chk-class').checked;
    const syncJournal = document.getElementById('sync-chk-journal').checked;
    const syncTasks = document.getElementById('sync-chk-tasks').checked;

    if (!syncEvent && !syncClass && !syncJournal && !syncTasks) { alert("동기화할 항목을 1개 이상 선택해 주세요."); return; }
    
    let startD = new Date(startStr); let endD = new Date(endStr);
    if (startD > endD) { alert("시작일이 종료일보다 늦을 수 없습니다."); return; }

    document.getElementById('btn-run-sync').disabled = true;
    document.getElementById('sync-progress-area').classList.remove('hidden');
    const statusText = document.getElementById('sync-status-text');
    const progressBar = document.getElementById('sync-progress-bar');

    try {
        // [1] 구글 Tasks 메모 동기화
        if (syncTasks) {
            statusText.innerText = "📝 구글 Tasks 목록 확인 및 동기화 중...";
            progressBar.style.width = "10%";
            await syncMemosToGoogleTasks(token);
        }

        // [2] 구글 캘린더 동기화
        if (syncEvent || syncClass || syncJournal) {
            statusText.innerText = "📅 전용 캘린더(School Planner V3) 확인 중...";
            progressBar.style.width = "20%";
            const calId = await getOrCreateDedicatedCalendar(token);
            
            // 처리할 날짜 배열 생성
            let datesToSync = [];
            let curD = new Date(startD);
            while (curD <= endD) {
                datesToSync.push(window.formatDate(curD));
                curD.setDate(curD.getDate() + 1);
            }

            const total = datesToSync.length;
            for (let i = 0; i < total; i++) {
                const dateStr = datesToSync[i];
                statusText.innerText = `📅 캘린더 동기화 중... (${dateStr}) [${i+1}/${total}]`;
                progressBar.style.width = `${20 + (80 * ((i+1)/total))}%`;
                
                await syncSingleDateToCalendar(token, calId, dateStr, syncEvent, syncClass, syncJournal);
            }
        }

        statusText.innerText = "🎉 동기화가 성공적으로 완료되었습니다!";
        statusText.style.color = "#059669";
        progressBar.style.background = "#059669";
        progressBar.style.width = "100%";
        setTimeout(() => document.getElementById('google-sync-modal').remove(), 2500);

    } catch (error) {
        console.error("동기화 에러:", error);
        statusText.innerText = "❌ 오류 발생: " + error.message;
        statusText.style.color = "#ef4444";
        document.getElementById('btn-run-sync').disabled = false;
        
        // 401, 403 에러 처리 (권한 부족)
        if(error.message.includes('401') || error.message.includes('403')) {
            alert("구글 API 권한이 거부되었습니다.\n\n[해결 방법]\n1. 창을 닫고 로그아웃합니다.\n2. 다시 로그인할 때 뜨는 구글 팝업창에서 'Google Calendar' 및 'Google Tasks' 접근 권한 체크박스를 반드시 체크해주세요!");
        }
    }
};

// --------------------------------------------------------------------------
// 🛠️ 구글 API 요청 헬퍼 함수
// --------------------------------------------------------------------------
async function googleFetch(url, method, token, body = null) {
    const options = {
        method: method,
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
    };
    if (body) options.body = JSON.stringify(body);
    
    const response = await fetch(url, options);
    if (!response.ok) {
        const errData = await response.json();
        throw new Error(`API 에러 (${response.status}): ${errData.error?.message || '알 수 없는 오류'}`);
    }
    // 204 No Content 처리
    if (response.status === 204) return null;
    return await response.json();
}

// --------------------------------------------------------------------------
// 🛠️ 구글 캘린더 처리 함수
// --------------------------------------------------------------------------
async function getOrCreateDedicatedCalendar(token) {
    const listUrl = "https://www.googleapis.com/calendar/v3/users/me/calendarList";
    const data = await googleFetch(listUrl, 'GET', token);
    
    let targetCal = data.items.find(cal => cal.summary === 'School Planner V3');
    if (targetCal) return targetCal.id;

    // 없으면 전용 캘린더 생성
    const createUrl = "https://www.googleapis.com/calendar/v3/calendars";
    const newCal = await googleFetch(createUrl, 'POST', token, {
        summary: 'School Planner V3',
        description: '업무 및 수업 계획표(웹)에서 동기화된 전용 캘린더입니다.',
        timeZone: 'Asia/Seoul'
    });
    return newCal.id;
}

async function syncSingleDateToCalendar(token, calId, dateStr, incEvent, incClass, incJournal) {
    let titleParts = [];
    let descParts = [];
    let hasValidData = false;

    // 1. 일정 데이터 추출
    if (incEvent) {
        const eDoc = await window.getUserCol('events').doc(dateStr).get();
        if (eDoc.exists && eDoc.data().eventList) {
            const list = eDoc.data().eventList.filter(e => e.content.trim() !== '');
            if (list.length > 0) {
                hasValidData = true;
                titleParts.push(`[${list[0].content}]`); // 첫 일정으로 캘린더 제목 시작
                descParts.push(`📝 [비고 및 일정]\n` + list.map(e => `- [${e.label}] ${e.content}`).join('\n'));
            }
        }
    }

    // 2. 시간표 & 메모 데이터 추출 (1줄 1항목 서식 적용)
    if (incClass) {
        const sDoc = await window.getUserCol('schedules').doc(dateStr).get();
        if (sDoc.exists && sDoc.data().periods) {
            const periods = sDoc.data().periods;
            let classStr = []; let memoStr = [];
            for (let i = 1; i <= 6; i++) {
                let p = periods[i];
                if (p && p.subject) {
                    hasValidData = true;
                    classStr.push(`[${i}교시] ${p.subject}`);
                    
                    if (p.memo || p.supplies) {
                        let line = `- ${i}교시: `;
                        if(p.memo) line += `${p.memo} `;
                        if(p.supplies) line += `(준비물: ${p.supplies})`;
                        memoStr.push(line);
                    }
                }
            }
            if (classStr.length > 0) titleParts.push(classStr.join('\n')); // 줄바꿈 적용
            if (memoStr.length > 0) descParts.push(`🎒 [수업 메모 & 준비물]\n` + memoStr.join('\n'));
        }
    }

    // 3. 업무 일지 데이터 추출
    if (incJournal) {
        const jDoc = await window.getUserCol('journals').doc(dateStr).get();
        if (jDoc.exists && jDoc.data().entries) {
            const journals = jDoc.data().entries.filter(j => j.content.trim() !== '');
            if (journals.length > 0) {
                hasValidData = true;
                descParts.push(`📌 [기록 / 일지]\n` + journals.map(j => `- [${j.label}] ${j.content}`).join('\n'));
            }
        }
    }

    const finalTitle = titleParts.length > 0 ? titleParts.join('\n') : `[일정 없음]`;
    const finalDesc = descParts.join('\n\n');

    // 구글 캘린더 API는 종료일을 Exclusive(미포함)로 취급하므로 하루 더함
    let d = new Date(dateStr);
    d.setDate(d.getDate() + 1);
    const endStr = window.formatDate(d);

    // 기존 동기화된 이벤트가 있는지 검색 (태그 기반)
    const searchUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events?privateExtendedProperty=app%3DSchoolPlannerV3&privateExtendedProperty=dateStr%3D${dateStr}`;
    const searchResult = await googleFetch(searchUrl, 'GET', token);
    const existingEvents = searchResult.items || [];

    if (!hasValidData) {
        // 웹사이트 데이터가 비어있으면 캘린더 일정 삭제
        for (const ev of existingEvents) {
            await googleFetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events/${ev.id}`, 'DELETE', token);
        }
    } else {
        const payload = {
            summary: finalTitle,
            description: finalDesc,
            start: { date: dateStr },
            end: { date: endStr }, // 종일 일정 처리
            extendedProperties: {
                private: { app: 'SchoolPlannerV3', dateStr: dateStr }
            }
        };

        if (existingEvents.length > 0) {
            // 기존 이벤트 덮어쓰기 (업데이트)
            await googleFetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events/${existingEvents[0].id}`, 'PUT', token, payload);
            // 만약 중복 생성된 찌꺼기가 있다면 나머지 삭제
            for(let i=1; i<existingEvents.length; i++) {
                await googleFetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events/${existingEvents[i].id}`, 'DELETE', token);
            }
        } else {
            // 신규 이벤트 생성
            await googleFetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events`, 'POST', token, payload);
        }
    }
}

// --------------------------------------------------------------------------
// 🛠️ 구글 Tasks 처리 함수
// --------------------------------------------------------------------------
async function syncMemosToGoogleTasks(token) {
    // 1. [School Planner 메모] 할 일 목록 가져오기 또는 생성
    const listUrl = "https://tasks.googleapis.com/tasks/v1/users/@me/lists";
    const data = await googleFetch(listUrl, 'GET', token);
    
    let targetList = (data.items || []).find(list => list.title === 'School Planner 메모');
    let taskListId;
    
    if (targetList) {
        taskListId = targetList.id;
        // 단방향 덮어쓰기를 위해 기존 Tasks 모두 비우기
        const tasksData = await googleFetch(`https://tasks.googleapis.com/tasks/v1/lists/${taskListId}/tasks`, 'GET', token);
        const existingTasks = tasksData.items || [];
        for (const task of existingTasks) {
            await googleFetch(`https://tasks.googleapis.com/tasks/v1/lists/${taskListId}/tasks/${task.id}`, 'DELETE', token);
        }
    } else {
        // 새 리스트 생성
        const newList = await googleFetch(listUrl, 'POST', token, { title: 'School Planner 메모' });
        taskListId = newList.id;
    }

    // 2. DB에서 모든 메모 로드 후 Tasks로 일괄 전송
    const webMemos = await window.dbAPI.loadMemos();
    for (const memo of webMemos) {
        // 💡 [에러 방지] 내용이 비어있거나 없는(undefined) 메모에 대한 안전 장치 추가
        const contentStr = memo.content || ""; 
        const titleSnippet = contentStr ? contentStr.split('\n')[0].substring(0, 30) + "..." : "내용 없음";

        const payload = {
            title: `[${memo.label || '일반'}] ${titleSnippet}`, 
            notes: contentStr, 
            status: memo.completed ? 'completed' : 'needsAction'
        };
        await googleFetch(`https://tasks.googleapis.com/tasks/v1/lists/${taskListId}/tasks`, 'POST', token, payload);
    }
}
