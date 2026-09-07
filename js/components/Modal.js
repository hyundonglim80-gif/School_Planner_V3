// js/components/Modal.js

// ==========================================================================
// 💡 페이지 전환/새로고침 시 팝업 카운터 강제 초기화 (안전장치)
// ==========================================================================
window.resetModalCount = () => {
    window.activeModalCount = 0;
    ModalManager.stack = [];
};
window.addEventListener('popstate', window.resetModalCount);

// 모든 팝업창을 통제하는 전역 관리자
export class ModalManager {
    static stack = [];
    
    static push(modal) { 
        if (!this.stack.includes(modal)) {
            this.stack.push(modal); 
        }
    }
    
    static pop(modal) { 
        this.stack = this.stack.filter(m => m !== modal); 
    }
    
    static closeTop() {
        if (this.stack.length > 0) {
            const topModal = this.stack[this.stack.length - 1];
            topModal.close(); 
            return true;
        }
        return false;
    }
}

// ==========================================================================
// 🚀 모든 팝업(레거시 포함) z-index 자동 최상단 끌어올리기 엔진
// ==========================================================================
const zIndexObserver = new MutationObserver((mutations) => {
    mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
            if (node.nodeType === 1) {
                const isModal = node.classList.contains('modal-overlay') || 
                                node.id === 'help-modal' || 
                                node.id === 'link-modal' || 
                                node.id === 'image-viewer-modal';
                if (isModal) {
                    const allModals = document.querySelectorAll('.modal-overlay, #help-modal, #link-modal, #image-viewer-modal');
                    node.style.setProperty('z-index', 100000 + allModals.length, 'important');
                }
            }
        });
    });
    updateBodyModalOpenState();
});
zIndexObserver.observe(document.body, { childList: true });

// ==========================================================================
// 🔒 최상위 팝업창(모달) 탐색 및 스크롤 격리 엔진
// ==========================================================================
export function getTopmostVisibleModal() {
    const selector = '.modal-overlay, #help-modal, #link-modal, #image-viewer-modal, [id*="modal-overlay"], .super-alarm-overlay';
    const elements = Array.from(document.querySelectorAll(selector)).filter(el => {
        if (el.id === 'login-screen' || el.id === 'main-view') return false;
        if (el.classList.contains('hidden')) return false;
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
    });
    if (elements.length === 0) return null;

    elements.sort((a, b) => {
        const za = parseInt(window.getComputedStyle(a).zIndex, 10) || 0;
        const zb = parseInt(window.getComputedStyle(b).zIndex, 10) || 0;
        if (za !== zb) return za - zb;
        return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
    });
    return elements[elements.length - 1];
}
window.getTopmostVisibleModal = getTopmostVisibleModal;

export function updateBodyModalOpenState() {
    const topModal = getTopmostVisibleModal();
    const hasModal = !!topModal;
    document.body.classList.toggle('modal-open', hasModal);
    document.documentElement.classList.toggle('modal-open', hasModal);
}
window.updateBodyModalOpenState = updateBodyModalOpenState;

function findScrollableParent(target, boundaryEl) {
    let curr = target;
    while (curr && curr !== document.body && curr !== document.documentElement) {
        const style = window.getComputedStyle(curr);
        const overflowY = style.overflowY;
        const canScrollY = (overflowY === 'auto' || overflowY === 'scroll') && (curr.scrollHeight > curr.clientHeight);
        if (canScrollY) {
            return curr;
        }
        if (curr === boundaryEl) break;
        curr = curr.parentElement;
    }
    if (boundaryEl) {
        const style = window.getComputedStyle(boundaryEl);
        const overflowY = style.overflowY;
        if ((overflowY === 'auto' || overflowY === 'scroll') && (boundaryEl.scrollHeight > boundaryEl.clientHeight)) {
            return boundaryEl;
        }
    }
    return null;
}

window.addEventListener('wheel', (e) => {
    const topModal = getTopmostVisibleModal();
    if (!topModal) return;

    // 마우스가 최상위 모달 외부(배경, 하위 모달 등)에 있으면 스크롤 차단
    if (!topModal.contains(e.target)) {
        e.preventDefault();
        e.stopPropagation();
        return;
    }

    // 최상위 모달 내부에서 스크롤 가능한 요소 검색
    const scrollable = findScrollableParent(e.target, topModal);
    if (!scrollable) {
        e.preventDefault();
        e.stopPropagation();
        return;
    }

    // 스크롤 상/하단 한계 도달 시 스크롤 체이닝 차단
    const delta = e.deltaY;
    const isAtTop = scrollable.scrollTop <= 0;
    const isAtBottom = Math.ceil(scrollable.scrollTop + scrollable.clientHeight) >= scrollable.scrollHeight - 1;

    if (delta < 0 && isAtTop) {
        e.preventDefault();
        e.stopPropagation();
    } else if (delta > 0 && isAtBottom) {
        e.preventDefault();
        e.stopPropagation();
    } else {
        e.stopPropagation();
    }
}, { passive: false, capture: true });

let touchStartYPos = 0;
window.addEventListener('touchstart', (e) => {
    if (e.touches && e.touches.length > 0) {
        touchStartYPos = e.touches[0].clientY;
    }
}, { passive: true, capture: true });

window.addEventListener('touchmove', (e) => {
    const topModal = getTopmostVisibleModal();
    if (!topModal) return;

    if (!topModal.contains(e.target)) {
        e.preventDefault();
        e.stopPropagation();
        return;
    }

    const scrollable = findScrollableParent(e.target, topModal);
    if (!scrollable) {
        e.preventDefault();
        e.stopPropagation();
        return;
    }

    const currentY = e.touches[0].clientY;
    const deltaY = touchStartYPos - currentY;
    const isAtTop = scrollable.scrollTop <= 0;
    const isAtBottom = Math.ceil(scrollable.scrollTop + scrollable.clientHeight) >= scrollable.scrollHeight - 1;

    if (deltaY < 0 && isAtTop) {
        e.preventDefault();
        e.stopPropagation();
    } else if (deltaY > 0 && isAtBottom) {
        e.preventDefault();
        e.stopPropagation();
    } else {
        e.stopPropagation();
    }
}, { passive: false, capture: true });


// ==========================================================================
// 🌐 전역 팝업(모달) 안전 종료 엔진
// ==========================================================================
document.addEventListener('mousedown', (e) => {
    const isOverlay = e.target.classList.contains('modal-overlay') || 
                      e.target.id === 'help-modal' || 
                      e.target.id === 'link-modal' ||
                      e.target.id === 'image-viewer-modal';

    if (isOverlay) {
        const matchedModal = ModalManager.stack.find(m => m.element === e.target);
        if (matchedModal) {
            matchedModal.close();
            return;
        }

        if (e.target.id === 'image-viewer-modal') {
            e.target.classList.add('hidden');
            e.target.style.display = 'none';
            if (window.decreaseModalCount) window.decreaseModalCount(); 
            return;
        }

        if (e.target.id === 'login-screen') return;

        const closeBtn = e.target.querySelector('.btn-close-modal, .close-btn, button[onclick*="close"]');
        if (closeBtn) {
            closeBtn.click();
        } else {
            e.target.remove();
            if (window.decreaseModalCount) window.decreaseModalCount(); 
        }
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (ModalManager.closeTop()) return;

        const visibleOverlays = Array.from(document.querySelectorAll('.modal-overlay, #help-modal, #link-modal, #image-viewer-modal')).filter(el => {
            const style = window.getComputedStyle(el);
            return style.display !== 'none' && el.id !== 'login-screen' && !el.classList.contains('hidden');
        });

        if (visibleOverlays.length > 0) {
            const topOverlay = visibleOverlays[visibleOverlays.length - 1];
            
            if (topOverlay.id === 'image-viewer-modal') {
                topOverlay.classList.add('hidden');
                topOverlay.style.display = 'none';
                if (window.decreaseModalCount) window.decreaseModalCount(); 
            } else {
                const closeBtn = topOverlay.querySelector('.btn-close-modal, .close-btn, button[onclick*="close"]');
                if (closeBtn) {
                    closeBtn.click();
                } else {
                    topOverlay.remove();
                    if (window.decreaseModalCount) window.decreaseModalCount(); 
                }
            }
        }
    }
});

// ==========================================================================
// 🛠️ 팝업창 골격 (Modern UI 적용)
// ==========================================================================
export class Modal {
    constructor({ id, title, content, width = '400px', onClose = null }) {
        this.id = id;
        this.title = title;
        this.content = content;
        this.width = width;
        this.onClose = onClose;
        this.element = null;
    }

    create() {
        if (document.getElementById(this.id)) {
            this.element = document.getElementById(this.id);
            const body = this.element.querySelector('.modal-body');
            if(body) body.innerHTML = this.content;
            return;
        }

        const overlay = document.createElement('div');
        overlay.id = this.id;
        overlay.className = 'modal-overlay hidden';
        
        // 💡 [디자인 핵심] 전체 화면 크기 고정, 배경 블러(blur) 효과 적용, 상하좌우 반응형 여백(padding) 강제 지정
        overlay.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(15, 23, 42, 0.55); backdrop-filter:blur(5px); display:none; justify-content:center; align-items:center; padding:clamp(12px, 4vw, 32px); box-sizing:border-box;';

        // 💡 [디자인 핵심] 부드러운 20px 곡선, 입체적인 그림자, 깨끗한 헤더 분리
        overlay.innerHTML = `
            <div class="modal-content" style="width:${this.width}; max-width:100%; max-height:100%; background:#fff; border-radius:20px; box-shadow:0 25px 50px -12px rgba(0,0,0,0.3); display:flex; flex-direction:column; overflow:hidden;">
                <div class="modal-header" style="flex-shrink:0; padding:20px 24px; background:#ffffff; border-bottom:1px solid #f1f5f9; display:flex; justify-content:space-between; align-items:center;">
                    <h2 style="font-size:1.3rem; margin:0; color:#0f172a; font-weight:800; letter-spacing:-0.5px;">${this.title}</h2>
                    <button class="btn-close-modal" style="display:flex; justify-content:center; align-items:center; width:32px; height:32px; font-size:1.4rem; background:#f1f5f9; border:none; border-radius:50%; cursor:pointer; color:#64748b; transition:all 0.2s; line-height:1;" onmouseover="this.style.background='#e2e8f0'; this.style.color='#0f172a';" onmouseout="this.style.background='#f1f5f9'; this.style.color='#64748b';" title="닫기">&times;</button>
                </div>
                <div class="modal-body" style="flex:1; display:flex; flex-direction:column; overflow-y:auto; padding:0; min-height:0; background:#f8fafc;">
                    ${this.content}
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        this.element = overlay;

        const closeBtn = overlay.querySelector('.btn-close-modal');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.close());
        }
    }

    open() {
        if (!this.element) this.create();
        
        ModalManager.push(this);
        this.element.classList.remove('hidden');
        this.element.style.display = 'flex';
        
        if (window.increaseModalCount) window.increaseModalCount();
        updateBodyModalOpenState();
    }

    close() {
        if (this.element) {
            this.element.remove();
            this.element = null;
        }
        if (this.onClose) this.onClose();
        ModalManager.pop(this);
        
        if (window.decreaseModalCount) window.decreaseModalCount();
        updateBodyModalOpenState();
    }
}

window.ModalManager = ModalManager;
window.Modal = Modal;
