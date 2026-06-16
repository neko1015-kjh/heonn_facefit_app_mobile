import { Feather, Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  Image,
  LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BACKEND_URL, getHistory, ScanRecord } from '../api';
import { colors, radius } from '../theme';

// [6] AI 변화 리포트 화면입니다.
// AI 스캔 탭에서 분석·저장한 기록을 모아, Before/After 비교와 점수 변화를 보여줍니다.
const TABS = ['주간', '월간', '누적'];

// 서버 기준 상대 경로를 전체 사진 주소로 바꿉니다.
function fullImageUrl(path: string) {
  return `${BACKEND_URL}${path}`;
}

// 날짜 문자열(2026-06-16T21:42:54)을 보기 좋게(2026.06.16) 다듬습니다.
function formatDate(iso: string) {
  return iso.slice(0, 10).replace(/-/g, '.');
}

export default function ReportScreen() {
  const [activeTab, setActiveTab] = useState(0);
  const [sliderPos, setSliderPos] = useState(50);
  const [boxWidth, setBoxWidth] = useState(0);

  const [records, setRecords] = useState<ScanRecord[]>([]); // 저장된 이력(최신순)
  const [refreshing, setRefreshing] = useState(false); // 새로고침 중 여부

  // 화면이 열릴 때마다 이력을 불러옵니다.
  useEffect(() => {
    loadHistory();
  }, []);

  async function loadHistory() {
    setRefreshing(true);
    try {
      const data = await getHistory();
      setRecords(data.records);
    } catch (e) {
      console.log('이력 불러오기 실패:', e);
    } finally {
      setRefreshing(false);
    }
  }

  // 비교 영역의 가로 길이를 측정합니다(드래그 위치 계산에 필요).
  function onBoxLayout(e: LayoutChangeEvent) {
    setBoxWidth(e.nativeEvent.layout.width);
  }

  function updateFromTouch(locationX: number) {
    if (boxWidth <= 0) return;
    let percent = (locationX / boxWidth) * 100;
    if (percent < 0) percent = 0;
    if (percent > 100) percent = 100;
    setSliderPos(percent);
  }

  // 최신 기록과 가장 오래된 기록 (Before/After 비교용)
  const newest = records[0] ?? null;
  const oldest = records.length > 0 ? records[records.length - 1] : null;
  const previous = records[1] ?? null; // 직전 기록(변화 계산용)
  const hasTwo = records.length >= 2;

  // 비교에 쓸 사진 주소 (저장된 실제 기록의 사진)
  const afterImage = newest ? fullImageUrl(newest.image_url) : '';
  const beforeImage = oldest ? fullImageUrl(oldest.image_url) : '';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>AI 변화 리포트</Text>

      {/* 기간 선택 탭 */}
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
        {/* 비교 영역은 항상 그려서 가로 길이를 측정합니다(Before 사진을 정확히 그리기 위해). */}
        <View
          style={styles.sliderBox}
          onLayout={onBoxLayout}
          onStartShouldSetResponder={() => !!newest}
          onMoveShouldSetResponder={() => !!newest}
          onResponderGrant={(e) => updateFromTouch(e.nativeEvent.locationX)}
          onResponderMove={(e) => updateFromTouch(e.nativeEvent.locationX)}
        >
          {newest ? (
            <>
              {/* After 이미지 (최신 기록) */}
              <Image source={{ uri: afterImage }} style={styles.image} resizeMode="cover" />

              {/* Before 이미지 (가장 오래된 기록, 왼쪽부터 슬라이더 위치까지만 보임) */}
              {hasTwo && boxWidth > 0 && (
                <View style={[styles.beforeClip, { width: (boxWidth * sliderPos) / 100 }]}>
                  <Image
                    source={{ uri: beforeImage }}
                    style={[styles.image, { width: boxWidth }]}
                    resizeMode="cover"
                  />
                </View>
              )}

              {/* 슬라이더 손잡이 (기록이 2개 이상일 때만) */}
              {hasTwo && boxWidth > 0 && (
                <View style={[styles.sliderHandle, { left: (boxWidth * sliderPos) / 100 }]}>
                  <View style={styles.handleKnob}>
                    <View style={styles.handleBar} />
                    <View style={styles.handleBar} />
                  </View>
                </View>
              )}

              {/* Before / After 라벨 (기록 날짜 표시) */}
              {hasTwo && (
                <Text style={[styles.tag, styles.tagBefore]}>
                  Before · {oldest ? formatDate(oldest.created_at) : ''}
                </Text>
              )}
              <Text style={[styles.tag, styles.tagAfter]}>
                {hasTwo ? 'After · ' : ''}
                {formatDate(newest.created_at)}
              </Text>
            </>
          ) : (
            // 아직 저장된 기록이 없을 때 보여줄 안내 박스
            <View style={styles.placeholderBox}>
              <Feather name="image" size={36} color={colors.textFainter} />
              <Text style={styles.placeholderText}>
                아직 저장된 기록이 없어요.{'\n'}아래 버튼으로 첫 사진을 분석해 보세요.
              </Text>
            </View>
          )}
        </View>
        <Text style={styles.sliderHint}>
          {hasTwo
            ? '← 좌우로 드래그해서 처음과 최근을 비교해 보세요 →'
            : '기록이 2개 이상 쌓이면 변화를 비교할 수 있어요.'}
        </Text>
      </View>

      {/* 점수 분석 + 직전 대비 변화 */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>정량적 스코어 분석</Text>
        <Text style={styles.scoreBadge}>{newest ? `총 ${records.length}회 기록` : '예시'}</Text>
      </View>

      <View style={{ gap: 12 }}>
        {(newest ? newest.scores : SAMPLE_SCORES).map((score) => {
          // 직전 기록에서 같은 항목의 점수를 찾아 변화량을 계산합니다.
          const prevScore = previous?.scores.find((s) => s.key === score.key);
          const delta = prevScore ? score.value - prevScore.value : null;
          return (
            <View key={score.label} style={styles.scoreCard}>
              <View style={styles.scoreRow}>
                <Text style={styles.scoreLabel}>{score.label}</Text>
                <View style={styles.scoreRight}>
                  {delta !== null && delta !== 0 && (
                    <Text style={[styles.scoreDelta, { color: delta > 0 ? colors.emerald : colors.red }]}>
                      {delta > 0 ? '▲' : '▼'} {Math.abs(delta)}
                    </Text>
                  )}
                  <Text style={styles.scoreValue}>{score.value}점</Text>
                </View>
              </View>
              <View style={styles.scoreTrack}>
                <View style={[styles.scoreFill, { width: `${score.value}%` }]} />
              </View>
            </View>
          );
        })}
      </View>

      {/* 안내: 기록은 AI 스캔에서 만들어집니다 */}
      <Text style={styles.guideNote}>
        새 기록은 <Text style={{ color: colors.amber400 }}>AI스캔</Text> 탭에서 사진을 분석하면
        쌓입니다.
      </Text>

      {/* 기록 새로고침 버튼 */}
      <Pressable
        style={[styles.refreshButton, refreshing && styles.refreshButtonDisabled]}
        onPress={loadHistory}
        disabled={refreshing}
      >
        <Feather
          name="refresh-cw"
          size={18}
          color={refreshing ? colors.textFaint : colors.bg}
        />
        <Text style={[styles.refreshButtonText, refreshing && { color: colors.textFaint }]}>
          {refreshing ? '불러오는 중...' : '기록 새로고침'}
        </Text>
      </Pressable>

      {/* 예측 시뮬레이션 버튼 */}
      <Pressable style={styles.simButton}>
        <Ionicons name="sparkles" size={18} color={colors.amber400} />
        <Text style={styles.simButtonText}>1개월 뒤 예상 시뮬레이션 보기</Text>
      </Pressable>
    </ScrollView>
  );
}

// 아직 기록이 없을 때 보여줄 예시 점수
const SAMPLE_SCORES = [
  { key: 'symmetry', label: '안면 비대칭 개선도', value: 82 },
  { key: 'balance', label: '좌우 균형 (부기)', value: 88 },
];

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
  placeholderBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
  },
  placeholderText: {
    color: colors.textFaint,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
  beforeClip: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    overflow: 'hidden',
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    color: colors.text,
    fontWeight: '500',
    fontSize: 15,
  },
  scoreBadge: {
    color: colors.amber400,
    fontSize: 11,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.3)',
    backgroundColor: 'rgba(245,158,11,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: 'hidden',
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
  guideNote: {
    color: colors.textFaint,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 20,
    lineHeight: 19,
  },
  refreshButton: {
    marginTop: 12,
    paddingVertical: 16,
    backgroundColor: colors.text,
    borderRadius: radius.md,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  refreshButtonDisabled: {
    backgroundColor: colors.surface2,
  },
  refreshButtonText: {
    color: colors.bg,
    fontWeight: '500',
    fontSize: 15,
  },
  simButton: {
    marginTop: 16,
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
