// js/core/settings.js
import { store } from './store.js';
import { getEventLabels, invalidateLabelCache, markCloudLabelsChecked } from './utils.js';
import { getUserCol } from '../api/database.js';
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth } from '../api/firebaseInit.js';

export const loadSettings = async () => {
    // V3와 V4는 Firebase 앱 이름이 달라 로그인 세션을 따로 갖는다. 계정 주소가
    // 같아도 uid가 다르면 서로 다른 문서를 보게 되고, 한쪽에서 저장한 라벨이
    // 다른 쪽에는 '없는' 것이 된다. 두 앱에서 이 값을 견줄 수 있게 찍어 둔다.
    try {
        const u = auth?.currentUser;
        console.log(`[SP3] 로그인 계정: ${u?.email} / uid: ${u?.uid}`);
    } catch (e) { /* 무시 */ }

    try { 
        const docSnap = await getDoc(doc(getUserCol('settings'), 'preferences')); 
        if (docSnap.exists()) { 
            const data = docSnap.data();
            store.dDayList = data.dDayList || [];
            store.selectedDDayId = data.selectedDDayId || null;
            if (window.updateDdayUI) window.updateDdayUI();
        } else {
            store.dDayList = [];
            store.selectedDDayId = null;
        }

        const ttDoc = await getDoc(doc(getUserCol('settings'), 'timetable_v5'));
        if (ttDoc.exists()) {
            const ttData = ttDoc.data();
            store.semesterConfig = ttData.semesterConfig || {};
            store.timetableTemplates = ttData.templates || {};
            store.periodNames = ttData.currentNames || ["1", "2", "3", "4", "5", "6"];
        } else {
            if (docSnap.exists() && docSnap.data().periodNames) store.periodNames = docSnap.data().periodNames;
        }

    } catch (error) { console.warn("설정 로드 에러(오프라인 시 정상):", error); }

    // ⚠️ 라벨은 따로 감싼다.
    //    위쪽 읽기가 한 번 실패하면 여기까지 건너뛰는데, 그러면 localStorage가 빈 채로
    //    화면이 그려지고 getEventLabels()가 기본 라벨을 만들어 클라우드에 써 버린다.
    //    (사용기록을 지운 직후가 정확히 그 상태다)
    //    클라우드를 읽어 본 뒤에만 '클라우드에 써도 된다'고 표시한다.
    try {
        const labelDoc = await getDoc(doc(getUserCol('settings'), 'labels'));
        const cloud = labelDoc.exists() ? labelDoc.data() : {};

        // 클라우드가 원본이다. 있으면 이 기기 값을 거기에 맞춘다.
        if (cloud.eventLabels?.length > 0) localStorage.setItem('workCalendar_eventLabels_v4', JSON.stringify(cloud.eventLabels));
        if (cloud.journalLabels?.length > 0) localStorage.setItem('workCalendar_journalLabels_v4', JSON.stringify(cloud.journalLabels));
        if (cloud.memoLabels?.length > 0) localStorage.setItem('workCalendar_memoLabels', JSON.stringify(cloud.memoLabels));

        // ⚠️ 클라우드에 없고 이 기기에만 있으면 올려 둔다.
        //
        // 여기가 비어 있었다. V3는 라벨을 localStorage에 두고 클라우드에는
        // '바뀔 때만' 썼다. 그래서 바뀐 적이 없으면 클라우드 문서가 영영 안 생긴다.
        // 그 상태로 사용기록을 지우면 라벨 정의가 통째로 사라진다. 일정은 라벨을
        // id(lbl_ev_...)로 들고 있어서, 대응표가 없으면 이름을 알 길이 없다.
        // V4도 같은 문서를 보므로, 여기를 채워야 두 앱이 한 곳을 보게 된다.
        const pushUp = {};
        const localEv = JSON.parse(localStorage.getItem('workCalendar_eventLabels_v4') || 'null');
        const localJr = JSON.parse(localStorage.getItem('workCalendar_journalLabels_v4') || 'null');
        const localMm = JSON.parse(localStorage.getItem('workCalendar_memoLabels') || 'null');
        if (!(cloud.eventLabels?.length > 0) && Array.isArray(localEv) && localEv.length > 0) pushUp.eventLabels = localEv;
        if (!(cloud.journalLabels?.length > 0) && Array.isArray(localJr) && localJr.length > 0) pushUp.journalLabels = localJr;
        if (!(cloud.memoLabels?.length > 0) && Array.isArray(localMm) && localMm.length > 0) pushUp.memoLabels = localMm;
        if (Object.keys(pushUp).length > 0) {
            pushUp.updatedAt = Date.now();
            try {
                await setDoc(doc(getUserCol('settings'), 'labels'), pushUp, { merge: true });
                console.log('[SP3] 이 기기에만 있던 라벨을 공용 저장소에 올렸습니다:', Object.keys(pushUp));
            } catch (e) {
                console.error('라벨을 공용 저장소에 올리지 못했습니다:', e);
            }
        }

        // 로그인 전에 이미 기본값을 만들어 캐시에 담아 두었을 수 있다.
        // 클라우드 값으로 localStorage를 채웠으니 캐시를 버리고 다시 읽게 한다.
        invalidateLabelCache();
        markCloudLabelsChecked();

        getEventLabels();
        if (window.getJournalLabels) window.getJournalLabels();
    } catch (error) {
        // 못 읽었으면 클라우드에 쓰지 않는다. 화면에는 기본값이 보이더라도
        // 선생님의 라벨 정의를 덮어쓰는 것보다는 낫다.
        console.warn("라벨 로드 실패 - 이번 접속에서는 라벨을 클라우드에 쓰지 않습니다:", error);
    }
};