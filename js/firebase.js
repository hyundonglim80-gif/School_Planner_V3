// js/firebase.js

import { initializeApp } from "firebase/app";
// 🌟 [SP3.4 변경] initializeFirestore, 로컬 캐시 관리자, 네트워크 제어 함수(enableNetwork, disableNetwork) 추가
import { 
    initializeFirestore, 
    persistentLocalCache, 
    persistentMultipleTabManager,
    enableNetwork,
    disableNetwork,
    collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, setDoc, query, orderBy 
} from "firebase/firestore";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut as firebaseSignOut, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";

const firebaseConfig = {
    apiKey: "AIzaSyBd1z4RZnSbZWdwAIFvPOue5AaZ8wQ9ka0",
    authDomain: "schoolplannerv3.firebaseapp.com",
    projectId: "schoolplannerv3",
    storageBucket: "schoolplannerv3.firebasestorage.app",
    messagingSenderId: "906471951519",
    appId: "1:906471951519:web:1d3e6952d9579b2a9b26aa"
};

// 1. Firebase 모듈화 초기화
const app = initializeApp(firebaseConfig);

// 🌟 [SP3.4 핵심] Firestore 오프라인 캐시 및 동기화 엔진 활성화 (다중 탭 충돌 방지 포함)
export const db = initializeFirestore(app, {
    localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
    })
});

export const auth = getAuth(app);
export const storage = getStorage(app);

console.log("🔥 SP3.4 오프라인-퍼스트 Firebase 엔진이 성공적으로 연결되었습니다.");

const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });
provider.addScope('https://www.googleapis.com/auth/calendar');
provider.addScope('https://www.googleapis.com/auth/tasks');
provider.addScope('https://www.googleapis.com/auth/spreadsheets');

// 🌟 [SP3.4 추가] 네트워크 제어 함수 (온라인/오프라인 모드 전환용)
export const setNetworkOnline = async () => {
    try {
        await enableNetwork(db);
        console.log("🌐 Firebase 네트워크 켜짐 (온라인 동기화 시작)");
    } catch (error) {
        console.error("네트워크 활성화 실패:", error);
    }
};

export const setNetworkOffline = async () => {
    try {
        await disableNetwork(db);
        console.log("⚡ Firebase 네트워크 꺼짐 (오프라인 모드 진입)");
    } catch (error) {
        console.error("네트워크 비활성화 실패:", error);
    }
};

// 2. Collection Reference 반환
export const getUserCol = (collectionName) => {
    const user = auth.currentUser;
    if (!user) throw new Error("로그인이 필요합니다.");
    return collection(db, 'users', user.uid, collectionName);
};

export const signInWithGoogle = () => {
    const loginBtn = document.querySelector('#login-screen button');
    let originalHtml = '';

    if (loginBtn) {
        originalHtml = loginBtn.innerHTML;
        loginBtn.innerHTML = '⏳ 구글 팝업창에서 로그인 중...';
        loginBtn.disabled = true;
    }

    setPersistence(auth, browserLocalPersistence)
        .then(() => signInWithPopup(auth, provider))
        .then(async (result) => {
            console.log("✅ 로그인 성공:", result.user.displayName);
            const credential = GoogleAuthProvider.credentialFromResult(result);
            if (credential?.accessToken) {
                sessionStorage.setItem('google_api_token', credential.accessToken);
            }

            const loginScreen = document.getElementById('login-screen');
            const userInfo = document.getElementById('user-info');
            if (loginScreen) loginScreen.style.display = 'none';
            if (userInfo) userInfo.style.display = 'flex';

            try {
                if (window.loadSettings) await window.loadSettings();
                if (window.autoCheckAndRunMigration) await window.autoCheckAndRunMigration();
                if (window.autoForwardIncompleteEvents) await window.autoForwardIncompleteEvents();
                if (typeof window.render === 'function') window.render();
            } catch (e) {
                console.error("화면 로딩 중 에러:", e);
                if (typeof window.render === 'function') window.render();
            }
        })
        .catch(error => {
            console.error("로그인 에러:", error);
            if (error.code === 'auth/popup-closed-by-user') {
                alert("로그인 팝업창을 닫으셨습니다. 다시 시도해 주세요.");
            } else if (error.code !== 'auth/unauthorized-domain') {
                console.warn("로그인 프로세스 알림:", error.message);
            }

            if (loginBtn) {
                loginBtn.innerHTML = originalHtml;
                loginBtn.disabled = false;
            }
        });
};

export const signOut = () => {
    firebaseSignOut(auth).then(() => {
        sessionStorage.removeItem('google_api_token');
        localStorage.removeItem('workCalendar_eventLabels_v4');
        localStorage.removeItem('workCalendar_journalLabels_v4');
        localStorage.removeItem('workCalendar_memoLabels');
        window.location.href = window.location.href.split('#')[0];
    });
};

export const compressImage = (file, maxWidth = 1200) => { 
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                let { width, height } = img;
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }
                const canvas = document.createElement('canvas');
                canvas.width = width; canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob((blob) => {
                    resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }));
                }, 'image/jpeg', 0.8);
            };
        };
    });
};

// 3. 데이터베이스 조작 API
export const dbAPI = {
    loadMemos: async () => {
        try {
            const q = query(getUserCol('tasks'), orderBy('createdAt'));
            const snapshot = await getDocs(q);
            const memos = [];
            snapshot.forEach(docSnap => memos.push({ firestoreId: docSnap.id, ...docSnap.data() }));
            return memos;
        } catch (error) { return []; }
    },
    addMemo: async (memoData) => { 
        await addDoc(getUserCol('tasks'), memoData); 
    },
    updateMemo: async (firestoreId, updateData) => { 
        await updateDoc(doc(getUserCol('tasks'), firestoreId), updateData); 
    },
    deleteMemo: async function(firestoreId) {
        const docRef = doc(getUserCol('tasks'), firestoreId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().imageUrl) {
            await this.deleteImage(docSnap.data().imageUrl);
        }
        await deleteDoc(docRef);
    },
    loadDayData: async (dateStr) => {
        try {
            const eventDoc = await getDoc(doc(getUserCol('events'), dateStr));
            const scheduleDoc = await getDoc(doc(getUserCol('schedules'), dateStr));
            return { 
                eventText: eventDoc.exists() ? eventDoc.data().eventText : '', 
                periods: scheduleDoc.exists() ? scheduleDoc.data().periods : {} 
            };
        } catch (error) { return { eventText: '', periods: {} }; }
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
        try { 
            const storageRef = ref(storage, imageUrl); 
            await deleteObject(storageRef); 
        } catch(e) { console.warn("이미지 삭제 실패", e); }
    },
    // [SP3.5 변경] 다중 학급 명렬표 로드 (배열 반환)
    loadRoster: async () => {
        try {
            const docSnap = await getDoc(doc(getUserCol('settings'), 'rosters'));
            if (docSnap.exists() && docSnap.data().classList) {
                return docSnap.data().classList;
            }
            // 기존 단일 데이터 하위 호환용
            const oldSnap = await getDoc(doc(getUserCol('settings'), 'roster'));
            if (oldSnap.exists()) return [oldSnap.data()];
            return [];
        } catch (error) { return []; }
    },
    // [SP3.5 변경] 다중 학급 명렬표 저장
    saveRoster: async (classList) => {
        await setDoc(doc(getUserCol('settings'), 'rosters'), { classList, updatedAt: Date.now() }, { merge: true });
    },
    // [SP3.5 추가] 해당 날짜의 조사표/평가 로드
    loadEvaluations: async (dateStr) => {
        try {
            const docSnap = await getDoc(doc(getUserCol('evaluations'), dateStr));
            return docSnap.exists() ? docSnap.data().evalList || [] : [];
        } catch (error) { return []; }
    },
    // [SP3.5 추가] 해당 날짜의 조사표/평가 저장
    saveEvaluations: async (dateStr, evalList) => {
        await setDoc(doc(getUserCol('evaluations'), dateStr), { evalList, updatedAt: Date.now() }, { merge: true });
    }
};

export const forceRenewToken = async () => {
    const renewProvider = new GoogleAuthProvider();
    renewProvider.addScope('https://www.googleapis.com/auth/calendar');
    renewProvider.addScope('https://www.googleapis.com/auth/tasks');
    renewProvider.addScope('https://www.googleapis.com/auth/spreadsheets');

    try {
        const result = await signInWithPopup(auth, renewProvider);
        const credential = GoogleAuthProvider.credentialFromResult(result);
        if (credential?.accessToken) {
            sessionStorage.setItem('google_api_token', credential.accessToken);
            return credential.accessToken;
        }
    } catch (error) {
        console.error("권한 연장 에러:", error);
        if (error.code === 'auth/popup-blocked') {
            throw new Error("팝업 차단이 감지되었습니다. 브라우저 주소창 우측에서 '팝업 차단 해제'를 해주세요.", { cause: error });
        }
        throw new Error("권한 연장에 실패했습니다. 우측 상단의 로그아웃 후 다시 로그인해 주세요.", { cause: error });
    }
    return null;
};

export const getValidGoogleToken = async () => {
    let token = sessionStorage.getItem('google_api_token');
    if (!token) {
        alert("구글 서비스 연동 권한이 없습니다.\n[확인]을 누르시면 즉시 권한을 갱신합니다.");
        return await forceRenewToken();
    }
    try {
        const res = await fetch('https://oauth2.googleapis.com/tokeninfo?access_token=' + token);
        if (res.ok) return token;
    } catch (e) {
        console.warn("토큰 검증 실패 (만료됨)");
    }
    alert("보안 정책(1시간 제한)으로 구글 연결이 만료되었습니다.\n[확인]을 누르시면 화면 이동 없이 자동으로 1시간 연장됩니다!");
    return await forceRenewToken();
};

// ==========================================================================
// 🌉 과도기 호환성 레이어 
// ==========================================================================
window.getUserCol = getUserCol;
window.signInWithGoogle = signInWithGoogle;
window.signOut = signOut;
window.compressImage = compressImage;
window.dbAPI = dbAPI;
window.forceRenewToken = forceRenewToken;
window.getValidGoogleToken = getValidGoogleToken;
window.db = db;
window.auth = auth;
window.setNetworkOnline = setNetworkOnline;
window.setNetworkOffline = setNetworkOffline;