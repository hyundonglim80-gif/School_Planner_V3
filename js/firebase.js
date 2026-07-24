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
}
