// js/modules/sync.js

import { formatDate, getEventLabels, getJournalLabels } from '../core/utils.js'; 
import { parseRawEventTextToEventList } from '../core/eventUtils.js'; 
import { getUserCol, auth, storage, db } from '../firebase.js'; 
import { doc, getDoc, getDocs, query, where, documentId, writeBatch } from "firebase/firestore"; 
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
        throw new Error("공공데이터 API 응답이 JSON 형태가 아닙니다.", { cause: e });
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

// ==============================================================================
// 📤 [내보내기] 웹 화면의 데이터를 구글 캘린더에 저장
// ==============================================================================
export const executeGoogleExport = async function() {
    const token = await window.getValidGoogleToken();
    if (!token) return;

    const startStr = document.getElementById('backup-start-date').value;
    const endStr = document.getElementById('backup-end-date').value;
    const mode = document.querySelector('input[name="import-mode"]:checked').value; 
    
    const syncEvent = document.getElementById('backup-chk-event').checked;
    const syncClass = document.getElementById('backup-chk-class').checked;
    const syncJournal = document.getElementById('backup-chk-journal').checked;
    const syncEval = document.getElementById('backup-chk-eval').checked;
    const syncTasks = document.getElementById('backup-chk-memo').checked;

    if (!syncEvent && !syncClass && !syncJournal && !syncTasks && !syncEval) { alert("동기화할 대상을 선택해 주세요."); return; }
    
    let startD = new Date(startStr); let endD = new Date(endStr);
    if (startD > endD) { alert("시작일이 종료일보다 늦을 수 없습니다."); return; }

    startProgress(`구글 캘린더로 내보내는 중... (${mode === 'merge' ? '병합' : '교체'})`, "#ea4335");

    try {
        if (syncTasks) {
            updateProgress("📝 구글 Tasks 확인 및 정리 중...", 10);
            await syncMemosToGoogleTasks(token);
        }

        if (syncEvent || syncClass || syncJournal || syncEval) {
            updateProgress("🔍 기존 캘린더 일정 딥스캔(Deep Scan) 중...", 20);

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
                finishProgress("🎉 내보낼 데이터가 없습니다!");
                return;
            }

            for (let i = 0; i < total; i++) {
                const item = datesToSync[i];
                updateProgress(`📅 구글 캘린더 반영 중... (${item.dateStr}) [${i+1}/${total}]`, 20 + (80 * ((i+1)/total)));
                await syncSingleDateDataToCalendar(token, calId, item.dateStr, item.eData, item.sData, item.jData, item.elData, syncEvent, syncClass, syncJournal, syncEval, item.gEvents, mode);
            }
        }

        finishProgress("✅ 구글 캘린더 내보내기가 완벽하게 완료되었습니다!");
    } catch (error) {
        handleSyncError(error);
    }
};

// ==============================================================================
// 📥 [가져오기] 구글 캘린더/공휴일 데이터를 웹 화면에 저장
// ==============================================================================
export const executeGoogleImport = async function() {
    const token = await window.getValidGoogleToken();
    if (!token) return;

    const startStr = document.getElementById('backup-start-date').value;
    const endStr = document.getElementById('backup-end-date').value;
    const mode = document.querySelector('input[name="import-mode"]:checked').value;
    
    // 사생활 보호 정책: 개인 기본 캘린더 강제 제외
    const importPrimary = false; 
    const importDedicated = true; // School Planner 전용 캘린더 포함
    const importHoliday = true; // 공휴일 포함
    const holidaySource = 'gov_api'; 

    // 구글 캘린더에서 웹으로 가져올 때, 전용 캘린더의 데이터는 merge일 경우 replace로 작동하여 중복을 방지
    const internalMode = mode === 'merge' ? 'replace' : 'overwrite';
    
    let startD = new Date(startStr); let endD = new Date(endStr);
    if (startD > endD) { alert("시작일이 종료일보다 늦을 수 없습니다."); return; }

    startProgress("구글 캘린더 데이터 가져오기 시작...", "#16a34a");

    try {
        const timeMin = new Date(startStr + 'T00:00:00+09:00').toISOString();
        const timeMax = new Date(endStr + 'T23:59:59+09:00').toISOString();

        let importedEvents = [];
        let importedClasses = [];
        let importedJournals = [];

        const masterEventLabels = getEventLabels();
        const masterJournalLabels = getJournalLabels();

        const holidayLabelObj = masterEventLabels.find(l => l.isSkip) || masterEventLabels.find(l => l.name === '휴일');
        const labelId = holidayLabelObj ? holidayLabelObj.id : '';
        const labelName = holidayLabelObj ? holidayLabelObj.name : '공휴일';

        updateProgress("🏛️ 정부 공식 공휴일 처리 중...", 20);
        
        const savedApiKey = localStorage.getItem('gov_holiday_api_key') || '61eKHEN9Q5rvaYiHWrtSUco3vwTEhoCiF0d8L2Zdu990gANAp3Cnc0yKKgWqOm3s%2F4Mmqa9STa6WvNHboA1RsQ%3D%3D';
        const sYear = startD.getFullYear();
        const eYear = endD.getFullYear();
        let apiSuccess = false;

        for (let y = sYear; y <= eYear; y++) {
            try {
                const govHolidays = await fetchHolidaysFromGovApi(y, savedApiKey);
                if (govHolidays && Object.keys(govHolidays).length > 0) {
                    apiSuccess = true;
                    for (const [dStr, hName] of Object.entries(govHolidays)) {
                        if (dStr >= startStr && dStr <= endStr) {
                            importedEvents.push({ 
                                dateStr: dStr, labelIds: labelId ? [labelId] : [], label: labelName, 
                                labels: [labelName], content: hName, completed: false, source: 'holiday' 
                            });
                        }
                    }
                }
            } catch (err) {
                console.warn(`${y}년 공공데이터 API 가져오기 실패:`, err);
            }
        }

        // 정부 API 실패 시 구글 캘린더 공휴일로 대체
        if (!apiSuccess) {
            alert("⚠️ 정부 공공데이터 서버 응답 실패로 인해, '구글 캘린더 기본 공휴일'로 대체하여 가져옵니다.");
            updateProgress("📅 구글 캘린더 한국 공휴일 읽는 중...", 25);
            const holidayCalId = encodeURIComponent('ko.south_korea#holiday@group.v.calendar.google.com');
            try {
                const resItems = await fetchAllGoogleEvents(token, holidayCalId, timeMin, timeMax);
                if (resItems && resItems.length > 0) {
                    resItems.forEach(ev => {
                        const dateArr = getDatesFromGoogleEvent(ev);
                        dateArr.forEach(dStr => {
                            if (dStr >= startStr && dStr <= endStr) {
                                importedEvents.push({ 
                                    dateStr: dStr, labelIds: labelId ? [labelId] : [], label: labelName, 
                                    labels: [labelName], content: ev.summary, completed: false, source: 'holiday' 
                                });
                            }
                        });
                    });
                }
            } catch (e) {
                console.warn("구글 대체 공휴일 가져오기 실패:", e);
            }
        }

        // 📅 전용 캘린더 가져오기
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
                                    dateStr: dStr, labelIds: mappedLabelIds, label: labelsArray[0], 
                                    labels: labelsArray, content: content, completed: isCompleted, source: 'google_dedicated' 
                                };
                                if (priv.sp_id) newJr.id = priv.sp_id;
                                if (priv.sp_forwardChainId) newJr.forwardChainId = priv.sp_forwardChainId;
                                
                                importedJournals.push(newJr);
                            } else if (type === 'eval') {
                                // 🌟 조사표는 CSV나 구글 시트로 백업 및 복구되므로, 캘린더에서 웹으로 가져올 때 일반 이벤트로 등록되지 않도록 무시합니다.
                            } else { 
                                let labelStr = priv.labelStr || '구글동기화';
                                let content = rawSummary;
                                const match = content.match(/^(?:✅\s*)?\[(.*?)\]\s*([\s\S]*)$/);
                                if (match && !priv.labelStr) {
                                    labelStr = match[1].trim();
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
                                    dateStr: dStr, labelIds: mappedLabelIds, label: labelsArray[0], 
                                    labels: labelsArray, content: content, completed: isCompleted, source: 'google_dedicated' 
                                };
                                if (priv.sp_id) newEv.id = priv.sp_id;
                                importedEvents.push(newEv);
                            }
                        }
                    });
                });
            }
        } catch (e) { console.warn("전용 캘린더 가져오기 실패:", e); }

        updateProgress("💾 앱 데이터베이스에 합치는 중...", 70);
        
        let eventsByDate = {};
        importedEvents.forEach(e => { if (!eventsByDate[e.dateStr]) eventsByDate[e.dateStr] = []; eventsByDate[e.dateStr].push(e); });
        
        let classesByDate = {};
        importedClasses.forEach(c => { if (!classesByDate[c.dateStr]) classesByDate[c.dateStr] = []; classesByDate[c.dateStr].push(c); });
        
        let journalsByDate = {};
        importedJournals.forEach(j => { if (!journalsByDate[j.dateStr]) journalsByDate[j.dateStr] = []; journalsByDate[j.dateStr].push(j); });

        let curD = new Date(startD);
        let processedCount = 0;
        const totalDays = (endD - startD) / (1000 * 60 * 60 * 24) + 1;
        
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

            if (internalMode === 'replace') currentList = currentList.filter(e => e.source !== 'google_primary' && e.source !== 'google_dedicated' && e.source !== 'holiday');
            else if (internalMode === 'overwrite') currentList = [];

            if (newEvents.length > 0 || internalMode === 'replace' || internalMode === 'overwrite') {
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

            if (importDedicated && (newClasses.length > 0 || internalMode === 'overwrite')) {
                const scRef = doc(getUserCol('schedules'), dStr);
                const scSnap = await getDoc(scRef);
                let periods = scSnap.exists() ? (scSnap.data().periods || {}) : {};
                
                if (internalMode === 'overwrite') periods = {};
                
                newClasses.forEach(c => {
                    periods[c.period] = { subject: c.subject, memo: c.memo, supplies: c.supplies };
                });
                
                if (newClasses.length > 0 || internalMode === 'overwrite') {
                    batch.set(scRef, { periods: periods, updatedAt: Date.now() }, { merge: true });
                    batchOpCount++;
                }
            }

            if (importDedicated && (newJournals.length > 0 || internalMode === 'replace' || internalMode === 'overwrite')) {
                const jrRef = doc(getUserCol('journals'), dStr);
                const jrSnap = await getDoc(jrRef);
                let entries = jrSnap.exists() ? (jrSnap.data().entries || []) : [];
                
                if (internalMode === 'replace') entries = entries.filter(j => j.source !== 'google_dedicated');
                else if (internalMode === 'overwrite') entries = [];
                
                if (newJournals.length > 0 || internalMode === 'replace' || internalMode === 'overwrite') {
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
            updateProgress(`💾 데이터베이스 저장 중... [${processedCount}/${totalDays}]`, 70 + (30 * (processedCount/totalDays)));
            curD.setDate(curD.getDate() + 1);
        }
        
        if (batchOpCount > 0) await batch.commit();

        finishProgress("✅ 캘린더 및 공휴일 가져오기가 완료되었습니다!");

    } catch (error) {
        handleSyncError(error);
    }
};

// ==========================================================================
// 🛠️ 내부 코어(Core) 처리 로직들
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
    if (window.ProgressModal) {
        window.ProgressModal.show("구글 캘린더 동기화");
        window.ProgressModal.update(text, 0);
    }
}

function updateProgress(text, percent) {
    if (window.ProgressModal) {
        window.ProgressModal.update(text, percent);
    }
}

function finishProgress(text) {
    if (window.ProgressModal) {
        window.ProgressModal.complete(text, () => {
            if (window.BackupManager && window.BackupManager.modal) window.BackupManager.modal.close();
            if (typeof window.render === 'function') window.render();
        });
    }
}

function handleSyncError(error) {
    console.error("동기화 에러:", error);
    if (window.ProgressModal) {
        window.ProgressModal.error(error.message, () => {
            if(error.message && (error.message.includes('401') || error.message.includes('403'))) {
                alert("구글 API 권한이 거부되었습니다.\n\n[해결 방법]\n1. 창을 닫고 로그아웃합니다.\n2. 다시 로그인할 때 뜨는 구글 팝업창에서 모든 접근 권한 체크박스를 반드시 체크해주세요!");
            }
        });
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
        description: '업무 및 수업 계획표(웹)에서 스마트 동기화된 캘린더입니다.',
        timeZone: 'Asia/Seoul'
    });
    return newCal.id;
}

// 🌟 [핵심 변경] 일정 ➔ 수업 ➔ 기록 ➔ 조사표 순으로 payloadsToCreate 배열에 데이터를 푸시합니다.
async function syncSingleDateDataToCalendar(token, calId, dateStr, eData, sData, jData, elData, incEvent, incClass, incJournal, incEval, existingEvents = [], mode = 'merge') {
    let payloadsToCreate = [];
    
    let d = new Date(dateStr);
    d.setDate(d.getDate() + 1);
    const endStr = formatDate(d);

    let seq = 1; 
    const getInvisiblePrefix = (num) => num.toString(2).padStart(5, '0').replace(/0/g, '\u200C').replace(/1/g, '\u200D');

    const masterEventLabels = getEventLabels();
    const masterJournalLabels = getJournalLabels();

    // 1. 일정(Event)
    if (incEvent && eData) {
        let list = eData.eventList || [];
        if (list.length === 0 && eData.eventText) list = parseRawEventTextToEventList(eData.eventText);

        const validList = list.filter(e => e.content && e.content.trim() !== '' && e.source !== 'google_primary' && e.source !== 'holiday');
        
        validList.forEach(e => {
            let labelNames = [];
            if (e.labelIds && e.labelIds.length > 0) labelNames = e.labelIds.map(id => { const m = masterEventLabels.find(l => l.id === id || l.name === id); return m ? m.name : id; });
            else if (e.labels && e.labels.length > 0) labelNames = e.labels;
            else if (e.label) labelNames = [e.label];
            
            let labelStr = labelNames.length > 0 ? labelNames.join(', ') : '일정';
            let invisiblePrefix = getInvisiblePrefix(seq++);
            const mark = e.completed ? '✅ ' : '';
            
            payloadsToCreate.push({
                summary: `${invisiblePrefix}${mark}[${labelStr}] ${e.content}`,
                description: `📌 (웹사이트에서 스마트하게 관리되는 일정입니다)`,
                start: { date: dateStr }, end: { date: endStr },
                extendedProperties: { private: { 
                    app: 'SchoolPlannerV3', dateStr: dateStr, type: 'event', labelStr: labelStr,
                    completed: e.completed ? 'true' : 'false', sp_id: e.id || '', sp_forwardChainId: e.forwardChainId || ''
                } }
            });
        });
    }

    // 2. 수업(Class)
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
                    start: { date: dateStr }, end: { date: endStr },
                    extendedProperties: { private: { app: 'SchoolPlannerV3', dateStr: dateStr, type: 'class', period: i.toString() } }
                });
            }
        }
    }

    // 3. 기록(Journal)
    if (incJournal && jData && jData.entries) {
        const journals = jData.entries.filter(j => j.content && j.content.trim() !== '');

        journals.forEach(j => {
            let labelNames = [];
            if (j.labelIds && j.labelIds.length > 0) labelNames = j.labelIds.map(id => { const m = masterJournalLabels.find(l => l.id === id || l.name === id); return m ? m.name : id; });
            else if (j.labels && j.labels.length > 0) labelNames = j.labels;
            else if (j.label) labelNames = [j.label];

            let labelStr = labelNames.length > 0 ? labelNames.join(', ') : '기록';
            let invisiblePrefix = getInvisiblePrefix(seq++);
            let displayContent = j.content.length > 25 ? j.content.substring(0, 25) + '...' : j.content;
            const mark = j.completed ? '✅ ' : '';
            
            payloadsToCreate.push({
                summary: `${invisiblePrefix}${mark}[${labelStr}] ${displayContent}`,
                description: `📝 [전체 기록 내용]\n${j.content}`,
                start: { date: dateStr }, end: { date: endStr },
                extendedProperties: { private: { 
                    app: 'SchoolPlannerV3', dateStr: dateStr, type: 'journal', labelStr: labelStr,
                    completed: j.completed ? 'true' : 'false', sp_id: j.id || ''
                } }
            });
        });
    }

    // 🌟 4. 조사표(Evaluation) - 완전히 분리된 캘린더 일정으로 생성!
    if (incEval && elData && elData.evalList) {
        for (const ev of elData.evalList) {
            let invisiblePrefix = getInvisiblePrefix(seq++);
            const url = await uploadEvalCSVToStorage(ev);
            
            let desc = `📊 [조사표 데이터]\n- 대상 명렬표: ${ev.rosterMeta?.year || '?'}학년도 ${ev.rosterMeta?.grade || '?'}학년 ${ev.rosterMeta?.classNum || '?'}반\n`;
            if (url) desc += `- 다운로드 링크: ${url}\n`;
            else desc += `- CSV 파일을 생성하지 못했습니다.\n`;

            payloadsToCreate.push({
                summary: `${invisiblePrefix}[조사표] ${ev.title}`,
                description: desc.trim(),
                start: { date: dateStr }, end: { date: endStr },
                extendedProperties: { private: { 
                    app: 'SchoolPlannerV3', 
                    dateStr: dateStr, 
                    type: 'eval',
                    sp_id: ev.id || ''
                } }
            });
        }
    }

    // 기존 이벤트와 매칭하여 찌꺼기 삭제 및 업데이트 수행
    const managedExistingEvents = existingEvents.filter(ev => {
        const type = ev.extendedProperties?.private?.type || 'event';
        if (type === 'event' && !incEvent) return false; 
        if (type === 'class' && !incClass) return false;
        if (type === 'journal' && !incJournal) return false;
        if (type === 'eval' && !incEval) return false; // 🌟 새로 추가된 eval 타입
        return true;
    });

    let matchedExistingIds = new Set();
    const toCreate = [];

    for (const payload of payloadsToCreate) {
        const pPriv = payload.extendedProperties.private;
        const identityMatchIdx = managedExistingEvents.findIndex(ev => {
            const priv = ev.extendedProperties?.private;
            if (!priv) return false;
            if (priv.type !== pPriv.type) return false;
            if (priv.dateStr !== pPriv.dateStr) return false;
            if (priv.type === 'class') return priv.period === pPriv.period;
            if (priv.sp_id && pPriv.sp_id) return priv.sp_id === pPriv.sp_id;
            return ev.summary === payload.summary;
        });

        if (identityMatchIdx !== -1) {
            const ev = managedExistingEvents[identityMatchIdx];
            matchedExistingIds.add(ev.id);
            if (ev.summary !== payload.summary || ev.description !== payload.description || ev.extendedProperties.private.completed !== pPriv.completed) {
                try {
                    await googleFetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events/${ev.id}`, 'PUT', token, payload);
                } catch(e) { console.warn("일정 업데이트 실패", e); }
            }
        } else {
            try {
                await googleFetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events`, 'POST', token, payload);
                await new Promise(res => setTimeout(res, 50)); 
            } catch(e) { console.warn("일정 생성 실패", e); }
        }
    }

    if (mode === 'overwrite') {
        const eventsToDelete = managedExistingEvents.filter(ev => !matchedExistingIds.has(ev.id));
        for (const ev of eventsToDelete) {
            try {
                await googleFetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events/${ev.id}`, 'DELETE', token);
            } catch(e) {}
        }
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

    const webMemos = await window.dbAPI.loadMemos();
    for (const memo of webMemos) {
        const contentStr = memo.text || ""; 
        let titleSnippet = contentStr ? (contentStr.length > 30 ? contentStr.substring(0, 30) + "..." : contentStr) : "내용 없음";
        
        let labelStr = '일반';
        if (Array.isArray(memo.labels) && memo.labels.length > 0) labelStr = memo.labels.join(', ');
        else if (memo.label) labelStr = memo.label;

        let finalNotes = contentStr;
        if (memo.imageUrl) finalNotes += `\n\n🖼️ [첨부 이미지 링크]\n${memo.imageUrl}`;

        const payload = {
            title: `[${labelStr}] ${titleSnippet}`, 
            notes: finalNotes, 
            status: memo.completed ? 'completed' : 'needsAction'
        };
        await googleFetch(`https://tasks.googleapis.com/tasks/v1/lists/${taskListId}/tasks`, 'POST', token, payload);
        await new Promise(res => setTimeout(res, 20)); 
    }
}

window.openGoogleSyncModal = () => { if (window.BackupManager && window.BackupManager.openModal) window.BackupManager.openModal(); };
window.executeGoogleExport = executeGoogleExport;
window.executeGoogleImport = executeGoogleImport;
window.handleSyncPeriodChange = () => { if(window.BackupManager) window.BackupManager.onPeriodChange(); };
window.fetchHolidaysFromGovApi = fetchHolidaysFromGovApi;
