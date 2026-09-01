// js/api/googleApi.js
export async function googleFetch(url, method, token, body = null) {
    const options = {
        method: method,
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
    };
    if (body) options.body = JSON.stringify(body);
    
    const response = await fetch(url, options);
    if (!response.ok) {
        const errData = await response.json();
        throw new Error(`API 에러 (${response.status}): ${errData.error?.message || '알 수 없는 오류'}`);
    }
    if (response.status === 204) return null;
    return await response.json();
}

export async function fetchAllGoogleEvents(token, calId, timeMin, timeMax, extraParams = {}) {
    let allEvents = [];
    let pageToken = '';
    do {
        const params = new URLSearchParams({
            timeMin: timeMin,
            timeMax: timeMax,
            singleEvents: 'true',
            orderBy: 'startTime',
            maxResults: '250',
        });
        for (const [key, value] of Object.entries(extraParams)) {
            params.append(key, value);
        }
        if (pageToken) params.append('pageToken', pageToken);

        const searchUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events?${params.toString()}`;
        try {
            const res = await googleFetch(searchUrl, 'GET', token);
            if (res && res.items) allEvents.push(...res.items);
            pageToken = res?.nextPageToken || '';
        } catch (e) {
            console.warn("구글 기존 데이터 스캔 실패:", e);
            break;
        }
    } while (pageToken);
    return allEvents;
}

export async function getOrCreateDedicatedCalendar(token) {
    const listUrl = "https://www.googleapis.com/calendar/v3/users/me/calendarList";
    const data = await googleFetch(listUrl, 'GET', token);
    
    let targetCal = data.items ? data.items.find(cal => cal.summary === 'School Planner') : null;
    if (targetCal) return targetCal.id;

    let oldCal = data.items ? data.items.find(cal => cal.summary.startsWith('School Planner V3')) : null;
    if (oldCal) {
        try {
            await googleFetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(oldCal.id)}`, 'PUT', token, {
                summary: 'School Planner',
                description: '업무 및 수업 계획표(웹)에서 동기화된 전용 캘린더입니다.',
                timeZone: 'Asia/Seoul'
            });
        } catch(e) {}
        return oldCal.id;
    }

    const createUrl = "https://www.googleapis.com/calendar/v3/calendars";
    const newCal = await googleFetch(createUrl, 'POST', token, {
        summary: 'School Planner',
        description: '업무 및 수업 계획표(웹)에서 스마트 동기화된 캘린더입니다.',
        timeZone: 'Asia/Seoul'
    });
    return newCal.id;
}