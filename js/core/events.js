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
            if (now - lastSwipeTime < 600) return; // 🌟 0.6초 이내 중복 실행 완벽 방지
            
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
                if (window.updateDateFromScroll) window.updateDateFromScroll(); // 스크롤 위치 기반 날짜 갱신
                
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
// ⌨️ 단축키(Keyboard Shortcuts) 이벤트 엔진
// ==========================================================================
document.addEventListener('keydown', function(event) {
  const isTyping = event.target.tagName === 'INPUT' || 
                   event.target.tagName === 'TEXTAREA' || 
                   event.target.isContentEditable;

  // Windows(Ctrl) 및 Mac(Cmd) 호환 지원
  const isCtrlOrCmd = event.ctrlKey || event.metaKey;

  // 1. 구글 캘린더 내보내기 (빠른 동기화): Ctrl + Shift + S
  if (isCtrlOrCmd && event.shiftKey && (event.key === 's' || event.key === 'S')) {
    event.preventDefault(); // 브라우저 기본 동작 차단
    if(window.quickGoogleSync) window.quickGoogleSync();
    return;
  }

  // 2. 항목 추가/저장: Ctrl + S (크롬 '다른 이름으로 저장' 완벽 차단)
  if (isCtrlOrCmd && !event.shiftKey && (event.key === 's' || event.key === 'S')) {
    event.preventDefault(); // 🚨 핵심: 크롬 저장창 뜨는 것을 여기서 차단합니다.
    if (store.mode === 'editor') {
      if(window.saveCurrentViewData) window.saveCurrentViewData();
    }
    return;
  }

  // 3. 찾기: Ctrl + F (크롬 기본 검색 바 완벽 차단)
  if (isCtrlOrCmd && !event.shiftKey && (event.key === 'f' || event.key === 'F')) {
    event.preventDefault(); // 🚨 핵심: 크롬 기본 찾기 바 뜨는 것을 차단합니다.
    if (typeof window.openSearchModal === 'function') window.openSearchModal();
    return;
  }

  // (기존 하위 호환) 항목 추가/저장: Ctrl + Enter
  if (isCtrlOrCmd && !event.shiftKey && event.key === 'Enter') {
    event.preventDefault();
    if (store.mode === 'editor') {
      if(window.saveCurrentViewData) window.saveCurrentViewData();
    }
    return;
  }

  // 사용자가 텍스트 입력창에서 타이핑 중일 때는 일반 방향키 등은 무시
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

    // 화면(탭) 이동: Shift + 좌/우 화살표
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