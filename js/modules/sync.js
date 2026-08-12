// js/modules/sync.js

window.openGoogleSyncModal = async function() {
    const token = await window.getValidGoogleToken();
    if (!token) return;

    let existingModal = document.getElementById('google-sync-modal');
    if (existingModal) existingModal.remove();

    const defaultApiKey = '61eKHEN9Q5rvaYiHWrtSUco3vwTEhoCiF0d8L2Zdu990gANAp3Cnc0yKKgWqOm3s%2F4Mmqa9STa6WvNHboA1RsQ%3D%3D';
    const savedGovApiKey = localStorage.getItem('gov_holiday_api_key') || defaultApiKey;

    const modalHtml = `
    <div id="google-sync-modal" class="modal-overlay">
        <div class="modal-content" style="max-width: 550px;">
            <div class="modal-header">
                <h2>☁️ 구글 서비스 양방향 동기화</h2>
                <button class="btn-close-modal" onclick="document.getElementById('google-sync-modal').remove()">×</button>
            </div>
            <div class="modal-body" style="max-height: 70vh; overflow-y: auto;">
                
                <h3 class="modal-item-text" style="margin-bottom: 10px;">1. 동기화 기간 선택</h3>
                <div style="display:flex; flex-direction:column; gap:10px; margin-bottom:20px; background:#f8fafc; padding:15px; border-radius:8px; border:1px solid #e2e8f0;">
                    <select id="sync-period-select" class="modal-input-text" style="width:100%; cursor:pointer; font-weight:bold; font-size:1.05rem;" onchange="window.handleSyncPeriodChange()">
                        <option value="sem1">1학기 전체</option>
                        <option value="sem2">2학기 전체</option>
                        <option value="year">해당 학년도 전체</option>
                        <option value="custom">기간 직접 설정</option>
                    </select>
                    <div style="display:flex; gap:10px; align-items:center; justify-content:center; margin-top:5px;">
                        <input type="date" id="sync-start-date" class="modal-input-text">
                        <span style="font-weight:bold; color:#64748b;">~</span>
                        <input type="date" id="sync-end-date" class="modal-input-text">
                    </div>
                </div>

                <div style="border: 2px solid #bfdbfe; border-radius: 8px; padding: 15px; margin-bottom: 20px; background: #eff6ff;">
                    <h3 style="margin-top:0; color:#1e40af; display:flex; align-items:center; justify-content:space-between;">
                        <span>[내보내기] SP3 ➔ 구글 캘린더</span>
                    </h3>
                    <div style="display:flex; flex-direction:column; gap:8px; margin-bottom:15px;">
                        <label class="modal-checkbox-label" style="font-size:0.95rem; color:#1e293b;">
                            <input type="checkbox" id="sync-chk-event" class="modal-checkbox" checked> [캘린더] 일정 & 행사 기록
                        </label>
                        <label class="modal-checkbox-label" style="font-size:0.95rem; color:#1e293b;">
                            <input type="checkbox" id="sync-chk-class" class="modal-checkbox" checked> [캘린더] 시간표 및 수업 메모
                        </label>
                        <label class="modal-checkbox-label" style="font-size:0.95rem; color:#1e293b;">
                            <input type="checkbox" id="sync-chk-journal" class="modal-checkbox" checked> [캘린더] 업무 일지 및 교단 기록
                        </label>
                        <label class="modal-checkbox-label" style="font-size:0.95rem; color:#0f766e;">
                            <input type="checkbox" id="sync-chk-tasks" class="modal-checkbox" checked> [Tasks] 웹 메모 ➔ 구글 할 일
                        </label>
                    </div>
                    <button class="modal-btn-primary" style="width:100%; background:#2563eb;" onclick="window.executeGoogleExport()">🚀 구글로 내보내기</button>
                </div>

                <div style="border: 2px solid #bbf7d0; border-radius: 8px; padding: 15px; background: #f0fdf4;">
                    <h3 style="margin-top:0; color:#166534; display:flex; align-items:center; justify-content:space-between;">
                        <span>[가져오기] 외부 데이터 ➔ SP3</span>
                    </h3>
                    <div style="display:flex; flex-direction:column; gap:8px; margin-bottom:15px;">
                        <label class="modal-checkbox-label" style="font-size:0.95rem; color:#1e293b; font-weight:bold;">
                            <input type="checkbox" id="import-chk-primary" class="modal-checkbox" checked> 내 기본 캘린더(구글) 일정 가져오기
                        </label>
                        <label class="modal-checkbox-label" style="font-size:0.95rem; color:#ef4444; font-weight:bold;">
                            <input type="checkbox" id="import-chk-holiday" class="modal-checkbox" checked onchange="document.getElementById('holiday-source-box').style.display = this.checked ? 'block' : 'none'"> 🇰🇷 대한민국 공휴일/기념일 가져오기
                        </label>
                        
                        <div id="holiday-source-box" style="margin-left: 24px; padding: 10px 12px; background: #fff; border: 1px solid #fca5a5; border-radius: 6px; margin-top:2px;">
                            <div style="font-size:0.85rem; font-weight:bold; color:#991b1b; margin-bottom:6px;">공휴일 데이터 출처 선택:</div>
                            
                            <label style="display:block; font-size:0.88rem; margin-bottom:4px; cursor:pointer; color:#1e293b;">
                                <input type="radio" name="holiday_source" value="gov_api" checked onclick="document.getElementById('gov-api-key-container').style.display='block'"> 🏛️ 정부 공식 데이터 <span style="font-size:0.8rem; color:#059669; font-weight:bold;">(추천 / 대체공휴일 완벽 지원)</span>
                            </label>
                            
                            <div id="gov-api-key-container" style="margin-left:20px; margin-bottom:8px;">
                                <input type="text" id="gov-api-key-input" placeholder="공공데이터 Service Key 입력..." style="width:100%; padding:6px 8px; font-size:0.82rem; border:1px solid #cbd5e1; border-radius:4px; box-sizing:border-box;" value="${savedGovApiKey}">
                                <div style="font-size:0.75rem; color:#64748b; margin-top:2px;">* 에러 발생 시 앱 내장 오프라인 데이터로 자동 전환됩니다.</div>
                            </div>

                            <label style="display:block; font-size:0.88rem; cursor:pointer; color:#1e293b;">
                                <input type="radio" name="holiday_source" value="google" onclick="document.getElementById('gov-api-key-container').style.display='none'"> 📅 구글 캘린더 한국 공휴일 <span style="font-size:0.8rem; color:#64748b;">(Google 기본 제공)</span>
                            </label>
                        </div>
                    </div>
                    
                    <div style="background:#fff; padding:10px; border-radius:6px; border:1px solid #d1d5db; margin-bottom:15px;">
                        <div style="font-size:0.9rem; font-weight:bold; margin-bottom:8px; color:#475569;">저장 방식 선택</div>
                        <label style="display:block; font-size:0.9rem; margin-bottom:5px; cursor:pointer;">
                            <input type="radio" name="import_mode" value="append" style="accent-color:#16a34a;"> ➕ 기존 일정에 단순히 <b>추가</b>하기
                        </label>
                        <label style="display:block; font-size:0.9rem; margin-bottom:5px; cursor:pointer;" title="기존에 직접 쓴 일정은 보호하고, 과거에 가져왔던 외부 일정만 지우고 최신화합니다.">
                            <input type="radio" name="import_mode" value="replace" checked style="accent-color:#16a34a;"> 🔄 가져온 외부 데이터만 <b>스마트 덮어쓰기</b> <span style="font-size:0.85rem; color:#059669; font-weight:bold;">(직접 작성한 일정 보호)</span>
                        </label>
                        <hr style="border:0; border-top:1px dashed #e2e8f0; margin:8px 0;">
                        <label style="display:block; font-size:0.9rem; cursor:pointer; color:#ef4444;" title="선택한 기간의 SP3 기존 일정을 모두 지우고 외부 일정으로 완전히 교체합니다.">
                            <input type="radio" name="import_mode" value="overwrite" style="accent-color:#ef4444;"> ⚠️ <b>완전 덮어쓰기</b> <span style="font-size:0.85rem; color:#ef4444; font-weight:bold;">(내가 직접 쓴 일정도 모두 삭제됨)</span>
                        </label>
                    </div>
                    <button class="modal-btn-primary" style="width:100%; background:#16a34a;" onclick="window.executeGoogleImport()">📥 SP3로 가져오기</button>
                </div>

                <div id="sync-progress-area" class="hidden" style="margin-top: 20px; text-align:center;">
                    <div style="color:#2563eb; font-weight:bold; margin-bottom:8px;" id="sync-status-text">진행 중...</div>
                    <div style="width:100%; background:#e2e8f0; height:10px; border-radius:5px; overflow:hidden;">
                        <div id="sync-progress-bar" style="width:0%; height:100%; background:#2563eb; transition:0.3s;"></div>
                    </div>
                </div>

            </div>
        </div>
    </div>`;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    setTimeout(() => {
        if(window.handleSyncPeriodChange) window.handleSyncPeriodChange();
    }, 10);
};

window.handleSyncPeriodChange = function() {
    const val = document.getElementById('sync-period-select').value;
    const startInput = document.getElementById('sync-start-date');
    const endInput = document.getElementById('sync-end-date');

    const d = window.currentDate ? new Date(window.currentDate) : new Date();
    const y = d.getFullYear();

    let sDate = new Date();
    let eDate = new Date();

    if (val === 'sem1' || val === 'sem2' || val === 'year') {
        let datesInfo = {
            sem1Start: `${y}-03-01`, sem1End: `${y}-08-15`,
            sem2Start: `${y}-08-16`, sem2End: `${y+1}-02-28`
        };
        if (typeof window.getSemesterDates === 'function') {
            datesInfo = window.getSemesterDates();
        }

        if (val === 'sem1') {
            sDate = new Date(datesInfo.sem1Start);
            eDate = new Date(datesInfo.sem1End);
        } else if (val === 'sem2') {
            sDate = new Date(datesInfo.sem2Start);
            eDate = new Date(datesInfo.sem2End);
        } else if (val === 'year') {
            sDate = new Date(datesInfo.sem1Start);
            eDate = new Date(datesInfo.sem2End);
        }
    }

    if (val === 'custom') {
        startInput.disabled = false;
        endInput.disabled = false;
        startInput.focus();
    } else {
        startInput.value = window.formatDate(sDate);
        endInput.value = window.formatDate(eDate);
        startInput.disabled = true;
        endInput.disabled = true;
    }
};

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

// 🏛️ 공공데이터포털 API 호출 함수
window.fetchHolidaysFromGovApi = async function(year, apiKey) {
    if (!apiKey) throw new Error("공공데이터포털 API Service Key가 필요합니다.");
    
    let cleanKey = apiKey.trim();
    let safeKey = encodeURIComponent(decodeURIComponent(cleanKey));
    let url = `https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo?solYear=${year}&ServiceKey=${safeKey}&_type=json&numOfRows=100`;
    
    let res = await fetch(url);
    let text = await res.text();
    
    let data;
    try {
        data = JSON.parse(text);
    } catch(e) {
        throw new Error("공공데이터 API 응답이 JSON 형태가 아닙니다. (인증키 오류 또는 CORS 제한)");
    }
    
    let holidays = {};
    if (data.response && data.response.body && data.response.body.items && data.response.body.items.item) {
        let items = data.response.body.items.item;
        if (!Array.isArray(items)) items = [items];
        
        items.forEach(item => {
            if (item.isHoliday === 'Y') {
                const locStr = item.locdate.toString();
                const dateStr = locStr.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');
                holidays[dateStr] = item.dateName;
            }
        });
    }
    return holidays;
};

// ==========================================================================
// 🚀 [1] 내보내기 (SP3 ➔ 구글) 로직
// ==========================================================================
window.executeGoogleExport = async function() {
    const token = await window.getValidGoogleToken();
    if (!token) return;

    const startStr = document.getElementById('sync-start-date').value;
    const endStr = document.getElementById('sync-end-date').value;
    
    const syncEvent = document.getElementById('sync-chk-event').checked;
    const syncClass = document.getElementById('sync-chk-class').checked;
    const syncJournal = document.getElementById('sync-chk-journal').checked;
    const syncTasks = document.getElementById('sync-chk-tasks').checked;

    if (!syncEvent && !syncClass && !syncJournal && !syncTasks) { alert("동기화할 항목을 선택해 주세요."); return; }
    
    let startD = new Date(startStr); let endD = new Date(endStr);
    if (startD > endD) { alert("시작일이 종료일보다 늦을 수 없습니다."); return; }

    startProgress("내보내기 준비 중...", "#2563eb");

    try {
        if (syncTasks) {
            updateProgress("📝 구글 Tasks 확인 및 동기화 중...", 10);
            await syncMemosToGoogleTasks(token);
        }

        if (syncEvent || syncClass || syncJournal) {
            updateProgress("📅 구글 캘린더 준비 중...", 20);
            const calId = await getOrCreateDedicatedCalendar(token);
            
            let datesToSync = [];
            let curD = new Date(startD);
            while (curD <= endD) {
                datesToSync.push(window.formatDate(curD));
                curD.setDate(curD.getDate() + 1);
            }

            const total = datesToSync.length;
            for (let i = 0; i < total; i++) {
                const dateStr = datesToSync[i];
                updateProgress(`📅 내보내는 중... (${dateStr}) [${i+1}/${total}]`, 20 + (80 * ((i+1)/total)));
                await syncSingleDateToCalendar(token, calId, dateStr, syncEvent, syncClass, syncJournal);
            }
        }

        finishProgress("🎉 구글로 내보내기가 완료되었습니다!");
    } catch (error) {
        handleSyncError(error);
    }
};

// ==========================================================================
// 🚀 [2] 가져오기 (구글 ➔ SP3) 로직
// ==========================================================================
window.executeGoogleImport = async function() {
    const token = await window.getValidGoogleToken();
    if (!token) return;

    const startStr = document.getElementById('sync-start-date').value;
    const endStr = document.getElementById('sync-end-date').value;
    
    const importPrimary = document.getElementById('import-chk-primary').checked;
    const importHoliday = document.getElementById('import-chk-holiday').checked;
    const mode = document.querySelector('input[name="import_mode"]:checked').value;

    if (!importPrimary && !importHoliday) { alert("가져올 항목을 선택해 주세요."); return; }
    
    let startD = new Date(startStr); let endD = new Date(endStr);
    if (startD > endD) { alert("시작일이 종료일보다 늦을 수 없습니다."); return; }

    startProgress("가져오기 준비 중...", "#16a34a");

    try {
        const timeMin = new Date(startStr + 'T00:00:00+09:00').toISOString();
        const timeMax = new Date(endStr + 'T23:59:59+09:00').toISOString();

        let importedEvents = [];
        const masterLabels = window.getEventLabels ? window.getEventLabels() : [];

        if (importHoliday) {
            const holidaySource = document.querySelector('input[name="holiday_source"]:checked')?.value || 'gov_api';
            const holidayLabelObj = masterLabels.find(l => l.isSkip) || masterLabels.find(l => l.name === '휴일');
            const labelId = holidayLabelObj ? holidayLabelObj.id : '';
            const labelName = holidayLabelObj ? holidayLabelObj.name : '공휴일';

            if (holidaySource === 'gov_api') {
                updateProgress("🏛️ 정부 공식 공휴일(API/내장) 처리 중...", 20);
                const apiKeyInput = document.getElementById('gov-api-key-input')?.value.trim() || '';
                if (apiKeyInput) localStorage.setItem('gov_holiday_api_key', apiKeyInput);

                const sYear = startD.getFullYear();
                const eYear = endD.getFullYear();
                let apiSuccess = false;

                for (let y = sYear; y <= eYear; y++) {
                    try {
                        const govHolidays = await window.fetchHolidaysFromGovApi(y, apiKeyInput);
                        if (govHolidays && Object.keys(govHolidays).length > 0) {
                            apiSuccess = true;
                            for (const [dStr, hName] of Object.entries(govHolidays)) {
                                if (dStr >= startStr && dStr <= endStr) {
                                    importedEvents.push({ 
                                        dateStr: dStr, 
                                        labelIds: labelId ? [labelId] : [], 
                                        label: labelName, 
                                        labels: [labelName], 
                                        content: hName, 
                                        source: 'holiday' 
                                    });
                                }
                            }
                        }
                    } catch (err) {
                        console.warn(`${y}년 공공데이터 API 가져오기 실패:`, err);
                    }
                }

                // 💡 [안전장치] API 실패 시 "내장 오프라인 공휴일" 코드가 자동으로 작동하여 사용자 모르게 빈틈을 메워줍니다.
                if (!apiSuccess) {
                    console.log("공공데이터 API 호출 실패로 내장 오프라인 DB로 자동 전환합니다.");
                    updateProgress("⚠️ 시스템 내장 대체공휴일 데이터 적용 중...", 25);
                    let curD = new Date(startD);
                    while (curD <= endD) {
                        const dStr = window.formatDate(curD);
                        const holidayName = window.getHolidayName ? window.getHolidayName(dStr) : null;
                        if (holidayName) {
                            importedEvents.push({ 
                                dateStr: dStr, 
                                labelIds: labelId ? [labelId] : [], 
                                label: labelName, 
                                labels: [labelName], 
                                content: holidayName, 
                                source: 'holiday' 
                            });
                        }
                        curD.setDate(curD.getDate() + 1);
                    }
                }
            } else if (holidaySource === 'google') {
                updateProgress("📅 구글 캘린더 한국 공휴일 읽는 중...", 20);
                const holidayCalId = encodeURIComponent('ko.south_korea#holiday@group.v.calendar.google.com');
                const url = `https://www.googleapis.com/calendar/v3/calendars/${holidayCalId}/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`;
                
                try {
                    const res = await googleFetch(url, 'GET', token);
                    if (res && res.items) {
                        res.items.forEach(ev => {
                            const dateArr = getDatesFromGoogleEvent(ev);
                            dateArr.forEach(dStr => {
                                if (dStr >= startStr && dStr <= endStr) {
                                    importedEvents.push({ 
                                        dateStr: dStr, 
                                        labelIds: labelId ? [labelId] : [],
                                        label: labelName, 
                                        labels: [labelName], 
                                        content: ev.summary, 
                                        source: 'holiday' 
                                    });
                                }
                            });
                        });
                    }
                } catch (e) {
                    console.warn("구글 공휴일 가져오기 실패:", e);
                }
            }
        }

        if (importPrimary) {
            updateProgress("📅 내 기본 캘린더 읽는 중...", 40);
            const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`;
            const res = await googleFetch(url, 'GET', token);
            
            const defaultLabelObj = masterLabels.length > 0 ? masterLabels[0] : null;
            const defLabelId = defaultLabelObj ? defaultLabelObj.id : '';
            const defLabelName = defaultLabelObj ? defaultLabelObj.name : '일정';

            if (res && res.items) {
                res.items.forEach(ev => {
                    const dateArr = getDatesFromGoogleEvent(ev);
                    dateArr.forEach(dStr => {
                        if (dStr >= startStr && dStr <= endStr) {
                            if (!ev.summary.includes('\u200C') && !ev.summary.includes('\u200D')) {
                                importedEvents.push({ 
                                    dateStr: dStr, 
                                    labelIds: defLabelId ? [defLabelId] : [], 
                                    label: defLabelName, 
                                    labels: [defLabelName], 
                                    content: ev.summary, 
                                    source: 'google' 
                                });
                            }
                        }
                    });
                });
            }
        }

        updateProgress("💾 SP3 데이터베이스에 저장 중...", 60);
        let eventsByDate = {};
        importedEvents.forEach(e => {
            if (!eventsByDate[e.dateStr]) eventsByDate[e.dateStr] = [];
            eventsByDate[e.dateStr].push(e);
        });

        let curD = new Date(startD);
        let processedCount = 0;
        const totalDays = (endD - startD) / (1000 * 60 * 60 * 24) + 1;
        let batch = window.db.batch();
        let batchOpCount = 0;

        while (curD <= endD) {
            const dStr = window.formatDate(curD);
            const newEvents = eventsByDate[dStr] || [];
            
            const docRef = window.getUserCol('events').doc(dStr);
            const docSnap = await docRef.get();
            let currentList = docSnap.exists ? (docSnap.data().eventList || []) : [];

            if (mode === 'replace') {
                currentList = currentList.filter(e => e.source !== 'google' && e.source !== 'holiday');
            } else if (mode === 'overwrite') {
                currentList = [];
            }

            if (newEvents.length > 0 || mode === 'replace' || mode === 'overwrite') {
                const mergedList = [...currentList, ...newEvents];
                batch.set(docRef, { eventList: mergedList, updatedAt: Date.now() }, { merge: true });
                batchOpCount++;

                let isSkipDay = false;
                for (const e of mergedList) {
                    if (e.source === 'holiday' || 
                       (e.labelIds && e.labelIds.some(id => {
                           const match = masterLabels.find(l => l.id === id);
                           return match && match.isSkip;
                       }))) {
                        isSkipDay = true; 
                        break;
                    }
                }
                
                if (isSkipDay) {
                    const scheduleRef = window.getUserCol('schedules').doc(dStr);
                    const scheduleSnap = await scheduleRef.get();
                    if (scheduleSnap.exists) {
                        const sData = scheduleSnap.data();
                        let periods = sData.periods || {};
                        let scheduleChanged = false;
                        
                        for (let p in periods) {
                            if (periods[p].subject && periods[p].subject.trim() !== '') {
                                periods[p].subject = ''; 
                                scheduleChanged = true;
                            }
                        }
                        
                        if (scheduleChanged) {
                            batch.set(scheduleRef, { periods: periods, updatedAt: Date.now() }, { merge: true });
                            batchOpCount++;
                        }
                    }
                }
            }

            if (batchOpCount >= 400) {
                await batch.commit();
                batch = window.db.batch();
                batchOpCount = 0;
            }

            processedCount++;
            updateProgress(`💾 SP3 데이터베이스에 저장 중... [${processedCount}/${totalDays}]`, 60 + (40 * (processedCount/totalDays)));
            curD.setDate(curD.getDate() + 1);
        }
        
        if (batchOpCount > 0) await batch.commit();
        
        finishProgress("🎉 가져오기가 완료되었습니다!");

    } catch (error) {
        handleSyncError(error);
    }
};

// ==========================================================================
// 🛠️ 내부 유틸 함수들
// ==========================================================================

function getDatesFromGoogleEvent(ev) {
    let dates = [];
    if (ev.start && ev.start.date) { 
        let startD = new Date(ev.start.date);
        let endD = new Date(ev.end.date);
        endD.setDate(endD.getDate() - 1); 
        while (startD <= endD) {
            dates.push(window.formatDate(startD));
            startD.setDate(startD.getDate() + 1);
        }
    } else if (ev.start && ev.start.dateTime) { 
        dates.push(window.formatDate(new Date(ev.start.dateTime)));
    }
    return dates;
}

function startProgress(text, color) {
    document.querySelectorAll('.modal-btn-primary').forEach(b => b.disabled = true);
    document.getElementById('sync-progress-area').classList.remove('hidden');
    const statusText = document.getElementById('sync-status-text');
    const progressBar = document.getElementById('sync-progress-bar');
    if (statusText) {
        statusText.innerText = text;
        statusText.style.color = color;
    }
    if (progressBar) {
        progressBar.style.background = color;
        progressBar.style.width = "0%";
    }
}

function updateProgress(text, percent) {
    const statusText = document.getElementById('sync-status-text');
    const progressBar = document.getElementById('sync-progress-bar');
    if (statusText) statusText.innerText = text;
    if (progressBar) progressBar.style.width = `${percent}%`;
}

function finishProgress(text) {
    const statusText = document.getElementById('sync-status-text');
    const progressBar = document.getElementById('sync-progress-bar');
    if (statusText) statusText.innerText = text;
    if (progressBar) progressBar.style.width = "100%";
    
    setTimeout(() => {
        const modal = document.getElementById('google-sync-modal');
        if (modal) modal.remove();
        if (typeof window.render === 'function') window.render();
    }, 1200);
}

function handleSyncError(error) {
    console.error("동기화 에러:", error);
    const statusText = document.getElementById('sync-status-text');
    if (statusText) {
        statusText.innerText = "❌ 오류 발생: " + error.message;
        statusText.style.color = "#ef4444";
    }
    document.querySelectorAll('.modal-btn-primary').forEach(b => b.disabled = false);
    
    if(error.message && (error.message.includes('401') || error.message.includes('403'))) {
        alert("구글 API 권한이 거부되었습니다.\n\n[해결 방법]\n1. 창을 닫고 로그아웃합니다.\n2. 다시 로그인할 때 뜨는 구글 팝업창에서 모든 접근 권한 체크박스를 반드시 체크해주세요!");
    }
}

async function getOrCreateDedicatedCalendar(token) {
    const listUrl = "https://www.googleapis.com/calendar/v3/users/me/calendarList";
    const data = await googleFetch(listUrl, 'GET', token);
    
    let targetCal = data.items ? data.items.find(cal => cal.summary === 'School Planner V3') : null;
    if (targetCal) return targetCal.id;

    const createUrl = "https://www.googleapis.com/calendar/v3/calendars";
    const newCal = await googleFetch(createUrl, 'POST', token, {
        summary: 'School Planner V3',
        description: '업무 및 수업 계획표(웹)에서 동기화된 전용 캘린더입니다.',
        timeZone: 'Asia/Seoul'
    });
    return newCal.id;
}

async function syncSingleDateToCalendar(token, calId, dateStr, incEvent, incClass, incJournal) {
    let payloadsToCreate = [];
    
    let d = new Date(dateStr);
    d.setDate(d.getDate() + 1);
    const endStr = window.formatDate(d);

    let seq = 1; 
    const getInvisiblePrefix = (num) => {
        return num.toString(2).padStart(5, '0').replace(/0/g, '\u200C').replace(/1/g, '\u200D');
    };

    if (incEvent) {
        const eDoc = await window.getUserCol('events').doc(dateStr).get();
        if (eDoc.exists && eDoc.data().eventList) {
            const list = eDoc.data().eventList.filter(e => e.content && e.content.trim() !== '' && e.source !== 'google' && e.source !== 'holiday');
            list.forEach(e => {
                let labelStr = (e.labels && e.labels.length > 0) ? e.labels[0] : (e.label || '일정');
                let invisiblePrefix = getInvisiblePrefix(seq++);
                payloadsToCreate.push({
                    summary: `${invisiblePrefix}[${labelStr}] ${e.content}`,
                    description: `📌 (웹사이트에서 동기화된 일정/행사입니다)`,
                    start: { date: dateStr },
                    end: { date: endStr },
                    extendedProperties: { private: { app: 'SchoolPlannerV3', dateStr: dateStr } }
                });
            });
        }
    }

    if (incClass) {
        const sDoc = await window.getUserCol('schedules').doc(dateStr).get();
        if (sDoc.exists && sDoc.data().periods) {
            const periods = sDoc.data().periods;
            let periodCount = window.periodNames ? window.periodNames.length : 6;
            for (let i = 1; i <= periodCount; i++) {
                let p = periods[i];
                if (p && p.subject && p.subject.trim() !== '' && p.subject.toUpperCase() !== 'X') {
                    let desc = `🎒 [수업 정보]\n`;
                    if (p.memo) desc += `- 수업 메모: ${p.memo}\n`;
                    if (p.supplies) desc += `- 비고: ${p.supplies}\n`;
                    if (!p.memo && !p.supplies) desc += `- 등록된 내용이 없습니다.\n`;

                    let invisiblePrefix = getInvisiblePrefix(seq++);
                    let pName = (window.periodNames && window.periodNames[i - 1]) ? window.periodNames[i - 1] : `${i}교시`;
                    payloadsToCreate.push({
                        summary: `${invisiblePrefix}[${pName}] ${p.subject}`,
                        description: desc.trim(),
                        start: { date: dateStr },
                        end: { date: endStr },
                        extendedProperties: { private: { app: 'SchoolPlannerV3', dateStr: dateStr } }
                    });
                }
            }
        }
    }

    if (incJournal) {
        const jDoc = await window.getUserCol('journals').doc(dateStr).get();
        if (jDoc.exists && jDoc.data().entries) {
            const journals = jDoc.data().entries.filter(j => j.content && j.content.trim() !== '');
            journals.forEach(j => {
                let labelStr = (j.labels && j.labels.length > 0) ? j.labels[0] : (j.label || '기록');
                let invisiblePrefix = getInvisiblePrefix(seq++);
                let displayContent = j.content.length > 25 ? j.content.substring(0, 25) + '...' : j.content;
                
                payloadsToCreate.push({
                    summary: `${invisiblePrefix}[${labelStr}] ${displayContent}`,
                    description: `📝 [전체 기록 내용]\n${j.content}`,
                    start: { date: dateStr },
                    end: { date: endStr },
                    extendedProperties: { private: { app: 'SchoolPlannerV3', dateStr: dateStr } }
                });
            });
        }
    }

    const searchUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events?privateExtendedProperty=app%3DSchoolPlannerV3&privateExtendedProperty=dateStr%3D${dateStr}`;
    const searchResult = await googleFetch(searchUrl, 'GET', token);
    const existingEvents = searchResult.items || [];

    for (const ev of existingEvents) {
        await googleFetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events/${ev.id}`, 'DELETE', token);
    }

    for (const payload of payloadsToCreate) {
        await googleFetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events`, 'POST', token, payload);
        await new Promise(res => setTimeout(res, 50)); 
    }
}

async function syncMemosToGoogleTasks(token) {
    const listUrl = "https://tasks.googleapis.com/tasks/v1/users/@me/lists";
    const data = await googleFetch(listUrl, 'GET', token);
    
    let targetList = (data.items || []).find(list => list.title === 'School Planner 메모');
    let taskListId;
    
    if (targetList) {
        taskListId = targetList.id;
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
        const contentStr = memo.text || ""; 
        const titleSnippet = contentStr ? (contentStr.length > 30 ? contentStr.substring(0, 30) + "..." : contentStr) : "내용 없음";
        
        let labelStr = '일반';
        if (Array.isArray(memo.labels) && memo.labels.length > 0) {
            labelStr = memo.labels.join(', ');
        } else if (memo.label) {
            labelStr = memo.label;
        }

        let finalNotes = contentStr;
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
