// js/modules/quickLinks.js

import { getUserCol } from '../firebase.js';
import { doc, getDoc, setDoc } from "firebase/firestore";

// 🌟 [추가됨] 자주 쓰는 문서/링크 기능 모듈 분리
export const QuickLinksManager = {
    currentLinks: [],

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
            html = `<span style="color:#94a3b8; font-size:0.95rem;">등록된 링크가 없습니다. 우측 버튼을 눌러 추가해보세요.</span>`;
        } else {
            links.forEach((link, index) => {
                html += `
                <div class="quick-link-item" style="position:relative; display:inline-flex; align-items:center; background:#eff6ff; border:1px solid #bfdbfe; border-radius:20px; padding:6px 14px; margin-right:8px; margin-bottom:8px; transition:0.2s; cursor:pointer; box-shadow:0 1px 2px rgba(0,0,0,0.05);"
                        onmouseenter="this.querySelector('.link-controls').style.display='flex';"
                        onmouseleave="this.querySelector('.link-controls').style.display='none';">
                    <a href="${link.url}" target="_blank" style="text-decoration:none; color:#1e40af; font-weight:700; font-size:1.05rem; display:flex; align-items:center; gap:6px;">🔗 ${link.name}</a>
                    <div class="link-controls" style="display:none; position:absolute; right:-10px; top:-10px; background:#fff; border:1px solid #cbd5e1; border-radius:12px; padding:2px 4px; box-shadow:0 2px 4px rgba(0,0,0,0.1); gap:4px; z-index:10;">
                        <button onclick="window.QuickLinksManager.openAddLinkModal(${index})" style="background:none; border:none; cursor:pointer; font-size:1rem; padding:2px;" title="수정">✏️</button>
                        <button onclick="window.QuickLinksManager.deleteLink(${index})" style="background:none; border:none; cursor:pointer; font-size:1rem; padding:2px;" title="삭제">❌</button>
                    </div>
                </div>`;
            });
        }
        container.innerHTML = html;
    },

    openAddLinkModal: function(editIndex = -1) {
        const isEdit = editIndex > -1;
        const links = this.currentLinks || [];
        const target = isEdit ? links[editIndex] : {name: '', url: ''};

        const modalHtml = `
        <div id="link-modal" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:10002; display:flex; justify-content:center; align-items:center;">
            <div style="background:#fff; padding:25px; border-radius:12px; width:320px; box-shadow:0 10px 25px rgba(0,0,0,0.2);">
                <h3 style="margin-top:0; color:#1e40af; border-bottom:2px solid #e2e8f0; padding-bottom:10px;">${isEdit ? '링크 수정' : '새 링크 추가'}</h3>
                <label style="display:block; font-weight:bold; margin-bottom:5px; color:#475569;">문서/사이트 이름</label>
                <input type="text" id="link-name" value="${target.name}" placeholder="예: 구글 시트 양식" style="width:100%; padding:10px; margin-bottom:15px; border:1px solid #cbd5e1; border-radius:6px; box-sizing:border-box; outline:none;">
                <label style="display:block; font-weight:bold; margin-bottom:5px; color:#475569;">웹 주소(URL)</label>
                <input type="text" id="link-url" value="${target.url}" placeholder="예: docs.google.com/..." style="width:100%; padding:10px; margin-bottom:20px; border:1px solid #cbd5e1; border-radius:6px; box-sizing:border-box; outline:none;">
                <div style="display:flex; justify-content:flex-end; gap:10px;">
                    <button onclick="document.getElementById('link-modal').remove()" style="padding:8px 16px; border:none; background:#f1f5f9; color:#475569; border-radius:6px; font-weight:bold; cursor:pointer;">취소</button>
                    <button onclick="window.QuickLinksManager.saveLinkFromModal(${editIndex})" style="padding:8px 16px; border:none; background:#2563eb; color:#fff; border-radius:6px; font-weight:bold; cursor:pointer;">저장</button>
                </div>
            </div>
        </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    },

    saveLinkFromModal: function(editIndex) {
        const name = document.getElementById('link-name').value.trim();
        let url = document.getElementById('link-url').value.trim();

        if (!name || !url) return alert("이름과 주소를 모두 입력해주세요.");
        if (!url.startsWith('http://') && !url.startsWith('https://')) url = 'https://' + url;

        const links = this.currentLinks || [];
        if (editIndex > -1) {
            links[editIndex] = { name, url };
        } else {
            links.push({ name, url });
        }
        
        this.saveLinks(links); 
        document.getElementById('link-modal').remove();
        this.renderLinks();
    },

    // (원본 코드에서 누락되어 있던 기능 추가)
    deleteLink: function(index) {
        if (!confirm("이 링크를 삭제하시겠습니까?")) return;
        const links = this.currentLinks || [];
        links.splice(index, 1);
        this.saveLinks(links);
        this.renderLinks();
    }
};

// HTML에서 접근 가능하도록 전역에 등록
window.QuickLinksManager = QuickLinksManager;