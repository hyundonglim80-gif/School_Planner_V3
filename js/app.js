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
  
  requestAnimationFrame(() => {
      setTimeout(() => {
          const todayEl = document.querySelector('.week-today-cell, .month-today-cell, .year-today-card');
          if (todayEl) {
              todayEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
      }, 50); 
  });
};

// ==========================================================================
// ⚙️ 환경 설정 (수업 시수 및 명칭 동적 설정 + 라벨 동기화 + D-Day)
// ==========================================================================
window.periodNames = ["1", "2", "3", "4", "5", "6"];
window.tempPeriodNames = [];

window.loadSettings = async function() {
    try {
        const doc = await window.getUserCol('settings').doc('preferences').get();
        if (doc.exists) {
            const data = doc.data();
            if (data.periodNames && data.periodNames.length > 0) {
                window.periodNames = data.periodNames;
            } else {
                window.periodNames = ["1", "2", "3", "4", "5", "6"];
            }

            // 💡 D-Day 데이터 로드
            window.dDayList = data.dDayList || [];
            window.selectedDDayId = data.selectedDDayId || null;
            window.updateDdayUI();
        } else {
            window.periodNames = ["1", "2", "3", "4", "5", "6"];
            window.dDayList = [];
            window.selectedDDayId = null;
        }

        const labelDoc = await window.getUserCol('settings').doc('labels').get();
        if (labelDoc.exists) {
            const data = labelDoc.data();
            if (data.eventLabels) localStorage.setItem('workCalendar_eventLabels_v4', JSON.stringify(data.eventLabels));
            if (data.journalLabels) localStorage.setItem('workCalendar_journalLabels_v4', JSON.stringify(data.journalLabels));
            if (data.memoLabels) localStorage.setItem('workCalendar_memoLabels', JSON.stringify(data.memoLabels));
        }
    } catch (error) {
        console.warn("설정 데이터를 불러올 권한이 없거나 에러가 발생했습니다. 기본값을 적용합니다.", error);
        window.periodNames = ["1", "2", "3", "4", "5", "6"];
        window.dDayList = [];
        window.selectedDDayId = null;
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
    titleEl.textContent = `${y}년 ${m}월 ${d}일 (${dayName})`;
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

function updateButtonUI() {
  const scopeBtns = document.querySelectorAll('.btn-scope');
  scopeBtns.forEach(btn => {
    btn.classList.remove('active');
    if (btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(`'${currentScope}'`)) {
      btn.classList.add('active');
    }
  });

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

  if (window.autoForwardIncompleteEvents) {
      await window.autoForwardIncompleteEvents();
  }

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
  
  if (!silent && currentMode === 'editor') {
      window.render();
  }
};

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
// 🚀 완료 일정 Top-Down 추적 복사 & 사본 연쇄 자동 삭제 엔진
// ==========================================================================
window.autoForwardIncompleteEvents = async function() {
    const todayStr = window.formatDate(new Date()); 
    
    try {
        const pastDate = new Date(window.parseLocalDate(todayStr));
        pastDate.setDate(pastDate.getDate() - 365); 

        const eventsSnap = await window.getUserCol('events')
            .where(firebase.firestore.FieldPath.documentId(), '>=', window.formatDate(pastDate))
            .get();

        let eventsMap = {};
        let allDates = [];
        eventsSnap.forEach(doc => { 
            eventsMap[doc.id] = doc.data(); 
            allDates.push(doc.id); 
        });
        
        if (!allDates.includes(todayStr)) allDates.push(todayStr);
        allDates.sort();

        let activeChains = new Set();
        let chainEventData = {}; 
        let changedDocs = new Set();

        const minDateStr = allDates[0] || todayStr;
        const maxDateStr = allDates[allDates.length - 1];

        let curD = window.parseLocalDate(minDateStr);
        let endD = window.parseLocalDate(maxDateStr);

        while (curD <= endD) {
            const curStr = window.formatDate(curD);
            curD.setDate(curD.getDate() + 1);
            const nextStr = window.formatDate(curD);

            let curData = eventsMap[curStr] || { eventList: [] };
            let curList = curData.eventList || (curData.eventText ? window.parseRawEventTextToEventList(curData.eventText) : []);
            let newCurList = [];
            let curChanged = false;

            curList.forEach(ev => {
                const canComplete = ev.labels ? ev.labels.some(l => window.isForwardLabel(l)) : window.isForwardLabel(ev.label);
                
                const cleanContent = (ev.content || '').replace(/➡️\s*\(미완료\)/g, '').replace(/➡️\s*\(다음 날로 이월됨\)/g, '').replace(/↪️\s*/g, '').trim();
                if (ev.content !== cleanContent) {
                    ev.content = cleanContent;
                    curChanged = true;
                }

                const isOrigin = !ev.originalDate || ev.originalDate === curStr;

                if (isOrigin) {
                    if (canComplete) {
                        if (!ev.forwardChainId) {
                            ev.forwardChainId = 'chain_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5);
                            curChanged = true;
                        }
                        if (!ev.originalDate) {
                            ev.originalDate = curStr;
                            curChanged = true;
                        }
                        
                        if (ev.completed) {
                            activeChains.delete(ev.forwardChainId);
                        } else {
                            activeChains.add(ev.forwardChainId);
                            chainEventData[ev.forwardChainId] = { ...ev }; 
                        }
                        newCurList.push(ev);
                    } else {
                        if (ev.forwardChainId) {
                            delete ev.forwardChainId;
                            delete ev.originalDate;
                            curChanged = true;
                        }
                        newCurList.push(ev);
                    }
                } else {
                    if (activeChains.has(ev.forwardChainId)) {
                        if (ev.completed) {
                            activeChains.delete(ev.forwardChainId);
                        } else {
                            chainEventData[ev.forwardChainId] = { ...ev }; 
                        }
                        newCurList.push(ev);
                    } else {
                        curChanged = true;
                    }
                }
            });

            let nextData = eventsMap[nextStr] || { eventList: [] };
            let nextList = nextData.eventList || (nextData.eventText ? window.parseRawEventTextToEventList(nextData.eventText) : []);
            let nextChanged = false;

            if (curStr < todayStr) {
                activeChains.forEach(chainId => {
                    const existsInNext = nextList.some(n => n.forwardChainId === chainId);
                    if (!existsInNext) {
                        const sourceEv = chainEventData[chainId];
                        nextList.unshift({
                            label: sourceEv.label || '',
                            labels: [...(sourceEv.labels || [])],
                            content: sourceEv.content,
                            completed: false, 
                            forwardChainId: chainId,
                            originalDate: sourceEv.originalDate
                        });
                        nextChanged = true;
                    }
                });
            }

            if (curList.length !== newCurList.length) curChanged = true;

            if (curChanged) {
                eventsMap[curStr] = { ...curData, eventList: newCurList };
                changedDocs.add(curStr);
            }
            if (nextChanged) {
                eventsMap[nextStr] = { ...nextData, eventList: nextList };
                changedDocs.add(nextStr);
            }
        }

        let batch = window.db.batch();
        let opCount = 0;
        let batchPromises = [];
        
        changedDocs.forEach(dateStr => {
            const docRef = window.getUserCol('events').doc(dateStr);
            const evList = eventsMap[dateStr].eventList;
            const updateData = { eventList: evList, updatedAt: Date.now() };
            if (window.formatEventListToText) {
                updateData.eventText = window.formatEventListToText(evList); 
            }
            batch.set(docRef, updateData, { merge: true });
            opCount++;
            if (opCount >= 400){ batchPromises.push(batch.commit()); batch = window.db.batch(); opCount = 0; }
        });

        if (opCount > 0) batchPromises.push(batch.commit());
        await Promise.all(batchPromises);

    } catch(e) {
        console.error("자동 이월 처리 중 에러:", e);
    }
};

// ==========================================================================
// 🚀 완료(이월) 일정 다중 삭제 모달 및 안전 처리 로직
// ==========================================================================
window.showForwardDeleteModal = function(baseDateStr, labelName, textContent, chainId, onConfirm) {
    const modalHtml = `
    <div id="forward-delete-modal" class="modal-overlay" style="display:flex;">
        <div class="modal-content" style="width:380px; padding:25px; background:#fff; border-radius:12px; text-align:center;">
            <h3 style="color:#ef4444; margin-top:0;">🗑️ 이월 일정 삭제</h3>
            <p style="color:#475569; font-size:0.95rem; margin-bottom:20px; line-height:1.5;">
                이 일정은 <b>'완료(이월)'</b> 속성으로 과거에서 넘어온 일정입니다.<br>어떻게 삭제하시겠습니까?
            </p>
            <div style="display:flex; flex-direction:column; gap:10px;">
                <button id="btn-fwd-del-stop" style="padding:12px; background:#f1f5f9; border:1px solid #cbd5e1; border-radius:8px; cursor:pointer; font-weight:bold; color:#1e293b; text-align:left; line-height:1.4;">
                    오늘부터 삭제 및 이월 중단<br><span style="font-size:0.8rem; font-weight:normal; color:#64748b;">(과거의 기록은 보존됩니다)</span>
                </button>
                <button id="btn-fwd-del-all" style="padding:12px; background:#fee2e2; border:1px solid #fca5a5; border-radius:8px; cursor:pointer; font-weight:bold; color:#b91c1c; text-align:left; line-height:1.4;">
                    원본 포함 모든 기록 삭제<br><span style="font-size:0.8rem; font-weight:normal; color:#ef4444;">(최초 작성된 원본까지 모두 지웁니다)</span>
                </button>
                <button onclick="document.getElementById('forward-delete-modal').remove()" style="padding:10px; background:none; border:none; color:#64748b; font-weight:bold; cursor:pointer; margin-top:5px;">취소</button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    document.getElementById('btn-fwd-del-stop').onclick = async () => {
        if(window.hasUnsavedChanges) await window.saveCurrentViewData(true);
        window.executeForwardDelete('stop', baseDateStr, chainId, onConfirm);
    };
    
    document.getElementById('btn-fwd-del-all').onclick = async () => {
        if(window.hasUnsavedChanges) await window.saveCurrentViewData(true);
        window.executeForwardDelete('all', baseDateStr, chainId, onConfirm);
    };
};

window.executeForwardDelete = async function(mode, baseDateStr, chainId, onConfirm) {
    document.getElementById('forward-delete-modal').innerHTML = `<div style="background:#fff; padding:30px; border-radius:12px; font-weight:bold; color:#2563eb; text-align:center;">⏳ 클라우드에서 일정 삭제 및 동기화 중...</div>`;
    
    const matchEvent = (e) => e.forwardChainId === chainId;

    try {
        const snap = await window.getUserCol('events').get();
        
        let maxPastDateStr = '';
        if (mode === 'stop') {
            snap.forEach(doc => {
                if (doc.id < baseDateStr) {
                    const data = doc.data();
                    const list = data.eventList || (data.eventText ? window.parseRawEventTextToEventList(data.eventText) : []);
                    if (list.some(matchEvent)) {
                        if (doc.id > maxPastDateStr) maxPastDateStr = doc.id;
                    }
                }
            });
        }

        if (window.dayViewInstance && window.dayViewInstance.currentEvents) {
            if (mode === 'all' || window.dayViewInstance.dateStr >= baseDateStr) {
               window.dayViewInstance.currentEvents = window.dayViewInstance.currentEvents.filter(e => !matchEvent(e));
            } else if (mode === 'stop' && window.dayViewInstance.dateStr === maxPastDateStr) {
               window.dayViewInstance.currentEvents.forEach(e => { if (matchEvent(e)) e.completed = true; });
            }
        }
        Object.keys(window).forEach(key => {
            if (key.startsWith('tempEvents_')) {
                const dStr = key.replace('tempEvents_', '');
                if (mode === 'all' || dStr >= baseDateStr) {
                    window[key] = window[key].filter(e => !matchEvent(e));
                } else if (mode === 'stop' && dStr === maxPastDateStr) {
                    window[key].forEach(e => { if (matchEvent(e)) e.completed = true; });
                }
            }
        });

        let batch = window.db.batch();
        let count = 0;
        let batchPromises = []; 
        
        snap.forEach(doc => {
            const data = doc.data();
            let list = data.eventList || [];
            const origLen = list.length;
            let changed = false;
            
            if (mode === 'all') {
                list = list.filter(e => !matchEvent(e));
                if (list.length !== origLen) changed = true;
            } else if (mode === 'stop') {
                if (doc.id >= baseDateStr) {
                    list = list.filter(e => !matchEvent(e));
                    if (list.length !== origLen) changed = true;
                } else if (doc.id === maxPastDateStr) {
                    list.forEach(e => {
                        if (matchEvent(e) && !e.completed) {
                            e.completed = true;
                            changed = true;
                        }
                    });
                }
            }
            
            if (changed) {
                let updateData = { eventList: list, updatedAt: Date.now() };
                if (window.formatEventListToText) {
                    updateData.eventText = window.formatEventListToText(list);
                }
                batch.update(doc.ref, updateData);
                count++;
            }

            if (count >= 400) {
                batchPromises.push(batch.commit());
                batch = window.db.batch();
                count = 0;
            }
        });
        if (count > 0) batchPromises.push(batch.commit());
        await Promise.all(batchPromises);

        if (window.autoForwardIncompleteEvents) {
            await window.autoForwardIncompleteEvents();
        }

    } catch(e) {
        console.error("이월 일정 삭제 오류:", e);
    }
    
    const modal = document.getElementById('forward-delete-modal');
    if (modal) modal.remove();
    if (onConfirm) onConfirm();
};

// ==========================================================================
// 🚀 기간 다중 등록 달력 팝업
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
                    <input type="date" id="period-start" value="${startDateStr}" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px; background:#fff;">
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

    document.getElementById('period-modal').innerHTML = `<div style="background:#fff; padding:30px; border-radius:12px; font-weight:bold; color:#2563eb; text-align:center;">⏳ 클라우드에 일괄 등록 중...</div>`;

    let datesToSave = [];
    let curD = new Date(startD);
    while (curD <= endD) {
        const day = curD.getDay();
        if (excludeWeekend && (day === 0 || day === 6)) {
        } else {
            datesToSave.push(window.formatDate(curD));
        }
        curD.setDate(curD.getDate() + 1);
    }

    const totalDays = datesToSave.length;
    let batch = window.db.batch();
    
    const groupId = 'period_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5);
    
    for(let i=0; i<totalDays; i++) {
        const dStr = datesToSave[i];
        const docRef = window.getUserCol('events').doc(dStr);
        const docSnap = await docRef.get();
        let list = docSnap.exists ? (docSnap.data().eventList || []) : [];
        
        list.push({ 
            label: labelName, 
            labels: [labelName], 
            content: `${content} (${i+1}/${totalDays})`, 
            completed: false,
            groupId: groupId  
        });
        batch.set(docRef, { eventList: list, updatedAt: Date.now() }, { merge: true });
    }

    await batch.commit();
    document.getElementById('period-modal').remove();
    alert(`✅ 총 ${totalDays}일의 일정이 등록되었습니다.`);
    if (callback) callback(true);
};

// ==========================================================================
// 🚀 안전한 기간 일정 다중 삭제
// ==========================================================================
window.showPeriodDeleteModal = function(baseDateStr, labelName, textContent, groupId, onConfirm, onOnlyThisDay) {
    const modalHtml = `
    <div id="period-delete-modal" class="modal-overlay" style="display:flex;">
        <div class="modal-content" style="width:360px; padding:25px; background:#fff; border-radius:12px; text-align:center;">
            <h3 style="color:#ef4444; margin-top:0;">🗑️ 기간 일정 삭제</h3>
            <p style="color:#475569; font-size:0.95rem; margin-bottom:20px; line-height:1.5;">
                이 일정은 <b>'기간'</b>으로 묶인 일정입니다.<br>어떻게 삭제하시겠습니까?
            </p>
            <div style="display:flex; flex-direction:column; gap:10px;">
                <button id="btn-del-only-this" style="padding:12px; background:#f1f5f9; border:1px solid #cbd5e1; border-radius:8px; cursor:pointer; font-weight:bold; color:#1e293b;">그 날만 삭제 (일반 일정처럼)</button>
                <button id="btn-del-all" style="padding:12px; background:#fee2e2; border:1px solid #fca5a5; border-radius:8px; cursor:pointer; font-weight:bold; color:#b91c1c;">모든 기간 일정 모두 삭제</button>
                <button id="btn-del-after-this" style="padding:12px; background:#ef4444; border:none; border-radius:8px; cursor:pointer; font-weight:bold; color:#fff;">이 날부터 끝날까지 삭제</button>
                <button onclick="document.getElementById('period-delete-modal').remove()" style="padding:10px; background:none; border:none; color:#64748b; font-weight:bold; cursor:pointer; margin-top:5px;">취소</button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const baseContent = textContent.replace(/\s*\(\d+\/\d+\).*/, '').trim();
    
    document.getElementById('btn-del-only-this').onclick = () => {
        document.getElementById('period-delete-modal').remove();
        if (onOnlyThisDay) onOnlyThisDay();
    };

    document.getElementById('btn-del-after-this').onclick = async () => {
        if(window.hasUnsavedChanges) {
            await window.saveCurrentViewData(true);
        }
        await window.executePeriodDelete('after', baseDateStr, groupId, labelName, baseContent, onConfirm);
    };
    
    document.getElementById('btn-del-all').onclick = async () => {
        if(window.hasUnsavedChanges) {
            await window.saveCurrentViewData(true);
        }
        await window.executePeriodDelete('all', baseDateStr, groupId, labelName, baseContent, onConfirm);
    };
};

window.executePeriodDelete = async function(mode, baseDateStr, groupId, labelName, baseContent, onConfirm) {
    document.getElementById('period-delete-modal').innerHTML = `<div style="background:#fff; padding:30px; border-radius:12px; font-weight:bold; color:#2563eb; text-align:center;">⏳ 클라우드에서 다중 일정 안전 삭제 중...</div>`;
    
    const matchEvent = (e) => {
        if (groupId && e.groupId) return e.groupId === groupId;
        const eLabels = e.labels || (e.label ? [e.label] : []);
        const hasLabel = eLabels.includes(labelName);
        const c = (e.content || '').replace(/\s*\(\d+\/\d+\).*/, '').trim();
        return hasLabel && c === baseContent;
    };

    if (window.dayViewInstance && window.dayViewInstance.dateStr === baseDateStr && window.dayViewInstance.currentEvents) {
        window.dayViewInstance.currentEvents = window.dayViewInstance.currentEvents.filter(e => !matchEvent(e));
    }
    Object.keys(window).forEach(key => {
        if (key.startsWith('tempEvents_')) {
            const dStr = key.replace('tempEvents_', '');
            if (mode === 'only' && dStr !== baseDateStr) return;
            if (mode === 'after' && dStr < baseDateStr) return;
            window[key] = window[key].filter(e => !matchEvent(e));
        }
    });

    try {
        let query = window.getUserCol('events');
        if (mode === 'after') {
            query = query.where(firebase.firestore.FieldPath.documentId(), '>=', baseDateStr);
        }
        const snap = await query.get();
        let batch = window.db.batch();
        let count = 0;
        let batchPromises = []; 
        
        snap.forEach(doc => {
            const data = doc.data();
            let list = data.eventList || [];
            const origLen = list.length;
            
            list = list.filter(e => !matchEvent(e));
            
            if (origLen !== list.length) {
                let updateData = { eventList: list, updatedAt: Date.now() };
                if (window.formatEventListToText) {
                    updateData.eventText = window.formatEventListToText(list);
                }
                batch.update(doc.ref, updateData);
                
                count++;
                if (count >= 400) {
                    batchPromises.push(batch.commit());
                    batch = window.db.batch();
                    count = 0;
                }
            }
        });
        if (count > 0) batchPromises.push(batch.commit());
        await Promise.all(batchPromises);
    } catch(e) {
        console.error("일괄 삭제 오류:", e);
    }
    
    document.getElementById('period-delete-modal').remove();
    if (onConfirm) onConfirm();
};

// ==========================================================================
// 🚀 D-Day 기능 (표시, 계산, 드롭다운, 모달 관리) - 버그 패치 완료 버전
// ==========================================================================
window.dDayList = [];
window.selectedDDayId = null;

// D-Day 메뉴 토글 및 리스트 렌더링
window.toggleDdayMenu = function() {
    // 💡 UX 향상: 만약 등록된 D-Day가 단 1개도 없다면 무의미한 드롭다운 대신 바로 설정창을 띄워줍니다.
    if (!window.dDayList || window.dDayList.length === 0) {
        window.openDdaySettingsModal();
        return;
    }

    const dropdown = document.getElementById('dday-dropdown');
    const listContainer = document.getElementById('dday-list-container');
    
    if (dropdown.classList.contains('hidden')) {
        listContainer.innerHTML = '';
        window.dDayList.forEach(dday => {
            const isSelected = dday.id === window.selectedDDayId;
            const dDayText = window.calculateDday(dday.date);
            listContainer.innerHTML += `
                <button class="dropdown-item" onclick="window.selectDday('${dday.id}')" style="${isSelected ? 'background:#eff6ff; color:#2563eb;' : ''}">
                    <span style="font-weight:bold; margin-right:8px; display:inline-block; width:50px;">${dDayText}</span> 
                    ${dday.title}
                </button>
            `;
        });
        if (window.selectedDDayId) {
            listContainer.innerHTML += `<button class="dropdown-item" onclick="window.selectDday(null)" style="color:#64748b; text-align:center;">선택 해제</button>`;
        }
    }
    dropdown.classList.toggle('hidden');
};

// 화면 아무 곳이나 클릭 시 D-Day 드롭다운 닫기
window.addEventListener('click', function(e) {
    const btn = document.getElementById('btn-dday-display');
    const dropdown = document.getElementById('dday-dropdown');
    if (btn && dropdown && !btn.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.classList.add('hidden');
    }
});

// 특정 D-Day 선택 처리
window.selectDday = async function(id) {
    window.selectedDDayId = id;
    document.getElementById('dday-dropdown').classList.add('hidden');
    window.updateDdayUI();
    
    if (window.auth && window.auth.currentUser) {
        await window.getUserCol('settings').doc('preferences').set({
            selectedDDayId: id
        }, { merge: true });
    }
};

// 버튼 텍스트 업데이트 로직
window.updateDdayUI = function() {
    const btn = document.getElementById('btn-dday-display');
    if (!btn) return;

    if (!window.selectedDDayId || window.dDayList.length === 0) {
        btn.textContent = "D-Day 설정";
        btn.style.color = "#64748b";
        btn.style.backgroundColor = "#f1f5f9";
        btn.style.borderColor = "#cbd5e1";
        return;
    }

    const selected = window.dDayList.find(d => d.id === window.selectedDDayId);
    if (selected) {
        const dDayText = window.calculateDday(selected.date);
        btn.textContent = `${selected.title} ${dDayText}`;
        btn.style.color = "#ef4444";
        btn.style.backgroundColor = "#fef2f2";
        btn.style.borderColor = "#fca5a5";
    }
};

// D-Day 계산 유틸리티
window.calculateDday = function(targetDateStr) {
    const today = new Date();
    today.setHours(0, 0, 0, 0); 
    const targetDate = new Date(targetDateStr);
    targetDate.setHours(0, 0, 0, 0);
    
    const diffTime = targetDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    
    if (diffDays === 0) return 'D-Day';
    if (diffDays > 0) return `D-${diffDays}`;
    return `D+${Math.abs(diffDays)}`;
};

// D-Day 설정 모달창 열기 (충돌 방지를 위해 HTML 직접 조작 방식으로 고정)
window.openDdaySettingsModal = function() {
    const dropdown = document.getElementById('dday-dropdown');
    if(dropdown) dropdown.classList.add('hidden');
    
    // 이미 창이 열려있으면 중복 생성 방지
    const existing = document.getElementById('dday-modal');
    if (existing) existing.remove();
    
    const modalHtml = `
    <div id="dday-modal" class="modal-overlay" style="z-index: 10006; display:flex;">
        <div class="modal-content" style="width: 400px; padding:0;">
            <div class="modal-header" style="padding: 15px 20px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center;">
                <h2 style="font-size:1.2rem; margin:0; color:#1e293b;">⚙️ D-Day 관리</h2>
                <button class="btn-close-modal" onclick="document.getElementById('dday-modal').remove()" style="font-size:1.5rem; background:none; border:none; cursor:pointer; color:#64748b;">&times;</button>
            </div>
            <div class="modal-body" style="padding: 20px;">
                <div style="display:flex; gap:8px; margin-bottom:20px;">
                    <input type="text" id="new-dday-title" placeholder="디데이 명칭" style="flex:1; padding:8px; border:1px solid #cbd5e1; border-radius:6px; font-size:0.9rem;">
                    <input type="date" id="new-dday-date" style="padding:8px; border:1px solid #cbd5e1; border-radius:6px;">
                    <button onclick="window.addDday()" style="padding:8px 12px; background:#2563eb; color:white; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">추가</button>
                </div>
                
                <hr style="border:0; border-top:1px dashed #e2e8f0; margin-bottom:15px;">
                
                <div id="dday-settings-list" style="display:flex; flex-direction:column; gap:10px; max-height:250px; overflow-y:auto;">
                </div>
            </div>
        </div>
    </div>`;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    window.renderDdaySettingsList();
};

// 모달 내부 리스트 렌더링
window.renderDdaySettingsList = function() {
    const listEl = document.getElementById('dday-settings-list');
    if(!listEl) return;
    listEl.innerHTML = '';
    
    if (window.dDayList.length === 0) {
        listEl.innerHTML = '<div style="text-align:center; color:#94a3b8; font-size:0.9rem; margin-top:20px;">등록된 D-Day가 없습니다.</div>';
        return;
    }

    window.dDayList.forEach(dday => {
        listEl.innerHTML += `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px;">
            <div>
                <span style="font-weight:bold; color:#1e293b; margin-right:8px;">${dday.title}</span>
                <span style="font-size:0.85rem; color:#64748b;">${dday.date}</span>
            </div>
            <button onclick="window.deleteDday('${dday.id}')" style="background:none; border:none; color:#ef4444; font-weight:bold; cursor:pointer; padding:4px 8px;">삭제</button>
        </div>`;
    });
};

// 새 D-Day 추가
window.addDday = async function() {
    const titleInput = document.getElementById('new-dday-title');
    const dateInput = document.getElementById('new-dday-date');
    const title = titleInput.value.trim();
    const date = dateInput.value;

    if (!title || !date) return alert("명칭과 날짜를 모두 입력해주세요.");

    const newDday = {
        id: 'dday_' + Date.now().toString(36),
        title: title,
        date: date
    };

    window.dDayList.push(newDday);
    
    if (window.dDayList.length === 1) {
        window.selectedDDayId = newDday.id;
    }

    await window.saveDdayDataToFirebase();
    
    titleInput.value = '';
    dateInput.value = '';
    window.renderDdaySettingsList();
    window.updateDdayUI();
};

// D-Day 삭제
window.deleteDday = async function(id) {
    if (!confirm("해당 D-Day를 삭제하시겠습니까?")) return;
    
    window.dDayList = window.dDayList.filter(d => d.id !== id);
    if (window.selectedDDayId === id) window.selectedDDayId = null;

    await window.saveDdayDataToFirebase();
    window.renderDdaySettingsList();
    window.updateDdayUI();
};

// Firebase에 D-Day 저장
window.saveDdayDataToFirebase = async function() {
    if (!window.auth || !window.auth.currentUser) return;
    try {
        await window.getUserCol('settings').doc('preferences').set({
            dDayList: window.dDayList,
            selectedDDayId: window.selectedDDayId
        }, { merge: true });
    } catch (e) {
        console.error("D-Day 저장 실패", e);
        alert("저장에 실패했습니다.");
    }
};
