// js/modules/sync.js

import { formatDate, getSemesterDates, getEventLabels, getJournalLabels, getHolidayName } from '../core/utils.js'; 
import { parseRawEventTextToEventList } from '../core/eventUtils.js'; 
import { getUserCol, dbAPI, db } from '../firebase.js'; 
// 🌟 [핵심 패치] 모든 구버전 파이어베이스 문법을 대체할 최신 모듈 임포트
import { doc, getDoc, getDocs, query, where, documentId, writeBatch } from "firebase/firestore"; 

export const openGoogleSyncModal = async function() {
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
                        <option value="today">오늘</option>
                        <option value="week">해당 주 (이번 주)</option>
                        <option value="month">해당 월 (이번 달)</option>
                        <option value="sem1">1학기 전체</option>
                        <option value="sem2">2학기 전체</option>
                        <option value="year" selected>해당 학년도 전체</option>
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
                        <span>[내보내기] SP3.3 ➔ 구글 캘린더</span>
                    </h3>
                    <div style="display:flex; flex-direction:column; gap:8px; margin-bottom:15px;">
                        <label class="modal-checkbox-label" style="font-size:0.95rem; color:#1e293b;">
                            <input type="checkbox" id="sync-chk-event" class="modal-checkbox" checked> [캘린더] 일정 및 행사 내보내기
                        </label>
                        <label class="modal-checkbox-label" style="font-size:0.95rem; color:#1e293b;">
                            <input type="checkbox" id="sync-chk-class" class="modal-checkbox" checked> [캘린더] 시간표 및 수업 메모 내보내기
                        </label>
                        <label class="modal-checkbox-label" style="font-size:0.95rem; color:#1e293b;">
                            <input type="checkbox" id="sync-chk-journal" class="modal-checkbox" checked> [캘린더] 하루 기록 내보내기
                        </label>
                        <label class="modal-checkbox-label" style="font-size:0.95rem; color:#0f766e;">
                            <input type="checkbox" id="sync-chk-tasks" class="modal-checkbox" checked> [Tasks] 웹 메모 ➔ 구글 할 일 동기화
                        </label>
                    </div>
                    <button class="modal-btn-primary" style="width:100%; background:#2563eb;" onclick="window.executeGoogleExport()">🚀 스마트 강제 동기화 시작</button>
                    <p style="font-size:0.8rem; color:#64748b; text-align:center; margin-top:8px;">* 이미 겹쳐진 중복 일정도 알아서 깔끔하게 삭제하고 정리해 줍니다.</p>
                </div>

                <div style="border: 2px solid #bbf7d0; border-radius: 8px; padding: 15px; background: #f0fdf4;">
                    <h3 style="margin-top:0; color:#166534; display:flex; align-items:center; justify-content:space-between;">
                        <span>[가져오기] 외부 데이터 ➔ SP3.3</span>
                    </h3>
                    <div style="display:flex; flex-direction:column; gap:8px; margin-bottom:15px;">
                        <label class="modal-checkbox-label" style="font-size:0.95rem; color:#1e293b; font-weight:bold;">
                            <input type="checkbox" id="import-chk-primary" class="modal-checkbox" checked> 내 기본 캘린더(구글) 일정 가져오기
                        </label>
                        <label class="modal-checkbox-label" style="font-size:0.95rem; color:#2563eb; font-weight:bold;">
                            <input type="checkbox" id="import-chk-dedicated" class="modal-checkbox" checked> 'School Planner' 전용 캘린더 데이터 가져오기
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
                            <input type="radio" name="import_mode" value="append" style="accent-color:#16a34a;"> ➕ 기존 웹 데이터에 단순히 <b>추가</b>하기
                        </label>
                        <label style="display:block; font-size:0.9rem; margin-bottom:5px; cursor:pointer;" title="기존에 직접 쓴 웹 데이터는 보호하고, 과거에 구글에서 가져왔던 외부 데이터만 지우고 최신화합니다.">
                            <input type="radio" name="import_mode" value="replace" checked style="accent-color:#16a34a;"> 🔄 가져온 외부 데이터만 <b>스마트 덮어쓰기</b> <span style="font-size:0.85rem; color:#059669; font-weight:bold;">(웹에서 직접 쓴 내용 보호)</span>
                        </label>
                        <hr style="border:0; border-top:1px dashed #e2e8f0; margin:8px 0;">
                        <label style="display:block; font-size:0.9rem; cursor:pointer; color:#ef4444;" title="선택한 기간의 기존 데이터를 모두 지우고 외부 데이터로 완전히 교체합니다.">
                            <input type="radio" name="import_mode" value="overwrite" style="accent-color:#ef4444;"> ⚠️ <b>완전 덮어쓰기</b> <span style="font-size:0.85rem; color:#ef4444; font-weight:bold;">(모두 덮어씌워짐)</span>
                        </label>
                    </div>
                    <button class="modal-btn-primary" style="width:100%; background:#16a34a;" onclick="window.executeGoogleImport()">📥 School Planner로 가져오기</button>
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

export const handleSyncPeriodChange = function() {
    const val = document.getElementById('sync-period-select').value;
    const startInput = document.getElementById('sync-start-date');
    const endInput = document.getElementById('sync-end-date');

    const d = window.currentDate ? new Date(window.currentDate) : new Date();
    const y = d.getFullYear();
    const m = d.getMonth();

    let sDate = new Date(d);
    let eDate = new Date(d);

    if (val === 'custom') {
        startInput.disabled = false;
        endInput.disabled = false;
        startInput.focus();
        return;
    } else {
        startInput.disabled = true;
        endInput.disabled = true;
    }

    if (val === 'today') {
    } else if (val === 'week') {
        const day = d.getDay();
        sDate.setDate(d.getDate() - day);
        eDate.setDate(sDate.getDate() + 6);
    } else if (val === 'month') {
        sDate = new Date(y, m, 1);
        eDate = new Date(y, m + 1, 0);
    } else if (val === 'sem1' || val === 'sem2' || val === 'year') {
        let datesInfo = getSemesterDates();

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

    startInput.value = formatDate(sDate);
    endInput.value = formatDate(eDate);
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

async function fetchAllGoogleEvents(token, calId, timeMin, timeMax, extraParams = {}) {
    let allEvents = [];
    let pageToken = '';
    do {
        const params = new URLSearchParams({
            timeMin: timeMin,
            timeMax: timeMax,
            singleEvents: 'true',
            orderBy: 'startTime',
            maxResults: '250',
        });
        for (const [key, value] of Object.entries(extraParams)) {
            params.append(key, value);
        }
        if (pageToken) params.append('pageToken', pageToken);

        const searchUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events?${params.toString()}`;
        try {
            const res = await googleFetch(searchUrl, 'GET', token);
            if (res && res.items) {
                allEvents.push(...res.items);
            }
            pageToken = res?.nextPageToken || '';
        } catch (e) {
            console.warn("구글 기존 데이터 스캔 실패:", e);
            break;
        }
    } while (pageToken);
    return allEvents;
}

export const fetchHolidaysFromGovApi = async function(year, apiKey) {
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
        throw new Error("공공데이터 API 응답이 JSON 형태가 아닙니다. (인증키 오류 또는 CORS 제한)", { cause: e });
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

export const executeGoogleExport = async function() {
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

    startProgress("스마트 자가치유 동기화 시작...", "#2563eb");

    try {
        if (syncTasks) {
            updateProgress("📝 구글 Tasks 확인 및 정리 중...", 10);
            await syncMemosToGoogleTasks(token);
        }

        if (syncEvent || syncClass || syncJournal) {
            updateProgress("🔍 캘린더 전체 일정 딥스캔(Deep Scan) 중...", 20);

            const calId = await getOrCreateDedicatedCalendar(token);
            const timeMin = new Date(startStr + 'T00:00:00+09:00').toISOString();
            const timeMax = new Date(endStr + 'T23:59:59+09:00').toISOString();

            const existingGoogleEvents = await fetchAllGoogleEvents(token, calId, timeMin, timeMax, {
                privateExtendedProperty: 'app=SchoolPlannerV3'
            });

            const googleEventsByDate = {};
            existingGoogleEvents.forEach(ev => {
                const dStr = ev.extendedProperties?.private?.dateStr;
                if (dStr) {
                    if (!googleEventsByDate[dStr]) googleEventsByDate[dStr] = [];
                    googleEventsByDate[dStr].push(ev);
                }
            });

            // 🌟 [핵심 패치] 에러의 주범이었던 구버전 파이어베이스 .get()을 최신 Modular SDK getDocs()로 완벽하게 교체
            const [eSnap, sSnap, jSnap] = await Promise.all([
                getDocs(query(getUserCol('events'), where(documentId(), '>=', startStr), where(documentId(), '<=', endStr))),
                getDocs(query(getUserCol('schedules'), where(documentId(), '>=', startStr), where(documentId(), '<=', endStr))),
                getDocs(query(getUserCol('journals'), where(documentId(), '>=', startStr), where(documentId(), '<=', endStr)))
            ]);

            const eMap = {}; eSnap.forEach(d => eMap[d.id] = d.data());
            const sMap = {}; sSnap.forEach(d => sMap[d.id] = d.data());
            const jMap = {}; jSnap.forEach(d => jMap[d.id] = d.data());

            let datesToSync = [];
            let curD = new Date(startD);

            while (curD <= endD) {
                const dateStr = formatDate(curD);
                const eData = eMap[dateStr];
                const sData = sMap[dateStr];
                const jData = jMap[dateStr];
                const gEvents = googleEventsByDate[dateStr] || [];

                if (eData || sData || jData || gEvents.length > 0) {
                    datesToSync.push({ dateStr, eData, sData, jData, gEvents });
                }
                curD.setDate(curD.getDate() + 1);
            }

            const total = datesToSync.length;
            if (total === 0) {
                finishProgress("🎉 지정한 기간에 동기화할 데이터가 없습니다!");
                return;
            }

            for (let i = 0; i < total; i++) {
                const item = datesToSync[i];
                updateProgress(`📅 중복 청소 및 스마트 반영 중... (${item.dateStr}) [${i+1}/${total}]`, 20 + (80 * ((i+1)/total)));
                await syncSingleDateDataToCalendar(token, calId, item.dateStr, item.eData, item.sData, item.jData, syncEvent, syncClass, syncJournal, item.gEvents);
            }
        }

        finishProgress("🎉 구글 캘린더 동기화 및 찌꺼기 청소가 완벽하게 완료되었습니다!");
    } catch (error) {
        handleSyncError(error);
    }
};

export const executeGoogleImport = async function() {
    const token = await window.getValidGoogleToken();
    if (!token) return;

    const startStr = document.getElementById('sync-start-date').value;
    const endStr = document.getElementById('sync-end-date').value;
    
    const importPrimary = document.getElementById('import-chk-primary').checked;
    const importDedicated = document.getElementById('import-chk-dedicated').checked;
    const importHoliday = document.getElementById('import-chk-holiday').checked;
    const mode = document.querySelector('input[name="import_mode"]:checked').value;

    if (!importPrimary && !importDedicated && !importHoliday) { alert("가져올 항목을 선택해 주세요."); return; }
    
    let startD = new Date(startStr); let endD = new Date(endStr);
    if (startD > endD) { alert("시작일이 종료일보다 늦을 수 없습니다."); return; }

    startProgress("가져오기 준비 중...", "#16a34a");

    try {
        const timeMin = new Date(startStr + 'T00:00:00+09:00').toISOString();
        const timeMax = new Date(endStr + 'T23:59:59+09:00').toISOString();

        let importedEvents = [];
        let importedClasses = [];
        let importedJournals = [];

        const masterEventLabels = getEventLabels();
        const masterJournalLabels = getJournalLabels();

        if (importHoliday) {
            const holidaySource = document.querySelector('input[name="holiday_source"]:checked')?.value || 'gov_api';
            const holidayLabelObj = masterEventLabels.find(l => l.isSkip) || masterEventLabels.find(l => l.name === '휴일');
            const labelId = holidayLabelObj ? holidayLabelObj.id : '';
            const labelName = holidayLabelObj ? holidayLabelObj.name : '공휴일';

            if (holidaySource === 'gov_api') {
                updateProgress("🏛️ 정부 공식 공휴일 처리 중...", 20);
                const apiKeyInput = document.getElementById('gov-api-key-input')?.value.trim() || '';
                if (apiKeyInput) localStorage.setItem('gov_holiday_api_key', apiKeyInput);

                const sYear = startD.getFullYear();
                const eYear = endD.getFullYear();
                let apiSuccess = false;

                for (let y = sYear; y <= eYear; y++) {
                    try {
                        const govHolidays = await fetchHolidaysFromGovApi(y, apiKeyInput);
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
                                        completed: false, 
                                        source: 'holiday' 
                                    });
                                }
                            }
                        }
                    } catch (err) {
                        console.warn(`${y}년 공공데이터 API 가져오기 실패:`, err);
                    }
                }

                if (!apiSuccess) {
                    console.log("공공데이터 API 호출 실패로 내장 오프라인 DB로 자동 전환합니다.");
                    updateProgress("⚠️ 시스템 내장 대체공휴일 데이터 적용 중...", 25);
                    let curD = new Date(startD);
                    while (curD <= endD) {
                        const dStr = formatDate(curD);
                        const holidayName = getHolidayName ? getHolidayName(dStr) : null;
                        if (holidayName) {
                            importedEvents.push({ 
                                dateStr: dStr, 
                                labelIds: labelId ? [labelId] : [], 
                                label: holidayName, 
                                labels: [holidayName], 
                                content: holidayName, 
                                completed: false,
                                source: 'holiday' 
                            });
                        }
                        curD.setDate(curD.getDate() + 1);
                    }
                }
            } else if (holidaySource === 'google') {
                updateProgress("📅 구글 캘린더 한국 공휴일 읽는 중...", 20);
                const holidayCalId = encodeURIComponent('ko.south_korea#holiday@group.v.calendar.google.com');
                const resItems = await fetchAllGoogleEvents(token, holidayCalId, timeMin, timeMax);
                
                try {
                    if (resItems && resItems.length > 0) {
                        resItems.forEach(ev => {
                            const dateArr = getDatesFromGoogleEvent(ev);
                            dateArr.forEach(dStr => {
                                if (dStr >= startStr && dStr <= endStr) {
                                    importedEvents.push({ 
                                        dateStr: dStr, 
                                        labelIds: labelId ? [labelId] : [],
                                        label: labelName, 
                                        labels: [labelName], 
                                        content: ev.summary, 
                                        completed: false,
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
            const resItems = await fetchAllGoogleEvents(token, 'primary', timeMin, timeMax);
            
            const defaultLabelObj = masterEventLabels.length > 0 ? masterEventLabels[0] : null;
            const defLabelId = defaultLabelObj ? defaultLabelObj.id : '';
            const defLabelName = defaultLabelObj ? defaultLabelObj.name : '일정';

            if (resItems && resItems.length > 0) {
                resItems.forEach(ev => {
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
                                    completed: false,
                                    source: 'google_primary' 
                                });
                            }
                        }
                    });
                });
            }
        }

        if (importDedicated) {
            updateProgress("📅 'School Planner' 캘린더 스마트 복원 중...", 50);
            try {
                const calId = await getOrCreateDedicatedCalendar(token);
                const resItems = await fetchAllGoogleEvents(token, calId, timeMin, timeMax);
                
                if (resItems && resItems.length > 0) {
                    resItems.forEach(ev => {
                        const priv = ev.extendedProperties?.private || {};
                        const type = priv.type || 'event'; 
                        const isCompleted = priv.completed === 'true'; 
                        
                        const dateArr = getDatesFromGoogleEvent(ev);
                        dateArr.forEach(dStr => {
                            if (dStr >= startStr && dStr <= endStr) {
                                let rawSummary = (ev.summary || '').replace(/^[\u200C\u200D]+/, '');
                                let rawDesc = ev.description || '';

                                if (type === 'class') {
                                    const pNum = priv.period ? parseInt(priv.period, 10) : null;
                                    if (pNum) {
                                        let subject = rawSummary;
                                        const match = subject.match(/^(?:✅\s*)?\[(.*?)\]\s*(.*)$/);
                                        if (match) subject = match[2].trim();
                                        
                                        let memo = ''; let supplies = '';
                                        if (rawDesc) {
                                            const mMatch = rawDesc.match(/- 수업 메모:\s*([\s\S]*?)(?=\n- 비고:|$)/);
                                            if (mMatch) memo = mMatch[1].trim();
                                            const sMatch = rawDesc.match(/- 비고:\s*([\s\S]*?)$/);
                                            if (sMatch) supplies = sMatch[1].trim();
                                        }
                                        importedClasses.push({ dateStr: dStr, period: pNum, subject, memo, supplies, source: 'google_dedicated' });
                                    }
                                } else if (type === 'journal') {
                                    let labelStr = priv.labelStr || '기록';
                                    let content = rawDesc ? rawDesc.replace(/^📝 \[전체 기록 내용\]\n/, '') : rawSummary;
                                    const match = content.match(/^(?:✅\s*)?\[(.*?)\]\s*([\s\S]*)$/);
                                    if (match && !priv.labelStr) {
                                        labelStr = match[1].trim();
                                        content = match[2].trim();
                                    } else if (priv.labelStr && match && match[1].trim() === priv.labelStr) {
                                        content = match[2].trim();
                                    }
                                    
                                    let labelsArray = labelStr.split(',').map(s => s.trim()).filter(Boolean);
                                    if(labelsArray.length === 0) labelsArray = ['기록'];
                                    
                                    let mappedLabelIds = [];
                                    labelsArray.forEach(lbl => {
                                        const found = masterJournalLabels.find(m => m.name === lbl);
                                        if (found) mappedLabelIds.push(found.id);
                                    });

                                    let newJr = { 
                                        dateStr: dStr, 
                                        labelIds: mappedLabelIds, 
                                        label: labelsArray[0], 
                                        labels: labelsArray, 
                                        content: content, 
                                        completed: isCompleted,
                                        source: 'google_dedicated' 
                                    };
                                    if (priv.sp_id) newJr.id = priv.sp_id;
                                    if (priv.sp_groupId) newJr.groupId = priv.sp_groupId;
                                    if (priv.sp_forwardChainId) newJr.forwardChainId = priv.sp_forwardChainId;
                                    if (priv.sp_originalDate) newJr.originalDate = priv.sp_originalDate;
                                    
                                    importedJournals.push(newJr);
                                } else { 
                                    let labelStr = priv.labelStr || '구글동기화';
                                    let content = rawSummary;
                                    const match = content.match(/^(?:✅\s*)?\[(.*?)\]\s*([\s\S]*)$/);
                                    if (match && !priv.labelStr) {
                                        labelStr = match[1].trim();
                                        content = match[2].trim();
                                    } else if (priv.labelStr && match && match[1].trim() === priv.labelStr) {
                                        content = match[2].trim();
                                    }
                                    
                                    let labelsArray = labelStr.split(',').map(s => s.trim()).filter(Boolean);
                                    if(labelsArray.length === 0) labelsArray = ['구글동기화'];

                                    let mappedLabelIds = [];
                                    labelsArray.forEach(lbl => {
                                        const found = masterEventLabels.find(m => m.name === lbl);
                                        if (found) mappedLabelIds.push(found.id);
                                    });

                                    let newEv = { 
                                        dateStr: dStr, 
                                        labelIds: mappedLabelIds, 
                                        label: labelsArray[0], 
                                        labels: labelsArray, 
                                        content: content, 
                                        completed: isCompleted,
                                        source: 'google_dedicated' 
                                    };
                                    if (priv.sp_id) newEv.id = priv.sp_id;
                                    if (priv.sp_groupId) newEv.groupId = priv.sp_groupId;
                                    if (priv.sp_forwardChainId) newEv.forwardChainId = priv.sp_forwardChainId;
                                    if (priv.sp_originalDate) newEv.originalDate = priv.sp_originalDate;

                                    importedEvents.push(newEv);
                                }
                            }
                        });
                    });
                }
            } catch (e) {
                console.warn("전용 캘린더 가져오기 실패:", e);
            }
        }

        updateProgress("💾 데이터베이스에 스마트 분류 및 저장 중...", 60);
        
        let eventsByDate = {};
        importedEvents.forEach(e => { if (!eventsByDate[e.dateStr]) eventsByDate[e.dateStr] = []; eventsByDate[e.dateStr].push(e); });
        
        let classesByDate = {};
        importedClasses.forEach(c => { if (!classesByDate[c.dateStr]) classesByDate[c.dateStr] = []; classesByDate[c.dateStr].push(c); });
        
        let journalsByDate = {};
        importedJournals.forEach(j => { if (!journalsByDate[j.dateStr]) journalsByDate[j.dateStr] = []; journalsByDate[j.dateStr].push(j); });

        let curD = new Date(startD);
        let processedCount = 0;
        const totalDays = (endD - startD) / (1000 * 60 * 60 * 24) + 1;
        
        // 🌟 [핵심 패치] 모든 구버전 window.db.batch() 문법을 writeBatch(db)로 100% 모듈화 교체
        let batch = writeBatch(db);
        let batchOpCount = 0;

        const getUniqueList = (list) => {
            const uniqueMap = new Map();
            for (const item of list) {
                const lblStr = (item.labels || []).join(',');
                let key = '';
                if (item.id) key = `id_${item.id}`; 
                else if (item.forwardChainId) key = `chain_${item.forwardChainId}_${item.content}`; 
                else key = `val_${item.content}-${lblStr}`; 

                if (!uniqueMap.has(key)) {
                    uniqueMap.set(key, { ...item });
                } else {
                    const existing = uniqueMap.get(key);
                    existing.completed = item.completed; 
                    existing.source = item.source || existing.source;
                    
                    if (!existing.id && item.id) existing.id = item.id;
                    if (!existing.forwardChainId && item.forwardChainId) existing.forwardChainId = item.forwardChainId;
                    if (!existing.groupId && item.groupId) existing.groupId = item.groupId;
                    if (!existing.originalDate && item.originalDate) existing.originalDate = item.originalDate;
                }
            }
            return Array.from(uniqueMap.values());
        };

        while (curD <= endD) {
            const dStr = formatDate(curD);
            const newEvents = eventsByDate[dStr] || [];
            const newClasses = classesByDate[dStr] || [];
            const newJournals = journalsByDate[dStr] || [];
            
            // 🌟 [핵심 패치] .get()을 getDoc(doc(...)) 문법으로 완벽하게 교체
            const evRef = doc(getUserCol('events'), dStr);
            const evSnap = await getDoc(evRef);
            let currentList = [];
            
            if (evSnap.exists()) {
                const data = evSnap.data();
                currentList = data.eventList || [];
                if (currentList.length === 0 && data.eventText) {
                    currentList = parseRawEventTextToEventList(data.eventText);
                }
            }

            if (mode === 'replace') currentList = currentList.filter(e => e.source !== 'google_primary' && e.source !== 'google_dedicated');
            else if (mode === 'overwrite') currentList = [];

            if (newEvents.length > 0 || mode === 'replace' || mode === 'overwrite') {
                const mergedList = getUniqueList([...currentList, ...newEvents]); 
                batch.set(evRef, { eventList: mergedList, updatedAt: Date.now() }, { merge: true });
                batchOpCount++;

                let isSkipDay = false;
                for (const e of mergedList) {
                    if (e.source === 'holiday' || (e.labelIds && e.labelIds.some(id => { const match = masterEventLabels.find(l => l.id === id); return match && match.isSkip; }))) {
                        isSkipDay = true; break;
                    }
                }
                
                if (isSkipDay) {
                    const scRef = doc(getUserCol('schedules'), dStr);
                    const scSnap = await getDoc(scRef);
                    if (scSnap.exists()) {
                        let periods = scSnap.data().periods || {};
                        let scheduleChanged = false;
                        for (let p in periods) {
                            if (periods[p].subject && periods[p].subject.trim() !== '') { periods[p].subject = ''; scheduleChanged = true; }
                        }
                        if (scheduleChanged) { batch.set(scRef, { periods: periods, updatedAt: Date.now() }, { merge: true }); batchOpCount++; }
                    }
                }
            }

            if (importDedicated && (newClasses.length > 0 || mode === 'overwrite')) {
                const scRef = doc(getUserCol('schedules'), dStr);
                const scSnap = await getDoc(scRef);
                let periods = scSnap.exists() ? (scSnap.data().periods || {}) : {};
                
                if (mode === 'overwrite') periods = {};
                
                newClasses.forEach(c => {
                    periods[c.period] = { subject: c.subject, memo: c.memo, supplies: c.supplies };
                });
                
                if (newClasses.length > 0 || mode === 'overwrite') {
                    batch.set(scRef, { periods: periods, updatedAt: Date.now() }, { merge: true });
                    batchOpCount++;
                }
            }

            if (importDedicated && (newJournals.length > 0 || mode === 'replace' || mode === 'overwrite')) {
                const jrRef = doc(getUserCol('journals'), dStr);
                const jrSnap = await getDoc(jrRef);
                let entries = jrSnap.exists() ? (jrSnap.data().entries || []) : [];
                
                if (mode === 'replace') entries = entries.filter(j => j.source !== 'google_dedicated');
                else if (mode === 'overwrite') entries = [];
                
                if (newJournals.length > 0 || mode === 'replace' || mode === 'overwrite') {
                    const mergedEntries = getUniqueList([...entries, ...newJournals]); 
                    batch.set(jrRef, { entries: mergedEntries, updatedAt: Date.now() }, { merge: true });
                    batchOpCount++;
                }
            }

            if (batchOpCount >= 400) {
                await batch.commit();
                batch = writeBatch(db);
                batchOpCount = 0;
            }

            processedCount++;
            updateProgress(`💾 데이터베이스에 스마트 분류 및 저장 중... [${processedCount}/${totalDays}]`, 60 + (40 * (processedCount/totalDays)));
            curD.setDate(curD.getDate() + 1);
        }
        
        if (batchOpCount > 0) await batch.commit();
        
        finishProgress("🎉 스마트 파싱 및 가져오기가 완료되었습니다!");

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
            dates.push(formatDate(startD));
            startD.setDate(startD.getDate() + 1);
        }
    } else if (ev.start && ev.start.dateTime) { 
        dates.push(formatDate(new Date(ev.start.dateTime)));
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
    
    let targetCal = data.items ? data.items.find(cal => cal.summary === 'School Planner V3.3') : null;
    if (targetCal) return targetCal.id;

    let oldCal = data.items ? data.items.find(cal => cal.summary.startsWith('School Planner V3')) : null;
    if (oldCal) {
        try {
            await googleFetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(oldCal.id)}`, 'PUT', token, {
                summary: 'School Planner V3.3',
                description: '업무 및 수업 계획표(웹)에서 동기화된 전용 캘린더입니다.',
                timeZone: 'Asia/Seoul'
            });
        } catch(e) { console.warn("기존 캘린더 이름 업데이트 실패:", e); }
        return oldCal.id;
    }

    const createUrl = "https://www.googleapis.com/calendar/v3/calendars";
    const newCal = await googleFetch(createUrl, 'POST', token, {
        summary: 'School Planner V3.3',
        description: '업무 및 수업 계획표(웹)에서 동기화된 전용 캘린더입니다.',
        timeZone: 'Asia/Seoul'
    });
    return newCal.id;
}

async function syncSingleDateDataToCalendar(token, calId, dateStr, eData, sData, jData, incEvent, incClass, incJournal, existingEvents = []) {
    let payloadsToCreate = [];
    
    let d = new Date(dateStr);
    d.setDate(d.getDate() + 1);
    const endStr = formatDate(d);

    let seq = 1; 
    const getInvisiblePrefix = (num) => {
        return num.toString(2).padStart(5, '0').replace(/0/g, '\u200C').replace(/1/g, '\u200D');
    };

    const masterEventLabels = getEventLabels();
    const masterJournalLabels = getJournalLabels();

    if (incEvent && eData) {
        let list = eData.eventList || [];
        if (list.length === 0 && eData.eventText) {
            list = parseRawEventTextToEventList(eData.eventText);
        }

        const validList = list.filter(e => e.content && e.content.trim() !== '' && e.source !== 'google_primary' && e.source !== 'holiday');
        
        validList.forEach(e => {
            let labelNames = [];
            if (e.labelIds && e.labelIds.length > 0) {
                labelNames = e.labelIds.map(id => {
                    const matched = masterEventLabels.find(l => l.id === id || l.name === id);
                    return matched ? matched.name : id;
                });
            } else if (e.labels && e.labels.length > 0) {
                labelNames = e.labels;
            } else if (e.label) {
                labelNames = [e.label];
            }
            let labelStr = labelNames.length > 0 ? labelNames.join(', ') : '일정';

            let invisiblePrefix = getInvisiblePrefix(seq++);
            const mark = e.completed ? '✅ ' : '';
            
            payloadsToCreate.push({
                summary: `${invisiblePrefix}${mark}[${labelStr}] ${e.content}`,
                description: `📌 (웹사이트에서 동기화된 일정/행사입니다)`,
                start: { date: dateStr },
                end: { date: endStr },
                extendedProperties: { private: { 
                    app: 'SchoolPlannerV3', 
                    dateStr: dateStr,
                    type: 'event',
                    labelStr: labelStr,
                    completed: e.completed ? 'true' : 'false',
                    sp_id: e.id || '',
                    sp_groupId: e.groupId || '',
                    sp_forwardChainId: e.forwardChainId || '',
                    sp_originalDate: e.originalDate || ''
                } }
            });
        });
    }

    if (incClass && sData && sData.periods) {
        const periods = sData.periods;
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
                    extendedProperties: { private: { 
                        app: 'SchoolPlannerV3', 
                        dateStr: dateStr,
                        type: 'class',
                        period: i.toString() 
                    } }
                });
            }
        }
    }

    if (incJournal && jData && jData.entries) {
        const journals = jData.entries.filter(j => j.content && j.content.trim() !== '');
        journals.forEach(j => {
            let labelNames = [];
            if (j.labelIds && j.labelIds.length > 0) {
                labelNames = j.labelIds.map(id => {
                    const matched = masterJournalLabels.find(l => l.id === id || l.name === id);
                    return matched ? matched.name : id;
                });
            } else if (j.labels && j.labels.length > 0) {
                labelNames = j.labels;
            } else if (j.label) {
                labelNames = [j.label];
            }
            let labelStr = labelNames.length > 0 ? labelNames.join(', ') : '기록';

            let invisiblePrefix = getInvisiblePrefix(seq++);
            let displayContent = j.content.length > 25 ? j.content.substring(0, 25) + '...' : j.content;
            
            const mark = j.completed ? '✅ ' : '';
            
            payloadsToCreate.push({
                summary: `${invisiblePrefix}${mark}[${labelStr}] ${displayContent}`,
                description: `📝 [전체 기록 내용]\n${j.content}`,
                start: { date: dateStr },
                end: { date: endStr },
                extendedProperties: { private: { 
                    app: 'SchoolPlannerV3', 
                    dateStr: dateStr,
                    type: 'journal',
                    labelStr: labelStr,
                    completed: j.completed ? 'true' : 'false',
                    sp_id: j.id || '',
                    sp_groupId: j.groupId || '',
                    sp_forwardChainId: j.forwardChainId || '',
                    sp_originalDate: j.originalDate || ''
                } }
            });
        });
    }

    const managedExistingEvents = existingEvents.filter(ev => {
        const type = ev.extendedProperties?.private?.type || 'event';
        if (type === 'event' && !incEvent) return false; 
        if (type === 'class' && !incClass) return false;
        if (type === 'journal' && !incJournal) return false;
        return true;
    });

    let matchedExistingIds = new Set();
    const toCreate = [];

    for (const payload of payloadsToCreate) {
        const matchIdx = managedExistingEvents.findIndex(ev =>
            !matchedExistingIds.has(ev.id) &&
            ev.summary === payload.summary &&
            (ev.description || '') === (payload.description || '') &&
            ev.extendedProperties?.private?.type === payload.extendedProperties.private.type &&
            ev.extendedProperties?.private?.labelStr === payload.extendedProperties.private.labelStr &&
            ev.extendedProperties?.private?.period === payload.extendedProperties.private.period &&
            ev.extendedProperties?.private?.completed === payload.extendedProperties.private.completed &&
            (ev.extendedProperties?.private?.sp_id || '') === (payload.extendedProperties.private.sp_id || '') &&
            (ev.extendedProperties?.private?.sp_forwardChainId || '') === (payload.extendedProperties.private.sp_forwardChainId || '')
        );

        if (matchIdx !== -1) {
            matchedExistingIds.add(managedExistingEvents[matchIdx].id); 
        } else {
            toCreate.push(payload); 
        }
    }

    const eventsToDelete = managedExistingEvents.filter(ev => !matchedExistingIds.has(ev.id));

    for (const ev of eventsToDelete) {
        try {
            await googleFetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events/${ev.id}`, 'DELETE', token);
        } catch(e) { console.warn("일정 삭제 실패", e); }
    }

    for (const payload of toCreate) {
        try {
            await googleFetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events`, 'POST', token, payload);
            await new Promise(res => setTimeout(res, 50)); 
        } catch(e) { console.warn("일정 생성 실패", e); }
    }
}

async function syncMemosToGoogleTasks(token) {
    const listUrl = "https://tasks.googleapis.com/tasks/v1/users/@me/lists";
    const data = await googleFetch(listUrl, 'GET', token);
    
    let targetList = (data.items || []).find(list => list.title === 'School Planner 메모');
    let taskListId;
    
    if (targetList) {
        taskListId = targetList.id;
        let allTasks = [];
        let pageToken = '';
        
        do {
            const tasksData = await googleFetch(`https://tasks.googleapis.com/tasks/v1/lists/${taskListId}/tasks${pageToken ? '?pageToken='+pageToken : ''}`, 'GET', token);
            if (tasksData && tasksData.items) allTasks.push(...tasksData.items);
            pageToken = tasksData?.nextPageToken || '';
        } while(pageToken);

        for (const task of allTasks) {
            if (task.id) {
                try { await googleFetch(`https://tasks.googleapis.com/tasks/v1/lists/${taskListId}/tasks/${task.id}`, 'DELETE', token); } catch(e) {}
            }
        }
    } else {
        const newList = await googleFetch(listUrl, 'POST', token, { title: 'School Planner 메모' });
        taskListId = newList.id;
    }

    const webMemos = await dbAPI.loadMemos();
    for (const memo of webMemos) {
        const contentStr = memo.text || ""; 
        let titleSnippet = contentStr ? (contentStr.length > 30 ? contentStr.substring(0, 30) + "..." : contentStr) : "내용 없음";
        
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
        await new Promise(res => setTimeout(res, 20)); 
    }
}

window.openGoogleSyncModal = openGoogleSyncModal;
window.executeGoogleExport = executeGoogleExport;
window.executeGoogleImport = executeGoogleImport;
window.handleSyncPeriodChange = handleSyncPeriodChange;
window.fetchHolidaysFromGovApi = fetchHolidaysFromGovApi;