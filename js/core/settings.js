// js/core/settings.js
import { store } from './store.js';
import { getEventLabels } from './utils.js';
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

        const labelDoc = await getDoc(doc(getUserCol('settings'), 'labels')); 
        if (labelDoc.exists()) { 
            const data = labelDoc.data();
            if (data.eventLabels?.length > 0) localStorage.setItem('workCalendar_eventLabels_v4', JSON.stringify(data.eventLabels));
            if (data.journalLabels?.length > 0) localStorage.setItem('workCalendar_journalLabels_v4', JSON.stringify(data.journalLabels));
            if (data.memoLabels?.length > 0) localStorage.setItem('workCalendar_memoLabels', JSON.stringify(data.memoLabels));
        }

        getEventLabels();
        if (window.getJournalLabels) window.getJournalLabels();
    } catch (error) { console.warn("설정 로드 에러(오프라인 시 정상):", error); }
};