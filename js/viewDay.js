// js/viewDay.js

/**
 * 💡 현재 선택된 날짜 문자열(YYYY-MM-DD)을 구하는 동적 도우미 함수
 */
const CURRENT_DAY_STR = () => window.formatDate(window.currentDate);

// ==========================================================================
// 👁️ 1. 일간 뷰어 모드 (일정 + 교시 목록 + 하단 일지 뷰어)
// ==========================================================================
window.renderDayViewer = async function(container) {
  container.innerHTML = `<p style="text-align:center; padding: 40px; color:#64748b; font-weight:bold; font-size:var(--font-base);">⏳ 클라우드 데이터를 불러오는 중...</p>`;

  const dateStr = CURRENT_DAY_STR();
  // 🔥 Firestore에서 해당 일자 데이터 가져오기
  const dayData = await window.dbAPI.loadDayData(dateStr);
  const eventText = dayData.eventText || '일정 없음';
  const periods = dayData.periods || {};
  
  // 💡 일지(journals) 데이터를 데이터베이스에서 가져오기
  const journalDoc = await window.getUserCol('journals').doc(dateStr).get();
  const journals = journalDoc.exists ? journalDoc.data().entries || [] : [];

  let html = `
    <div class="day-viewer-container">
      <div class="day-event-card" style="display: flex; align-items: flex-start; padding: 16px; border: 1px solid #cbd5e1; border-left: 5px solid #2563eb; border-radius: 8px; margin-bottom: 16px; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
        <div style="width: 80px; font-weight: 700; font-size: 1.1rem; color: #1e40af; flex-shrink: 0;">📌 일정</div>
        <div style="font-size: 1.05rem; color: #334155; white-space: pre-wrap; line-height: 1.5; flex-grow: 1; padding-left:12px; border-left: 2px solid #e2e8f0;">${eventText}</div>
      </div>
      
      <div class="period-card-list">
  `;

  for (let p = 1; p <= 6; p++) {
    const pData = periods[p] || {};
    const subject = pData.subject || '';
    const supplies = pData.supplies || '';
    const memo = pData.memo || '';

    const memoHtml = memo.trim() !== '' 
        ? `<div class="period-memo" style="margin-top: 4px; font-size: 0.95rem; color: #475569;">📝 메모: ${memo}</div>` 
        : '';
        
    const suppliesHtml = supplies.trim() !== '' 
        ? `<div class="period-supplies" style="margin-top: 6px; font-size: 0.95rem;">🎒 준비물: ${supplies}</div>` 
        : '';

    html += `
      <div class="day-period-card" style="padding: 12px; border: 1px solid #cbd5e1; border-radius: 8px; margin-bottom: 10px; background: #fff;">
        <div class="period-title" style="font-weight: 700; font-size: 1.1rem; color: #1e3a8a;">${p}교시: ${subject}</div>
        ${memoHtml}
        ${suppliesHtml}
      </div>
    `;
  }
  
  html += `</div>`;

  // 💡 뷰어 화면 가장 아래에 '일지' 영역 출력
  if (journals.length > 0) {
    html += `<div class="day-journal-section" style="margin-top:20px;">
              <h3 style="font-size:1.2rem; color:#be185d; margin-bottom:10px;">📔 오늘의 일지</h3>`;
    journals.forEach(j => {
      html += `
        <div style="background:#fdf2f8; border:1px solid #f472b6; border-left:5px solid #be185d; border-radius:8px; padding:12px; margin-bottom:10px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
            <div style="font-weight:bold; color:#9d174d; margin-bottom:6px; font-size:1.05rem;">[${j.label}]</div>
            <div style="color:#831843; font-size:1.05rem; line-height:1.5; white-space:pre-wrap; word-break:break-all;">${j.content}</div>
        </div>`;
    });
    html += `</div>`;
  }

  html += `</div>`;
  container.innerHTML = html;
};

// ==========================================================================
// ✏️ 2. 일간 에디터 모드 (오늘 일정 + 1~6교시 표 편집 + 하단 일지 작성 모듈)
// ==========================================================================
window.renderDayEditor = async function(container) {
  container.innerHTML = `<p style="text-align:center; padding: 40px; color:#64748b; font-weight:bold; font-size:var(--font-base);">⏳ 편집 화면을 준비 중...</p>`;

  const dateStr = CURRENT_DAY_STR();
  const dayData = await window.dbAPI.loadDayData(dateStr);
  const eventText = dayData.eventText || '';
  const periods = dayData.periods || {};
  
  // 💡 일지 데이터 로드 (없으면 기본 1개 세팅)
  const journalDoc = await window.getUserCol('journals').doc(dateStr).get();
  const journals = journalDoc.exists ? journalDoc.data().entries || [] : [];
  window.currentJournals = journals.length > 0 ? journals : [{ label: '사건', content: '' }];

  let html = `
    <div class="day-viewer-container">
      <div class="daily-event-banner" style="background:#ffffff; border: 1px solid var(--border-color); border-left: 5px solid #2563eb; padding-bottom: 10px;">
        <h3 style="font-size: var(--day-title-font-size); color: #1e40af; margin-bottom: 8px;">📅 오늘 일정</h3>
        <div id="day-editor-event" class="editable-cell" contenteditable="true" style="background:#f8fafc; border:1px solid #cbd5e1; min-height: 40px; font-size: var(--day-content-font-size); padding: 6px;">${eventText}</div>
      </div>

      <div class="table-container">
        <table style="text-align: center;">
          <thead>
            <tr>
              <th style="width: 60px;">교시</th>
              <th style="width: 120px;">수업</th>
              <th>📝 메모</th>
              <th style="width: 25%;">🎒 준비물</th>
            </tr>
          </thead>
          <tbody>
  `;

  for (let p = 1; p <= 6; p++) {
    const pObj = periods[p] || {};
    html += `
            <tr data-period="${p}">
              <td class="period-cell">${p}</td>
              <td class="editable-cell cell-subject" contenteditable="true">${pObj.subject || ''}</td>
              <td class="editable-cell cell-memo" contenteditable="true" style="text-align: left;">${pObj.memo || ''}</td>
              <td class="editable-cell cell-supplies" contenteditable="true" style="color: #d97706; font-weight: 600; text-align: left;">${pObj.supplies || ''}</td>
            </tr>
    `;
  }
  html += `</tbody></table></div>`;

  // 💡 일지 에디터 영역 (동적으로 그려지는 껍데기)
  html += `
    <div class="day-journal-editor-section" style="margin-top: 20px; background: #fff; padding: 15px; border-radius: 8px; border: 1px solid #cbd5e1; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 15px;">
        <h3 style="font-size:1.2rem; color:#be185d; margin:0; font-weight:bold;">📔 오늘의 일지 기록</h3>
        <button onclick="manageJournalLabels()" style="background:#f1f5f9; border:1px solid #cbd5e1; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:0.9rem; color:#334155; font-weight:bold; transition:0.2s;">⚙️ 라벨 설정</button>
      </div>
      
      <div id="journal-entries-container"></div>
      
      <button onclick="addJournalEntry()" style="width:100%; padding:12px; margin-top:10px; background:#fdf2f8; color:#be185d; border:2px dashed #f472b6; border-radius:8px; cursor:pointer; font-weight:bold; font-size:1.05rem; transition:0.2s;">+ 새로운 일지 칸 추가</button>
    </div>
  </div>`;
  
  container.innerHTML = html;
  
  // HTML이 화면에 그려진 후 동적 일지 칸 렌더링
  setTimeout(() => window.renderJournalEntries(), 0);
};

// ==========================================================================
// ⚙️ 일지 전용 동적 렌더링 및 조작 툴박스
// ==========================================================================

// 일지 칸 화면 그리기
window.renderJournalEntries = function() {
    const container = document.getElementById('journal-entries-container');
    if(!container) return;
    
    // 로컬스토리지에서 라벨 리스트를 가져오거나 기본값 적용
    let labels = JSON.parse(localStorage.getItem('workCalendar_journalLabels')) || ['참고', '사건', '감상', '기타'];
    
    let html = '';
    window.currentJournals.forEach((j, index) => {
        let options = labels.map(l => `<option value="${l}" ${j.label === l ? 'selected' : ''}>${l}</option>`).join('');
        // 💡 textarea에 oninput 이벤트를 걸어 글씨를 쓸 때마다 쫙쫙 늘어나도록 설정
        html += `
        <div class="journal-entry-block" data-index="${index}" style="display:flex; gap:10px; margin-bottom:12px; align-items:flex-start;">
            <select class="journal-label-select" style="padding:10px; border-radius:6px; border:1px solid #cbd5e1; outline:none; font-size:1rem; width:100px; flex-shrink:0; font-weight:bold; color:#be185d; background:#fdf2f8;">
                ${options}
            </select>
            <textarea class="journal-content-input" placeholder="이곳에 사건이나 감상 등을 편하게 작성하세요. 줄이 길어지면 칸이 자동으로 늘어납니다!" style="flex-grow:1; padding:10px 12px; border-radius:6px; border:1px solid #cbd5e1; outline:none; font-size:1.05rem; resize:none; overflow:hidden; min-height:45px; background:#f8fafc;" oninput="this.style.height=''; this.style.height = this.scrollHeight + 'px'">${j.content}</textarea>
            <button onclick="removeJournalEntry(${index})" style="background:#fee2e2; border:1px solid #fca5a5; color:#ef4444; font-size:1.2rem; cursor:pointer; padding:6px 10px; border-radius:6px; transition:0.2s;" title="삭제">✖</button>
        </div>
        `;
    });
    container.innerHTML = html;
    
    // 그려진 직후 높이 동기화
    setTimeout(() => {
        container.querySelectorAll('.journal-content-input').forEach(ta => {
            ta.style.height = ta.scrollHeight + 'px';
        });
    }, 0);
};

// 화면의 입력값들을 배열에 묶기
window.syncJournalInputs = function() {
    const blocks = document.querySelectorAll('.journal-entry-block');
    blocks.forEach((block, idx) => {
        const label = block.querySelector('.journal-label-select').value;
        const content = block.querySelector('.journal-content-input').value;
        if(window.currentJournals[idx]) {
            window.currentJournals[idx].label = label;
            window.currentJournals[idx].content = content;
        }
    });
};

// 일지 칸 추가
window.addJournalEntry = function() {
    window.syncJournalInputs();
    window.currentJournals.push({ label: '사건', content: '' });
    window.renderJournalEntries();
};

// 일지 칸 삭제
window.removeJournalEntry = function(index) {
    if(confirm('이 일지를 삭제하시겠습니까?')) {
        window.syncJournalInputs();
        window.currentJournals.splice(index, 1);
        window.renderJournalEntries();
    }
};

// 라벨(분류) 설정 관리
window.manageJournalLabels = function() {
    let labels = JSON.parse(localStorage.getItem('workCalendar_journalLabels')) || ['참고', '사건', '감상', '기타'];
    let currentStr = labels.join(', ');
    let result = prompt("💡 일지의 종류(라벨)를 쉼표(,)로 구분하여 입력해주세요.\n(예: 사건, 감상, 학부모 상담, 학생 지도)", currentStr);
    
    if(result !== null) {
        let newLabels = result.split(',').map(s => s.trim()).filter(s => s !== '');
        if(newLabels.length > 0) {
            localStorage.setItem('workCalendar_journalLabels', JSON.stringify(newLabels));
            window.syncJournalInputs();
            window.renderJournalEntries(); // 화면 즉시 업데이트
        }
    }
};

// ==========================================================================
// 💾 3. 일간 저장 처리 함수 (일지 저장 기능 완벽 통합)
// ==========================================================================
window.saveDayDataFromEditor = async function() {
  const dateStr = CURRENT_DAY_STR();
  const eventEl = document.getElementById("day-editor-event");
  const eventText = eventEl ? (eventEl.innerText || eventEl.textContent || '').trim() : '';

  // 1) 전체 일정 저장
  await window.dbAPI.saveEvent(dateStr, eventText);

  // 💡 [B방식 적용] 일정에 '(휴일)' 또는 '(행사)' 포함 여부 검사
  const isSkipDay = eventText.includes('(휴일)') || eventText.includes('(행사)');

  // 2) 교시별 상세 수업 정보 저장
  const periodsData = {};
  const rows = document.querySelectorAll("tr[data-period]");
  
  rows.forEach(row => {
    const p = row.getAttribute("data-period");
    
    const subjectEl = row.querySelector(".cell-subject");
    const memoEl = row.querySelector(".cell-memo");
    const suppliesEl = row.querySelector(".cell-supplies");

    let subject = subjectEl ? (subjectEl.innerText || subjectEl.textContent || '').trim() : '';
    const memo = memoEl ? (memoEl.innerText || memoEl.textContent || '').trim() : '';
    const supplies = suppliesEl ? (suppliesEl.innerText || suppliesEl.textContent || '').trim() : '';

    if (isSkipDay) {
      subject = '';
    }

    periodsData[p] = { subject, memo, supplies };
  });

  await window.dbAPI.saveSchedule(dateStr, periodsData);
  
  // 3) 💡 추가된 일지 데이터 저장 로직
  window.syncJournalInputs();
  // 내용이 한 글자라도 작성된 유효한 일지 칸만 필터링하여 저장
  const validJournals = window.currentJournals.filter(j => j.content.trim() !== '');
  await window.getUserCol('journals').doc(dateStr).set({ entries: validJournals, updatedAt: Date.now() });
};
