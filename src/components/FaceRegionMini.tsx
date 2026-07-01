import Svg, { Ellipse, Line, Circle, Path } from 'react-native-svg';
import { colors } from '../theme';

// 작은 '개념 얼굴' 미니맵입니다. 분석 항목이 얼굴의 어느 부위를 보는지 그림으로 보여줍니다.
// (실제 사진이 아니라 도식 — 클릭 없이 항상 표시. 정확한 위치는 '탭하여 분석 부위 보기'로 확인)
// viewBox 0~100(가로) / 0~120(세로), 얼굴 중심 (50,58).

type Props = { region: string; size?: number };

const FAINT = 'rgba(161,161,170,0.35)'; // 도식 얼굴선(흐리게)
const HL = colors.amber400;             // 강조(부위)
const HL2 = colors.emerald;             // 좌우 짝

// 공통: 얼굴 윤곽 + 흐린 이목구비
function BaseFace() {
  return (
    <>
      <Ellipse cx={50} cy={58} rx={33} ry={45} stroke={FAINT} strokeWidth={2} fill="none" />
      {/* 눈 */}
      <Ellipse cx={37} cy={50} rx={5} ry={3} stroke={FAINT} strokeWidth={1.5} fill="none" />
      <Ellipse cx={63} cy={50} rx={5} ry={3} stroke={FAINT} strokeWidth={1.5} fill="none" />
      {/* 코 */}
      <Line x1={50} y1={54} x2={50} y2={66} stroke={FAINT} strokeWidth={1.5} />
      {/* 입 */}
      <Line x1={41} y1={80} x2={59} y2={80} stroke={FAINT} strokeWidth={1.5} />
    </>
  );
}

export default function FaceRegionMini({ region, size = 46 }: Props) {
  const w = size;
  const h = size * 1.2;

  let marks: React.ReactNode = null;
  if (region === 'symmetry') {
    // 중앙선 + 좌우 짝 점(눈·입꼬리·볼)
    marks = (
      <>
        <Line x1={50} y1={12} x2={50} y2={104} stroke={HL} strokeWidth={1.5} strokeDasharray="4 3" opacity={0.9} />
        <Circle cx={37} cy={50} r={3} fill={HL2} /><Circle cx={63} cy={50} r={3} fill={HL2} />
        <Circle cx={41} cy={80} r={2.6} fill={HL2} /><Circle cx={59} cy={80} r={2.6} fill={HL2} />
        <Circle cx={22} cy={64} r={2.6} fill={HL2} /><Circle cx={78} cy={64} r={2.6} fill={HL2} />
      </>
    );
  } else if (region === 'balance') {
    // 중앙선 + 좌우 볼 폭(양쪽 끝까지 선) + 볼 강조
    marks = (
      <>
        <Line x1={50} y1={14} x2={50} y2={102} stroke={HL} strokeWidth={1.3} strokeDasharray="4 3" opacity={0.8} />
        <Line x1={50} y1={66} x2={18} y2={66} stroke={HL} strokeWidth={2} />
        <Line x1={50} y1={66} x2={82} y2={66} stroke={HL} strokeWidth={2} />
        <Ellipse cx={26} cy={66} rx={7} ry={9} fill={HL2} opacity={0.35} />
        <Ellipse cx={74} cy={66} rx={7} ry={9} fill={HL2} opacity={0.35} />
      </>
    );
  } else if (region === 'dark_circle') {
    // 양쪽 눈 밑 강조(반달)
    marks = (
      <>
        <Path d="M31 55 Q37 62 43 55" stroke={HL} strokeWidth={2.4} fill="none" strokeLinecap="round" />
        <Path d="M57 55 Q63 62 69 55" stroke={HL} strokeWidth={2.4} fill="none" strokeLinecap="round" />
        <Ellipse cx={37} cy={57} rx={6} ry={3} fill={HL} opacity={0.28} />
        <Ellipse cx={63} cy={57} rx={6} ry={3} fill={HL} opacity={0.28} />
      </>
    );
  } else if (region === 'wrinkle') {
    // 이마·미간·눈가·팔자
    marks = (
      <>
        {/* 이마 */}
        <Line x1={36} y1={28} x2={64} y2={28} stroke={HL} strokeWidth={2} strokeLinecap="round" />
        <Line x1={38} y1={33} x2={62} y2={33} stroke={HL} strokeWidth={1.6} strokeLinecap="round" opacity={0.8} />
        {/* 미간 */}
        <Line x1={48} y1={40} x2={48} y2={46} stroke={HL} strokeWidth={1.6} strokeLinecap="round" />
        <Line x1={52} y1={40} x2={52} y2={46} stroke={HL} strokeWidth={1.6} strokeLinecap="round" />
        {/* 눈가 */}
        <Line x1={28} y1={49} x2={23} y2={47} stroke={HL} strokeWidth={1.6} strokeLinecap="round" />
        <Line x1={72} y1={49} x2={77} y2={47} stroke={HL} strokeWidth={1.6} strokeLinecap="round" />
        {/* 팔자 */}
        <Path d="M44 60 Q40 72 38 82" stroke={HL} strokeWidth={2} fill="none" strokeLinecap="round" />
        <Path d="M56 60 Q60 72 62 82" stroke={HL} strokeWidth={2} fill="none" strokeLinecap="round" />
      </>
    );
  }

  return (
    <Svg width={w} height={h} viewBox="0 0 100 120">
      <BaseFace />
      {marks}
    </Svg>
  );
}
