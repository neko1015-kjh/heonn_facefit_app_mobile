import { Feather } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Text from './AppText';
import { sendGuideFrame } from '../api';
import { colors, radius } from '../theme';

// 앱 안에서 직접 카메라를 띄워 얼굴을 촬영하는 화면입니다.
// - 화면 가운데 타원 가이드 안에 얼굴을 맞추도록 안내
// - 1.5초마다 미리보기 한 장을 서버로 보내 "얼굴 인식·위치·정면"을 실시간 안내
// - 촬영 버튼을 누르면 사진(uri)을 부모(스캔 화면)로 전달해 분석을 진행
export default function CameraCapture({
  onCapture,
  onClose,
}: {
  onCapture: (uri: string) => void;
  onClose: () => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const camRef = useRef<CameraView>(null);
  const [hint, setHint] = useState('얼굴을 타원 안에 맞춰주세요');
  const [ok, setOk] = useState(false);
  const [ready, setReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null); // 3·2·1 자동촬영 카운트
  const busyRef = useRef(false); // 가이드 요청이 진행 중이면 중복 호출 방지
  const aliveRef = useRef(true); // 화면이 닫힌 뒤 상태 업데이트 방지
  const countingRef = useRef(false); // 카운트다운 중이면 가이드 프레임 멈춤(카메라 충돌 방지)
  const capturingRef = useRef(false); // capturing 최신값을 콜백에서 읽기 위한 ref

  // 권한이 없으면 자동으로 한 번 요청합니다.
  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) requestPermission();
  }, [permission, requestPermission]);

  // 1.5초마다 미리보기 프레임을 서버로 보내 실시간 가이드를 받습니다.
  useEffect(() => {
    aliveRef.current = true;
    const id = setInterval(async () => {
      // 촬영 중이거나 카운트다운 중이면 가이드 프레임을 멈춰 카메라 충돌을 막습니다.
      if (busyRef.current || !ready || capturing || countingRef.current || !camRef.current) return;
      busyRef.current = true;
      try {
        const shot = await camRef.current.takePictureAsync({ quality: 0.25, skipProcessing: true });
        if (shot?.uri && aliveRef.current) {
          const r = await sendGuideFrame(shot.uri);
          if (aliveRef.current && r.hint) {
            setHint(r.hint);
            setOk(r.ok);
          }
        }
      } catch {
        // 프레임 한 장 실패는 무시(다음 주기에 다시)
      } finally {
        busyRef.current = false;
      }
    }, 1500);
    return () => {
      aliveRef.current = false;
      clearInterval(id);
    };
  }, [ready, capturing]);

  // [자동 촬영] 얼굴이 타원 안에 잘 맞으면(ok) 3·2·1 카운트다운을 시작합니다.
  // 정렬이 깨지면 즉시 취소. 0이 되면 자동으로 촬영합니다.
  useEffect(() => {
    if (capturing) return;
    if (ok && countdown === null) {
      countingRef.current = true;
      setCountdown(3);
    } else if (!ok && countdown !== null) {
      countingRef.current = false;
      setCountdown(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ok, capturing]);

  // 카운트다운 진행(약 0.7초 간격). 0이 되면 촬영.
  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      capture();
      return;
    }
    const t = setTimeout(() => {
      setCountdown((c) => (c === null ? null : c - 1));
    }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown]);

  // 실제 촬영: 고화질로 한 장 찍어 부모(스캔 화면)에게 전달 → 분석으로 이어집니다.
  // 가이드 프레임과 충돌하지 않도록 진행 중인 프레임이 끝날 때까지 잠깐 기다리고, 실패 시 한 번 재시도합니다.
  async function capture() {
    if (!camRef.current || capturingRef.current) return;
    capturingRef.current = true;
    countingRef.current = false;
    setCapturing(true);
    setCountdown(null);
    // 진행 중인 가이드 프레임이 있으면 끝날 때까지 잠깐 대기(최대 ~0.6초)
    for (let i = 0; i < 10 && busyRef.current; i++) {
      await new Promise((r) => setTimeout(r, 60));
    }
    const takeOnce = async () => {
      const shot = await camRef.current!.takePictureAsync({ quality: 0.8, skipProcessing: false });
      return shot?.uri || null;
    };
    try {
      let uri = await takeOnce();
      if (!uri) {
        await new Promise((r) => setTimeout(r, 200));
        uri = await takeOnce(); // 한 번 재시도
      }
      if (uri) {
        onCapture(uri); // → 부모가 카메라를 닫고 분석을 시작
        return;
      }
      throw new Error('촬영 결과 없음');
    } catch {
      // 실패하면 다시 찍을 수 있게 상태 복구 + 안내
      capturingRef.current = false;
      setCapturing(false);
      setHint('촬영에 실패했어요. 다시 시도해 주세요.');
      setOk(false);
    }
  }

  if (!permission) {
    return <View style={styles.fill} />;
  }
  if (!permission.granted) {
    return (
      <View style={[styles.fill, styles.center]}>
        <Feather name="camera-off" size={40} color={colors.textMuted} />
        <Text style={styles.permText}>카메라 권한이 필요해요.{'\n'}설정에서 허용하거나 아래 버튼을 눌러주세요.</Text>
        <Pressable style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>카메라 권한 허용</Text>
        </Pressable>
        <Pressable onPress={onClose} hitSlop={10}>
          <Text style={styles.closeText}>닫기</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.fill}>
      <CameraView
        ref={camRef}
        style={styles.fill}
        facing="front"
        animateShutter={false}
        onCameraReady={() => setReady(true)}
      />

      {/* 얼굴 가이드 타원 (정렬되면 초록색으로) + 자동촬영 카운트다운 숫자 */}
      <View style={styles.overlay} pointerEvents="none">
        <View style={[styles.oval, ok && styles.ovalOk]}>
          {countdown !== null && countdown > 0 && (
            <Text style={styles.countNum}>{countdown}</Text>
          )}
        </View>
      </View>

      {/* 상단: 닫기 + 실시간 안내 */}
      <View style={styles.topBar} pointerEvents="box-none">
        <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={10}>
          <Feather name="x" size={22} color="#fff" />
        </Pressable>
        <View style={[styles.hintPill, ok && styles.hintPillOk]}>
          <Feather name={ok ? 'check-circle' : 'info'} size={14} color={ok ? colors.bg : '#fff'} />
          <Text style={[styles.hintText, ok && styles.hintTextOk]}>{hint}</Text>
        </View>
      </View>

      {/* 하단: 촬영 버튼 */}
      <View style={styles.bottomBar} pointerEvents="box-none">
        <Text style={styles.bottomHint}>
          {capturing
            ? '촬영 중…'
            : countdown !== null
              ? `${countdown}초 뒤 자동 촬영 · 가만히 계세요`
              : ok
                ? '곧 자동 촬영돼요 · 직접 찍어도 됩니다'
                : '타원 안에 얼굴을 맞춰주세요'}
        </Text>
        <Pressable
          style={[styles.shutter, ok && styles.shutterOk, capturing && styles.shutterDim]}
          onPress={capture}
          disabled={capturing}
        >
          <View style={[styles.shutterInner, ok && styles.shutterInnerOk]} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#000' },
  center: { justifyContent: 'center', alignItems: 'center', gap: 14, padding: 30 },
  permText: { color: colors.text, fontSize: 14, textAlign: 'center', lineHeight: 21 },
  permBtn: {
    backgroundColor: colors.amber500,
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: radius.md,
  },
  permBtnText: { color: colors.bg, fontWeight: '700', fontSize: 14 },
  closeText: { color: colors.textMuted, fontSize: 14, marginTop: 6 },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' },
  oval: {
    width: 250,
    height: 330,
    borderRadius: 165,
    borderWidth: 3,
    borderColor: 'rgba(251,191,36,0.9)',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ovalOk: { borderColor: colors.emerald, borderStyle: 'solid' },
  countNum: {
    fontSize: 110,
    fontWeight: '800',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowRadius: 12,
  },
  topBar: { position: 'absolute', top: 50, left: 0, right: 0, alignItems: 'center', gap: 12, paddingHorizontal: 16 },
  closeBtn: {
    position: 'absolute',
    top: 0,
    left: 16,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  hintPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: radius.full,
    maxWidth: '85%',
  },
  hintPillOk: { backgroundColor: colors.emerald },
  hintText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  hintTextOk: { color: colors.bg, fontWeight: '700' },
  bottomBar: { position: 'absolute', bottom: 44, left: 0, right: 0, alignItems: 'center', gap: 14 },
  bottomHint: { color: '#fff', fontSize: 13, fontWeight: '600', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 4 },
  shutter: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shutterOk: { borderColor: colors.emerald },
  shutterDim: { opacity: 0.5 },
  shutterInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#fff' },
  shutterInnerOk: { backgroundColor: colors.emerald },
});
