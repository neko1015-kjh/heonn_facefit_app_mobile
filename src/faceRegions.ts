// 각 분석 항목이 '얼굴의 어느 부위'를 보는지 짧게 알려줍니다.
// 리포트 화면·분석 결과 화면에서 결과 아래에 함께 표시합니다.
export const FACE_REGIONS: Record<string, string> = {
  symmetry: '양쪽 눈·눈썹·입꼬리·코·볼 (좌우 대칭)',
  balance: '좌우 볼 폭 (광대~턱선)',
  dark_circle: '양쪽 눈 밑',
  wrinkle: '이마·미간·눈가·팔자',
};
