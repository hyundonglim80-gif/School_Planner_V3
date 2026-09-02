// js/core/syncManager.js
import { doc, getDoc, setDoc, runTransaction } from "firebase/firestore";
import { db, auth } from "../api/firebaseInit.js";
import { getUserCol, getGroupCol } from "../api/database.js";

export const SyncManager = {
    pendingWrites: 0,
    syncIndicatorId: 'sync-status-indicator',

    // 1. UI 상태 업데이트 로직 (상단 1행 아이콘)
    updateSyncUI: function() {
        const indicator = document.getElementById(this.syncIndicatorId);
        if (!indicator) return;

        if (this.pendingWrites > 0) {
            indicator.style.display = 'flex';
            indicator.innerHTML = `<div style="width:14px; height:14px; border:2px solid #fbbf24; border-top-color:transparent; border-radius:50%; animation:spin 1s linear infinite;"></div> 데이터 동기화 중...`;
            indicator.style.color = '#d97706';
            indicator.style.backgroundColor = '#fffbeb';
            indicator.style.borderColor = '#fcd34d';
        } else {
            indicator.innerHTML = `✅ 동기화 완료`;
            indicator.style.color = '#059669';
            indicator.style.backgroundColor = '#ecfdf5';
            indicator.style.borderColor = '#6ee7b7';
            setTimeout(() => {
                if (this.pendingWrites === 0) indicator.style.display = 'none';
            }, 2000); // 2초 후 숨김
        }
    },

    // 2. 캐시 기반 로컬 업데이트 및 백그라운드 동기화 큐
    addWriteTask: async function(promiseFunc) {
        this.pendingWrites++;
        this.updateSyncUI();

        try {
            await promiseFunc(); // 백그라운드에서 실제 DB 업로드 수행
        } catch (error) {
            console.error("백그라운드 동기화 실패:", error);
            // 필요 시 재시도 로직 추가
        } finally {
            this.pendingWrites--;
            this.updateSyncUI();
        }
    },

    // 3. 개인 데이터 저장 (캐시 우선 적용 + 백그라운드 업로드)
    savePersonalData: function(dateStr, data) {
        const docRef = doc(getUserCol('events'), dateStr);
        
        // 1) 즉각적으로 시스템(캐시) 상태를 먼저 업데이트하여 속도 유지
        // (UI는 이미 낙관적 업데이트가 완료된 상태여야 함)
        
        // 2) 백그라운드 동기화 큐에 등록 (사용자 대기 없음)
        this.addWriteTask(async () => {
            await setDoc(docRef, { ...data, updatedAt: Date.now() }, { merge: true });
        });
    },

    // 4. 공유 그룹 실시간 동기화 안내 및 트랜잭션 병합 처리
    saveGroupData: async function(groupId, dateStr, currentEvents) {
        // 알림 문구 출력
        this.showGroupRealtimeNotice();
        
        const docRef = doc(getGroupCol(groupId, 'events'), dateStr);

        this.addWriteTask(async () => {
            await runTransaction(db, async (transaction) => {
                const docSnap = await transaction.get(docRef);
                const existingData = docSnap.exists() ? docSnap.data().eventList || [] : [];

                // 🌟 동시 수정 시 데이터 보존 로직 (Overwriting 방지)
                // 현재 DB에 있는 기존 이벤트와 내가 방금 작성/수정한 이벤트를 비교하여 병합
                const mergedEvents = [...existingData];

                currentEvents.forEach(newEv => {
                    const existingIdx = mergedEvents.findIndex(e => e.id === newEv.id);
                    if (existingIdx !== -1) {
                        // 동일한 ID의 일정을 누군가 이미 수정했다면, 덮어쓰지 않고 새로운 ID를 부여하여 복제(충돌 보존)
                        const isDifferent = JSON.stringify(mergedEvents[existingIdx]) !== JSON.stringify(newEv);
                        if (isDifferent && mergedEvents[existingIdx].authorId !== newEv.authorId) {
                            const conflictedEvent = { ...newEv, id: newEv.id + '_conflict_' + Date.now() };
                            mergedEvents.push(conflictedEvent);
                        } else {
                            // 내가 작성한 것이거나 내용이 같으면 그냥 업데이트
                            mergedEvents[existingIdx] = newEv;
                        }
                    } else {
                        // DB에 없는 새로운 이벤트면 추가
                        mergedEvents.push(newEv);
                    }
                });

                transaction.set(docRef, { eventList: mergedEvents, updatedAt: Date.now() }, { merge: true });
            });
        });
    },

    showGroupRealtimeNotice: function() {
        // 중복 알림 방지를 위한 플래그 처리
        if (window.hasShownGroupNotice) return;
        window.hasShownGroupNotice = true;

        const toast = document.createElement('div');
        toast.innerHTML = `👥 <b>실시간 동기화 모드</b><br>공유그룹 데이터는 즉시 데이터베이스에 반영되며, 동시 수정 시 모든 기록이 보존됩니다.`;
        toast.style.cssText = "position:fixed; bottom:20px; right:20px; background:#eff6ff; color:#1e40af; padding:15px; border-left:4px solid #3b82f6; border-radius:4px; box-shadow:0 4px 6px rgba(0,0,0,0.1); z-index:9999;";
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 4000);
    },

    // 5. 페이지 닫힘/새로고침 방지 (데이터 유실 방지 팝업)
    initUnloadWarning: function() {
        window.addEventListener('beforeunload', (e) => {
            if (this.pendingWrites > 0) {
                const message = "백그라운드 동기화가 아직 완료되지 않았습니다. 지금 종료하시면 저장되지 않은 데이터가 삭제될 수 있습니다.";
                e.returnValue = message; // 레거시 브라우저 지원
                return message; // 최신 브라우저 지원
            }
        });
    }
};

// 초기화 실행
SyncManager.initUnloadWarning();
window.SyncManager = SyncManager;