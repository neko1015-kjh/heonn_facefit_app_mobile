import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { saveScan, FaceScore } from '../api';
import { colors, radius } from '../theme';

// [4] AI 정밀 안면 스캔 화면입니다.
// "사진 선택"으로 사진을 고르면 백엔드로 보내 실제로 얼굴을 분석하고,
// 그 결과(특징점·점수)를 "기록"으로 저장합니다. 저장된 기록은 리포트 탭에서 전/후·변화로 확인합니다.

// 화면 상태: idle(대기) → analyzing(분석 중) → done(완료) → error(오류)
type Status = 'idle' | 'analyzing' | 'done' | 'error';

export default function ScanScreen() {
  const [status, setStatus] = useState<Status>('idle');
  const [imageUri, setImageUri] = useState<string | null>(null); // 고른 사진
  const [landmarkCount, setLandmarkCount] = useState<number | null>(null); // 찾은 특징점 수
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
    setLandmarkCount(null);
    setMessage('');
    setStatus('analyzing');

    // 사진을 백엔드로 보내 분석 + 기록 저장까지 한 번에 처리합니다.
    try {
      const data = await saveScan(uri);
      if (data.detected && data.record) {
        setLandmarkCount(data.landmark_count ?? null);
        setScores(data.record.scores);
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>AI 정밀 안면 스캔</Text>
      </View>

      <View style={styles.center}>
        {/* 얼굴 스캔 박스 */}
        <View style={styles.scanBox}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.pickedImage} resizeMode="cover" />
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
              <Text style={styles.resultTitle}>얼굴 분석 완료 · 기록 저장됨</Text>
            </View>
            {landmarkCount !== null && (
              <Text style={styles.resultSub}>특징점 {landmarkCount}개 검출</Text>
            )}

            {/* 계산된 점수 표시 */}
            <View style={styles.scoreList}>
              {scores.map((s) => (
                <View key={s.key} style={styles.scoreItem}>
                  <Text style={styles.scoreLabel}>{s.label}</Text>
                  <Text style={styles.scoreValue}>{s.value}점</Text>
                </View>
              ))}
            </View>

            <Text style={styles.hintText}>리포트 탭에서 전/후 변화를 확인하세요.</Text>
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
  pickedImage: {
    width: '100%',
    height: '100%',
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
    marginTop: 24,
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
