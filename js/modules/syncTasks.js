// js/modules/syncTasks.js
import { db } from '../api/firebaseInit.js';
import { getUserCol, dbAPI } from '../api/database.js';
import { doc, writeBatch } from "firebase/firestore";
import { googleFetch } from '../api/googleApi.js';

const TASK_ID_MARKER = '\n\n[SP_ID: ';

export async function exportTasksToGoogle(token, mode = 'merge') {
    const listUrl = "https://tasks.googleapis.com/tasks/v1/users/@me/lists";
    const data = await googleFetch(listUrl, 'GET', token);
    
    // 신규: SP(memo)라는 이름으로 Tasks 리스트 관리
    let targetList = (data.items || []).find(list => list.title === 'SP(memo)');
    let taskListId = targetList ? targetList.id : (await googleFetch(listUrl, 'POST', token, { title: 'SP(memo)' })).id;

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

// 가져오기 더미 함수(단방향으로 변경되어 UI 알림용으로만 처리됨)
export async function importTasksFromGoogle() { return; }