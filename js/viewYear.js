//js/viewYear.js

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
// 👁️ 1. 연간 뷰어 모드 (기존 로직 유지)
// ==========================================================================
window.renderYearViewer = async function(container) {
  container.innerHTML = `<p style="text-align:center; padding: 40px; color:#64748b; font-weight:bold; font-size:var(--font-base);">⏳ 클라우드에서 연간 일정을 분석하여 불러오는 중...</p>`;

  if (!window.db) return;

  const y = window.currentDate.getFullYear();
  let html = `<div class="year-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px;">`;

  const eventSnap = await window.getUserCol('events')
      .where(firebase.firestore.FieldPath.documentId(), '>=', `${y}-01-01`)
      .where(firebase.firestore.FieldPath.documentId(), '<=', `${y}-12-31`)
      .get();
      
  const eventMap = {};
  eventSnap.forEach(doc => { eventMap[doc.id] = doc.data(); });

  for (let m = 0; m < 12; m++) {
    const lastDate = new Date(y, m + 1, 0).getDate();
    
    let monthHtml = `<div class="year-month-card" style="background:#fff; border:1px solid #cbd5e1; border-radius:8px; padding:15px; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
                        <h3 style="margin-top:0; color:#1e40af; border-bottom:2px solid #e2e8f0; padding-bottom:8px; text-align:center;">${m + 1}월</h3>
                        <div style="display:flex; flex-direction:column; gap:8px;">`;

    let hasEvents = false;
    for (let d = 1; d <= lastDate; d++) {
      const dateObj = new Date(y, m, d);
      const dayOfWeekNum = dateObj.getDay();
      
      if (!window.showWeekend && (dayOfWeekNum === 0 || dayOfWeekNum === 6)) continue;

      const dateStr = window.formatDate(dateObj);
      const eData = eventMap[dateStr];
      
      if (eData) {
        let events = eData.eventList || window.parseRawEventTextToEventList(eData.eventText || '');
        let validEvents = events.filter(e => e.content.trim() !== '');
        
        if (validEvents.length > 0) {
          hasEvents = true;
          let dayColor = '#334155';
          if (dayOfWeekNum === 0) dayColor = '#ef4444';
          else if (dayOfWeekNum === 6) dayColor = '#3b82f6';
          
          monthHtml += `<div class="year-event-item" style="display:flex; align-items:flex-start; gap:8px;
