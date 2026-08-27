// js/modules/syncCalendar.js
import { auth, storage, db } from '../api/firebaseInit.js';
import { getUserCol } from '../api/database.js';
import { doc, getDoc, getDocs, query, where, documentId, writeBatch } from "firebase/firestore"; 
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { googleFetch, fetchAllGoogleEvents, getOrCreateDedicatedCalendar } from '../api/googleApi.js';
import { fetchHolidaysFromGovApi } from '../api/govApi.js';
import { formatDate, getEventLabels, getJournalLabels } from '../core/utils.js';
import { parseRawEventTextToEventList } from '../core/eventManager.js';
import { ProgressModal } from '../ui/progressModal.js';

function getDatesFromGoogleEvent(ev) {
    let dates = [];
    if (ev.start && ev.start.date) { 
        let startD = new Date(ev.start.date);
        let endD = new Date(ev.end.date);
        endD.setDate(endD.getDate() - 1); 
        while (startD <= endD) { dates.push(formatDate(startD)); startD.setDate(startD.getDate() + 1); }
    } else if (ev.start && ev.start.dateTime) dates.push(formatDate(new Date(ev.start.dateTime)));
    return dates;
}

function generateSingleEvalCSV(ev) {
    const escapeCSV = (str) => {
        if (str == null) return "";
        let s = String(str);
        if (s.includes('"') || s.includes(',') || s.includes('\n')) s = '"' + s.replace(/"/g, '""') + '"';
        return s;
    };
    const rows = [ ["상위 항목(조사표 제목)", "", ""], ["조사표 ID (수정금지)", "", ""], ["하위 항목(날짜)", "", ""], ["하위 항목(교시)", "", ""], ["하위 항목(유형)", "", ""], ["하위 항목(교과)", "", ""], ["하위 항목(방식)", "", ""], ["번호", "이름", "성별"] ];
    const isEval = ev.type === 'eval';
    const isIndiv = isEval ? (ev.methodObj ? ev.methodObj.indiv : (ev.method !== 'group')) : false;
    const isGroup = isEval ? (ev.methodObj ? ev.methodObj.group : (ev.method === 'group')) : false;

    let cols = [];
    if (isEval) {
        if (isGroup) cols.push("조이름", "조별결과"); 
        if (isIndiv) cols.push("개별결과"); 
        cols.push("미평가사유(메모)");
    } else if (ev.type === 'check') { cols.push("체크결과", "미평가사유(메모)"); } 
    else { cols.push("메모내용"); }

    const span = cols.length;
    rows[0].push(ev.title || ""); for(let i=1; i<span; i++) rows[0].push("");
    rows[1].push(ev.id || ""); for(let i=1; i<span; i++) rows[1].push("");
    rows[2].push(ev.dateStr || ""); for(let i=1; i<span; i++) rows[2].push("");
    rows[3].push(ev.periodStr ? `${ev.periodStr}교시` : ""); for(let i=1; i<span; i++) rows[3].push("");
    
    const typeStr = ev.type === 'eval' ? '평가' : (ev.type === 'check' ? '체크' : '메모');
    rows[4].push(typeStr); for(let i=1; i<span; i++) rows[4].push("");
    rows[5].push(ev.subject || ""); for(let i=1; i<span; i++) rows[5].push("");
    
    let mArr = []; if(isIndiv) mArr.push("개인"); if(isGroup) mArr.push("조별");
    rows[6].push(mArr.join(', ')); for(let i=1; i<span; i++) rows[6].push("");
    rows[7].push(...cols);

    const students = ev.studentsSnapshot || [];
    students.forEach(st => {
        const sRow = [st.num, st.name, st.gender || ""];
        const rec = ev.records[st.num] || {};
        if (isEval) {
            if (isGroup) { sRow.push(rec.groupName || ""); sRow.push(rec.groupScore || ""); } 
            if (isIndiv) sRow.push(rec.indivScore || rec.score || ""); 
            sRow.push(rec.reason || "");
        } else if (ev.type === 'check') {
            sRow.push((rec.checked === true ? 'O' : (rec.checked === false ? 'X' : '')), rec.reason || "");
        } else sRow.push(rec.memo || "");
        rows.push(sRow);
    });

    return "\uFEFF" + rows.map(row => row.map(v => escapeCSV(v)).join(',')).join('\n');
}

async function uploadEvalCSVToStorage(ev) {
    if (!auth.currentUser) return null;
    try {
        const csvStr = generateSingleEvalCSV(ev);
        const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
        const safeTitle = (ev.title || '조사표').replace(/[^a-zA-Z0-9가-힣_]/g, '_');
        const filePath = `evaluations_csv/${auth.currentUser.uid}/${ev.id}_${safeTitle}.csv`;
        const storageRef = ref(storage, filePath);
        await uploadBytes(storageRef, blob);
        return await getDownloadURL(storageRef);
    } catch(e) { return null; }
}

async function syncSingleDateDataToCalendar(token, calId, dateStr, eData, sData, jData, elData, incEvent, incClass, incJournal, incEval, existingEvents = [], mode = 'merge') {
    let payloadsToCreate = [];
    let d = new Date(dateStr); d.setDate(d.getDate() + 1);
    const endStr = formatDate(d);
    let seq = 1; 
    const getInvisiblePrefix = (num) => num.toString(2).padStart(5, '0').replace(/0/g, '\u200C').replace(/1/g, '\u200D');
    const masterEventLabels = getEventLabels(); const masterJournalLabels = getJournalLabels();

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
            payloadsToCreate.push({
                summary: `${getInvisiblePrefix(seq++)}${e.completed ? '✅ ' : ''}[${labelStr}] ${e.content}`,
                description: `📌 (웹사이트에서 스마트하게 관리되는 일정입니다)`,
                start: { date: dateStr }, end: { date: endStr },
                extendedProperties: { private: { app: 'SchoolPlannerV3', dateStr: dateStr, type: 'event', labelStr: labelStr, completed: e.completed ? 'true' : 'false', sp_id: e.id || '', sp_forwardChainId: e.forwardChainId || '' } }
            });
        });
    }

    if (incClass && sData && sData.periods) {
        const periods = sData.periods; let periodCount = 6; 
        for (let i = 1; i <= periodCount; i++) {
            let p = periods[i];
            if (p && p.subject && p.subject.trim() !== '' && p.subject.toUpperCase() !== 'X') {
                let desc = `🎒 [수업 정보]\n`;
                if (p.memo) desc += `- 수업 메모: ${p.memo}\n`;
                if (p.supplies) desc += `- 비고: ${p.supplies}\n`;
                if (!p.memo && !p.supplies) desc += `- 등록된 내용이 없습니다.\n`;
                
                payloadsToCreate.push({
                    summary: `${getInvisiblePrefix(seq++)}[${i}교시] ${p.subject}`,
                    description: desc.trim(),
                    start: { date: dateStr }, end: { date: endStr },
                    extendedProperties: { private: { app: 'SchoolPlannerV3', dateStr: dateStr, type: 'class', period: i.toString() } }
                });
            }
        }
    }

    if (incJournal && jData && jData.entries) {
        const journals = jData.entries.filter(j => j.content && j.content.trim() !== '');
        journals.forEach(j => {
            let labelNames = [];
            if (j.labelIds && j.labelIds.length > 0) labelNames = j.labelIds.map(id => { const m = masterJournalLabels.find(l => l.id === id || l.name === id); return m ? m.name : id; });
            else if (j.labels && j.labels.length > 0) labelNames = j.labels;
            else if (j.label) labelNames = [j.label];

            let labelStr = labelNames.length > 0 ? labelNames.join(', ') : '기록';
            let displayContent = j.content.length > 25 ? j.content.substring(0, 25) + '...' : j.content;
            
            payloadsToCreate.push({
                summary: `${getInvisiblePrefix(seq++)}${j.completed ? '✅ ' : ''}[${labelStr}] ${displayContent}`,
                description: `📝 [전체 기록 내용]\n${j.content}`,
                start: { date: dateStr }, end: { date: endStr },
                extendedProperties: { private: { app: 'SchoolPlannerV3', dateStr: dateStr, type: 'journal', labelStr: labelStr, completed: j.completed ? 'true' : 'false', sp_id: j.id || '' } }
            });
        });
    }

    if (incEval && elData && elData.evalList) {
        for (const ev of elData.evalList) {
            const url = await uploadEvalCSVToStorage(ev);
            let desc = `📊 [조사표 데이터]\n- 대상 명렬표: ${ev.rosterMeta?.year || '?'}학년도 ${ev.rosterMeta?.grade || '?'}학년 ${ev.rosterMeta?.classNum || '?'}반\n`;
            if (url) desc += `- 다운로드 링크: ${url}\n`; else desc += `- CSV 파일을 생성하지 못했습니다.\n`;
            desc += `\n\n[조사표 원본 데이터 - 시스템용이므로 절대 수정하지 마세요]\nSP_EVAL_DATA_START\n${JSON.stringify(ev)}\nSP_EVAL_DATA_END`;

            payloadsToCreate.push({
                summary: `${getInvisiblePrefix(seq++)}[조사표] ${ev.title}`,
                description: desc.trim(),
                start: { date: dateStr }, end: { date: endStr },
                extendedProperties: { private: { app: 'SchoolPlannerV3', dateStr: dateStr, type: 'eval', sp_id: ev.id || '' } }
            });
        }
    }

    const managedExistingEvents = existingEvents.filter(ev => {
        const type = ev.extendedProperties?.private?.type || 'event';
        if (type === 'event' && !incEvent) return false; 
        if (type === 'class' && !incClass) return false;
        if (type === 'journal' && !incJournal) return false;
        if (type === 'eval' && !incEval) return false;
        return true;
    });

    let matchedExistingIds = new Set();
    for (const payload of payloadsToCreate) {
        const pPriv = payload.extendedProperties.private;
        const identityMatchIdx = managedExistingEvents.findIndex(ev => {
            const priv = ev.extendedProperties?.private;
            if (!priv) return false;
            if (priv.type !== pPriv.type) return false;
            if (priv.dateStr !== pPriv.dateStr) return false;
            if (priv.type === 'class') return priv.period === pPriv.period;
            if (priv.sp_id && pPriv.sp_id) return priv.sp_id === pPriv.sp_id;
            const cleanEvSummary = (ev.summary || '').replace(/^[\u200C\u200D]+/, '').replace(/^✅\s*/, '').trim();
            const cleanPayloadSummary = (payload.summary || '').replace(/^[\u200C\u200D]+/, '').replace(/^✅\s*/, '').trim();
            return cleanEvSummary === cleanPayloadSummary;
        });

        if (identityMatchIdx !== -1) {
            const ev = managedExistingEvents[identityMatchIdx];
            matchedExistingIds.add(ev.id);
            if (ev.summary !== payload.summary || ev.description !== payload.description || ev.extendedProperties.private.completed !== pPriv.completed) {
                try { await googleFetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events/${ev.id}`, 'PUT', token, payload); } catch(e) { }
            }
        } else {
            try {
                await googleFetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events`, 'POST', token, payload);
                await new Promise(res => setTimeout(res, 50)); 
            } catch(e) {}
        }
    }

    if (mode === 'overwrite') {
        const eventsToDelete = managedExistingEvents.filter(ev => !matchedExistingIds.has(ev.id));
        for (const ev of eventsToDelete) {
            try { await googleFetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events/${ev.id}`, 'DELETE', token); } catch(e) {}
        }
    }
}

export async function exportCalendarData(token, startStr, endStr, mode, options) {
    const { syncEvent, syncClass, syncJournal, syncEval } = options;
    const calId = await getOrCreateDedicatedCalendar(token);
    const timeMin = new Date(startStr + 'T00:00:00+09:00').toISOString();
    const timeMax = new Date(endStr + 'T23:59:59+09:00').toISOString();

    const existingGoogleEvents = await fetchAllGoogleEvents(token, calId, timeMin, timeMax, { privateExtendedProperty: 'app=SchoolPlannerV3' });
    const googleEventsByDate = {};
    existingGoogleEvents.forEach(ev => {
        const dStr = ev.extendedProperties?.private?.dateStr;
        if (dStr) { if (!googleEventsByDate[dStr]) googleEventsByDate[dStr] = []; googleEventsByDate[dStr].push(ev); }
    });

    const [eSnap, sSnap, jSnap, elSnap] = await Promise.all([
        syncEvent ? getDocs(query(getUserCol('events'), where(documentId(), '>=', startStr), where(documentId(), '<=', endStr))) : Promise.resolve(null),
        syncClass ? getDocs(query(getUserCol('schedules'), where(documentId(), '>=', startStr), where(documentId(), '<=', endStr))) : Promise.resolve(null),
        syncJournal ? getDocs(query(getUserCol('journals'), where(documentId(), '>=', startStr), where(documentId(), '<=', endStr))) : Promise.resolve(null),
        syncEval ? getDocs(query(getUserCol('evaluations'), where(documentId(), '>=', startStr), where(documentId(), '<=', endStr))) : Promise.resolve(null)
    ]);

    const eMap = {}; if (eSnap) eSnap.forEach(d => eMap[d.id] = d.data());
    const sMap = {}; if (sSnap) sSnap.forEach(d => sMap[d.id] = d.data());
    const jMap = {}; if (jSnap) jSnap.forEach(d => jMap[d.id] = d.data());
    const elMap = {}; if (elSnap) elSnap.forEach(d => elMap[d.id] = d.data());

    let datesToSync = []; let curD = new Date(startStr); const endD = new Date(endStr);
    while (curD <= endD) {
        const dStr = formatDate(curD);
        const gEvents = googleEventsByDate[dStr] || [];
        if (eMap[dStr] || sMap[dStr] || jMap[dStr] || elMap[dStr] || gEvents.length > 0) {
            datesToSync.push({ dateStr: dStr, eData: eMap[dStr], sData: sMap[dStr], jData: jMap[dStr], elData: elMap[dStr], gEvents });
        }
        curD.setDate(curD.getDate() + 1);
    }

    const total = datesToSync.length;
    if (total === 0) return;

    for (let i = 0; i < total; i++) {
        const item = datesToSync[i];
        ProgressModal.update(`📅 구글 캘린더 반영 중... (${item.dateStr}) [${i+1}/${total}]`, 20 + (80 * ((i+1)/total)));
        await syncSingleDateDataToCalendar(token, calId, item.dateStr, item.eData, item.sData, item.jData, item.elData, syncEvent, syncClass, syncJournal, syncEval, item.gEvents, mode);
    }
}

export async function importCalendarData(token, startStr, endStr, internalMode, options) {
    const { syncEvent, syncClass, syncJournal, syncEval } = options;
    const timeMin = new Date(startStr + 'T00:00:00+09:00').toISOString();
    const timeMax = new Date(endStr + 'T23:59:59+09:00').toISOString();
    
    let importedEvents = []; let importedClasses = []; let importedJournals = []; let importedEvals = [];
    const masterEventLabels = getEventLabels(); const masterJournalLabels = getJournalLabels();
    const holidayLabelObj = masterEventLabels.find(l => l.isSkip) || masterEventLabels.find(l => l.name === '휴일');
    const labelId = holidayLabelObj ? holidayLabelObj.id : '';
    const labelName = holidayLabelObj ? holidayLabelObj.name : '공휴일';

    ProgressModal.update("🏛️ 정부 공식 공휴일 처리 중...", 20);
    const savedApiKey = localStorage.getItem('gov_holiday_api_key') || '61eKHEN9Q5rvaYiHWrtSUco3vwTEhoCiF0d8L2Zdu990gANAp3Cnc0yKKgWqOm3s%2F4Mmqa9STa6WvNHboA1RsQ%3D%3D';
    let apiSuccess = false;
    for (let y = new Date(startStr).getFullYear(); y <= new Date(endStr).getFullYear(); y++) {
        try {
            const govHolidays = await fetchHolidaysFromGovApi(y, savedApiKey);
            if (govHolidays && Object.keys(govHolidays).length > 0) {
                apiSuccess = true;
                for (const [dStr, hName] of Object.entries(govHolidays)) {
                    if (dStr >= startStr && dStr <= endStr) {
                        importedEvents.push({ dateStr: dStr, labelIds: labelId ? [labelId] : [], label: labelName, labels: [labelName], content: hName, completed: false, source: 'holiday' });
                    }
                }
            }
        } catch (err) {}
    }

    if (!apiSuccess) {
        ProgressModal.update("📅 구글 캘린더 한국 공휴일 읽는 중...", 25);
        try {
            const holidayCalId = encodeURIComponent('ko.south_korea#holiday@group.v.calendar.google.com');
            const resItems = await fetchAllGoogleEvents(token, holidayCalId, timeMin, timeMax);
            if (resItems && resItems.length > 0) {
                resItems.forEach(ev => {
                    getDatesFromGoogleEvent(ev).forEach(dStr => {
                        if (dStr >= startStr && dStr <= endStr) {
                            importedEvents.push({ dateStr: dStr, labelIds: labelId ? [labelId] : [], label: labelName, labels: [labelName], content: ev.summary, completed: false, source: 'holiday' });
                        }
                    });
                });
            }
        } catch (e) {}
    }

    ProgressModal.update("📅 'School Planner' 전용 캘린더 복원 중...", 40);
    try {
        const calId = await getOrCreateDedicatedCalendar(token);
        const resItems = await fetchAllGoogleEvents(token, calId, timeMin, timeMax);
        if (resItems && resItems.length > 0) {
            resItems.forEach(ev => {
                const priv = ev.extendedProperties?.private || {};
                const type = priv.type || 'event'; const isCompleted = priv.completed === 'true'; 
                getDatesFromGoogleEvent(ev).forEach(dStr => {
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
                            if (match && !priv.labelStr) { labelStr = match[1].trim(); content = match[2].trim(); } 
                            else if (priv.labelStr && match && match[1].trim() === priv.labelStr) content = match[2].trim();
                            
                            let labelsArray = labelStr.split(',').map(s => s.trim()).filter(Boolean);
                            if(labelsArray.length === 0) labelsArray = ['기록'];
                            let mappedLabelIds = [];
                            labelsArray.forEach(lbl => { const found = masterJournalLabels.find(m => m.name === lbl); if (found) mappedLabelIds.push(found.id); });

                            let newJr = { dateStr: dStr, labelIds: mappedLabelIds, label: labelsArray[0], labels: labelsArray, content: content, completed: isCompleted, source: 'google_dedicated' };
                            if (priv.sp_id) newJr.id = priv.sp_id; else newJr.id = ev.id; 
                            if (priv.sp_forwardChainId) newJr.forwardChainId = priv.sp_forwardChainId;
                            importedJournals.push(newJr);
                        } else if (type === 'eval') {
                            const evalMatch = rawDesc.match(/SP_EVAL_DATA_START\n([\s\S]*?)\nSP_EVAL_DATA_END/);
                            if (evalMatch) { try { importedEvals.push(JSON.parse(evalMatch[1].trim())); } catch(err) {} }
                        } else { 
                            let labelStr = priv.labelStr || '구글동기화';
                            let content = rawSummary;
                            const match = content.match(/^(?:✅\s*)?\[(.*?)\]\s*([\s\S]*)$/);
                            if (match && !priv.labelStr) { labelStr = match[1].trim(); content = match[2].trim(); } 
                            else if (priv.labelStr && match && match[1].trim() === priv.labelStr) content = match[2].trim();
                            
                            let labelsArray = labelStr.split(',').map(s => s.trim()).filter(Boolean);
                            if(labelsArray.length === 0) labelsArray = ['구글동기화'];

                            let mappedLabelIds = [];
                            labelsArray.forEach(lbl => { const found = masterEventLabels.find(m => m.name === lbl); if (found) mappedLabelIds.push(found.id); });

                            let newEv = { dateStr: dStr, labelIds: mappedLabelIds, label: labelsArray[0], labels: labelsArray, content: content, completed: isCompleted, source: 'google_dedicated' };
                            if (priv.sp_id) newEv.id = priv.sp_id; else newEv.id = ev.id;
                            if (priv.sp_forwardChainId) newEv.forwardChainId = priv.sp_forwardChainId;
                            importedEvents.push(newEv);
                        }
                    }
                });
            });
        }
    } catch (e) { }

    ProgressModal.update("💾 앱 데이터베이스에 합치는 중...", 70);
    
    let eventsByDate = {}; importedEvents.forEach(e => { if (!eventsByDate[e.dateStr]) eventsByDate[e.dateStr] = []; eventsByDate[e.dateStr].push(e); });
    let classesByDate = {}; importedClasses.forEach(c => { if (!classesByDate[c.dateStr]) classesByDate[c.dateStr] = []; classesByDate[c.dateStr].push(c); });
    let journalsByDate = {}; importedJournals.forEach(j => { if (!journalsByDate[j.dateStr]) journalsByDate[j.dateStr] = []; journalsByDate[j.dateStr].push(j); });
    let evalsByDate = {}; importedEvals.forEach(ev => { if (!evalsByDate[ev.dateStr]) evalsByDate[ev.dateStr] = []; evalsByDate[ev.dateStr].push(ev); });

    let curD = new Date(startStr);
    let processedCount = 0; const totalDays = (new Date(endStr) - curD) / (1000 * 60 * 60 * 24) + 1;
    let batch = writeBatch(db); let batchOpCount = 0;

    const getUniqueList = (list) => {
        const merged = [];
        for (const item of list) {
            const lblStr = (item.labels || []).join(',');
            let existing = null;
            if (item.id) existing = merged.find(e => e.id === item.id);
            if (!existing && item.forwardChainId) existing = merged.find(e => e.forwardChainId === item.forwardChainId && e.content === item.content);
            if (!existing) existing = merged.find(e => e.content === item.content && (e.labels || []).join(',') === lblStr && (!e.id || !item.id)); 
            
            if (existing) {
                existing.completed = item.completed; existing.source = item.source || existing.source;
                if (!existing.id && item.id) existing.id = item.id;
                if (!existing.forwardChainId && item.forwardChainId) existing.forwardChainId = item.forwardChainId;
                if (!existing.groupId && item.groupId) existing.groupId = item.groupId;
                if (!existing.originalDate && item.originalDate) existing.originalDate = item.originalDate;
            } else merged.push({ ...item }); 
        }
        return merged; 
    };

    while (curD <= new Date(endStr)) {
        const dStr = formatDate(curD);
        const newEvents = eventsByDate[dStr] || []; const newClasses = classesByDate[dStr] || [];
        const newJournals = journalsByDate[dStr] || []; const newEvals = evalsByDate[dStr] || [];
        
        const evRef = doc(getUserCol('events'), dStr); const evSnap = await getDoc(evRef);
        let currentList = [];
        if (evSnap.exists()) {
            const data = evSnap.data(); currentList = data.eventList || [];
            if (currentList.length === 0 && data.eventText) currentList = parseRawEventTextToEventList(data.eventText);
        }

        if (internalMode === 'replace') currentList = currentList.filter(e => e.source !== 'google_primary' && e.source !== 'google_dedicated' && e.source !== 'holiday');
        else if (internalMode === 'overwrite') currentList = [];

        if ((syncEvent && newEvents.length > 0) || internalMode === 'replace' || internalMode === 'overwrite') {
            if(syncEvent || internalMode === 'overwrite') {
                const mergedList = getUniqueList([...currentList, ...newEvents]); 
                batch.set(evRef, { eventList: mergedList, eventText: window.formatEventListToText ? window.formatEventListToText(mergedList) : '', updatedAt: Date.now() }); 
                batchOpCount++;

                let isSkipDay = mergedList.some(e => e.source === 'holiday' || (e.labelIds && e.labelIds.some(id => { const m = masterEventLabels.find(l => l.id === id); return m && m.isSkip; })));
                if (isSkipDay && syncClass) {
                    const scRef = doc(getUserCol('schedules'), dStr); const scSnap = await getDoc(scRef);
                    if (scSnap.exists()) {
                        let periods = scSnap.data().periods || {}; let scheduleChanged = false;
                        for (let p in periods) { if (periods[p].subject && periods[p].subject.trim() !== '') { periods[p].subject = ''; scheduleChanged = true; } }
                        if (scheduleChanged) { batch.set(scRef, { periods: periods, updatedAt: Date.now() }, { merge: true }); batchOpCount++; }
                    }
                }
            }
        }

        if ((syncClass && newClasses.length > 0) || (syncClass && internalMode === 'overwrite')) {
            const scRef = doc(getUserCol('schedules'), dStr); const scSnap = await getDoc(scRef);
            let periods = scSnap.exists() ? (scSnap.data().periods || {}) : {};
            if (internalMode === 'overwrite') periods = {};
            newClasses.forEach(c => { periods[c.period] = { subject: c.subject, memo: c.memo, supplies: c.supplies }; });
            if (newClasses.length > 0 || internalMode === 'overwrite') { batch.set(scRef, { periods: periods, updatedAt: Date.now() }); batchOpCount++; }
        }

        if ((syncJournal && newJournals.length > 0) || (syncJournal && (internalMode === 'replace' || internalMode === 'overwrite'))) {
            const jrRef = doc(getUserCol('journals'), dStr); const jrSnap = await getDoc(jrRef);
            let entries = jrSnap.exists() ? (jrSnap.data().entries || []) : [];
            if (internalMode === 'replace') entries = entries.filter(j => j.source !== 'google_dedicated');
            else if (internalMode === 'overwrite') entries = [];
            if (newJournals.length > 0 || internalMode === 'replace' || internalMode === 'overwrite') {
                const mergedEntries = getUniqueList([...entries, ...newJournals]); 
                batch.set(jrRef, { entries: mergedEntries, updatedAt: Date.now() }); batchOpCount++;
            }
        }

        if ((syncEval && newEvals.length > 0) || (syncEval && internalMode === 'overwrite')) {
            const elRef = doc(getUserCol('evaluations'), dStr); const elSnap = await getDoc(elRef);
            let currentEvals = elSnap.exists() ? (elSnap.data().evalList || []) : [];
            if (internalMode === 'overwrite') currentEvals = [];
            if (newEvals.length > 0 || internalMode === 'overwrite') {
                const combined = [...currentEvals];
                newEvals.forEach(newItem => {
                    const idx = combined.findIndex(old => old.id === newItem.id);
                    if (idx !== -1) combined[idx] = newItem; else combined.push(newItem);
                });
                batch.set(elRef, { evalList: combined, updatedAt: Date.now() }); batchOpCount++;
            }
        }

        if (batchOpCount >= 400) { await batch.commit(); batch = writeBatch(db); batchOpCount = 0; }
        processedCount++; ProgressModal.update(`💾 데이터베이스 저장 중... [${processedCount}/${totalDays}]`, 70 + (30 * (processedCount/totalDays)));
        curD.setDate(curD.getDate() + 1);
    }
    
    if (batchOpCount > 0) await batch.commit();
}