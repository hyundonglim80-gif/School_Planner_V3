// js/firebase.js (기존 내용 유지하되, signInWithGoogle 부분만 교체)

const firebaseConfig = {
  apiKey: "AIzaSyBd1z4RZnSbZWdwAIFvPOue5AaZ8wQ9ka0",
  authDomain: "schoolplannerv3.firebaseapp.com",
  projectId: "schoolplannerv3",
  storageBucket: "schoolplannerv3.firebasestorage.app", // (주의: 이 부분은 선생님의 실제 버킷 주소로 유지하세요)
  messagingSenderId: "906471951519",
  appId: "1:906471951519:web:1d3e6952d9579b2a9b26aa"
};

if (typeof firebase !== 'undefined') {
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
  window.db = firebase.firestore();
  window.auth = firebase.auth(); 
  window.storage = firebase.storage(); 
  console.log("🔥 Firebase가 성공적으로 연결되었습니다.");
}

const provider = new firebase.auth.GoogleAuthProvider();

// ==========================================================
// 🚨 [핵심 수정] 팝업 방식 대신 Redirect(화면 전환) 방식으로 변경
// ==========================================================
window.signInWithGoogle = function() {
    // signInWithPopup 대신 signInWithRedirect 사용
    window.auth.signInWithRedirect(provider).catch(error => {
        console.error("로그인 리디렉션 실패:", error);
        alert("로그인 중 문제가 발생했습니다.");
    });
};

// 리디렉션 후 돌아왔을 때 결과를 처리하는 안전 장치 추가
window.auth.getRedirectResult().then((result) => {
    if (result.user) {
        console.log("✅ 리디렉션 로그인 성공:", result.user.displayName);
    }
}).catch((error) => {
    console.error("리디렉션 로그인 처리 중 오류:", error);
});

window.signOut = function() {
  window.auth.signOut().then(() => {
    window.location.reload(); 
  });
};

window.getUserCol = function(collectionName) {
  const user = window.auth.currentUser;
  if (!user) throw new Error("로그인이 필요합니다.");
  return window.db.collection('users').doc(user.uid).collection(collectionName);
};

// ... (이하 compressImage 등 기존 코드 그대로 유지) ...
