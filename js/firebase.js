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
  // 💡 [신규] 파일 저장을 위한 Storage 서비스 초기화
  window.storage = firebase.storage(); 
  console.log("🔥 Firebase가 성공적으로 연결되었습니다.");
}

const provider = new firebase.auth.GoogleAuthProvider();
window.signInWithGoogle = function() {
  window.auth.signInWithPopup(provider).catch(error => {
    console.error("로그인 실패:", error);
    alert("로그인 중 문제가 발생했습니다.");
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
// 🖼️ [신규] 마법의 이미지 자동 압축기 (데이터 과부하 방지)
// 스마트폰으로 찍은 5MB짜리 사진도 0.5MB 이하로 슉! 줄여줍니다.
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
                
                // 가로 너비가 1200px을 넘으면 비율에 맞춰 축소
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }
                
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                // 0.8 품질의 JPEG로 변환하여 출력 (용량 최적화)
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

  // 📝 메모장 기능
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
    // 💡 [수정] 메모를 지울 때, 첨부된 이미지 사진 파일도 Storage에서 찾아 함께 깔끔히 지워줍니다.
    const doc = await window.getUserCol('tasks').doc(firestoreId).get();
    if (doc.exists && doc.data().imageUrl) {
        await this.deleteImage(doc.data().imageUrl);
    }
    await window.getUserCol('tasks').doc(firestoreId).delete();
  },

  // 📅 학사 일정 및 시간표 기능
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

  // ==========================================================
  // 🖼️ [신규] 클라우드 파일 보관소(Storage) 저장/삭제 API
  // ==========================================================
  uploadImage: async function(file, folderName = 'memo_images') {
      const user = window.auth.currentUser;
      if (!user) throw new Error("로그인이 필요합니다.");
      
      // 1. 이미지를 업로드 직전에 자동으로 압축합니다!
      const compressedFile = await window.compressImage(file);
      
      // 2. 선생님의 고유 ID 폴더 안에 안전하게 저장합니다.
      const filePath = `${folderName}/${user.uid}/${Date.now()}_${compressedFile.name}`;
      const storageRef = window.storage.ref().child(filePath);
      
      await storageRef.put(compressedFile);
      // 3. 이미지가 저장된 인터넷 주소(URL)를 반환합니다.
      return await storageRef.getDownloadURL();
  },
  
  deleteImage: async function(imageUrl) {
      try {
          const storageRef = window.storage.refFromURL(imageUrl);
          await storageRef.delete();
      } catch(e) { console.warn("이미지 삭제 실패 (이미 지워졌거나 권한 없음)", e); }
  }
};
