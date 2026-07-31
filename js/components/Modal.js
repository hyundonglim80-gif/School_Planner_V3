//js/components/Modal.js

// 모든 팝업창을 통제하는 전역 관리자
class ModalManager {
  static stack = [];

  static push(modal) {
    this.stack.push(modal);
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

// ESC 키를 누르면 가장 위에 있는 팝업부터 순서대로 닫힘
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    ModalManager.closeTop();
  }
});

// 개별 팝업창을 찍어내는 붕어빵 틀(클래스)
class Modal {
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

    const modalOverlay = document.createElement('div');
    modalOverlay.id = this.id;
    modalOverlay.className = 'modal-overlay hidden';
    modalOverlay.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:10005; display:none; justify-content:center; align-items:center;';

    // 💡 기존 index.html에 있던 디자인 스타일을 그대로 적용
    modalOverlay.innerHTML = `
      <div class="modal-content" style="background:#fff; border-radius:12px; width:90%; max-width:${this.width}; max-height:85vh; display:flex; flex-direction:column; box-shadow:0 10px 25px rgba(0,0,0,0.2); overflow:hidden;">
        <div class="modal-header" style="padding:15px 20px; border-bottom:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center; background:#f8fafc;">
          <h2 style="margin:0; font-size:1.2rem; color:#0f172a;">${this.title}</h2>
          <button class="btn-close-modal" style="background:none; border:none; font-size:1.5rem; cursor:pointer; color:#64748b;" title="닫기 (Esc)">&times;</button>
        </div>
        <div class="modal-body" style="padding:20px; overflow-y:auto;">
          ${this.content}
        </div>
      </div>
    `;

    modalOverlay.querySelector('.btn-close-modal').addEventListener('click', () => this.close());
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) this.close();
    });

    document.body.appendChild(modalOverlay);
    this.element = modalOverlay;
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

// 전역에서 사용할 수 있게 window에 바인딩 (이후 모듈화가 완성되면 제거 예정)
window.Modal = Modal;
