// js/core/events.js
import { store } from './store.js';

// ==========================================================================
// 📱 모바일 스와이프(좌우 밀기) 화면 전환 제스처 기능 (통합 엔진)
// ==========================================================================
(function() {
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;
    let isMultiTouch = false;
    let lastSwipeTime = 0;

    const SWIPE_THRESHOLD = 50;  
    const SWIPE_MAX_TIME = 800;  

    function getHorizontalEdgeState() {
        const vv = window.visualViewport;
        let scrollLeft = window.scrollX || document.documentElement.scrollLeft || document.body.scrollLeft || 0;
        if (vv && vv.offsetLeft) {
            scrollLeft += vv.offsetLeft;
        }
        
        const totalWidth = Math.max(
            document.documentElement.scrollWidth,
            document.body.scrollWidth,
            vv ? vv.width * vv.scale : window.innerWidth
        );
        const viewportWidth = vv ? vv.width : window.innerWidth;
        const maxScrollLeft = Math.max(0, totalWidth - viewportWidth);

        return {
            isAtLeftEdge: scrollLeft <= 5,
            isAtRightEdge: scrollLeft >= maxScrollLeft - 5
        };
    }

    document.addEventListener('touchstart', e => {
        if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT' || e.target.closest('.modal-overlay') || e.target.closest('.table-container')) return;
        if (e.touches.length > 1) {
            isMultiTouch = true;
            return;
        }
        isMultiTouch = false;
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
        touchStartTime = Date.now();
    }, { passive: true });

    document.addEventListener('touchend', e => {
        if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT' || e.target.closest('.modal-overlay') || e.target.closest('.table-container')) return;
        if (isMultiTouch || e.changedTouches.length === 0) return;

        const touchEndX = e.changedTouches[0].screenX;
        const touchEndY = e.changedTouches[0].screenY;
        const touchDuration = Date.now() - touchStartTime;

        if (touchDuration > SWIPE_MAX_TIME) return;

        const deltaX = touchEndX - touchStartX;
        const deltaY = touchEndY - touchStartY;

        if (Math.abs(deltaX) > SWIPE_THRESHOLD && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
            
            const now = Date.now();
            if (now - lastSwipeTime < 600) return; 
            
            const swipeMode = localStorage.getItem('workCalendar_swipeMode') || 'date';

            if (swipeMode === 'date') {
                if (store.mode === 'editor' || store.scope === 'memo') return;

                const edgeState = getHorizontalEdgeState();
                if (deltaX > 0 && edgeState.isAtLeftEdge) {
                    lastSwipeTime = now;
                    if (window.moveDate) window.moveDate(-1);
                } else if (deltaX < 0 && edgeState.isAtRightEdge) {
                    lastSwipeTime = now;
                    if (window.moveDate) window.moveDate(1);
                }
            } else if (swipeMode === 'scope') {
                lastSwipeTime = now;
                if (window.updateDateFromScroll) window.updateDateFromScroll(); 
                
                const scopes = ['memo', 'year', 'month', 'week', 'day']; 
                const curIdx = scopes.indexOf(store.scope);
                
                if (deltaX < 0 && curIdx < scopes.length - 1) {
                    if (window.setScope) window.setScope(scopes[curIdx + 1]);
                } else if (deltaX > 0 && curIdx > 0) {
                    if (window.setScope) window.setScope(scopes[curIdx - 1]);
                }
            }
        }
    }, { passive: true });
})();

// ==========================================================================
// ⌨️ 단축키(Keyboard Shortcuts) 이벤트 엔진 (크롬 단축키 완벽 차단)
// ==========================================================================
document.addEventListener('keydown', function(event) {
  const isTyping = event.target.tagName === 'INPUT' || 
                   event.target.tagName === 'TEXTAREA' || 
                   event.target.isContentEditable;

  const isCtrlOrCmd = event.ctrlKey || event.metaKey;

  // 구글 캘린더 내보내기 (빠른 동기화): Ctrl + Shift + S
  if (isCtrlOrCmd && event.shiftKey && (event.key === 's' || event.key === 'S')) {
    event.preventDefault();
    if(window.quickGoogleSync) window.quickGoogleSync();
    return;
  }

  // 항목 추가/저장: Ctrl + S (크롬 다른이름으로 저장 차단)
  if (isCtrlOrCmd && !event.shiftKey && (event.key === 's' || event.key === 'S')) {
    event.preventDefault();
    if (store.mode === 'editor') {
      if(window.saveCurrentViewData) window.saveCurrentViewData();
    }
    return;
  }

  // 찾기: Ctrl + F (크롬 기본 검색창 차단)
  if (isCtrlOrCmd && !event.shiftKey && (event.key === 'f' || event.key === 'F')) {
    event.preventDefault();
    if (typeof window.openSearchModal === 'function') window.openSearchModal();
    return;
  }

  if (isCtrlOrCmd && !event.shiftKey && event.key === 'Enter') {
    event.preventDefault();
    if (store.mode === 'editor') {
      if(window.saveCurrentViewData) window.saveCurrentViewData();
    }
    return;
  }

  if (isTyping) return;

  if (isCtrlOrCmd) {
    if (event.code === 'Space' || event.key === ' ') {
        event.preventDefault();
        if (typeof window.goToToday === 'function') {
            window.goToToday();
        } else {
            window.currentDate = new Date();
            if (typeof window.render === 'function') window.render();
            if (typeof window.scrollToTodayIfExist === 'function') {
                setTimeout(window.scrollToTodayIfExist, 100);
            }
        }
        return;
    }

    switch (event.key) {
      case 'ArrowLeft': 
        event.preventDefault();
        if(window.moveDate) window.moveDate(-1);
        break;
      case 'ArrowRight': 
        event.preventDefault();
        if(window.moveDate) window.moveDate(1);
        break;
      case 'ArrowUp': 
        event.preventDefault();
        if(store.mode !== 'viewer') {
            if(window.setMode) window.setMode('viewer');
        }
        break;
      case 'ArrowDown': 
        event.preventDefault();
        if(store.mode !== 'editor') {
            if(window.setMode) window.setMode('editor');
        }
        break;
    }
  }
  else if (event.shiftKey) {
    const scopeOrder = ['memo', 'year', 'month', 'week', 'day'];
    const currentIndex = scopeOrder.indexOf(store.scope);

    if (event.key === 'ArrowLeft') { 
      event.preventDefault();
      if (currentIndex > 0 && window.setScope) window.setScope(scopeOrder[currentIndex - 1]);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      if (currentIndex !== -1 && currentIndex < scopeOrder.length - 1 && window.setScope) {
          window.setScope(scopeOrder[currentIndex + 1]);
      }
    }
  }
});

// ==========================================================================
// 📋 클립보드 이미지 붙여넣기 (Ctrl + V) 이벤트 엔진
// ==========================================================================
document.addEventListener('paste', async (event) => {
    const activeEl = document.activeElement;
    
    // 텍스트 입력창(textarea, input)에 포커스가 없으면 무시
    if (!activeEl || (activeEl.tagName !== 'TEXTAREA' && activeEl.tagName !== 'INPUT')) return;

    const items = (event.clipboardData || window.clipboardData).items;
    let imageFile = null;

    // 클립보드 데이터 중 이미지가 있는지 탐색
    for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
            imageFile = items[i].getAsFile();
            break;
        }
    }

    // 클립보드에 이미지가 없다면 (일반 텍스트라면) 브라우저 기본 붙여넣기 동작 수행
    if (!imageFile) return;

    // 이미지가 확인되었으므로, 문자열로 변환되어 깨지는 기본 동작 방지
    event.preventDefault();

    // 1. 하루 페이지 '오늘 기록' 텍스트박스인 경우
    const journalCard = activeEl.closest('[id^="journal-card-"]');
    if (journalCard && window.dayViewInstance) {
        const fId = journalCard.id.split('-')[2];
        const idx = journalCard.getAttribute('data-journal-idx');
        if (fId && idx !== null) {
            // 기존 업로드 함수가 input 요소를 받으므로, 가짜 input 객체 생성
            const fakeInput = { files: [imageFile], value: '' };
            window.dayViewInstance.handleJournalAttachmentUpload(fId, parseInt(idx, 10), fakeInput);
            return;
        }
    }

    // 2. 메모 페이지 '새 메모 추가' 텍스트박스인 경우
    if (activeEl.id === 'memo-input-text' && window.memoViewInstance) {
        const fakeInput = { files: [imageFile], value: '' };
        window.memoViewInstance.handleFileUpload(fakeInput);
        return;
    }

    // 3. 메모 페이지 '기존 메모 수정' 텍스트박스인 경우
    const memoRow = activeEl.closest('.memo-item-row');
    if (memoRow && window.memoViewInstance) {
        const firestoreId = memoRow.id.replace('memo-card-', '');
        if (firestoreId) {
            const fakeInput = { files: [imageFile], value: '' };
            window.memoViewInstance.handleMemoItemAttachmentUpload(firestoreId, fakeInput);
            return;
        }
    }

    if (window.showToast) window.showToast('이 입력칸에서는 이미지 붙여넣기를 지원하지 않습니다.');
});