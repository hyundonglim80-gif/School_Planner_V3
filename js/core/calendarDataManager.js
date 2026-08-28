// js/core/calendarDataManager.js

import { getUserCol, getGroupCol } from '../api/database.js';
import { db } from '../api/firebaseInit.js';
import { query, where, documentId, getDocs, doc, writeBatch } from "firebase/firestore";
import { getEventLabels } from './utils.js';
import { parseRawEventTextToEventList, formatEventListToText } from '../core/eventManager.js';

export const fetchCalendarData = async (startStr, endStr, myGroups) => {
    // 🌟 [경제성] 기존 eMap, sMap에 더하여 jMap(기록), elMap(조사표)을 동시 처리하도록 확장
    const eMap = {}, sMap = {}, jMap = {}, elMap = {};
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

    // 5. 개인 기록(Journal) 가져오기
    promises.push(
        getDocs(query(getUserCol('journals'), where(documentId(), '>=', startStr), where(documentId(), '<=', endStr))).then(snap => {
            snap.forEach(docSnap => {
                if (!jMap[docSnap.id]) jMap[docSnap.id] = {};
                jMap[docSnap.id]['personal'] = docSnap.data().entries || [];
            });
        }).catch(e => console.warn(e))
    );

    // 6. 그룹 기록(Journal) 가져오기
    for (const g of myGroups) {
        promises.push(
            getDocs(query(getGroupCol(g.id, 'journals'), where(documentId(), '>=', startStr), where(documentId(), '<=', endStr))).then(snap => {
                snap.forEach(docSnap => {
                    if (!jMap[docSnap.id]) jMap[docSnap.id] = {};
                    jMap[docSnap.id][g.id] = docSnap.data().entries || [];
                });
            }).catch(e => console.warn(e))
        );
    }

    // 7. 개인 조사표(Evaluation) 가져오기
    promises.push(
        getDocs(query(getUserCol('evaluations'), where(documentId(), '>=', startStr), where(documentId(), '<=', endStr))).then(snap => {
            snap.forEach(docSnap => {
                if (!elMap[docSnap.id]) elMap[docSnap.id] = {};
                elMap[docSnap.id]['personal'] = docSnap.data().evalList || [];
            });
        }).catch(e => console.warn(e))
    );

    // 8. 그룹 조사표(Evaluation) 가져오기
    for (const g of myGroups) {
        promises.push(
            getDocs(query(getGroupCol(g.id, 'evaluations'), where(documentId(), '>=', startStr), where(documentId(), '<=', endStr))).then(snap => {
                snap.forEach(docSnap => {
                    if (!elMap[docSnap.id]) elMap[docSnap.id] = {};
                    elMap[docSnap.id][g.id] = docSnap.data().evalList || [];
                });
            }).catch(e => console.warn(e))
        );
    }

    // 🌟 [신속성] 이 모든 8개의 통신을 한 번에 병렬 처리하여 딜레이 제로 달성
    await Promise.all(promises);
    return { eMap, sMap, jMap, elMap };
};

export const saveCalendarData = async (snapshot, myGroups, activeUnifiedFilters) => {
    const masterLabels = getEventLabels();
    let batch = writeBatch(db);
    let opCount = 0;
    let batchPromises = [];
    
    const filtersToSave = activeUnifiedFilters || ['personal'];
    
    snapshot.forEach(item => {
        const eventsByGroup = {};
        filtersToSave.forEach(fId => eventsByGroup[fId] = []);

        item.validEvents.forEach(e => {
            const gId = e.sharedGroupId === 'personal' ? 'personal' : (e.sharedGroupId || 'personal');
            if (eventsByGroup[gId]) eventsByGroup[gId].push(e);
        });

        filtersToSave.forEach(fId => {
            const eList = eventsByGroup[fId];
            const eventCol = fId === 'personal' ? getUserCol('events') : getGroupCol(fId, 'events');
            
            batch.set(doc(eventCol, item.dateStr), {
                eventList: eList,
                eventText: formatEventListToText(eList),
                updatedAt: Date.now()
            }, { merge: true });
            
            opCount++;
            if (opCount >= 400) { batchPromises.push(batch.commit()); batch = writeBatch(db); opCount = 0; }

            const periods = item.schedulesData[fId] || {};
            const scheduleCol = fId === 'personal' ? getUserCol('schedules') : getGroupCol(fId, 'schedules');
            
            const isSkipDay = eList.some(e => e.labelIds?.some(id => masterLabels.find(l => l.id === id)?.isSkip));
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
