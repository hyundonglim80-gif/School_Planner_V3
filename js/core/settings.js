// js/core/settings.js
import { store } from './store.js';
import { getEventLabels, invalidateLabelCache, markCloudLabelsChecked } from './utils.js';
import { getUserCol } from '../api/database.js';
import { doc, getDoc, getDocFromServer, setDoc } from "firebase/firestore";
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
        // ⚠️ getDoc은 서버에 못 닿으면 조용히 이 기기 캐시 값을 돌려준다.
        //    그걸 '클라우드에 있다'고 받아들이면, 서버에는 없는데 있다고 믿고
        //    올리기를 건너뛴다. 그러면 라벨은 영영 이 기기에만 남고, 기기를
        //    비우는 순간 사라진다. 실제로 그렇게 됐다.
        //    서버에 직접 물어 '서버가 정말 뭐라고 하는지'와 '화면에 쓸 값'을 나눈다.
        const labelsRef = doc(getUserCol('settings'), 'labels');

        // 서버가 실제로 뭐라고 하는지 (못 닿았으면 null)
        let serverSaid = null;
        try {
            const fromServer = await getDocFromServer(labelsRef);
            serverSaid = fromServer.exists() ? fromServer.data() : {};
        } catch (e) {
            console.warn('[SP3] 서버에서 라벨을 못 읽었습니다.', e);
        }

        // 이 기기가 갖고 있는 것 (캐시에 남아 있을 수 있다)
        let cached = {};
        try {
            const c = await getDoc(labelsRef);
            if (c.exists()) cached = c.data();
        } catch { /* 없으면 없는 대로 */ }

        const pickArr = (...cands) => cands.find((a) => Array.isArray(a) && a.length > 0) || null;
        const localEv = JSON.parse(localStorage.getItem('workCalendar_eventLabels_v4') || 'null');
        const localJr = JSON.parse(localStorage.getItem('workCalendar_journalLabels_v4') || 'null');
        const localMm = JSON.parse(localStorage.getItem('workCalendar_memoLabels') || 'null');

        // 서버 것이 있으면 그것이 원본이다. 없으면 이 기기에 남은 것으로 버틴다.
        const useEv = pickArr(serverSaid?.eventLabels, cached.eventLabels, localEv);
        const useJr = pickArr(serverSaid?.journalLabels, cached.journalLabels, localJr);
        const useMm = pickArr(serverSaid?.memoLabels, cached.memoLabels, localMm);
        if (useEv) localStorage.setItem('workCalendar_eventLabels_v4', JSON.stringify(useEv));
        if (useJr) localStorage.setItem('workCalendar_journalLabels_v4', JSON.stringify(useJr));
        if (useMm) localStorage.setItem('workCalendar_memoLabels', JSON.stringify(useMm));

        // ⚠️ 서버가 '없다'고 분명히 답했는데 이 기기에는 있으면 올린다.
        //    예전에는 getDoc 하나로만 봤는데, getDoc은 서버에 못 닿으면 조용히
        //    이 기기 캐시를 돌려준다. 그걸 '클라우드에 있다'로 받아들여 올리기를
        //    건너뛰었고, 라벨은 영영 이 기기에만 남았다. 기기를 비우면 사라진다.
        //    서버에 못 닿았을 때(serverSaid === null)는 올리지 않는다. 무엇이
        //    최신인지 모르는 채로 쓰면 남의 것을 덮어쓸 수 있다.
        if (serverSaid) {
            const pushUp = {};
            if (!(serverSaid.eventLabels?.length > 0) && useEv) pushUp.eventLabels = useEv;
            if (!(serverSaid.journalLabels?.length > 0) && useJr) pushUp.journalLabels = useJr;
            if (!(serverSaid.memoLabels?.length > 0) && useMm) pushUp.memoLabels = useMm;
            if (Object.keys(pushUp).length > 0) {
                pushUp.updatedAt = Date.now();
                try {
                    await setDoc(labelsRef, pushUp, { merge: true });
                    console.log('[SP3] 이 기기에만 있던 라벨을 서버에 올렸습니다:', Object.keys(pushUp));
                } catch (e) {
                    console.error('[SP3] 라벨을 서버에 올리지 못했습니다:', e);
                }
            }
        }

        // 로그인 전에 이미 기본값을 만들어 캐시에 담아 두었을 수 있다.
        // 클라우드 값으로 localStorage를 채웠으니 캐시를 버리고 다시 읽게 한다.
        invalidateLabelCache();
        markCloudLabelsChecked();

        // 라벨을 결국 어디서 얻었는지 남긴다. V4와 견주어 어긋난 곳을 찾는다.
        const finalLabels = getEventLabels();
        const source = serverSaid === null
            ? '이 기기 (서버에 못 닿음)'
            : (serverSaid.eventLabels?.length > 0)
            ? '서버'
            : useEv ? '이 기기 -> 서버로 올림' : '기본값(새로 만듦)';
        console.log(`[SP3] 라벨 출처: ${source} / ${finalLabels.length}개 — ${finalLabels.map(l => l.name).join(', ')}`);
        if (window.getJournalLabels) window.getJournalLabels();
    } catch (error) {
        // 못 읽었으면 클라우드에 쓰지 않는다. 화면에는 기본값이 보이더라도
        // 선생님의 라벨 정의를 덮어쓰는 것보다는 낫다.
        console.warn("라벨 로드 실패 - 이번 접속에서는 라벨을 클라우드에 쓰지 않습니다:", error);
    }
};