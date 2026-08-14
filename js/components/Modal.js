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


// ==========================================================================
// 📅 기간 설정 및 반복 일정 모달 호환성 브릿지 (필수 추가)
// ==========================================================================
export const PeriodModule = {
    modalInstance: null,
    open: function(dateStr, labelName, content, callback, labelId) {
        if (!this.modalInstance) {
            this.modalInstance = new Modal({
                id: 'period-setting-modal',
                title: `📅 [${labelName}] 기간 설정`,
                width: '420px',
                content: `
                    <div style="display:flex; flex-direction:column; gap:12px;">
                        <div>
                            <label style="font-size:0.85rem; font-weight:bold; color:#475569;">시작일</label>
                            <input type="date" id="period-start-date" value="${dateStr}" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px; box-sizing:border-box;">
                        </div>
                        <div>
                            <label style="font-size:0.85rem; font-weight:bold; color:#475569;">종료일</label>
                            <input type="date" id="period-end-date" value="${dateStr}" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px; box-sizing:border-box;">
                        </div>
                        <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:10px;">
                            <button id="btn-period-cancel" style="padding:8px 14px; background:#f1f5f9; border:none; border-radius:6px; cursor:pointer; font-weight:bold;">취소</button>
                            <button id="btn-period-confirm" style="padding:8px 14px; background:#2563eb; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold;">확인</button>
                        </div>
                    </div>
                `
            });
        }
        this.modalInstance.open();

        // 모달 내부 버튼 이벤트 바인딩
        setTimeout(() => {
            const cancelBtn = document.getElementById('btn-period-cancel');
            const confirmBtn = document.getElementById('btn-period-confirm');

            if (cancelBtn) {
                cancelBtn.onclick = () => {
                    this.modalInstance.close();
                    if (callback) callback(false);
                };
            }
            if (confirmBtn) {
                confirmBtn.onclick = async () => {
                    const startDate = document.getElementById('period-start-date').value;
                    const endDate = document.getElementById('period-end-date').value;
                    if (!startDate || !endDate) return alert("시작일과 종료일을 모두 선택해주세요.");

                    this.modalInstance.close();
                    // Firebase 기간 그룹 일정 생성 로직 호출
                    if (window.dbAPI && typeof window.dbAPI.savePeriodGroupEvents === 'function') {
                        await window.dbAPI.savePeriodGroupEvents(startDate, endDate, labelName, content, labelId);
                    }
                    if (callback) callback(true);
                };
            }
        }, 100);
    }
};

export const RecurringEventModule = {
    modalInstance: null,
    open: function(dateStr, labelName, content, callback, labelId) {
        if (!this.modalInstance) {
            this.modalInstance = new Modal({
                id: 'recurring-setting-modal',
                title: `🔄 [${labelName}] 반복 일정 설정`,
                width: '420px',
                content: `
                    <div style="display:flex; flex-direction:column; gap:12px;">
                        <div>
                            <label style="font-size:0.85rem; font-weight:bold; color:#475569;">반복 종료일</label>
                            <input type="date" id="recur-end-date" value="${dateStr}" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px; box-sizing:border-box;">
                        </div>
                        <div>
                            <label style="font-size:0.85rem; font-weight:bold; color:#475569;">반복 주기</label>
                            <select id="recur-type" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px; box-sizing:border-box;">
                                <option value="everyday">매일 반복</option>
                                <option value="weekly" selected>매주 같은 요일 반복</option>
                            </select>
                        </div>
                        <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:10px;">
                            <button id="btn-recur-cancel" style="padding:8px 14px; background:#f1f5f9; border:none; border-radius:6px; cursor:pointer; font-weight:bold;">취소</button>
                            <button id="btn-recur-confirm" style="padding:8px 14px; background:#2563eb; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold;">확인</button>
                        </div>
                    </div>
                `
            });
        }
        this.modalInstance.open();

        setTimeout(() => {
            const cancelBtn = document.getElementById('btn-recur-cancel');
            const confirmBtn = document.getElementById('btn-recur-confirm');

            if (cancelBtn) {
                cancelBtn.onclick = () => {
                    this.modalInstance.close();
                    if (callback) callback(false);
                };
            }
            if (confirmBtn) {
                confirmBtn.onclick = async () => {
                    const endDate = document.getElementById('recur-end-date').value;
                    const recurType = document.getElementById('recur-type').value;
                    if (!endDate) return alert("반복 종료일을 선택해주세요.");

                    this.modalInstance.close();
                    if (window.dbAPI && typeof window.dbAPI.saveRecurringGroupEvents === 'function') {
                        await window.dbAPI.saveRecurringGroupEvents(dateStr, endDate, recurType, labelName, content, labelId);
                    }
                    if (callback) callback(true);
                };
            }
        }, 100);
    }
};

// 🌉 전역 함수 바인딩 (어떤 뷰에서든 호출 가능하도록 보장)
window.PeriodModule = PeriodModule;
window.RecurringEventModule = RecurringEventModule;
window.openPeriodModal = (dateStr, labelName, content, callback, labelId) => PeriodModule.open(dateStr, labelName, content, callback, labelId);
window.openRecurringModal = (dateStr, labelName, content, callback, labelId) => RecurringEventModule.open(dateStr, labelName, content, callback, labelId);
