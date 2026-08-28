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
    
    // 🌟 [안전성 및 경제성] 화면에 켜져 있는(활성화된) 필터의 공간에만 데이터를 저장하도록 수정
    const filtersToSave = activeUnifiedFilters || ['personal'];
    
    snapshot.forEach(item => {
        const eventsByGroup = {};
        filtersToSave.forEach(fId => eventsByGroup[fId] = []);

        // 화면에서 걸러진 유효한 이벤트들을 각 그룹 아이디별로 분류
        item.validEvents.forEach(e => {
            const gId = e.sharedGroupId === 'personal' ? 'personal' : (e.sharedGroupId || 'personal');
            if (eventsByGroup[gId]) eventsByGroup[gId].push(e);
        });

        filtersToSave.forEach(fId => {
            // 1. 일정 저장 (개인/그룹 통합 로직으로 묶어 경제성 극대화)
            const eList = eventsByGroup[fId];
            const eventCol = fId === 'personal' ? getUserCol('events') : getGroupCol(fId, 'events');
            
            batch.set(doc(eventCol, item.dateStr), {
                eventList: eList,
                eventText: formatEventListToText(eList),
                updatedAt: Date.now()
            }, { merge: true });
            
            opCount++;
            if (opCount >= 400) { batchPromises.push(batch.commit()); batch = writeBatch(db); opCount = 0; }

            // 2. 시간표 저장 (휴일 스킵 로직 포함)
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
