// js/modules/recurring.js

import { formatDate, parseLocalDate, getSemesterDates, isSkipLabel } from '../core/utils.js';
import { formatEventListToText, parseRawEventTextToEventList } from '../core/eventUtils.js'; 
import { getUserCol } from '../firebase.js';

export const RecurringEventModule = {
  modalInstance: null,
  currentCallback: null,
  currentLabelName: '',
  currentContent: '',
  currentStartDate: '',

  getContentHTML: function() {
    let monthDayCheckboxes = '';
    for (let d = 1; d <= 31; d++) {
        monthDayCheckboxes += `
          <label style="display:inline-flex; align-items:center; gap:2px; font-size:0.85rem; width:48px; cursor:pointer;">
            <input type="checkbox" class="rec-month-day-check" value="${d}"> ${d}일
          </label>
        `;
    }

    return `
      <div class="modal-info-box" style="margin-top:0; background:#f8fafc; border-left-color:#2563eb;">
        <div style="display:flex; gap:10px; align-items:center;">
          <span style="font-weight:bold; width:80px; color:#1e40af; font-size:0.95rem;">일정 내용:</span>
          <input type="text" id="rec-event-content" value="${this.currentContent}" placeholder="예: 학년 협의회, 부장 회의, 안전점검" class="modal-input-text" style="flex:1; padding:8px; border:1px solid #cbd5e1; border-radius:6px; font-size:0.95rem;">
        </div>
      </div>

      <div class="modal-info-box alt">
        <h4 style="margin-top:0; margin-bottom:10px; color:#16a34a; border-bottom:1px solid #bbf7d0; padding-bottom:5px;">🔄 1. 반복 조건 설정</h4>
        <div style="display:flex; gap:15px; margin-bottom:12px; align-items:center; flex-wrap:wrap;">
          <span style="font-weight:bold; width:80px; color:#334155;">반복 주기:</span>
          <label style="cursor:pointer; font-weight:bold; color:#1e293b;">
            <input type="radio" name="rec-type" value="weekly" checked onchange="RecurringEventModule.toggleRecType('weekly')"> 매주
          </label>
          <label style="cursor:pointer; font-weight:bold; color:#1e293b;">
            <input type="radio" name="rec-type" value="biweekly" onchange="RecurringEventModule.toggleRecType('weekly')"> 격주 (2주 마다)
          </label>
          <label style="cursor:pointer; font-weight:bold; color:#1e293b;">
            <input type="radio" name="rec-type" value="monthly" onchange="RecurringEventModule.toggleRecType('monthly')"> 매월 (날짜 여러 개)
          </label>
        </div>

        <div id="rec-weekly-options" style="display:flex; gap:12px; align-items:center; background:#fff; padding:10px; border-radius:6px; border:1px solid #cbd5e1;">
          <span style="font-weight:bold; color:#475569; font-size:0.9rem;">반복 요일:</span>
          <label style="cursor:pointer;"><input type="checkbox" class="rec-day-check" value="1"> 월</label>
          <label style="cursor:pointer;"><input type="checkbox" class="rec-day-check" value="2"> 화</label>
          <label style="cursor:pointer;"><input type="checkbox" class="rec-day-check" value="3"> 수</label>
          <label style="cursor:pointer;"><input type="checkbox" class="rec-day-check" value="4"> 목</label>
          <label style="cursor:pointer;"><input type="checkbox" class="rec-day-check" value="5"> 금</label>
        </div>

        <div id="rec-monthly-options" style="display:none; flex-direction:column; gap:10px; background:#fff; padding:12px; border-radius:6px; border:1px solid #cbd5e1;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-weight:bold; color:#475569; font-size:0.9rem;">매월 반복할 날짜 선택 (다중 선택 가능):</span>
            <div style="display:flex; gap:4px;">
              <button onclick="RecurringEventModule.selectMonthDays([1, 15])" style="font-size:0.75rem; padding:2px 6px; background:#f1f5f9; border:1px solid #cbd5e1; border-radius:4px; cursor:pointer;">1일,15일</button>
              <button onclick="RecurringEventModule.selectMonthDays([1, 10, 20])" style="font-size:0.75rem; padding:2px 6px; background:#f1f5f9; border:1px solid #cbd5e1; border-radius:4px; cursor:pointer;">10일 간격</button>
              <button onclick="RecurringEventModule.selectMonthDays([])" style="font-size:0.75rem; padding:2px 6px; background:#fee2e2; color:#ef4444; border:1px solid #fca5a5; border-radius:4px; cursor:pointer;">초기화</button>
            </div>
          </div>
          <div style="display:flex; flex-wrap:wrap; gap:6px 10px; max-height:120px; overflow-y:auto; padding:4px;">
               ${monthDayCheckboxes}
          </div>
        </div>
      </div>

      <div class="modal-info-box">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; border-bottom:1px solid #bfdbfe; padding-bottom:5px;">
          <h4 style="margin:0; color:#1e40af;">📅 2. 적용 기간 지정</h4>
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

      <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:15px;">
        <button id="btn-recur-cancel" class="modal-btn-secondary" style="background:#f1f5f9; color:#475569; border:1px solid #cbd5e1; font-weight:bold;">취소</button>
        <button id="btn-recur-execute" class="modal-btn-primary" style="background:#16a34a; border-color:#15803d; font-weight:bold;">🚀 반복 일정 등록</button>
      </div>
    `;
  },

  open: async function(startDateStr, labelName, textContent, callback) {
    this.currentLabelName = labelName || '';
    this.currentContent = textContent || '';
    this.currentStartDate = startDateStr || formatDate(new Date());
    this.currentCallback = callback;

    const existingModal = document.getElementById('recurring-event-modal');
    if (existingModal) existingModal.remove();

    const displayTitle = `🔁 [${this.currentLabelName}] 반복 일정 등록`;

    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
    <div id="recurring-event-modal" class="modal-overlay" style="display:flex; position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.5); z-index:10005; justify-content:center; align-items:center;">
        <div class="modal-content" style="width:540px; padding:25px; background:#fff; border-radius:12px; box-shadow:0 10px 25px rgba(0,0,0,0.2);">
            <h3 style="margin-top:0; color:#16a34a; border-bottom:2px solid #bbf7d0; padding-bottom:10px;">${displayTitle}</h3>
            ${this.getContentHTML()}
        </div>
    </div>`;
    document.body.appendChild(wrapper.firstElementChild);

    document.getElementById('btn-recur-cancel').onclick = () => this.cancel();
    document.getElementById('btn-recur-execute').onclick = () => this.executeBatch();

    document.getElementById('recurring-event-modal').addEventListener('click', (e) => {
        if(e.target.id === 'recurring-event-modal') this.cancel();
    });

    document.getElementById('rec-start-date').value = this.currentStartDate;
    
    const startD = parseLocalDate(this.currentStartDate);
    const dayOfWeek = startD.getDay();
    if(dayOfWeek >= 1 && dayOfWeek <= 5) {
        const cb = document.querySelector(`.rec-day-check[value="${dayOfWeek}"]`);
        if(cb) cb.checked = true;
    }

    if (window.loadGlobalPreferences) await window.loadGlobalPreferences();
    this.setQuickRange('sem1');
  },

  cancel: function() {
    const modal = document.getElementById('recurring-event-modal');
    if(modal) modal.remove();
    if (this.currentCallback) this.currentCallback(false);
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

  selectMonthDays: function(daysArr) {
    const checkboxes = document.querySelectorAll('.rec-month-day-check');
    checkboxes.forEach(cb => {
      cb.checked = daysArr.includes(parseInt(cb.value, 10));
    });
  },

  setQuickRange: function(type) {
    const dates = getSemesterDates();
    const startInput = document.getElementById('rec-start-date');
    const endInput = document.getElementById('rec-end-date');

    if (!window.semesterConfig || !window.semesterConfig.sem1Start) {
        alert("💡 팁: '더보기 > 기준 시간표 관리'에서 학사일정(학기 날짜)을 먼저 저장하시면, 이 버튼을 통해 날짜를 자동으로 불러올 수 있습니다!");
    }

    if (type === 'sem1') {
      startInput.value = dates.sem1Start || '';
      endInput.value = dates.sem1End || '';
    } else if (type === 'sem2') {
      startInput.value = dates.sem2Start || '';
      endInput.value = dates.sem2End || '';
    } else if (type === 'year') {
      startInput.value = dates.yearStart || '';
      endInput.value = dates.yearEnd || '';
    }
  },

  executeBatch: async function() {
    const label = this.currentLabelName;
    const contentInput = document.getElementById('rec-event-content');
    const content = contentInput ? contentInput.value.trim() : '';

    const startStr = document.getElementById('rec-start-date').value;
    const endStr = document.getElementById('rec-end-date').value;
    const skipHolidays = document.getElementById('rec-skip-holidays').checked;

    if (!content) return alert("일정 내용을 입력해주세요.");
    if (!startStr || !endStr) return alert("시작 날짜와 종료 날짜를 모두 선택해주세요.");

    const startDate = parseLocalDate(startStr);
    const endDate = parseLocalDate(endStr);
    if (startDate > endDate) return alert("시작 날짜가 종료 날짜보다 늦을 수 없습니다.");

    const recType = document.querySelector('input[name="rec-type"]:checked').value;
    const targetDates = [];
    let cur = new Date(startDate);

    if (recType === 'weekly' || recType === 'biweekly') {
      const selectedDays = Array.from(document.querySelectorAll('.rec-day-check:checked')).map(cb => parseInt(cb.value, 10));
      if (selectedDays.length === 0) return alert("반복할 요일을 하나 이상 선택해주세요.");

      const startSun = new Date(startDate);
      startSun.setDate(startDate.getDate() - startDate.getDay());

      while (cur <= endDate) {
        if (selectedDays.includes(cur.getDay())) {
          if (recType === 'weekly') {
            targetDates.push(formatDate(cur));
          } else if (recType === 'biweekly') {
            const tempSun = new Date(cur);
            tempSun.setDate(cur.getDate() - cur.getDay());
            const weekDiff = Math.floor(Math.round((tempSun - startSun) / (1000 * 60 * 60 * 24)) / 7);
            if (weekDiff % 2 === 0) {
              targetDates.push(formatDate(cur));
            }
          }
        }
        cur.setDate(cur.getDate() + 1);
      }
    } else if (recType === 'monthly') {
      const selectedDays = Array.from(document.querySelectorAll('.rec-month-day-check:checked')).map(cb => parseInt(cb.value, 10));
      if (selectedDays.length === 0) return alert("매월 반복할 날짜를 하나 이상 선택해주세요.");

      while (cur <= endDate) {
        if (selectedDays.includes(cur.getDate())) {
          targetDates.push(formatDate(cur));
        }
        cur.setDate(cur.getDate() + 1);
      }
    }

    if (targetDates.length === 0) return alert("조건에 해당하는 날짜가 지정한 기간 내에 없습니다.");
    if (!confirm(`총 ${targetDates.length}일의 반복 일정을 클라우드에 등록하시겠습니까?`)) return;

    const groupId = `group_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 5)}`;

    document.getElementById('recurring-event-modal').innerHTML = `<div style="background:#fff; padding:40px; border-radius:12px; font-weight:bold; color:#16a34a; text-align:center; box-shadow:0 10px 25px rgba(0,0,0,0.2);">⏳ 클라우드에 일괄 등록 중...</div>`;

    try {
      const eventSnap = await getUserCol('events').get();
      const existingEventsMap = {};
      eventSnap.forEach(doc => { existingEventsMap[doc.id] = doc.data(); });

      let batch = window.db.batch();
      let opCount = 0;
      let batchPromises = [];
      let addedCount = 0;
      let skippedCount = 0;

      for (const dateStr of targetDates) {
        const docData = existingEventsMap[dateStr] || {};
        let list = docData.eventList || (docData.eventText ? parseRawEventTextToEventList(docData.eventText) : []);

        if (skipHolidays) {
          const hasSkipLabel = list.some(ev => isSkipLabel(ev.label) || (ev.labels && ev.labels.some(l => isSkipLabel(l))));
          if (hasSkipLabel) {
            skippedCount++;
            continue;
          }
        }

        if (!list.some(ev => (ev.label === label || (ev.labels && ev.labels.includes(label))) && ev.content === content)) {
          list.push({ 
              label: label, 
              labels: [label], 
              content: content, 
              completed: false,
              groupId: groupId
          });
          const newText = formatEventListToText(list);

          const docRef = getUserCol('events').doc(dateStr);
          batch.set(docRef, { eventList: list, eventText: newText, updatedAt: Date.now() }, { merge: true });
          
          addedCount++;
          opCount++;

          if (opCount >= 400) {
            batchPromises.push(batch.commit());
            batch = window.db.batch();
            opCount = 0;
          }
        } else {
            skippedCount++;
        }
      }

      if (opCount > 0) batchPromises.push(batch.commit());
      await Promise.all(batchPromises);

      const modal = document.getElementById('recurring-event-modal');
      if(modal) modal.remove();
      alert(`✅ 성공적으로 등록 완료되었습니다!\n- 등록: ${addedCount}건\n- 건너뜀(휴일/중복): ${skippedCount}건`);
      
      if (this.currentCallback) this.currentCallback(true);
    } catch (e) {
      console.error("반복 일정 일괄 등록 오류:", e);
      alert("일정 등록 도중 오류가 발생했습니다.");
    }
  }
};

// ==========================================================================
// 🌉 과도기 호환성 레이어 
// ==========================================================================
window.RecurringEventModule = RecurringEventModule;

window.openRecurringModal = (startDateStr, labelName, textContent, callback) => {
    RecurringEventModule.open(startDateStr, labelName, textContent, callback);
};