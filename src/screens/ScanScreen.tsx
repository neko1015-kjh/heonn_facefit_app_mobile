import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Pressable, StyleSheet, View } from 'react-native';
import Text from '../components/AppText';
import { saveScan, FaceScore, LandmarkPoint } from '../api';
import { colors, radius } from '../theme';

// [4] AI 정밀 안면 스캔 화면입니다.
// 사진을 고르면 백엔드로 보내 실제로 얼굴을 분석하고, 그 결과(점 478개·점수)를 기록으로 저장합니다.
// 분석이 끝나면 검출된 특징점 478개를 사진 위에 직접 그려서 보여줍니다.

// 화면 상태: idle(대기) → analyzing(분석 중) → done(완료) → error(오류)
type Status = 'idle' | 'analyzing' | 'done' | 'error';

// 사진을 표시할 영역의 기준 크기
const BOX_W = 300; // 기준 가로
const MAX_H = 380; // 최대 세로(너무 긴 세로 사진 방지)

export default function ScanScreen() {
  const [status, setStatus] = useState<Status>('idle');
  const [imageUri, setImageUri] = useState<string | null>(null); // 고른 사진
  const [landmarks, setLandmarks] = useState<LandmarkPoint[] | null>(null); // 점 좌표(0~1)
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
  const [scores, setScores] = useState<FaceScore[] | null>(null); // 계산된 점수
  const [message, setMessage] = useState(''); // 안내/오류 문구

  // 스캔 라인 위치 애니메이션 값
  const scanLine = useRef(new Animated.Value(0)).current;

  // 분석 중일 때 스캔 라인을 위아래로 반복 이동
  useEffect(() => {
    if (status === 'analyzing') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(scanLine, {
            toValue: 1,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(scanLine, {
            toValue: 0,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [status, scanLine]);

  // "사진 선택 후 분석" 버튼을 눌렀을 때
  async function handlePickAndScan() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setStatus('error');
      setMessage('사진 접근 권한이 필요합니다. 설정에서 허용해 주세요.');
      return;
    }

    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (picked.canceled) return;

    const uri = picked.assets[0].uri;
    setImageUri(uri);
    setScores(null);
    setLandmarks(null);
    setImageSize(null);
    setMessage('');
    setStatus('analyzing');

    try {
      const data = await saveScan(uri);
      if (data.detected && data.record) {
        setScores(data.record.scores);
        setLandmarks(data.landmarks ?? null);
        setImageSize(data.image_size ?? null);
        setStatus('done');
      } else {
        setStatus('error');
        setMessage(data.message || '얼굴을 분석하지 못했습니다.');
      }
    } catch (e) {
      console.log('분석/저장 실패:', e);
      setStatus('error');
      setMessage('백엔드 서버에 연결하지 못했습니다. 서버가 켜져 있는지 확인해 주세요.');
    }
  }

  // 스캔 라인의 세로 위치
  const lineTranslate = scanLine.interpolate({
    inputRange: [0, 1],
    outputRange: [10, 290],
  });

  const isAnalyzing = status === 'analyzing';
  const showLandmarks = status === 'done' && landmarks && imageSize;

  // 사진의 가로세로 비율에 맞춰 표시 크기를 계산합니다(점 위치를 정확히 맞추기 위해).
  let dispW = BOX_W;
  let dispH = BOX_W;
  if (imageSize) {
    const ratio = imageSize.height / imageSize.width;
    if (BOX_W * ratio <= MAX_H) {
      dispW = BOX_W;
      dispH = Math.round(BOX_W * ratio);
    } else {
      dispH = MAX_H;
      dispW = Math.round(MAX_H / ratio);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>AI 정밀 안면 스캔</Text>
      </View>

      <View style={styles.center}>
        {showLandmarks ? (
          // 분석 완료: 사진을 비율에 맞춰 표시하고 그 위에 점 478개를 찍습니다.
          <View style={[styles.landmarkBox, { width: dispW, height: dispH }]}>
            <Image source={{ uri: imageUri! }} style={styles.fill} resizeMode="cover" />
            {landmarks!.map((p, i) => (
              <View
                key={i}
                style={[styles.dot, { left: p.x * dispW - 1, top: p.y * dispH - 1 }]}
              />
            ))}
            <Text style={styles.dotCaption}>특징점 {landmarks!.length}개</Text>
          </View>
        ) : (
          // 대기/분석 중: 정사각형 박스
          <View style={styles.scanBox}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.fill} resizeMode="cover" />
            ) : (
              <View style={[styles.guideCircle, { borderColor: colors.textFainter }]} />
            )}

            {isAnalyzing && (
              <View style={styles.scanOverlay}>
                <Animated.View
                  style={[styles.scanLine, { transform: [{ translateY: lineTranslate }] }]}
                />
                <Text style={styles.scanningText}>얼굴 특징점 분석 중...</Text>
              </View>
            )}
          </View>
        )}

        {/* 상태별 안내 / 결과 표시 */}
        {status === 'idle' && (
          <Text style={styles.guideText}>
            분석할 얼굴 사진을 선택하세요.{'\n'}정면 얼굴이 잘 보이는 사진이 좋아요.
          </Text>
        )}

        {status === 'done' && scores && (
          <View style={styles.resultBox}>
            <View style={styles.resultRow}>
              <Feather name="check-circle" size={18} color={colors.emerald} />
              <Text style={styles.resultTitle}>분석 완료 · 기록 저장됨</Text>
            </View>
            <View style={styles.scoreList}>
              {scores.map((s) => (
                <View key={s.key} style={styles.scoreItem}>
                  <Text style={styles.scoreLabel}>{s.label}</Text>
                  <Text style={styles.scoreValue}>{s.value}점</Text>
                </View>
              ))}
            </View>
            <Text style={styles.hintText}>리포트·마이 탭에서 변화와 추천을 확인하세요.</Text>
          </View>
        )}

        {status === 'error' && (
          <View style={styles.resultBox}>
            <View style={styles.resultRow}>
              <Feather name="alert-circle" size={18} color={colors.red} />
              <Text style={styles.resultTitle}>분석하지 못했어요</Text>
            </View>
            <Text style={styles.resultSub}>{message}</Text>
          </View>
        )}
      </View>

      {/* 하단 버튼 */}
      <View style={styles.footer}>
        <Pressable
          style={[styles.scanButton, isAnalyzing && styles.scanButtonDisabled]}
          onPress={handlePickAndScan}
          disabled={isAnalyzing}
        >
          <View style={styles.scanButtonInner}>
            <Feather
              name={isAnalyzing ? 'activity' : 'camera'}
              size={20}
              color={isAnalyzing ? colors.textFaint : colors.bg}
            />
            <Text style={[styles.scanButtonText, isAnalyzing && { color: colors.textFaint }]}>
              {isAnalyzing ? '분석 중...' : status === 'idle' ? '사진 선택 후 분석' : '다른 사진으로 다시'}
            </Text>
          </View>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingBottom: 100,
  },
  header: {
    padding: 20,
    alignItems: 'center',
  },
  headerText: {
    color: colors.text,
    fontWeight: '500',
    fontSize: 16,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  scanBox: {
    width: 300,
    height: 300,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  landmarkBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  fill: {
    width: '100%',
    height: '100%',
  },
  // 얼굴 위에 찍는 작은 점
  dot: {
    position: 'absolute',
    width: 2.5,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: colors.amber400,
    opacity: 0.85,
  },
  dotCaption: {
    position: 'absolute',
    bottom: 8,
    right: 10,
    color: colors.amber400,
    fontSize: 11,
    fontWeight: '500',
    backgroundColor: 'rgba(9,9,11,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: 'hidden',
  },
  guideCircle: {
    width: 180,
    height: 220,
    borderRadius: 110,
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  scanOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(245,158,11,0.12)',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 60,
  },
  scanLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: colors.amber400,
  },
  scanningText: {
    color: colors.amber400,
    fontWeight: '500',
    fontSize: 13,
  },
  guideText: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 32,
  },
  resultBox: {
    marginTop: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 16,
    width: '100%',
    alignItems: 'center',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  resultTitle: {
    color: colors.text,
    fontWeight: '500',
    fontSize: 15,
  },
  resultSub: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
  scoreList: {
    width: '100%',
    marginTop: 12,
    gap: 8,
  },
  scoreItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  scoreLabel: {
    color: colors.textMuted,
    fontSize: 14,
  },
  scoreValue: {
    color: colors.amber400,
    fontSize: 16,
    fontWeight: 'bold',
  },
  hintText: {
    color: colors.textFaint,
    fontSize: 12,
    marginTop: 12,
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  scanButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: radius.md,
    backgroundColor: colors.text,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanButtonDisabled: {
    backgroundColor: colors.surface2,
  },
  scanButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scanButtonText: {
    color: colors.bg,
    fontWeight: '500',
    fontSize: 15,
  },
});
