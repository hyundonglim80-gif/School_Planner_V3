//js/components/BaseView.js

class BaseView {
  constructor(container) {
    this.container = container; // 화면이 그려질 도화지 (#main-view)
  }

  // 1. 공통 상태 접근자 (어디서든 쉽게 기본 정보를 가져옴)
  get currentDate() { return window.currentDate; }
  get currentMode() { return window.currentMode; }
  get dateStr() { return window.formatDate(window.currentDate); }
  get maxPeriod() { return window.periodNames ? window.periodNames.length : 6; }
  get isWeekendVisible() { return window.showWeekend; }

  // 2. 공통 UI 제어 (화면 초기화 및 로딩 문구)
  clear() {
    if (this.container) this.container.innerHTML = '';
  }

  showLoading(message = '클라우드 데이터를 불러오는 중입니다...') {
    if (this.container) {
      this.container.innerHTML = `
        <p style="text-align:center; padding: 40px; color:#64748b; font-weight:bold; font-size:1.1rem;">
          ⏳ ${message}
        </p>
      `;
    }
  }

  showError(message = '데이터 처리 중 오류가 발생했습니다.') {
    if (this.container) {
      this.container.innerHTML = `
        <p style="text-align:center; padding: 40px; color:#ef4444; font-weight:bold; font-size:1.1rem;">
          🚨 ${message}
        </p>
      `;
    }
  }

  // 3. 자식 뷰(일, 주, 월 등)가 반드시 만들어야 하는 필수 기능 (규칙 강제)
  async render() {
    throw new Error("이 화면의 render() 함수가 아직 만들어지지 않았습니다.");
  }

  async save() {
    // 뷰어 모드만 있는 화면(연간 보기 등)을 위해 에러를 띄우지 않고 비워둡니다.
  }
}

// 전역에서 사용할 수 있게 등록
window.BaseView = BaseView;
