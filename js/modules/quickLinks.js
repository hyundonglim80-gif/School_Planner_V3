<<<<<<< HEAD
// js/modules/quickLinks.js
import { getUserCol } from '../firebase.js';
import { doc, getDoc, setDoc } from "firebase/firestore";

export const QuickLinksManager = {
    currentLinks: [],
    settingsModal: null, 

    loadLinks: async function() {
        try {
            const docSnap = await getDoc(doc(getUserCol('settings'), 'user_links'));
            if (docSnap.exists()) return docSnap.data().links || [];
        } catch (e) { console.error("링크 불러오기 오류:", e); }
        return [];
    },

    saveLinks: async function(linksArray) {
        setDoc(doc(getUserCol('settings'), 'user_links'), { links: linksArray }).catch(e => console.warn(e)); 
    },

    renderLinks: async function() {
        const container = document.getElementById('quick-links-container');
        if (!container) return;
        const links = await this.loadLinks();
        this.currentLinks = links; 

        let html = '';
        if (links.length === 0) {
            html = `<span style="color:#94a3b8; font-size:0.95rem;">등록된 링크가 없습니다. [⚙️ 링크 설정]을 눌러 자주 쓰는 사이트나 문서를 등록하세요.</span>`;
        } else {
            links.forEach((link) => {
                html += `
                <div class="quick-link-item" style="position:relative; display:inline-flex; align-items:center; background:#eff6ff; border:1px solid #bfdbfe; border-radius:20px; padding:6px 14px; margin-right:8px; margin-bottom:8px; transition:0.2s; box-shadow:0 1px 2px rgba(0,0,0,0.05);" onmouseover="this.style.background='#dbeafe'" onmouseout="this.style.background='#eff6ff'">
                    <a href="${link.url}" target="_blank" style="text-decoration:none; color:#1e40af; font-weight:700; font-size:1.05rem; display:flex; align-items:center; gap:6px;">🔗 ${link.name}</a>
                </div>`;
            });
        }
        container.innerHTML = html;
    },

    openSettingsModal: function() {
        const html = `
            <div class="modal-info-box" style="background:#f8fafc; border-left-color:#cbd5e1; margin-bottom:15px; color:#475569;">
                <p style="margin:0; font-size:0.95rem;">
                    💡 <b>링크 설정</b><br>
                    메모 상단에 고정할 자주 쓰는 웹 주소나 구글 문서 링크를 관리합니다.<br>
                    순서를 바꾸려면 우측 화살표를 누르고, 완료 후 아래 <b>[저장 및 적용]</b> 버튼을 꼭 눌러주세요.
                </p>
            </div>
            <div id="quick-links-settings-list" style="display:flex; flex-direction:column; gap:8px; max-height:300px; overflow-y:auto; margin-bottom:15px; padding-right:5px;"></div>
            
            <div style="background:#eff6ff; padding:12px; border-radius:8px; border:1px dashed #bfdbfe; margin-bottom:20px;">
                <div style="font-weight:bold; color:#1e40af; margin-bottom:8px; font-size:0.9rem;">➕ 새 링크 추가하기</div>
                <div style="display:flex; flex-direction:column; gap:8px;">
                    <input type="text" id="new-link-name" placeholder="이름 (예: 주간업무일지)" style="width:100%; padding:8px; border:1px solid #93c5fd; border-radius:4px; outline:none; box-sizing:border-box;">
                    <input type="text" id="new-link-url" placeholder="주소 (예: https://docs.google.com/...)" style="width:100%; padding:8px; border:1px solid #93c5fd; border-radius:4px; outline:none; box-sizing:border-box;" onkeydown="if(event.key==='Enter') window.QuickLinksManager.addLinkFromSettings()">
                    <button onclick="window.QuickLinksManager.addLinkFromSettings()" style="background:#2563eb; color:#fff; border:none; padding:8px; border-radius:4px; font-weight:bold; cursor:pointer;">추가</button>
                </div>
            </div>

            <div class="modal-footer-actions">
                <button onclick="window.QuickLinksManager.saveSettingsAndClose()" class="modal-btn-primary" style="width:100%; padding:12px; border-radius:6px; font-weight:bold;">💾 저장 및 적용</button>
            </div>
        `;

        // 🌟 수정: DOM 요소를 먼저 찾아서 안전하게 지우고, 모달 인스턴스 전용 닫기 함수(.close) 호출
        const existingElement = document.getElementById('quick-links-settings-modal');
        if (existingElement) existingElement.remove();
        
        if (this.settingsModal && typeof this.settingsModal.close === 'function') {
            this.settingsModal.close();
        }

        this.settingsModal = new window.Modal({
            id: 'quick-links-settings-modal',
            title: '🔗 통합 링크 설정',
            width: '500px',
            content: html
        });

        this.settingsModal.open();
        
        window.tempEditingLinks = [...this.currentLinks];
        this.renderSettingsList();
    },

    renderSettingsList: function() {
        const container = document.getElementById('quick-links-settings-list');
        if (!container) return;

        if (window.tempEditingLinks.length === 0) {
            container.innerHTML = `<div style="text-align:center; padding:20px; color:#94a3b8;">등록된 링크가 없습니다. 아래에서 추가해주세요.</div>`;
            return;
        }

        container.innerHTML = window.tempEditingLinks.map((link, idx) => `
            <div style="display:flex; flex-direction:column; background:#fff; border:1px solid #e2e8f0; border-radius:6px; padding:10px; gap:6px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-weight:bold; font-size:0.9rem; color:#475569;"># ${idx + 1}</span>
                    <div style="display:flex; gap:4px;">
                        <button onclick="window.QuickLinksManager.moveLink(${idx}, -1)" ${idx === 0 ? 'disabled style="opacity:0.3"' : ''} style="background:none; border:none; cursor:pointer; font-size:1.1rem; padding:0;" title="위로 올리기">🔼</button>
                        <button onclick="window.QuickLinksManager.moveLink(${idx}, 1)" ${idx === window.tempEditingLinks.length - 1 ? 'disabled style="opacity:0.3"' : ''} style="background:none; border:none; cursor:pointer; font-size:1.1rem; padding:0;" title="아래로 내리기">🔽</button>
                        <button onclick="window.QuickLinksManager.deleteLinkFromSettings(${idx})" style="background:none; border:none; cursor:pointer; font-size:1.1rem; padding:0; margin-left:8px; color:#ef4444;" title="삭제">✖</button>
                    </div>
                </div>
                <div style="display:flex; gap:8px;">
                    <input type="text" value="${link.name}" placeholder="이름" onchange="window.tempEditingLinks[${idx}].name = this.value.trim()" style="flex:1; padding:6px; border:1px solid #cbd5e1; border-radius:4px; outline:none;">
                    <input type="text" value="${link.url}" placeholder="URL" onchange="window.tempEditingLinks[${idx}].url = this.value.trim()" style="flex:2; padding:6px; border:1px solid #cbd5e1; border-radius:4px; outline:none;">
                </div>
            </div>
        `).join('');
    },

    moveLink: function(idx, dir) {
        if (idx + dir < 0 || idx + dir >= window.tempEditingLinks.length) return;
        const temp = window.tempEditingLinks[idx];
        window.tempEditingLinks[idx] = window.tempEditingLinks[idx + dir];
        window.tempEditingLinks[idx + dir] = temp;
        this.renderSettingsList();
    },

    deleteLinkFromSettings: function(idx) {
        window.tempEditingLinks.splice(idx, 1);
        this.renderSettingsList();
    },

    addLinkFromSettings: function() {
        const nameInput = document.getElementById('new-link-name');
        const urlInput = document.getElementById('new-link-url');
        const name = nameInput.value.trim();
        let url = urlInput.value.trim();

        if (!name || !url) return alert("이름과 주소를 모두 입력해주세요.");
        if (!url.startsWith('http://') && !url.startsWith('https://')) url = 'https://' + url;

        window.tempEditingLinks.push({ name, url });
        nameInput.value = '';
        urlInput.value = '';
        this.renderSettingsList();
        
        setTimeout(() => {
            const listContainer = document.getElementById('quick-links-settings-list');
            if(listContainer) listContainer.scrollTop = listContainer.scrollHeight;
        }, 50);
    },

    saveSettingsAndClose: async function() {
        for (let i = 0; i < window.tempEditingLinks.length; i++) {
            if (!window.tempEditingLinks[i].name || !window.tempEditingLinks[i].url) {
                return alert(`${i + 1}번째 링크의 이름이나 주소가 비어있습니다.`);
            }
        }
        
        this.currentLinks = [...window.tempEditingLinks];
        await this.saveLinks(this.currentLinks);
        
        // 🌟 수정: 모달을 안전하게 닫도록 처리
        if (this.settingsModal && typeof this.settingsModal.close === 'function') {
            this.settingsModal.close();
        } else {
            const existingElement = document.getElementById('quick-links-settings-modal');
            if (existingElement) existingElement.remove();
        }

        this.renderLinks();
    }
};

=======
// js/modules/quickLinks.js
import { getUserCol } from '../firebase.js';
import { doc, getDoc, setDoc } from "firebase/firestore";

export const QuickLinksManager = {
    currentLinks: [],
    settingsModal: null, 

    loadLinks: async function() {
        try {
            const docSnap = await getDoc(doc(getUserCol('settings'), 'user_links'));
            if (docSnap.exists()) return docSnap.data().links || [];
        } catch (e) { console.error("링크 불러오기 오류:", e); }
        return [];
    },

    saveLinks: async function(linksArray) {
        setDoc(doc(getUserCol('settings'), 'user_links'), { links: linksArray }).catch(e => console.warn(e)); 
    },

    renderLinks: async function() {
        const container = document.getElementById('quick-links-container');
        if (!container) return;
        const links = await this.loadLinks();
        this.currentLinks = links; 

        let html = '';
        if (links.length === 0) {
            html = `<span style="color:#94a3b8; font-size:0.95rem;">등록된 링크가 없습니다. [⚙️ 링크 설정]을 눌러 자주 쓰는 사이트나 문서를 등록하세요.</span>`;
        } else {
            links.forEach((link) => {
                html += `
                <div class="quick-link-item" style="position:relative; display:inline-flex; align-items:center; background:#eff6ff; border:1px solid #bfdbfe; border-radius:20px; padding:6px 14px; margin-right:8px; margin-bottom:8px; transition:0.2s; box-shadow:0 1px 2px rgba(0,0,0,0.05);" onmouseover="this.style.background='#dbeafe'" onmouseout="this.style.background='#eff6ff'">
                    <a href="${link.url}" target="_blank" style="text-decoration:none; color:#1e40af; font-weight:700; font-size:1.05rem; display:flex; align-items:center; gap:6px;">🔗 ${link.name}</a>
                </div>`;
            });
        }
        container.innerHTML = html;
    },

    openSettingsModal: function() {
        const html = `
            <div class="modal-info-box" style="background:#f8fafc; border-left-color:#cbd5e1; margin-bottom:15px; color:#475569;">
                <p style="margin:0; font-size:0.95rem;">
                    💡 <b>링크 설정</b><br>
                    메모 상단에 고정할 자주 쓰는 웹 주소나 구글 문서 링크를 관리합니다.<br>
                    순서를 바꾸려면 우측 화살표를 누르고, 완료 후 아래 <b>[저장 및 적용]</b> 버튼을 꼭 눌러주세요.
                </p>
            </div>
            <div id="quick-links-settings-list" style="display:flex; flex-direction:column; gap:8px; max-height:300px; overflow-y:auto; margin-bottom:15px; padding-right:5px;"></div>
            
            <div style="background:#eff6ff; padding:12px; border-radius:8px; border:1px dashed #bfdbfe; margin-bottom:20px;">
                <div style="font-weight:bold; color:#1e40af; margin-bottom:8px; font-size:0.9rem;">➕ 새 링크 추가하기</div>
                <div style="display:flex; flex-direction:column; gap:8px;">
                    <input type="text" id="new-link-name" placeholder="이름 (예: 주간업무일지)" style="width:100%; padding:8px; border:1px solid #93c5fd; border-radius:4px; outline:none; box-sizing:border-box;">
                    <input type="text" id="new-link-url" placeholder="주소 (예: https://docs.google.com/...)" style="width:100%; padding:8px; border:1px solid #93c5fd; border-radius:4px; outline:none; box-sizing:border-box;" onkeydown="if(event.key==='Enter') window.QuickLinksManager.addLinkFromSettings()">
                    <button onclick="window.QuickLinksManager.addLinkFromSettings()" style="background:#2563eb; color:#fff; border:none; padding:8px; border-radius:4px; font-weight:bold; cursor:pointer;">추가</button>
                </div>
            </div>

            <div class="modal-footer-actions">
                <button onclick="window.QuickLinksManager.saveSettingsAndClose()" class="modal-btn-primary" style="width:100%; padding:12px; border-radius:6px; font-weight:bold;">💾 저장 및 적용</button>
            </div>
        `;

        // 🌟 수정: DOM 요소를 먼저 찾아서 안전하게 지우고, 모달 인스턴스 전용 닫기 함수(.close) 호출
        const existingElement = document.getElementById('quick-links-settings-modal');
        if (existingElement) existingElement.remove();
        
        if (this.settingsModal && typeof this.settingsModal.close === 'function') {
            this.settingsModal.close();
        }

        this.settingsModal = new window.Modal({
            id: 'quick-links-settings-modal',
            title: '🔗 통합 링크 설정',
            width: '500px',
            content: html
        });

        this.settingsModal.open();
        
        window.tempEditingLinks = [...this.currentLinks];
        this.renderSettingsList();
    },

    renderSettingsList: function() {
        const container = document.getElementById('quick-links-settings-list');
        if (!container) return;

        if (window.tempEditingLinks.length === 0) {
            container.innerHTML = `<div style="text-align:center; padding:20px; color:#94a3b8;">등록된 링크가 없습니다. 아래에서 추가해주세요.</div>`;
            return;
        }

        container.innerHTML = window.tempEditingLinks.map((link, idx) => `
            <div style="display:flex; flex-direction:column; background:#fff; border:1px solid #e2e8f0; border-radius:6px; padding:10px; gap:6px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-weight:bold; font-size:0.9rem; color:#475569;"># ${idx + 1}</span>
                    <div style="display:flex; gap:4px;">
                        <button onclick="window.QuickLinksManager.moveLink(${idx}, -1)" ${idx === 0 ? 'disabled style="opacity:0.3"' : ''} style="background:none; border:none; cursor:pointer; font-size:1.1rem; padding:0;" title="위로 올리기">🔼</button>
                        <button onclick="window.QuickLinksManager.moveLink(${idx}, 1)" ${idx === window.tempEditingLinks.length - 1 ? 'disabled style="opacity:0.3"' : ''} style="background:none; border:none; cursor:pointer; font-size:1.1rem; padding:0;" title="아래로 내리기">🔽</button>
                        <button onclick="window.QuickLinksManager.deleteLinkFromSettings(${idx})" style="background:none; border:none; cursor:pointer; font-size:1.1rem; padding:0; margin-left:8px; color:#ef4444;" title="삭제">✖</button>
                    </div>
                </div>
                <div style="display:flex; gap:8px;">
                    <input type="text" value="${link.name}" placeholder="이름" onchange="window.tempEditingLinks[${idx}].name = this.value.trim()" style="flex:1; padding:6px; border:1px solid #cbd5e1; border-radius:4px; outline:none;">
                    <input type="text" value="${link.url}" placeholder="URL" onchange="window.tempEditingLinks[${idx}].url = this.value.trim()" style="flex:2; padding:6px; border:1px solid #cbd5e1; border-radius:4px; outline:none;">
                </div>
            </div>
        `).join('');
    },

    moveLink: function(idx, dir) {
        if (idx + dir < 0 || idx + dir >= window.tempEditingLinks.length) return;
        const temp = window.tempEditingLinks[idx];
        window.tempEditingLinks[idx] = window.tempEditingLinks[idx + dir];
        window.tempEditingLinks[idx + dir] = temp;
        this.renderSettingsList();
    },

    deleteLinkFromSettings: function(idx) {
        window.tempEditingLinks.splice(idx, 1);
        this.renderSettingsList();
    },

    addLinkFromSettings: function() {
        const nameInput = document.getElementById('new-link-name');
        const urlInput = document.getElementById('new-link-url');
        const name = nameInput.value.trim();
        let url = urlInput.value.trim();

        if (!name || !url) return alert("이름과 주소를 모두 입력해주세요.");
        if (!url.startsWith('http://') && !url.startsWith('https://')) url = 'https://' + url;

        window.tempEditingLinks.push({ name, url });
        nameInput.value = '';
        urlInput.value = '';
        this.renderSettingsList();
        
        setTimeout(() => {
            const listContainer = document.getElementById('quick-links-settings-list');
            if(listContainer) listContainer.scrollTop = listContainer.scrollHeight;
        }, 50);
    },

    saveSettingsAndClose: async function() {
        for (let i = 0; i < window.tempEditingLinks.length; i++) {
            if (!window.tempEditingLinks[i].name || !window.tempEditingLinks[i].url) {
                return alert(`${i + 1}번째 링크의 이름이나 주소가 비어있습니다.`);
            }
        }
        
        this.currentLinks = [...window.tempEditingLinks];
        await this.saveLinks(this.currentLinks);
        
        // 🌟 수정: 모달을 안전하게 닫도록 처리
        if (this.settingsModal && typeof this.settingsModal.close === 'function') {
            this.settingsModal.close();
        } else {
            const existingElement = document.getElementById('quick-links-settings-modal');
            if (existingElement) existingElement.remove();
        }

        this.renderLinks();
    }
};

>>>>>>> d1348ae5447b87f69a849130f4f6a30f4c5cc4fe
window.QuickLinksManager = QuickLinksManager;