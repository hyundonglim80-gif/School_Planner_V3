//js/core/events.js

// ==========================================================================
// 📱 모바일 스와이프(좌우 밀기) 화면 전환 제스처 기능 (페이지 양 끝단 감지 방식)
// ==========================================================================
(function() {
    let touchStartX = 0;
    let touchStartY = 0;
    let touchEndX = 0;
    let touchEndY = 0;
    let touchStartTime = 0;
    let isMultiTouch = false;

    const SWIPE_THRESHOLD = 50;  // 스와이프 인식 최소 거리
    const SWIPE_MAX_TIME = 800;  // 스와이프 허용 최대 시간

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
        if (isMultiTouch || e.changedTouches.length === 0) return;

        touchEndX = e.changedTouches[0].screenX;
        touchEndY = e.changedTouches[0].screenY;
        const touchDuration = Date.now() - touchStartTime;

        // 터치를 너무 오래 누르고 있었으면 무시
        if (touchDuration > SWIPE_MAX_TIME) return;

        const deltaX = touchEndX - touchStartX;
        const deltaY = touchEndY - touchStartY;

        // 가로 스와이프 판정 (상하보다 좌우 움직임이 확실히 클 때만)
        if (Math.abs(deltaX) > SWIPE_THRESHOLD && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
            
            // 💡 [안전장치] 에디터(수정) 모드일 때는 데이터 날아감을 방지하기 위해 스와이프를 막습니다.
            // 💡 메모 탭(memo)에서는 이전/다음 날짜 개념이 없으므로 무시합니다.
            if (window.currentMode === 'editor' || window.currentScope === 'memo') return;

            const edgeState = getHorizontalEdgeState();

            if (deltaX > 0 && edgeState.isAtLeftEdge) {
                // 오른쪽으로 스와이프 (손가락을 오른쪽으로 당김) 👉 이전 날짜로 이동
                window.moveDate(-1);
            } else if (deltaX < 0 && edgeState.isAtRightEdge) {
                // 왼쪽으로 스와이프 (손가락을 왼쪽으로 밈) 👉 다음 날짜로 이동
                window.moveDate(1);
            }
        }
    }, { passive: true });
})();

// ==========================================================================
// ⌨️ 단축키(Keyboard Shortcuts) 이벤트 엔진
// ==========================================================================
document.addEventListener('keydown', function(event) {
  const isTyping = event.target.tagName === 'INPUT' || 
                   event.target.tagName === 'TEXTAREA' || 
                   event.target.isContentEditable;

  if (event.ctrlKey && event.key === 'Enter') {
    event.preventDefault();
    if (typeof currentMode !== 'undefined' && currentMode === 'editor') {
      if(window.saveCurrentViewData) window.saveCurrentViewData();
    }
    return;
  }

  if (isTyping) return;

  if (event.ctrlKey) {
    switch (event.key) {
      case 'ArrowLeft': 
        event.preventDefault();
        if(window.moveDate) window.moveDate(-1);
        break;
      case 'ArrowRight': 
        event.preventDefault();
        if(window.moveDate) window.moveDate(1);
        break;
      case ' ': 
        event.preventDefault();
        if(window.goToToday) window.goToToday();
        break;
      case 'ArrowUp': 
        event.preventDefault();
        if(typeof currentMode !== 'undefined' && currentMode !== 'viewer') {
            if(window.setMode) window.setMode('viewer');
        }
        break;
      case 'ArrowDown': 
        event.preventDefault();
        if(typeof currentMode !== 'undefined' && currentMode !== 'editor') {
            if(window.setMode) window.setMode('editor');
        }
        break;
    }
  }
  else if (event.shiftKey) {
    const scopeOrder = ['memo', 'year', 'month', 'week', 'day'];
    const currentIndex = typeof currentScope !== 'undefined' ? scopeOrder.indexOf(currentScope) : -1;

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
  else {
    // '/' 키 누르면 검색창 열기
    if (event.key === '/') { 
      event.preventDefault();
      if (typeof window.openSearchModal === 'function') window.openSearchModal();
    }
  }
});
