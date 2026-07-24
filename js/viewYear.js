// js/viewYear.js
window.renderYearViewer = function(container) {
  let html = `<div class="year-grid">${["3월","4월","5월","6월","7월","8월","9월","10월","11월","12월","1월","2월"].map(m=>`<div class="mini-month"><h3>${m}</h3><p style="font-size:0.8rem;">${m==='7월'?'여름방학':'일정'}</p></div>`).join('')}</div>`;
  container.innerHTML = html;
}

window.renderYearEditor = function(container) {
  let html = `<div class="table-container"><table><thead><tr><th style="width:90px;">월</th><th style="width:40%;">주요 학사 행사</th><th>비고</th></tr></thead><tbody>${[3,4,5,6,7,8,9,10,11,12,1,2].map(m=>`<tr><td style="text-align:center; font-weight:bold;">${m}월</td><td class="editable-cell" contenteditable="true"></td><td class="editable-cell" contenteditable="true"></td></tr>`).join('')}</tbody></table></div>`;
  container.innerHTML = html;
}
