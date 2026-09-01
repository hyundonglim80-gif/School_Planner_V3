// js/components/FilterUI.js

import { store } from '../core/store.js';

export const FilterUI = {
    renderUnifiedFilter: function(myGroups) {
        if (!window.activeUnifiedFilters) {
            window.activeUnifiedFilters = ['personal', ...(myGroups || []).map(g => g.id)];
        }
        const container = document.getElementById('unified-filter-container');
        if (!container) return;

        const isPersonalActive = window.activeUnifiedFilters.includes('personal');
        let html = `
            <button onclick="window.FilterUI.toggleUnifiedFilter('personal')" style="padding:6px 14px; font-size:0.9rem; border-radius:8px; cursor:pointer; font-weight:bold; border:none; transition:0.2s; display:flex; align-items:center; gap:6px; white-space:nowrap; flex-shrink:0; ${isPersonalActive ? 'background:#3b82f6; color:#fff; box-shadow:0 2px 4px rgba(0,0,0,0.15);' : 'background:#f1f5f9; color:#64748b; border: 1px solid #cbd5e1;'}">
                ${isPersonalActive ? '🔒' : '🔓'} 개인
            </button>
        `;
        
        (myGroups || []).forEach(g => {
            const isActive = window.activeUnifiedFilters.includes(g.id);
            html += `
            <button onclick="window.FilterUI.toggleUnifiedFilter('${g.id}')" style="padding:6px 14px; font-size:0.9rem; border-radius:8px; cursor:pointer; font-weight:bold; border:none; transition:0.2s; display:flex; align-items:center; gap:6px; white-space:nowrap; flex-shrink:0; ${isActive ? 'background:#10b981; color:#fff; box-shadow:0 2px 4px rgba(0,0,0,0.15);' : 'background:#f1f5f9; color:#64748b; border: 1px solid #cbd5e1;'}">
                👥 ${g.name}
            </button>`;
        });

        container.innerHTML = html;
    },

    toggleUnifiedFilter: function(filterId) {
        if (store.mode === 'editor' && store.hasUnsavedChanges) {
            if(window.saveCurrentViewData) window.saveCurrentViewData(true);
        }

        if (window.activeUnifiedFilters.includes(filterId)) {
            if (window.activeUnifiedFilters.length > 1) { 
                window.activeUnifiedFilters = window.activeUnifiedFilters.filter(id => id !== filterId);
            } else {
                alert("최소 1개의 그룹(또는 개인)은 선택되어야 합니다.");
                return;
            }
        } else {
            window.activeUnifiedFilters.push(filterId);
        }
        
        if (window.currentMyGroups) {
            this.renderUnifiedFilter(window.currentMyGroups);
        }
        if(window.render) window.render();
    }
};

window.FilterUI = FilterUI;