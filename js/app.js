// js/app.js

// ==========================================================================
// 🚀 앱 상태 관리 및 초기화 설정
// ==========================================================================
let currentScope = localStorage.getItem('workCalendar_scope') || 'week';
let currentMode = localStorage.getItem('workCalendar_mode') || 'viewer';
window.showWeekend = localStorage.getItem('workCalendar_showWeekend') === 'true';
window.showClass = localStorage.getItem('workCalendar_showClass') !== 'false'; 
window.currentDate = new Date(); 
window.hasUnsavedChanges = false;

window.toggleWeekend = async function() {
  if (currentMode === 'editor' && window.hasUnsavedChanges) await window.saveCurrentViewData(true);
  window.showWeekend = !window.showWeekend;
  localStorage.setItem('workCalendar_showWeekend', window.showWeekend);
  window.render();
};

window.toggleClass = async function() {
  if (currentMode === 'editor' && window.hasUnsavedChanges) await window.saveCurrentViewData(true);
  window.showClass = !window.showClass;
  localStorage.setItem('workCalendar_showClass', window.showClass);
  window.render();
};

window.setScope = async function(scope) {
  if (currentMode === 'editor' && window.hasUnsavedChanges) await window.saveCurrentViewData(true);
  currentScope = scope;
  localStorage.setItem('workCalendar_scope', scope);
  window.render();
};

window.setMode = async function(mode) {
  if (currentMode === 'editor' && mode === 'viewer' && window.hasUnsavedChanges) {
    await window.saveCurrentViewData(true);
  }
  currentMode = mode;
  localStorage.setItem('workCalendar_mode', mode);
  if (mode === 'viewer') window.hasUnsavedChanges = false;
  window.render();
};

window.handleEditSaveClick = function() {
  if (currentMode === 'viewer') {
    window.setMode('editor');
  } else {
    window.saveCurrentViewData(false);
  }
};

window.moveDate = async function(dir) {
  if (currentMode === 'editor' && window.hasUnsavedChanges) await window.saveCurrentViewData(true);
  
  if (currentScope === 'day') {
      window.currentDate.setDate(window.currentDate.getDate() + dir);
  } else if (currentScope === 'week') {
      window.currentDate.setDate(window.currentDate.getDate() + (dir * 7));
  } else if (currentScope === 'month') {
      const currentDay = window.currentDate.getDate();
      window.currentDate.setMonth(window.currentDate.getMonth() + dir);
      if (window.currentDate.getDate() < currentDay) {
          window.currentDate.setDate(0); 
      }
  } else if (currentScope === 'year') {
      window.currentDate.setFullYear(window.currentDate.getFullYear() + dir);
  }
  window.render();
};

window.goToToday = async function() {
  if (currentMode === 'editor' && window.hasUnsavedChanges) await window.saveCurrentViewData(true);
  window.currentDate = new Date();
  window.render();
};

// ==========================================================================
// ⚙️ 환경 설정 (수업 시수 및 명칭 동적 설정)
// ==========================================================================
window.periodNames = ["1", "2", "3", "4", "5", "6"];
window.tempPeriodNames = [];

window.loadSettings = async function() {
    try {
        const doc = await window.getUserCol('settings').doc('preferences').get();
        if (doc.exists && doc.data().periodNames && doc.data().periodNames.length > 0) {
            window.periodNames = doc.data().periodNames;
        } else {
            window.periodNames = ["1", "2", "3", "4", "5", "6"];
        }
    } catch (error) {
        console.warn("설정 데이터를 불러올 권한이 없거나 에러가 발생했습니다. 기본값을 적용합니다.", error);
        window.periodNames = ["1", "2", "3", "4", "5", "6"];
    }
};

// ==========================================================================
// 🖥️ 메인 렌더링 엔진
// ==========================================================================
window.render = function() {
  const container = document.getElementById("main-view");
  if (!container) return; 

  container.innerHTML = "";
  updateTitle();
  updateButtonUI();

  try {
      if (currentScope === 'week') { currentMode === 'editor' ? window.renderWeekEditor(container) : window.renderWeekViewer(container); }
      else if (currentScope === 'month') { currentMode === 'editor' ? window.renderMonthEditor(container) : window.renderMonthViewer(container); }
      else if (currentScope === 'year') { currentMode === 'editor' ? window.renderYearEditor(container) : window.renderYearViewer(container); }
      else if (currentScope === 'day') { currentMode === 'editor' ? window.renderDayEditor(container) : window.renderDayViewer(container); }
      else if (currentScope === 'memo') { window.renderMemoView(container); }
  } catch (error) {
      console.error("화면 렌더링 중 오류 발생:", error);
      container.innerHTML = `<div style="text-align:center; padding: 50px; color:#ef4444; font-weight:bold;">데이터를 불러오는 중 오류가 발생했습니다.<br>잠시 후 다시 시도하거나 F5를 눌러주세요.</div>`;
  }
};

function updateTitle() {
  const titleEl = document.getElementById("date-range-text");
  if (!titleEl) return;

  const y = window.currentDate.getFullYear();
  const m = window.currentDate.getMonth() + 1;
  const d = window.currentDate.getDate();
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const dayName = days[window.currentDate.getDay()];

  if (currentScope === 'day') { 
    titleEl.textContent = `${y}년 ${m}월 ${d}일 (${dayName}요일)`;
  } else if (currentScope === 'week') {
    const temp = new Date(window.currentDate);
    const day = temp.getDay();
    let start, end;
    
    if (window.showWeekend) {
        const diffToSun = temp.getDate() - day;
        start = new Date(temp.setDate(diffToSun));
        end = new Date(start);
        end.setDate(start.getDate() + 6);
    } else {
        const diffToMon = temp.getDate() - day + (day === 0 ? -6 : 1);
        start = new Date(temp.setDate(diffToMon));
        end = new Date(start);
        end.setDate(start.getDate() + 4);
    }
    
    const mStr1 = String(start.getMonth() + 1).padStart(2, '0');
    const dStr1 = String(start.getDate()).padStart(2, '0');
    const mStr2 = String(end.getMonth() + 1).padStart(2, '0');
    const dStr2 = String(end.getDate()).padStart(2, '0');

    titleEl.textContent = `${y}년 ${m}월 (${mStr1}.${dStr1} ~ ${mStr2}.${dStr2})`;
  } else if (currentScope === 'month') { 
    titleEl.textContent = `${y}년 ${m}월`;
  } else if (currentScope === 'year') { 
    titleEl.textContent = `${y}학년도`;
  } else if (currentScope === 'memo') { 
    titleEl.textContent = "할 일 및 메모";
  }
}

window.toggleMoreMenu = function() {
  const dropdown = document.getElementById('more-dropdown');
  if (dropdown) dropdown.classList.toggle('hidden');
};

window.addEventListener('click', function(e) {
  const btn = document.getElementById('btn-more-menu');
  const dropdown = document.getElementById('more-dropdown');
  if (btn && dropdown) {
    if (!btn.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.classList.add('hidden');
    }
  }
});

function updateButtonUI() {
  const scopeBtns = document.querySelectorAll('.btn-scope');
  scopeBtns.forEach(btn => {
    btn.classList.remove('active');
    if (btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(`'${currentScope}'`)) {
      btn.classList.add('active');
    }
  });

  const headerBottom = document.querySelector('.header-bottom');
  if (headerBottom) {
    headerBottom.style.display = (currentScope === 'memo') ? 'none' : 'block';
  }

  const viewerBtn = document.getElementById('btn-mode-viewer');
  const editorBtn = document.getElementById('btn-mode-editor');
  const modeGroup = document.querySelector('.mode-group');

  if (modeGroup) {
    modeGroup.style.display = (currentScope === 'memo') ? 'none' : 'flex';
  }

  const searchBtn = document.getElementById('btn-search');
  if (searchBtn) {
    searchBtn.style.display = 'inline-block';
  }

  const moreBtn = document.getElementById('btn-more-menu');
  if (moreBtn) {
    moreBtn.style.display = 'inline-flex';
  }

  const weekendBtn = document.getElementById('btn-toggle-weekend');
  if (weekendBtn) {
    weekendBtn.innerHTML = window.showWeekend ? '주말 숨기기' : '주말 보이기';
    weekendBtn.style.display = (currentScope === 'memo') ? 'none' : 'inline-block';
  }

  const classBtn = document.getElementById('btn-toggle-class');
  if (classBtn) {
    classBtn.innerHTML = window.showClass ? '수업 숨기기' : '수업 보이기';
    classBtn.style.display = (currentScope === 'memo') ? 'none' : 'inline-block';
  }

  if (viewerBtn && editorBtn) {
    viewerBtn.className = currentMode === 'viewer' ? 'btn-mode active-viewer' : 'btn-mode';

    if (currentMode === 'viewer') {
      editorBtn.innerHTML = '작성';
      editorBtn.title = '단축키: Ctrl + ↓';
      editorBtn.className = 'btn-mode';
    } else {
      editorBtn.innerHTML = '저장';
      editorBtn.title = '단축키: Ctrl + Enter';
      editorBtn.className = 'btn-mode save-mode';
    }
  }

  const dropdown = document.getElementById('more-dropdown');
  if (dropdown) dropdown.classList.add('hidden');
}

window.saveCurrentViewData = async function(silent = false) {
  const editorBtn = document.getElementById('btn-mode-editor');
  
  if (editorBtn && !silent) {
    editorBtn.innerHTML = "저장중..";
    editorBtn.disabled = true;
  }

  if (currentScope === 'day' && window.saveDayDataFromEditor) await window.saveDayDataFromEditor();
  else if (currentScope === 'week' && window.saveWeekDataFromEditor) await window.saveWeekDataFromEditor();
  else if (currentScope === 'month' && window.saveMonthDataFromEditor) await window.saveMonthDataFromEditor();
  else if (currentScope === 'year' && window.saveYearDataFromEditor) await window.saveYearDataFromEditor();

  if (editorBtn && !silent) {
    editorBtn.innerHTML = '저장 완료';
    setTimeout(() => {
      if (currentMode === 'editor') {
        editorBtn.innerHTML = '저장';
        editorBtn.disabled = false;
      }
    }, 1500); 
  }
  
  window.hasUnsavedChanges = false; 
};

// ==========================================================================
// 🚀 앱 실행 시 초기화 이벤트 설정
// ==========================================================================
window.addEventListener('DOMContentLoaded', () => {
  const viewerBtn = document.getElementById('btn-mode-viewer');
  const editorBtn = document.getElementById('btn-mode-editor');

  if (viewerBtn) viewerBtn.addEventListener('click', () => window.setMode('viewer'));
  if (editorBtn) {
    editorBtn.addEventListener('click', () => {
      if (currentMode === 'viewer') window.setMode('editor');
      else window.saveCurrentViewData(false);
    });
  }

  const markUnsaved = () => { if (currentMode === 'editor') window.hasUnsavedChanges = true; };
  document.addEventListener('input', markUnsaved);
  document.addEventListener('change', markUnsaved);

  window.addEventListener('beforeunload', (e) => {
    if (currentMode === 'editor' && window.hasUnsavedChanges) {
      e.preventDefault();
      e.returnValue = ''; 
    }
  });

  if (window.auth) {
    const loginBtn = document.querySelector('#login-screen button');
    let originalBtnHtml = '';
    
    if (loginBtn) {
        originalBtnHtml = loginBtn.innerHTML;
        loginBtn.innerHTML = '로그인 상태 확인 중...';
        loginBtn.disabled = true;
    }

    window.auth.onAuthStateChanged(async user => {
      if (user) {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('user-info').style.display = 'flex';
        if(user.photoURL) document.getElementById('user-photo').src = user.photoURL;
        
        await window.loadSettings();
        
        // 💡 [핵심] 로그인 직후 미완료 자동 이월 로직 실행 (잠금장치 해제됨)
        await window.autoForwardIncompleteEvents();

        window.render();
        
        setTimeout(() => {
          try {
            const hideHelp = localStorage.getItem('workCalendar_hideHelp_v4');
            if (hideHelp !== 'true' && typeof window.openHelpModal === 'function') {
              window.openHelpModal();
            }
          } catch(e) {}
        }, 500); 

      } else {
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('user-info').style.display = 'none';
        document.getElementById("main-view").innerHTML = ""; 
        
        if (loginBtn) {
            loginBtn.innerHTML = originalBtnHtml || 'Google 계정으로 로그인';
            loginBtn.disabled = false;
        }
      }
    });
  }
});

// ==========================================================================
// 🚀 [신규] 미완료 자동 이월 로직 (앱 실행 시 작동)
// ==========================================================================
window.autoForwardIncompleteEvents = async function() {
    const todayStr = window.formatDate(new Date());

    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 14); // 최근 14일치 스캔
    const pastDateStr = window.formatDate(pastDate);

    try {
        const eventsSnap = await window.getUserCol('events')
            .where(firebase.firestore.FieldPath.documentId(), '>=', pastDateStr)
            .where(firebase.firestore.FieldPath.documentId(), '<', todayStr)
            .get();
        
        let forwardedEvents = [];
        let batch = window.db.batch();

        eventsSnap.forEach(doc => {
            const data = doc.data();
            let list = data.eventList || (data.eventText ? window.parseRawEventTextToEventList(data.eventText) : []);
            let docChanged = false;

            list.forEach(ev => {
                const label = ev.labels ? ev.labels[0] : ev.label;
                // '완료(이월)' 속성이면서 완료되지 않았고, 이미 이월된 기록이 없다면
                if (window.isForwardLabel && window.isForwardLabel(label) && !ev.completed && !ev.isForwarded) {
                    ev.isForwarded = true; // 원본에는 이월됨 표시 남김
                    docChanged = true;
                    // 오늘 날짜로 가져갈 새 객체 생성
                    forwardedEvents.push({ label: label, labels: ev.labels, content: ev.content, completed: false }); 
                }
            });

            if (docChanged) {
                batch.update(doc.ref, { eventList: list, updatedAt: Date.now() });
            }
        });

        // 오늘 날짜로 이월할 내용이 있다면
        if (forwardedEvents.length > 0) {
            const todayDoc = await window.getUserCol('events').doc(todayStr).get();
            const todayData = todayDoc.exists ? todayDoc.data() : {};
            let todayList = todayData.eventList || (todayData.eventText ? window.parseRawEventTextToEventList(todayData.eventText) : []);
            
            // 기존 오늘 일정 맨 위에 이월된 일정들을 끼워넣음
            todayList = [...forwardedEvents, ...todayList];

            batch.set(window.getUserCol('events').doc(todayStr), {
                eventList: todayList,
                updatedAt: Date.now()
            }, { merge: true });
        }

        await batch.commit();
        if (forwardedEvents.length > 0 && window.render) window.render(); // 화면 새로고침
    } catch(e) {
        console.error("자동 이월 처리 중 에러:", e);
    }
};

// ==========================================================================
// 🚀 [신규] 기간 다중 등록 달력 팝업
// ==========================================================================
window.openPeriodModal = function(startDateStr, labelName, textContent, callback) {
    const modalHtml = `
    <div id="period-modal" style="position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.5); z-index:10002; display:flex; justify-content:center; align-items:center;">
        <div style="background:#fff; padding:25px; border-radius:12px; width:360px; box-shadow:0 10px 25px rgba(0,0,0,0.2);">
            <h3 style="margin-top:0; color:#2563eb; border-bottom:2px solid #bfdbfe; padding-bottom:10px;">📅 [${labelName}] 기간 등록</h3>
            
            <div style="margin-bottom:15px;">
                <label style="display:block; font-weight:bold; margin-bottom:5px;">일정 내용</label>
                <input type="text" id="period-content" value="${textContent}" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:6px; font-size:1rem;" placeholder="예: 여름방학">
            </div>

            <div style="display:flex; gap:10px; margin-bottom:15px;">
                <div style="flex:1;">
                    <label style="display:block; font-weight:bold; margin-bottom:5px; font-size:0.9rem;">시작일</label>
                    <input type="date" id="period-start" value="${startDateStr}" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px; background:#f1f5f9;" readonly>
                </div>
                <div style="flex:1;">
                    <label style="display:block; font-weight:bold; margin-bottom:5px; font-size:0.9rem; color:#ef4444;">종료일 선택</label>
                    <input type="date" id="period-end" value="${startDateStr}" style="width:100%; padding:8px; border:1px solid #ef4444; border-radius:6px; outline:none;">
                </div>
            </div>

            <div style="margin-bottom:25px; background:#f8fafc; padding:10px; border-radius:6px; border:1px solid #e2e8f0;">
                <label style="display:flex; align-items:center; gap:6px; font-weight:bold; cursor:pointer;">
                    <input type="checkbox" id="period-exclude-weekend" checked style="width:16px; height:16px; accent-color:#2563eb;">
                    주말(토/일) 제외하고 계산하기
                </label>
                <p style="margin:5px 0 0 22px; font-size:0.8rem; color:#64748b;">체크 시 평일에만 (1/5), (2/5) 형식으로 일정이 등록됩니다.</p>
            </div>

            <div style="display:flex; justify-content:flex-end; gap:10px;">
                <button id="btn-period-cancel" style="padding:10px 16px; border:none; background:#f1f5f9; font-weight:bold; border-radius:6px; cursor:pointer;">취소</button>
                <button id="btn-period-register" style="padding:10px 16px; border:none; background:#2563eb; color:#fff; font-weight:bold; border-radius:6px; cursor:pointer;">등록</button>
            </div>
        </div>
    </div>`;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // 에러를 방지하기 위해 자바스크립트로 직접 이벤트(Callback) 연결
    document.getElementById('btn-period-cancel').onclick = function() {
        document.getElementById('period-modal').remove();
        if(callback) callback(false);
    };

    document.getElementById('btn-period-register').onclick = function() {
        window.executePeriodSave(labelName, callback);
    };
};

window.executePeriodSave = async function(labelName, callback) {
    const content = document.getElementById('period-content').value.trim();
    const startStr = document.getElementById('period-start').value;
    const endStr = document.getElementById('period-end').value;
    const excludeWeekend = document.getElementById('period-exclude-weekend').checked;

    if(!content) return alert("일정 내용을 입력해주세요.");
    const startD = new Date(startStr);
    const endD = new Date(endStr);
    if(startD > endD) return alert("종료일이 시작일보다 빠를 수 없습니다.");

    // 모달창 내용 변경
    document.getElementById('period-modal').innerHTML = `<div style="background:#fff; padding:30px; border-radius:12px; font-weight:bold; color:#2563eb; text-align:center;">⏳ 클라우드에 일괄 등록 중...</div>`;

    // 날짜 계산 및 필터링
    let datesToSave = [];
    let curD = new Date(startD);
    while (curD <= endD) {
        const day = curD.getDay();
        if (excludeWeekend && (day === 0 || day === 6)) {
            // 주말 제외 패스
        } else {
            datesToSave.push(window.formatDate(curD));
        }
        curD.setDate(curD.getDate() + 1);
    }

    const totalDays = datesToSave.length;
    let batch = window.db.batch();
    
    // 비동기로 각 날짜 문서 가져오기
    for(let i=0; i<totalDays; i++) {
        const dStr = datesToSave[i];
        const docRef = window.getUserCol('events').doc(dStr);
        const docSnap = await docRef.get();
        let list = docSnap.exists ? (docSnap.data().eventList || []) : [];
        
        // (1/5) 태그 추가
        list.push({ label: labelName, labels: [labelName], content: `${content} (${i+1}/${totalDays})`, completed: false });
        
        batch.set(docRef, { eventList: list, updatedAt: Date.now() }, { merge: true });
    }

    await batch.commit();
    document.getElementById('period-modal').remove();
    alert(`✅ 총 ${totalDays}일의 일정이 등록되었습니다.`);
    if (callback) callback(true);
};
==========================================
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

window.signInWithGoogle = function() {
    const loginBtn = document.querySelector('#login-screen button');
    let originalHtml = '';
    
    if (loginBtn) {
        originalHtml = loginBtn.innerHTML;
        loginBtn.innerHTML = '⏳ 팝업창에서 로그인(권한 허용)해주세요...';
        loginBtn.disabled = true;
    }

    window.auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
        .then(() => {
            return window.auth.signInWithPopup(provider);
        })
        .then((result) => {
            console.log("✅ 로그인 성공:", result.user.displayName);
            // 🌟 [핵심 추가] 동기화에 사용할 구글 API 토큰 저장
            if (result.credential && result.credential.accessToken) {
                sessionStorage.setItem('google_api_token', result.credential.accessToken);
            }
        })
        .catch(error => {
            console.error("로그인 실패:", error);
            if (error.code === 'auth/popup-closed-by-user') {
                alert("로그인 팝업창을 닫으셨습니다. 다시 시도해 주세요.");
            } else {
                alert("로그인 중 문제가 발생했습니다: " + error.message);
            }
            if (loginBtn) {
                loginBtn.innerHTML = originalHtml;
                loginBtn.disabled = false;
            }
        });
};

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
