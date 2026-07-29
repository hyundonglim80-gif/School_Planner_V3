// js/firebase.js

const firebaseConfig = {
  apiKey: "AIzaSyBd1z4RZnSbZWdwAIFvPOue5AaZ8wQ9ka0",
  authDomain: "schoolplannerv3.firebaseapp.com",
  projectId: "schoolplannerv3",
  storageBucket: "schoolplannerv3.firebasestorage.app",
  messagingSenderId: "906471951519",
  appId: "1:906471951519:web:1d3e6952d9579b2a9b26aa"
};

if (typeof firebase !== 'undefined') {
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
  window.db = firebase.firestore();
  window.auth = firebase.auth(); // 💡 인증(Auth) 서비스 초기화
  console.log("🔥 Firebase가 성공적으로 연결되었습니다.");
}

// 💡 1. 구글 로그인 및 로그아웃 기능 설정
const provider = new firebase.auth.GoogleAuthProvider();
window.signInWithGoogle = function() {
  window.auth.signInWithPopup(provider).catch(error => {
    console.error("로그인 실패:", error);
    alert("로그인 중 문제가 발생했습니다.");
  });
};
window.signOut = function() {
  window.auth.signOut().then(() => {
    // 로그아웃 시 페이지 새로고침
    window.location.reload(); 
  });
};

// 💡 2. 개인별 데이터 폴더(UID) 경로 반환 도우미 함수
// 이 함수 덕분에 A선생님과 B선생님의 데이터가 서로 절대 섞이지 않습니다!
window.getUserCol = function(collectionName) {
  const user = window.auth.currentUser;
  if (!user) throw new Error("로그인이 필요합니다.");
  return window.db.collection('users').doc(user.uid).collection(collectionName);
};

// ==========================================================
// 💡 3. 데이터베이스 조작 API (개인별 경로 getUserCol 사용)
// ==========================================================
window.dbAPI = {

  // 📝 메모장 기능
  loadMemos: async function() {
    try {
      const snapshot = await window.getUserCol('tasks').orderBy('createdAt').get();
      const memos = [];
      snapshot.forEach(doc => memos.push({ firestoreId: doc.id, ...doc.data() }));
      return memos;
    } catch (error) { return []; }
  },
  addMemo: async function(memoData) {
    await window.getUserCol('tasks').add(memoData);
  },
  updateMemo: async function(firestoreId, updateData) {
    await window.getUserCol('tasks').doc(firestoreId).update(updateData);
  },
  deleteMemo: async function(firestoreId) {
    await window.getUserCol('tasks').doc(firestoreId).delete();
  },

  // 📅 학사 일정 및 시간표 기능
  loadDayData: async function(dateStr) {
    try {
      const eventDoc = await window.getUserCol('events').doc(dateStr).get();
      const scheduleDoc = await window.getUserCol('schedules').doc(dateStr).get();
      return {
        eventText: eventDoc.exists ? eventDoc.data().eventText : '',
        periods: scheduleDoc.exists ? scheduleDoc.data().periods : {}
      };
    } catch (error) { return { eventText: '', periods: {} }; }
  },
  saveEvent: async function(dateStr, eventText) {
    await window.getUserCol('events').doc(dateStr).set({
      eventText: eventText, updatedAt: Date.now()
    }, { merge: true });
  },
  saveSchedule: async function(dateStr, periodsData) {
    await window.getUserCol('schedules').doc(dateStr).set({
      periods: periodsData, updatedAt: Date.now()
    }, { merge: true });
  }
};
