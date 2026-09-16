// js/core/settings.js
import { store } from './store.js';
import { getEventLabels, invalidateLabelCache, markCloudLabelsChecked } from './utils.js';
import { getUserCol } from '../api/database.js';
import { doc, getDoc } from "firebase/firestore";

export const loadSettings = async () => { 
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
        if (labelDoc.exists()) {
            const data = labelDoc.data();
            if (data.eventLabels?.length > 0) localStorage.setItem('workCalendar_eventLabels_v4', JSON.stringify(data.eventLabels));
            if (data.journalLabels?.length > 0) localStorage.setItem('workCalendar_journalLabels_v4', JSON.stringify(data.journalLabels));
            if (data.memoLabels?.length > 0) localStorage.setItem('workCalendar_memoLabels', JSON.stringify(data.memoLabels));
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