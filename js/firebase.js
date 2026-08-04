// js/firebase.js

// 1. Firebase 프로젝트 설정
const firebaseConfig = {
    apiKey: "AIzaSyBd1z4RZnSbZWdwAIFvPOue5AaZ8wQ9ka0",
    authDomain: "schoolplannerv3.firebaseapp.com",
    projectId: "schoolplannerv3",
    storageBucket: "schoolplannerv3.firebasestorage.app",
    messagingSenderId: "906471951519",
    appId: "1:906471951519:web:1d3e6952d9579b2a9b26aa"
};

// 2. Firebase 초기화 및 전역 변수 설정
if (typeof firebase !== 'undefined') {
    // 중복 초기화 방지
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    
    window.db = firebase.firestore();
    window.auth = firebase.auth();
    window.storage = firebase.storage();

    // ==========================================================================
    // 🚀 구글 로그인 함수 (Popup 방식으로 원복)
    // 판단 근거: 사용자가 Redirect 방식 적용 후 로그인 팝업이 뜨지 않는다고 하여 이전 상태로 복구 요청함
    // ==========================================================================
    window.signInWithGoogle = function() {
        const provider = new firebase.auth.GoogleAuthProvider();
        
        const loginBtn = document.getElementById('btn-login');
        if (loginBtn) {
            loginBtn.innerHTML = "로그인 처리 중...";
            loginBtn.disabled = true;
        }

        firebase.auth().signInWithPopup(provider).then((result) => {
            console.log("✅ 구글 로그인 인증 성공:", result.user.displayName);
        }).catch((error) => {
            console.error("❌ 로그인 에러:", error);
            alert("로그인 중 오류가 발생했습니다: " + error.message);
            if (loginBtn) {
                loginBtn.innerHTML = "Google 계정으로 로그인";
                loginBtn.disabled = false;
            }
        });
    };

    // 로그아웃 함수
    window.signOut = function() {
        firebase.auth().signOut().then(() => {
            console.log("✅ 로그아웃 되었습니다.");
            window.location.reload(); 
        }).catch(error => {
            console.error("❌ 로그아웃 에러:", error);
        });
    };
} else {
    console.error("🔥 Firebase 라이브러리가 로드되지 않았습니다. index.html의 스크립트 태그를 확인해주세요.");
}

// 💡 헬퍼 함수: 현재 로그인한 사용자의 컬렉션 경로 반환
window.getUserCol = function(colName) {
    if (!window.auth || !window.auth.currentUser) {
        throw new Error("로그인이 필요합니다.");
    }
    return window.db.collection('users').doc(window.auth.currentUser.uid).collection(colName);
};
