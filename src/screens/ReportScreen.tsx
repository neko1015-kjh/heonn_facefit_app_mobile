import { Feather, Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
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
import { BACKEND_URL, getHistory, getScanLandmarks, FaceScore, ScanRecord, LandmarkPoint } from '../api';
import { FACE_REGIONS } from '../faceRegions';
import FaceRegionMini from '../components/FaceRegionMini';
import { colors, radius } from '../theme';

// [6] AI 변화 리포트 화면입니다.
// AI 스캔 탭에서 분석·저장한 기록을 모아, Before/After 비교와 점수 변화를 보여줍니다.
const TABS = ['주간', '월간', '누적'];

// 현재 앱 빌드 번호(설치된 버전 확인용). app.json의 versionCode와 같게 유지합니다.
const APP_BUILD = 16;

// 서버 기준 상대 경로를 전체 사진 주소로 바꿉니다.
function fullImageUrl(path: string) {
  return `${BACKEND_URL}${path}`;
}

// 얼굴 부분만 잘라낸 사진 주소(개인정보 보호 + 보기 편함).
// 서버가 ?face=1 이면 얼굴만 잘라서 돌려줍니다. (점·선 겹쳐 그리는 곳에는 쓰지 않음)
function faceImageUrl(path: string) {
  const sep = path.includes('?') ? '&' : '?';
  return `${BACKEND_URL}${path}${sep}face=1`;
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

// 점수 항목별로 "얼굴 어디를 보고 계산했는지"를 정의합니다.
// points: 강조해서 찍을 특징점 번호들 / pairs: 좌우로 이어 보여줄 짝 / midline: 중앙 기준선 표시 여부
const SCORE_DETAIL: Record<
  string,
  { desc: string; points: number[]; pairs?: [number, number][]; midline?: boolean }
> = {
  symmetry: {
    desc: '좌우 짝이 되는 눈·눈썹·입꼬리·코·볼의 위치가 중앙선을 기준으로 얼마나 대칭인지 봅니다. 양쪽(초록 선) 점이 대칭일수록 점수가 높아요.',
    points: [33, 263, 133, 362, 61, 291, 105, 334, 129, 358, 50, 280],
    pairs: [[33, 263], [133, 362], [61, 291], [105, 334], [129, 358], [50, 280]],
    midline: true,
  },
  balance: {
    desc: '얼굴 중앙선에서 왼쪽·오른쪽 끝(볼)까지의 폭을 비교해 한쪽이 부었는지 봅니다. 양쪽 폭(초록 선)이 비슷할수록 점수가 높아요.',
    points: [234, 454, 10, 152],
    pairs: [[234, 454]],
    midline: true,
  },
  dark_circle: {
    desc: '눈 아래(노란 점)와 볼(주황 점)의 밝기를 비교합니다. 눈 밑이 볼보다 어두울수록 다크서클로 보고 점수가 낮아져요.',
    points: [145, 374, 50, 280],
  },
  wrinkle: {
    desc: '이마·미간·눈가·팔자(노란 점) 부위의 잔주름(결)을 매끈한 볼과 비교합니다. 결이 많을수록 점수가 낮아져요.',
    points: [151, 9, 33, 263, 205, 425],
  },
};

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
  const [boxWidth, setBoxWidth] = useState(0);
  // 슬라이더 위치를 '픽셀' 단위 Animated.Value로 관리합니다.
  // 드래그 시 setValue만 하므로 화면 전체 재렌더가 없어 움직임이 부드럽습니다.
  const sliderX = useRef(new Animated.Value(0)).current;

  const [records, setRecords] = useState<ScanRecord[]>([]); // 저장된 이력(최신순)
  const [refreshing, setRefreshing] = useState(false); // 새로고침 중 여부
  const [historyOpen, setHistoryOpen] = useState(false); // 기록 팝업 열림 여부
  const [simOpen, setSimOpen] = useState(false); // 예상 시뮬레이션 팝업 열림 여부
  const [imgRatio, setImgRatio] = useState<number | null>(null); // 사진 세로/가로 비율
  const [baseline, setBaseline] = useState<'latest' | 'previous' | null>(null); // 다른 사람일 때 기준 선택

  // ── 점수 상세(분석 부위 표시) 팝업 상태 ──
  const [detailScore, setDetailScore] = useState<FaceScore | null>(null); // 상세 보기 중인 점수
  const [detailLandmarks, setDetailLandmarks] = useState<LandmarkPoint[] | null>(null); // 그 사진의 얼굴 점
  const [detailLoading, setDetailLoading] = useState(false); // 점 불러오는 중
  const [detailBoxW, setDetailBoxW] = useState(0); // 상세 사진 영역 너비
  const [detailRatio, setDetailRatio] = useState<number | null>(null); // 상세 사진 세로/가로 비율

  // 화면이 열릴 때마다 이력을 불러옵니다.
  useEffect(() => {
    loadHistory();
  }, []);

  // 점수 카드를 누르면 그 사진의 얼굴 점을 받아와 분석 부위를 표시합니다.
  async function openDetail(score: FaceScore) {
    if (!newest) return; // 실제 기록이 있을 때만
    setDetailScore(score);
    setDetailLandmarks(null);
    setDetailRatio(null);
    setDetailLoading(true);
    try {
      const res = await getScanLandmarks(newest.id);
      setDetailLandmarks(res.detected ? res.landmarks ?? null : null);
    } catch (e) {
      console.log('상세 부위 불러오기 실패:', e);
      setDetailLandmarks(null);
    } finally {
      setDetailLoading(false);
    }
  }
  function closeDetail() {
    setDetailScore(null);
    setDetailLandmarks(null);
  }

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
    const w = e.nativeEvent.layout.width;
    setBoxWidth(w);
    sliderX.setValue(w / 2); // 처음엔 가운데
  }

  // 비교 영역의 화면상 왼쪽 좌표(절대). 드래그 중 손가락이 자식 위로 가도 좌표가 튀지 않게
  // 절대좌표(pageX)에서 이 값을 빼서 위치를 계산합니다.
  const boxLeftRef = useRef(0);

  // 절대 X좌표(pageX)로 슬라이더 위치(px)를 갱신합니다. (setValue만 → 재렌더 없음)
  function updateFromPageX(pageX: number) {
    if (boxWidth <= 0) return;
    let x = pageX - boxLeftRef.current;
    if (x < 0) x = 0;
    if (x > boxWidth) x = boxWidth;
    sliderX.setValue(x);
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
  // afterImage/beforeImage = 원본(분석 부위 모달에서 점·선을 겹쳐 그릴 때 사용)
  // afterFace/beforeFace = 얼굴만 잘라낸 버전(전후 슬라이더·시뮬 등 일반 표시용)
  const afterImage = newest ? fullImageUrl(newest.image_url) : '';
  const beforeImage = oldest ? fullImageUrl(oldest.image_url) : '';
  const afterFace = newest ? faceImageUrl(newest.image_url) : '';
  const beforeFace = oldest ? faceImageUrl(oldest.image_url) : '';

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
      <Text style={styles.buildTag}>앱 빌드 v{APP_BUILD}</Text>

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
          // 가로 드래그가 시작되면 바깥 스크롤뷰가 가로채지 못하게(끊김 방지)
          onMoveShouldSetResponderCapture={() => !!newest}
          onResponderTerminationRequest={() => false}
          onResponderGrant={(e) => {
            // grant 시점엔 이 박스가 터치 대상이라 locationX가 박스 기준 → 박스의 절대 왼쪽좌표 계산
            boxLeftRef.current = e.nativeEvent.pageX - e.nativeEvent.locationX;
            updateFromPageX(e.nativeEvent.pageX);
          }}
          onResponderMove={(e) => updateFromPageX(e.nativeEvent.pageX)}
        >
          {newest ? (
            <>
              {/* After 이미지 (최신 기록) — 얼굴만 잘라 표시 */}
              <Image
                source={{ uri: afterFace }}
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
                <Animated.View style={[styles.beforeClip, { width: sliderX }]}>
                  <Image
                    source={{ uri: beforeFace }}
                    style={[styles.image, { width: boxWidth }]}
                    resizeMode="contain"
                  />
                </Animated.View>
              )}

              {/* 슬라이더 손잡이 (기록이 2개 이상일 때만) — translateX로 이동(재렌더 없음) */}
              {hasTwo && boxWidth > 0 && (
                <Animated.View style={[styles.sliderHandle, { transform: [{ translateX: sliderX }] }]}>
                  <View style={styles.handleKnob}>
                    <View style={styles.handleBar} />
                    <View style={styles.handleBar} />
                  </View>
                </Animated.View>
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
          // 분석 부위 정보가 있고 실제 기록일 때만 눌러서 상세를 볼 수 있습니다.
          const canDetail = !!newest && !!SCORE_DETAIL[score.key];
          return (
            <Pressable
              key={score.label}
              style={[styles.scoreCard, canDetail && styles.scoreCardTappable]}
              onPress={() => canDetail && openDetail(score)}
              disabled={!canDetail}
            >
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
              {FACE_REGIONS[score.key] ? (
                <View style={styles.regionBox}>
                  <FaceRegionMini region={score.key} size={48} />
                  <View style={styles.regionInfo}>
                    <View style={styles.regionLabelRow}>
                      <Feather name="map-pin" size={11} color={colors.amber400} />
                      <Text style={styles.regionLabel}>분석 부위 · {FACE_REGIONS[score.key].short}</Text>
                    </View>
                    <Text style={styles.regionText}>{FACE_REGIONS[score.key].detail}</Text>
                  </View>
                </View>
              ) : null}
              {score.basis ? <Text style={styles.scoreBasis}>{score.basis}</Text> : null}
              {canDetail && (
                <View style={styles.scoreHintRow}>
                  <Feather name="map-pin" size={11} color={colors.amber400} />
                  <Text style={styles.scoreHint}>탭하여 분석 부위 보기</Text>
                  <Feather name="chevron-right" size={13} color={colors.amber400} />
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
      )}

      {/* 측정 신뢰도 카드: 모든 분석에 적용되는 보정을 알려 신뢰도를 높입니다. */}
      {showReport && newest && (
        <View style={styles.trustCard}>
          <View style={styles.trustHeader}>
            <Feather name="shield" size={16} color={colors.emerald} />
            <Text style={styles.trustTitle}>측정 신뢰도</Text>
          </View>
          <Text style={styles.trustDesc}>
            매 분석마다 같은 조건에서 재도록 아래 보정을 자동 적용해요.
          </Text>
          <View style={styles.trustList}>
            <View style={styles.trustItem}>
              <Feather name="user-check" size={14} color={colors.emerald} />
              <Text style={styles.trustItemText}>
                <Text style={styles.trustItemBold}>정면 확인</Text> · 고개가 많이 돌아간 사진은 다시 촬영 안내
              </Text>
            </View>
            <View style={styles.trustItem}>
              <Feather name="rotate-cw" size={14} color={colors.emerald} />
              <Text style={styles.trustItemText}>
                <Text style={styles.trustItemBold}>각도 보정</Text> · 얼굴을 똑바로 세워 기울임 때문에 생기는 가짜 비대칭 제거
              </Text>
            </View>
            <View style={styles.trustItem}>
              <Feather name="sun" size={14} color={colors.emerald} />
              <Text style={styles.trustItemText}>
                <Text style={styles.trustItemBold}>조명 보정</Text> · 조명의 색·밝기 영향을 줄여 일관된 피부톤(붉은기·밝기) 측정
              </Text>
            </View>
          </View>
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
                    source={{ uri: faceImageUrl(r.image_url) }}
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
                source={{ uri: afterFace }}
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

    {/* 점수 상세: 분석한 얼굴 부위를 사진 위에 표시 */}
    <Modal
      visible={!!detailScore}
      transparent
      animationType="fade"
      onRequestClose={closeDetail}
    >
      <Pressable style={styles.modalOverlay} onPress={closeDetail}>
        <Pressable style={styles.detailCard} onPress={() => {}}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{detailScore?.label} · 분석 부위</Text>
            <Pressable onPress={closeDetail} hitSlop={10}>
              <Feather name="x" size={22} color={colors.textMuted} />
            </Pressable>
          </View>

          {/* 사진 + 부위 표시 */}
          <View
            style={styles.detailImageBox}
            onLayout={(e) => setDetailBoxW(e.nativeEvent.layout.width)}
          >
            {detailLoading ? (
              <Text style={styles.detailLoadingText}>분석 부위를 불러오는 중…</Text>
            ) : detailLandmarks && detailBoxW > 0 ? (
              <>
                <Image
                  source={{ uri: afterImage }}
                  style={{ width: detailBoxW, height: detailBoxW * (detailRatio || 1) }}
                  resizeMode="cover"
                  onLoad={(e) => {
                    const src = e?.nativeEvent?.source;
                    if (src?.width && src?.height) setDetailRatio(src.height / src.width);
                  }}
                />
                {detailRatio && detailScore && (() => {
                  const cfg = SCORE_DETAIL[detailScore.key];
                  if (!cfg) return null;
                  const W = detailBoxW;
                  const H = detailBoxW * detailRatio;
                  const lm = detailLandmarks;
                  const els: any[] = [];
                  // 중앙 기준선
                  if (cfg.midline) {
                    const ids = [10, 1, 152].filter((i) => lm[i]);
                    const mx = ids.reduce((s, i) => s + lm[i].x, 0) / (ids.length || 1);
                    els.push(
                      <Line key="mid" x1={mx * W} y1={0} x2={mx * W} y2={H}
                        stroke={colors.amber400} strokeWidth={1} strokeDasharray="5 5" opacity={0.8} />
                    );
                  }
                  // 좌우 짝을 잇는 선
                  (cfg.pairs || []).forEach((pr, idx) => {
                    const a = lm[pr[0]], b = lm[pr[1]];
                    if (a && b) {
                      els.push(
                        <Line key={`p${idx}`} x1={a.x * W} y1={a.y * H} x2={b.x * W} y2={b.y * H}
                          stroke={colors.emerald} strokeWidth={1.5} opacity={0.9} />
                      );
                    }
                  });
                  // 강조 점
                  cfg.points.forEach((i, idx) => {
                    const p = lm[i];
                    if (p) {
                      els.push(
                        <Circle key={`c${idx}`} cx={p.x * W} cy={p.y * H} r={4.5}
                          fill={colors.amber400} stroke={colors.bg} strokeWidth={1.5} />
                      );
                    }
                  });
                  return (
                    <Svg style={StyleSheet.absoluteFill as any} width={W} height={H}>
                      {els}
                    </Svg>
                  );
                })()}
              </>
            ) : (
              <Text style={styles.detailLoadingText}>
                이 사진에서 분석 부위를 표시할 수 없어요.
              </Text>
            )}
          </View>

          {/* 설명 + 점수 */}
          {detailScore && (
            <>
              <Text style={styles.detailDesc}>{SCORE_DETAIL[detailScore.key]?.desc}</Text>
              <View style={styles.detailScoreRow}>
                <Text style={styles.detailScoreLabel}>이 분석 점수</Text>
                <Text style={styles.detailScoreValue}>{detailScore.value}점</Text>
              </View>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
    </>
  );
}

// 아직 기록이 없을 때 보여줄 예시 점수
const SAMPLE_SCORES: FaceScore[] = [
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
    marginBottom: 6,
  },
  buildTag: {
    color: colors.textFainter,
    fontSize: 11,
    textAlign: 'center',
    marginBottom: 20,
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
    left: 0,
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
  scoreCardTappable: {
    borderColor: 'rgba(245,158,11,0.35)',
  },
  scoreHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
  },
  scoreBasis: {
    color: colors.textFaint,
    fontSize: 11,
    marginTop: 6,
  },
  regionBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
    padding: 8,
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
  },
  regionInfo: {
    flex: 1,
  },
  regionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 3,
  },
  regionLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  regionText: {
    color: colors.textMuted,
    fontSize: 11.5,
    lineHeight: 16,
  },
  scoreHint: {
    color: colors.amber400,
    fontSize: 11,
    fontWeight: '500',
    flex: 1,
  },
  // 점수 상세(분석 부위) 팝업
  detailCard: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '88%',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border2,
    padding: 16,
  },
  detailImageBox: {
    width: '100%',
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    overflow: 'hidden',
    minHeight: 180,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailLoadingText: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 40,
  },
  detailDesc: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 14,
  },
  detailScoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  detailScoreLabel: {
    color: colors.textMuted,
    fontSize: 14,
  },
  detailScoreValue: {
    color: colors.amber400,
    fontSize: 22,
    fontWeight: 'bold',
  },
  // 점수 추이 차트 카드
  // 측정 신뢰도 카드
  trustCard: {
    marginTop: 16,
    backgroundColor: 'rgba(52,211,153,0.06)',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.3)',
    padding: 16,
  },
  trustHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  trustTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  trustDesc: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 12,
  },
  trustList: {
    gap: 10,
  },
  trustItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  trustItemText: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  trustItemBold: {
    color: colors.text,
    fontWeight: '700',
  },
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
