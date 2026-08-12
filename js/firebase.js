// js/firebase.js

const firebaseConfig = {
    apiKey: "AIzaSyBd1z4RZnSbZWdwAIFvPOue5AaZ8wQ9ka0",
    authDomain: "schoolplannerv3.firebaseapp.com",
    projectId: "schoolplannerv3",
    storageBucket: "schoolplannerv3.firebasestorage.app",
    messagingSenderId: "906471951519",
    appId: "1:906471951519:web:1d3e6952d9579b2a9b26aa"
};

// ==========================================================
// 1. Firebase 초기화 및 연결
// ==========================================================
if (typeof firebase !== 'undefined') {
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    window.db = firebase.firestore();
    window.auth = firebase.auth(); 
    window.storage = firebase.storage(); 
    console.log("🔥 Firebase가 성공적으로 연결되었습니다.");
    
    window.auth.getRedirectResult()
        .then((result) => {
            if (result && result.user) {
                console.log("✅ 리다이렉트 로그인 성공:", result.user.displayName);
                if (result.credential && result.credential.accessToken) {
                    sessionStorage.setItem('google_api_token', result.credential.accessToken);
                    console.log("🔑 구글 API 토큰 저장 완료");
                }
            }
        })
        .catch(error => {
            console.error("리다이렉트 로그인 에러:", error);
            if (error.code !== 'auth/redirect-cancelled-by-user') {
                alert("로그인 처리 중 문제가 발생했습니다: " + error.message);
            }
        });
}

const provider = new firebase.auth.GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });
provider.addScope('https://www.googleapis.com/auth/calendar');
provider.addScope('https://www.googleapis.com/auth/tasks');
provider.addScope('https://www.googleapis.com/auth/spreadsheets'); 

// ==========================================================
// 2. 로그인 / 로그아웃 제어 함수
// ==========================================================
window.signInWithGoogle = function() {
    const loginBtn = document.querySelector('#login-screen button');
    let originalHtml = '';
    
    if (loginBtn) {
        originalHtml = loginBtn.innerHTML;
        loginBtn.innerHTML = '⏳ 구글 연결 중 (화면이 이동합니다)...';
        loginBtn.disabled = true;
    }

    window.auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
        .then(() => {
            // 💡 무조건 화면 이동(Redirect) 방식으로 실행 (팝업 차단 방지)
            return window.auth.signInWithRedirect(provider);
        })
        .catch(error => {
            console.error("로그인 화면 이동 실패:", error);
            alert("로그인 화면 이동 중 오류가 발생했습니다: " + error.message);
            if (loginBtn) {
                loginBtn.innerHTML = originalHtml;
                loginBtn.disabled = false;
            }
        });
};

window.signOut = function() {
  window.auth.signOut().then(() => {
    sessionStorage.removeItem('google_api_token');
    window.location.href = window.location.href.split('#')[0];
  });
};

window.getUserCol = function(collectionName) {
  const user = window.auth.currentUser;
  if (!user) throw new Error("로그인이 필요합니다.");
  return window.db.collection('users').doc(user.uid).collection(collectionName);
};

// ==========================================================
// 3. 이미지 압축기 및 데이터베이스 API
// ==========================================================
window.compressImage = function(file, maxWidth = 1200) { 
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
// 4. 구글 API 토큰 스마트 연장 시스템 (Redirect 완벽 대응)
// ==========================================================
window.getValidGoogleToken = async function() {
    let token = sessionStorage.getItem('google_api_token');

    if (!token) {
        alert("구글 서비스 연동 권한이 없습니다.\n[확인]을 누르시면 즉시 권한을 갱신합니다.");
        return await window.forceRenewToken();
    }

    try {
        const res = await fetch('https://oauth2.googleapis.com/tokeninfo?access_token=' + token);
        if (res.ok) return token;
    } catch (e) {
        console.warn("토큰 검증 실패 (만료됨)");
    }

    alert("보안 정책(1시간 제한)으로 구글 연결이 만료되었습니다.\n[확인]을 누르시면 안전을 위해 데이터를 저장하고 다시 인증 화면으로 이동합니다.");
    return await window.forceRenewToken();
};

window.forceRenewToken = async function() {
    const renewProvider = new firebase.auth.GoogleAuthProvider();
    renewProvider.addScope('https://www.googleapis.com/auth/calendar');
    renewProvider.addScope('https://www.googleapis.com/auth/tasks');
    renewProvider.addScope('https://www.googleapis.com/auth/spreadsheets');
    
    // 💡 화면 이동 전 작성 중이던 데이터 강제 백업
    try {
        if (window.hasUnsavedChanges && window.currentScope) {
            if (window.currentScope === 'day' && window.dayViewInstance) await window.dayViewInstance.save();
            else if (window.currentScope === 'week' && window.weekViewInstance) await window.weekViewInstance.save();
            else if (window.currentScope === 'month' && window.monthViewInstance) await window.monthViewInstance.save();
            else if (window.currentScope === 'year' && window.yearViewInstance) await window.yearViewInstance.save();
        }
    } catch(e) { console.warn("이동 전 임시 저장 실패", e); }
    
    // 💡 팝업 차단(COOP 에러) 방지를 위해 Redirect 실행
    window.auth.signInWithRedirect(renewProvider);
    return null; // 화면이 넘어가므로 이 아래 코드는 실행되지 않음
};
