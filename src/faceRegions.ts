// 각 분석 항목이 '얼굴의 어느 부위'를 보는지 알려줍니다.
// short: 부위 요약(한 줄) / detail: 무엇을 어떻게 보는지 자세한 설명
// 리포트 화면·분석 결과 화면에서 결과 아래에 미니맵(FaceRegionMini)과 함께 표시합니다.
export type FaceRegionInfo = { short: string; detail: string };

export const FACE_REGIONS: Record<string, FaceRegionInfo> = {
  symmetry: {
    short: '양쪽 눈·눈썹·입꼬리·코·볼 (좌우 대칭)',
    detail: '얼굴 중앙선을 기준으로 양쪽 눈·눈썹·입꼬리·코·볼의 위치가 얼마나 대칭인지 비교합니다. 좌우가 맞을수록 점수가 높아요.',
  },
  balance: {
    short: '좌우 볼 폭 (광대~턱선)',
    detail: '중앙선에서 왼쪽·오른쪽 끝(광대~턱선)까지의 폭을 비교해 한쪽이 부었는지 봅니다. 양쪽 폭이 비슷할수록 점수가 높아요.',
  },
  dark_circle: {
    short: '양쪽 눈 밑',
    detail: '양쪽 눈 밑의 밝기를 바로 아래 볼과 비교합니다. 눈 밑이 볼보다 어두울수록 다크서클로 보고 점수가 낮아져요.',
  },
  wrinkle: {
    short: '이마·미간·눈가·팔자',
    detail: '이마·미간·눈가·팔자 부위의 잔주름(결)을 매끈한 볼과 비교합니다. 결이 많을수록 점수가 낮아져요.',
  },
};
