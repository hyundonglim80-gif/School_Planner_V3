// js/modules/trashManager.js
//
// 휴지통은 V4와 같은 곳(Firestore users/{uid}/trash)을 쓴다.
// 예전에는 브라우저 localStorage('sp3_trash')에만 담아서, 같은 계정이라도
// 다른 기기나 V4에서는 지운 항목이 보이지 않았다.
//
// 문서 모양은 V4와 맞춘다.
//   { id, deletedAt, type, fId, originalDateStr, dateStr, content, data }
// originalDateStr는 V4가 읽는 이름, dateStr는 V3가 읽던 이름이다. 둘 다 쓴다.

import { collection, doc, setDoc, deleteDoc, getDocs, query, orderBy } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from '../api/firebaseInit.js';

const LEGACY_KEY = 'sp3_trash';

export const TrashManager = {
    items: [],
    migrated: false,

    trashCol: function() {
        const user = auth.currentUser;
        if (!user) return null;
        return collection(db, 'users', user.uid, 'trash');
    },

    // V3/V4가 같이 읽을 수 있는 모양으로 맞춘다.
    normalize: function(t) {
        const dateStr = t.originalDateStr || t.dateStr || '';
        const data = t.data || {};
        return {
            id: String(t.id),
            deletedAt: t.deletedAt || Date.now(),
            type: t.type || 'event',
            fId: t.fId || 'personal',
            originalDateStr: dateStr,
            dateStr: dateStr,
            content: t.content || data.content || data.text || '',
            data: data
        };
    },

    // 브라우저에만 있던 옛 휴지통을 클라우드로 한 번 옮긴다.
    migrateLegacy: async function() {
        if (this.migrated) return;
        const raw = localStorage.getItem(LEGACY_KEY);
        if (!raw) { this.migrated = true; return; }

        let legacy = [];
        try { legacy = JSON.parse(raw) || []; } catch (e) { legacy = []; }
        const col = this.trashCol();
        if (!col) return; // 로그인 전이면 다음에 다시 시도한다

        if (!Array.isArray(legacy) || legacy.length === 0) {
            localStorage.removeItem(LEGACY_KEY);
            this.migrated = true;
            return;
        }

        let allOk = true;
        for (const t of legacy) {
            try {
                const item = this.normalize(t);
                await setDoc(doc(col, item.id), item);
            } catch (e) {
                console.warn('휴지통 이전 실패:', e);
                allOk = false;
            }
        }
        // 하나라도 실패하면 원본을 남겨 다음 기회에 다시 시도한다
        if (allOk) localStorage.removeItem(LEGACY_KEY);
        this.migrated = true;
    },

    load: async function() {
        const col = this.trashCol();
        if (!col) { this.items = []; return this.items; }
        try {
            await this.migrateLegacy();
            const snap = await getDocs(query(col, orderBy('deletedAt', 'desc')));
            const list = [];
            snap.forEach(d => list.push(this.normalize({ ...d.data(), id: d.id })));
            this.items = list;
        } catch (e) {
            console.warn('휴지통 불러오기 실패:', e);
            this.items = [];
        }
        return this.items;
    },

    moveToTrash: async function(type, fId, dateStr, item) {
        const col = this.trashCol();
        if (!col) return;
        const trashId = Date.now().toString() + Math.floor(Math.random() * 1000);
        const entry = this.normalize({ id: trashId, deletedAt: Date.now(), type, fId, dateStr, data: item });
        try {
            await setDoc(doc(col, trashId), entry);
            this.items.unshift(entry);
            this.updateTrashBadge();
        } catch (e) {
            console.warn('휴지통 저장 실패:', e);
        }
    },

    restoreItem: async function(trashId) {
        const item = this.items.find(t => t.id === trashId);
        if (!item) return;

        const itemDateStr = item.originalDateStr || item.dateStr;

        if (item.type === 'event' || item.type === 'journal') {
            if (window.dayViewInstance && window.dayViewInstance.lockedDateStr === itemDateStr) {
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
                alert("해당 항목이 삭제된 날짜로 이동하여 복원해주세요: " + itemDateStr);
                return;
            }
        } else if (item.type === 'memo') {
            if (window.memoViewInstance) {
                window.memoViewInstance.memoItems.unshift(item.data);
                window.memoViewInstance.render();
                if (window.dbAPI && window.dbAPI.addMemo) {
                    window.dbAPI.addMemo(item.data, item.data.groupId).catch(e => console.warn(e));
                }
            } else {
                alert("메모 탭으로 이동하여 복원해주세요.");
                return;
            }
        } else {
            // V4에서 지운 수업/조사표/명단/라벨/시간표 등은 V4에서 복원해야 한다.
            alert("이 항목은 V4(새 화면)에서 복원할 수 있습니다.");
            return;
        }

        await this.removeDoc(trashId);
        await this.openTrashModal();

        if (window.showToast) window.showToast('✅ 항목이 복원되었습니다. (저장 버튼을 눌러야 최종 반영됩니다)');
    },

    removeDoc: async function(trashId) {
        const col = this.trashCol();
        if (!col) return;
        try {
            await deleteDoc(doc(col, trashId));
        } catch (e) {
            console.warn('휴지통 삭제 실패:', e);
        }
        this.items = this.items.filter(t => t.id !== trashId);
        this.updateTrashBadge();
    },

    deleteForever: async function(trashId) {
        await this.removeDoc(trashId);
        await this.openTrashModal();
    },

    emptyTrash: async function() {
        if (!confirm("휴지통을 비우시겠습니까? (영구 삭제됨)")) return;
        const ids = this.items.map(t => t.id);
        for (const id of ids) {
            await this.removeDoc(id);
        }
        await this.openTrashModal();
    },

    openTrashModal: async function() {
        if (this.modal) {
            this.modal.close();
        }

        const trash = await this.load();

        let html = `
            <div style="max-height:400px; overflow-y:auto; padding:10px;">
                <div style="display:flex; justify-content:flex-end; margin-bottom:10px;">
                    <button onclick="window.TrashManager.emptyTrash()" style="background:#ef4444; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; font-weight:bold;">휴지통 비우기</button>
                </div>
        `;

        if (trash.length === 0) {
            html += `<div style="text-align:center; padding:20px; color:#64748b;">휴지통이 비어있습니다.</div>`;
        } else {
            const TYPE_LABELS = {
                event: '📌 일정', journal: '📔 기록', memo: '📝 메모',
                schedule: '🏫 수업', dday: '⏳ D-Day', eval: '📋 조사표',
                roster: '🧑‍🤝‍🧑 명단', label: '🏷️ 라벨', template: '⏰ 시간표'
            };
            trash.forEach(t => {
                const typeStr = TYPE_LABELS[t.type] || t.type;
                const title = t.content || t.data?.content || t.data?.text || '';
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
        if (trashBtn) trashBtn.innerText = this.items.length;
    }
};

window.TrashManager = TrashManager;

// 로그인 뒤에 한 번 읽어 배지를 채우고, 남아 있던 옛 휴지통을 클라우드로 옮긴다.
onAuthStateChanged(auth, (user) => {
    if (!user) {
        TrashManager.items = [];
        TrashManager.migrated = false;
        TrashManager.updateTrashBadge();
        return;
    }
    TrashManager.load().then(() => TrashManager.updateTrashBadge()).catch(e => console.warn(e));
});
