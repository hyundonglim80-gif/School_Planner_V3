<<<<<<< HEAD
// js/api/auth.js
import { GoogleAuthProvider, signInWithPopup, signOut as firebaseSignOut, setPersistence, browserLocalPersistence } from "firebase/auth";
import { auth } from "./firebaseInit.js";
import { store } from '../core/store.js';
import { toggleNetworkMode } from '../core/networkManager.js';
import { loadSettings } from '../core/settings.js';
import { render } from '../ui/uiManager.js';

const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });
provider.addScope('https://www.googleapis.com/auth/calendar');
provider.addScope('https://www.googleapis.com/auth/tasks');
provider.addScope('https://www.googleapis.com/auth/spreadsheets');
provider.addScope('https://www.googleapis.com/auth/drive.file');

export const signInWithGoogle = () => {
    const loginBtn = document.querySelector('#login-screen button');
    let originalHtml = '';

    if (loginBtn) {
        originalHtml = loginBtn.innerHTML;
        loginBtn.innerHTML = '⏳ 구글 팝업창에서 로그인 중...';
        loginBtn.disabled = true;
    }

    setPersistence(auth, browserLocalPersistence)
        .then(() => signInWithPopup(auth, provider))
        .then(async (result) => {
            console.log("✅ 로그인 성공:", result.user.displayName);
            const credential = GoogleAuthProvider.credentialFromResult(result);
            if (credential?.accessToken) {
                sessionStorage.setItem('google_api_token', credential.accessToken);
            }

            const loginScreen = document.getElementById('login-screen');
            const userInfo = document.getElementById('user-info');
            if (loginScreen) loginScreen.style.display = 'none';
            if (userInfo) userInfo.style.display = 'flex';

            try {
                if (window.loadSettings) await window.loadSettings();
                if (window.autoCheckAndRunMigration) await window.autoCheckAndRunMigration();
                if (window.autoForwardIncompleteEvents) await window.autoForwardIncompleteEvents();
                if (typeof window.render === 'function') window.render();
            } catch (e) {
                console.error("화면 로딩 중 에러:", e);
                if (typeof window.render === 'function') window.render();
            }
        })
        .catch(error => {
            console.error("로그인 에러:", error);
            if (error.code === 'auth/popup-closed-by-user') {
                alert("로그인 팝업창을 닫으셨습니다. 다시 시도해 주세요.");
            } else if (error.code !== 'auth/unauthorized-domain') {
                console.warn("로그인 프로세스 알림:", error.message);
            }

            if (loginBtn) {
                loginBtn.innerHTML = originalHtml;
                loginBtn.disabled = false;
            }
        });
};

export const signOut = () => {
    firebaseSignOut(auth).then(() => {
        sessionStorage.removeItem('google_api_token');
        localStorage.removeItem('workCalendar_eventLabels_v4');
        localStorage.removeItem('workCalendar_journalLabels_v4');
        localStorage.removeItem('workCalendar_memoLabels');
        window.location.href = window.location.href.split('#')[0];
    });
};

export const forceRenewToken = async () => {
    const renewProvider = new GoogleAuthProvider();
    renewProvider.addScope('https://www.googleapis.com/auth/calendar');
    renewProvider.addScope('https://www.googleapis.com/auth/tasks');
    renewProvider.addScope('https://www.googleapis.com/auth/spreadsheets');
    renewProvider.addScope('https://www.googleapis.com/auth/drive.file');

    try {
        const result = await signInWithPopup(auth, renewProvider);
        const credential = GoogleAuthProvider.credentialFromResult(result);
        if (credential?.accessToken) {
            sessionStorage.setItem('google_api_token', credential.accessToken);
            return credential.accessToken;
        }
    } catch (error) {
        console.error("권한 연장 에러:", error);
        if (error.code === 'auth/popup-blocked') {
            throw new Error("팝업 차단이 감지되었습니다. 브라우저 주소창 우측에서 '팝업 차단 해제'를 해주세요.", { cause: error });
        }
        // 💡 [수정 완료] '소' 오타를 제거하고 정상적인 문법으로 복구했습니다.
        throw new Error("권한 연장에 실패했습니다. 우측 상단의 로그아웃 후 다시 로그인해 주세요.", { cause: error });
    }
    return null;
};

export const getValidGoogleToken = async () => {
    let token = sessionStorage.getItem('google_api_token');
    if (!token) {
        alert("구글 서비스 연동 권한이 없습니다.\n[확인]을 누르시면 즉시 권한을 갱신합니다.");
        return await forceRenewToken();
    }
    try {
        const res = await fetch('https://oauth2.googleapis.com/tokeninfo?access_token=' + token);
        if (res.ok) return token;
    } catch (e) {
        console.warn("토큰 검증 실패 (만료됨)");
    }
    alert("보안 정책(1시간 제한)으로 구글 연결이 만료되었습니다.\n[확인]을 누르시면 화면 이동 없이 자동으로 1시간 연장됩니다!");
    return await forceRenewToken();
};

export const initAuthListener = () => {
    const loginBtn = document.querySelector('#login-screen button');
    let originalBtnHtml = loginBtn ? loginBtn.innerHTML : '';
    if (loginBtn) { loginBtn.innerHTML = '로그인 상태 확인 중...'; loginBtn.disabled = true; }

    auth.onAuthStateChanged(async user => {
        if (user) {
            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('user-info').style.display = 'flex';
            if (user.photoURL) document.getElementById('user-photo').src = user.photoURL;

            const savedOfflineMode = localStorage.getItem('workCalendar_offlineMode') === 'true';
            if (typeof window.toggleNetworkMode === 'function') await window.toggleNetworkMode(savedOfflineMode ? 'offline' : 'online');

            const savedScope = localStorage.getItem('workCalendar_scope') || 'day';
            store.scope = savedScope;
            
            const defaultModes = { year: 'viewer', month: 'viewer', week: 'editor', day: 'editor', memo: 'viewer' };
            store.mode = localStorage.getItem(`workCalendar_mode_${savedScope}`) || defaultModes[savedScope] || 'viewer';
            localStorage.setItem('workCalendar_mode', store.mode);

            const savedDate = localStorage.getItem(`workCalendar_date_${savedScope}`);
            store.currentDate = savedDate ? new Date(savedDate) : new Date();

            try {
                if (typeof window.loadSettings === 'function') await window.loadSettings();
                if (window.autoCheckAndRunMigration) await window.autoCheckAndRunMigration();
                if (window.autoForwardIncompleteEvents) await window.autoForwardIncompleteEvents();
            } catch (e) { console.error("초기 로딩 에러:", e); }

            render(false);
            setTimeout(() => {
                if (localStorage.getItem('workCalendar_hideHelp_v7') !== 'true' && typeof window.openHelpModal === 'function') window.openHelpModal();
            }, 500); 
        } else {
            document.getElementById('login-screen').style.display = 'flex';
            document.getElementById('user-info').style.display = 'none';
            const mainView = document.getElementById("main-view");
            if (mainView) mainView.innerHTML = ""; 
            if (loginBtn) { loginBtn.innerHTML = originalBtnHtml || 'Google 계정으로 로그인'; loginBtn.disabled = false; }
        }
    });
};
=======
// js/api/auth.js
import { GoogleAuthProvider, signInWithPopup, signOut as firebaseSignOut, setPersistence, browserLocalPersistence } from "firebase/auth";
import { auth } from "./firebaseInit.js";
import { store } from '../core/store.js';
import { toggleNetworkMode } from '../core/networkManager.js';
import { loadSettings } from '../core/settings.js';
import { render } from '../ui/uiManager.js';

const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });
provider.addScope('https://www.googleapis.com/auth/calendar');
provider.addScope('https://www.googleapis.com/auth/tasks');
provider.addScope('https://www.googleapis.com/auth/spreadsheets');
provider.addScope('https://www.googleapis.com/auth/drive.file');

export const signInWithGoogle = () => {
    const loginBtn = document.querySelector('#login-screen button');
    let originalHtml = '';

    if (loginBtn) {
        originalHtml = loginBtn.innerHTML;
        loginBtn.innerHTML = '⏳ 구글 팝업창에서 로그인 중...';
        loginBtn.disabled = true;
    }

    setPersistence(auth, browserLocalPersistence)
        .then(() => signInWithPopup(auth, provider))
        .then(async (result) => {
            console.log("✅ 로그인 성공:", result.user.displayName);
            const credential = GoogleAuthProvider.credentialFromResult(result);
            if (credential?.accessToken) {
                sessionStorage.setItem('google_api_token', credential.accessToken);
            }

            const loginScreen = document.getElementById('login-screen');
            const userInfo = document.getElementById('user-info');
            if (loginScreen) loginScreen.style.display = 'none';
            if (userInfo) userInfo.style.display = 'flex';

            try {
                if (window.loadSettings) await window.loadSettings();
                if (window.autoCheckAndRunMigration) await window.autoCheckAndRunMigration();
                if (window.autoForwardIncompleteEvents) await window.autoForwardIncompleteEvents();
                if (typeof window.render === 'function') window.render();
            } catch (e) {
                console.error("화면 로딩 중 에러:", e);
                if (typeof window.render === 'function') window.render();
            }
        })
        .catch(error => {
            console.error("로그인 에러:", error);
            if (error.code === 'auth/popup-closed-by-user') {
                alert("로그인 팝업창을 닫으셨습니다. 다시 시도해 주세요.");
            } else if (error.code !== 'auth/unauthorized-domain') {
                console.warn("로그인 프로세스 알림:", error.message);
            }

            if (loginBtn) {
                loginBtn.innerHTML = originalHtml;
                loginBtn.disabled = false;
            }
        });
};

export const signOut = () => {
    firebaseSignOut(auth).then(() => {
        sessionStorage.removeItem('google_api_token');
        localStorage.removeItem('workCalendar_eventLabels_v4');
        localStorage.removeItem('workCalendar_journalLabels_v4');
        localStorage.removeItem('workCalendar_memoLabels');
        window.location.href = window.location.href.split('#')[0];
    });
};

export const forceRenewToken = async () => {
    const renewProvider = new GoogleAuthProvider();
    renewProvider.addScope('https://www.googleapis.com/auth/calendar');
    renewProvider.addScope('https://www.googleapis.com/auth/tasks');
    renewProvider.addScope('https://www.googleapis.com/auth/spreadsheets');
    renewProvider.addScope('https://www.googleapis.com/auth/drive.file');

    try {
        const result = await signInWithPopup(auth, renewProvider);
        const credential = GoogleAuthProvider.credentialFromResult(result);
        if (credential?.accessToken) {
            sessionStorage.setItem('google_api_token', credential.accessToken);
            return credential.accessToken;
        }
    } catch (error) {
        console.error("권한 연장 에러:", error);
        if (error.code === 'auth/popup-blocked') {
            throw new Error("팝업 차단이 감지되었습니다. 브라우저 주소창 우측에서 '팝업 차단 해제'를 해주세요.", { cause: error });
        }
        // 💡 [수정 완료] '소' 오타를 제거하고 정상적인 문법으로 복구했습니다.
        throw new Error("권한 연장에 실패했습니다. 우측 상단의 로그아웃 후 다시 로그인해 주세요.", { cause: error });
    }
    return null;
};

export const getValidGoogleToken = async () => {
    let token = sessionStorage.getItem('google_api_token');
    if (!token) {
        alert("구글 서비스 연동 권한이 없습니다.\n[확인]을 누르시면 즉시 권한을 갱신합니다.");
        return await forceRenewToken();
    }
    try {
        const res = await fetch('https://oauth2.googleapis.com/tokeninfo?access_token=' + token);
        if (res.ok) return token;
    } catch (e) {
        console.warn("토큰 검증 실패 (만료됨)");
    }
    alert("보안 정책(1시간 제한)으로 구글 연결이 만료되었습니다.\n[확인]을 누르시면 화면 이동 없이 자동으로 1시간 연장됩니다!");
    return await forceRenewToken();
};

export const initAuthListener = () => {
    const loginBtn = document.querySelector('#login-screen button');
    let originalBtnHtml = loginBtn ? loginBtn.innerHTML : '';
    if (loginBtn) { loginBtn.innerHTML = '로그인 상태 확인 중...'; loginBtn.disabled = true; }

    auth.onAuthStateChanged(async user => {
        if (user) {
            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('user-info').style.display = 'flex';
            if (user.photoURL) document.getElementById('user-photo').src = user.photoURL;

            const savedOfflineMode = localStorage.getItem('workCalendar_offlineMode') === 'true';
            if (typeof window.toggleNetworkMode === 'function') await window.toggleNetworkMode(savedOfflineMode ? 'offline' : 'online');

            const savedScope = localStorage.getItem('workCalendar_scope') || 'day';
            store.scope = savedScope;
            
            const defaultModes = { year: 'viewer', month: 'viewer', week: 'editor', day: 'editor', memo: 'viewer' };
            store.mode = localStorage.getItem(`workCalendar_mode_${savedScope}`) || defaultModes[savedScope] || 'viewer';
            localStorage.setItem('workCalendar_mode', store.mode);

            const savedDate = localStorage.getItem(`workCalendar_date_${savedScope}`);
            store.currentDate = savedDate ? new Date(savedDate) : new Date();

            try {
                if (typeof window.loadSettings === 'function') await window.loadSettings();
                if (window.autoCheckAndRunMigration) await window.autoCheckAndRunMigration();
                if (window.autoForwardIncompleteEvents) await window.autoForwardIncompleteEvents();
            } catch (e) { console.error("초기 로딩 에러:", e); }

            render(false);
            setTimeout(() => {
                if (localStorage.getItem('workCalendar_hideHelp_v7') !== 'true' && typeof window.openHelpModal === 'function') window.openHelpModal();
            }, 500); 
        } else {
            document.getElementById('login-screen').style.display = 'flex';
            document.getElementById('user-info').style.display = 'none';
            const mainView = document.getElementById("main-view");
            if (mainView) mainView.innerHTML = ""; 
            if (loginBtn) { loginBtn.innerHTML = originalBtnHtml || 'Google 계정으로 로그인'; loginBtn.disabled = false; }
        }
    });
};
>>>>>>> d1348ae5447b87f69a849130f4f6a30f4c5cc4fe
