// js/components/Modal.js

// 모든 팝업창을 통제하는 전역 관리자
export class ModalManager {
    static stack = [];
    static push(modal) { this.stack.push(modal); }
    static pop(modal) { this.stack = this.stack.filter(m => m !== modal); }
    static closeTop() {
        if (this.stack.length > 0) {
            const topModal = this.stack[this.stack.length - 1];
            topModal.close();
            return true;
        }
        return false;
    }
}

// ESC 키를 누르면 가장 위에 있는 팝업부터 순서대로 닫힘
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { ModalManager.closeTop(); }
});

// 개별 팝업창을 찍어내는 붕어빵 틀(클래스)
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
            return;
        }

        // 💡 원본에서 생략되었던 팝업 레이아웃을 기존 SP3 스타일과 100% 동일하게 복원했습니다.
        const overlay = document.createElement('div');
        overlay.id = this.id;
        overlay.className = 'modal-overlay hidden';
        overlay.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.5); z-index:10005; display:none; justify-content:center; align-items:center;';

        overlay.innerHTML = `
            <div class="modal-content" style="width:${this.width}; background:#fff; border-radius:12px; box-shadow:0 10px 25px rgba(0,0,0,0.2); display:flex; flex-direction:column; max-height:90vh;">
                <div class="modal-header" style="padding:15px 20px; background:#f8fafc; border-bottom:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center; border-radius:12px 12px 0 0;">
                    <h2 style="font-size:1.2rem; margin:0; color:#1e293b;">${this.title}</h2>
                    <button class="btn-close-modal" style="font-size:1.5rem; background:none; border:none; cursor:pointer; color:#64748b; line-height:1;">&times;</button>
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

        // 팝업창 바깥의 어두운 배경을 클릭하면 닫히도록 설정
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) this.close();
        });
    }

    open() {
        if (!this.element) this.create();
        this.element.classList.remove('hidden');
        this.element.style.display = 'flex';
        ModalManager.push(this);
    }

    close() {
        if (this.element) {
            this.element.classList.add('hidden');
            this.element.style.display = 'none';
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
