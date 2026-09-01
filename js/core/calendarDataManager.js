// js/core/calendarDataManager.js

import { getUserCol, getGroupCol } from '../api/database.js';
import { db } from '../api/firebaseInit.js';
import { query, where, documentId, getDocs, doc, writeBatch } from "firebase/firestore";
import { getEventLabels } from './utils.js';
import { parseRawEventTextToEventList, formatEventListToText } from '../core/eventManager.js';

export const fetchCalendarData = async (startStr, endStr, myGroups) => {
    const eMap = {}, sMap = {};
    const promises = [];

    // 1. 개인 일정 가져오기
    promises.push(
        getDocs(query(getUserCol('events'), where(documentId(), '>=', startStr), where(documentId(), '<=', endStr))).then(snap => {
            snap.forEach(docSnap => {
                const data = docSnap.data();
                if (!eMap[docSnap.id]) eMap[docSnap.id] = { eventList: [] };
                let pList = data.eventList || (data.eventText ? parseRawEventTextToEventList(data.eventText) : []);
                pList.forEach(e => { e.sharedGroupId = null; eMap[docSnap.id].eventList.push(e); });
            });
        }).catch(e => console.warn(e))
    );

    // 2. 소속된 그룹 일정 가져오기
    for (const g of myGroups) {
        promises.push(
            getDocs(query(getGroupCol(g.id, 'events'), where(documentId(), '>=', startStr), where(documentId(), '<=', endStr))).then(snap => {
                snap.forEach(docSnap => {
                    const data = docSnap.data();
                    if (!eMap[docSnap.id]) eMap[docSnap.id] = { eventList: [] };
                    let gList = data.eventList || [];
                    gList.forEach(e => { e.sharedGroupId = g.id; e.groupName = g.name; eMap[docSnap.id].eventList.push(e); });
                });
            }).catch(e => console.warn(e))
        );
    }

    // 3. 개인 시간표 가져오기
    promises.push(
        getDocs(query(getUserCol('schedules'), where(documentId(), '>=', startStr), where(documentId(), '<=', endStr))).then(snap => {
            snap.forEach(docSnap => {
                if (!sMap[docSnap.id]) sMap[docSnap.id] = {};
                sMap[docSnap.id]['personal'] = docSnap.data().periods || {};
            });
        }).catch(e => console.warn(e))
    );

    // 4. 그룹 시간표 가져오기
    for (const g of myGroups) {
        promises.push(
            getDocs(query(getGroupCol(g.id, 'schedules'), where(documentId(), '>=', startStr), where(documentId(), '<=', endStr))).then(snap => {
                snap.forEach(docSnap => {
                    if (!sMap[docSnap.id]) sMap[docSnap.id] = {};
                    sMap[docSnap.id][g.id] = docSnap.data().periods || {};
                });
            }).catch(e => console.warn(e))
        );
    }

    await Promise.all(promises);
    return { eMap, sMap };
};

export const saveCalendarData = async (snapshot, myGroups, activeUnifiedFilters) => {
    const masterLabels = getEventLabels();
    let batch = writeBatch(db);
    let opCount = 0;
    let batchPromises = [];
    
    snapshot.forEach(item => {
        const eventsByGroup = { 'personal': [] };
        myGroups.forEach(g => eventsByGroup[g.id] = []);

        item.validEvents.forEach(e => {
            const gId = e.sharedGroupId === 'personal' ? 'personal' : (e.sharedGroupId || 'personal');
            if (eventsByGroup[gId]) eventsByGroup[gId].push(e);
        });

        // 1. 개인 일정 저장
        const pEvents = eventsByGroup['personal'];
        batch.set(doc(getUserCol('events'), item.dateStr), {
            eventList: pEvents,
            eventText: formatEventListToText(pEvents),
            updatedAt: Date.now()
        }, { merge: true });
        opCount++;
        if (opCount >= 400) { batchPromises.push(batch.commit()); batch = writeBatch(db); opCount = 0; }

        // 2. 그룹 일정 저장
        myGroups.forEach(g => {
            const gEvents = eventsByGroup[g.id];
            batch.set(doc(getGroupCol(g.id, 'events'), item.dateStr), {
                eventList: gEvents,
                eventText: formatEventListToText(gEvents),
                updatedAt: Date.now()
            }, { merge: true });
            opCount++;
            if (opCount >= 400) { batchPromises.push(batch.commit()); batch = writeBatch(db); opCount = 0; }
        });

        // 3. 시간표 저장 (휴일 스킵 로직 포함)
        (activeUnifiedFilters || ['personal']).forEach(fId => {
            const periods = item.schedulesData[fId] || {};
            const scheduleCol = fId === 'personal' ? getUserCol('schedules') : getGroupCol(fId, 'schedules');
            
            const isSkipDay = item.validEvents.some(e => (e.sharedGroupId || 'personal') === fId && e.labelIds?.some(id => masterLabels.find(l => l.id === id)?.isSkip));
            if (isSkipDay) {
                Object.values(periods).forEach(p => p.subject = '');
            }
            
            batch.set(doc(scheduleCol, item.dateStr), { 
                periods: periods, updatedAt: Date.now() 
            }, { merge: true });
            opCount++;
            if (opCount >= 400) { batchPromises.push(batch.commit()); batch = writeBatch(db); opCount = 0; }
        });
    });

    if (opCount > 0) batchPromises.push(batch.commit());
    await Promise.all(batchPromises).catch(e => console.warn(e));
};