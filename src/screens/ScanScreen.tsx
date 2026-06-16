import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { sendImageForLandmarks, LandmarkResult } from '../api';
import { colors, radius } from '../theme';

// [4] AI 정밀 안면 스캔 화면입니다.
// "사진 선택" 버튼을 누르면 사진을 고르고, 그 사진을 백엔드로 보내
// 실제로 얼굴 특징점(랜드마크)을 분석한 결과를 보여줍니다.

// 화면 상태: idle(대기) → analyzing(분석 중) → done(완료) → error(오류)
type Status = 'idle' | 'analyzing' | 'done' | 'error';

export default function ScanScreen() {
  const [status, setStatus] = useState<Status>('idle');
  const [imageUri, setImageUri] = useState<string | null>(null); // 고른 사진
  const [result, setResult] = useState<LandmarkResult | null>(null); // 분석 결과
  const [errorMsg, setErrorMsg] = useState('');

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
    // 1) 사진 접근 권한을 요청합니다.
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setStatus('error');
      setErrorMsg('사진 접근 권한이 필요합니다. 설정에서 허용해 주세요.');
      return;
    }

    // 2) 갤러리에서 사진을 한 장 고릅니다.
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (picked.canceled) return; // 사용자가 취소한 경우

    const uri = picked.assets[0].uri;
    setImageUri(uri);
    setResult(null);
    setErrorMsg('');
    setStatus('analyzing');

    // 3) 사진을 백엔드로 보내 얼굴을 분석합니다.
    try {
      const data = await sendImageForLandmarks(uri);
      setResult(data);
      setStatus('done');
    } catch (e) {
      console.log('분석 요청 실패:', e);
      setStatus('error');
      setErrorMsg('백엔드 서버에 연결하지 못했습니다. 서버가 켜져 있는지 확인해 주세요.');
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
          {/* 고른 사진이 있으면 보여줍니다. */}
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.pickedImage} resizeMode="cover" />
          ) : (
            // 사진을 고르기 전에는 점선 가이드 원을 보여줍니다.
            <View style={[styles.guideCircle, { borderColor: colors.textFainter }]} />
          )}

          {/* 분석 중일 때만 보이는 스캔 라인 + 문구 */}
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

        {status === 'done' && result && (
          <View style={styles.resultBox}>
            {result.detected ? (
              <>
                <View style={styles.resultRow}>
                  <Feather name="check-circle" size={18} color={colors.emerald} />
                  <Text style={styles.resultTitle}>얼굴 분석 완료</Text>
                </View>
                <Text style={styles.resultText}>
                  특징점 {result.landmark_count}개를 찾았어요.
                </Text>
              </>
            ) : (
              <>
                <View style={styles.resultRow}>
                  <Feather name="alert-circle" size={18} color={colors.amber400} />
                  <Text style={styles.resultTitle}>얼굴을 찾지 못했어요</Text>
                </View>
                <Text style={styles.resultText}>{result.message}</Text>
              </>
            )}
          </View>
        )}

        {status === 'error' && (
          <View style={styles.resultBox}>
            <View style={styles.resultRow}>
              <Feather name="alert-circle" size={18} color={colors.red} />
              <Text style={styles.resultTitle}>오류</Text>
            </View>
            <Text style={styles.resultText}>{errorMsg}</Text>
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
    marginTop: 28,
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
  resultText: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
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
