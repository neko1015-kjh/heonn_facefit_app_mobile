import { Feather, Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  Image,
  LayoutChangeEvent,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import Text from '../components/AppText';
import { BACKEND_URL, getHistory, FaceScore, ScanRecord } from '../api';
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

// 항목별 1개월 뒤 예상 변화 설명입니다.
const PREDICT_NOTE: Record<string, string> = {
  symmetry: '좌우 대칭이 좋아져 얼굴 윤곽이 또렷해질 것으로 예상돼요.',
  balance: '부기가 줄어 턱·볼 라인이 갸름해질 것으로 예상돼요.',
};

// 현재 점수로 "꾸준히 케어했을 때 1개월 뒤 예상 점수"를 계산합니다.
// 점수가 낮을수록 개선 여지가 커서 더 많이 오르도록 했습니다. (최소 +2점)
function predictScores(scores: FaceScore[]) {
  return scores.map((s) => {
    const gain = Math.max(2, Math.round((100 - s.value) * 0.3));
    const predicted = Math.min(100, s.value + gain);
    return {
      key: s.key,
      label: s.label,
      current: s.value,
      predicted,
      gain: predicted - s.value,
      note: PREDICT_NOTE[s.key] ?? '꾸준한 케어로 개선이 기대돼요.',
    };
  });
}

// 같은 사람으로 볼 수 있는 얼굴 서명 거리 한계값. (이보다 크면 다른 사람으로 판단)
const SIG_THRESHOLD = 0.2;

// 두 얼굴 서명 사이의 거리. 비교할 수 없으면(서명 없음) null.
function sigDist(a?: number[], b?: number[]): number | null {
  if (!a || !b || a.length === 0 || b.length === 0 || a.length !== b.length) return null;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

export default function ReportScreen() {
  const [activeTab, setActiveTab] = useState(0);
  const [sliderPos, setSliderPos] = useState(50);
  const [boxWidth, setBoxWidth] = useState(0);

  const [records, setRecords] = useState<ScanRecord[]>([]); // 저장된 이력(최신순)
  const [refreshing, setRefreshing] = useState(false); // 새로고침 중 여부
  const [historyOpen, setHistoryOpen] = useState(false); // 기록 팝업 열림 여부
  const [simOpen, setSimOpen] = useState(false); // 예상 시뮬레이션 팝업 열림 여부
  const [imgRatio, setImgRatio] = useState<number | null>(null); // 사진 세로/가로 비율
  const [baseline, setBaseline] = useState<'latest' | 'previous' | null>(null); // 다른 사람일 때 기준 선택

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

  // ── 기간 필터 (주간 7일 / 월간 30일 / 누적 전체) ──────────────
  const periodRecords = records.filter((r) => {
    if (activeTab === 2) return true; // 누적: 전체
    const days = activeTab === 0 ? 7 : 30; // 주간 / 월간
    const t = new Date(r.created_at).getTime();
    return Date.now() - t <= days * 24 * 60 * 60 * 1000;
  });

  // ── 동일인 판별 & 비교 대상 정리 (선택한 기간 안에서) ───────────
  const firstRec = periodRecords[0] ?? null; // 기간 내 가장 최신
  const lastRec = periodRecords.length > 0 ? periodRecords[periodRecords.length - 1] : null; // 기간 내 가장 오래됨
  const compareDist =
    periodRecords.length >= 2 ? sigDist(firstRec?.signature, lastRec?.signature) : null;
  const differentPerson = compareDist != null && compareDist > SIG_THRESHOLD;

  // 다른 사람인데 기준을 선택했으면, 기준 얼굴과 같은 사람의 기록만 추립니다.
  let working = periodRecords;
  if (differentPerson && baseline) {
    const ref = baseline === 'latest' ? firstRec?.signature : lastRec?.signature;
    working = periodRecords.filter((r) => {
      const d = sigDist(r.signature, ref);
      return d == null || d <= SIG_THRESHOLD;
    });
  }

  const blocked = differentPerson && !baseline; // 다른 사람 → 기준 선택 대기(분석 불가)
  const empty = periodRecords.length === 0; // 이 기간에 기록 없음
  const needMore = !blocked && !empty && working.length < 2; // 비교할 사진 부족

  // 비교 대상(추려진 기록 기준)
  const newest = working[0] ?? null;
  const oldest = working.length > 0 ? working[working.length - 1] : null;
  const previous = working[1] ?? null;
  const hasTwo = working.length >= 2 && !blocked;
  const showReport = !blocked && !empty && !needMore; // 정상 비교 가능

  // 비교에 쓸 사진 주소 (저장된 실제 기록의 사진)
  const afterImage = newest ? fullImageUrl(newest.image_url) : '';
  const beforeImage = oldest ? fullImageUrl(oldest.image_url) : '';

  // 비교 영역 높이: 사진 비율에 맞춰 잡되, 너무 길어지지 않게 제한합니다.
  const boxHeight =
    imgRatio && boxWidth > 0 ? Math.min(Math.round(boxWidth * imgRatio), 440) : 300;

  // 기간 내 평균 점수 (요약용)
  const avgOf = (key: string) =>
    working.length
      ? Math.round(
          working.reduce((s, r) => s + (r.scores.find((x) => x.key === key)?.value ?? 0), 0) /
            working.length
        )
      : 0;
  const avgBalance = avgOf('balance');
  const avgSymmetry = avgOf('symmetry');

  return (
    <>
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

      {/* 예외: 최신/이전 얼굴이 다른 사람 → 기준 선택 */}
      {blocked && (
        <View style={styles.noticeCard}>
          <Feather name="alert-triangle" size={24} color={colors.amber400} />
          <Text style={styles.noticeTitle}>다른 얼굴이 감지됐어요</Text>
          <Text style={styles.noticeBody}>
            최신 사진과 이전 사진의 얼굴이 서로 달라(다른 사람으로 보여) 변화를 분석할 수 없어요.
            어떤 얼굴을 기준으로 분석할까요?
          </Text>
          <View style={styles.choiceRow}>
            <Pressable style={styles.choiceBtn} onPress={() => setBaseline('latest')}>
              <Text style={styles.choiceBtnText}>최신 얼굴 기준</Text>
            </Pressable>
            <Pressable style={[styles.choiceBtn, styles.choiceBtnAlt]} onPress={() => setBaseline('previous')}>
              <Text style={styles.choiceBtnAltText}>이전 얼굴 기준</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* 예외: 비교할 (같은 얼굴) 사진이 부족 */}
      {needMore && (
        <View style={styles.noticeCard}>
          <Feather name="image" size={24} color={colors.textMuted} />
          <Text style={styles.noticeTitle}>비교할 사진이 부족해요</Text>
          <Text style={styles.noticeBody}>
            {differentPerson
              ? '선택한 기준 얼굴과 비교할 사진이 부족해요. 같은 얼굴 사진을 더 추가해 주세요.'
              : '변화를 비교하려면 얼굴 사진이 2장 이상 필요해요. AI스캔에서 사진을 더 분석해 주세요.'}
          </Text>
          {differentPerson && (
            <Pressable style={styles.noticeReset} onPress={() => setBaseline(null)}>
              <Text style={styles.noticeResetText}>기준 다시 선택</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* 기준 얼굴 표시 (다른 사람 상황에서 기준을 고른 경우) */}
      {showReport && differentPerson && baseline && (
        <View style={styles.baselineNote}>
          <Feather name="user-check" size={14} color={colors.amber400} />
          <Text style={styles.baselineNoteText}>
            기준: {baseline === 'latest' ? '최신' : '이전'} 얼굴
          </Text>
          <Pressable onPress={() => setBaseline(null)} hitSlop={6}>
            <Text style={styles.baselineChange}>변경</Text>
          </Pressable>
        </View>
      )}

      {/* Before & After 비교 슬라이더 (정상 비교 가능 또는 기록 없음일 때만) */}
      {(showReport || empty) && (
      <View style={styles.sliderCard}>
        {/* 비교 영역은 항상 그려서 가로 길이를 측정합니다(Before 사진을 정확히 그리기 위해). */}
        <View
          style={[styles.sliderBox, { height: boxHeight }]}
          onLayout={onBoxLayout}
          onStartShouldSetResponder={() => !!newest}
          onMoveShouldSetResponder={() => !!newest}
          onResponderGrant={(e) => updateFromTouch(e.nativeEvent.locationX)}
          onResponderMove={(e) => updateFromTouch(e.nativeEvent.locationX)}
        >
          {newest ? (
            <>
              {/* After 이미지 (최신 기록) — 얼굴 전체가 잘리지 않도록 contain */}
              <Image
                source={{ uri: afterImage }}
                style={styles.image}
                resizeMode="contain"
                onLoad={(e) => {
                  // 사진 원본 크기를 읽어 비율(세로/가로)을 저장합니다.
                  const src = e?.nativeEvent?.source;
                  if (src?.width && src?.height) setImgRatio(src.height / src.width);
                }}
              />

              {/* Before 이미지 (가장 오래된 기록, 왼쪽부터 슬라이더 위치까지만 보임) */}
              {hasTwo && boxWidth > 0 && (
                <View style={[styles.beforeClip, { width: (boxWidth * sliderPos) / 100 }]}>
                  <Image
                    source={{ uri: beforeImage }}
                    style={[styles.image, { width: boxWidth }]}
                    resizeMode="contain"
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
                {records.length === 0
                  ? '아직 저장된 기록이 없어요.\n아래 버튼으로 첫 사진을 분석해 보세요.'
                  : `이 기간(${TABS[activeTab]})에는 기록이 없어요.\n‘누적’ 탭을 보거나 새로 분석해 보세요.`}
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
      )}

      {/* 점수 분석 + 직전 대비 변화 (다른 사람 선택 대기 중이면 숨김) */}
      {!blocked && (
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>정량적 스코어 분석</Text>
        {newest ? (
          // 누르면 그동안의 기록을 팝업으로 보여줍니다.
          <Pressable style={styles.scoreBadgeBtn} onPress={() => setHistoryOpen(true)}>
            <Text style={styles.scoreBadgeText}>{TABS[activeTab]} {periodRecords.length}회</Text>
            <Feather name="chevron-right" size={13} color={colors.amber400} />
          </Pressable>
        ) : (
          <Text style={styles.scoreBadge}>예시</Text>
        )}
      </View>
      )}

      {!blocked && (
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
      )}

      {/* 점수 추이 차트 + 요약 (정상 비교 가능할 때) */}
      {showReport && (
        <View style={styles.trendCard}>
          <Text style={styles.trendTitle}>{TABS[activeTab]} 점수 추이</Text>
          {(() => {
            const series = working.slice().reverse(); // 오래된 → 최신
            const n = series.length;
            const W = boxWidth > 0 ? boxWidth : 300;
            const H = 130;
            const padL = 8, padR = 8, padT = 14, padB = 14;
            const innerW = W - padL - padR;
            const innerH = H - padT - padB;
            const xAt = (i: number) => padL + (n <= 1 ? innerW / 2 : (i * innerW) / (n - 1));
            const yAt = (v: number) => padT + (1 - v / 100) * innerH;
            const valOf = (r: ScanRecord, key: string) =>
              r.scores.find((s) => s.key === key)?.value ?? 0;
            const balPts = series.map((r, i) => `${xAt(i)},${yAt(valOf(r, 'balance'))}`).join(' ');
            const symPts = series.map((r, i) => `${xAt(i)},${yAt(valOf(r, 'symmetry'))}`).join(' ');
            return (
              <Svg width={W} height={H}>
                {[0, 50, 100].map((g) => (
                  <Line key={g} x1={padL} y1={yAt(g)} x2={W - padR} y2={yAt(g)} stroke={colors.border} strokeWidth={1} />
                ))}
                <Polyline points={balPts} fill="none" stroke={colors.amber400} strokeWidth={2} />
                {series.map((r, i) => (
                  <Circle key={`b${i}`} cx={xAt(i)} cy={yAt(valOf(r, 'balance'))} r={2.5} fill={colors.amber400} />
                ))}
                <Polyline points={symPts} fill="none" stroke={colors.emerald} strokeWidth={2} />
                {series.map((r, i) => (
                  <Circle key={`s${i}`} cx={xAt(i)} cy={yAt(valOf(r, 'symmetry'))} r={2.5} fill={colors.emerald} />
                ))}
              </Svg>
            );
          })()}
          {/* 범례 */}
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.amber400 }]} />
              <Text style={styles.legendText}>좌우 균형</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.emerald }]} />
              <Text style={styles.legendText}>안면 비대칭</Text>
            </View>
          </View>
          {/* 요약 */}
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryNum}>{working.length}</Text>
              <Text style={styles.summaryLabel}>분석 횟수</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryNum}>{avgBalance}</Text>
              <Text style={styles.summaryLabel}>평균 균형</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryNum}>{avgSymmetry}</Text>
              <Text style={styles.summaryLabel}>평균 비대칭</Text>
            </View>
          </View>
        </View>
      )}

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
      <Pressable style={styles.simButton} onPress={() => setSimOpen(true)}>
        <Ionicons name="sparkles" size={18} color={colors.amber400} />
        <Text style={styles.simButtonText}>1개월 뒤 예상 시뮬레이션 보기</Text>
      </Pressable>
    </ScrollView>

    {/* 기록 히스토리 팝업 */}
    <Modal
      visible={historyOpen}
      transparent
      animationType="fade"
      onRequestClose={() => setHistoryOpen(false)}
    >
      {/* 어두운 배경 (누르면 닫힘) */}
      <Pressable style={styles.modalOverlay} onPress={() => setHistoryOpen(false)}>
        {/* 팝업 카드 (안쪽을 눌러도 닫히지 않도록 이벤트 차단) */}
        <Pressable style={styles.modalCard} onPress={() => {}}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>분석 기록 ({records.length}회)</Text>
            <Pressable onPress={() => setHistoryOpen(false)} hitSlop={10}>
              <Feather name="x" size={22} color={colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
            {records.map((r, idx) => {
              // 최신순이므로 회차 번호는 (전체 - 인덱스)
              const round = records.length - idx;
              const sym = r.scores.find((s) => s.key === 'symmetry')?.value;
              const bal = r.scores.find((s) => s.key === 'balance')?.value;
              return (
                <View key={r.id} style={styles.historyRow}>
                  <Image
                    source={{ uri: fullImageUrl(r.image_url) }}
                    style={styles.historyThumb}
                    resizeMode="cover"
                  />
                  <View style={styles.historyInfo}>
                    <Text style={styles.historyDate}>
                      {round}회차 · {formatDate(r.created_at)}
                    </Text>
                    <Text style={styles.historyScores}>
                      비대칭 {sym}점 · 균형 {bal}점
                    </Text>
                  </View>
                  {idx === 0 && <Text style={styles.latestTag}>최근</Text>}
                </View>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>

    {/* 1개월 뒤 예상 시뮬레이션 전체 팝업 */}
    <Modal
      visible={simOpen}
      animationType="slide"
      onRequestClose={() => setSimOpen(false)}
    >
      <View style={styles.simScreen}>
        {/* 상단 헤더 */}
        <View style={styles.simHeader}>
          <View style={styles.simHeaderTitle}>
            <Ionicons name="sparkles" size={20} color={colors.amber400} />
            <Text style={styles.simTitle}>1개월 뒤 예상 시뮬레이션</Text>
          </View>
          <Pressable onPress={() => setSimOpen(false)} hitSlop={10}>
            <Feather name="x" size={24} color={colors.textMuted} />
          </Pressable>
        </View>

        {newest ? (
          <ScrollView
            contentContainerStyle={styles.simContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.simIntro}>
              최근 분석({formatDate(newest.created_at)})을 바탕으로, HeOnn Facefit을 매일 꾸준히
              사용했을 때 예상되는 변화예요.
            </Text>

            {/* 현재 분석한 얼굴 사진 (참고용) */}
            <View style={styles.simImageWrap}>
              <Image
                source={{ uri: afterImage }}
                style={styles.simImage}
                resizeMode="contain"
              />
              <Text style={styles.simImageTag}>현재 분석 얼굴</Text>
            </View>

            {/* 항목별 예상 변화 */}
            {predictScores(newest.scores).map((p) => (
              <View key={p.key} style={styles.simCard}>
                <View style={styles.simCardTop}>
                  <Text style={styles.simCardLabel}>{p.label}</Text>
                  <Text style={styles.simCardDelta}>▲ {p.gain}점</Text>
                </View>

                {/* 현재 → 예상 점수 막대 */}
                <View style={styles.simBarRow}>
                  <Text style={styles.simBarValue}>{p.current}</Text>
                  <View style={styles.simTrack}>
                    {/* 현재 점수(진한 부분) */}
                    <View style={[styles.simFillNow, { width: `${p.current}%` }]} />
                    {/* 예상 추가 상승분(연한 부분) */}
                    <View
                      style={[
                        styles.simFillGain,
                        { left: `${p.current}%`, width: `${p.gain}%` },
                      ]}
                    />
                  </View>
                  <Text style={styles.simBarPredicted}>{p.predicted}</Text>
                </View>

                <Text style={styles.simNote}>{p.note}</Text>
              </View>
            ))}

            {/* 안내 문구 */}
            <Text style={styles.simDisclaimer}>
              ※ 본 예측은 분석 데이터를 바탕으로 한 추정이며, 실제 결과는 사용 습관·개인차에 따라
              달라질 수 있습니다.
            </Text>

            <Pressable style={styles.simCloseBtn} onPress={() => setSimOpen(false)}>
              <Text style={styles.simCloseBtnText}>닫기</Text>
            </Pressable>
          </ScrollView>
        ) : (
          // 분석 기록이 없을 때
          <View style={styles.simEmpty}>
            <Feather name="camera" size={36} color={colors.textFainter} />
            <Text style={styles.simEmptyText}>
              먼저 AI스캔에서 얼굴을 분석하면{'\n'}예상 변화를 볼 수 있어요.
            </Text>
          </View>
        )}
      </View>
    </Modal>
    </>
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
  // 예외 안내 카드 (다른 사람 / 사진 부족)
  noticeCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border2,
    borderRadius: radius.lg,
    padding: 20,
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
  },
  noticeTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 4,
  },
  noticeBody: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
  choiceRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
    width: '100%',
  },
  choiceBtn: {
    flex: 1,
    backgroundColor: colors.amber500,
    paddingVertical: 13,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  choiceBtnText: {
    color: colors.bg,
    fontSize: 14,
    fontWeight: '700',
  },
  choiceBtnAlt: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border2,
  },
  choiceBtnAltText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  noticeReset: {
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  noticeResetText: {
    color: colors.amber400,
    fontSize: 13,
    fontWeight: '500',
  },
  baselineNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(245,158,11,0.1)',
    borderRadius: radius.md,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  baselineNoteText: {
    color: colors.amber400,
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  baselineChange: {
    color: colors.textMuted,
    fontSize: 12,
    textDecorationLine: 'underline',
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
  // 누를 수 있는 '총 N회 기록' 배지
  scoreBadgeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.3)',
    backgroundColor: 'rgba(245,158,11,0.1)',
    paddingLeft: 10,
    paddingRight: 6,
    paddingVertical: 4,
    borderRadius: 6,
  },
  scoreBadgeText: {
    color: colors.amber400,
    fontSize: 11,
    fontWeight: '500',
  },
  // 기록 팝업
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    maxHeight: '75%',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border2,
    padding: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  modalList: {
    flexGrow: 0,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: 'rgba(39,39,42,0.7)',
  },
  historyThumb: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.surface2,
  },
  historyInfo: {
    flex: 1,
  },
  historyDate: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
  historyScores: {
    color: colors.textMuted,
    fontSize: 12,
  },
  latestTag: {
    color: colors.bg,
    backgroundColor: colors.amber500,
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    overflow: 'hidden',
  },
  // 1개월 뒤 예상 시뮬레이션 전체 팝업
  simScreen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  simHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 56,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  simHeaderTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  simTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  simContent: {
    padding: 20,
    paddingBottom: 48,
  },
  simIntro: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 20,
  },
  simImageWrap: {
    height: 240,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: 20,
    justifyContent: 'center',
  },
  simImage: {
    width: '100%',
    height: '100%',
  },
  simImageTag: {
    position: 'absolute',
    top: 10,
    left: 10,
    color: colors.textMuted,
    backgroundColor: 'rgba(9,9,11,0.6)',
    fontSize: 11,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: 'hidden',
  },
  simCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 12,
  },
  simCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  simCardLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '500',
  },
  simCardDelta: {
    color: colors.emerald,
    fontSize: 13,
    fontWeight: '700',
  },
  simBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  simBarValue: {
    color: colors.textFaint,
    fontSize: 12,
    width: 24,
    textAlign: 'right',
  },
  simBarPredicted: {
    color: colors.amber400,
    fontSize: 13,
    fontWeight: '700',
    width: 24,
  },
  simTrack: {
    flex: 1,
    height: 10,
    backgroundColor: colors.surface2,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  simFillNow: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.amber500,
  },
  simFillGain: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(245,158,11,0.4)',
  },
  simNote: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  simDisclaimer: {
    color: colors.textFainter,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
    marginBottom: 20,
  },
  simCloseBtn: {
    paddingVertical: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border2,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  simCloseBtnText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '500',
  },
  simEmpty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    padding: 24,
  },
  simEmptyText: {
    color: colors.textFaint,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
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
  // 점수 추이 차트 카드
  trendCard: {
    marginTop: 16,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  trendTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 10,
  },
  legendRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { color: colors.textMuted, fontSize: 12 },
  summaryRow: {
    flexDirection: 'row',
    marginTop: 16,
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingTop: 14,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryNum: { color: colors.amber400, fontSize: 20, fontWeight: '700' },
  summaryLabel: { color: colors.textFaint, fontSize: 12, marginTop: 2 },
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
