//js/viewMonth.js

if (!window.goToDay) {
  window.goToDay = function(dateStr) {
    if (!dateStr) return;
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      window.currentDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      window.setScope('day');
    }
  };
}

// ==========================================================================
// 👁️ 1. 월간 뷰어 모드
// ==========================================================================
window.renderMonthViewer = async function(container) {
  container.innerHTML = `<p style="text-align:center; padding: 40px; color:#64748b; font-weight:bold; font-size:var(--font-base);">⏳ 클라우드에서 월간 일정을 불러오는 중...</p>`;

  if (!window.db) return;

  let html = `<div class="calendar-grid" style="grid-template-columns: repeat(${window.showWeekend ? 7 : 5}, 1fr);">`;
  
  const days = window.showWeekend ? ['일','월','화','수','목','금','토'] : ['월','화','수','목','금'];
  days.forEach(d => {
    let colorStyle = '';
    if (d === '일') colorStyle = 'color:#ef4444;';
    else if (d === '토') colorStyle = 'color:#3b82f6;';
    html += `<div class="calendar-header" style="${colorStyle}">${d}</div>`;
  });

  const y = window.currentDate.getFullYear();
  const m = window.currentDate.getMonth();
  const firstDay = new Date(y, m, 1).getDay();
  const lastDate = new Date(y, m + 1, 0).getDate();

  let currentDay = 1;
  let row = 0;
  const todayStr = window.formatDate(new Date());

  const dayDataPromises = [];
  for (let i = 1; i <= lastDate; i++) {
      dayDataPromises.push(window.dbAPI.loadDayData(window.formatDate(new Date(y, m, i))));
  }
  const monthDataArray = await Promise.all(dayDataPromises);

  const eventSnap = await window.getUserCol('events')
      .where(firebase.firestore.FieldPath.documentId(), '>=', window.formatDate(new Date(y, m, 1)))
      .where(firebase.firestore.FieldPath.documentId(), '<=', window.formatDate(new Date(y, m, lastDate)))
      .get();
      
  const eventMap = {};
  eventSnap.forEach(doc => { eventMap[doc.id] = doc.data(); });

  while (currentDay <= lastDate) {
    for (let i = 0; i < 7; i++) {
      if (!window.showWeekend && (i === 0 || i === 6)) {
        if (row === 0 && i < firstDay) {}
        else if (currentDay <= lastDate) { currentDay++; }
        continue;
      }

      if (row === 0 && i < firstDay) {
        html += `<div class="calendar-cell empty-cell"></div>`;
      } else if (currentDay > lastDate) {
        html += `<div class="calendar-cell empty-cell"></div>`;
      } else {
        const dateObj = new Date(y, m, currentDay);
        const dateStr = window.formatDate(dateObj);
        const isToday = (dateStr === todayStr);
        const todayClass = isToday ? 'month-today-cell' : '';

        let dateColor = '#334155';
        if (i === 0) dateColor = '#ef4444';
        else if (i === 6) dateColor = '#3b82f6';

        let dayHtml = `<div class="calendar-cell ${todayClass}" onclick="window.goToDay('${dateStr}')" style="cursor:pointer; display:flex; flex-direction:column;">`;
        dayHtml += `<div class="month-date-number" style="color:${dateColor};">${currentDay}</div>`;

        const eData = eventMap[dateStr];
        if (eData) {
            let events = eData.eventList || window.parseRawEventTextToEventList(eData.eventText || '');
            if (events.length > 0) {
                dayHtml += `<div class="month-events-wrapper">`;
                events.forEach(e => {
                    if (e.content.trim() !== '') {
                        const isSkip = window.isSkipLabel(e.label);
                        const bg = isSkip ?
