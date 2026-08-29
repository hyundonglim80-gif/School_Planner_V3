// js/core/networkManager.js
import { enableNetwork, disableNetwork, waitForPendingWrites } from "firebase/firestore";
import { db } from "../api/firebaseInit.js";

export const setNetworkOnline = async () => {
    try {
        await enableNetwork(db);
        console.log("🌐 Firebase 네트워크 켜짐 (온라인 동기화 시작)");
    } catch (error) { console.error("네트워크 활성화 실패:", error); }
};

export const setNetworkOffline = async () => {
    try {
        await disableNetwork(db);
        console.log("⚡ Firebase 네트워크 꺼짐 (오프라인 모드 진입)");
    } catch (error) { console.error("네트워크 비활성화 실패:", error); }
};

export const toggleNetworkMode = async (forceMode = null) => {
    const toggleBtn = document.getElementById('network-toggle-btn');
    const manualSyncBtn = document.getElementById('manual-sync-btn');
    
    let isOfflineMode;
    if (forceMode !== null) isOfflineMode = forceMode === 'offline';
    else isOfflineMode = !(localStorage.getItem('workCalendar_offlineMode') === 'true');

    localStorage.setItem('workCalendar_offlineMode', isOfflineMode);

    if (isOfflineMode) {
        if (toggleBtn) { toggleBtn.innerHTML = '✈️'; toggleBtn.style.background = '#ef4444'; toggleBtn.title = '현재 오프라인 모드 (클릭 시 온라인 전환)'; }
        if (manualSyncBtn) manualSyncBtn.style.display = 'flex';
        await setNetworkOffline();
    } else {
        if (toggleBtn) { toggleBtn.innerHTML = '🌐'; toggleBtn.style.background = '#10b981'; toggleBtn.title = '현재 온라인 모드 (클릭 시 오프라인 전환)'; }
        if (manualSyncBtn) manualSyncBtn.style.display = 'none';
        await setNetworkOnline();
    }
};

export const executeManualSync = async () => {
    if (!navigator.onLine) return alert("기기가 인터넷에 연결되어 있지 않습니다. 와이파이 연결을 확인해주세요.");

    const btn = document.getElementById('manual-sync-btn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '⏳'; btn.style.opacity = '0.7'; btn.disabled = true;

    try {
        // 1. 온라인 전환 (웹소켓 연결 시작)
        await setNetworkOnline();
        
        // 2. 서버 연결(Pull)이 안정적으로 맺어질 수 있도록 아주 짧게만 대기
        await new Promise(resolve => setTimeout(resolve, 500)); 

        // 3. 로컬에 쌓인 변경사항(Push)이 서버에 100% 기록될 때까지 기다림
        await waitForPendingWrites(db);
        
        // 4. 화면 및 설정 갱신 (온라인 상태이므로 서버의 최신 데이터를 가져옴)
        if (window.loadSettings) await window.loadSettings(); 
        if (window.render) window.render(false);
        
        alert("✅ 최신 데이터로 동기화가 완료되었습니다.");
    } catch(e) {
        console.error("수동 동기화 실패", e);
        alert("❌ 동기화 중 오류가 발생했습니다.");
    } finally {
        // 5. 모든 작업이 끝난 후 다시 오프라인으로 전환
        await setNetworkOffline();
        btn.innerHTML = originalText; btn.style.opacity = '1'; btn.disabled = false;
    }
};
