// js/modules/trashManager.js

export const TrashManager = {
    getTrash: function() {
        const data = localStorage.getItem('sp3_trash');
        return data ? JSON.parse(data) : [];
    },

    saveTrash: function(trashList) {
        localStorage.setItem('sp3_trash', JSON.stringify(trashList));
    },

    moveToTrash: function(type, fId, dateStr, item) {
        const trash = this.getTrash();
        trash.push({
            id: Date.now().toString() + Math.floor(Math.random()*1000),
            deletedAt: new Date().getTime(),
            type: type, // 'event', 'journal', 'memo'
            fId: fId,
            dateStr: dateStr,
            data: item
        });
        this.saveTrash(trash);
        this.updateTrashBadge();
    },

    restoreItem: function(trashId) {
        const trash = this.getTrash();
        const index = trash.findIndex(t => t.id === trashId);
        if (index === -1) return;

        const item = trash[index];

        if (item.type === 'event' || item.type === 'journal') {
            if (window.dayViewInstance && window.dayViewInstance.lockedDateStr === item.dateStr) {
                const dayData = window.dayViewInstance.dayData;
                if (!dayData[item.fId]) {
                    dayData[item.fId] = { events: [], journals: [], schedules: {} };
                }
                if (item.type === 'event') {
                    dayData[item.fId].events.push(item.data);
                    window.dayViewInstance.renderEventEntries(item.fId);
                } else {
                    dayData[item.fId].journals.push(item.data);
                    window.dayViewInstance.renderJournalEntries(item.fId);
                }
                window.store.hasUnsavedChanges = true;
            } else {
                alert("해당 항목이 삭제된 날짜로 이동하여 복원해주세요: " + item.dateStr);
                return;
            }
        } else if (item.type === 'memo') {
            if (window.memoViewInstance) {
                window.memoViewInstance.memoItems.unshift(item.data);
                window.memoViewInstance.render();
                if (window.dbAPI && window.dbAPI.addMemo) {
                    window.dbAPI.addMemo(item.data, item.data.groupId).catch(e=>console.warn(e));
                }
            } else {
                alert("메모 탭으로 이동하여 복원해주세요.");
                return;
            }
        }

        trash.splice(index, 1);
        this.saveTrash(trash);
        this.openTrashModal(); // Refresh modal
        this.updateTrashBadge();
        
        if (window.showToast) window.showToast('✅ 항목이 복원되었습니다. (저장 버튼을 눌러야 최종 반영됩니다)');
    },

    deleteForever: function(trashId) {
        const trash = this.getTrash();
        const index = trash.findIndex(t => t.id === trashId);
        if (index !== -1) {
            trash.splice(index, 1);
            this.saveTrash(trash);
            this.openTrashModal();
            this.updateTrashBadge();
        }
    },

    emptyTrash: function() {
        if(confirm("휴지통을 비우시겠습니까? (영구 삭제됨)")) {
            this.saveTrash([]);
            this.openTrashModal();
            this.updateTrashBadge();
        }
    },

    openTrashModal: function() {
        if (this.modal) {
            this.modal.close();
        }
        
        const trash = this.getTrash();
        
        let html = `
            <div style="max-height:400px; overflow-y:auto; padding:10px;">
                <div style="display:flex; justify-content:flex-end; margin-bottom:10px;">
                    <button onclick="window.TrashManager.emptyTrash()" style="background:#ef4444; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; font-weight:bold;">휴지통 비우기</button>
                </div>
        `;

        if (trash.length === 0) {
            html += `<div style="text-align:center; padding:20px; color:#64748b;">휴지통이 비어있습니다.</div>`;
        } else {
            // 역순 정렬 (최근 삭제된 것이 위로)
            trash.sort((a,b) => b.deletedAt - a.deletedAt).forEach(t => {
                let title = '';
                let typeStr = '';
                if (t.type === 'event') {
                    typeStr = '📌 일정';
                    title = t.data.content;
                } else if (t.type === 'journal') {
                    typeStr = '📔 기록';
                    title = t.data.content;
                } else if (t.type === 'memo') {
                    typeStr = '📝 메모';
                    title = t.data.text;
                }
                
                const dateString = new Date(t.deletedAt).toLocaleString();
                
                html += `
                    <div style="border:1px solid #cbd5e1; border-radius:6px; padding:10px; margin-bottom:10px; background:#f8fafc; display:flex; justify-content:space-between; align-items:center;">
                        <div style="flex:1; overflow:hidden;">
                            <div style="font-size:0.8rem; color:#64748b; font-weight:bold; margin-bottom:4px;">${typeStr} | 삭제일: ${dateString} | 소속: ${t.fId}</div>
                            <div style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-weight:bold;">${title || '(내용 없음)'}</div>
                        </div>
                        <div style="display:flex; gap:6px; margin-left:10px;">
                            <button onclick="window.TrashManager.restoreItem('${t.id}')" style="background:#10b981; color:white; border:none; padding:6px 10px; border-radius:4px; cursor:pointer; font-weight:bold; font-size:0.85rem; flex-shrink:0;">복원</button>
                            <button onclick="window.TrashManager.deleteForever('${t.id}')" style="background:#cbd5e1; color:#334155; border:none; padding:6px 10px; border-radius:4px; cursor:pointer; font-weight:bold; font-size:0.85rem; flex-shrink:0;">완전삭제</button>
                        </div>
                    </div>
                `;
            });
        }
        
        html += `</div>`;
        html += `
            <div style="text-align:center; margin-top:15px; border-top:1px solid #e2e8f0; padding-top:15px;">
                <button onclick="window.TrashManager.closeModal()" style="background:#64748b; color:white; padding:8px 24px; border:none; border-radius:6px; cursor:pointer; font-weight:bold;">닫기</button>
            </div>
        `;

        this.modal = new window.Modal({
            id: 'trash-modal',
            title: '🗑️ 휴지통',
            width: '500px',
            content: html
        });
        this.modal.open();
    },

    closeModal: function() {
        if (this.modal) {
            this.modal.close();
            this.modal = null;
        }
    },

    updateTrashBadge: function() {
        const trashBtn = document.getElementById('trash-btn-count');
        if (trashBtn) {
            const trash = this.getTrash();
            trashBtn.innerText = trash.length;
        }
    }
};

window.TrashManager = TrashManager;
setTimeout(() => {
    if (window.TrashManager) window.TrashManager.updateTrashBadge();
}, 500);
