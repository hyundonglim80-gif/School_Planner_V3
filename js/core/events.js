//js/core/events.js

// ==========================================================================
// 📱 모바일 스와이프(좌우 밀기) 화면 전환 제스처 기능
// ==========================================================================
(function() {
  let touchStartX = 0; let touchStartY = 0; let touchEndX = 0; let touchEndY = 0;
  let touchStartTime = 0; let isMultiTouch = false;
  const scopeOrder = ['memo', 'year', 'month', 'week', 'day'];
  const SWIPE_THRESHOLD = 50; const SWIPE_MAX_TIME = 800;  

  function getHorizontalEdgeState() {
    const vv = window.visualViewport;
    let scrollLeft = window.scrollX || document.documentElement.scrollLeft || document.body.scrollLeft || 0;
    if (vv && vv.offsetLeft) scrollLeft += vv.offsetLeft;
    const totalWidth = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth, vv ? vv.width * vv.scale : window.innerWidth);
    const viewportWidth = vv ? vv.width : window.innerWidth;
    const maxScrollLeft = Math.max(0, totalWidth - viewportWidth);
    return { isAtLeftEdge: scrollLeft <= 15, isAtRightEdge: scrollLeft >= (maxScrollLeft - 15) };
  }

  function handleSwipeGesture() {
    if (typeof currentMode !== 'undefined' && currentMode !== 'viewer') return;
    if (isMultiTouch) return;
    const deltaX = touchEndX - touchStartX; const deltaY = touchEndY - touchStartY;
    const deltaTime = Date.now() - touchStartTime;

    if (deltaTime > SWIPE_MAX_TIME) return;
    if (Math.abs(deltaY) > Math.abs(deltaX) / 2) return;

    if (Math.abs(deltaX) > SWIPE_THRESHOLD) {
      const { isAtLeftEdge, isAtRightEdge } = getHorizontalEdgeState();
      const currentIndex = typeof currentScope !== 'undefined' ? scopeOrder.indexOf(currentScope) : -1;
      
      if (deltaX < 0) {
        if (isAtRightEdge && currentIndex !== -1 && currentIndex < scopeOrder.length - 1) {
            if(window.setScope) window.setScope(scopeOrder[currentIndex + 1]);
        }
      } else {
        if (isAtLeftEdge && currentIndex > 0) {
            if(window.setScope) window.setScope(scopeOrder[currentIndex - 1]);
        }
      }
    }
  }

  document.addEventListener('touchstart', e => {
    if (e.touches.length > 1) { isMultiTouch = true; return; }
    isMultiTouch = false;
    touchStartX = e.changedTouches[0].screenX; touchStartY = e.changedTouches[0].screenY;
    touchStartTime = Date.now();
  }, { passive: true });
  document.addEventListener('touchmove', e => { if (e.touches.length > 1) isMultiTouch = true; }, { passive: true });
  document.addEventListener('touchend', e => {
    if (isMultiTouch) return;
    touchEndX = e.changedTouches[0].screenX; touchEndY = e.changedTouches[0].screenY;
    handleSwipeGesture();
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
