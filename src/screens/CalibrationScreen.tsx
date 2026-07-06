import { Feather } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Ellipse, Line, Path } from 'react-native-svg';
import Text from '../components/AppText';
import { CalibrationPoint } from '../api';
import { colors, radius } from '../theme';

// [기기 셋팅 가이드] 첫 블루투스 연결 후 '위치 포인트 데이터'가 없을 때 보여줍니다.
// 얼굴 부위별로 방향 애니메이션을 보여주고, '포인트 잡기'로 각 부위 포인트를 잡습니다.
// (실제 센서 연동 전까지는 사용자가 동작을 따라 하고 포인트를 저장하는 안내 흐름입니다.)

const BOX_W = 240;
const BOX_H = 300;
const FAINT = 'rgba(161,161,170,0.35)';
const HL = colors.amber400;

// 애니메이션 화살표 하나(방향 반복 이동)
type Arrow = { x: number; y: number; dx?: number; dy?: number; dir: 'down' | 'right' };

type Step = {
  key: string;
  title: string;
  desc: string;
  marks: React.ReactNode; // 강조 부위(SVG)
  arrows: Arrow[];
};

// 얼굴 도식(흐리게) — 모든 단계 공통
function BaseFace() {
  return (
    <>
      <Ellipse cx={120} cy={150} rx={86} ry={112} stroke={FAINT} strokeWidth={2} fill="none" />
      <Ellipse cx={90} cy={128} rx={12} ry={7} stroke={FAINT} strokeWidth={1.5} fill="none" />
      <Ellipse cx={150} cy={128} rx={12} ry={7} stroke={FAINT} strokeWidth={1.5} fill="none" />
      <Line x1={120} y1={135} x2={120} y2={168} stroke={FAINT} strokeWidth={1.5} />
      <Line x1={102} y1={200} x2={138} y2={200} stroke={FAINT} strokeWidth={1.5} />
    </>
  );
}

const STEPS: Step[] = [
  {
    key: 'jaw_left',
    title: '① 왼쪽 턱선',
    desc: '왼쪽 턱을 위에서 아래로 쓸어내리며 기기를 대주세요.',
    marks: <Path d="M60 150 Q58 200 96 236" stroke={HL} strokeWidth={4} fill="none" strokeLinecap="round" />,
    arrows: [{ x: 58, y: 150, dy: 78, dir: 'down' }],
  },
  {
    key: 'jaw_right',
    title: '② 오른쪽 턱선',
    desc: '오른쪽 턱을 위에서 아래로 쓸어내리며 기기를 대주세요.',
    marks: <Path d="M180 150 Q182 200 144 236" stroke={HL} strokeWidth={4} fill="none" strokeLinecap="round" />,
    arrows: [{ x: 176, y: 150, dy: 78, dir: 'down' }],
  },
  {
    key: 'cheeks',
    title: '③ 양쪽 볼',
    desc: '양쪽 볼을 위에서 아래로 쓸어내리며 기기를 대주세요.',
    marks: (
      <>
        <Ellipse cx={82} cy={165} rx={16} ry={26} stroke={HL} strokeWidth={3.5} fill="none" />
        <Ellipse cx={158} cy={165} rx={16} ry={26} stroke={HL} strokeWidth={3.5} fill="none" />
      </>
    ),
    arrows: [
      { x: 82, y: 138, dy: 54, dir: 'down' },
      { x: 158, y: 138, dy: 54, dir: 'down' },
    ],
  },
  {
    key: 'under_eyes',
    title: '④ 양쪽 눈 밑',
    desc: '양쪽 눈 밑을 안쪽에서 바깥쪽(왼→오른쪽)으로 쓸어주세요.',
    marks: (
      <>
        <Line x1={78} y1={146} x2={104} y2={146} stroke={HL} strokeWidth={4} strokeLinecap="round" />
        <Line x1={136} y1={146} x2={162} y2={146} stroke={HL} strokeWidth={4} strokeLinecap="round" />
      </>
    ),
    arrows: [
      { x: 74, y: 138, dx: 34, dir: 'right' },
      { x: 132, y: 138, dx: 34, dir: 'right' },
    ],
  },
];

type Props = {
  onDone: (points: CalibrationPoint[]) => void;
  onSkip: () => void;
};

export default function CalibrationScreen({ onDone, onSkip }: Props) {
  const [step, setStep] = useState(0);
  const [captured, setCaptured] = useState<CalibrationPoint[]>([]);
  const [justCaptured, setJustCaptured] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;

  const cur = STEPS[step];

  // 화살표 반복 이동 애니메이션
  useEffect(() => {
    anim.setValue(0);
    const loop = Animated.loop(
      Animated.timing(anim, {
        toValue: 1,
        duration: 1300,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [step, anim]);

  // '포인트 잡기': 현재 단계 포인트를 기록하고 다음으로.
  function capturePoint() {
    if (justCaptured) return;
    const point: CalibrationPoint = { step: cur.key, capturedAt: new Date().toISOString() };
    const next = [...captured, point];
    setCaptured(next);
    setJustCaptured(true);
    setTimeout(() => {
      setJustCaptured(false);
      if (step >= STEPS.length - 1) {
        onDone(next); // 4단계 완료 → 저장 후 홈으로
      } else {
        setStep((s) => s + 1);
      }
    }, 650);
  }

  return (
    <View style={styles.container}>
      {/* 상단: 제목 + 진행 */}
      <View style={styles.header}>
        <Text style={styles.kicker}>기기 셋팅 · 위치 포인트 잡기</Text>
        <Text style={styles.title}>{cur.title}</Text>
        <Text style={styles.desc}>{cur.desc}</Text>
      </View>

      {/* 진행 점 (4단계) */}
      <View style={styles.dots}>
        {STEPS.map((s, i) => (
          <View
            key={s.key}
            style={[styles.dot, i === step && styles.dotOn, i < step && styles.dotDone]}
          />
        ))}
      </View>

      {/* 얼굴 도식 + 강조 부위 + 방향 화살표 */}
      <View style={styles.faceWrap}>
        <View style={{ width: BOX_W, height: BOX_H }}>
          <Svg width={BOX_W} height={BOX_H} viewBox={`0 0 ${BOX_W} ${BOX_H}`}>
            <BaseFace />
            {cur.marks}
          </Svg>
          {/* 방향 화살표(반복 이동) */}
          {cur.arrows.map((a, idx) => {
            const translateY =
              a.dir === 'down'
                ? anim.interpolate({ inputRange: [0, 1], outputRange: [0, a.dy ?? 0] })
                : 0;
            const translateX =
              a.dir === 'right'
                ? anim.interpolate({ inputRange: [0, 1], outputRange: [0, a.dx ?? 0] })
                : 0;
            const opacity = anim.interpolate({ inputRange: [0, 0.15, 0.85, 1], outputRange: [0, 1, 1, 0] });
            return (
              <Animated.View
                key={idx}
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: a.x - 12,
                  top: a.y - 12,
                  opacity,
                  transform: [{ translateX }, { translateY }],
                }}
              >
                <Feather name={a.dir === 'down' ? 'chevrons-down' : 'chevrons-right'} size={26} color={HL} />
              </Animated.View>
            );
          })}
        </View>
      </View>

      {/* 하단: 포인트 잡기 버튼 + 건너뛰기 */}
      <View style={styles.footer}>
        <Pressable
          style={[styles.captureBtn, justCaptured && styles.captureBtnDone]}
          onPress={capturePoint}
          disabled={justCaptured}
        >
          <Feather name={justCaptured ? 'check' : 'crosshair'} size={18} color={colors.bg} />
          <Text style={styles.captureBtnText}>
            {justCaptured ? '포인트 저장됨' : `포인트 잡기 (${step + 1}/${STEPS.length})`}
          </Text>
        </Pressable>
        <Pressable onPress={onSkip} hitSlop={8}>
          <Text style={styles.skip}>나중에 설정</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 24 },
  header: { paddingTop: 40, alignItems: 'center' },
  kicker: { color: colors.amber400, fontSize: 12, fontWeight: '700', marginBottom: 10, letterSpacing: 1 },
  title: { color: colors.text, fontSize: 22, fontWeight: '700', marginBottom: 8 },
  desc: { color: colors.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 21, paddingHorizontal: 10 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 18 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.surface2 },
  dotOn: { backgroundColor: colors.amber400, width: 22 },
  dotDone: { backgroundColor: colors.emerald },
  faceWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  footer: { gap: 16, alignItems: 'center', paddingBottom: 20 },
  captureBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    backgroundColor: colors.amber500,
    paddingVertical: 15,
    borderRadius: radius.md,
  },
  captureBtnDone: { backgroundColor: colors.emerald },
  captureBtnText: { color: colors.bg, fontSize: 16, fontWeight: '700' },
  skip: { color: colors.textMuted, fontSize: 13, textDecorationLine: 'underline' },
});
