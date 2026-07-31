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
// 💡 구글 계정 선택 화면을 무조건 강제로 띄우도록 설정 (계정 꼬임 방지)
provider.setCustomParameters({
  prompt: 'select_account'
});

// ==========================================================
// 🚨 [핵심 수정] 가장 안정적인 팝업 로그인 방식으로 복구
// (사용자 클릭 이벤트 안에서 즉시 실행되어 브라우저 차단을 피합니다)
// ==========================================================
window.signInWithGoogle = function() {
    const loginBtn = document.querySelector('#login-screen button');
    let originalHtml = '';
    
    if (loginBtn) {
        originalHtml = loginBtn.innerHTML;
        loginBtn.innerHTML = '⏳ 팝업창에서 로그인해주세요...';
        loginBtn.disabled = true;
    }

    // 기본 세션 유지 방식(브라우저 닫아도 유지)을 명시적으로 선언한 후 팝업 띄우기
    window.auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
        .then(() => {
            return window.auth.signInWithPopup(provider);
        })
        .then((result) => {
            console.log("✅ 로그인 성공:", result.user.displayName);
            // 💡 로그인이 성공하면 onAuthStateChanged 가 발동하여 화면이 전환되므로
            // 여기서 별도의 화면 전환 코드를 넣지 않습니다.
        })
        .catch(error => {
            console.error("로그인 실패:", error);
            // 팝업이 차단당했거나 사용자가 닫은 경우의 에러 메시지
            if (error.code === 'auth/popup-closed-by-user') {
                alert("로그인 팝업창을 닫으셨습니다. 다시 시도해 주세요.");
            } else if (error.code === 'auth/popup-blocked') {
                alert("브라우저에서 팝업이 차단되었습니다. 주소창 오른쪽의 팝업 차단 해제 아이콘을 눌러 허용해 주세요.");
            } else {
                alert("로그인 중 문제가 발생했습니다: " + error.message);
            }
            
            // 버튼 상태 원상 복구
            if (loginBtn) {
                loginBtn.innerHTML = originalHtml;
                loginBtn.disabled = false;
            }
        });
};

window.signOut = function() {
  window.auth.signOut().then(() => {
    // 로그아웃 시 캐시를 무시하고 서버에서 강제로 새 페이지를 받아오도록 처리
    window.location.href = window.location.href.split('#')[0];
  });
};

window.getUserCol = function(collectionName) {
  const user = window.auth.currentUser;
  if (!user) throw new Error("로그인이 필요합니다.");
  return window.db.collection('users').doc(user.uid).collection(collectionName);
};

// ==========================================================
// 🖼️ 마법의 이미지 자동 압축기
// ==========================================================
window.compressImage = function(file, maxWidth = 1200) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                let width = img.width;
                let height = img.height;
                
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }
                
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                canvas.toBlob((blob) => {
                    const compressedFile = new File([blob], file.name, {
                        type: 'image/jpeg',
                        lastModified: Date.now()
                    });
                    resolve(compressedFile);
                }, 'image/jpeg', 0.8);
            };
        };
    });
};

// ==========================================================
// 💡 데이터베이스 조작 API
// ==========================================================
window.dbAPI = {
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
    const doc = await window.getUserCol('tasks').doc(firestoreId).get();
    if (doc.exists && doc.data().imageUrl) {
        await this.deleteImage(doc.data().imageUrl);
    }
    await window.getUserCol('tasks').doc(firestoreId).delete();
  },

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
  },

  // 스토리지 업로드
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
      try {
          const storageRef = window.storage.refFromURL(imageUrl);
          await storageRef.delete();
      } catch(e) { console.warn("이미지 삭제 실패", e); }
  }
};
