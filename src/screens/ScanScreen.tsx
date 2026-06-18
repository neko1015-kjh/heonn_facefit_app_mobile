import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  LayoutChangeEvent,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import Text from '../components/AppText';
import Face3DViewer from '../components/Face3DViewer';
import { saveScan, FaceScore, LandmarkPoint, submitFeedback } from '../api';
import { colors, radius } from '../theme';

// 추천할 괄사 디바이스 이미지들 (assets/products 폴더의 실제 이미지)
const GUASHA_IMAGES = [
  require('../../assets/products/device1.jpg'),
  require('../../assets/products/device2.png'),
  require('../../assets/products/device3.jpg'),
  require('../../assets/products/device4.png'),
];

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
  const [showGuasha, setShowGuasha] = useState(false); // 괄사 추천 팝업 열림 여부
  const [galleryWidth, setGalleryWidth] = useState(280); // 이미지 갤러리 한 장 너비
  const [matching, setMatching] = useState(false); // "추천 상품 매칭 중" 로딩 표시 여부
  const [show3D, setShow3D] = useState(false); // 3D 점구름 뷰어 팝업
  const [feedbackDone, setFeedbackDone] = useState(false); // 만족도 평가 완료 여부

  // 스캔 라인 위치 애니메이션 값
  const scanLine = useRef(new Animated.Value(0)).current;
  // 추천 매칭 로딩 바 진행 애니메이션 값(0→1, 5초)
  const matchAnim = useRef(new Animated.Value(0)).current;

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
  async function handlePickAndScan(fromCamera = false) {
    // 카메라 촬영이면 카메라 권한을, 갤러리면 사진 접근 권한을 요청합니다.
    if (fromCamera) {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setStatus('error');
        setMessage('카메라 권한이 필요합니다. 설정에서 허용해 주세요.');
        return;
      }
    } else {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setStatus('error');
        setMessage('사진 접근 권한이 필요합니다. 설정에서 허용해 주세요.');
        return;
      }
    }

    // 카메라로 촬영하거나 갤러리에서 사진을 고릅니다.
    const picked = fromCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (picked.canceled) return;

    const uri = picked.assets[0].uri;
    setImageUri(uri);
    setScores(null);
    setLandmarks(null);
    setImageSize(null);
    setMessage('');
    setFeedbackDone(false); // 새 분석이므로 만족도 평가를 다시 받습니다.
    setStatus('analyzing');

    try {
      // 분석 로딩을 최소 3초간 보여줍니다(서버 응답이 빨라도 사진 영역에 분석 상태 유지).
      const minDelay = new Promise((resolve) => setTimeout(resolve, 3000));
      const [data] = await Promise.all([saveScan(uri), minDelay]);
      if (data.detected && data.record) {
        setScores(data.record.scores);
        setLandmarks(data.landmarks ?? null);
        setImageSize(data.image_size ?? null);
        setStatus('done');
        // 분석 완료 → "추천 상품 매칭 중" 로딩 바를 5초간 보여준 뒤 추천 팝업 노출
        setMatching(true);
        matchAnim.setValue(0);
        Animated.timing(matchAnim, {
          toValue: 1,
          duration: 5000,
          useNativeDriver: false,
        }).start(({ finished }) => {
          if (finished) {
            setMatching(false);
            setShowGuasha(true);
          }
        });
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

  // 만족도 평가 제출(도움됨/아니에요). 화면에는 바로 감사 메시지를 보여줍니다.
  async function handleFeedback(satisfied: boolean) {
    setFeedbackDone(true);
    try {
      await submitFeedback(satisfied);
    } catch (e) {
      console.log('평가 전송 실패:', e);
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
                <Text style={styles.scanningText}>분석 중입니다…</Text>
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
            {landmarks && landmarks.length > 0 && (
              <Pressable style={styles.view3dButton} onPress={() => setShow3D(true)}>
                <Feather name="box" size={16} color={colors.amber400} />
                <Text style={styles.view3dButtonText}>3D로 보기</Text>
              </Pressable>
            )}
            <Text style={styles.hintText}>리포트·마이 탭에서 변화와 추천을 확인하세요.</Text>

            {/* 만족도(CSAT) 평가 */}
            <View style={styles.feedbackBox}>
              {!feedbackDone ? (
                <>
                  <Text style={styles.feedbackQuestion}>이 분석이 도움이 됐나요?</Text>
                  <View style={styles.feedbackButtons}>
                    <Pressable style={styles.feedbackBtn} onPress={() => handleFeedback(true)}>
                      <Feather name="thumbs-up" size={16} color={colors.emerald} />
                      <Text style={styles.feedbackBtnText}>도움돼요</Text>
                    </Pressable>
                    <Pressable style={styles.feedbackBtn} onPress={() => handleFeedback(false)}>
                      <Feather name="thumbs-down" size={16} color={colors.textMuted} />
                      <Text style={styles.feedbackBtnText}>아니에요</Text>
                    </Pressable>
                  </View>
                </>
              ) : (
                <Text style={styles.feedbackThanks}>평가해 주셔서 감사합니다! 🙏</Text>
              )}
            </View>
          </View>
        )}

        {status === 'error' && (
          <View style={[styles.resultBox, styles.resultBoxError]}>
            <View style={styles.resultRow}>
              <Feather name="alert-circle" size={18} color={colors.red} />
              <Text style={styles.resultTitle}>분석할 수 없어요</Text>
            </View>
            <Text style={styles.resultSub}>{message}</Text>
          </View>
        )}
      </View>

      {/* 하단 버튼: 카메라 촬영 / 갤러리 선택 */}
      <View style={styles.footer}>
        {isAnalyzing ? (
          <View style={[styles.scanButton, styles.scanButtonDisabled]}>
            <View style={styles.scanButtonInner}>
              <Feather name="activity" size={20} color={colors.textFaint} />
              <Text style={[styles.scanButtonText, { color: colors.textFaint }]}>분석 중...</Text>
            </View>
          </View>
        ) : (
          <View style={styles.footerRow}>
            {/* 카메라로 촬영 */}
            <Pressable
              style={[styles.scanButton, styles.scanButtonFlex]}
              onPress={() => handlePickAndScan(true)}
            >
              <View style={styles.scanButtonInner}>
                <Feather name="camera" size={20} color={colors.bg} />
                <Text style={styles.scanButtonText}>카메라 촬영</Text>
              </View>
            </Pressable>

            {/* 갤러리에서 선택 */}
            <Pressable
              style={[styles.scanButtonOutline, styles.scanButtonFlex]}
              onPress={() => handlePickAndScan(false)}
            >
              <View style={styles.scanButtonInner}>
                <Feather name="image" size={20} color={colors.text} />
                <Text style={styles.scanButtonOutlineText}>갤러리</Text>
              </View>
            </Pressable>
          </View>
        )}
      </View>

      {/* 3D 안면 점구름 뷰어 */}
      <Modal visible={show3D} transparent animationType="fade" onRequestClose={() => setShow3D(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShow3D(false)}>
          <Pressable style={styles.view3dCard} onPress={() => {}}>
            <View style={styles.view3dHeader}>
              <View style={styles.view3dTitleRow}>
                <Feather name="box" size={18} color={colors.amber400} />
                <Text style={styles.view3dTitle}>3D 안면 스캔</Text>
              </View>
              <Pressable onPress={() => setShow3D(false)} hitSlop={10}>
                <Feather name="x" size={22} color={colors.textMuted} />
              </Pressable>
            </View>
            {landmarks && <Face3DViewer points={landmarks} />}
            <Text style={styles.view3dSub}>검출된 {landmarks?.length ?? 0}개 점을 3D로 표현했어요</Text>
          </Pressable>
        </Pressable>
      </Modal>

      {/* 추천 상품 매칭 중 로딩 (5초) */}
      <Modal visible={matching} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.matchCard}>
            <Feather name="search" size={28} color={colors.amber400} />
            <Text style={styles.matchText}>추천 상품을 매칭 중입니다…</Text>
            {/* 진행 바 (5초간 0% → 100%) */}
            <View style={styles.matchTrack}>
              <Animated.View
                style={[
                  styles.matchFill,
                  {
                    width: matchAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%'],
                    }),
                  },
                ]}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* 분석 완료 시 뜨는 괄사 디바이스 추천 팝업 */}
      <Modal
        visible={showGuasha}
        transparent
        animationType="fade"
        onRequestClose={() => setShowGuasha(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowGuasha(false)}>
          <Pressable style={styles.guashaCard} onPress={() => {}}>
            {/* 헤더 */}
            <View style={styles.guashaHeader}>
              <View style={styles.guashaHeaderTitle}>
                <Feather name="check-circle" size={18} color={colors.emerald} />
                <Text style={styles.guashaTitle}>분석 완료! 맞춤 괄사 추천</Text>
              </View>
              <Pressable onPress={() => setShowGuasha(false)} hitSlop={10}>
                <Feather name="x" size={22} color={colors.textMuted} />
              </Pressable>
            </View>

            {/* 디바이스 이미지 갤러리 (좌우로 넘기기) */}
            <View
              style={styles.guashaGallery}
              onLayout={(e: LayoutChangeEvent) => setGalleryWidth(e.nativeEvent.layout.width)}
            >
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
              >
                {GUASHA_IMAGES.map((img, i) => (
                  <View key={i} style={{ width: galleryWidth }}>
                    <Image source={img} style={styles.guashaImage} resizeMode="contain" />
                  </View>
                ))}
              </ScrollView>
            </View>
            <Text style={styles.guashaSwipeHint}>← 좌우로 넘겨 보세요 ({GUASHA_IMAGES.length}장) →</Text>

            {/* 제품 정보 */}
            <Text style={styles.guashaName}>HeOnn FaceFit 괄사 디바이스</Text>
            <Text style={styles.guashaDesc}>온열 유기(방짜유기) 괄사로 부기·탄력을 케어하는 전용 디바이스</Text>
            <Text style={styles.guashaReason}>
              방금 분석한 부기·비대칭 결과에 맞춰 추천드려요.
            </Text>

            {/* 버튼 */}
            <Pressable style={styles.guashaBuyBtn}>
              <Feather name="shopping-bag" size={18} color={colors.bg} />
              <Text style={styles.guashaBuyText}>구매하러 가기</Text>
            </Pressable>
            <Pressable style={styles.guashaLaterBtn} onPress={() => setShowGuasha(false)}>
              <Text style={styles.guashaLaterText}>다음에 볼게요</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
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
  resultBoxError: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderColor: 'rgba(239,68,68,0.4)',
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
  // 만족도(CSAT) 평가
  feedbackBox: {
    width: '100%',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: 'center',
  },
  feedbackQuestion: {
    color: colors.textMuted,
    fontSize: 13,
    marginBottom: 10,
  },
  feedbackButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  feedbackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border2,
    backgroundColor: colors.surface2,
  },
  feedbackBtnText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '500',
  },
  feedbackThanks: {
    color: colors.emerald,
    fontSize: 13,
    fontWeight: '500',
  },
  view3dButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 14,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.amber500,
    backgroundColor: 'rgba(245,158,11,0.1)',
  },
  view3dButtonText: {
    color: colors.amber400,
    fontSize: 14,
    fontWeight: '600',
  },
  view3dCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border2,
    padding: 16,
    alignItems: 'center',
  },
  view3dHeader: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  view3dTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  view3dTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  view3dSub: { color: colors.textFaint, fontSize: 12, marginTop: 10 },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  footerRow: {
    flexDirection: 'row',
    gap: 10,
  },
  scanButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: radius.md,
    backgroundColor: colors.text,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanButtonFlex: {
    flex: 1,
    width: undefined,
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
  // 갤러리(보조) 버튼: 외곽선 스타일
  scanButtonOutline: {
    paddingVertical: 16,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanButtonOutlineText: {
    color: colors.text,
    fontWeight: '500',
    fontSize: 15,
  },
  // 괄사 추천 팝업
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  // 추천 매칭 로딩 카드
  matchCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border2,
    padding: 24,
    alignItems: 'center',
    gap: 14,
  },
  matchText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '500',
  },
  matchTrack: {
    width: '100%',
    height: 8,
    backgroundColor: colors.surface2,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  matchFill: {
    height: '100%',
    backgroundColor: colors.amber500,
    borderRadius: radius.full,
  },
  guashaCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border2,
    padding: 16,
  },
  guashaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  guashaHeaderTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  guashaTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  guashaGallery: {
    width: '100%',
    height: 220,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  guashaImage: {
    width: '100%',
    height: 220,
  },
  guashaSwipeHint: {
    color: colors.textFainter,
    fontSize: 11,
    textAlign: 'center',
    paddingVertical: 8,
  },
  guashaName: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
    marginTop: 4,
  },
  guashaDesc: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  guashaReason: {
    color: colors.amber400,
    fontSize: 13,
    marginTop: 8,
  },
  guashaBuyBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.amber500,
    paddingVertical: 14,
    borderRadius: radius.md,
    marginTop: 16,
  },
  guashaBuyText: {
    color: colors.bg,
    fontSize: 15,
    fontWeight: '700',
  },
  guashaLaterBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  guashaLaterText: {
    color: colors.textFaint,
    fontSize: 14,
  },
});
