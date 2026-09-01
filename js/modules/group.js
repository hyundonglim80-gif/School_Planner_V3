<<<<<<< HEAD
// js/modules/group.js

import { dbAPI } from '../api/database.js'; // 🌟 신규 경로
import { auth } from '../api/firebaseInit.js'; // 🌟 신규 경로

export const GroupManager = {
    modalInstance: null,
    myGroups: [],

    openModal: async function() {
        const existing = document.getElementById('group-modal');
        if (existing) existing.remove();

        const loadingHtml = `
            <div style="padding: 40px; text-align: center; color: #3b82f6; font-weight: bold; font-size: 1.1rem;">
                ⏳ 내 그룹 정보를 불러오는 중입니다...
            </div>
        `;

        this.modalInstance = new window.Modal({
            id: 'group-modal',
            title: '👥 공유 그룹 관리',
            width: '600px',
            content: loadingHtml
        });
        
        this.modalInstance.open();

        try {
            this.myGroups = await dbAPI.loadMyGroups();
            const modalBody = document.querySelector('#group-modal .modal-body');
            if (modalBody) {
                modalBody.innerHTML = this.getModalHtml();
                this.renderGroupList();
            }
        } catch (error) {
            alert("그룹 정보를 불러오는데 실패했습니다. 인터넷 연결을 확인해주세요.");
            this.modalInstance.close();
        }
    },

    getModalHtml: function() {
        return `
            <div style="display:flex; flex-direction:column; gap:20px; max-height:65vh; overflow-y:auto; padding-right:5px;">
                
                <div class="modal-info-box" style="background:#eff6ff; border-left-color:#3b82f6; margin:0; padding:12px 15px;">
                    <p style="margin:0; font-size:0.95rem; color:#1e40af;">
                        <strong>[공유 그룹]</strong> 동료 선생님들과 일정, 메모, 업무 기록을 공유할 수 있는 공간입니다.<br>
                        그룹을 만들고 초대 코드를 전달하거나, 전달받은 코드를 입력해 가입하세요.
                    </p>
                </div>

                <div style="display:flex; gap:15px;">
                    <div style="flex:1; background:#f8fafc; border:1px solid #cbd5e1; border-radius:8px; padding:15px;">
                        <h4 style="margin:0 0 10px 0; color:#0f766e;">📥 초대 코드로 가입</h4>
                        <div style="display:flex; gap:6px;">
                            <input type="text" id="group-join-code" placeholder="6자리 코드 입력" style="flex:1; padding:8px; border:1px solid #cbd5e1; border-radius:4px; outline:none; text-transform:uppercase;" maxlength="6" onkeydown="if(event.key==='Enter') window.GroupManager.joinGroup()">
                            <button onclick="window.GroupManager.joinGroup()" style="padding:8px 12px; background:#0d9488; color:#fff; border:none; border-radius:4px; font-weight:bold; cursor:pointer;">가입</button>
                        </div>
                    </div>

                    <div style="flex:1; background:#f8fafc; border:1px solid #cbd5e1; border-radius:8px; padding:15px;">
                        <h4 style="margin:0 0 10px 0; color:#1d4ed8;">➕ 새 그룹 만들기</h4>
                        <div style="display:flex; gap:6px;">
                            <input type="text" id="group-create-name" placeholder="예: 1학년부, 업무팀" style="flex:1; padding:8px; border:1px solid #cbd5e1; border-radius:4px; outline:none;" onkeydown="if(event.key==='Enter') window.GroupManager.createGroup()">
                            <button onclick="window.GroupManager.createGroup()" style="padding:8px 12px; background:#2563eb; color:#fff; border:none; border-radius:4px; font-weight:bold; cursor:pointer;">생성</button>
                        </div>
                    </div>
                </div>

                <div>
                    <h3 style="margin:0 0 10px 0; color:#334155; font-size:1.1rem; border-bottom:2px solid #e2e8f0; padding-bottom:5px;">📋 내 소속 그룹 (<span id="group-count">0</span>)</h3>
                    <div id="group-list-container" style="display:flex; flex-direction:column; gap:10px; min-height:150px;"></div>
                </div>

            </div>
            
            <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px; border-top:1px solid #e2e8f0; padding-top:15px;">
                <button onclick="document.getElementById('group-modal').remove()" style="padding:10px 20px; border:none; background:#f1f5f9; color:#475569; border-radius:6px; font-weight:bold; cursor:pointer;">닫기</button>
            </div>
        `;
    },

    renderGroupList: function() {
        const container = document.getElementById('group-list-container');
        const countSpan = document.getElementById('group-count');
        if (!container) return;

        countSpan.innerText = this.myGroups.length;

        if (this.myGroups.length === 0) {
            container.innerHTML = `
                <div style="text-align:center; padding:30px; background:#f8fafc; border:1px dashed #cbd5e1; border-radius:8px; color:#94a3b8; font-size:0.95rem;">
                    현재 소속된 그룹이 없습니다.<br>위에서 그룹을 만들거나 코드로 가입해주세요!
                </div>
            `;
            return;
        }

        const currentUserId = auth.currentUser ? auth.currentUser.uid : null;

        container.innerHTML = this.myGroups.map(group => {
            const isOwner = group.ownerId === currentUserId;
            const memberCount = group.members ? group.members.length : 0;
            
            const actionButton = isOwner 
                ? `<button onclick="window.GroupManager.deleteGroup('${group.id}', '${group.name}')" style="background:#fee2e2; color:#ef4444; border:1px solid #fca5a5; padding:4px 8px; border-radius:4px; font-size:0.85rem; font-weight:bold; cursor:pointer;" title="그룹 폭파">🗑️ 삭제</button>`
                : `<button onclick="window.GroupManager.leaveGroup('${group.id}', '${group.name}')" style="background:#f1f5f9; color:#475569; border:1px solid #cbd5e1; padding:4px 8px; border-radius:4px; font-size:0.85rem; font-weight:bold; cursor:pointer;" title="그룹 나가기">👋 탈퇴</button>`;

            return `
                <div style="display:flex; justify-content:space-between; align-items:center; background:#fff; border:1px solid #cbd5e1; padding:12px 15px; border-radius:8px; box-shadow:0 1px 2px rgba(0,0,0,0.05);">
                    <div style="display:flex; flex-direction:column; gap:4px;">
                        <div style="display:flex; align-items:center; gap:8px;">
                            <span style="font-weight:bold; color:#1e293b; font-size:1.05rem;">${group.name}</span>
                            ${isOwner ? '<span style="background:#fef08a; color:#854d0e; padding:2px 6px; border-radius:12px; font-size:0.7rem; font-weight:bold;">👑 그룹장</span>' : ''}
                        </div>
                        <div style="font-size:0.85rem; color:#64748b; display:flex; align-items:center; gap:10px;">
                            <span>멤버: ${memberCount}명</span>
                            <span style="color:#cbd5e1;">|</span>
                            <span>초대 코드: <b style="color:#2563eb; letter-spacing:1px; user-select:all;">${group.inviteCode}</b></span>
                            <button onclick="window.GroupManager.copyCode('${group.inviteCode}')" style="background:none; border:none; padding:2px; cursor:pointer; color:#64748b;" title="코드 복사">📋</button>
                        </div>
                    </div>
                    <div>
                        ${actionButton}
                    </div>
                </div>
            `;
        }).join('');
    },

    createGroup: async function() {
        const nameInput = document.getElementById('group-create-name');
        const name = nameInput.value.trim();
        
        if (!name) return alert("만드실 그룹의 이름을 입력해주세요.");
        if (!confirm(`'${name}' 그룹을 생성하시겠습니까?`)) return;

        nameInput.disabled = true;
        nameInput.value = '생성 중...';

        try {
            await dbAPI.createGroup(name);
            alert(`✅ '${name}' 그룹이 생성되었습니다!\n목록에서 초대 코드를 확인하여 동료에게 전달하세요.`);
            
            this.myGroups = await dbAPI.loadMyGroups();
            this.renderGroupList();
            
            nameInput.value = '';
        } catch (error) {
            console.error(error);
            alert("그룹 생성 중 오류가 발생했습니다: " + error.message);
            nameInput.value = name;
        } finally {
            nameInput.disabled = false;
        }
    },

    joinGroup: async function() {
        const codeInput = document.getElementById('group-join-code');
        const code = codeInput.value.trim().toUpperCase();

        if (!code || code.length !== 6) return alert("6자리 초대 코드를 정확히 입력해주세요.");
        
        codeInput.disabled = true;
        const originalVal = codeInput.value;
        codeInput.value = '확인 중...';

        try {
            const joinedGroup = await dbAPI.joinGroup(code);
            alert(`🎉 '${joinedGroup.name}' 그룹에 성공적으로 가입되었습니다!`);
            
            this.myGroups = await dbAPI.loadMyGroups();
            this.renderGroupList();
            
            codeInput.value = '';
        } catch (error) {
            console.error(error);
            alert("가입 실패: " + error.message);
            codeInput.value = originalVal;
        } finally {
            codeInput.disabled = false;
        }
    },

    leaveGroup: async function(groupId, groupName) {
        if (!confirm(`정말로 '${groupName}' 그룹에서 탈퇴하시겠습니까?\n이후 해당 그룹의 공유 데이터를 볼 수 없습니다.`)) return;

        try {
            await dbAPI.leaveGroup(groupId);
            alert("그룹에서 탈퇴했습니다.");
            this.myGroups = await dbAPI.loadMyGroups();
            this.renderGroupList();
            
            if (typeof window.render === 'function') window.render(false);
        } catch (error) {
            console.error(error);
            alert("탈퇴 오류: " + error.message);
        }
    },

    deleteGroup: async function(groupId, groupName) {
        if (!confirm(`⚠️ 경고: '${groupName}' 그룹을 완전히 삭제하시겠습니까?\n그룹에 공유된 데이터 접근이 모든 멤버에게 차단됩니다. (데이터 복구 불가)`)) return;

        try {
            await dbAPI.deleteGroup(groupId);
            alert("그룹이 삭제되었습니다.");
            this.myGroups = await dbAPI.loadMyGroups();
            this.renderGroupList();
            
            if (typeof window.render === 'function') window.render(false);
        } catch (error) {
            console.error(error);
            alert("삭제 오류: " + error.message);
        }
    },

    copyCode: function(code) {
        navigator.clipboard.writeText(code).then(() => {
            alert(`초대 코드 [ ${code} ] 가 클립보드에 복사되었습니다.\n동료 선생님에게 붙여넣기(Ctrl+V)하여 전달하세요!`);
        }).catch(err => {
            alert("복사 실패. 코드를 직접 드래그해서 복사해주세요.");
        });
    }
};

=======
// js/modules/group.js

import { dbAPI } from '../api/database.js'; // 🌟 신규 경로
import { auth } from '../api/firebaseInit.js'; // 🌟 신규 경로

export const GroupManager = {
    modalInstance: null,
    myGroups: [],

    openModal: async function() {
        const existing = document.getElementById('group-modal');
        if (existing) existing.remove();

        const loadingHtml = `
            <div style="padding: 40px; text-align: center; color: #3b82f6; font-weight: bold; font-size: 1.1rem;">
                ⏳ 내 그룹 정보를 불러오는 중입니다...
            </div>
        `;

        this.modalInstance = new window.Modal({
            id: 'group-modal',
            title: '👥 공유 그룹 관리',
            width: '600px',
            content: loadingHtml
        });
        
        this.modalInstance.open();

        try {
            this.myGroups = await dbAPI.loadMyGroups();
            const modalBody = document.querySelector('#group-modal .modal-body');
            if (modalBody) {
                modalBody.innerHTML = this.getModalHtml();
                this.renderGroupList();
            }
        } catch (error) {
            alert("그룹 정보를 불러오는데 실패했습니다. 인터넷 연결을 확인해주세요.");
            this.modalInstance.close();
        }
    },

    getModalHtml: function() {
        return `
            <div style="display:flex; flex-direction:column; gap:20px; max-height:65vh; overflow-y:auto; padding-right:5px;">
                
                <div class="modal-info-box" style="background:#eff6ff; border-left-color:#3b82f6; margin:0; padding:12px 15px;">
                    <p style="margin:0; font-size:0.95rem; color:#1e40af;">
                        <strong>[공유 그룹]</strong> 동료 선생님들과 일정, 메모, 업무 기록을 공유할 수 있는 공간입니다.<br>
                        그룹을 만들고 초대 코드를 전달하거나, 전달받은 코드를 입력해 가입하세요.
                    </p>
                </div>

                <div style="display:flex; gap:15px;">
                    <div style="flex:1; background:#f8fafc; border:1px solid #cbd5e1; border-radius:8px; padding:15px;">
                        <h4 style="margin:0 0 10px 0; color:#0f766e;">📥 초대 코드로 가입</h4>
                        <div style="display:flex; gap:6px;">
                            <input type="text" id="group-join-code" placeholder="6자리 코드 입력" style="flex:1; padding:8px; border:1px solid #cbd5e1; border-radius:4px; outline:none; text-transform:uppercase;" maxlength="6" onkeydown="if(event.key==='Enter') window.GroupManager.joinGroup()">
                            <button onclick="window.GroupManager.joinGroup()" style="padding:8px 12px; background:#0d9488; color:#fff; border:none; border-radius:4px; font-weight:bold; cursor:pointer;">가입</button>
                        </div>
                    </div>

                    <div style="flex:1; background:#f8fafc; border:1px solid #cbd5e1; border-radius:8px; padding:15px;">
                        <h4 style="margin:0 0 10px 0; color:#1d4ed8;">➕ 새 그룹 만들기</h4>
                        <div style="display:flex; gap:6px;">
                            <input type="text" id="group-create-name" placeholder="예: 1학년부, 업무팀" style="flex:1; padding:8px; border:1px solid #cbd5e1; border-radius:4px; outline:none;" onkeydown="if(event.key==='Enter') window.GroupManager.createGroup()">
                            <button onclick="window.GroupManager.createGroup()" style="padding:8px 12px; background:#2563eb; color:#fff; border:none; border-radius:4px; font-weight:bold; cursor:pointer;">생성</button>
                        </div>
                    </div>
                </div>

                <div>
                    <h3 style="margin:0 0 10px 0; color:#334155; font-size:1.1rem; border-bottom:2px solid #e2e8f0; padding-bottom:5px;">📋 내 소속 그룹 (<span id="group-count">0</span>)</h3>
                    <div id="group-list-container" style="display:flex; flex-direction:column; gap:10px; min-height:150px;"></div>
                </div>

            </div>
            
            <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px; border-top:1px solid #e2e8f0; padding-top:15px;">
                <button onclick="document.getElementById('group-modal').remove()" style="padding:10px 20px; border:none; background:#f1f5f9; color:#475569; border-radius:6px; font-weight:bold; cursor:pointer;">닫기</button>
            </div>
        `;
    },

    renderGroupList: function() {
        const container = document.getElementById('group-list-container');
        const countSpan = document.getElementById('group-count');
        if (!container) return;

        countSpan.innerText = this.myGroups.length;

        if (this.myGroups.length === 0) {
            container.innerHTML = `
                <div style="text-align:center; padding:30px; background:#f8fafc; border:1px dashed #cbd5e1; border-radius:8px; color:#94a3b8; font-size:0.95rem;">
                    현재 소속된 그룹이 없습니다.<br>위에서 그룹을 만들거나 코드로 가입해주세요!
                </div>
            `;
            return;
        }

        const currentUserId = auth.currentUser ? auth.currentUser.uid : null;

        container.innerHTML = this.myGroups.map(group => {
            const isOwner = group.ownerId === currentUserId;
            const memberCount = group.members ? group.members.length : 0;
            
            const actionButton = isOwner 
                ? `<button onclick="window.GroupManager.deleteGroup('${group.id}', '${group.name}')" style="background:#fee2e2; color:#ef4444; border:1px solid #fca5a5; padding:4px 8px; border-radius:4px; font-size:0.85rem; font-weight:bold; cursor:pointer;" title="그룹 폭파">🗑️ 삭제</button>`
                : `<button onclick="window.GroupManager.leaveGroup('${group.id}', '${group.name}')" style="background:#f1f5f9; color:#475569; border:1px solid #cbd5e1; padding:4px 8px; border-radius:4px; font-size:0.85rem; font-weight:bold; cursor:pointer;" title="그룹 나가기">👋 탈퇴</button>`;

            return `
                <div style="display:flex; justify-content:space-between; align-items:center; background:#fff; border:1px solid #cbd5e1; padding:12px 15px; border-radius:8px; box-shadow:0 1px 2px rgba(0,0,0,0.05);">
                    <div style="display:flex; flex-direction:column; gap:4px;">
                        <div style="display:flex; align-items:center; gap:8px;">
                            <span style="font-weight:bold; color:#1e293b; font-size:1.05rem;">${group.name}</span>
                            ${isOwner ? '<span style="background:#fef08a; color:#854d0e; padding:2px 6px; border-radius:12px; font-size:0.7rem; font-weight:bold;">👑 그룹장</span>' : ''}
                        </div>
                        <div style="font-size:0.85rem; color:#64748b; display:flex; align-items:center; gap:10px;">
                            <span>멤버: ${memberCount}명</span>
                            <span style="color:#cbd5e1;">|</span>
                            <span>초대 코드: <b style="color:#2563eb; letter-spacing:1px; user-select:all;">${group.inviteCode}</b></span>
                            <button onclick="window.GroupManager.copyCode('${group.inviteCode}')" style="background:none; border:none; padding:2px; cursor:pointer; color:#64748b;" title="코드 복사">📋</button>
                        </div>
                    </div>
                    <div>
                        ${actionButton}
                    </div>
                </div>
            `;
        }).join('');
    },

    createGroup: async function() {
        const nameInput = document.getElementById('group-create-name');
        const name = nameInput.value.trim();
        
        if (!name) return alert("만드실 그룹의 이름을 입력해주세요.");
        if (!confirm(`'${name}' 그룹을 생성하시겠습니까?`)) return;

        nameInput.disabled = true;
        nameInput.value = '생성 중...';

        try {
            await dbAPI.createGroup(name);
            alert(`✅ '${name}' 그룹이 생성되었습니다!\n목록에서 초대 코드를 확인하여 동료에게 전달하세요.`);
            
            this.myGroups = await dbAPI.loadMyGroups();
            this.renderGroupList();
            
            nameInput.value = '';
        } catch (error) {
            console.error(error);
            alert("그룹 생성 중 오류가 발생했습니다: " + error.message);
            nameInput.value = name;
        } finally {
            nameInput.disabled = false;
        }
    },

    joinGroup: async function() {
        const codeInput = document.getElementById('group-join-code');
        const code = codeInput.value.trim().toUpperCase();

        if (!code || code.length !== 6) return alert("6자리 초대 코드를 정확히 입력해주세요.");
        
        codeInput.disabled = true;
        const originalVal = codeInput.value;
        codeInput.value = '확인 중...';

        try {
            const joinedGroup = await dbAPI.joinGroup(code);
            alert(`🎉 '${joinedGroup.name}' 그룹에 성공적으로 가입되었습니다!`);
            
            this.myGroups = await dbAPI.loadMyGroups();
            this.renderGroupList();
            
            codeInput.value = '';
        } catch (error) {
            console.error(error);
            alert("가입 실패: " + error.message);
            codeInput.value = originalVal;
        } finally {
            codeInput.disabled = false;
        }
    },

    leaveGroup: async function(groupId, groupName) {
        if (!confirm(`정말로 '${groupName}' 그룹에서 탈퇴하시겠습니까?\n이후 해당 그룹의 공유 데이터를 볼 수 없습니다.`)) return;

        try {
            await dbAPI.leaveGroup(groupId);
            alert("그룹에서 탈퇴했습니다.");
            this.myGroups = await dbAPI.loadMyGroups();
            this.renderGroupList();
            
            if (typeof window.render === 'function') window.render(false);
        } catch (error) {
            console.error(error);
            alert("탈퇴 오류: " + error.message);
        }
    },

    deleteGroup: async function(groupId, groupName) {
        if (!confirm(`⚠️ 경고: '${groupName}' 그룹을 완전히 삭제하시겠습니까?\n그룹에 공유된 데이터 접근이 모든 멤버에게 차단됩니다. (데이터 복구 불가)`)) return;

        try {
            await dbAPI.deleteGroup(groupId);
            alert("그룹이 삭제되었습니다.");
            this.myGroups = await dbAPI.loadMyGroups();
            this.renderGroupList();
            
            if (typeof window.render === 'function') window.render(false);
        } catch (error) {
            console.error(error);
            alert("삭제 오류: " + error.message);
        }
    },

    copyCode: function(code) {
        navigator.clipboard.writeText(code).then(() => {
            alert(`초대 코드 [ ${code} ] 가 클립보드에 복사되었습니다.\n동료 선생님에게 붙여넣기(Ctrl+V)하여 전달하세요!`);
        }).catch(err => {
            alert("복사 실패. 코드를 직접 드래그해서 복사해주세요.");
        });
    }
};

>>>>>>> d1348ae5447b87f69a849130f4f6a30f4c5cc4fe
window.GroupManager = GroupManager;