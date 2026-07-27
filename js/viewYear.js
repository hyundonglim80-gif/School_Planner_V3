// ==========================================================================
// 💾 3. 연간 편집 저장 처리 함수 (덮어쓰기 방지 보호 로직 적용)
// ==========================================================================
window.saveYearDataFromEditor = async function() {
  const rows = document.querySelectorAll("tr[data-year-date]");
  for (const row of rows) {
    const dateStr = row.getAttribute("data-year-date");
    
    const nextRow = row.nextElementSibling;
    const eventCell = nextRow ? nextRow.querySelector(".edit-event-cell") : null;
    const eventText = eventCell ? (eventCell.innerText || eventCell.textContent || "").trim() : "";
    const isSkipDay = eventText.includes('(휴일)') || eventText.includes('(행사)');

    // 🚨 [핵심 수정] 기존 데이터 보호
    let existingPeriods = {};
    try {
      const existingData = await window.dbAPI.loadDayData(dateStr);
      existingPeriods = existingData.periods || {};
    } catch(e) {}

    const classCells = row.querySelectorAll(".edit-class-cell");
    const periodsData = {};
    
    classCells.forEach(cell => {
       const p = cell.getAttribute("data-p");
       const subjRaw = (cell.innerText || cell.textContent || "").trim();
       let subjText = (subjRaw.toUpperCase() === 'X' || subjRaw === '') ? '' : subjRaw;

       if (isSkipDay) subjText = '';

       periodsData[p] = {
          subject: subjText,
          supplies: existingPeriods[p] ? existingPeriods[p].supplies : '',
          memo: existingPeriods[p] ? existingPeriods[p].memo : ''
       };
    });

    await window.dbAPI.saveEvent(dateStr, eventText);
    await window.dbAPI.saveSchedule(dateStr, periodsData);
  }
};
