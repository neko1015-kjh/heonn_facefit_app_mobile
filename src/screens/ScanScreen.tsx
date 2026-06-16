import { Feather } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../theme';

// [4] AI 정밀 안면 스캔 화면입니다.
// "스캔 시작" 버튼을 누르면 진행률이 0%→100%로 올라가고,
// 스캔 영역 안에서 위아래로 움직이는 스캔 라인이 표시됩니다.
export default function ScanScreen() {
  const [isScanning, setIsScanning] = useState(false); // 스캔 중인지 여부
  const [progress, setProgress] = useState(0); // 진행률 0~100

  // 진행률을 올리는 타이머를 저장해 둡니다(나중에 정리하기 위해).
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // 스캔 라인 위치 애니메이션 값
  const scanLine = useRef(new Animated.Value(0)).current;

  // 스캔 라인 위아래 반복 애니메이션
  useEffect(() => {
    if (isScanning) {
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
  }, [isScanning, scanLine]);

  // 컴포넌트가 사라질 때 타이머 정리
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // 스캔 시작 버튼을 눌렀을 때
  function handleScan() {
    setIsScanning(true);
    setProgress(0);
    timerRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          if (timerRef.current) clearInterval(timerRef.current);
          // 1초 뒤 스캔 종료 표시
          setTimeout(() => setIsScanning(false), 1000);
          return 100;
        }
        return prev + 10;
      });
    }, 200);
  }

  // 스캔 라인의 세로 위치(스캔 박스 높이 안에서 움직임)
  const lineTranslate = scanLine.interpolate({
    inputRange: [0, 1],
    outputRange: [10, 290],
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>AI 정밀 안면 스캔</Text>
      </View>

      <View style={styles.center}>
        {/* 얼굴 스캔 박스 */}
        <View style={styles.scanBox}>
          {/* 점선 얼굴 가이드 원 */}
          <View
            style={[
              styles.guideCircle,
              { borderColor: isScanning ? colors.amber500 : colors.textFainter },
            ]}
          />

          {/* 스캔 중일 때만 보이는 라인 + 안내 문구 */}
          {isScanning && (
            <View style={styles.scanOverlay}>
              <Animated.View
                style={[styles.scanLine, { transform: [{ translateY: lineTranslate }] }]}
              />
              <Text style={styles.scanningText}>68개 랜드마크 추출 중...</Text>
            </View>
          )}
        </View>

        <Text style={styles.guideText}>
          {isScanning
            ? '스캔이 완료될 때까지 정면을 응시하세요.'
            : '얼굴을 가이드라인에 맞추고 정면을 응시하세요.'}
        </Text>
      </View>

      {/* 하단 스캔 시작 버튼 */}
      <View style={styles.footer}>
        <Pressable
          style={[styles.scanButton, isScanning && styles.scanButtonDisabled]}
          onPress={handleScan}
          disabled={isScanning}
        >
          {isScanning ? (
            <View style={styles.scanButtonInner}>
              <Feather name="activity" size={20} color={colors.textFaint} />
              <Text style={[styles.scanButtonText, { color: colors.textFaint }]}>
                스캔 진행 중 {progress}%
              </Text>
            </View>
          ) : (
            <View style={styles.scanButtonInner}>
              <Feather name="camera" size={20} color={colors.bg} />
              <Text style={styles.scanButtonText}>스캔 시작</Text>
            </View>
          )}
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
    backgroundColor: 'rgba(245,158,11,0.08)',
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
