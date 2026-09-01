<<<<<<< HEAD
// js/core/networkManager.js
import { enableNetwork, disableNetwork, waitForPendingWrites } from "firebase/firestore";
import { db } from "../api/firebaseInit.js";

// 내부 플래그: 현재 수동 동기화 중인지 여부를 추적하여 중복 동작 방지
let isManualSyncing = false;

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
    // 수동 동기화가 진행 중일 때는 토글 버튼 클릭을 무시하여 충돌 방지
    if (isManualSyncing) return;

    const toggleBtn = document.getElementById('network-toggle-btn');
    const manualSyncBtn = document.getElementById('manual-sync-btn');
    
    let isOfflineMode;
    if (forceMode !== null) {
        isOfflineMode = forceMode === 'offline';
    } else {
        isOfflineMode = !(localStorage.getItem('workCalendar_offlineMode') === 'true');
    }

    // 변경된 모드를 브라우저에 저장
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
    
    // 이미 동기화가 진행 중이면 추가 실행 방지
    if (isManualSyncing) return;

    const btn = document.getElementById('manual-sync-btn');
    const originalText = btn ? btn.innerHTML : '🔄';
    if (btn) { btn.innerHTML = '⏳'; btn.style.opacity = '0.7'; btn.disabled = true; }

    isManualSyncing = true;

    try {
        // 1. 임시 온라인 전환 (데이터 Push/Pull 허용)
        await setNetworkOnline();
        
        // 2. 서버와 웹소켓 연결이 안정화되도록 잠시 대기
        await new Promise(resolve => setTimeout(resolve, 800)); 

        // 3. 로컬에 쌓인 오프라인 수정사항(Push)을 서버에 완전히 반영할 때까지 대기
        await waitForPendingWrites(db);
        
        // 4. 화면 및 설정 갱신 (서버에서 최신 데이터 Pull)
        if (window.loadSettings) await window.loadSettings(); 
        if (window.render) window.render(false);
        
        alert("✅ 최신 데이터로 동기화가 완료되었습니다.");
    } catch(e) {
        console.error("수동 동기화 실패", e);
        alert("❌ 동기화 중 오류가 발생했습니다.");
    } finally {
        isManualSyncing = false;

        // 5. 무조건 오프라인으로 끄는 것이 아니라, 사용자가 의도한 모드에 맞춰 안전하게 복구
        const isIntendedOffline = localStorage.getItem('workCalendar_offlineMode') === 'true';
        if (isIntendedOffline) {
            await setNetworkOffline();
        } else {
            await setNetworkOnline();
        }
        
        if (btn) { btn.innerHTML = originalText; btn.style.opacity = '1'; btn.disabled = false; }
    }
};
=======
// js/core/networkManager.js
import { enableNetwork, disableNetwork, waitForPendingWrites } from "firebase/firestore";
import { db } from "../api/firebaseInit.js";

// 내부 플래그: 현재 수동 동기화 중인지 여부를 추적하여 중복 동작 방지
let isManualSyncing = false;

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
    // 수동 동기화가 진행 중일 때는 토글 버튼 클릭을 무시하여 충돌 방지
    if (isManualSyncing) return;

    const toggleBtn = document.getElementById('network-toggle-btn');
    const manualSyncBtn = document.getElementById('manual-sync-btn');
    
    let isOfflineMode;
    if (forceMode !== null) {
        isOfflineMode = forceMode === 'offline';
    } else {
        isOfflineMode = !(localStorage.getItem('workCalendar_offlineMode') === 'true');
    }

    // 변경된 모드를 브라우저에 저장
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
    
    // 이미 동기화가 진행 중이면 추가 실행 방지
    if (isManualSyncing) return;

    const btn = document.getElementById('manual-sync-btn');
    const originalText = btn ? btn.innerHTML : '🔄';
    if (btn) { btn.innerHTML = '⏳'; btn.style.opacity = '0.7'; btn.disabled = true; }

    isManualSyncing = true;

    try {
        // 1. 임시 온라인 전환 (데이터 Push/Pull 허용)
        await setNetworkOnline();
        
        // 2. 서버와 웹소켓 연결이 안정화되도록 잠시 대기
        await new Promise(resolve => setTimeout(resolve, 800)); 

        // 3. 로컬에 쌓인 오프라인 수정사항(Push)을 서버에 완전히 반영할 때까지 대기
        await waitForPendingWrites(db);
        
        // 4. 화면 및 설정 갱신 (서버에서 최신 데이터 Pull)
        if (window.loadSettings) await window.loadSettings(); 
        if (window.render) window.render(false);
        
        alert("✅ 최신 데이터로 동기화가 완료되었습니다.");
    } catch(e) {
        console.error("수동 동기화 실패", e);
        alert("❌ 동기화 중 오류가 발생했습니다.");
    } finally {
        isManualSyncing = false;

        // 5. 무조건 오프라인으로 끄는 것이 아니라, 사용자가 의도한 모드에 맞춰 안전하게 복구
        const isIntendedOffline = localStorage.getItem('workCalendar_offlineMode') === 'true';
        if (isIntendedOffline) {
            await setNetworkOffline();
        } else {
            await setNetworkOnline();
        }
        
        if (btn) { btn.innerHTML = originalText; btn.style.opacity = '1'; btn.disabled = false; }
    }
};
>>>>>>> d1348ae5447b87f69a849130f4f6a30f4c5cc4fe
