// js/components/Modal.js

// ==========================================================================
// 💡 [핵심 추가] 페이지 전환/새로고침 시 팝업 카운터 강제 초기화 (안전장치)
// ==========================================================================
window.resetModalCount = () => {
    window.activeModalCount = 0;
    ModalManager.stack = [];
};
// 브라우저 뒤로가기 등 히스토리 변경 시 카운터 0으로 초기화
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
            topModal.close(); // 내부에서 자동으로 -1 처리됨
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
                    // 항상 기존 모달들보다 높은 z-index 부여 (100000 단위부터 시작)
                    node.style.setProperty('z-index', 100000 + allModals.length, 'important');
                }
            }
        });
    });
});
zIndexObserver.observe(document.body, { childList: true });

// ==========================================================================
// 🌐 전역 팝업(모달) 안전 종료 엔진 (ESC 키 & 바깥 영역 클릭 시 -1 완벽 연동)
// ==========================================================================

// 1. 바깥 영역(어두운 배경) 클릭 시 닫기
document.addEventListener('mousedown', (e) => {
    const isOverlay = e.target.classList.contains('modal-overlay') || 
                      e.target.id === 'help-modal' || 
                      e.target.id === 'link-modal' ||
                      e.target.id === 'image-viewer-modal';

    if (isOverlay) {
        // ① 정식 Modal 객체인 경우 (close 메서드 호출 시 알아서 -1 됨)
        const matchedModal = ModalManager.stack.find(m => m.element === e.target);
        if (matchedModal) {
            matchedModal.close();
            return;
        }

        // ② 예외 팝업 (이미지 뷰어 등)
        if (e.target.id === 'image-viewer-modal') {
            e.target.classList.add('hidden');
            e.target.style.display = 'none';
            if (window.decreaseModalCount) window.decreaseModalCount(); // 💡 강제 닫힘이므로 -1
            return;
        }

        // ③ 로그인 창은 바깥 클릭 무시
        if (e.target.id === 'login-screen') return;

        // ④ 기타 팝업 (닫기 버튼을 찾아 누르거나, 없으면 삭제 후 -1)
        const closeBtn = e.target.querySelector('.btn-close-modal, .close-btn, button[onclick*="close"]');
        if (closeBtn) {
            closeBtn.click(); // 버튼의 클릭 이벤트에 닫기 로직이 연결되어 있음
        } else {
            e.target.remove();
            if (window.decreaseModalCount) window.decreaseModalCount(); // 💡 강제 삭제이므로 -1
        }
    }
});

// 2. ESC 키 입력 시 닫기
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        // ① 스택에 있는 팝업부터 닫기 (내부에서 알아서 -1)
        if (ModalManager.closeTop()) return;

        // ② 스택에 없는 레거시 수동 팝업들 찾아서 닫기
        const visibleOverlays = Array.from(document.querySelectorAll('.modal-overlay, #help-modal, #link-modal, #image-viewer-modal')).filter(el => {
            const style = window.getComputedStyle(el);
            return style.display !== 'none' && el.id !== 'login-screen' && !el.classList.contains('hidden');
        });

        if (visibleOverlays.length > 0) {
            const topOverlay = visibleOverlays[visibleOverlays.length - 1];
            
            if (topOverlay.id === 'image-viewer-modal') {
                topOverlay.classList.add('hidden');
                topOverlay.style.display = 'none';
                if (window.decreaseModalCount) window.decreaseModalCount(); // 💡 ESC 강제 닫힘이므로 -1
            } else {
                const closeBtn = topOverlay.querySelector('.btn-close-modal, .close-btn, button[onclick*="close"]');
                if (closeBtn) {
                    closeBtn.click();
                } else {
                    topOverlay.remove();
                    if (window.decreaseModalCount) window.decreaseModalCount(); // 💡 ESC 강제 삭제이므로 -1
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

        overlay.innerHTML = `
            <div class="modal-content" style="width:${this.width}; background:#fff; border-radius:12px; box-shadow:0 10px 25px rgba(0,0,0,0.2); display:flex; flex-direction:column; max-height:90vh;">
                <div class="modal-header" style="padding:15px 20px; background:#f8fafc; border-bottom:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center; border-radius:12px 12px 0 0;">
                    <h2 style="font-size:1.2rem; margin:0; color:#1e293b;">${this.title}</h2>
                    <button class="btn-close-modal" style="font-size:1.5rem; background:none; border:none; cursor:pointer; color:#64748b; line-height:1;" title="닫기">&times;</button>
                </div>
                <div class="modal-body" style="padding:20px; overflow-y:auto;">
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
        
        // 💡 [팝업 열림] 카운터 +1 증가
        if (window.increaseModalCount) window.increaseModalCount();
    }

    close() {
        if (this.element) {
            this.element.remove();
            this.element = null;
        }
        if (this.onClose) this.onClose();
        ModalManager.pop(this);
        
        // 💡 [팝업 닫힘] 카운터 -1 감소
        if (window.decreaseModalCount) window.decreaseModalCount();
    }
}

// ==========================================================================
// 🌉 과도기 호환성 레이어 
// ==========================================================================
window.ModalManager = ModalManager;
window.Modal = Modal;
