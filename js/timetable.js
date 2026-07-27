// js/timetable.js

// 1. 모달창 열기 (기본 표 랜더링 및 데이터 불러오기)
window.openTimetableModal = function() {
  document.getElementById('timetable-modal').classList.remove('hidden');
  renderTimetableGrid();
  loadBaseTimetable();
  
  // 열려있는 드롭다운 닫기
  const dropdown = document.getElementById('more-dropdown');
  if (dropdown) dropdown.classList.add('hidden');
};

// 2. 모달창 닫기
window.closeTimetableModal = function() {
  document.getElementById('timetable-modal').classList.add('hidden');
};

// 3. 1~6교시 입력용 표(Table) 동적 생성
function renderTimetableGrid() {
  const tbody = document.getElementById('tt-tbody');
  tbody.innerHTML = '';
  const days = ['월', '화', '수', '목', '금'];
  
  for (let p = 1; p <= 6; p++) {
    let tr = document.createElement('tr');
    let tdP = document.createElement('td');
    tdP.textContent = p + '교시';
    tdP.style.fontWeight = 'bold';
    tdP.style.background = '#f8fafc';
    tr.appendChild(tdP);
    
    days.forEach(day => {
      let td = document.createElement('td');
      td.innerHTML = `<input type="text" id="tt-input-${day}-${p}" placeholder="">`;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  }
}

// 4. Firestore에서 기준시간표 불러오기
window.loadBaseTimetable = async function() {
  const sem = document.getElementById('tt-semester-select').value;
  const days = ['월', '화', '수', '목', '금'];
  
  // 입력창 초기화
  days.forEach(day => {
    for(let p=1; p<=6; p++) {
      const input = document.getElementById(`tt-input-${day}-${p}`);
      if(input) input.value = '';
    }
  });

  try {
    const doc = await window.db.collection('settings').doc('timetable_sem' + sem).get();
    if (doc.exists) {
      const data = doc.data();
      days.forEach(day => {
        if(data[day]) {
          for(let p=1; p<=6; p++) {
            if(data[day][p]) {
              document.getElementById(`tt-input-${day}-${p}`).value = data[day][p];
            }
          }
        }
      });
    }
  } catch (e) {
    console.error("기준시간표 불러오기 오류", e);
  }
};

// 5. 작성한 기준시간표 Firestore에 저장하기
window.saveBaseTimetable = async function() {
  const btn = document.querySelector('.btn-save-tt');
  btn.textContent = "⏳ 저장 중...";
  btn.disabled = true;

  const sem = document.getElementById('tt-semester-select').value;
  const days = ['월', '화', '수', '목', '금'];
  const data = {};
  
  days.forEach(day => {
    data[day] = {};
    for(let p=1; p<=6; p++) {
      data[day][p] = document.getElementById(`tt-input-${day}-${p}`).value.trim();
    }
  });

  try {
    // settings 컬렉션에 학기별로 분리해서 저장
    await window.db.collection('settings').doc('timetable_sem' + sem).set(data);
    alert(`✅ ${sem}학기 기준시간표가 클라우드에 안전하게 저장되었습니다.`);
  } catch (e) {
    console.error("저장 오류", e);
    alert("저장 중 오류가 발생했습니다.");
  } finally {
    btn.textContent = "💾 기준시간표 클라우드에 저장";
    btn.disabled = false;
  }
};

// 6. 기준시간표 지정된 날짜 기간에 일괄 적용하기 (동기화 엔진)
window.applyBaseTimetable = async function() {
  const sem = document.getElementById('apply-semester').value;
  const startDate = document.getElementById('apply-start-date').value;
  const endDate = document.getElementById('apply-end-date').value;

  if(!startDate || !endDate) {
    alert("🚨 적용할 시작 날짜와 종료 날짜를 모두 선택해주세요.");
    return;
  }
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  if(start > end) {
    alert("🚨 종료 날짜가 시작 날짜보다 빠를 수 없습니다.");
    return;
  }

  if(!confirm(`⚠️ 정말로 ${startDate} ~ ${endDate} 기간의 평일에 [${sem}학기 기준시간표]를 일괄 적용하시겠습니까?\n(기존에 입력된 과목 데이터가 기준시간표 내용으로 덮어씌워집니다)`)) {
    return;
  }

  const btn = document.querySelector('.btn-apply-tt');
  btn.textContent = "⏳ 데이터 동기화 중...";
  btn.disabled = true;

  try {
    // 저장된 기준시간표 가져오기
    const doc = await window.db.collection('settings').doc('timetable_sem' + sem).get();
    const baseData = doc.exists ? doc.data() : null;
    
    if(!baseData) {
      alert("🚨 등록된 기준시간표가 없습니다. 위쪽에서 기준시간표를 먼저 작성하고 저장해주세요.");
      return;
    }

    const operations = [];
    const daysArr = ['일', '월', '화', '수', '목', '금', '토'];
    let appliedCount = 0;
    
    let curr = new Date(start);
    
    // 시작일부터 종료일까지 하루씩 넘어가며 평일(월~금) 검사
    while(curr <= end) {
      const dayOfWeekNum = curr.getDay(); // 0:일요일 ~ 6:토요일
      
      if (dayOfWeekNum !== 0 && dayOfWeekNum !== 6) { 
        const dayName = daysArr[dayOfWeekNum];
        const dateStr = window.formatDate(curr);
        
        // 해당 날짜의 기존 데이터를 읽어옴 (메모나 준비물을 날리지 않고 보호하기 위함)
        const scheduleDoc = await window.db.collection('schedules').doc(dateStr).get();
        let periods = scheduleDoc.exists ? (scheduleDoc.data().periods || {}) : {};
        
        // 1~6교시에 기준시간표 과목 덮어쓰기
        for(let p=1; p<=6; p++) {
          if(!periods[p]) periods[p] = { subject:'', memo:'', supplies:'' };
          
          const baseSubject = baseData[dayName] && baseData[dayName][p] !== undefined ? baseData[dayName][p] : '';
          periods[p].subject = baseSubject;
        }

        const sRef = window.db.collection('schedules').doc(dateStr);
        operations.push({ type: 'set', ref: sRef, data: { periods: periods, updatedAt: Date.now() } });
        appliedCount++;
      }
      curr.setDate(curr.getDate() + 1); // 다음 날짜로 이동
    }

    // 일괄 통신 저장
    await window.executeBatchOperations(operations);
    
    alert(`🎉 성공! 총 ${appliedCount}일의 평일에 기준시간표가 일괄 적용되었습니다.`);
    window.closeTimetableModal();
    window.render(); // 화면 새로고침하여 바뀐 시간표 즉시 표시

  } catch (e) {
    console.error("일괄 적용 오류", e);
    alert("일괄 적용 중 오류가 발생했습니다.");
  } finally {
    btn.textContent = "🚀 일괄 적용";
    btn.disabled = false;
  }
};
