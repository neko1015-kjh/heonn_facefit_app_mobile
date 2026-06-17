import { Feather } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  AppState,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import Text from '../components/AppText';
import { cancelNotification, ensureNotificationPermission, scheduleCareNotification } from '../notify';
import { colors, radius } from '../theme';

// 부위별 마사지 가이드 단계입니다.
// duration: 부위별 기본 권장 시간(초). marker: 얼굴 그림(200x250) 위 표시 위치.
const GUIDE_STEPS = [
  {
    area: '턱선 (교근)',
    duration: 60,
    desc: '턱 끝에서 귀 방향으로 턱선을 따라 부드럽게 위로 쓸어 올려요.',
    marker: { x: 60, y: 196 },
  },
  {
    area: '광대',
    duration: 45,
    desc: '광대 아래에서 바깥·위 방향으로 결을 따라 밀어 올려요.',
    marker: { x: 56, y: 120 },
  },
  {
    area: '코 옆 (팔자)',
    duration: 30,
    desc: '콧볼 옆에서 광대 방향으로 부드럽게 쓸어 올려요.',
    marker: { x: 86, y: 140 },
  },
  {
    area: '이마',
    duration: 40,
    desc: '눈썹 위에서 헤어라인 쪽으로 위로 펴 올리듯 풀어줘요.',
    marker: { x: 100, y: 46 },
  },
  {
    area: '눈가 · 관자놀이',
    duration: 30,
    desc: '눈꼬리에서 관자놀이로 가볍게 쓸어 마무리해요.',
    marker: { x: 148, y: 104 },
  },
];

// 진동 모드 + 설명
const MODES = [
  { name: '릴렉스', desc: '약한 진동·은은한 온열로 근육 긴장을 풀어주는 모드예요.' },
  { name: '탄력 UP', desc: '강약 반복 진동으로 탄력·혈색 개선을 돕는 모드예요.' },
  { name: '집중', desc: '강한 진동으로 뭉친 부위를 집중적으로 풀어주는 모드예요.' },
  { name: '부기', desc: '림프 흐름을 따라 부기 완화를 돕는 모드예요.' },
];

const TEMP_MIN = 1;
const TEMP_MAX = 45;

// 온도에 따른 막대 색 (30°C 이하 amber, 30→45 빨강으로)
function tempColor(t: number) {
  if (t <= 30) return '#f59e0b';
  const ratio = Math.min(1, (t - 30) / 15);
  const r = Math.round(245 + (239 - 245) * ratio);
  const g = Math.round(158 + (68 - 158) * ratio);
  const b = Math.round(11 + (68 - 11) * ratio);
  return `rgb(${r}, ${g}, ${b})`;
}

// 초 → mm:ss
function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// 탭을 벗어나도(컴포넌트가 사라져도) 타이머가 이어지도록 모듈 단위로 상태를 보관합니다.
// (시각(endTime) 기준으로 계산하므로, 다른 탭/백그라운드에 있어도 시간이 흐릅니다.)
const careTimer = {
  stepIndex: 0,
  endTime: 0, // 현재 단계가 끝나는 시각(ms). 0이면 대기.
  running: false,
  notifId: null as string | null,
};

export default function CareScreen() {
  const [stepIndex, setStepIndex] = useState(careTimer.stepIndex);
  const [remaining, setRemaining] = useState(GUIDE_STEPS[careTimer.stepIndex].duration);
  const [running, setRunning] = useState(careTimer.running);
  const [temp, setTemp] = useState(17); // 기본 온도 17°C
  const [trackWidth, setTrackWidth] = useState(0);
  const [activeMode, setActiveMode] = useState(-1); // 아직 선택 안 함
  const [syncing, setSyncing] = useState(false); // "설정값 셋팅" 로딩
  const [showNext, setShowNext] = useState(false); // 다음 부위 안내 팝업
  const [allDone, setAllDone] = useState(false); // 전체 완료

  const pulse = useRef(new Animated.Value(0)).current;
  const step = GUIDE_STEPS[stepIndex];

  // 마커 깜빡임(맥박) 애니메이션
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.in(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  // 현재 단계가 끝났을 때 처리
  function finishStep() {
    careTimer.running = false;
    cancelNotification(careTimer.notifId);
    careTimer.notifId = null;
    setRunning(false);
    setRemaining(0);
    setShowNext(true);
  }

  // 화면이 열릴 때: 모듈에 저장된 진행 상황을 복원합니다(다른 탭 갔다 와도 이어짐).
  useEffect(() => {
    setStepIndex(careTimer.stepIndex);
    if (careTimer.running) {
      const left = Math.ceil((careTimer.endTime - Date.now()) / 1000);
      if (left <= 0) finishStep();
      else {
        setRemaining(left);
        setRunning(true);
      }
    } else {
      setRemaining(GUIDE_STEPS[careTimer.stepIndex].duration);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 1초마다 남은 시간 갱신 (시각 기준으로 계산)
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const left = Math.ceil((careTimer.endTime - Date.now()) / 1000);
      if (left <= 0) finishStep();
      else setRemaining(left);
    }, 500);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  // 백그라운드에서 돌아왔을 때 남은 시간 다시 계산
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active' && careTimer.running) {
        const left = Math.ceil((careTimer.endTime - Date.now()) / 1000);
        if (left <= 0) finishStep();
        else setRemaining(left);
      }
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 카운트다운 시작 (온도/모드를 선택했을 때)
  async function startCountdown() {
    if (careTimer.running) return;
    const dur = remaining > 0 ? remaining : step.duration;
    careTimer.endTime = Date.now() + dur * 1000;
    careTimer.running = true;
    careTimer.stepIndex = stepIndex;
    setRunning(true);
    const granted = await ensureNotificationPermission();
    if (granted) {
      careTimer.notifId = await scheduleCareNotification(
        dur,
        '부위 케어 완료',
        `${step.area} 케어가 끝났어요. 다음 부위로 이동하세요.`
      );
    }
  }

  // 온도/모드 선택 시: 기기 동기화 로딩 표시 + (대기 중이면) 카운트다운 시작
  function applySetting() {
    setSyncing(true);
    setTimeout(() => setSyncing(false), 1500);
    startCountdown();
  }

  // 다음 부위로 이동
  async function goNext() {
    setShowNext(false);
    const ni = stepIndex + 1;
    if (ni >= GUIDE_STEPS.length) {
      careTimer.stepIndex = 0;
      careTimer.running = false;
      careTimer.endTime = 0;
      setStepIndex(0);
      setRemaining(GUIDE_STEPS[0].duration);
      setRunning(false);
      setAllDone(true);
      return;
    }
    const dur = GUIDE_STEPS[ni].duration;
    setStepIndex(ni);
    setRemaining(dur);
    careTimer.stepIndex = ni;
    careTimer.endTime = Date.now() + dur * 1000;
    careTimer.running = true;
    setRunning(true);
    const granted = await ensureNotificationPermission();
    if (granted) {
      careTimer.notifId = await scheduleCareNotification(
        dur,
        '부위 케어 완료',
        `${GUIDE_STEPS[ni].area} 케어가 끝났어요. 다음 부위로 이동하세요.`
      );
    }
  }

  function updateTempFromTouch(locationX: number) {
    if (trackWidth <= 0) return;
    let ratio = locationX / trackWidth;
    ratio = Math.max(0, Math.min(1, ratio));
    setTemp(Math.round(TEMP_MIN + ratio * (TEMP_MAX - TEMP_MIN)));
  }

  const tempPercent = ((temp - TEMP_MIN) / (TEMP_MAX - TEMP_MIN)) * 100;
  const markerScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] });
  const markerOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] });

  return (
    <View style={styles.container}>
      {/* 상단: 제목 + 카운트다운 */}
      <View style={styles.header}>
        <Text style={styles.headerText}>실시간 맞춤 케어</Text>
        <View style={[styles.timer, running && styles.timerActive]}>
          <Feather name="clock" size={12} color={running ? colors.bg : colors.amber400} />
          <Text style={[styles.timerText, running && { color: colors.bg }]}>{fmt(remaining)}</Text>
        </View>
      </View>

      {/* 단계 표시 */}
      <View style={styles.stepRow}>
        {GUIDE_STEPS.map((_, i) => (
          <View key={i} style={[styles.stepDot, i === stepIndex && styles.stepDotActive]} />
        ))}
      </View>

      {/* 가운데: 얼굴 그림 + 부위 표시(가이드 이미지) */}
      <View style={styles.center}>
        <View style={styles.faceArea}>
          {/* 얼굴 윤곽 */}
          <View style={styles.faceOval} />
          {/* 눈 */}
          <View style={[styles.eye, { left: 66, top: 92 }]} />
          <View style={[styles.eye, { left: 124, top: 92 }]} />
          {/* 코 */}
          <View style={styles.nose} />
          {/* 입 */}
          <View style={styles.mouth} />

          {/* 현재 부위 표시 마커 (맥박 + 점) */}
          <Animated.View
            style={[
              styles.markerPulse,
              { left: step.marker.x - 20, top: step.marker.y - 20, transform: [{ scale: markerScale }], opacity: markerOpacity },
            ]}
          />
          <View style={[styles.markerDot, { left: step.marker.x - 9, top: step.marker.y - 9 }]}>
            <Feather name="arrow-up" size={14} color={colors.bg} />
          </View>
        </View>

        {/* 부위 이름 + 설명 (가이드) */}
        <Text style={styles.stepArea}>
          {stepIndex + 1}/{GUIDE_STEPS.length} · {step.area}
        </Text>
        <Text style={styles.stepDesc}>{step.desc}</Text>
        <Text style={styles.stepHint}>
          {running ? '온열·진동으로 케어 중이에요' : '아래에서 온도나 모드를 선택하면 시작돼요'}
        </Text>
      </View>

      {/* 하단 제어 패널 */}
      <View style={styles.panel}>
        {/* 온도 제어 */}
        <View style={styles.panelRow}>
          <View style={styles.panelTitleRow}>
            <Feather name="thermometer" size={18} color={colors.amber500} />
            <Text style={styles.panelTitle}>방짜유기 온도 제어</Text>
          </View>
          <Text style={[styles.panelValue, { color: tempColor(temp), fontWeight: '700' }]}>{temp}°C</Text>
        </View>
        <View
          style={styles.tempTrack}
          onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderGrant={(e) => updateTempFromTouch(e.nativeEvent.locationX)}
          onResponderMove={(e) => updateTempFromTouch(e.nativeEvent.locationX)}
          onResponderRelease={applySetting}
        >
          <View style={[styles.tempFill, { width: `${tempPercent}%`, backgroundColor: tempColor(temp) }]} />
          <View style={[styles.tempThumb, { left: `${tempPercent}%` }]} />
        </View>
        <Text style={styles.tempMax}>1°C ~ 45°C (화상 방지)</Text>

        {/* 진동 모드 */}
        <View style={styles.modeTitleRow}>
          <Feather name="activity" size={18} color={colors.amber500} />
          <Text style={styles.panelTitle}>진동 모드</Text>
        </View>
        <View style={styles.modeGrid}>
          {MODES.map((mode, idx) => {
            const active = idx === activeMode;
            return (
              <Pressable
                key={mode.name}
                style={[styles.modeBtn, active && styles.modeBtnActive]}
                onPress={() => {
                  setActiveMode(idx);
                  applySetting();
                }}
              >
                <Text style={[styles.modeText, active && styles.modeTextActive]}>{mode.name}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.modeDescBox}>
          <Text style={styles.modeDescText}>
            {activeMode >= 0 ? MODES[activeMode].desc : '진동 모드를 선택해 주세요.'}
          </Text>
        </View>
      </View>

      {/* 설정 동기화 로딩 */}
      <Modal visible={syncing} transparent animationType="fade">
        <View style={styles.syncOverlay}>
          <View style={styles.syncCard}>
            <ActivityIndicator size="large" color={colors.amber400} />
            <Text style={styles.syncText}>HeOnn Facefit에 설정된 값을 셋팅합니다…</Text>
          </View>
        </View>
      </Modal>

      {/* 단계 종료 → 다음 부위 안내 */}
      <Modal visible={showNext} transparent animationType="fade" onRequestClose={() => setShowNext(false)}>
        <View style={styles.syncOverlay}>
          <View style={styles.nextCard}>
            <Feather name="check-circle" size={32} color={colors.emerald} />
            <Text style={styles.nextTitle}>{step.area} 케어 완료!</Text>
            <Text style={styles.nextBody}>
              {stepIndex + 1 < GUIDE_STEPS.length
                ? `다음은 '${GUIDE_STEPS[stepIndex + 1].area}' 부위예요. 이어서 진행할까요?`
                : '모든 부위 케어를 마쳤어요. 수고하셨어요!'}
            </Text>
            <Pressable style={styles.nextBtn} onPress={goNext}>
              <Text style={styles.nextBtnText}>
                {stepIndex + 1 < GUIDE_STEPS.length ? '다음 부위 시작' : '완료'}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* 전체 완료 */}
      <Modal visible={allDone} transparent animationType="fade" onRequestClose={() => setAllDone(false)}>
        <View style={styles.syncOverlay}>
          <View style={styles.nextCard}>
            <Feather name="award" size={32} color={colors.amber400} />
            <Text style={styles.nextTitle}>오늘의 케어 완료 🎉</Text>
            <Text style={styles.nextBody}>모든 부위 마사지를 마쳤어요. 꾸준히 하면 변화가 보여요!</Text>
            <Pressable style={styles.nextBtn} onPress={() => setAllDone(false)}>
              <Text style={styles.nextBtnText}>확인</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingBottom: 100 },
  header: {
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerText: { color: colors.text, fontWeight: '500', fontSize: 16 },
  timer: {
    backgroundColor: colors.surface2,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timerActive: { backgroundColor: colors.amber400 },
  timerText: { color: colors.amber400, fontSize: 14, fontWeight: '700' },
  stepRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 4 },
  stepDot: { width: 7, height: 7, borderRadius: radius.full, backgroundColor: colors.surface2 },
  stepDotActive: { backgroundColor: colors.amber400, width: 18 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  faceArea: { width: 200, height: 250, position: 'relative', marginBottom: 8 },
  faceOval: {
    position: 'absolute',
    left: 25,
    top: 18,
    width: 150,
    height: 210,
    borderRadius: 100,
    borderWidth: 2,
    borderColor: colors.border2,
    backgroundColor: colors.surface,
  },
  eye: { position: 'absolute', width: 10, height: 10, borderRadius: 5, backgroundColor: colors.textFaint },
  nose: {
    position: 'absolute',
    left: 98,
    top: 110,
    width: 4,
    height: 26,
    borderRadius: 2,
    backgroundColor: colors.textFainter,
  },
  mouth: {
    position: 'absolute',
    left: 82,
    top: 158,
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.textFainter,
  },
  markerPulse: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(245,158,11,0.5)',
  },
  markerDot: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.amber500,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepArea: { color: colors.amber400, fontSize: 16, fontWeight: '700', marginTop: 4 },
  stepDesc: {
    color: colors.text,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 6,
    paddingHorizontal: 8,
  },
  stepHint: { color: colors.textFaint, fontSize: 12, marginTop: 8 },
  panel: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: 24,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  panelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  panelTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  panelTitle: { color: colors.text, fontWeight: '500', fontSize: 15 },
  panelValue: { color: colors.textMuted, fontSize: 14 },
  tempTrack: {
    width: '100%',
    height: 16,
    backgroundColor: colors.surface2,
    borderRadius: radius.full,
    marginBottom: 8,
    justifyContent: 'center',
  },
  tempFill: { position: 'absolute', left: 0, height: 16, width: '40%', backgroundColor: colors.amber500, borderRadius: radius.full },
  tempThumb: {
    position: 'absolute',
    top: -2,
    left: '40%',
    width: 20,
    height: 20,
    borderRadius: radius.full,
    backgroundColor: colors.text,
    borderWidth: 4,
    borderColor: colors.surface,
    marginLeft: -10,
  },
  tempMax: { color: colors.textFainter, fontSize: 11, textAlign: 'right', marginBottom: 20 },
  modeTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  modeGrid: { flexDirection: 'row', gap: 8 },
  modeBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.md,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
  },
  modeBtnActive: { backgroundColor: 'rgba(245,158,11,0.2)', borderColor: 'rgba(245,158,11,0.5)' },
  modeText: { color: colors.textMuted, fontSize: 12, fontWeight: '500' },
  modeTextActive: { color: colors.amber400 },
  modeDescBox: {
    marginTop: 12,
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.25)',
    padding: 14,
  },
  modeDescText: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  // 공통 오버레이 (동기화/안내 팝업)
  syncOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  syncCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border2,
    paddingVertical: 28,
    paddingHorizontal: 28,
    alignItems: 'center',
    gap: 16,
    maxWidth: 320,
  },
  syncText: { color: colors.text, fontSize: 14, fontWeight: '500', textAlign: 'center' },
  nextCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border2,
    padding: 24,
    alignItems: 'center',
    gap: 12,
    width: '100%',
    maxWidth: 340,
  },
  nextTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  nextBody: { color: colors.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  nextBtn: {
    marginTop: 8,
    backgroundColor: colors.amber500,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: radius.md,
    width: '100%',
    alignItems: 'center',
  },
  nextBtnText: { color: colors.bg, fontSize: 15, fontWeight: '700' },
});
