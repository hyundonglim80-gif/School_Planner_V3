// js/api/firebaseInit.js
import { initializeApp } from "firebase/app";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
    apiKey: "AIzaSyBd1z4RZnSbZWdwAIFvPOue5AaZ8wQ9ka0",
    authDomain: "schoolplannerv3.firebaseapp.com",
    projectId: "schoolplannerv3",
    storageBucket: "schoolplannerv3.firebasestorage.app",
    messagingSenderId: "906471951519",
    appId: "1:906471951519:web:1d3e6952d9579b2a9b26aa"
};

export const app = initializeApp(firebaseConfig);

export const db = initializeFirestore(app, {
    localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
    })
});

export const auth = getAuth(app);
export const storage = getStorage(app);

console.log("🔥 SP3.7 공유 그룹 기반 오프라인-퍼스트 Firebase 엔진 연결 완료.");