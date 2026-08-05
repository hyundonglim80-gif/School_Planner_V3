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
  window.auth = firebase.auth(); 
  window.storage = firebase.storage(); 
  console.log("🔥 Firebase가 성공적으로 연결되었습니다.");
}

const provider = new firebase.auth.GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

// 구글 동기화를 위한 권한(Scope) 요청
provider.addScope('https://www.googleapis.com/auth/calendar');
provider.addScope('https://www.googleapis.com/auth/tasks');
provider.addScope('https://www.googleapis.com/auth/spreadsheets'); 

// 💡 COOP 팝업 차단 에러를 막기 위해 Redirect(페이지 이동) 방식 적용
window.signInWithGoogle = function() {
    const loginBtn = document.querySelector('#login-screen button');
    if(loginBtn) loginBtn.textContent = '구글 페이지로 이동 중...';
    window.auth.signInWithRedirect(provider);
};

// 로그인 결과 받아오기
window.auth.getRedirectResult().then((result) => {
    if (result && result.user) {
        console.log("✅ 로그인 성공:", result.user.displayName);
    }
}).catch((error) => {
    console.error("로그인 에러:", error);
});

window.signOutWithGoogle = function() {
    window.auth.signOut().then(() => {
        console.log("로그아웃 성공");
        window.location.reload();
    }).catch((error) => {
        console.error("로그아웃 에러:", error);
    });
};

// 토큰 갱신 로직
window.getValidToken = async function() {
    const currentUser = window.auth.currentUser;
    if (!currentUser) return null;

    try {
        const token = await currentUser.getIdToken(false);
        if (!token) return await window.forceRenewToken();
        
        const res = await fetch('https://oauth2.googleapis.com/tokeninfo?access_token=' + token);
        if (res.ok) return token; 
    } catch (e) {
        console.warn("토큰 검증 실패 (만료됨)");
    }

    alert("보안 정책(1시간 제한)으로 구글 연결이 만료되었습니다.\\n[확인]을 누르시면 자동으로 연장됩니다!");
    return await window.forceRenewToken();
};

window.forceRenewToken = async function() {
    const renewProvider = new firebase.auth.GoogleAuthProvider();
    renewProvider.addScope('https://www.googleapis.com/auth/calendar');
    renewProvider.addScope('https://www.googleapis.com/auth/tasks');
    renewProvider.addScope('https://www.googleapis.com/auth/spreadsheets');
    
    try {
        const result = await window.auth.signInWithPopup(renewProvider); 
        return await result.user.getIdToken(true);
    } catch(error) {
        console.error("토큰 갱신 실패:", error);
        return null;
    }
};
