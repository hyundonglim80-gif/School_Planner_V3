// js/modules/backupData.js

import { store } from '../core/store.js';
import { formatDate, getEventLabels, getJournalLabels } from '../core/utils.js';
import { parseRawEventTextToEventList, formatEventListToText } from '../core/eventUtils.js'; // 🌟 누락되었던 모듈 임포트 추가
import { getUserCol, getGroupCol } from '../api/database.js'; // 🌟 db 제거 (올바른 경로로 분리)
import { db, auth } from '../api/firebaseInit.js'; // 🌟 db, auth의 올바른 경로 지정 완료!
import { doc, getDoc, getDocs, setDoc, deleteDoc, query, where, documentId, orderBy, writeBatch } from "firebase/firestore"; 
import { ProgressModal } from '../ui/progressModal.js';

export const BackupData = {
    getColRef: function(colName, scope) {
        if (scope === 'personal') return getUserCol(colName);
        return getGroupCol(scope, colName);
    },

    getScheduleDataArray: async function(options) {
        const { scope, val, startStr, endStr, incEvent, incClass, incJournal, incEval } = options;
        const isGroup = scope !== 'personal';

        if (val !== 'all' && (!startStr || !endStr)) throw new Error("시작일과 종료일을 올바르게 설정해 주세요.");

        const evMap = {}; const scMap = {}; const joMap = {}; const elMap = {};

        const fetchCol = async (colName, useIdAsDate = true) => {
            let q;
            if (val !== 'all' && startStr && endStr) {
                if (useIdAsDate) {
                    q = query(this.getColRef(colName, scope), where(documentId(), '>=', startStr), where(documentId(), '<=', endStr));
                } else {
                    const startMs = new Date(startStr + 'T00:00:00').getTime();
                    const endMs = new Date(endStr + 'T23:59:59').getTime();
                    q = query(this.getColRef(colName, scope), where('createdAt', '>=', startMs), where('createdAt', '<=', endMs));
                }
            } else {
                q = this.getColRef(colName, scope);
            }
            return await getDocs(q);
        };

        if (incEvent) {
            const snap = await fetchCol('events', true);
            snap.forEach(d => evMap[d.id] = { eventList: d.data().eventList || (d.data().eventText ? parseRawEventTextToEventList(d.data().eventText) : []) });
        }
        if (incClass) {
            const snap = await fetchCol('schedules', true);
            snap.forEach(d => scMap[d.id] = { periods: d.data().periods || {} });
        }
        if (incJournal) {
            const snap = await fetchCol('journals', true);
            snap.forEach(d => joMap[d.id] = { entries: d.data().entries || [] });
        }
        if (incEval) {
            const snap = await fetchCol('evaluations', true);
            snap.forEach(d => elMap[d.id] = { evalList: d.data().evalList || [] });
        }

        const masterEventLabels = getEventLabels();
        const masterJournalLabels = getJournalLabels();
        const pNames = store.periodNames || ["1","2","3","4","5","6"];
        
        const header = ["날짜"];
        if (incEvent) header.push("일정");
        if (incClass) pNames.forEach(p => header.push(p));
        if (incJournal) header.push("기록");
        if (incEval) header.push("조사표");
        if (incEvent) header.push("일정 메타데이터 (수정금지)");
        if (incJournal) header.push("기록 메타데이터 (수정금지)");

        const rows = [header]; 
        const evalMapBySheet = {};
        const dbAutoUpdates = [];
        
        let allDates = new Set([...Object.keys(evMap), ...Object.keys(scMap), ...Object.keys(joMap), ...Object.keys(elMap)]);
        if (val !== 'all' && startStr && endStr) {
            let curr = new Date(startStr);
            let end = new Date(endStr);
            while(curr <= end) {
                allDates.add(formatDate(curr));
                curr.setDate(curr.getDate() + 1);
            }
        }
        let sortedDates = Array.from(allDates).sort();

        for (const dStr of sortedDates) {
            let rowObj = { date: dStr, evText: '', cls: [], joText: '', elText: '', evMeta: '', joMeta: '' };
            let needsDbUpdateEvent = false; let needsDbUpdateJournal = false;

            if (incEvent && evMap[dStr] && evMap[dStr].eventList) {
                const textLines = []; const metaList = [];
                evMap[dStr].eventList.forEach(e => {
                    if (!e.id || typeof e.id !== 'string' || e.id.trim() === '') {
                        e.id = 'ev_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5);
                        needsDbUpdateEvent = true; 
                    }
                    if (!e.authorId && auth?.currentUser?.uid) { // 🌟 window.auth -> auth
                        e.authorId = auth.currentUser.uid;
                        needsDbUpdateEvent = true;
                    }

                    let labelNames = [];
                    if (e.labelIds && e.labelIds.length > 0) {
                        labelNames = e.labelIds.map(id => { const match = masterEventLabels.find(l => l.id === id || l.name === id); return match ? match.name : id; });
                    } else if (e.labels && e.labels.length > 0) labelNames = e.labels;
                    else if (e.label) labelNames = [e.label];
                    
                    let lName = labelNames.length > 0 ? labelNames.join(', ') : '일정';
                    const pre = e.completed ? '[v] ' : '';
                    textLines.push(`${pre}[${lName}] ${e.content}`);
                    
                    metaList.push({ 
                        id: e.id, 
                        groupId: e.groupId || null, 
                        sharedGroupId: isGroup ? scope : (e.sharedGroupId || null), 
                        forwardChainId: e.forwardChainId || null, 
                        authorId: e.authorId || null,
                        originalDate: e.originalDate || null 
                    });
                });
                
                if (needsDbUpdateEvent) {
                    dbAutoUpdates.push({
                        col: this.getColRef('events', scope),
                        docId: dStr,
                        data: { eventList: evMap[dStr].eventList, eventText: formatEventListToText(evMap[dStr].eventList), updatedAt: Date.now() }
                    });
                }
                rowObj.evText = textLines.join('\n');
                rowObj.evMeta = JSON.stringify(metaList);
            }

            if (incClass) {
                const periods = scMap[dStr] ? (scMap[dStr].periods || {}) : {};
                for(let p=1; p<=pNames.length; p++) {
                    const pData = periods[p] || {};
                    let pText = "";
                    if(pData.subject && pData.subject.trim() !== '') pText += `[${pData.subject.trim()}] `;
                    if(pData.memo && pData.memo.trim() !== '') pText += pData.memo.trim();
                    if(pData.supplies && pData.supplies.trim() !== '') pText += ` [${pData.supplies.trim()}]`;
                    rowObj.cls.push(pText.trim());
                }
            }

            if (incJournal && joMap[dStr] && joMap[dStr].entries) {
                const textLines = []; const metaList = [];
                joMap[dStr].entries.forEach(j => {
                    if (!j.id || typeof j.id !== 'string' || j.id.trim() === '') {
                        j.id = 'jr_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5);
                        needsDbUpdateJournal = true;
                    }
                    if (!j.authorId && auth?.currentUser?.uid) { // 🌟 window.auth -> auth
                        j.authorId = auth.currentUser.uid;
                        needsDbUpdateJournal = true;
                    }

                    let labelNames = [];
                    if (j.labelIds && j.labelIds.length > 0) {
                        labelNames = j.labelIds.map(id => { const match = masterJournalLabels.find(l => l.id === id || l.name === id); return match ? match.name : id; });
                    } else if (j.labels && j.labels.length > 0) labelNames = j.labels;
                    else if (j.label) labelNames = [j.label];

                    let lName = labelNames.length > 0 ? labelNames.join(', ') : '기록';
                    const pre = j.completed ? '[v] ' : '';
                    textLines.push(`${pre}[${lName}] ${j.content}`);
                    
                    metaList.push({ id: j.id, authorId: j.authorId || null });
                });
                
                if (needsDbUpdateJournal) {
                    dbAutoUpdates.push({
                        col: this.getColRef('journals', scope),
                        docId: dStr,
                        data: { entries: joMap[dStr].entries, updatedAt: Date.now() }
                    });
                }
                rowObj.joText = textLines.join('\n');
                rowObj.joMeta = JSON.stringify(metaList);
            }

            if (incEval && elMap[dStr] && elMap[dStr].evalList) {
                rowObj.elText = JSON.stringify(elMap[dStr].evalList);
                elMap[dStr].evalList.forEach(ev => {
                    let sheetName = '조사표_기타';
                    if (ev.rosterMeta && ev.rosterMeta.year) sheetName = `조사표_${ev.rosterMeta.year}-${ev.rosterMeta.grade}-${ev.rosterMeta.classNum}`;
                    if (!evalMapBySheet[sheetName]) evalMapBySheet[sheetName] = [];
                    if (!ev.dateStr) ev.dateStr = dStr;
                    evalMapBySheet[sheetName].push(ev);
                });
            }

            let row = [rowObj.date];
            if (incEvent) row.push(rowObj.evText);
            if (incClass) rowObj.cls.forEach(c => row.push(c));
            if (incJournal) row.push(rowObj.joText);
            if (incEval) row.push(rowObj.elText);
            if (incEvent) row.push(rowObj.evMeta);
            if (incJournal) row.push(rowObj.joMeta);

            rows.push(row);
        }
        
        if (dbAutoUpdates.length > 0) {
            ProgressModal.update("데이터 최적화 중...", 40);
            let updateBatch = writeBatch(db);
            let uCount = 0; const uPromises = [];
            dbAutoUpdates.forEach(u => {
                updateBatch.set(doc(u.col, u.docId), u.data, { merge: true });
                uCount++;
                if (uCount > 400) { uPromises.push(updateBatch.commit()); updateBatch = writeBatch(db); uCount = 0; }
            });
            if (uCount > 0) uPromises.push(updateBatch.commit());
            await Promise.all(uPromises);
        }
        
        const evalSheetsData = {};
        for (const [sheetName, evals] of Object.entries(evalMapBySheet)) {
            const studentMap = new Map();
            evals.forEach(ev => { (ev.studentsSnapshot || []).forEach(st => { if (!studentMap.has(st.num)) studentMap.set(st.num, st); }); });
            const students = Array.from(studentMap.values()).sort((a,b) => a.num - b.num);

            const row1 = ["상위 항목(조사표 제목)", "", ""];
            const row2 = ["조사표 ID (수정금지)", "", ""];
            const row3 = ["하위 항목(날짜)", "", ""];
            const row4 = ["하위 항목(교시)", "", ""];
            const row5 = ["하위 항목(유형)", "", ""];
            const row6 = ["하위 항목(교과)", "", ""];
            const row7 = ["하위 항목(방식)", "", ""];
            const row8 = ["번호", "이름", "성별"];

            evals.forEach(ev => {
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
                row1.push(ev.title || ""); for(let i=1; i<span; i++) row1.push("");
                row2.push(ev.id || ""); for(let i=1; i<span; i++) row2.push("");
                row3.push(ev.dateStr || ""); for(let i=1; i<span; i++) row3.push("");
                row4.push(ev.periodStr ? `${ev.periodStr}교시` : ""); for(let i=1; i<span; i++) row4.push("");
                
                const typeStr = ev.type === 'eval' ? '평가' : (ev.type === 'check' ? '체크' : '메모');
                row5.push(typeStr); for(let i=1; i<span; i++) row5.push("");
                row6.push(ev.subject || ""); for(let i=1; i<span; i++) row6.push("");
                
                let mArr = [];
                if(isIndiv) mArr.push("개인");
                if(isGroup) mArr.push("조별");
                row7.push(mArr.join(', ')); for(let i=1; i<span; i++) row7.push("");
                row8.push(...cols);
            });

            const sheetRows = [row1, row2, row3, row4, row5, row6, row7, row8];
            
            students.forEach(st => {
                const sRow = [st.num, st.name, st.gender || ""];
                evals.forEach(ev => {
                    const rec = ev.records[st.num] || {};
                    const isEval = ev.type === 'eval';
                    const isIndiv = isEval ? (ev.methodObj ? ev.methodObj.indiv : (ev.method !== 'group')) : false;
                    const isGroup = isEval ? (ev.methodObj ? ev.methodObj.group : (ev.method === 'group')) : false;
                    
                    if (isEval) {
                        if (isGroup) { sRow.push(rec.groupName || ""); sRow.push(rec.groupScore || ""); } 
                        if (isIndiv) sRow.push(rec.indivScore || rec.score || ""); 
                        sRow.push(rec.reason || "");
                    } else if (ev.type === 'check') {
                        let cRes = '';
                        if (rec.checked === true) cRes = 'O'; else if (rec.checked === false) cRes = 'X';
                        sRow.push(cRes, rec.reason || "");
                    } else {
                        sRow.push(rec.memo || "");
                    }
                });
                sheetRows.push(sRow);
            });
            evalSheetsData[sheetName] = sheetRows;
        }

        return { scheduleRows: rows, evalSheetsData: evalSheetsData };
    },

    getMemoDataArray: async function(options) {
        const { scope, val, startStr, endStr } = options;
        const isGroup = scope !== 'personal';
        const rows = [["데이터분류", "ID", "내용/이름", "완료여부(O/X)", "라벨", "주소/URL", "생성일자(타임스탬프)"]];
        
        if (!isGroup) {
            const linkDoc = await getDoc(doc(getUserCol('settings'), 'user_links'));
            if (linkDoc.exists()) {
                const links = linkDoc.data().links || [];
                links.forEach((l, idx) => rows.push(['LINK', `LINK_${idx}`, l.name || '', '', '', l.url || '', '']));
            }
        }

        let q = query(this.getColRef('tasks', scope), orderBy('createdAt'));
        if (val !== 'all' && startStr && endStr) {
            const startMs = new Date(startStr + 'T00:00:00').getTime();
            const endMs = new Date(endStr + 'T23:59:59').getTime();
            q = query(this.getColRef('tasks', scope), where('createdAt', '>=', startMs), where('createdAt', '<=', endMs), orderBy('createdAt'));
        }

        const snap = await getDocs(q);
        snap.forEach(docSnap => {
            const d = docSnap.data();
            rows.push([ 'MEMO', docSnap.id, d.text || '', d.completed ? 'O' : 'X', (d.labels || []).join(','), d.imageUrl || '', d.createdAt || Date.now() ]);
        });

        return rows;
    },

    processScheduleRows: async function(rows, options, matrixUpdates = []) {
        if (rows.length < 2) return;
        
        const { scope, val, startStr, endStr, incEvent, incClass, incJournal, incEval, mode } = options;
        const isGroup = scope !== 'personal';

        const header = rows[0];
        const dateIdx = header.findIndex(h => typeof h === 'string' && h.includes("날짜"));
        const eventMetaIdx = incEvent ? header.findIndex(h => typeof h === 'string' && h.includes("일정 메타")) : -1;
        const journalMetaIdx = incJournal ? header.findIndex(h => typeof h === 'string' && h.includes("기록 메타")) : -1;
        const eventIdx = incEvent ? header.findIndex(h => typeof h === 'string' && h.includes("일정") && !h.includes("메타")) : -1;
        const journalIdx = incJournal ? header.findIndex(h => typeof h === 'string' && h.includes("기록") && !h.includes("메타")) : -1;
        const evalIdx = incEval ? header.findIndex(h => typeof h === 'string' && h.includes("조사표")) : -1;

        const doEvent = incEvent && eventIdx !== -1;
        const doJournal = incJournal && journalIdx !== -1;
        const doEval = incEval && evalIdx !== -1;
        const doClass = incClass;

        const periodIndices = [];
        if (doClass) {
            for (let i = 0; i < header.length; i++) {
                if (i !== dateIdx && i !== eventIdx && i !== journalIdx && i !== evalIdx && i !== eventMetaIdx && i !== journalMetaIdx) {
                    periodIndices.push({ index: i, pNum: periodIndices.length + 1 });
                }
            }
        }

        const masterLabels = getEventLabels(); const masterJournalLabels = getJournalLabels();
        let labelsChanged = false;

        const parseEventTextWithMeta = (rawText, rawMetaStr, type) => {
            if (!rawText || !rawText.trim()) return [];
            const lines = rawText.split('\n');
            let metaArray = [];
            if (rawMetaStr && rawMetaStr.trim() !== '') { try { metaArray = JSON.parse(rawMetaStr); } catch(e) {} }

            const eventList = [];
            const targetLabels = type === 'journal' ? masterJournalLabels : masterLabels;

            lines.forEach((line, idx) => {
                let t = line.trim(); if(!t) return;
                let completed = false;
                if (t.startsWith('[v]') || t.startsWith('[V]')) { completed = true; t = t.substring(3).trim(); }

                let labelsArray = []; let content = t;
                const match = t.match(/^\[(.*?)\]\s*(.*)$/);
                if (match) {
                    let labelStr = match[1].trim(); content = match[2].trim();
                    labelsArray = labelStr.split(',').map(s => s.trim()).filter(Boolean);
                }
                if (labelsArray.length === 0) labelsArray = [type === 'journal' ? '기록' : '일정'];

                let mappedLabelIds = [];
                labelsArray.forEach(lbl => {
                    let lObj = targetLabels.find(l => l.name === lbl);
                    if (!lObj) {
                        lObj = { id: (type === 'journal' ? 'lbl_jr_' : 'lbl_ev_') + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5), name: lbl, color: 'blue' };
                        if (type === 'event') { lObj.isSkip = false; lObj.isForward = false; lObj.isPeriod = false; lObj.isRecur = false; lObj.isSystem = false; }
                        targetLabels.push(lObj); labelsChanged = true;
                    }
                    mappedLabelIds.push(lObj.id);
                });

                let defaultLabelIds = [];
                if (!match && type === 'event' && (t.includes('(휴일)') || t.includes('(행사)'))) {
                    const skipLabel = targetLabels.find(l => l.isSkip);
                    if (skipLabel) defaultLabelIds = [skipLabel.id];
                }

                const meta = metaArray[idx] || {};
                let generatedId = meta.id;
                if (!generatedId || typeof generatedId !== 'string' || generatedId.trim() === '') {
                    generatedId = (type === 'journal' ? 'jr_' : 'ev_') + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5);
                }

                eventList.push({
                    id: generatedId,
                    groupId: meta.groupId || null, 
                    sharedGroupId: isGroup ? scope : (meta.sharedGroupId || null),
                    forwardChainId: meta.forwardChainId || null,
                    authorId: meta.authorId || auth?.currentUser?.uid, // 🌟 window.auth -> auth
                    originalDate: meta.originalDate || null,
                    labelIds: mappedLabelIds.length > 0 ? mappedLabelIds : defaultLabelIds,
                    label: labelsArray[0],
                    labels: labelsArray,
                    content: content,
                    completed: completed
                });
            });
            return eventList;
        };

        const parsedDaysMap = {}; const scheduleDataMap = {}; const journalDataMap = {}; const evalDataMap = {};

        for (let i = 1; i < rows.length; i++) {
            const row = rows[i]; const dStr = row[dateIdx];
            if(!dStr || typeof dStr !== 'string' || !dStr.match(/^\d{4}-\d{2}-\d{2}$/)) continue;
            if (val !== 'all' && startStr && endStr && (dStr < startStr || dStr > endStr)) continue;

            if (doEvent) {
                const evText = row[eventIdx] || ""; const evMetaStr = eventMetaIdx !== -1 ? (row[eventMetaIdx] || "") : "";
                parsedDaysMap[dStr] = { eventList: parseEventTextWithMeta(evText, evMetaStr, 'event') };
            } else { parsedDaysMap[dStr] = { eventList: [] }; }

            if (doClass) {
                let isSkipDay = false;
                if (doEvent) {
                    isSkipDay = parsedDaysMap[dStr].eventList.some(ev => ev.labelIds && ev.labelIds.some(id => { const m = masterLabels.find(l => l.id === id); return m && m.isSkip; }));
                }
                let periodsData = {};
                periodIndices.forEach(pCol => {
                    let pText = (row[pCol.index] || "").trim(); let subj = "", memo = "", supplies = "";
                    if (pText !== "") {
                        const lastBracketMatch = pText.match(/\[([^\]]+)\]\s*$/);
                        const allBrackets = pText.match(/\[.*?\]/g);
                        if (allBrackets && allBrackets.length >= 2) { supplies = lastBracketMatch ? lastBracketMatch[1].trim() : ""; pText = pText.replace(/\[([^\]]+)\]\s*$/, '').trim(); }
                        const firstBracketMatch = pText.match(/^\[(.*?)\]/);
                        if (firstBracketMatch) { subj = firstBracketMatch[1].trim(); memo = pText.replace(/^\[(.*?)\]\s*/, '').trim(); } 
                        else { memo = pText; }
                    }
                    if(isSkipDay) subj = ''; 
                    periodsData[pCol.pNum] = { subject: subj, memo: memo, supplies: supplies };
                });
                scheduleDataMap[dStr] = periodsData;
            }

            if (doJournal) {
                const joText = row[journalIdx] || ""; const joMetaStr = journalMetaIdx !== -1 ? (row[journalMetaIdx] || "") : "";
                journalDataMap[dStr] = parseEventTextWithMeta(joText, joMetaStr, 'journal');
            }

            if (doEval) {
                let evalStr = row[evalIdx] || "";
                if (typeof evalStr === 'string' && evalStr.trim() !== '') {
                    evalStr = evalStr.trim();
                    if (evalStr.startsWith("'")) evalStr = evalStr.substring(1);
                    if (evalStr.endsWith("'")) evalStr = evalStr.substring(0, evalStr.length - 1);
                    try { evalDataMap[dStr] = JSON.parse(evalStr); } catch(e) { }
                }
            }
        }

        if (matrixUpdates && matrixUpdates.length > 0) {
            const updatesByEval = {};
            matrixUpdates.forEach(u => {
                if (!updatesByEval[u.evalId]) updatesByEval[u.evalId] = {};
                if (!updatesByEval[u.evalId][u.studentNum]) updatesByEval[u.evalId][u.studentNum] = {};
                updatesByEval[u.evalId][u.studentNum][u.colName] = u.val;
            });
            for (const dStr in evalDataMap) {
                evalDataMap[dStr].forEach(ev => {
                    const updates = updatesByEval[ev.id];
                    if (updates) {
                        for (const sNumStr in updates) {
                            const sNum = parseInt(sNumStr, 10); const u = updates[sNumStr];
                            if (!ev.records[sNum]) ev.records[sNum] = {};
                            if (ev.type === 'eval') {
                                if (u['조이름'] !== undefined) ev.records[sNum].groupName = u['조이름'];
                                if (u['조별결과'] !== undefined) ev.records[sNum].groupScore = u['조별결과'];
                                if (u['개별결과'] !== undefined) { ev.records[sNum].indivScore = u['개별결과']; ev.records[sNum].score = u['개별결과']; }
                                if (u['미평가사유(메모)'] !== undefined) ev.records[sNum].reason = u['미평가사유(메모)'];
                            } else if (ev.type === 'check') {
                                if (u['체크결과'] !== undefined) {
                                    if (u['체크결과'] === 'O') ev.records[sNum].checked = true;
                                    else if (u['체크결과'] === 'X') ev.records[sNum].checked = false;
                                    else delete ev.records[sNum].checked;
                                }
                                if (u['미평가사유(메모)'] !== undefined) ev.records[sNum].reason = u['미평가사유(메모)'];
                            } else if (ev.type === 'memo') {
                                if (u['메모내용'] !== undefined) ev.records[sNum].memo = u['메모내용'];
                            }
                        }
                    }
                });
            }
        }

        const sortedDates = Object.keys(parsedDaysMap).sort();
        const batchPromises = []; let batch = writeBatch(db); let opCount = 0;

        if (mode === 'overwrite') {
            const cols = [];
            if (doEvent) cols.push('events');
            if (doClass) cols.push('schedules');
            if (doJournal) cols.push('journals');
            if (doEval) cols.push('evaluations');

            for (const col of cols) {
                let q = (val === 'all') ? this.getColRef(col, scope) : query(this.getColRef(col, scope), where(documentId(), '>=', startStr), where(documentId(), '<=', endStr));
                const snap = await getDocs(q);
                snap.forEach(docSnap => {
                    batch.delete(docSnap.ref); opCount++;
                    if(opCount >= 400) { batchPromises.push(batch.commit()); batch = writeBatch(db); opCount = 0; }
                });
            }
            if(opCount > 0) { batchPromises.push(batch.commit()); batch = writeBatch(db); opCount = 0; }
            await Promise.all(batchPromises);
            batchPromises.length = 0; 
        }

        const totalDays = sortedDates.length; let processedCount = 0;
        const getUniqueList = (list) => {
            const merged = [];
            for (const item of list) {
                let existing = null;
                if (item.id) existing = merged.find(e => e.id === item.id);
                if (!existing && item.forwardChainId) existing = merged.find(e => e.forwardChainId === item.forwardChainId && e.content === item.content);
                if (!existing && !item.id) {
                    const lblStr = (item.labels || []).join(',');
                    existing = merged.find(e => e.content === item.content && (e.labels || []).join(',') === lblStr && (!e.id || !item.id)); 
                }
                if (existing) Object.assign(existing, item); else merged.push({ ...item }); 
            }
            return merged;
        };

        for (const dStr of sortedDates) {
            if (doEvent) {
                let newEventList = parsedDaysMap[dStr].eventList;
                if (mode === 'merge') {
                    const existDoc = await getDoc(doc(this.getColRef('events', scope), dStr));
                    if (existDoc.exists()) newEventList = getUniqueList([...(existDoc.data().eventList || []), ...newEventList]); 
                }
                const evText = formatEventListToText(newEventList); // 🌟 window.formatEventListToText -> formatEventListToText
                batch.set(doc(this.getColRef('events', scope), dStr), { eventList: newEventList, eventText: evText, updatedAt: Date.now() }, { merge: true }); 
                opCount++;
            }

            if (doClass && scheduleDataMap[dStr]) {
                if (mode === 'merge') {
                    const scRef = doc(this.getColRef('schedules', scope), dStr);
                    const scSnap = await getDoc(scRef);
                    let existingPeriods = scSnap.exists() ? (scSnap.data().periods || {}) : {};
                    const newPeriods = scheduleDataMap[dStr];
                    for (let p in newPeriods) existingPeriods[p] = newPeriods[p];
                    batch.set(scRef, { periods: existingPeriods, updatedAt: Date.now() }, { merge: true });
                } else {
                    batch.set(doc(this.getColRef('schedules', scope), dStr), { periods: scheduleDataMap[dStr], updatedAt: Date.now() }, { merge: true }); 
                }
                opCount++;
            }

            if (doJournal && journalDataMap[dStr]) {
                let newJournalList = journalDataMap[dStr];
                if (mode === 'merge') {
                    const existDoc = await getDoc(doc(this.getColRef('journals', scope), dStr));
                    if (existDoc.exists()) newJournalList = getUniqueList([...(existDoc.data().entries || []), ...newJournalList]); 
                }
                batch.set(doc(this.getColRef('journals', scope), dStr), { entries: newJournalList, updatedAt: Date.now() }, { merge: true }); 
                opCount++;
            }

            if (doEval && evalDataMap[dStr] !== undefined) {
                let newEvalList = evalDataMap[dStr] || [];
                if (mode === 'merge') {
                    const existDoc = await getDoc(doc(this.getColRef('evaluations', scope), dStr));
                    if (existDoc.exists()) {
                        const existList = existDoc.data().evalList || [];
                        const combined = [...existList];
                        newEvalList.forEach(newItem => {
                            const idx = combined.findIndex(old => old.id === newItem.id);
                            if (idx !== -1) combined[idx] = newItem; else combined.push(newItem);
                        });
                        newEvalList = combined;
                    }
                }
                batch.set(doc(this.getColRef('evaluations', scope), dStr), { evalList: newEvalList, updatedAt: Date.now() }, { merge: true }); 
                opCount++;
            }

            if (opCount > 400) { batchPromises.push(batch.commit()); batch = writeBatch(db); opCount = 0; }
            processedCount++;
            ProgressModal.update(`데이터베이스 저장 중... [${processedCount}/${totalDays}]`, 30 + (70 * (processedCount/totalDays)));
        }
        
        if(opCount > 0) batchPromises.push(batch.commit());
        await Promise.all(batchPromises);

        // 🌟 마스터 라벨을 로컬 스토리지에 업데이트
        if (labelsChanged && !isGroup) {
            localStorage.setItem('workCalendar_eventLabels_v4', JSON.stringify(masterLabels));
            localStorage.setItem('workCalendar_journalLabels_v4', JSON.stringify(masterJournalLabels));
            if (auth && auth.currentUser) {
                await setDoc(doc(getUserCol('settings'), 'labels'), { eventLabels: masterLabels, journalLabels: masterJournalLabels }, { merge: true });
            }
        }
        store.hasUnsavedChanges = false;
    },

    processMemoRows: async function(rows, options) {
        if (rows.length < 2) return;
        const { scope, mode } = options;
        const isGroup = scope !== 'personal';
        const batchPromises = []; let batch = writeBatch(db); let opCount = 0; let newLinks = [];

        if (mode === 'overwrite') {
            const snap = await getDocs(this.getColRef('tasks', scope));
            snap.forEach(docSnap => {
                batch.delete(docSnap.ref); opCount++;
                if(opCount >= 400) { batchPromises.push(batch.commit()); batch = writeBatch(db); opCount = 0; }
            });
            if (!isGroup) { await deleteDoc(doc(getUserCol('settings'), 'user_links')); }
            if(opCount > 0) { batchPromises.push(batch.commit()); batch = writeBatch(db); opCount = 0; }
            await Promise.all(batchPromises);
            batchPromises.length = 0; 
        }

        const totalRows = rows.length - 1; let processedRows = 0;

        for (let i=1; i<rows.length; i++) {
            const r = rows[i];
            if(r.length < 3 || !r[2]) continue; 
            
            const dataType = r[0] || 'MEMO';
            if (dataType === 'LINK' && !isGroup) {
                newLinks.push({ name: r[2], url: r[5] });
            } else if (dataType === 'MEMO') {
                let id = r[1] && typeof r[1] === 'string' && r[1].trim() !== '' && !r[1].startsWith('LINK_') 
                            ? r[1].trim() : ('memo_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5)); 
                            
                const completed = r[3] === 'O';
                const labels = r[4] ? r[4].split(',').filter(x=>x.trim()) : [];
                const imageUrl = r[5] || '';
                const createdAt = parseInt(r[6], 10) || Date.now();

                const taskData = {
                    text: r[2], completed: completed, labels: labels, imageUrl: imageUrl,
                    createdAt: createdAt, updatedAt: Date.now(), order: -createdAt,
                    authorId: auth?.currentUser?.uid // 🌟 window.auth -> auth
                };
                
                if (isGroup) {
                    taskData.groupId = scope;
                    taskData.isShared = true;
                }

                batch.set(doc(this.getColRef('tasks', scope), id), taskData, { merge: true });
                opCount++;
                if (opCount > 400) { batchPromises.push(batch.commit()); batch = writeBatch(db); opCount = 0; }
            }

            processedRows++;
            if (processedRows % 10 === 0) ProgressModal.update(`메모 데이터 저장 중... [${processedRows}/${totalRows}]`, 50 + (50 * (processedRows/totalRows)));
        }
        
        if (newLinks.length > 0 && !isGroup) {
            const linkDoc = await getDoc(doc(getUserCol('settings'), 'user_links'));
            let existingLinks = linkDoc.exists() ? (linkDoc.data().links || []) : [];
            
            if (mode === 'merge') {
                const combinedLinks = [...existingLinks];
                newLinks.forEach(nl => { if (!existingLinks.some(el => el.url === nl.url)) combinedLinks.push(nl); });
                newLinks = combinedLinks;
            }
            batch.set(doc(getUserCol('settings'), 'user_links'), { links: newLinks }, { merge: true });
            opCount++;
        }

        if(opCount > 0) batchPromises.push(batch.commit());
        await Promise.all(batchPromises);
        store.hasUnsavedChanges = false;
    }
};