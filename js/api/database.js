// js/api/database.js
import { collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, setDoc, query, orderBy, where, arrayUnion, arrayRemove } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { db, auth, storage } from "./firebaseInit.js";
import { compressImage } from "./storage.js";

export const getUserCol = (collectionName) => {
    const user = auth.currentUser;
    if (!user) throw new Error("로그인이 필요합니다.");
    return collection(db, 'users', user.uid, collectionName);
};

export const getGroupCol = (groupId, collectionName) => {
    if (!groupId) throw new Error("그룹 ID가 필요합니다.");
    return collection(db, 'groups', groupId, collectionName);
};

// 💡 초대 코드로 참여할 때 groups 컬렉션 전체를 inviteCode로 조회하면,
// 보안 규칙에서 groups 목록 조회를 열어야 해서 로그인한 사람 누구나
// 모든 그룹의 이름과 초대 코드를 읽을 수 있게 된다.
// 코드 -> 그룹 ID 매핑 문서를 따로 두고 그 한 건만 읽는다. (V4와 동일한 구조)
const inviteCodeRef = (code) => doc(db, 'inviteCodes', code);

// 이미 만들어진 그룹에도 코드 -> 그룹 매핑 문서를 채워 준다 (그룹장 접속 시 1회).
// V4에는 있었는데 V3에는 없었다. 매핑이 없는 그룹은 '그룹 목록을 훑는' 폴백에
// 기대야 참여가 되는데, 보안 규칙을 조이면 그 폴백이 막힌다.
const backfilledCodes = new Set();
async function ensureInviteCodeDoc(group, uid) {
    if (!group || !group.inviteCode || group.ownerId !== uid) return;
    if (backfilledCodes.has(group.inviteCode)) return;
    backfilledCodes.add(group.inviteCode);
    try {
        const snap = await getDoc(inviteCodeRef(group.inviteCode));
        if (!snap.exists()) {
            await setDoc(inviteCodeRef(group.inviteCode), {
                groupId: group.id, ownerId: group.ownerId, createdAt: Date.now()
            });
        }
    } catch (e) {
        console.warn('초대 코드 매핑 생성 실패:', e);
    }
}

export const dbAPI = {
    loadMemos: async () => {
        try {
            const q = query(getUserCol('tasks'), orderBy('createdAt'));
            const snapshot = await getDocs(q);
            const memos = [];
            snapshot.forEach(docSnap => memos.push({ firestoreId: docSnap.id, ...docSnap.data() }));
            return memos;
        } catch (error) { throw new Error("CACHE_MISS"); } // 수정됨
    },
    loadGroupMemos: async (groupId) => {
        try {
            const q = query(getGroupCol(groupId, 'tasks'), orderBy('createdAt'));
            const snapshot = await getDocs(q);
            const memos = [];
            snapshot.forEach(docSnap => memos.push({ firestoreId: docSnap.id, groupId: groupId, isShared: true, ...docSnap.data() }));
            return memos;
        } catch (error) { throw new Error("CACHE_MISS"); } // 수정됨
    },
    addMemo: async (memoData, groupId = null) => { 
        if (groupId) await addDoc(getGroupCol(groupId, 'tasks'), memoData);
        else await addDoc(getUserCol('tasks'), memoData); 
    },
    updateMemo: async (firestoreId, updateData, groupId = null) => { 
        if (groupId) await updateDoc(doc(getGroupCol(groupId, 'tasks'), firestoreId), updateData);
        else await updateDoc(doc(getUserCol('tasks'), firestoreId), updateData); 
    },
    deleteMemo: async function(firestoreId, groupId = null) {
        const docRef = groupId ? doc(getGroupCol(groupId, 'tasks'), firestoreId) : doc(getUserCol('tasks'), firestoreId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().imageUrl) await this.deleteImage(docSnap.data().imageUrl);
        await deleteDoc(docRef);
    },
    loadDayData: async (dateStr) => {
        try {
            const eventDoc = await getDoc(doc(getUserCol('events'), dateStr));
            const scheduleDoc = await getDoc(doc(getUserCol('schedules'), dateStr));
            const evData = eventDoc.exists() ? eventDoc.data() : {};
            return { eventText: evData.eventText || '', eventList: evData.eventList || [], periods: scheduleDoc.exists() ? scheduleDoc.data().periods : {} };
        } catch (error) { return { eventText: '', eventList: [], periods: {} }; }
    },
    loadGroupDayData: async (dateStr, groupId) => {
        try {
            const eventDoc = await getDoc(doc(getGroupCol(groupId, 'events'), dateStr));
            const scheduleDoc = await getDoc(doc(getGroupCol(groupId, 'schedules'), dateStr));
            return { eventText: eventDoc.exists() ? eventDoc.data().eventText : '', eventList: eventDoc.exists() ? (eventDoc.data().eventList || []) : [], periods: scheduleDoc.exists() ? (scheduleDoc.data().periods || {}) : {} };
        } catch (error) { return { eventText: '', eventList: [], periods: {} }; }
    },
    saveEvent: async (dateStr, eventText) => {
        // eventText만 쓰면 eventList가 옛 내용으로 남아 V3/V4 양쪽에서 지운 일정이 되살아난다
        const payload = { eventText, updatedAt: Date.now() };
        if (window.parseRawEventTextToEventList) payload.eventList = window.parseRawEventTextToEventList(eventText);
        await setDoc(doc(getUserCol('events'), dateStr), payload, { merge: true });
    },
    saveSchedule: async (dateStr, periodsData) => { 
        await setDoc(doc(getUserCol('schedules'), dateStr), { periods: periodsData, updatedAt: Date.now() }, { merge: true }); 
    },
    uploadImage: async (file, folderName = 'memo_images') => {
        const user = auth.currentUser;
        if (!user) throw new Error("로그인이 필요합니다.");
        const compressedFile = await compressImage(file);
        const filePath = `${folderName}/${user.uid}/${Date.now()}_${compressedFile.name}`;
        const storageRef = ref(storage, filePath);
        await uploadBytes(storageRef, compressedFile);
        return await getDownloadURL(storageRef);
    },
    deleteImage: async (imageUrl) => {
        try { const storageRef = ref(storage, imageUrl); await deleteObject(storageRef); } catch(e) { console.warn("이미지 삭제 실패", e); }
    },
    loadRoster: async () => {
        try {
            const docSnap = await getDoc(doc(getUserCol('settings'), 'rosters'));
            if (docSnap.exists() && docSnap.data().classList) return docSnap.data().classList;
            const oldSnap = await getDoc(doc(getUserCol('settings'), 'roster'));
            if (oldSnap.exists()) return [oldSnap.data()];
            return [];
        } catch (error) { return []; }
    },
    saveRoster: async (classList) => {
        await setDoc(doc(getUserCol('settings'), 'rosters'), { classList, updatedAt: Date.now() }, { merge: true });
    },
    loadEvaluations: async (dateStr, groupId = null) => {
        try {
            const docRef = groupId ? doc(getGroupCol(groupId, 'evaluations'), dateStr) : doc(getUserCol('evaluations'), dateStr);
            const docSnap = await getDoc(docRef);
            return docSnap.exists() ? docSnap.data().evalList || [] : [];
        } catch (error) { return []; }
    },
    saveEvaluations: async (dateStr, evalList, groupId = null) => {
        const docRef = groupId ? doc(getGroupCol(groupId, 'evaluations'), dateStr) : doc(getUserCol('evaluations'), dateStr);
        await setDoc(docRef, { evalList, updatedAt: Date.now() }, { merge: true });
    },
    loadMyGroups: async (forceRefresh = false) => {
        const user = auth.currentUser;
        if (!user) return [];
        if (!forceRefresh && cachedMyGroups && (Date.now() - lastMyGroupsFetchTime < MY_GROUPS_CACHE_TTL)) {
            return cachedMyGroups;
        }
        try {
            const q = query(collection(db, 'groups'), where('members', 'array-contains', user.uid));
            const snapshot = await getDocs(q);
            const groups = [];
            snapshot.forEach(docSnap => groups.push({ id: docSnap.id, ...docSnap.data() }));
            cachedMyGroups = groups;
            lastMyGroupsFetchTime = Date.now();
            // 내가 만든 그룹의 초대 코드 매핑을 채운다 (실패해도 사용에는 지장 없음)
            groups.forEach(g => ensureInviteCodeDoc(g, user.uid));
            return groups;
        } catch(e) { console.warn("오프라인이거나 그룹 목록 로드 실패", e); return cachedMyGroups || []; }
    },
    createGroup: async (groupName) => {
        const user = auth.currentUser;
        if (!user) throw new Error("로그인이 필요합니다.");
        const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        const groupData = {
            name: groupName, ownerId: user.uid, ownerName: user.displayName || '이름 없음',
            members: [user.uid],
            memberDetails: { [user.uid]: { name: user.displayName || '이름 없음', joinedAt: Date.now(), photoURL: user.photoURL || '' } },
            inviteCode: inviteCode, createdAt: Date.now()
        };
        const docRef = await addDoc(collection(db, 'groups'), groupData);
        try {
            await setDoc(inviteCodeRef(inviteCode), {
                groupId: docRef.id, ownerId: user.uid, createdAt: Date.now()
            });
        } catch (e) { console.warn('초대 코드 매핑 생성 실패:', e); }
        invalidateGroupsCache();
        return { id: docRef.id, ...groupData };
    },
    joinGroup: async (inviteCode) => {
        const user = auth.currentUser;
        if (!user) throw new Error("로그인이 필요합니다.");
        const cleanCode = (inviteCode || '').trim().toUpperCase();
        if (!cleanCode) throw new Error("초대 코드를 올바르게 입력해주세요.");

        try {
            // 코드 -> 그룹 ID 매핑 문서 한 건만 읽는다
            let groupId = null;
            const mapSnap = await getDoc(inviteCodeRef(cleanCode));
            if (mapSnap.exists()) {
                groupId = mapSnap.data().groupId || null;
            } else {
                // 매핑이 아직 없는 예전 그룹을 위한 폴백.
                // ⚠️ 이 조회는 그룹 목록을 훑는 것이라 규칙을 조이면 권한 거부가 난다.
                //    여기서 예외가 터지면 참여 자체가 막히므로 반드시 감싸 둔다.
                try {
                    const q = query(collection(db, 'groups'), where('inviteCode', '==', cleanCode));
                    const snapshot = await getDocs(q);
                    if (!snapshot.empty) groupId = snapshot.docs[0].id;
                } catch (e) {
                    console.warn('옛 그룹 폴백 조회 실패(매핑이 있으면 문제 없음):', e);
                }
            }
            if (!groupId) throw new Error("유효하지 않거나 존재하지 않는 초대 코드입니다.");

            // ⚠️ 참여하기 전에 그룹 문서를 읽을 수 있다고 가정하면 안 된다.
            //    규칙을 조이면 아직 구성원이 아닌 사람은 그룹을 읽을 수 없다.
            const groupRef = doc(db, 'groups', groupId);
            let groupName = '공유 그룹';
            try {
                const groupSnap = await getDoc(groupRef);
                if (groupSnap.exists()) {
                    const groupData = groupSnap.data();
                    groupName = groupData.name || groupName;
                    if ((groupData.members || []).includes(user.uid)) {
                        throw new Error("이미 가입된 그룹입니다.");
                    }
                }
            } catch (e) {
                if (e.message === "이미 가입된 그룹입니다.") throw e;
                // 못 읽었다 = 아직 구성원이 아니다. 계속 진행한다.
            }

            // ⚠️ setDoc이 아니라 updateDoc을 써야 한다.
            //    setDoc은 'memberDetails.<uid>'를 하위 필드가 아니라 그 이름의
            //    필드로 통째로 만든다. 그러면 바뀐 필드 이름이 memberDetails가
            //    아니게 되어, 참여만 허용하는 규칙을 통과하지 못한다.
            await updateDoc(groupRef, {
                members: arrayUnion(user.uid),
                [`memberDetails.${user.uid}`]: { name: user.displayName || '이름 없음', joinedAt: Date.now(), photoURL: user.photoURL || '' }
            });

            // 이제는 구성원이므로 이름을 읽을 수 있다
            try {
                const after = await getDoc(groupRef);
                if (after.exists()) groupName = after.data().name || groupName;
            } catch (e) { /* 이름을 못 읽어도 참여는 끝났다 */ }

            invalidateGroupsCache();
            return { id: groupId, name: groupName };
        } catch (error) {
            if (error.code === 'permission-denied') throw new Error("권한이 없습니다. 데이터베이스 규칙을 확인해주세요.");
            throw new Error(error.message || "가입 처리 중 오류 발생.");
        }
    },
    leaveGroup: async (groupId) => {
        const user = auth.currentUser;
        if (!user) throw new Error("로그인이 필요합니다.");
        const groupRef = doc(db, 'groups', groupId);
        const groupSnap = await getDoc(groupRef);
        if (groupSnap.exists()) {
            if (groupSnap.data().ownerId === user.uid) throw new Error("그룹장은 탈퇴할 수 없습니다.");
            await updateDoc(groupRef, { members: arrayRemove(user.uid) });
            invalidateGroupsCache();
        }
    },
    deleteGroup: async (groupId) => {
        const user = auth.currentUser;
        if (!user) throw new Error("로그인이 필요합니다.");
        const groupRef = doc(db, 'groups', groupId);
        const groupSnap = await getDoc(groupRef);
        if (groupSnap.exists() && groupSnap.data().ownerId === user.uid) {
            const code = groupSnap.data().inviteCode;
            // Firestore는 문서를 지워도 하위 컬렉션을 함께 지우지 않는다.
            // 먼저 비우지 않으면 일정/수업/기록/메모가 접근도 삭제도 불가능한
            // 상태로 영영 남는다. (V4와 동일한 처리)
            for (const colName of ["events", "schedules", "journals", "tasks", "evaluations"]) {
                const subSnap = await getDocs(collection(db, "groups", groupId, colName));
                for (const d of subSnap.docs) {
                    await deleteDoc(d.ref);
                }
            }
            await deleteDoc(groupRef);
            if (code) {
                try { await deleteDoc(inviteCodeRef(code)); }
                catch (e) { console.warn('초대 코드 매핑 삭제 실패:', e); }
            }
            invalidateGroupsCache();
        } else {
            throw new Error("그룹 삭제 권한이 없습니다.");
        }
    }
};

let cachedMyGroups = null;
let lastMyGroupsFetchTime = 0;
const MY_GROUPS_CACHE_TTL = 30000;

export const invalidateGroupsCache = () => {
    cachedMyGroups = null;
    lastMyGroupsFetchTime = 0;
};
window.invalidateGroupsCache = invalidateGroupsCache;
