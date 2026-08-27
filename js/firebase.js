// js/firebase.js
// 🌟 [브릿지 파일] 
// 기존 모듈들이 새로운 api 폴더를 바라보도록 연결해주는 '다리(Proxy)' 역할만 합니다.
// 다른 파일들의 경로를 한 번에 수정하다 생기는 오류를 방지합니다.

import { app, db, auth, storage } from './api/firebaseInit.js';
import { signInWithGoogle, signOut, forceRenewToken, getValidGoogleToken } from './api/auth.js';
import { getUserCol, getGroupCol, dbAPI } from './api/database.js';
import { compressImage } from './api/storage.js';
import { setNetworkOnline, setNetworkOffline } from './core/networkManager.js';

export {
    app, db, auth, storage,
    signInWithGoogle, signOut, forceRenewToken, getValidGoogleToken,
    getUserCol, getGroupCol, dbAPI, compressImage,
    setNetworkOnline, setNetworkOffline
};