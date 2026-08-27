// js/modules/syncTasks.js
import { db } from '../api/firebaseInit.js';
import { getUserCol, dbAPI } from '../api/database.js';
import { doc, writeBatch } from "firebase/firestore";
import { googleFetch } from '../api/googleApi.js';

const TASK_ID_MARKER = '\n\n[SP_ID: ';

export async function exportTasksToGoogle(token, mode = 'merge') {
    const listUrl = "https://tasks.googleapis.com/tasks/v1/users/@me/lists";
    const data = await googleFetch(listUrl, 'GET', token);
    
    let targetList = (data.items || []).find(list => list.title === 'School Planner 메모');
    let taskListId = targetList ? targetList.id : (await googleFetch(listUrl, 'POST', token, { title: 'School Planner 메모' })).id;

    let allTasks = []; let pageToken = '';
    do {
        const tasksData = await googleFetch(`https://tasks.googleapis.com/tasks/v1/lists/${taskListId}/tasks${pageToken ? '?pageToken='+pageToken : ''}`, 'GET', token);
        if (tasksData && tasksData.items) allTasks.push(...tasksData.items);
        pageToken = tasksData?.nextPageToken || '';
    } while(pageToken);

    const webMemos = await dbAPI.loadMemos();
    let matchedTaskIds = new Set();

    for (const memo of webMemos) {
        const memoId = memo.firestoreId || memo.id;
        const contentStr = memo.text || ""; 
        let titleSnippet = contentStr ? (contentStr.length > 30 ? contentStr.substring(0, 30) + "..." : contentStr) : "내용 없음";
        
        let labelStr = '일반';
        if (Array.isArray(memo.labels) && memo.labels.length > 0) labelStr = memo.labels.join(', ');
        else if (memo.label) labelStr = memo.label;

        let finalNotes = contentStr;
        if (memo.imageUrl) finalNotes += `\n\n🖼️ [첨부 이미지 링크]\n${memo.imageUrl}`;
        if (memoId) finalNotes += `${TASK_ID_MARKER}${memoId}]`;

        const payload = {
            title: `[${labelStr}] ${titleSnippet}`, 
            notes: finalNotes, 
            status: memo.completed ? 'completed' : 'needsAction'
        };

        const existingTask = allTasks.find(t => {
            if (t.notes && memoId && t.notes.includes(`${TASK_ID_MARKER}${memoId}]`)) return true;
            return t.title === payload.title; 
        });

        if (existingTask) {
            matchedTaskIds.add(existingTask.id);
            if (existingTask.title !== payload.title || existingTask.notes !== payload.notes || existingTask.status !== payload.status) {
                payload.id = existingTask.id;
                await googleFetch(`https://tasks.googleapis.com/tasks/v1/lists/${taskListId}/tasks/${existingTask.id}`, 'PUT', token, payload);
            }
        } else {
            await googleFetch(`https://tasks.googleapis.com/tasks/v1/lists/${taskListId}/tasks`, 'POST', token, payload);
            await new Promise(res => setTimeout(res, 20)); 
        }
    }

    if (mode === 'overwrite') {
        const tasksToDelete = allTasks.filter(t => !matchedTaskIds.has(t.id));
        for (const task of tasksToDelete) {
            try { await googleFetch(`https://tasks.googleapis.com/tasks/v1/lists/${taskListId}/tasks/${task.id}`, 'DELETE', token); } catch(e) {}
        }
    }
}

export async function importTasksFromGoogle(token, mode = 'replace') {
    const listUrl = "https://tasks.googleapis.com/tasks/v1/users/@me/lists";
    const data = await googleFetch(listUrl, 'GET', token);
    let targetList = (data.items || []).find(list => list.title === 'School Planner 메모');
    if (!targetList) return; 

    let allTasks = []; let pageToken = '';
    do {
        const tasksData = await googleFetch(`https://tasks.googleapis.com/tasks/v1/lists/${targetList.id}/tasks${pageToken ? '?pageToken='+pageToken : ''}`, 'GET', token);
        if (tasksData && tasksData.items) allTasks.push(...tasksData.items);
        pageToken = tasksData?.nextPageToken || '';
    } while(pageToken);

    const webMemos = await dbAPI.loadMemos();
    let batch = writeBatch(db); let batchOpCount = 0;
    
    if (mode === 'overwrite') {
        for (const m of webMemos) {
            batch.delete(doc(getUserCol('tasks'), m.firestoreId || m.id));
            batchOpCount++;
            if (batchOpCount >= 400) { await batch.commit(); batch = writeBatch(db); batchOpCount = 0; }
        }
    }

    for (const task of allTasks) {
        let titleMatch = task.title ? task.title.match(/^\[(.*?)\]\s*(.*)$/) : null;
        let labelStr = titleMatch ? titleMatch[1].trim() : '일반';
        let notes = task.notes || ''; let extractedId = null;
        
        if (notes.includes(TASK_ID_MARKER)) {
            const splitArr = notes.split(TASK_ID_MARKER);
            const rawIdPart = splitArr[splitArr.length - 1];
            if (rawIdPart.endsWith(']')) {
                extractedId = rawIdPart.slice(0, -1);
                notes = splitArr.slice(0, -1).join(TASK_ID_MARKER).trim();
            }
        }
        
        notes = notes.replace(/\n\n🖼️ \[첨부 이미지 링크\]\nhttps?:\/\/.+/, '').trim();
        if (!notes) notes = titleMatch ? titleMatch[2].trim() : task.title;

        const isCompleted = task.status === 'completed';
        const targetMemo = extractedId ? webMemos.find(m => (m.firestoreId || m.id) === extractedId) : webMemos.find(m => m.text === notes);

        if (targetMemo && mode !== 'overwrite') {
            const memoRef = doc(getUserCol('tasks'), targetMemo.firestoreId || targetMemo.id);
            batch.update(memoRef, { text: notes, completed: isCompleted, labels: [labelStr], updatedAt: Date.now() });
        } else {
            const newRef = doc(getUserCol('tasks'));
            batch.set(newRef, { text: notes, completed: isCompleted, labels: [labelStr], createdAt: Date.now(), order: -Date.now() });
        }

        batchOpCount++;
        if (batchOpCount >= 400) { await batch.commit(); batch = writeBatch(db); batchOpCount = 0; }
    }
    if (batchOpCount > 0) await batch.commit();
}