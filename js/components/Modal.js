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
});
zIndexObserver.observe(document.body, { childList: true });

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
// 🛠️ 개별 팝업창을 찍어내는 붕어빵 틀 (클래스)
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
        overlay.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.5); display:none; justify-content:center; align-items:center;';

        // 💡 [핵심 수정] 바깥 박스는 overflow: hidden 처리, 내용물이 들어가는 modal-body는 flex: 1로 구조 변경
        overlay.innerHTML = `
            <div class="modal-content" style="width:${this.width}; background:#fff; border-radius:12px; box-shadow:0 10px 25px rgba(0,0,0,0.2); display:flex; flex-direction:column; max-height:90vh; overflow:hidden;">
                <div class="modal-header" style="flex-shrink:0; padding:15px 20px; background:#f8fafc; border-bottom:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center;">
                    <h2 style="font-size:1.2rem; margin:0; color:#1e293b;">${this.title}</h2>
                    <button class="btn-close-modal" style="font-size:1.5rem; background:none; border:none; cursor:pointer; color:#64748b; line-height:1;" title="닫기">&times;</button>
                </div>
                <div class="modal-body" style="flex:1; display:flex; flex-direction:column; overflow-y:auto; padding:0; min-height:0;">
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
    }

    close() {
        if (this.element) {
            this.element.remove();
            this.element = null;
        }
        if (this.onClose) this.onClose();
        ModalManager.pop(this);
        
        if (window.decreaseModalCount) window.decreaseModalCount();
    }
}

window.ModalManager = ModalManager;
window.Modal = Modal;
