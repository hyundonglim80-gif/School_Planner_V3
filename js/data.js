// js/data.js

// 체크리스트 메모 데이터
let memoItems = [
  { id: 1, text: "1학기 체육 및 안전 수업 과정중심 평가 결과 입력", completed: false, order: 0, createdAt: 100 },
  { id: 2, text: "아침 학교스포츠클럽(농구) 출석률 보고서 제출", completed: false, order: 1, createdAt: 101 },
  { id: 3, text: "2학기 체육 교구 신청 목록 정리", completed: false, order: 2, createdAt: 102 },
  { id: 4, text: "여름방학 중 체육관 시설 및 기구 안전 점검", completed: true, order: 0, completedAt: 200 }
];

// 주간 학사 및 수업 데이터
const mockJulyWeekData = [
  { day: "월", date: "07/20", periods: [ { p: 1, subject: "3-1 체육", event: "아침 농구 클럽 (08:00)", memo: "강당 / 피구 경쟁활동", supplies: "피구공 4개" }, { p: 2, subject: "4-2 안전", event: "", memo: "물놀이 안전 수칙 교육", supplies: "" }, { p: 3, subject: "", event: "교직원 회의 안건 제출", memo: "7월 평가 결과 정리", supplies: "" }, { p: 4, subject: "3-2 체육", event: "", memo: "운동장 - 육상 100m 측정", supplies: "" }, { p: 5, subject: "", event: "", memo: "스포츠클럽 출석부 점검", supplies: "" }, { p: 6, subject: "동아리", event: "체육 동아리 모임", memo: "배드민턴 기초 자세 연습", supplies: "라켓, 셔틀콕" } ] },
  { day: "화", date: "07/21", periods: [ { p: 1, subject: "4-1 체육", event: "", memo: "강당 - 매트 운동", supplies: "" }, { p: 2, subject: "3-1 안전", event: "화재 대피 훈련", memo: "소화기 사용법", supplies: "" }, { p: 3, subject: "", event: "", memo: "2학기 교구 구매 목록", supplies: "" }, { p: 4, subject: "4-2 체육", event: "", memo: "운동장 - 축구 패스", supplies: "" }, { p: 5, subject: "", event: "", memo: "결재 확인", supplies: "" }, { p: 6, subject: "", event: "기구실 정돈", memo: "", supplies: "" } ] },
  { day: "수", date: "07/22", periods: [ { p: 1, subject: "3-2 안전", event: "전교생 성교육", memo: "시청각실 통합 수업", supplies: "" }, { p: 2, subject: "3-1 체육", event: "", memo: "강당 - 표현활동", supplies: "" }, { p: 3, subject: "", event: "학습공동체", memo: "과정중심 평가 협의회", supplies: "" }, { p: 4, subject: "4-1 체육", event: "", memo: "운동장 - T볼 연습", supplies: "" }, { p: 5, subject: "", event: "수업 동기화", memo: "", supplies: "" }, { p: 6, subject: "", event: "", memo: "자율 연수", supplies: "" } ] },
  { day: "목", date: "07/23", periods: [ { p: 1, subject: "4-2 체육", event: "", memo: "강당 - 무용 완성", supplies: "" }, { p: 2, subject: "3-2 체육", event: "", memo: "장애물 달리기", supplies: "" }, { p: 3, subject: "", event: "", memo: "안전 교육 정산", supplies: "" }, { p: 4, subject: "4-1 안전", event: "교통안전 교육", memo: "자전거 안전 수칙", supplies: "" }, { p: 5, subject: "", event: "", memo: "체육관 소독", supplies: "" }, { p: 6, subject: "", event: "학부모 상담", memo: "상담록 작성", supplies: "" } ] },
  { day: "금", date: "07/24", periods: [ { p: 1, subject: "전학년", event: "🏖️ 여름방학식", memo: "방송 수업 진행", supplies: "" }, { p: 2, subject: "학반 활동", event: "교실 대청소", memo: "물품 정리", supplies: "" }, { p: 3, subject: "", event: "하계 연수", memo: "안전 관리 수칙 협의", supplies: "" }, { p: 4, subject: "", event: "마감 업무", memo: "생기부 최종 입력", supplies: "" }, { p: 5, subject: "", event: "", memo: "시설 퇴근 전 점검", supplies: "" }, { p: 6, subject: "", event: "방학 개시", memo: "", supplies: "" } ] }
];