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

// 💡 [핵심] 리디렉션 방식 로그인 및 UI 상태 방어 처리
window.signInWithGoogle = function() {
    const loginBtn = document.querySelector('#login-screen button');
    if (loginBtn) {
        loginBtn.innerHTML = '⏳ 구글 인증으로 이동 중...';
        loginBtn.disabled = true;
    }

    // 확실하게 로컬(브라우저)에 인증 정보를 기억하도록 강제한 뒤 리디렉션
    window.auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
        .then(() => {
            return window.auth.signInWithRedirect(provider);
        })
        .catch(error => {
            console.error("로그인 리디렉션 실패:", error);
            alert("로그인 중 문제가 발생했습니다: " + error.message);
            if (loginBtn) {
                loginBtn.innerHTML = 'Google 계정으로 로그인';
                loginBtn.disabled = false;
            }
        });
};

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
