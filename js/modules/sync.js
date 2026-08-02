// js/modules/sync.js

window.openGoogleSyncModal = function() {
    const token = sessionStorage.getItem('google_api_token');
    if (!token) {
        if (confirm("구글 캘린더/Tasks 동기화를 위한 권한(토큰)이 없습니다.\n안전한 데이터 전송을 위해 확인을 눌러 다시 한 번 로그인해 주세요.\n(로그인 창에서 '캘린더' 및 'Tasks' 권한 체크박스를 반드시 선택해주세요.)")) {
            window.signInWithGoogle();
        }
        return;
    }

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
                    - 각 수업과 일정이 <b>개별 블록</b>으로 분리되어 깔끔하게 쌓입니다.
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
        // [1] 구글 Tasks (메모) 동기화
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
        setTimeout(() => {
            const modal = document.getElementById('google-sync-modal');
            if (modal) modal.remove();
        }, 2500);

    } catch (error) {
        console.error("동기화 에러:", error);
        statusText.innerText = "❌ 오류 발생: " + error.message;
        statusText.style.color = "#ef4444";
        document.getElementById('btn-run-sync').disabled = false;
        
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

    const createUrl = "https://www.googleapis.com/calendar/v3/calendars";
    const newCal = await googleFetch(createUrl, 'POST', token, {
        summary: 'School Planner V3',
        description: '업무 및 수업 계획표(웹)에서 동기화된 전용 캘린더입니다.',
        timeZone: 'Asia/Seoul'
    });
    return newCal.id;
}

// 🌟 [핵심 변경] 각 수업과 일정을 독립된 블록으로 생성합니다.
async function syncSingleDateToCalendar(token, calId, dateStr, incEvent, incClass, incJournal) {
    let payloadsToCreate = [];
    
    // 종료일은 다음날짜 (종일 일정 구글 캘린더 기준)
    let d = new Date(dateStr);
    d.setDate(d.getDate() + 1);
    const endStr = window.formatDate(d);

    // 1. 일정 데이터 
    if (incEvent) {
        const eDoc = await window.getUserCol('events').doc(dateStr).get();
        if (eDoc.exists && eDoc.data().eventList) {
            const list = eDoc.data().eventList.filter(e => e.content && e.content.trim() !== '');
            list.forEach(e => {
                let labelStr = (e.labels && e.labels.length > 0) ? e.labels[0] : (e.label || '일정');
                payloadsToCreate.push({
                    summary: `[${labelStr}] ${e.content}`,
                    description: `📌 (웹사이트에서 동기화된 일정/행사입니다)`,
                    start: { date: dateStr },
                    end: { date: endStr },
                    extendedProperties: { private: { app: 'SchoolPlannerV3', dateStr: dateStr } }
                });
            });
        }
    }

    // 2. 시간표 & 수업 메모 (독립 블록화)
    if (incClass) {
        const sDoc = await window.getUserCol('schedules').doc(dateStr).get();
        if (sDoc.exists && sDoc.data().periods) {
            const periods = sDoc.data().periods;
            for (let i = 1; i <= 6; i++) {
                let p = periods[i];
                if (p && p.subject && p.subject.trim() !== '' && p.subject.toUpperCase() !== 'X') {
                    let desc = `🎒 [수업 정보]\n`;
                    if (p.memo) desc += `- 메모: ${p.memo}\n`;
                    if (p.supplies) desc += `- 준비물: ${p.supplies}\n`;
                    if (!p.memo && !p.supplies) desc += `- 등록된 내용이 없습니다.\n`;

                    payloadsToCreate.push({
                        summary: `[${i}교시] ${p.subject}`,
                        description: desc.trim(),
                        start: { date: dateStr },
                        end: { date: endStr },
                        extendedProperties: { private: { app: 'SchoolPlannerV3', dateStr: dateStr } }
                    });
                }
            }
        }
    }

    // 3. 기록(일지) 데이터
    if (incJournal) {
        const jDoc = await window.getUserCol('journals').doc(dateStr).get();
        if (jDoc.exists && jDoc.data().entries) {
            const journals = jDoc.data().entries.filter(j => j.content && j.content.trim() !== '');
            journals.forEach(j => {
                let labelStr = (j.labels && j.labels.length > 0) ? j.labels[0] : (j.label || '기록');
                payloadsToCreate.push({
                    summary: `[${labelStr}] ${j.content.substring(0, 15)}...`,
                    description: `📝 [전체 기록 내용]\n${j.content}`,
                    start: { date: dateStr },
                    end: { date: endStr },
                    extendedProperties: { private: { app: 'SchoolPlannerV3', dateStr: dateStr } }
                });
            });
        }
    }

    // 4. 기존 동기화된 이벤트(태그 기반) 먼저 모두 일괄 삭제
    const searchUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events?privateExtendedProperty=app%3DSchoolPlannerV3&privateExtendedProperty=dateStr%3D${dateStr}`;
    const searchResult = await googleFetch(searchUrl, 'GET', token);
    const existingEvents = searchResult.items || [];

    for (const ev of existingEvents) {
        await googleFetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events/${ev.id}`, 'DELETE', token);
    }

    // 5. 새롭게 분리된 개별 블록들을 하나씩 캘린더에 추가 (과부하 방지를 위해 30ms 대기)
    for (const payload of payloadsToCreate) {
        await googleFetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events`, 'POST', token, payload);
        await new Promise(res => setTimeout(res, 30)); 
    }
}


// --------------------------------------------------------------------------
// 🛠️ 구글 Tasks 처리 함수
// --------------------------------------------------------------------------
async function syncMemosToGoogleTasks(token) {
    const listUrl = "https://tasks.googleapis.com/tasks/v1/users/@me/lists";
    const data = await googleFetch(listUrl, 'GET', token);
    
    let targetList = (data.items || []).find(list => list.title === 'School Planner 메모');
    let taskListId;
    
    if (targetList) {
        taskListId = targetList.id;
        // 단방향 덮어쓰기를 위해 기존 Tasks 모두 비우기
        let pageToken = '';
        do {
            const tasksData = await googleFetch(`https://tasks.googleapis.com/tasks/v1/lists/${taskListId}/tasks${pageToken ? '?pageToken='+pageToken : ''}`, 'GET', token);
            const existingTasks = tasksData.items || [];
            for (const task of existingTasks) {
                if (task.id) await googleFetch(`https://tasks.googleapis.com/tasks/v1/lists/${taskListId}/tasks/${task.id}`, 'DELETE', token);
            }
            pageToken = tasksData.nextPageToken;
        } while(pageToken);
    } else {
        const newList = await googleFetch(listUrl, 'POST', token, { title: 'School Planner 메모' });
        taskListId = newList.id;
    }

    const webMemos = await window.dbAPI.loadMemos();
    for (const memo of webMemos) {
        // 🌟 [버그 수정] memo.content가 아닌 memo.text를 사용해야 정상적으로 텍스트를 불러옵니다.
        const contentStr = memo.text || ""; 
        const titleSnippet = contentStr ? contentStr.split('\n')[0].substring(0, 30) : "내용 없음";
        
        let labelStr = '일반';
        if (Array.isArray(memo.labels) && memo.labels.length > 0) {
            labelStr = memo.labels.join(', ');
        } else if (memo.label) {
            labelStr = memo.label;
        }

        let finalNotes = contentStr;
        // 사진이 첨부된 경우 링크도 설명란에 포함
        if (memo.imageUrl) {
            finalNotes += `\n\n🖼️ [첨부 이미지 다운로드/보기]\n${memo.imageUrl}`;
        }

        const payload = {
            title: `[${labelStr}] ${titleSnippet}`, 
            notes: finalNotes, 
            status: memo.completed ? 'completed' : 'needsAction'
        };
        await googleFetch(`https://tasks.googleapis.com/tasks/v1/lists/${taskListId}/tasks`, 'POST', token, payload);
        await new Promise(res => setTimeout(res, 30));
    }
}
