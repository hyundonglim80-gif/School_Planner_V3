// js/firebase.js

// 1. Firebase 프로젝트 설정 (이전 대화 기록에서 복구)
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
    // 🚀 [수정됨] 구글 로그인 함수 (팝업 차단 에러 방지를 위해 Redirect 방식 사용)
    // ==========================================================================
    window.signInWithGoogle = function() {
        const provider = new firebase.auth.GoogleAuthProvider();
        
        const loginBtn = document.getElementById('btn-login');
        if (loginBtn) {
            loginBtn.innerHTML = "로그인 화면으로 이동 중...";
            loginBtn.disabled = true;
        }

        // signInWithPopup 대신 signInWithRedirect 사용
        firebase.auth().signInWithRedirect(provider);
    };

    // 로그아웃 함수
    window.signOut = function() {
        firebase.auth().signOut().then(() => {
            console.log("✅ 로그아웃 되었습니다.");
            window.location.reload(); // 로그아웃 후 화면 새로고침
        }).catch(error => {
            console.error("❌ 로그아웃 에러:", error);
        });
    };

    // 로그인 진행 후 원래 페이지로 돌아왔을 때의 결과를 처리하는 로직
    firebase.auth().getRedirectResult().then((result) => {
        if (result && result.user) {
            console.log("✅ 구글 로그인 인증 성공 (Redirect):", result.user.displayName);
        }
    }).catch((error) => {
        console.error("❌ Redirect 로그인 에러:", error);
        alert("로그인 중 오류가 발생했습니다: " + error.message);
        const loginBtn = document.getElementById('btn-login');
        if (loginBtn) {
            loginBtn.innerHTML = "Google 계정으로 로그인";
            loginBtn.disabled = false;
        }
    });

} else {
    console.error("🔥 Firebase 라이브러리가 로드되지 않았습니다. index.html의 스크립트 태그를 확인해주세요.");
}

// 💡 헬퍼 함수: 현재 로그인한 사용자의 컬렉션 경로를 쉽게 가져오기 위한 함수
window.getUserCol = function(colName) {
    if (!window.auth || !window.auth.currentUser) {
        throw new Error("로그인이 필요합니다.");
    }
    return window.db.collection('users').doc(window.auth.currentUser.uid).collection(colName);
};
