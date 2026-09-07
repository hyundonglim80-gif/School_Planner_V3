// js/modules/miniCalendarManager.js
import { store } from '../core/store.js';
import { jumpToDate } from '../core/navigation.js';

export const MiniCalendarManager = {
    isOpen: false,
    viewYear: new Date().getFullYear(),
    viewMonth: new Date().getMonth(), // 0 ~ 11
    closeTimer: null,

    clearCloseTimer: function() {
        if (this.closeTimer) {
            clearTimeout(this.closeTimer);
            this.closeTimer = null;
        }
    },

    startCloseTimer: function() {
        this.clearCloseTimer();
        this.closeTimer = setTimeout(() => {
            if (this.isOpen) {
                this.close();
            }
        }, 350);
    },

    handleMouseEnter: function() {
        this.clearCloseTimer();
        if (!this.isOpen) {
            this.open();
        }
    },

    handleMouseLeave: function() {
        this.startCloseTimer();
    },

    init: function() {
        const btn = document.getElementById('btn-calendar-picker');
        const popover = document.getElementById('mini-calendar-popover');
        const container = document.getElementById('mini-calendar-container');

        if (!btn || !popover) return;

        // 마우스 호버 시 자동 팝업 및 안전한 지연 닫힘 처리
        btn.addEventListener('mouseenter', () => {
            btn.style.backgroundColor = '#e2e8f0';
            this.handleMouseEnter();
        });
        btn.addEventListener('mouseleave', () => {
            if (!this.isOpen) {
                btn.style.backgroundColor = '#f8fafc';
            }
            this.handleMouseLeave();
        });

        if (container) {
            container.addEventListener('mouseenter', () => this.handleMouseEnter());
            container.addEventListener('mouseleave', () => this.handleMouseLeave());
        }

        popover.addEventListener('mouseenter', () => this.handleMouseEnter());
        popover.addEventListener('mouseleave', () => this.handleMouseLeave());

        // 클릭으로도 토글 가능하게 유지
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggle();
        });

        // 팝오버 내부 클릭 시 닫히지 않도록 이벤트 버블링 방지
        popover.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        // 외부 클릭 시 팝오버 닫기
        document.addEventListener('click', (e) => {
            if (this.isOpen && !btn.contains(e.target) && !popover.contains(e.target)) {
                this.close();
            }
        });

        // ESC 키로 닫기
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });

        // 화면 리사이즈 및 스크롤 시 위치 갱신
        window.addEventListener('resize', () => {
            if (this.isOpen) this.updatePosition();
        });
        window.addEventListener('scroll', () => {
            if (this.isOpen) this.updatePosition();
        }, { passive: true });
    },

    updatePosition: function() {
        const btn = document.getElementById('btn-calendar-picker');
        const popover = document.getElementById('mini-calendar-popover');
        if (!btn || !popover || !this.isOpen) return;

        const rect = btn.getBoundingClientRect();
        const popoverWidth = 230;

        let left = rect.left + (rect.width / 2) - (popoverWidth / 2);

        // 화면 밖으로 나가지 않도록 좌우 마진 10px 보호
        const minLeft = 10;
        const maxLeft = Math.max(minLeft, window.innerWidth - popoverWidth - 10);
        if (left < minLeft) left = minLeft;
        if (left > maxLeft) left = maxLeft;

        const top = rect.bottom + 6;

        popover.style.position = 'fixed';
        popover.style.top = `${top}px`;
        popover.style.left = `${left}px`;
        popover.style.transform = 'none';
        popover.style.margin = '0';
        popover.style.zIndex = '99999';
    },

    toggle: function() {
        if (this.isOpen) this.close();
        else this.open();
    },

    open: function() {
        this.clearCloseTimer();

        const popover = document.getElementById('mini-calendar-popover');
        const btn = document.getElementById('btn-calendar-picker');
        if (!popover) return;

        const curDate = store.currentDate || new Date();
        this.viewYear = curDate.getFullYear();
        this.viewMonth = curDate.getMonth();

        this.renderCalendar();
        popover.classList.remove('hidden');
        this.isOpen = true;

        this.updatePosition();

        // 버튼 강조 스타일
        if (btn) {
            btn.style.backgroundColor = '#e0f2fe';
            btn.style.borderColor = '#7dd3fc';
        }
    },

    close: function() {
        this.clearCloseTimer();

        const popover = document.getElementById('mini-calendar-popover');
        if (popover) {
            popover.classList.add('hidden');
        }
        this.isOpen = false;

        const btn = document.getElementById('btn-calendar-picker');
        if (btn) {
            btn.style.backgroundColor = '#f8fafc';
            btn.style.borderColor = '#cbd5e1';
        }
    },

    changeMonth: function(delta) {
        this.viewMonth += delta;
        if (this.viewMonth < 0) {
            this.viewMonth = 11;
            this.viewYear--;
        } else if (this.viewMonth > 11) {
            this.viewMonth = 0;
            this.viewYear++;
        }
        this.renderCalendar();
    },

    changeYear: function(delta) {
        this.viewYear += delta;
        this.renderCalendar();
    },

    changeYearMonth: function(year, month) {
        this.viewYear = parseInt(year, 10);
        this.viewMonth = parseInt(month, 10);
        this.renderCalendar();
    },

    goToday: function() {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        const todayStr = `${y}-${m}-${d}`;
        this.selectDate(todayStr);
    },

    selectDate: function(dateStr) {
        if (!dateStr) return;
        this.close();
        jumpToDate(dateStr);
        if (window.showToast) {
            window.showToast(`📅 ${dateStr}로 이동했습니다.`);
        }
    },

    renderCalendar: function() {
        const popover = document.getElementById('mini-calendar-popover');
        if (!popover) return;

        const year = this.viewYear;
        const month = this.viewMonth;

        const firstDayIndex = new Date(year, month, 1).getDay(); // 0(일) ~ 6(토)
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const daysInPrevMonth = new Date(year, month, 0).getDate();

        // 현재 보고 있는 기준 날짜 (store.currentDate)
        const curDate = store.currentDate || new Date();
        const curY = curDate.getFullYear();
        const curM = curDate.getMonth();
        const curD = curDate.getDate();

        // 실제 오늘 날짜
        const now = new Date();
        const todayY = now.getFullYear();
        const todayM = now.getMonth();
        const todayD = now.getDate();

        // 1. 헤더 (이전/다음 달 및 연도, 연월 텍스트, 오늘, 닫기)
        let headerHtml = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                <div style="display:flex; align-items:center; gap:1px;">
                    <button type="button" onclick="event.stopPropagation(); window.MiniCalendarManager.changeYear(-1)" style="background:none; border:none; padding:2px 3px; border-radius:3px; cursor:pointer; font-size:0.72rem; color:#64748b; transition:0.15s;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='none'" title="이전 연도">«</button>
                    <button type="button" onclick="event.stopPropagation(); window.MiniCalendarManager.changeMonth(-1)" style="background:none; border:none; padding:2px 4px; border-radius:3px; cursor:pointer; font-size:0.72rem; color:#475569; transition:0.15s;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='none'" title="이전 달">◀</button>
                    <span style="font-weight:bold; font-size:0.85rem; color:#0f172a; letter-spacing:-0.3px; padding:0 2px;">${year}년 ${month + 1}월</span>
                    <button type="button" onclick="event.stopPropagation(); window.MiniCalendarManager.changeMonth(1)" style="background:none; border:none; padding:2px 4px; border-radius:3px; cursor:pointer; font-size:0.72rem; color:#475569; transition:0.15s;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='none'" title="다음 달">▶</button>
                    <button type="button" onclick="event.stopPropagation(); window.MiniCalendarManager.changeYear(1)" style="background:none; border:none; padding:2px 3px; border-radius:3px; cursor:pointer; font-size:0.72rem; color:#64748b; transition:0.15s;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='none'" title="다음 연도">»</button>
                </div>
                <div style="display:flex; align-items:center; gap:2px;">
                    <button type="button" onclick="event.stopPropagation(); window.MiniCalendarManager.goToday()" style="background:#eff6ff; color:#2563eb; border:1px solid #bfdbfe; border-radius:4px; padding:1px 5px; font-size:0.68rem; font-weight:bold; cursor:pointer; transition:0.15s;" onmouseover="this.style.background='#dbeafe'" onmouseout="this.style.background='#eff6ff'">오늘</button>
                    <button type="button" onclick="event.stopPropagation(); window.MiniCalendarManager.close()" style="background:none; border:none; padding:1px 4px; border-radius:3px; cursor:pointer; font-size:0.85rem; color:#94a3b8; font-weight:bold; transition:0.15s;" onmouseover="this.style.color='#0f172a'" onmouseout="this.style.color='#94a3b8'" title="닫기">✕</button>
                </div>
            </div>
        `;

        // 2. 요일 헤더
        const weekDays = ['일', '월', '화', '수', '목', '금', '토'];
        let weekDayHeaders = weekDays.map((w, idx) => {
            const color = idx === 0 ? '#ef4444' : (idx === 6 ? '#2563eb' : '#64748b');
            return `<div style="text-align:center; font-size:0.68rem; font-weight:bold; color:${color}; padding:2px 0;">${w}</div>`;
        }).join('');

        let weekHeaderHtml = `<div style="display:grid; grid-template-columns:repeat(7, 1fr); margin-bottom:3px; border-bottom:1px solid #f1f5f9; padding-bottom:3px;">${weekDayHeaders}</div>`;

        // 3. 날짜 그리드
        let daysHtml = '';

        // 이전 달 날짜 채우기
        const pYear = month === 0 ? year - 1 : year;
        const pMonth = month === 0 ? 11 : month - 1;
        for (let i = firstDayIndex - 1; i >= 0; i--) {
            const pDay = daysInPrevMonth - i;
            const pDateStr = `${pYear}-${String(pMonth + 1).padStart(2, '0')}-${String(pDay).padStart(2, '0')}`;
            daysHtml += `
                <div onclick="event.stopPropagation(); window.MiniCalendarManager.selectDate('${pDateStr}')" 
                     style="height:24px; display:flex; align-items:center; justify-content:center; font-size:0.72rem; color:#cbd5e1; cursor:pointer; border-radius:4px; transition:all 0.15s;" 
                     onmouseover="this.style.background='#f8fafc'; this.style.color='#64748b';" 
                     onmouseout="this.style.background='none'; this.style.color='#cbd5e1';">
                    ${pDay}
                </div>`;
        }

        // 이번 달 날짜 채우기
        for (let d = 1; d <= daysInMonth; d++) {
            const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const dayOfWeek = (firstDayIndex + d - 1) % 7;
            const isSelected = (year === curY && month === curM && d === curD);
            const isToday = (year === todayY && month === todayM && d === todayD);

            let dayColor = dayOfWeek === 0 ? '#ef4444' : (dayOfWeek === 6 ? '#2563eb' : '#1e293b');
            let bgStyle = 'background:none;';
            let borderStyle = 'border: 1px solid transparent;';

            if (isSelected) {
                dayColor = '#ffffff';
                bgStyle = 'background: #2563eb; font-weight: bold;';
            } else if (isToday) {
                borderStyle = 'border: 1.5px solid #3b82f6; font-weight: bold;';
            }

            daysHtml += `
                <div onclick="event.stopPropagation(); window.MiniCalendarManager.selectDate('${dStr}')" 
                     style="height:24px; display:flex; align-items:center; justify-content:center; font-size:0.75rem; color:${dayColor}; ${bgStyle} ${borderStyle} border-radius:4px; cursor:pointer; transition:all 0.15s;" 
                     onmouseover="if(!${isSelected}){ this.style.background='#eff6ff'; this.style.color='#1e40af'; }" 
                     onmouseout="if(!${isSelected}){ this.style.background='none'; this.style.color='${dayColor}'; }">
                    ${d}
                </div>`;
        }

        // 다음 달 날짜 채우기 (그리드 남은 칸 채우기)
        const totalRendered = firstDayIndex + daysInMonth;
        const remainingCells = (7 - (totalRendered % 7)) % 7;
        const nYear = month === 11 ? year + 1 : year;
        const nMonth = month === 11 ? 0 : month + 1;
        for (let nextDay = 1; nextDay <= remainingCells; nextDay++) {
            const nDateStr = `${nYear}-${String(nMonth + 1).padStart(2, '0')}-${String(nextDay).padStart(2, '0')}`;
            daysHtml += `
                <div onclick="event.stopPropagation(); window.MiniCalendarManager.selectDate('${nDateStr}')" 
                     style="height:24px; display:flex; align-items:center; justify-content:center; font-size:0.72rem; color:#cbd5e1; cursor:pointer; border-radius:4px; transition:all 0.15s;" 
                     onmouseover="this.style.background='#f8fafc'; this.style.color='#64748b';" 
                     onmouseout="this.style.background='none'; this.style.color='#cbd5e1';">
                    ${nextDay}
                </div>`;
        }

        let gridHtml = `<div style="display:grid; grid-template-columns:repeat(7, 1fr); gap:1.5px;">${daysHtml}</div>`;

        // 4. 하단 직접 선택 바
        let footerHtml = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:5px; padding-top:5px; border-top:1px solid #f1f5f9;">
                <label style="position:relative; background:#f8fafc; color:#475569; border:1px solid #cbd5e1; border-radius:4px; padding:2px 5px; font-size:0.68rem; font-weight:bold; cursor:pointer; display:inline-flex; align-items:center; gap:3px; transition:0.15s;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='#f8fafc'">
                    <span>📅 직접 선택</span>
                    <input type="date" value="${curDate.toISOString().split('T')[0]}" style="position:absolute; top:0; left:0; width:100%; height:100%; opacity:0; cursor:pointer;" onchange="event.stopPropagation(); window.MiniCalendarManager.selectDate(this.value)">
                </label>
                <span style="font-size:0.65rem; color:#94a3b8;">클릭 시 이동</span>
            </div>
        `;

        popover.innerHTML = headerHtml + weekHeaderHtml + gridHtml + footerHtml;
    }
};

window.MiniCalendarManager = MiniCalendarManager;
