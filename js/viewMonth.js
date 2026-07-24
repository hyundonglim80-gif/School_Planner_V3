// js/viewMonth.js
window.renderMonthViewer = function(container) {
  let html = `<div class="calendar-grid">${['일','월','화','수','목','금','토'].map(d=>`<div class="cal-header">${d}</div>`).join('')}<div class="cal-day" style="background:#f8fafc;"></div><div class="cal-day" style="background:#f8fafc;"></div><div class="cal-day" style="background:#f8fafc;"></div>${Array.from({length:31}, (_,i)=>i+1).map(day=>`<div class="cal-day"><div class="day-num">${day}</div>${day===24?'<div class="cal-event" style="background:#fef3c7; color:#d97706;">🏖️ 방학식</div>':''}</div>`).join('')}</div>`;
  container.innerHTML = html;
}

window.renderMonthEditor = function(container) {
  let html = `<div class="table-container"><table><thead><tr><th style="width:70px;">일자</th><th style="width:65px;">요일</th><th>학사일정</th></tr></thead><tbody>${Array.from({length:31}, (_,i)=>`<tr><td style="text-align:center;">7월 ${i+1}일</td><td style="text-align:center;">-</td><td class="editable-cell" contenteditable="true"></td></tr>`).join('')}</tbody></table></div>`;
  container.innerHTML = html;
}
