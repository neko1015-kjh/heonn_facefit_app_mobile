import { Feather } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Text from './AppText';
import { sendGuideFrame } from '../api';
import { colors, radius } from '../theme';

// 맞춤 헤드용 '다중뷰 가이드 촬영' — 정면 → 옆① → 옆②(반대쪽)를 각도 안내 + 자동 촬영으로 수집합니다.
// 좌/우는 고개를 약 30°만 돌립니다(완전 옆모습이면 얼굴 인식이 안 돼요).
type Uris = { front: string; left: string; right: string };

const STEPS = [
  { key: 'front', label: '① 정면', guide: '정면을 바라보세요' },
  { key: 'side1', label: '② 한쪽으로 30°', guide: '고개를 한쪽으로 약 30° 돌리세요' },
  { key: 'side2', label: '③ 반대쪽으로 30°', guide: '반대쪽으로 약 30° 돌리세요' },
];

export default function MultiViewCapture({
  onDone, onClose,
}: { onDone: (uris: Uris) => void; onClose: () => void }) {
  const [permission, requestPermission] = useCameraPermissions();
  const camRef = useRef<CameraView>(null);
  const [ready, setReady] = useState(false);
  const [step, setStep] = useState(0);
  const [yaw, setYaw] = useState<number | null>(null);
  const [hint, setHint] = useState('');
  const [countdown, setCountdown] = useState<number | null>(null);
  const [capturing, setCapturing] = useState(false);

  const busyRef = useRef(false);
  const aliveRef = useRef(true);
  const countingRef = useRef(false);
  const capturingRef = useRef(false);
  const side1SignRef = useRef(0);
  const shotsRef = useRef<string[]>([]);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) requestPermission();
  }, [permission, requestPermission]);

  // 현재 단계의 목표 자세가 맞는지
  function poseOK(s: number, y: number | null): boolean {
    if (y == null) return false;
    if (s === 0) return Math.abs(y) < 12;                       // 정면
    if (s === 1) return Math.abs(y) >= 18;                      // 한쪽으로 충분히 돌림
    return Math.abs(y) >= 18 && Math.sign(y) === -side1SignRef.current; // 반대쪽
  }

  // 1.2초마다 프레임 → 각도(yaw)·안내 받기 + 자동촬영 판정
  useEffect(() => {
    aliveRef.current = true;
    const id = setInterval(async () => {
      if (busyRef.current || !ready || capturing || countingRef.current || !camRef.current) return;
      busyRef.current = true;
      try {
        const shot = await camRef.current.takePictureAsync({ quality: 0.25, skipProcessing: true });
        if (shot?.uri && aliveRef.current) {
          const r = await sendGuideFrame(shot.uri);
          if (!aliveRef.current) return;
          const y = typeof r.yaw === 'number' ? r.yaw : null;
          setYaw(y);
          if (!r.detected) setHint('얼굴이 보이게 해주세요');
          else if (poseOK(step, y)) { setHint('좋아요! 그대로 유지'); startCountdown(); }
          else setHint(STEPS[step].guide);
        }
      } catch {
        // 무시
      } finally {
        busyRef.current = false;
      }
    }, 1200);
    return () => { aliveRef.current = false; clearInterval(id); };
  }, [ready, capturing, step]);

  const cdRef = useRef<any>(null);
  function startCountdown() {
    if (countingRef.current || capturingRef.current) return;
    countingRef.current = true;
    let n = 3;
    setCountdown(n);
    cdRef.current = setInterval(() => {
      n -= 1;
      if (n <= 0) {
        clearInterval(cdRef.current);
        setCountdown(null);
        capture();
      } else {
        setCountdown(n);
      }
    }, 700);
  }
  async function capture() {
    if (!camRef.current || capturingRef.current) return;
    capturingRef.current = true;
    setCapturing(true);
    for (let i = 0; i < 10 && busyRef.current; i++) await new Promise((r) => setTimeout(r, 60));
    try {
      let shot = await camRef.current.takePictureAsync({ quality: 0.85 });
      if (!shot?.uri) { await new Promise((r) => setTimeout(r, 150)); shot = await camRef.current.takePictureAsync({ quality: 0.85 }); }
      if (!shot?.uri) throw new Error('촬영 실패');
      if (step === 1) side1SignRef.current = Math.sign(yaw || 1) || 1; // 옆① 방향 기억
      shotsRef.current[step] = shot.uri;
      if (step >= STEPS.length - 1) {
        onDone({ front: shotsRef.current[0], left: shotsRef.current[1], right: shotsRef.current[2] });
        return;
      }
      // 다음 단계
      capturingRef.current = false;
      countingRef.current = false;
      setCapturing(false);
      setStep((s) => s + 1);
      setYaw(null);
      setHint(STEPS[step + 1].guide);
    } catch {
      capturingRef.current = false;
      countingRef.current = false;
      setCapturing(false);
      setHint('촬영에 실패했어요. 다시 시도해주세요.');
    }
  }

  if (!permission) return <View style={styles.fill} />;
  if (!permission.granted) {
    return (
      <View style={[styles.fill, styles.center]}>
        <Feather name="camera-off" size={40} color={colors.textMuted} />
        <Text style={styles.permText}>카메라 권한이 필요해요.</Text>
        <Pressable style={styles.permBtn} onPress={requestPermission}><Text style={styles.permBtnText}>권한 허용</Text></Pressable>
        <Pressable onPress={onClose} hitSlop={10}><Text style={styles.closeText}>닫기</Text></Pressable>
      </View>
    );
  }

  const okNow = poseOK(step, yaw);
  return (
    <View style={styles.fill}>
      <CameraView ref={camRef} style={styles.fill} facing="front" animateShutter={false} onCameraReady={() => setReady(true)} />
      <View style={styles.overlay} pointerEvents="none">
        <View style={[styles.oval, okNow && styles.ovalOk]}>
          {countdown != null && <Text style={styles.count}>{countdown}</Text>}
        </View>
      </View>
      <View style={styles.topBar} pointerEvents="box-none">
        <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={10}><Feather name="x" size={22} color="#fff" /></Pressable>
        <View style={styles.steps}>
          {STEPS.map((s, i) => (
            <View key={s.key} style={[styles.dot, i === step && styles.dotOn, i < step && styles.dotDone]} />
          ))}
        </View>
        <View style={[styles.hintPill, okNow && styles.hintPillOk]}>
          <Text style={[styles.hintText, okNow && styles.hintTextOk]}>{STEPS[step].label} · {hint || STEPS[step].guide}</Text>
        </View>
        {yaw != null && <Text style={styles.yaw}>고개 각도 {Math.round(yaw)}°</Text>}
      </View>
      <View style={styles.bottomBar} pointerEvents="box-none">
        <Text style={styles.bottomHint}>정면·좌·우 3장을 자동으로 찍어 맞춤 헤드를 만듭니다</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#000' },
  center: { justifyContent: 'center', alignItems: 'center', gap: 14, padding: 30 },
  permText: { color: colors.text, fontSize: 14, textAlign: 'center' },
  permBtn: { backgroundColor: colors.amber500, paddingVertical: 12, paddingHorizontal: 22, borderRadius: radius.md },
  permBtnText: { color: colors.bg, fontWeight: '700' },
  closeText: { color: colors.textMuted, fontSize: 14 },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' },
  oval: { width: 250, height: 330, borderRadius: 165, borderWidth: 3, borderColor: 'rgba(251,191,36,0.9)', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center' },
  ovalOk: { borderColor: colors.emerald, borderStyle: 'solid' },
  count: { fontSize: 110, fontWeight: '800', color: '#fff', textShadowColor: 'rgba(0,0,0,0.55)', textShadowRadius: 12 },
  topBar: { position: 'absolute', top: 50, left: 0, right: 0, alignItems: 'center', gap: 10, paddingHorizontal: 16 },
  closeBtn: { position: 'absolute', top: 0, left: 16, width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center' },
  steps: { flexDirection: 'row', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.4)' },
  dotOn: { backgroundColor: colors.amber400, width: 22 },
  dotDone: { backgroundColor: colors.emerald },
  hintPill: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: 'rgba(0,0,0,0.6)', paddingVertical: 9, paddingHorizontal: 16, borderRadius: radius.full, maxWidth: '90%' },
  hintPillOk: { backgroundColor: colors.emerald },
  hintText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  hintTextOk: { color: colors.bg, fontWeight: '700' },
  yaw: { color: '#fff', fontSize: 12, textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 4 },
  bottomBar: { position: 'absolute', bottom: 44, left: 0, right: 0, alignItems: 'center' },
  bottomHint: { color: '#fff', fontSize: 13, fontWeight: '600', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 4, paddingHorizontal: 20, textAlign: 'center' },
});
