// js/core/events.js

import { store } from './store.js';

// ==========================================================================
// 📱 모바일 스와이프(좌우 밀기) 화면 전환 제스처 기능
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

        if (touchDuration > SWIPE_MAX_TIME) return;

        const deltaX = touchEndX - touchStartX;
        const deltaY = touchEndY - touchStartY;

        if (Math.abs(deltaX) > SWIPE_THRESHOLD && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
            
            if (store.mode === 'editor' || store.scope === 'memo') return;

            const edgeState = getHorizontalEdgeState();

            if (deltaX > 0 && edgeState.isAtLeftEdge) {
                if (window.moveDate) window.moveDate(-1);
            } else if (deltaX < 0 && edgeState.isAtRightEdge) {
                if (window.moveDate) window.moveDate(1);
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
    if (store.mode === 'editor') {
      if(window.saveCurrentViewData) window.saveCurrentViewData();
    }
    return;
  }

  if (isTyping) return;

  if (event.ctrlKey) {
    // 🌟 Ctrl + 스페이스바: 현재 뷰(Scope)를 유지한 채 '오늘' 날짜로 이동 (중앙 날짜 클릭과 완전히 동일)
    if (event.code === 'Space' || event.key === ' ') {
        event.preventDefault();
        
        if (typeof window.goToToday === 'function') {
            window.goToToday();
        } else {
            // 혹시라도 goToToday가 연결 안 되어 있을 때를 대비한 안전 장치
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
  else {
    if (event.key === '/') { 
      event.preventDefault();
      if (typeof window.openSearchModal === 'function') window.openSearchModal();
    }
  }
});