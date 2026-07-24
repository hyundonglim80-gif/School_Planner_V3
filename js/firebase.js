// js/firebase.js

// 🚨 주의: import 문장은 사용하지 않습니다! (index.html에서 이미 불러왔습니다)

// Firebase 프로젝트 설정
const firebaseConfig = {
  apiKey: "AIzaSyBd1z4RZnSbZWdwAIFvPOue5AaZ8wQ9ka0",
  authDomain: "schoolplannerv3.firebaseapp.com",
  projectId: "schoolplannerv3",
  storageBucket: "schoolplannerv3.firebasestorage.app",
  messagingSenderId: "906471951519",
  appId: "1:906471951519:web:1d3e6952d9579b2a9b26aa"
};

// 안전한 Firebase 초기화 (중복 초기화 방지)
if (typeof firebase !== 'undefined') {
  // 아직 초기화된 앱이 없을 때만 초기화 진행
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
  
  // Firestore 객체를 전역(window)에 등록하여 다른 js 파일에서도 쓸 수 있게 함
  window.db = firebase.firestore();
  
  console.log("🔥 Firebase Firestore가 성공적으로 연결되었습니다.");

} else {
  console.error("❌ Firebase SDK 라이브러리를 불러오지 못했습니다. index.html의 CDN 태그를 확인해 주세요.");
};

// Firestore 데이터베이스 조작 함수 모음 (전역에서 사용할 수 있게 window.dbAPI로 묶습니다)
// Firestore 데이터베이스 조작 함수 모음 (메모장 + 주간계획표 통합)
window.dbAPI = {

  // ==========================================
  // 📝 1. 메모장 기능 (기존 기능 100% 유지)
  // ==========================================
  loadMemos: async function() {
    try {
      const snapshot = await window.db.collection('tasks').orderBy('createdAt').get();
      const memos = [];
      snapshot.forEach(doc => {
        memos.push({ firestoreId: doc.id, ...doc.data() });
      });
      return memos;
    } catch (error) {
      console.error("메모 불러오기 실패:", error);
      return [];
    }
  },

  addMemo: async function(memoData) {
    try {
      await window.db.collection('tasks').add(memoData);
    } catch (error) {
      console.error("메모 저장 실패:", error);
    }
  },

  updateMemo: async function(firestoreId, updateData) {
    try {
      await window.db.collection('tasks').doc(firestoreId).update(updateData);
    } catch (error) {
      console.error("메모 업데이트 실패:", error);
    }
  },

  deleteMemo: async function(firestoreId) {
    try {
      await window.db.collection('tasks').doc(firestoreId).delete();
    } catch (error) {
      console.error("메모 삭제 실패:", error);
    }
  },

  // ==========================================
  // 📅 2. 하루치 데이터 (일정 + 교시별 수업) 기능 (새로 추가)
  // ==========================================
  loadDayData: async function(dateStr) {
    try {
      const eventDoc = await window.db.collection('events').doc(dateStr).get();
      const scheduleDoc = await window.db.collection('schedules').doc(dateStr).get();

      return {
        eventText: eventDoc.exists ? eventDoc.data().eventText : '',
        periods: scheduleDoc.exists ? scheduleDoc.data().periods : {}
      };
    } catch (error) {
      console.error("일자 데이터 불러오기 실패:", error);
      return { eventText: '', periods: {} };
    }
  },

  saveEvent: async function(dateStr, eventText) {
    try {
      await window.db.collection('events').doc(dateStr).set({
        eventText: eventText,
        updatedAt: Date.now()
      }, { merge: true });
    } catch (error) {
      console.error("일정 저장 실패:", error);
    }
  },

  saveSchedule: async function(dateStr, periodsData) {
    try {
      await window.db.collection('schedules').doc(dateStr).set({
        periods: periodsData,
        updatedAt: Date.now()
      }, { merge: true });
    } catch (error) {
      console.error("수업 저장 실패:", error);
    }
  }

};
