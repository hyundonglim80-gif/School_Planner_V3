<<<<<<< HEAD
// js/modules/syncCalendar.js
import { auth, db } from '../api/firebaseInit.js';
import { getUserCol } from '../api/database.js';
import { doc, getDoc, getDocs, query, where, documentId, writeBatch } from "firebase/firestore"; 
import { googleFetch, fetchAllGoogleEvents } from '../api/googleApi.js';
import { formatDate, getEventLabels, getJournalLabels } from '../core/utils.js';
import { parseRawEventTextToEventList } from '../core/eventManager.js';
import { ProgressModal } from '../ui/progressModal.js';
import { store } from '../core/store.js'; // 사용자가 설정한 교시명을 가져오기 위해 추가

// 용도별 캘린더를 찾거나 생성하는 함수
async function getOrCreateCalendarByName(token, summary) {
    const listData = await googleFetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', 'GET', token);
    const existing = (listData.items || []).find(c => c.summary === summary);
    if (existing) return existing.id;
    const createData = await googleFetch('https://www.googleapis.com/calendar/v3/calendars', 'POST', token, { summary });
    return createData.id;
}

// 헬퍼: 특정 캘린더에 페이로드 목록을 비교 후 전송
async function processPayloadsForCalendar(token, calId, payloads, existingEvents, mode) {
    if (!calId) return;
    let matchedExistingIds = new Set();
    
    for (const payload of payloads) {
        const pPriv = payload.extendedProperties.private;
        const identityMatchIdx = existingEvents.findIndex(ev => {
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
            const ev = existingEvents[identityMatchIdx];
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
        const eventsToDelete = existingEvents.filter(ev => !matchedExistingIds.has(ev.id));
        for (const ev of eventsToDelete) {
            try { await googleFetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events/${ev.id}`, 'DELETE', token); } catch(e) {}
        }
    }
}

async function syncSingleDateDataToCalendar(token, calIds, dateStr, eData, sData, jData, incEvent, incClass, incJournal, existingEventsByCal, mode = 'merge') {
    let workPayloads = [];
    let classPayloads = [];
    let commentaryPayloads = [];
    
    let d = new Date(dateStr); d.setDate(d.getDate() + 1);
    const endStr = formatDate(d);
    let seq = 1; 
    const getInvisiblePrefix = (num) => num.toString(2).padStart(5, '0').replace(/0/g, '\u200C').replace(/1/g, '\u200D');
    const masterEventLabels = getEventLabels(); const masterJournalLabels = getJournalLabels();

    // 1. 일정 -> SP(work)
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
            workPayloads.push({
                summary: `${getInvisiblePrefix(seq++)}${e.completed ? '✅ ' : ''}[${labelStr}] ${e.content}`,
                description: `📌 (웹사이트에서 스마트하게 관리되는 일정입니다)`,
                start: { date: dateStr }, end: { date: endStr },
                extendedProperties: { private: { app: 'SchoolPlannerV3', dateStr: dateStr, type: 'event', labelStr: labelStr, completed: e.completed ? 'true' : 'false', sp_id: e.id || '', sp_forwardChainId: e.forwardChainId || '' } }
            });
        });
    }

    // 2. 수업 -> SP(class) : 메모, 비고, 조사표 제거 & 커스텀 교시명 사용
    if (incClass && sData && sData.periods) {
        const periods = sData.periods; 
        const maxPeriod = store.periodNames ? store.periodNames.length : 6; 
        for (let i = 1; i <= maxPeriod; i++) {
            let p = periods[i];
            if (p && p.subject && p.subject.trim() !== '' && p.subject.toUpperCase() !== 'X') {
                const periodName = store.periodNames && store.periodNames[i - 1] ? store.periodNames[i - 1] : `${i}교시`;
                classPayloads.push({
                    summary: `${getInvisiblePrefix(seq++)}[${periodName}] ${p.subject}`,
                    description: `🎒 [수업]`,
                    start: { date: dateStr }, end: { date: endStr },
                    extendedProperties: { private: { app: 'SchoolPlannerV3', dateStr: dateStr, type: 'class', period: i.toString() } }
                });
            }
        }
    }

    // 3. 기록 -> SP(commentary)
    if (incJournal && jData && jData.entries) {
        const journals = jData.entries.filter(j => j.content && j.content.trim() !== '');
        journals.forEach(j => {
            let labelNames = [];
            if (j.labelIds && j.labelIds.length > 0) labelNames = j.labelIds.map(id => { const m = masterJournalLabels.find(l => l.id === id || l.name === id); return m ? m.name : id; });
            else if (j.labels && j.labels.length > 0) labelNames = j.labels;
            else if (j.label) labelNames = [j.label];

            let labelStr = labelNames.length > 0 ? labelNames.join(', ') : '기록';
            let displayContent = j.content.length > 25 ? j.content.substring(0, 25) + '...' : j.content;
            
            commentaryPayloads.push({
                summary: `${getInvisiblePrefix(seq++)}${j.completed ? '✅ ' : ''}[${labelStr}] ${displayContent}`,
                description: `📝 [전체 기록 내용]\n${j.content}`,
                start: { date: dateStr }, end: { date: endStr },
                extendedProperties: { private: { app: 'SchoolPlannerV3', dateStr: dateStr, type: 'journal', labelStr: labelStr, completed: j.completed ? 'true' : 'false', sp_id: j.id || '' } }
            });
        });
    }

    // 각각의 캘린더로 처리
    if (incEvent) await processPayloadsForCalendar(token, calIds.work, workPayloads, existingEventsByCal.work, mode);
    if (incClass) await processPayloadsForCalendar(token, calIds.class, classPayloads, existingEventsByCal.class, mode);
    if (incJournal) await processPayloadsForCalendar(token, calIds.commentary, commentaryPayloads, existingEventsByCal.commentary, mode);
}

export async function exportCalendarData(token, startStr, endStr, mode, options) {
    const { syncEvent, syncClass, syncJournal } = options;
    const timeMin = new Date(startStr + 'T00:00:00+09:00').toISOString();
    const timeMax = new Date(endStr + 'T23:59:59+09:00').toISOString();

    const calIds = {};
    if (syncEvent) calIds.work = await getOrCreateCalendarByName(token, 'SP(work)');
    if (syncClass) calIds.class = await getOrCreateCalendarByName(token, 'SP(class)');
    if (syncJournal) calIds.commentary = await getOrCreateCalendarByName(token, 'SP(commentary)');

    const existingEventsByCal = { work: {}, class: {}, commentary: {} };
    const fetchExisting = async (calId, targetMap) => {
        if (!calId) return;
        const evs = await fetchAllGoogleEvents(token, calId, timeMin, timeMax, { privateExtendedProperty: 'app=SchoolPlannerV3' });
        evs.forEach(ev => {
            const dStr = ev.extendedProperties?.private?.dateStr;
            if (dStr) { if (!targetMap[dStr]) targetMap[dStr] = []; targetMap[dStr].push(ev); }
        });
    };

    await Promise.all([
        fetchExisting(calIds.work, existingEventsByCal.work),
        fetchExisting(calIds.class, existingEventsByCal.class),
        fetchExisting(calIds.commentary, existingEventsByCal.commentary)
    ]);

    const [eSnap, sSnap, jSnap] = await Promise.all([
        syncEvent ? getDocs(query(getUserCol('events'), where(documentId(), '>=', startStr), where(documentId(), '<=', endStr))) : Promise.resolve(null),
        syncClass ? getDocs(query(getUserCol('schedules'), where(documentId(), '>=', startStr), where(documentId(), '<=', endStr))) : Promise.resolve(null),
        syncJournal ? getDocs(query(getUserCol('journals'), where(documentId(), '>=', startStr), where(documentId(), '<=', endStr))) : Promise.resolve(null)
    ]);

    const eMap = {}; if (eSnap) eSnap.forEach(d => eMap[d.id] = d.data());
    const sMap = {}; if (sSnap) sSnap.forEach(d => sMap[d.id] = d.data());
    const jMap = {}; if (jSnap) jSnap.forEach(d => jMap[d.id] = d.data());

    let datesToSync = []; let curD = new Date(startStr); const endD = new Date(endStr);
    while (curD <= endD) {
        const dStr = formatDate(curD);
        const gEventsForDate = {
            work: existingEventsByCal.work[dStr] || [],
            class: existingEventsByCal.class[dStr] || [],
            commentary: existingEventsByCal.commentary[dStr] || []
        };

        if (eMap[dStr] || sMap[dStr] || jMap[dStr] || gEventsForDate.work.length > 0 || gEventsForDate.class.length > 0 || gEventsForDate.commentary.length > 0) {
            datesToSync.push({ dateStr: dStr, eData: eMap[dStr], sData: sMap[dStr], jData: jMap[dStr], existingEventsByCal: gEventsForDate });
        }
        curD.setDate(curD.getDate() + 1);
    }

    const total = datesToSync.length;
    if (total === 0) return;

    for (let i = 0; i < total; i++) {
        const item = datesToSync[i];
        ProgressModal.update(`📅 구글 캘린더 반영 중... (${item.dateStr}) [${i+1}/${total}]`, 20 + (80 * ((i+1)/total)));
        await syncSingleDateDataToCalendar(token, calIds, item.dateStr, item.eData, item.sData, item.jData, syncEvent, syncClass, syncJournal, item.existingEventsByCal, mode);
    }
}

// 가져오기 더미 함수(단방향으로 변경되어 UI 알림용으로만 처리됨)
=======
// js/modules/syncCalendar.js
import { auth, db } from '../api/firebaseInit.js';
import { getUserCol } from '../api/database.js';
import { doc, getDoc, getDocs, query, where, documentId, writeBatch } from "firebase/firestore"; 
import { googleFetch, fetchAllGoogleEvents } from '../api/googleApi.js';
import { formatDate, getEventLabels, getJournalLabels } from '../core/utils.js';
import { parseRawEventTextToEventList } from '../core/eventManager.js';
import { ProgressModal } from '../ui/progressModal.js';
import { store } from '../core/store.js'; // 사용자가 설정한 교시명을 가져오기 위해 추가

// 용도별 캘린더를 찾거나 생성하는 함수
async function getOrCreateCalendarByName(token, summary) {
    const listData = await googleFetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', 'GET', token);
    const existing = (listData.items || []).find(c => c.summary === summary);
    if (existing) return existing.id;
    const createData = await googleFetch('https://www.googleapis.com/calendar/v3/calendars', 'POST', token, { summary });
    return createData.id;
}

// 헬퍼: 특정 캘린더에 페이로드 목록을 비교 후 전송
async function processPayloadsForCalendar(token, calId, payloads, existingEvents, mode) {
    if (!calId) return;
    let matchedExistingIds = new Set();
    
    for (const payload of payloads) {
        const pPriv = payload.extendedProperties.private;
        const identityMatchIdx = existingEvents.findIndex(ev => {
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
            const ev = existingEvents[identityMatchIdx];
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
        const eventsToDelete = existingEvents.filter(ev => !matchedExistingIds.has(ev.id));
        for (const ev of eventsToDelete) {
            try { await googleFetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events/${ev.id}`, 'DELETE', token); } catch(e) {}
        }
    }
}

async function syncSingleDateDataToCalendar(token, calIds, dateStr, eData, sData, jData, incEvent, incClass, incJournal, existingEventsByCal, mode = 'merge') {
    let workPayloads = [];
    let classPayloads = [];
    let commentaryPayloads = [];
    
    let d = new Date(dateStr); d.setDate(d.getDate() + 1);
    const endStr = formatDate(d);
    let seq = 1; 
    const getInvisiblePrefix = (num) => num.toString(2).padStart(5, '0').replace(/0/g, '\u200C').replace(/1/g, '\u200D');
    const masterEventLabels = getEventLabels(); const masterJournalLabels = getJournalLabels();

    // 1. 일정 -> SP(work)
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
            workPayloads.push({
                summary: `${getInvisiblePrefix(seq++)}${e.completed ? '✅ ' : ''}[${labelStr}] ${e.content}`,
                description: `📌 (웹사이트에서 스마트하게 관리되는 일정입니다)`,
                start: { date: dateStr }, end: { date: endStr },
                extendedProperties: { private: { app: 'SchoolPlannerV3', dateStr: dateStr, type: 'event', labelStr: labelStr, completed: e.completed ? 'true' : 'false', sp_id: e.id || '', sp_forwardChainId: e.forwardChainId || '' } }
            });
        });
    }

    // 2. 수업 -> SP(class) : 메모, 비고, 조사표 제거 & 커스텀 교시명 사용
    if (incClass && sData && sData.periods) {
        const periods = sData.periods; 
        const maxPeriod = store.periodNames ? store.periodNames.length : 6; 
        for (let i = 1; i <= maxPeriod; i++) {
            let p = periods[i];
            if (p && p.subject && p.subject.trim() !== '' && p.subject.toUpperCase() !== 'X') {
                const periodName = store.periodNames && store.periodNames[i - 1] ? store.periodNames[i - 1] : `${i}교시`;
                classPayloads.push({
                    summary: `${getInvisiblePrefix(seq++)}[${periodName}] ${p.subject}`,
                    description: `🎒 [수업]`,
                    start: { date: dateStr }, end: { date: endStr },
                    extendedProperties: { private: { app: 'SchoolPlannerV3', dateStr: dateStr, type: 'class', period: i.toString() } }
                });
            }
        }
    }

    // 3. 기록 -> SP(commentary)
    if (incJournal && jData && jData.entries) {
        const journals = jData.entries.filter(j => j.content && j.content.trim() !== '');
        journals.forEach(j => {
            let labelNames = [];
            if (j.labelIds && j.labelIds.length > 0) labelNames = j.labelIds.map(id => { const m = masterJournalLabels.find(l => l.id === id || l.name === id); return m ? m.name : id; });
            else if (j.labels && j.labels.length > 0) labelNames = j.labels;
            else if (j.label) labelNames = [j.label];

            let labelStr = labelNames.length > 0 ? labelNames.join(', ') : '기록';
            let displayContent = j.content.length > 25 ? j.content.substring(0, 25) + '...' : j.content;
            
            commentaryPayloads.push({
                summary: `${getInvisiblePrefix(seq++)}${j.completed ? '✅ ' : ''}[${labelStr}] ${displayContent}`,
                description: `📝 [전체 기록 내용]\n${j.content}`,
                start: { date: dateStr }, end: { date: endStr },
                extendedProperties: { private: { app: 'SchoolPlannerV3', dateStr: dateStr, type: 'journal', labelStr: labelStr, completed: j.completed ? 'true' : 'false', sp_id: j.id || '' } }
            });
        });
    }

    // 각각의 캘린더로 처리
    if (incEvent) await processPayloadsForCalendar(token, calIds.work, workPayloads, existingEventsByCal.work, mode);
    if (incClass) await processPayloadsForCalendar(token, calIds.class, classPayloads, existingEventsByCal.class, mode);
    if (incJournal) await processPayloadsForCalendar(token, calIds.commentary, commentaryPayloads, existingEventsByCal.commentary, mode);
}

export async function exportCalendarData(token, startStr, endStr, mode, options) {
    const { syncEvent, syncClass, syncJournal } = options;
    const timeMin = new Date(startStr + 'T00:00:00+09:00').toISOString();
    const timeMax = new Date(endStr + 'T23:59:59+09:00').toISOString();

    const calIds = {};
    if (syncEvent) calIds.work = await getOrCreateCalendarByName(token, 'SP(work)');
    if (syncClass) calIds.class = await getOrCreateCalendarByName(token, 'SP(class)');
    if (syncJournal) calIds.commentary = await getOrCreateCalendarByName(token, 'SP(commentary)');

    const existingEventsByCal = { work: {}, class: {}, commentary: {} };
    const fetchExisting = async (calId, targetMap) => {
        if (!calId) return;
        const evs = await fetchAllGoogleEvents(token, calId, timeMin, timeMax, { privateExtendedProperty: 'app=SchoolPlannerV3' });
        evs.forEach(ev => {
            const dStr = ev.extendedProperties?.private?.dateStr;
            if (dStr) { if (!targetMap[dStr]) targetMap[dStr] = []; targetMap[dStr].push(ev); }
        });
    };

    await Promise.all([
        fetchExisting(calIds.work, existingEventsByCal.work),
        fetchExisting(calIds.class, existingEventsByCal.class),
        fetchExisting(calIds.commentary, existingEventsByCal.commentary)
    ]);

    const [eSnap, sSnap, jSnap] = await Promise.all([
        syncEvent ? getDocs(query(getUserCol('events'), where(documentId(), '>=', startStr), where(documentId(), '<=', endStr))) : Promise.resolve(null),
        syncClass ? getDocs(query(getUserCol('schedules'), where(documentId(), '>=', startStr), where(documentId(), '<=', endStr))) : Promise.resolve(null),
        syncJournal ? getDocs(query(getUserCol('journals'), where(documentId(), '>=', startStr), where(documentId(), '<=', endStr))) : Promise.resolve(null)
    ]);

    const eMap = {}; if (eSnap) eSnap.forEach(d => eMap[d.id] = d.data());
    const sMap = {}; if (sSnap) sSnap.forEach(d => sMap[d.id] = d.data());
    const jMap = {}; if (jSnap) jSnap.forEach(d => jMap[d.id] = d.data());

    let datesToSync = []; let curD = new Date(startStr); const endD = new Date(endStr);
    while (curD <= endD) {
        const dStr = formatDate(curD);
        const gEventsForDate = {
            work: existingEventsByCal.work[dStr] || [],
            class: existingEventsByCal.class[dStr] || [],
            commentary: existingEventsByCal.commentary[dStr] || []
        };

        if (eMap[dStr] || sMap[dStr] || jMap[dStr] || gEventsForDate.work.length > 0 || gEventsForDate.class.length > 0 || gEventsForDate.commentary.length > 0) {
            datesToSync.push({ dateStr: dStr, eData: eMap[dStr], sData: sMap[dStr], jData: jMap[dStr], existingEventsByCal: gEventsForDate });
        }
        curD.setDate(curD.getDate() + 1);
    }

    const total = datesToSync.length;
    if (total === 0) return;

    for (let i = 0; i < total; i++) {
        const item = datesToSync[i];
        ProgressModal.update(`📅 구글 캘린더 반영 중... (${item.dateStr}) [${i+1}/${total}]`, 20 + (80 * ((i+1)/total)));
        await syncSingleDateDataToCalendar(token, calIds, item.dateStr, item.eData, item.sData, item.jData, syncEvent, syncClass, syncJournal, item.existingEventsByCal, mode);
    }
}

// 가져오기 더미 함수(단방향으로 변경되어 UI 알림용으로만 처리됨)
>>>>>>> d1348ae5447b87f69a849130f4f6a30f4c5cc4fe
export async function importCalendarData() { return; }