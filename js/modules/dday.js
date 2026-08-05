// js/modules/dday.js

window.ddayList = [];
window.selectedDDayId = null;

// 🚀 D-Day 데이터 불러오기 및 초기화
window.initDDay = async function() {
    await window.loadDDayData();
    window.renderDDayBadge();
};

window.loadDDayData = async function() {
    try {
        const localData = localStorage.getItem('workCalendar_ddays');
        const localSelected = localStorage.getItem('workCalendar_selectedDDayId');
        if (localData) window.ddayList = JSON.parse(localData);
        if (localSelected) window.selectedDDayId = localSelected;

        if (window.db) {
            const doc = await window.getUserCol('settings').doc('preferences').get();
            if (doc.exists) {
                const data = doc.data();
                if (data.ddays) {
                    window.ddayList = data.ddays;
                    localStorage.setItem('workCalendar_ddays', JSON.stringify(data.ddays));
                }
                if (data.selectedDDayId !== undefined) {
                    window.selectedDDayId = data.selectedDDayId;
                    localStorage.setItem('workCalendar_selectedDDayId', data.selectedDDayId || '');
                }
            }
        }
    } catch(e) {
        console.warn("D-Day 데이터 불러오기 중 오류:", e);
    }
};

window.saveDDayData = async function() {
    localStorage.setItem('workCalendar_ddays', JSON.stringify(window.ddayList));
    localStorage.setItem('workCalendar_selectedDDayId', window.selectedDDayId || '');

    if (window.db) {
        try {
            await window.getUserCol('settings').doc('preferences').set({
                ddays: window.ddayList,
                selectedDDayId: window.selectedDDayId || null
            }, { merge: true });
        } catch(e) {
            console.error("D-Day 저장 오류:", e);
        }
    }
};

// 🚩 오늘 기준 D-Day 수치 계산 (D-15, D-Day, D+3 등)
window.calculateDDay = function(targetDateStr) {
    if (!targetDateStr) return '';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const parts = targetDateStr.split('-');
    const target = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    target.setHours(0, 0, 0, 0);

    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'D-Day';
    if (diffDays > 0) return `D-${diffDays}`;
    return `D+${Math.abs(diffDays)}`;
};

// 🖥️ 상단 D-Day 뱃지 & 드롭다운 그려주기
window.renderDDayBadge = function() {
    const container = document.getElementById('dday-container');
    if (!container) return;

    if (!window.ddayList || window.ddayList.length === 0) {
        container.innerHTML = `
            <button onclick="window.openDDayManagerModal()" class="dday-badge dday-empty" title="클릭하여 D-Day 등록">
                🚩 D-Day 설정
            </button>
        `;
        return;
    }

    // 선택된 D-Day 찾기 (없으면 가장 가까운 미래 D-Day 자동 선택)
    let activeItem = window.ddayList.find(item => item.id === window.selectedDDayId);
    if (!activeItem) {
        const todayStr = window.formatDate(new Date());
        const futureItems = window.ddayList.filter(item => item.targetDate >= todayStr);
        futureItems.sort((a, b) => a.targetDate.localeCompare(b.targetDate));
        activeItem = futureItems[0] || window.ddayList[0];
        window.selectedDDayId = activeItem.id;
    }

    const ddayText = window.calculateDDay(activeItem.targetDate);
    
    let dropdownListHtml = '';
    window.ddayList.forEach(item => {
        const itemDDay = window.calculateDDay(item.targetDate);
        const isSelected = item.id === activeItem.id ? 'active' : '';
        dropdownListHtml += `
            <div class="dday-dropdown-item ${isSelected}" onclick="window.selectDDay('${item.id}')">
                <span class="dday-item-title">${item.title}</span>
                <span class="dday-item-val">${itemDDay}</span>
            </div>
        `;
    });

    container.innerHTML = `
        <div class="dday-wrapper">
            <button onclick="window.toggleDDayDropdown(event)" class="dday-badge">
                🚩 ${activeItem.title} <span class="dday-tag">${ddayText}</span> <span class="dday-arrow">▼</span>
            </button>
            <div id="dday-dropdown" class="dday-dropdown hidden">
                <div class="dday-dropdown-header">D-Day 목록</div>
                <div class="dday-dropdown-list">
                    ${dropdownListHtml}
                </div>
                <div class="dday-dropdown-footer" onclick="window.openDDayManagerModal()">
                    ⚙️ D-Day 관리
                </div>
            </div>
        </div>
    `;
};

window.toggleDDayDropdown = function(e) {
    if (e) e.stopPropagation();
    const dropdown = document.getElementById('dday-dropdown');
    if (dropdown) dropdown.classList.toggle('hidden');
};

window.selectDDay = function(id) {
    window.selectedDDayId = id;
    window.saveDDayData();
    window.renderDDayBadge();
};

// ⚙️ D-Day 관리 모달창 (추가 / 삭제)
window.openDDayManagerModal = function() {
    let existing = document.getElementById('dday-modal');
    if (existing) existing.remove();

    let listHtml = '';
    if (window.ddayList.length === 0) {
        listHtml = `<div style="text-align:center; color:#94a3b8; padding:20px 0;">등록된 D-Day가 없습니다.</div>`;
    } else {
        window.ddayList.forEach(item => {
            const ddayText = window.calculateDDay(item.targetDate);
            listHtml += `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; border:1px solid #cbd5e1; border-radius:8px; margin-bottom:8px; background:#f8fafc;">
                    <div>
                        <strong style="color:#1e293b; font-size:1rem;">${item.title}</strong>
                        <span style="display:inline-block; margin-left:6px; padding:2px 6px; background:#dbeafe; color:#2563eb; border-radius:4px; font-weight:bold; font-size:0.85rem;">${ddayText}</span>
                        <div style="font-size:0.85rem; color:#64748b; margin-top:2px;">목표일: ${item.targetDate}</div>
                    </div>
                    <button onclick="window.deleteDDayItem('${item.id}')" style="background:#fee2e2; border:1px solid #fca5a5; color:#ef4444; border-radius:6px; padding:6px 10px; cursor:pointer; font-weight:bold;">지우기</button>
                </div>
            `;
        });
    }

    const todayStr = window.formatDate(new Date());

    const modalHtml = `
    <div id="dday-modal" class="modal-overlay" style="display:flex;">
        <div class="modal-content" style="width:400px; padding:25px; background:#fff; border-radius:12px; box-shadow:0 10px 25px rgba(0,0,0,0.2);">
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #bfdbfe; padding-bottom:10px; margin-bottom:15px;">
                <h3 style="margin:0; color:#2563eb;">🚩 D-Day 일정 관리</h3>
                <button onclick="document.getElementById('dday-modal').remove()" style="background:none; border:none; font-size:1.3rem; cursor:pointer; color:#64748b;">✖</button>
            </div>

            <div style="background:#eff6ff; border:1px solid #bfdbfe; padding:15px; border-radius:8px; margin-bottom:20px;">
                <h4 style="margin:0 0 10px 0; color:#1e40af; font-size:0.95rem;">+ 새 D-Day 추가</h4>
                <div style="display:flex; flex-direction:column; gap:8px;">
                    <input type="text" id="dday-new-title" placeholder="행사/일정 이름 (예: 여름방학)" style="padding:8px; border:1px solid #cbd5e1; border-radius:6px; font-size:0.95rem; outline:none;">
                    <div style="display:flex; gap:8px;">
                        <input type="date" id="dday-new-date" value="${todayStr}" style="flex:1; padding:8px; border:1px solid #cbd5e1; border-radius:6px; font-size:0.95rem;">
                        <button onclick="window.addNewDDayItem()" style="padding:8px 16px; background:#2563eb; color:#fff; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">추가</button>
                    </div>
                </div>
            </div>

            <h4 style="margin:0 0 10px 0; color:#334155;">등록된 목록 (${window.ddayList.length}개)</h4>
            <div style="max-height:220px; overflow-y:auto; margin-bottom:15px;">
                ${listHtml}
            </div>

            <div style="text-align:right;">
                <button onclick="document.getElementById('dday-modal').remove()" style="padding:8px 18px; background:#f1f5f9; border:none; border-radius:6px; font-weight:bold; cursor:pointer; color:#475569;">닫기</button>
            </div>
        </div>
    </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
};

window.addNewDDayItem = function() {
    const title = document.getElementById('dday-new-title').value.trim();
    const targetDate = document.getElementById('dday-new-date').value;

    if (!title) return alert("행사 또는 일정 이름을 입력해주세요.");
    if (!targetDate) return alert("목표 날짜를 선택해주세요.");

    const newItem = {
        id: 'dday_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 4),
        title: title,
        targetDate: targetDate
    };

    window.ddayList.push(newItem);
    window.selectedDDayId = newItem.id;
    window.saveDDayData();
    window.renderDDayBadge();

    window.openDDayManagerModal();
};

window.deleteDDayItem = function(id) {
    if (!confirm("이 D-Day 항목을 지우시겠습니까?")) return;

    window.ddayList = window.ddayList.filter(item => item.id !== id);
    if (window.selectedDDayId === id) {
        window.selectedDDayId = window.ddayList.length > 0 ? window.ddayList[0].id : null;
    }

    window.saveDDayData();
    window.renderDDayBadge();

    window.openDDayManagerModal();
};

window.addEventListener('click', function(e) {
    const container = document.getElementById('dday-container');
    const dropdown = document.getElementById('dday-dropdown');
    if (dropdown && container && !container.contains(e.target)) {
        dropdown.classList.add('hidden');
    }
});
