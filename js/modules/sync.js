// js/modules/sync.js

import { formatDate, getEventLabels, getJournalLabels } from '../core/utils.js'; 
import { parseRawEventTextToEventList } from '../core/eventUtils.js'; 
import { getUserCol, auth, storage } from '../firebase.js'; 
import { doc, getDoc, getDocs, query, where, documentId } from "firebase/firestore"; 
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

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

// 🌟 [핵심 추가] 조사표 데이터를 CSV 파일로 파이어베이스 저장소에 임시로 올리고 다운로드 링크를 받아오는 함수
async function uploadEvalCSVToStorage(ev) {
    if (!auth.currentUser || typeof window.BackupManager === 'undefined') return null;
    try {
        const csvStr = window.BackupManager.generateSingleEvalCSV(ev);
        const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
        const safeTitle = (ev.title || '조사표').replace(/[^a-zA-Z0-9가-힣_]/g, '_');
        const filePath = `evaluations_csv/${auth.currentUser.uid}/${ev.id}_${safeTitle}.csv`;
        const storageRef = ref(storage, filePath);
        await uploadBytes(storageRef, blob);
        return await getDownloadURL(storageRef);
    } catch(e) {
        console.error("CSV 업로드 실패:", e);
        return null;
    }
}

export const executeGoogleExport = async function() {
    const token = await window.getValidGoogleToken();
    if (!token) return;

    // 🌟 [핵심 변경] 새롭게 디자인된 백업 모달의 ID 값에서 데이터를 읽어옵니다.
    const startStr = document.getElementById('backup-start-date').value;
    const endStr = document.getElementById('backup-end-date').value;
    
    const syncEvent = document.getElementById('backup-chk-event').checked;
    const syncClass = document.getElementById('backup-chk-class').checked;
    const syncJournal = document.getElementById('backup-chk-journal').checked;
    const syncTasks = document.getElementById('backup-chk-memo').checked;
    const syncEval = document.getElementById('backup-chk-eval').checked;

    if (!syncEvent && !syncClass && !syncJournal && !syncTasks && !syncEval) { alert("동기화할 항목을 선택해 주세요."); return; }
    
    let startD = new Date(startStr); let endD = new Date(endStr);
    if (startD > endD) { alert("시작일이 종료일보다 늦을 수 없습니다."); return; }

    startProgress("구글 캘린더 동기화 시작...", "#ea4335");

    try {
        if (syncTasks) {
            updateProgress("📝 구글 Tasks 확인 및 정리 중...", 10);
            await syncMemosToGoogleTasks(token);
        }

        if (syncEvent || syncClass || syncJournal || syncEval) {
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

            const [eSnap, sSnap, jSnap, elSnap] = await Promise.all([
                getDocs(query(getUserCol('events'), where(documentId(), '>=', startStr), where(documentId(), '<=', endStr))),
                getDocs(query(getUserCol('schedules'), where(documentId(), '>=', startStr), where(documentId(), '<=', endStr))),
                getDocs(query(getUserCol('journals'), where(documentId(), '>=', startStr), where(documentId(), '<=', endStr))),
                syncEval ? getDocs(query(getUserCol('evaluations'), where(documentId(), '>=', startStr), where(documentId(), '<=', endStr))) : { forEach: () => {} }
            ]);

            const eMap = {}; eSnap.forEach(d => eMap[d.id] = d.data());
            const sMap = {}; sSnap.forEach(d => sMap[d.id] = d.data());
            const jMap = {}; jSnap.forEach(d => jMap[d.id] = d.data());
            const elMap = {}; elSnap.forEach(d => elMap[d.id] = d.data());

            let datesToSync = [];
            let curD = new Date(startD);

            while (curD <= endD) {
                const dateStr = formatDate(curD);
                const eData = eMap[dateStr];
                const sData = sMap[dateStr];
                const jData = jMap[dateStr];
                const elData = elMap[dateStr];
                const gEvents = googleEventsByDate[dateStr] || [];

                if (eData || sData || jData || elData || gEvents.length > 0) {
                    datesToSync.push({ dateStr, eData, sData, jData, elData, gEvents });
                }
                curD.setDate(curD.getDate() + 1);
            }

            const total = datesToSync.length;
            if (total === 0) {
                finishProgress("🎉 지정한 기간에 캘린더로 내보낼 데이터가 없습니다!");
                return;
            }

            for (let i = 0; i < total; i++) {
                const item = datesToSync[i];
                updateProgress(`📅 중복 청소 및 스마트 반영 중... (${item.dateStr}) [${i+1}/${total}]`, 20 + (80 * ((i+1)/total)));
                await syncSingleDateDataToCalendar(token, calId, item.dateStr, item.eData, item.sData, item.jData, item.elData, syncEvent, syncClass, syncJournal, syncEval, item.gEvents);
            }
        }

        finishProgress("🎉 구글 캘린더/Tasks 동기화가 완벽하게 완료되었습니다!");
    } catch (error) {
        handleSyncError(error);
    }
};

export const executeGoogleImport = async function() {
    const token = await window.getValidGoogleToken();
    if (!token) return;

    // 🌟 [핵심 변경] 새롭게 디자인된 백업 모달의 ID 값에서 데이터를 읽어옵니다.
    const startStr = document.getElementById('backup-start-date').value;
    const endStr = document.getElementById('backup-end-date').value;
    
    const importPrimary = document.getElementById('import-chk-primary')?.checked;
    const importHoliday = document.getElementById('import-chk-holiday')?.checked;
    const mode = document.querySelector('input[name="import-mode"]:checked').value;
    // 구글 캘린더에서 웹으로 가져올 때, 전용 캘린더의 데이터는 merge(병합)모드일 경우 replace(치환)로 작동하여 중복을 방지합니다.
    const internalMode = mode === 'merge' ? 'replace' : 'overwrite';

    if (!importPrimary && !importHoliday) { alert("가져올 세부 옵션을 설정해 주세요."); return; }
    
    let startD = new Date(startStr); let endD = new Date(endStr);
    if (startD > endD) { alert("시작일이 종료일보다 늦을 수 없습니다."); return; }

    startProgress("구글 캘린더 데이터 가져오기 준비 중...", "#16a34a");

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
                    console.log("공공데이터 API 실패로 구글 내장 데이터로 자동 전환합니다.");
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

        updateProgress("📅 'School Planner' 전용 캘린더 복원 중...", 50);
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
                                        const sMatch = rawDesc.match(/- 비고:\s*([\s\S]*?)(?=\n\n📊 \[조사표 첨부파일\]|$)/); // CSV 첨부파일 링크 구역 제외
                                        if (sMatch) supplies = sMatch[1].trim();
                                    }
                                    importedClasses.push({ dateStr: dStr, period: pNum, subject, memo, supplies, source: 'google_dedicated' });
                                }
                            } else if (type === 'journal') {
                                let labelStr = priv.labelStr || '기록';
                                let content = rawDesc ? rawDesc.replace(/^📝 \[전체 기록 내용\]\n/, '').replace(/\n\n📊 \[조사표 첨부파일\][\s\S]*$/, '') : rawSummary;
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

        updateProgress("💾 데이터베이스에 스마트 분류 및 저장 중...", 60);
        // ... (이후 DB 저장 로직은 기존과 동일)
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
    document.querySelectorAll('#btn-master-import, #btn-master-export').forEach(b => b.disabled = true);
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
        if (window.BackupManager && window.BackupManager.modal) window.BackupManager.modal.close();
        if (typeof window.render === 'function') window.render();
    }, 1500);
}

function handleSyncError(error) {
    console.error("동기화 에러:", error);
    const statusText = document.getElementById('sync-status-text');
    if (statusText) {
        statusText.innerText = "❌ 오류 발생: " + error.message;
        statusText.style.color = "#ef4444";
    }
    document.querySelectorAll('#btn-master-import, #btn-master-export').forEach(b => b.disabled = false);
    
    if(error.message && (error.message.includes('401') || error.message.includes('403'))) {
        alert("구글 API 권한이 거부되었습니다.\n\n[해결 방법]\n1. 창을 닫고 로그아웃합니다.\n2. 다시 로그인할 때 뜨는 구글 팝업창에서 모든 접근 권한 체크박스를 반드시 체크해주세요!");
    }
}

async function getOrCreateDedicatedCalendar(token) {
    const listUrl = "https://www.googleapis.com/calendar/v3/users/me/calendarList";
    const data = await googleFetch(listUrl, 'GET', token);
    
    let targetCal = data.items ? data.items.find(cal => cal.summary === 'School Planner V3.4') : null;
    if (targetCal) return targetCal.id;

    let oldCal = data.items ? data.items.find(cal => cal.summary.startsWith('School Planner V3')) : null;
    if (oldCal) {
        try {
            await googleFetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(oldCal.id)}`, 'PUT', token, {
                summary: 'School Planner V3.4',
                description: '업무 및 수업 계획표(웹)에서 동기화된 전용 캘린더입니다.',
                timeZone: 'Asia/Seoul'
            });
        } catch(e) {}
        return oldCal.id;
    }

    const createUrl = "https://www.googleapis.com/calendar/v3/calendars";
    const newCal = await googleFetch(createUrl, 'POST', token, {
        summary: 'School Planner V3.4',
        description: '업무 및 수업 계획표(웹)에서 동기화된 전용 캘린더입니다.',
        timeZone: 'Asia/Seoul'
    });
    return newCal.id;
}

async function syncSingleDateDataToCalendar(token, calId, dateStr, eData, sData, jData, elData, incEvent, incClass, incJournal, incEval, existingEvents = []) {
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

                // 🌟 [핵심 로직] 해당 수업 시간에 등록된 조사표가 있는지 검사하고, 있다면 CSV로 만들어 링크를 붙임
                if (incEval && elData && elData.evalList) {
                    let periodEvals = elData.evalList.filter(e => e.context?.source === 'schedule' && String(e.context?.period) === String(i));
                    for (const ev of periodEvals) {
                        const url = await uploadEvalCSVToStorage(ev);
                        if (url) desc += `\n\n📊 [조사표 첨부파일: ${ev.title}]\n${url}\n`;
                    }
                }

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
        // 🌟 기록 탭(Journal)에 첨부된 조사표가 있다면 마지막에 한꺼번에 링크 추가
        let journalEvalDesc = '';
        if (incEval && elData && elData.evalList) {
            let journalEvals = elData.evalList.filter(e => e.context?.source === 'journal');
            for (const ev of journalEvals) {
                const url = await uploadEvalCSVToStorage(ev);
                if (url) journalEvalDesc += `\n\n📊 [조사표 첨부파일: ${ev.title}]\n${url}\n`;
            }
        }

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
                description: `📝 [전체 기록 내용]\n${j.content}${journalEvalDesc}`,
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
            finalNotes += `\n\n🖼️ [첨부 이미지 링크]\n${memo.imageUrl}`;
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
