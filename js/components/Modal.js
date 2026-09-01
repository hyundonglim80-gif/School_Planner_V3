// js/components/Modal.js

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
// 🚀 모든 팝업(레거시 포함) z-index 자동 최상단 끌어올리기 엔진 (팝업 겹침 완벽 해결)
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
// 🌐 전역 팝업(모달) 안전 종료 엔진 (ESC 키 & 바깥 영역 클릭 완벽 제어)
// ==========================================================================

// 1. 바깥 영역(어두운 배경) 클릭 시 닫기
document.addEventListener('mousedown', (e) => {
    const isOverlay = e.target.classList.contains('modal-overlay') || 
                      e.target.id === 'help-modal' || 
                      e.target.id === 'link-modal' ||
                      e.target.id === 'image-viewer-modal';

    if (isOverlay) {
        // ① Modal.js 클래스로 정식 생성된 팝업인 경우 (스택에서 찾아 안전하게 종료)
        const matchedModal = ModalManager.stack.find(m => m.element === e.target);
        if (matchedModal) {
            matchedModal.close();
            return;
        }

        // ② index.html에 하드코딩된 예외 팝업인 경우 (DOM 삭제 대신 숨김 처리)
        if (e.target.id === 'image-viewer-modal') {
            e.target.classList.add('hidden');
            e.target.style.display = 'none';
            return;
        }

        // ③ 로그인 창은 바깥을 클릭해도 닫히면 안 되므로 예외 처리
        if (e.target.id === 'login-screen') return;

        // ④ [버그 픽스] 레거시 팝업의 경우 HTML만 지우면 변수 초기화가 안 되므로 닫기 버튼을 찾아서 클릭 이벤트를 발생시킴
        const closeBtn = e.target.querySelector('.btn-close-modal, .close-btn, button[onclick*="close"]');
        if (closeBtn) {
            closeBtn.click();
        } else {
            e.target.remove();
        }
    }
});

// 2. ESC 키 입력 시 닫기
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        // ① 정식 팝업이 스택에 있다면 가장 위의 것부터 닫기
        if (ModalManager.closeTop()) return;

        // ② 스택에는 없지만 화면에 강제로 떠 있는 수동 팝업들을 찾아서 닫기
        const visibleOverlays = Array.from(document.querySelectorAll('.modal-overlay, #help-modal, #link-modal, #image-viewer-modal')).filter(el => {
            const style = window.getComputedStyle(el);
            return style.display !== 'none' && el.id !== 'login-screen' && !el.classList.contains('hidden');
        });

        if (visibleOverlays.length > 0) {
            const topOverlay = visibleOverlays[visibleOverlays.length - 1];
            if (topOverlay.id === 'image-viewer-modal') {
                topOverlay.classList.add('hidden');
                topOverlay.style.display = 'none';
            } else {
                // [버그 픽스] ESC 종료 시에도 닫기 버튼을 클릭하여 시스템 정상 종료 유도
                const closeBtn = topOverlay.querySelector('.btn-close-modal, .close-btn, button[onclick*="close"]');
                if (closeBtn) closeBtn.click();
                else topOverlay.remove();
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
            // 기존 팝업 재사용 시 내용(content) 최신화 보장
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
    }

    close() {
        if (this.element) {
            // [버그 픽스] 다음번 렌더링 시 최신 데이터를 보장하기 위해 아예 삭제
            this.element.remove();
            this.element = null;
        }
        if (this.onClose) this.onClose();
        ModalManager.pop(this);
    }
}

// ==========================================================================
// 🌉 과도기 호환성 레이어 
// ==========================================================================
window.ModalManager = ModalManager;
window.Modal = Modal;
