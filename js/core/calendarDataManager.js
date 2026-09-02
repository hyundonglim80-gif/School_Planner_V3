// js/core/calendarDataManager.js

import { getUserCol, getGroupCol } from '../api/database.js';
import { db } from '../api/firebaseInit.js';
import { query, where, documentId, getDocs, getDoc, doc, writeBatch } from "firebase/firestore";
import { getEventLabels } from './utils.js';
import { parseRawEventTextToEventList, formatEventListToText } from '../core/eventManager.js';

export const fetchCalendarData = async (startStr, endStr, myGroups) => {
    try {
        await getDoc(doc(getUserCol('events'), startStr));
    } catch (e) {
        throw new Error("CACHE_MISS");
    }

    const eMap = {}, sMap = {}, jMap = {}, vMap = {};
    const promises = [];

    // 1. 개인 일정
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

    // 2. 그룹 일정
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

    // 3. 개인 시간표
    promises.push(
        getDocs(query(getUserCol('schedules'), where(documentId(), '>=', startStr), where(documentId(), '<=', endStr))).then(snap => {
            snap.forEach(docSnap => {
                if (!sMap[docSnap.id]) sMap[docSnap.id] = {};
                sMap[docSnap.id]['personal'] = docSnap.data().periods || {};
            });
        }).catch(e => console.warn(e))
    );

    // 4. 그룹 시간표
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

    // 5. 개인 기록 (journals)
    promises.push(
        getDocs(query(getUserCol('journals'), where(documentId(), '>=', startStr), where(documentId(), '<=', endStr))).then(snap => {
            snap.forEach(docSnap => {
                if (!jMap[docSnap.id]) jMap[docSnap.id] = {};
                jMap[docSnap.id]['personal'] = docSnap.data().entries || [];
            });
        }).catch(e => console.warn(e))
    );

    // 6. 그룹 기록 (journals)
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

    // 7. 개인 조사표 (evaluations)
    promises.push(
        getDocs(query(getUserCol('evaluations'), where(documentId(), '>=', startStr), where(documentId(), '<=', endStr))).then(snap => {
            snap.forEach(docSnap => {
                if (!vMap[docSnap.id]) vMap[docSnap.id] = {};
                vMap[docSnap.id]['personal'] = docSnap.data().evalList || [];
            });
        }).catch(e => console.warn(e))
    );

    // 8. 그룹 조사표 (evaluations)
    for (const g of myGroups) {
        promises.push(
            getDocs(query(getGroupCol(g.id, 'evaluations'), where(documentId(), '>=', startStr), where(documentId(), '<=', endStr))).then(snap => {
                snap.forEach(docSnap => {
                    if (!vMap[docSnap.id]) vMap[docSnap.id] = {};
                    vMap[docSnap.id][g.id] = docSnap.data().evalList || [];
                });
            }).catch(e => console.warn(e))
        );
    }

    await Promise.all(promises);
    return { eMap, sMap, jMap, vMap };
};

export const saveCalendarData = async (snapshot, myGroups, activeUnifiedFilters) => {
    const masterLabels = getEventLabels();
    let batch = writeBatch(db);
    let opCount = 0;
    let batchPromises = [];
    
    // 🔥 비동기 조회를 위해 for...of 루프 사용
    for (const item of snapshot) {
        const eventsByGroup = { 'personal': [] };
        myGroups.forEach(g => eventsByGroup[g.id] = []);

        item.validEvents.forEach(e => {
            const gId = e.sharedGroupId === 'personal' ? 'personal' : (e.sharedGroupId || 'personal');
            if (eventsByGroup[gId]) eventsByGroup[gId].push(e);
        });

        // 1. 개인 일정 저장 (충돌 없음)
        const pEvents = eventsByGroup['personal'];
        batch.set(doc(getUserCol('events'), item.dateStr), {
            eventList: pEvents,
            eventText: formatEventListToText(pEvents),
            updatedAt: Date.now()
        }, { merge: true });
        opCount++;
        if (opCount >= 400) { batchPromises.push(batch.commit()); batch = writeBatch(db); opCount = 0; }

        // 2. 그룹 일정 저장 (🔥 동시 수정 보존 로직 적용)
        for (const g of myGroups) {
            const gEvents = eventsByGroup[g.id];
            const docRef = doc(getGroupCol(g.id, 'events'), item.dateStr);
            const docSnap = await getDoc(docRef);

            let mergedEvents = [...gEvents];

            if (docSnap.exists()) {
                const serverEvents = docSnap.data().eventList || [];
                mergedEvents = [];
                const serverEventsMap = new Map(serverEvents.map(e => [e.id, e]));

                // 서버에 있는 기존 데이터(다른 동료가 먼저 저장한 데이터) 우선 보존
                serverEvents.forEach(se => mergedEvents.push({ ...se }));

                // 내가 작성한 데이터 비교
                gEvents.forEach(le => {
                    const se = serverEventsMap.get(le.id);
                    if (!se) {
                        // 서버에 없는 새 데이터는 그대로 추가
                        mergedEvents.push(le);
                    } else {
                        // 서버와 로컬 모두에 존재함. 내용이나 상태가 변경되었는지 확인
                        const isChanged = (le.content !== se.content) || 
                                          (le.completed !== se.completed) || 
                                          (JSON.stringify(le.labelIds || []) !== JSON.stringify(se.labelIds || []));
                        
                        if (isChanged) {
                            // 🔥 충돌 발생: 내 수정본을 덮어쓰지 않고 새로운 ID와 꼬리표를 달아 추가 보존
                            const branchedEvent = { ...le };
                            branchedEvent.id = 'ev_cf_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5);
                            branchedEvent.content = `[⚠️동시수정 보존] ` + branchedEvent.content;
                            mergedEvents.push(branchedEvent);
                        }
                    }
                });
            }

            batch.set(docRef, {
                eventList: mergedEvents,
                eventText: formatEventListToText(mergedEvents),
                updatedAt: Date.now()
            }, { merge: true });
            opCount++;
            if (opCount >= 400) { batchPromises.push(batch.commit()); batch = writeBatch(db); opCount = 0; }
        }

        // 3. 시간표 저장 (🔥 그룹 시간표 동시 수정 보존 적용)
        for (const fId of (activeUnifiedFilters || ['personal'])) {
            const periods = item.schedulesData[fId] || {};
            const scheduleCol = fId === 'personal' ? getUserCol('schedules') : getGroupCol(fId, 'schedules');
            
            const isSkipDay = item.validEvents.some(e => (e.sharedGroupId || 'personal') === fId && e.labelIds?.some(id => masterLabels.find(l => l.id === id)?.isSkip));
            if (isSkipDay) {
                Object.values(periods).forEach(p => p.subject = '');
            }
            
            let mergedPeriods = { ...periods };

            if (fId !== 'personal') {
                const scRef = doc(scheduleCol, item.dateStr);
                const scSnap = await getDoc(scRef);
                if (scSnap.exists()) {
                    const serverPeriods = scSnap.data().periods || {};
                    // 교시별로 다르면 합쳐서 메모로 남김
                    for (let p in periods) {
                        const lp = periods[p];
                        const sp = serverPeriods[p];
                        if (sp) {
                            const lText = `${lp.subject || ''}${lp.memo || ''}${lp.supplies || ''}`;
                            const sText = `${sp.subject || ''}${sp.memo || ''}${sp.supplies || ''}`;
                            if (lText !== sText && lText.trim() !== '') {
                                mergedPeriods[p] = {
                                    subject: sp.subject || lp.subject,
                                    memo: `${sp.memo || ''}\n[⚠️수정보존: ${lp.subject||''} ${lp.memo||''}]`.trim(),
                                    supplies: sp.supplies || lp.supplies
                                };
                            }
                        }
                    }
                    // 서버에만 있는 교시 데이터 보존
                    for (let p in serverPeriods) {
                        if (!mergedPeriods[p]) mergedPeriods[p] = serverPeriods[p];
                    }
                }
            }
            
            batch.set(doc(scheduleCol, item.dateStr), { 
                periods: mergedPeriods, updatedAt: Date.now() 
            }, { merge: true });
            opCount++;
            if (opCount >= 400) { batchPromises.push(batch.commit()); batch = writeBatch(db); opCount = 0; }
        }
    }

    if (opCount > 0) batchPromises.push(batch.commit());
    
    await Promise.race([
        Promise.all(batchPromises),
        new Promise(r => setTimeout(r, 800)) // 데이터 안정성을 위해 약간의 대기 시간 부여
    ]).catch(e => console.warn(e));
};