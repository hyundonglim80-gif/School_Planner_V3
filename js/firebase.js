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
// 💡 로그인 시 계정 선택창 띄우기
provider.setCustomParameters({ prompt: 'select_account' });

// 🌟 [핵심 추가] 구글 캘린더 및 Tasks(할 일) 권한(Scope) 요청
provider.addScope('https://www.googleapis.com/auth/calendar');
provider.addScope('https://www.googleapis.com/auth/tasks');
provider.addScope('https://www.googleapis.com/auth/spreadsheets'); // 🟢 새로 추가된 구글 시트 접근 권한

// js/firebase.js

window.signInWithGoogle = function() {
    const loginBtn = document.querySelector('#login-screen button');
    let originalHtml = '';
    
    if (loginBtn) {
        originalHtml = loginBtn.innerHTML;
        loginBtn.innerHTML = '⏳ 구글 로그인 화면으로 이동 중...';
        loginBtn.disabled = true;
    }

    window.auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
        .then(() => {
            // 💡 [핵심 변경] 보안 정책 차단을 피하기 위해 Popup 대신 Redirect 사용
            return window.auth.signInWithRedirect(provider);
        })
        .catch(error => {
            console.error("로그인 화면 이동 실패:", error);
            alert("로그인 화면으로 이동 중 문제가 발생했습니다: " + error.message);
            if (loginBtn) {
                loginBtn.innerHTML = originalHtml;
                loginBtn.disabled = false;
            }
        });
};

// 💡 [신규 추가] 화면이 구글 로그인을 거쳐 다시 돌아왔을 때 결과를 가로채는 로직
// 이 코드는 signInWithGoogle 함수 바깥(파일 하단 등)에 독립적으로 위치해야 합니다.
window.auth.getRedirectResult()
    .then((result) => {
        if (result && result.user) {
            console.log("✅ 로그인 성공:", result.user.displayName);
            // 🌟 [핵심 유지] 동기화에 사용할 구글 API 토큰을 성공적으로 받아와 저장합니다.
            if (result.credential && result.credential.accessToken) {
                sessionStorage.setItem('google_api_token', result.credential.accessToken);
            }
        }
    })
    .catch(error => {
        console.error("리다이렉트 로그인 실패:", error);
        // 사용자가 로그인을 취소하고 돌아온 경우 등 에러 처리
        if (error.code !== 'auth/redirect-cancelled-by-user') {
            alert("로그인 처리 중 문제가 발생했습니다: " + error.message);
        }
    });

window.signOut = function() {
  window.auth.signOut().then(() => {
    sessionStorage.removeItem('google_api_token'); // 로그아웃 시 토큰 삭제
    window.location.href = window.location.href.split('#')[0];
  });
};

window.getUserCol = function(collectionName) {
  const user = window.auth.currentUser;
  if (!user) throw new Error("로그인이 필요합니다.");
  return window.db.collection('users').doc(user.uid).collection(collectionName);
};

// ==========================================================
// 🖼️ 이미지 압축기 및 데이터베이스 API (기존 코드 유지)
// ==========================================================
window.compressImage = function(file, maxWidth = 1200) { /* 기존과 동일 */ 
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                let width = img.width; let height = img.height;
                if (width > maxWidth) { height = Math.round((height * maxWidth) / width); width = maxWidth; }
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

window.dbAPI = {
  loadMemos: async function() {
    try {
      const snapshot = await window.getUserCol('tasks').orderBy('createdAt').get();
      const memos = [];
      snapshot.forEach(doc => memos.push({ firestoreId: doc.id, ...doc.data() }));
      return memos;
    } catch (error) { return []; }
  },
  addMemo: async function(memoData) { await window.getUserCol('tasks').add(memoData); },
  updateMemo: async function(firestoreId, updateData) { await window.getUserCol('tasks').doc(firestoreId).update(updateData); },
  deleteMemo: async function(firestoreId) {
    const doc = await window.getUserCol('tasks').doc(firestoreId).get();
    if (doc.exists && doc.data().imageUrl) { await this.deleteImage(doc.data().imageUrl); }
    await window.getUserCol('tasks').doc(firestoreId).delete();
  },
  loadDayData: async function(dateStr) {
    try {
      const eventDoc = await window.getUserCol('events').doc(dateStr).get();
      const scheduleDoc = await window.getUserCol('schedules').doc(dateStr).get();
      return { eventText: eventDoc.exists ? eventDoc.data().eventText : '', periods: scheduleDoc.exists ? scheduleDoc.data().periods : {} };
    } catch (error) { return { eventText: '', periods: {} }; }
  },
  saveEvent: async function(dateStr, eventText) { await window.getUserCol('events').doc(dateStr).set({ eventText: eventText, updatedAt: Date.now() }, { merge: true }); },
  saveSchedule: async function(dateStr, periodsData) { await window.getUserCol('schedules').doc(dateStr).set({ periods: periodsData, updatedAt: Date.now() }, { merge: true }); },
  uploadImage: async function(file, folderName = 'memo_images') {
      const user = window.auth.currentUser;
      if (!user) throw new Error("로그인이 필요합니다.");
      const compressedFile = await window.compressImage(file);
      const filePath = `${folderName}/${user.uid}/${Date.now()}_${compressedFile.name}`;
      const storageRef = window.storage.ref().child(filePath);
      await storageRef.put(compressedFile);
      return await storageRef.getDownloadURL();
  },
  deleteImage: async function(imageUrl) {
      try { const storageRef = window.storage.refFromURL(imageUrl); await storageRef.delete(); } catch(e) { console.warn("이미지 삭제 실패", e); }
  }
};

// ==========================================================
// 🔄 구글 API 토큰(열쇠) 스마트 자동 연장 시스템 추가
// ==========================================================
window.getValidGoogleToken = async function() {
    let token = sessionStorage.getItem('google_api_token');

    // 1. 토큰이 아예 없는 경우
    if (!token) {
        alert("구글 서비스 연동 권한이 없습니다.\n[확인]을 누르시면 즉시 권한을 갱신합니다.");
        return await window.forceRenewToken();
    }

    // 2. 토큰이 살아있는지 구글 서버에 0.1초 만에 물어보기
    try {
        const res = await fetch('https://oauth2.googleapis.com/tokeninfo?access_token=' + token);
        if (res.ok) return token; // 유효하면 딜레이 없이 그대로 통과!
    } catch (e) {
        console.warn("토큰 검증 실패 (만료됨)");
    }

    // 3. 1시간이 지나 만료된 경우 (스마트 연장 실행)
    alert("보안 정책(1시간 제한)으로 구글 연결이 만료되었습니다.\n[확인]을 누르시면 화면 이동 없이 1초 만에 자동으로 1시간 연장됩니다!");
    return await window.forceRenewToken();
};

window.forceRenewToken = async function() {
    const renewProvider = new firebase.auth.GoogleAuthProvider();
    renewProvider.addScope('https://www.googleapis.com/auth/calendar');
    renewProvider.addScope('https://www.googleapis.com/auth/tasks');
    renewProvider.addScope('https://www.googleapis.com/auth/spreadsheets');
    // 💡 [핵심] 계정 선택(prompt) 옵션을 뺐기 때문에, 팝업이 번쩍! 하고 1초 만에 스스로 닫히며 갱신됩니다.

    try {
        const result = await window.auth.signInWithPopup(renewProvider);
        if (result.credential && result.credential.accessToken) {
            sessionStorage.setItem('google_api_token', result.credential.accessToken);
            return result.credential.accessToken;
        }
    } catch (error) {
        console.error("권한 연장 에러:", error);
        if (error.code === 'auth/popup-blocked') {
            throw new Error("팝업 차단이 감지되었습니다. 브라우저 주소창 우측에서 '팝업 차단 해제'를 해주세요.");
        }
        throw new Error("권한 연장에 실패했습니다. 우측 상단의 로그아웃 후 다시 로그인해 주세요.");
    }
    return null;
};
