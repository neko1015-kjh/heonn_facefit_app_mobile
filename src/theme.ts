// FaceFit 앱 전체에서 함께 쓰는 색상과 디자인 값 모음입니다.
// (HTML 프로토타입의 다크 테마 + 앰버(amber) 포인트 색을 그대로 옮겼습니다.)
// 한곳에서 색을 바꾸면 모든 화면에 똑같이 반영됩니다.

export const colors = {
  // 배경 계열 (어두운 회색~검정)
  bg: '#09090b', // 가장 어두운 배경
  surface: '#18181b', // 카드 배경
  surface2: '#27272a', // 살짝 밝은 카드/요소
  border: '#27272a', // 테두리
  border2: '#3f3f46', // 조금 더 밝은 테두리

  // 글자 계열 (밝은 회색~흰색)
  text: '#f4f4f5', // 기본 밝은 글자
  textMuted: '#a1a1aa', // 보조 글자
  textFaint: '#71717a', // 흐린 글자
  textFainter: '#52525b', // 더 흐린 글자

  // 포인트 색 (앰버/골드)
  amber300: '#fcd34d',
  amber400: '#fbbf24',
  amber500: '#f59e0b',
  amber600: '#d97706',

  // 상태 색
  emerald: '#34d399', // 연결됨/긍정 (초록)
  red: '#ef4444', // 알림 빨강
  white: '#ffffff',
  black: '#000000',

  // 소셜 로그인 버튼 색
  kakao: '#FEE500',
  naver: '#03C75A',
};

// 자주 쓰는 둥근 모서리 값
export const radius = {
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
};

// 자주 쓰는 간격 값
export const spacing = {
  sm: 8,
  md: 16,
  lg: 24,
};
