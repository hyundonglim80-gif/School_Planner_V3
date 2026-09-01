<<<<<<< HEAD
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
            return { eventText: eventDoc.exists() ? eventDoc.data().eventText : '', periods: scheduleDoc.exists() ? scheduleDoc.data().periods : {} };
        } catch (error) { return { eventText: '', periods: {} }; }
    },
    loadGroupDayData: async (dateStr, groupId) => {
        try {
            const eventDoc = await getDoc(doc(getGroupCol(groupId, 'events'), dateStr));
            const scheduleDoc = await getDoc(doc(getGroupCol(groupId, 'schedules'), dateStr));
            return { eventText: eventDoc.exists() ? eventDoc.data().eventText : '', eventList: eventDoc.exists() ? (eventDoc.data().eventList || []) : [], periods: scheduleDoc.exists() ? (scheduleDoc.data().periods || {}) : {} };
        } catch (error) { return { eventText: '', eventList: [], periods: {} }; }
    },
    saveEvent: async (dateStr, eventText) => { 
        await setDoc(doc(getUserCol('events'), dateStr), { eventText, updatedAt: Date.now() }, { merge: true }); 
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
    loadMyGroups: async () => {
        const user = auth.currentUser;
        if (!user) return [];
        try {
            const q = query(collection(db, 'groups'), where('members', 'array-contains', user.uid));
            const snapshot = await getDocs(q);
            const groups = [];
            snapshot.forEach(docSnap => groups.push({ id: docSnap.id, ...docSnap.data() }));
            return groups;
        } catch(e) { console.warn("오프라인이거나 그룹 목록 로드 실패", e); return []; }
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
        return { id: docRef.id, ...groupData };
    },
    joinGroup: async (inviteCode) => {
        const user = auth.currentUser;
        if (!user) throw new Error("로그인이 필요합니다.");
        const cleanCode = (inviteCode || '').trim().toUpperCase();
        if (!cleanCode) throw new Error("초대 코드를 올바르게 입력해주세요.");

        try {
            const q = query(collection(db, 'groups'), where('inviteCode', '==', cleanCode));
            const snapshot = await getDocs(q);
            if (snapshot.empty) throw new Error("유효하지 않거나 존재하지 않는 초대 코드입니다.");

            const groupDoc = snapshot.docs[0];
            const groupId = groupDoc.id;
            const groupData = groupDoc.data();

            if ((groupData.members || []).includes(user.uid)) throw new Error("이미 가입된 그룹입니다.");

            await setDoc(doc(db, 'groups', groupId), {
                members: arrayUnion(user.uid),
                [`memberDetails.${user.uid}`]: { name: user.displayName || '이름 없음', joinedAt: Date.now(), photoURL: user.photoURL || '' }
            }, { merge: true });

            return { id: groupId, name: groupData.name || '공유 그룹' };
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
        }
    },
    deleteGroup: async (groupId) => {
        const user = auth.currentUser;
        if (!user) throw new Error("로그인이 필요합니다.");
        const groupRef = doc(db, 'groups', groupId);
        const groupSnap = await getDoc(groupRef);
        if (groupSnap.exists() && groupSnap.data().ownerId === user.uid) await deleteDoc(groupRef);
        else throw new Error("그룹 삭제 권한이 없습니다.");
    }
};
=======
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
            return { eventText: eventDoc.exists() ? eventDoc.data().eventText : '', periods: scheduleDoc.exists() ? scheduleDoc.data().periods : {} };
        } catch (error) { return { eventText: '', periods: {} }; }
    },
    loadGroupDayData: async (dateStr, groupId) => {
        try {
            const eventDoc = await getDoc(doc(getGroupCol(groupId, 'events'), dateStr));
            const scheduleDoc = await getDoc(doc(getGroupCol(groupId, 'schedules'), dateStr));
            return { eventText: eventDoc.exists() ? eventDoc.data().eventText : '', eventList: eventDoc.exists() ? (eventDoc.data().eventList || []) : [], periods: scheduleDoc.exists() ? (scheduleDoc.data().periods || {}) : {} };
        } catch (error) { return { eventText: '', eventList: [], periods: {} }; }
    },
    saveEvent: async (dateStr, eventText) => { 
        await setDoc(doc(getUserCol('events'), dateStr), { eventText, updatedAt: Date.now() }, { merge: true }); 
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
    loadMyGroups: async () => {
        const user = auth.currentUser;
        if (!user) return [];
        try {
            const q = query(collection(db, 'groups'), where('members', 'array-contains', user.uid));
            const snapshot = await getDocs(q);
            const groups = [];
            snapshot.forEach(docSnap => groups.push({ id: docSnap.id, ...docSnap.data() }));
            return groups;
        } catch(e) { console.warn("오프라인이거나 그룹 목록 로드 실패", e); return []; }
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
        return { id: docRef.id, ...groupData };
    },
    joinGroup: async (inviteCode) => {
        const user = auth.currentUser;
        if (!user) throw new Error("로그인이 필요합니다.");
        const cleanCode = (inviteCode || '').trim().toUpperCase();
        if (!cleanCode) throw new Error("초대 코드를 올바르게 입력해주세요.");

        try {
            const q = query(collection(db, 'groups'), where('inviteCode', '==', cleanCode));
            const snapshot = await getDocs(q);
            if (snapshot.empty) throw new Error("유효하지 않거나 존재하지 않는 초대 코드입니다.");

            const groupDoc = snapshot.docs[0];
            const groupId = groupDoc.id;
            const groupData = groupDoc.data();

            if ((groupData.members || []).includes(user.uid)) throw new Error("이미 가입된 그룹입니다.");

            await setDoc(doc(db, 'groups', groupId), {
                members: arrayUnion(user.uid),
                [`memberDetails.${user.uid}`]: { name: user.displayName || '이름 없음', joinedAt: Date.now(), photoURL: user.photoURL || '' }
            }, { merge: true });

            return { id: groupId, name: groupData.name || '공유 그룹' };
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
        }
    },
    deleteGroup: async (groupId) => {
        const user = auth.currentUser;
        if (!user) throw new Error("로그인이 필요합니다.");
        const groupRef = doc(db, 'groups', groupId);
        const groupSnap = await getDoc(groupRef);
        if (groupSnap.exists() && groupSnap.data().ownerId === user.uid) await deleteDoc(groupRef);
        else throw new Error("그룹 삭제 권한이 없습니다.");
    }
};
>>>>>>> d1348ae5447b87f69a849130f4f6a30f4c5cc4fe
