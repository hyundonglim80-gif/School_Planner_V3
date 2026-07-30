// js/modules/recurring.js - 반복 일정 일괄 등록 모듈

const RecurringEventModule = {
  modalInstance: null,

  // 1. 모달 내부 HTML 구조 생성
  getContentHTML: function() {
    const labels = window.getEventLabels();
    const labelOptions = labels.map(l => `<option value="${l.name}">${l.name}</option>`).join('');

    return `
      <div class="modal-info-box">
        <h4 style="margin-top:0; margin-bottom:10px; color:#1e40af; border-bottom:1px solid #bfdbfe; padding-bottom:5px;">📌 1. 일정 정보 입력</h4>
        <div style="display:flex; gap:10px; align-items:center; margin-bottom:10px;">
          <span style="font-weight:bold; width:80px; color:#334155;">라벨 선택:</span>
          <select id="rec-label-select" style="padding:8px; border-radius:6px; border:1px solid #cbd5e1; outline:none; font-weight:bold; color:#1e40af; background:#fff; flex:1;">
            ${labelOptions}
          </select>
        </div>
        <div style="display:flex; gap:10px; align-items:center;">
          <span style="font-weight:bold; width:80px; color:#334155;">일정 내용:</span>
          <input type="text" id="rec-event-content" placeholder="예: 학년 협의회, 교통안전지도" class="modal-input-text" style="flex:1; padding:8px;">
        </div>
      </div>

      <div class="modal-info-box alt">
        <h4 style="margin-top:0; margin-bottom:10px; color:#1e40af; border-bottom:1px solid #bfdbfe; padding-bottom:5px;">🔄 2. 반복 조건 설정</h4>
        <div style="display:flex; gap:15px; margin-bottom:12px; align-items:center;">
          <span style="font-weight:bold; width:80px; color:#334155;">반복 주기:</span>
          <label style="cursor:pointer; font-weight:bold; color:#1e293b;">
            <input type="radio" name="rec-type" value="weekly" checked onchange="RecurringEventModule.toggleRecType('weekly')"> 매주 반복
          </label>
          <label style="cursor:pointer; font-weight:bold; color:#1e293b;">
            <input type="radio" name="rec-type" value="monthly" onchange="RecurringEventModule.toggleRecType('monthly')"> 매월 반복
          </label>
        </div>

        <div id="rec-weekly-options" style="display:flex; gap:10px; align-items:center; background:#fff; padding:10px; border-radius:6px; border:1px solid #cbd5e1;">
          <span style="font-weight:bold; color:#475569; font-size:0.9rem;">반복 요일:</span>
          <label><input type="checkbox" class="rec-day-check" value="1"> 월</label>
          <label><input type="checkbox" class="rec-day-check" value="2"> 화</label>
          <label><input type="checkbox" class="rec-day-check" value="3"> 수</label>
          <label><input type="checkbox" class="rec-day-check" value="4"> 목</label>
          <label><input type="checkbox" class="rec-day-check" value="5"> 금</label>
        </div>

        <div id="rec-monthly-options" style="display:none; flex-direction:column; gap:8px; background:#fff; padding:10px; border-radius:6px; border:1px solid #cbd5e1;">
          <div style="display:flex; align-items:center; gap:8px;">
            <input type="radio" name="rec-monthly-sub" id="rec-m-type-date" value="date" checked>
            <label for="rec-m-type-date" style="font-weight:bold; color:#334155;">특정 날짜:</label>
            <span>매월</span>
            <input type="number" id="rec-m-day" min="1" max="31" value="15" style="width:50px; padding:4px; border:1px solid #cbd5e1; border-radius:4px; text-align:center;">
            <span>일</span>
          </div>
        </div>
      </div>

      <div class="modal-info-box">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; border-bottom:1px solid #bfdbfe; padding-bottom:5px;">
          <h4 style="margin:0; color:#1e40af;">📅 3. 적용 기간 지정</h4>
          <div style="display:flex; gap:6px;">
            <button onclick="RecurringEventModule.setQuickRange('sem1')" style="padding:2px 8px; font-size:0.8rem; background:#dbeafe; color:#1e40af; border:1px solid #93c5fd; border-radius:4px; cursor:pointer; font-weight:bold;">1학기</button>
            <button onclick="RecurringEventModule.setQuickRange('sem2')" style="padding:2px 8px; font-size:0.8rem; background:#dbeafe; color:#1e40af; border:1px solid #93c5fd; border-radius:4px; cursor:pointer; font-weight:bold;">2학기</button>
            <button onclick="RecurringEventModule.setQuickRange('year')" style="padding:2px 8px; font-size:0.8rem; background:#e0e7ff; color:#3730a3; border:1px solid #a5b4fc; border-radius:4px; cursor:pointer; font-weight:bold;">전체 학년도</button>
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:10px;">
          <input type="date" id="rec-start-date" class="modal-input-text" style="flex:1; padding:8px;">
          <span style="font-weight:bold; color:#64748b;">~</span>
          <input type="date" id="rec-end-date" class="modal-input-text" style="flex:1; padding:8px;">
        </div>
        <div style="margin-top:10px;">
          <label style="cursor:pointer; font-size:0.88rem; color:#ef4444; font-weight:bold; display:flex; align-items:center; gap:4px;">
            <input type="checkbox" id="rec-skip-holidays" checked accent-color="#ef4444">
            🛡️ 휴일 및 수업삭제(행사/방학) 날짜는 자동으로 건너뛰기
          </label>
        </div>
      </div>

      <button onclick="RecurringEventModule.executeBatch()" class="search-execute-btn" style="background:#2563eb;">
        🚀 반복 일정 일괄 등록 실행
      </button>
    `;
  },

  open: function() {
    if (!this.modalInstance) {
      this.modalInstance = new window.Modal({
        id: 'recurring-event-modal',
        title: '🔄 반복 일정 일괄 등록',
        width: '520px',
        content: this.getContentHTML()
      });
    }
    this.modalInstance.open();
    this.setQuickRange('sem1'); // 기본적으로 1학기 기간 자동 세팅
  },

  toggleRecType: function(type) {
    const weeklyBox = document.getElementById('rec-weekly-options');
    const monthlyBox = document.getElementById('rec-monthly-options');
    if (type === 'weekly') {
      weeklyBox.style.display = 'flex';
      monthlyBox.style.display = 'none';
    } else {
      weeklyBox.style.display = 'none';
      monthlyBox.style.display = 'flex';
    }
  },

  // 퀵 버튼 클릭 시 날짜 자동 지정
  setQuickRange: function(type) {
    const y = window.currentDate.getFullYear();
    const m = window.currentDate.getMonth();
    const startYear = m <= 1 ? y - 1 : y;

    const startInput = document.getElementById('rec-start-date');
    const endInput = document.getElementById('rec-end-date');

    if (type === 'sem1') {
      startInput.value = `${startYear}-03-01`;
      endInput.value = `${startYear}-08-15`;
    } else if (type === 'sem2') {
      startInput.value = `${startYear}-08-16`;
      endInput.value = `${startYear + 1}-02-28`;
    } else if (type === 'year') {
      startInput.value = `${startYear}-03-01`;
      endInput.value = `${startYear + 1}-02-28`;
    }
  },

  // 일괄 등록 연산 처리
  executeBatch: async function() {
    const label = document.getElementById('rec-label-select').value;
    const content = document.getElementById('rec-event-content').value.trim();
    const startStr = document.getElementById('rec-start-date').value;
    const endStr = document.getElementById('rec-end-date').value;
    const skipHolidays = document.getElementById('rec-skip-holidays').checked;

    if (!content) return alert("일정 내용을 입력해주세요.");
    if (!startStr || !endStr) return alert("시작 날짜와 종료 날짜를 모두 선택해주세요.");

    const startDate = new Date(startStr);
    const endDate = new Date(endStr);
    if (startDate > endDate) return alert("시작 날짜가 종료 날짜보다 늦을 수 없습니다.");

    const recType = document.querySelector('input[name="rec-type"]:checked').value;

    // 대상 날짜 목록 추출
    const targetDates = [];
    let cur = new Date(startDate);

    if (recType === 'weekly') {
      const selectedDays = Array.from(document.querySelectorAll('.rec-day-check:checked')).map(cb => parseInt(cb.value, 10));
      if (selectedDays.length === 0) return alert("반복할 요일을 하나 이상 선택해주세요.");

      while (cur <= endDate) {
        if (selectedDays.includes(cur.getDay())) {
          targetDates.push(window.formatDate(cur));
        }
        cur.setDate(cur.getDate() + 1);
      }
    } else if (recType === 'monthly') {
      const targetDayNum = parseInt(document.getElementById('rec-m-day').value, 10);
      while (cur <= endDate) {
        if (cur.getDate() === targetDayNum) {
          targetDates.push(window.formatDate(cur));
        }
        cur.setDate(cur.getDate() + 1);
      }
    }

    if (targetDates.length === 0) return alert("조건에 해당하는 날짜가 지정한 기간 내에 없습니다.");

    if (!confirm(`총 ${targetDates.length}개의 날짜에 [${label}] "${content}" 일정을 일괄 등록하시겠습니까?`)) return;

    // 클라우드 데이터 일괄 연산 처리
    try {
      const eventSnap = await window.getUserCol('events').get();
      const existingEventsMap = {};
      eventSnap.forEach(doc => { existingEventsMap[doc.id] = doc.data(); });

      let batch = window.db.batch();
      let opCount = 0;
      let batchPromises = [];
      let addedCount = 0;
      let skippedCount = 0;

      for (const dateStr of targetDates) {
        const docData = existingEventsMap[dateStr] || {};
        let list = docData.eventList || [];
        if (list.length === 0 && docData.eventText) {
          list = window.parseRawEventTextToEventList(docData.eventText);
        }

        // 휴일/수업삭제 라벨 건너뛰기 검사
        if (skipHolidays) {
          const hasSkipLabel = list.some(ev => window.isSkipLabel(ev.label));
          if (hasSkipLabel) {
            skippedCount++;
            continue;
          }
        }

        // 중복 방지 (동일 라벨, 동일 내용이면 추가하지 않음)
        if (!list.some(ev => ev.label === label && ev.content === content)) {
          list.push({ label: label, content: content });
          const newText = window.formatEventListToText(list);

          const docRef = window.getUserCol('events').doc(dateStr);
          batch.set(docRef, { eventList: list, eventText: newText, updatedAt: Date.now() }, { merge: true });
          
          addedCount++;
          opCount++;

          if (opCount >= 400) {
            batchPromises.push(batch.commit());
            batch = window.db.batch();
            opCount = 0;
          }
        }
      }

      if (opCount > 0) batchPromises.push(batch.commit());
      await Promise.all(batchPromises);

      this.modalInstance.close();
      alert(`✅ 성공적으로 완료되었습니다!\n- 등록 완료: ${addedCount}건\n- 건너뜀(휴일/중복): ${skippedCount}건`);
      window.render(); // 화면 갱신
    } catch (e) {
      console.error("반복 일정 일괄 등록 오류:", e);
      alert("일정 등록 도중 오류가 발생했습니다.");
    }
  }
};

window.openRecurringEventModal = () => RecurringEventModule.open();
