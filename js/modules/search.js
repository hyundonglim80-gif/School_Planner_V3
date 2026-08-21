// js/modules/search.js
import { getUserCol } from '../firebase.js';
import { getDocs } from "firebase/firestore";

export const openSearchModal = () => {
    const modalHtml = `
    <div id="search-modal" class="modal-overlay" style="display:flex; z-index:10005;">
        <div class="modal-content" style="width:500px; max-height:80vh; display:flex; flex-direction:column;">
            <div class="modal-header" style="display:flex; justify-content:space-between; margin-bottom:15px; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">
                <h2 style="margin:0; font-size:1.3rem; color:#1e40af;">🔍 통합 검색</h2>
                <button onclick="document.getElementById('search-modal').remove()" style="background:none;border:none;font-size:1.5rem;cursor:pointer;color:#64748b;">&times;</button>
            </div>
            <div style="display:flex; gap:10px; margin-bottom:15px;">
                <input type="text" id="search-keyword" placeholder="검색어를 입력하세요 (빈 칸 검색 시 전체 조회)" style="flex:1; padding:10px; border:1px solid #cbd5e1; border-radius:6px; outline:none; font-size:1rem;" onkeydown="if(event.key==='Enter') window.executeSearch()">
                <button onclick="window.executeSearch()" style="padding:10px 20px; background:#2563eb; color:#fff; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">검색</button>
            </div>
            <div id="search-results" style="flex:1; overflow-y:auto; display:flex; flex-direction:column; gap:10px;">
                <div style="text-align:center; color:#94a3b8; padding:20px;">검색어를 입력 후 검색 버튼을 누르세요.</div>
            </div>
        </div>
    </div>`;
    
    const oldModal = document.getElementById('search-modal');
    if (oldModal) oldModal.remove();
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    setTimeout(() => document.getElementById('search-keyword')?.focus(), 100);
};

export const executeSearch = async () => {
    const keywordInput = document.getElementById('search-keyword').value.trim();
    const keyword = keywordInput.toLowerCase();
    const resultsContainer = document.getElementById('search-results');
    
    resultsContainer.innerHTML = '<div style="text-align:center; padding:20px; font-weight:bold; color:#2563eb;">⏳ 클라우드에서 검색 중...</div>';

    try {
        const [eventsSnap, journalsSnap, memosSnap] = await Promise.all([
            getDocs(getUserCol('events')),
            getDocs(getUserCol('journals')),
            getDocs(getUserCol('tasks')) 
        ]);

        let results = [];

        // 🌟 [핵심 변경] 검색어가 없거나 '*' 이면 모든 데이터를 통과시킴
        const isMatch = (text) => {
            if (keyword === '' || keyword === '*') return true;
            return text && text.toLowerCase().includes(keyword);
        };

        // 1. 일정(Events) 검색
        eventsSnap.forEach(doc => {
            const data = doc.data();
            const list = data.eventList || [];
            list.forEach(item => {
                const hasKeyword = isMatch(item.content) || 
                                   isMatch(item.label) || 
                                   (item.labels && item.labels.some(l => isMatch(l)));
                if (hasKeyword && item.content) {
                    results.push({ type: '📅 일정', date: doc.id, content: item.content });
                }
            });
        });

        // 2. 기록(Journals) 검색
        journalsSnap.forEach(doc => {
            const data = doc.data();
            const entries = data.entries || [];
            entries.forEach(item => {
                if (isMatch(item.content) && item.content) {
                    results.push({ type: '📔 기록', date: doc.id, content: item.content });
                }
            });
        });
        
        // 3. 메모(Memos) 검색
        memosSnap.forEach(doc => {
            const data = doc.data();
            if (isMatch(data.text) && data.text) {
                const dateStr = data.createdAt ? new Date(data.createdAt).toISOString().split('T')[0] : '기록없음';
                results.push({ type: '📝 메모', date: dateStr, content: data.text });
            }
        });

        results.sort((a, b) => b.date.localeCompare(a.date)); 

        if (results.length === 0) {
            resultsContainer.innerHTML = '<div style="text-align:center; color:#94a3b8; padding:20px;">검색 결과가 없습니다.</div>';
            return;
        }

        resultsContainer.innerHTML = results.map(r => `
            <div style="padding:12px; border:1px solid #cbd5e1; border-radius:8px; background:#f8fafc; cursor:pointer; transition:0.2s;" onmouseover="this.style.backgroundColor='#eff6ff'" onmouseout="this.style.backgroundColor='#f8fafc'" onclick="document.getElementById('search-modal').remove(); window.goToDay('${r.date}')">
                <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
                    <span style="font-weight:bold; color:#1e40af; font-size:0.9rem;">${r.type}</span>
                    <span style="font-size:0.85rem; color:#64748b;">${r.date}</span>
                </div>
                <div style="color:#1e293b; white-space:pre-wrap; font-size:0.95rem; line-height:1.4;">${r.content}</div>
            </div>
        `).join('');

    } catch (error) {
        console.error("검색 오류:", error);
        resultsContainer.innerHTML = '<div style="text-align:center; color:#ef4444; padding:20px;">검색 중 오류가 발생했습니다.</div>';
    }
};

Object.assign(window, { openSearchModal, executeSearch });
