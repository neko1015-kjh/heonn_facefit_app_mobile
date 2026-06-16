import { Feather, Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  Image,
  LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors, radius } from '../theme';

// [6] AI 변화 리포트 화면입니다.
// 사용 전/후(Before & After) 비교 슬라이더와 CNN 점수 분석을 보여줍니다.
const TABS = ['주간', '월간', '누적'];

// 비교에 쓰는 얼굴 이미지 (프로토타입용 샘플 이미지)
const FACE_IMAGE =
  'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=600&q=80';

// 점수 카드에 들어갈 데이터
const SCORES = [
  { label: '안면 비대칭 개선도', delta: '5%', score: 82 },
  { label: '피부 탄력 및 부기', delta: '12%', score: 88 },
];

export default function ReportScreen() {
  const [activeTab, setActiveTab] = useState(0); // 선택된 기간 탭
  const [sliderPos, setSliderPos] = useState(50); // 슬라이더 위치(%) 0~100
  const [boxWidth, setBoxWidth] = useState(0); // 비교 영역의 실제 가로 길이

  // 비교 영역의 가로 길이를 측정합니다(드래그 위치 계산에 필요).
  function onBoxLayout(e: LayoutChangeEvent) {
    setBoxWidth(e.nativeEvent.layout.width);
  }

  // 손가락이 닿은 가로 위치를 0~100% 값으로 바꿉니다.
  function updateFromTouch(locationX: number) {
    if (boxWidth <= 0) return;
    let percent = (locationX / boxWidth) * 100;
    if (percent < 0) percent = 0;
    if (percent > 100) percent = 100;
    setSliderPos(percent);
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>AI 변화 리포트</Text>

      {/* 기간 선택 탭 (주간/월간/누적) */}
      <View style={styles.tabBar}>
        {TABS.map((tab, idx) => {
          const active = idx === activeTab;
          return (
            <Pressable
              key={tab}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => setActiveTab(idx)}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Before & After 비교 슬라이더 */}
      <View style={styles.sliderCard}>
        <View
          style={styles.sliderBox}
          onLayout={onBoxLayout}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderGrant={(e) => updateFromTouch(e.nativeEvent.locationX)}
          onResponderMove={(e) => updateFromTouch(e.nativeEvent.locationX)}
        >
          {/* After 이미지 (배경, 밝고 선명하게) */}
          <Image source={{ uri: FACE_IMAGE }} style={styles.image} resizeMode="cover" />

          {/* Before 이미지 (앞쪽, 왼쪽부터 슬라이더 위치까지만 보임) */}
          <View style={[styles.beforeClip, { width: `${sliderPos}%` }]}>
            <Image
              source={{ uri: FACE_IMAGE }}
              style={[styles.image, styles.beforeImage, { width: boxWidth }]}
              resizeMode="cover"
            />
          </View>

          {/* 슬라이더 손잡이 (세로선 + 동그란 핸들) */}
          <View style={[styles.sliderHandle, { left: `${sliderPos}%` }]}>
            <View style={styles.handleKnob}>
              <View style={styles.handleBar} />
              <View style={styles.handleBar} />
            </View>
          </View>

          {/* Before / After 라벨 */}
          <Text style={[styles.tag, styles.tagBefore]}>Before</Text>
          <Text style={[styles.tag, styles.tagAfter]}>After</Text>
        </View>
        <Text style={styles.sliderHint}>← 좌우로 드래그해서 비교해 보세요 →</Text>
      </View>

      {/* CNN 정량적 스코어 분석 */}
      <Text style={styles.sectionTitle}>정량적 스코어 분석 (CNN)</Text>
      <View style={{ gap: 12 }}>
        {SCORES.map((item) => (
          <View key={item.label} style={styles.scoreCard}>
            <View style={styles.scoreRow}>
              <Text style={styles.scoreLabel}>{item.label}</Text>
              <View style={styles.scoreRight}>
                <Text style={styles.scoreDelta}>▲ {item.delta}</Text>
                <Text style={styles.scoreValue}>{item.score}점</Text>
              </View>
            </View>
            {/* 점수 막대 */}
            <View style={styles.scoreTrack}>
              <View style={[styles.scoreFill, { width: `${item.score}%` }]} />
            </View>
          </View>
        ))}
      </View>

      {/* 예측 시뮬레이션 버튼 */}
      <Pressable style={styles.simButton}>
        <Ionicons name="sparkles" size={18} color={colors.amber400} />
        <Text style={styles.simButtonText}>1개월 뒤 예상 시뮬레이션 보기</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: 20,
    paddingBottom: 110,
  },
  title: {
    color: colors.text,
    fontWeight: '500',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    padding: 4,
    borderRadius: radius.md,
    marginBottom: 24,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: colors.surface2,
  },
  tabText: {
    color: colors.textFaint,
    fontSize: 14,
    fontWeight: '500',
  },
  tabTextActive: {
    color: colors.text,
  },
  sliderCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
    marginBottom: 24,
  },
  sliderBox: {
    width: '100%',
    height: 256,
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  beforeClip: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    overflow: 'hidden',
  },
  beforeImage: {
    height: '100%',
    opacity: 0.7, // Before는 살짝 어둡게(개선 전 느낌)
  },
  sliderHandle: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: colors.amber500,
    marginLeft: -1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  handleKnob: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.text,
    flexDirection: 'row',
    gap: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  handleBar: {
    width: 2,
    height: 12,
    borderRadius: radius.full,
    backgroundColor: colors.textMuted,
  },
  tag: {
    position: 'absolute',
    top: 12,
    fontSize: 10,
    fontWeight: '500',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
  },
  tagBefore: {
    left: 12,
    backgroundColor: 'rgba(24,24,27,0.8)',
    color: colors.textMuted,
  },
  tagAfter: {
    right: 12,
    backgroundColor: colors.amber500,
    color: colors.bg,
  },
  sliderHint: {
    color: colors.textFainter,
    fontSize: 11,
    textAlign: 'center',
    paddingVertical: 8,
  },
  sectionTitle: {
    color: colors.text,
    fontWeight: '500',
    fontSize: 15,
    marginBottom: 12,
  },
  scoreCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  scoreLabel: {
    color: colors.textMuted,
    fontSize: 14,
  },
  scoreRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scoreDelta: {
    color: colors.emerald,
    fontSize: 12,
  },
  scoreValue: {
    color: colors.text,
    fontSize: 20,
    fontWeight: 'bold',
  },
  scoreTrack: {
    width: '100%',
    height: 6,
    backgroundColor: colors.surface2,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  scoreFill: {
    height: '100%',
    backgroundColor: colors.amber500,
    borderRadius: radius.full,
  },
  simButton: {
    marginTop: 24,
    paddingVertical: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border2,
    borderRadius: radius.md,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  simButtonText: {
    color: colors.amber400,
    fontWeight: '500',
    fontSize: 15,
  },
});
