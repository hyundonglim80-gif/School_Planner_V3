// js/modules/linker.js
import { dbAPI } from '../api/database.js';
import { store } from '../core/store.js';

export const LinkManager = {
    modal: null,
    sourceData: null, // { type, dateStr, id, fId }
    memoItems: [],
    journalItems: [],

    openModal: async function(sourceType, dateStr, sourceId, fId) {
        this.sourceData = { type: sourceType, dateStr, id: sourceId, fId };
        
        // 메모 및 당일 기록 데이터 로드
        try {
            this.memoItems = await dbAPI.loadMemos() || [];
            const jList = await dbAPI.loadJournals(dateStr, fId === 'personal' ? null : fId) || [];
            this.journalItems = jList.entries || [];
        } catch (e) {
            console.warn("데이터 로드 실패", e);
        }

        const existingModal = document.getElementById('linker-modal');
        if (existingModal) existingModal.remove();

        this.modal = new window.Modal({
            id: 'linker-modal',
            title: '🔗 관련 기록/메모 연결',
            width: '500px',
            content: this.getModalHtml()
        });
        
        this.modal.open();
        this.renderList();
    },

    getModalHtml: function() {
        const periodOptions = ['적용 안 함 (하루 전체)', '1교시', '2교시', '3교시', '4교시', '5교시', '6교시']
            .map((p, i) => `<option value="${i === 0 ? '' : i}">${p}</option>`).join('');

        return `
            <div style="display:flex; flex-direction:column; gap:15px; max-height:60vh; padding-right:5px;">
                <div style="background:#f8fafc; padding:12px; border-radius:8px; border:1px solid #cbd5e1;">
                    <label style="font-weight:bold; font-size:0.95rem; display:block; margin-bottom:6px; color:#1e40af;">📌 연결될 교시 선택</label>
                    <select id="linker-period" class="eval-input" style="width:100%; padding:8px;">${periodOptions}</select>
                </div>

                <div style="display:flex; gap:10px;">
                    <button class="modal-btn-secondary" onclick="window.LinkManager.switchTab('journal')" id="tab-journal" style="flex:1; background:#fdf2f8; color:#be185d; border-color:#fbcfe8;">당일 기록</button>
                    <button class="modal-btn-secondary" onclick="window.LinkManager.switchTab('memo')" id="tab-memo" style="flex:1; background:#f1f5f9; color:#475569; border-color:#cbd5e1;">전체 메모</button>
                </div>

                <div>
                    <input type="text" id="linker-search" placeholder="키워드 검색..." onkeyup="window.LinkManager.renderList()" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:6px; outline:none; box-sizing:border-box;">
                </div>

                <div id="linker-list-container" style="display:flex; flex-direction:column; gap:8px; overflow-y:auto; flex:1; min-height:200px; border:1px solid #e2e8f0; padding:10px; border-radius:6px; background:#f8fafc;">
                    <!-- 리스트 렌더링 영역 -->
                </div>
            </div>
            <div class="modal-footer-actions">
                <button onclick="document.getElementById('linker-modal').remove()" class="modal-btn-secondary">취소</button>
                <button onclick="window.LinkManager.saveLinks()" class="modal-btn-primary">연결 완료</button>
            </div>
        `;
    },

    currentTab: 'journal',

    switchTab: function(tab) {
        this.currentTab = tab;
        const jTab = document.getElementById('tab-journal');
        const mTab = document.getElementById('tab-memo');
        
        if (tab === 'journal') {
            jTab.style.background = '#fdf2f8'; jTab.style.color = '#be185d'; jTab.style.borderColor = '#fbcfe8';
            mTab.style.background = '#f1f5f9'; mTab.style.color = '#475569'; mTab.style.borderColor = '#cbd5e1';
        } else {
            mTab.style.background = '#eff6ff'; mTab.style.color = '#1e40af'; mTab.style.borderColor = '#bfdbfe';
            jTab.style.background = '#f1f5f9'; jTab.style.color = '#475569'; jTab.style.borderColor = '#cbd5e1';
        }
        this.renderList();
    },

    renderList: function() {
        const keyword = document.getElementById('linker-search').value.toLowerCase();
        const container = document.getElementById('linker-list-container');
        let items = this.currentTab === 'journal' ? this.journalItems : this.memoItems;
        
        if (keyword) {
            items = items.filter(item => (item.content || item.text || '').toLowerCase().includes(keyword));
        }

        if (items.length === 0) {
            container.innerHTML = `<div style="text-align:center; color:#94a3b8; padding:20px 0;">해당 항목이 없습니다.</div>`;
            return;
        }

        container.innerHTML = items.map(item => {
            const id = item.id || item.firestoreId;
            const text = item.content || item.text || '';
            return `
                <label style="display:flex; align-items:flex-start; gap:10px; padding:10px; background:#fff; border:1px solid #cbd5e1; border-radius:6px; cursor:pointer;">
                    <input type="checkbox" class="linker-checkbox" value="${id}" data-type="${this.currentTab}" style="margin-top:4px; width:16px; height:16px; accent-color:#2563eb;">
                    <span style="font-size:0.95rem; color:#334155; line-height:1.4;">${text}</span>
                </label>
            `;
        }).join('');
    },

    saveLinks: function() {
        const selectedPeriod = document.getElementById('linker-period').value;
        const checkboxes = document.querySelectorAll('.linker-checkbox:checked');
        const selectedLinks = Array.from(checkboxes).map(cb => ({
            targetType: cb.getAttribute('data-type'),
            targetId: cb.value,
            targetPeriod: selectedPeriod
        }));

        if (selectedLinks.length === 0) return alert("연결할 항목을 선택해주세요.");

        // 현재 작성중인 데이터 캐시에 링크 주입 (임시 윈도우 객체 활용)
        const evList = window[`tempEvents_${this.sourceData.dateStr}`] || [];
        const ev = evList.find(e => e.id === this.sourceData.id);
        
        if (ev) {
            ev.linkedItems = ev.linkedItems || [];
            // 중복 방지 병합
            selectedLinks.forEach(link => {
                if (!ev.linkedItems.some(l => l.targetId === link.targetId)) {
                    ev.linkedItems.push(link);
                }
            });
            window.store.hasUnsavedChanges = true;
            
            // UI 즉시 반영
            if (window.CompactEventHelper) {
                window.CompactEventHelper.syncCompactEventInputs(this.sourceData.dateStr);
                const container = document.getElementById(`compact-events-${this.sourceData.dateStr}-${this.sourceData.fId}`);
                if (container) container.innerHTML = window.CompactEventHelper.generateCompactEventEditor(this.sourceData.dateStr, this.sourceData.fId);
            }
        }

        if (window.showToast) window.showToast('✅ 항목이 연결되었습니다. 저장을 눌러 반영하세요.');
        document.getElementById('linker-modal').remove();
    }
};

window.LinkManager = LinkManager;