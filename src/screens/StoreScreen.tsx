import { Feather, Ionicons } from '@expo/vector-icons';
import { ComponentProps, useEffect, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Rect } from 'react-native-svg';
import Text from '../components/AppText';
import { getRecommendations, RecommendationResult, AppUser, getAiMetrics, AiMetrics } from '../api';
import { colors, radius } from '../theme';

// 세척 주기 설정: 10회 사용마다 세척 권장 (예시 데이터)
const CLEAN_THRESHOLD = 10;
const CLEAN_USE_COUNT = 10; // 현재까지 세척 후 사용 횟수(예시)

// [7] 스토어 / 마이페이지 화면입니다.
// 최신 얼굴 분석(부기·피부톤)에 맞춘 추천 제품과 내 기기 정보·관리를 보여줍니다.

// 추천 제품 카드 크기 (스와이프 스냅 계산에 사용)
const CARD_WIDTH = 170;
const CARD_GAP = 16;

// 내 기기 정보 항목 (2열로 표시)
const DEVICE_INFO = [
  { label: '모델명', value: 'HF-PRO-01' },
  { label: '펌웨어 버전', value: 'v1.0.4 (최신)' },
  { label: 'MAC 주소', value: '00:1A:7D:XX:XX' },
  { label: '보증 기간', value: '~2027.05' },
];

// 올바른 보관 가이드 카드 (괄사·뷰티 도구 보관법 참고하여 방짜유기 디바이스에 맞게 작성)
type FeatherName = ComponentProps<typeof Feather>['name'];
const STORAGE_GUIDE: { icon: FeatherName; title: string; body: string }[] = [
  {
    icon: 'droplet',
    title: '사용 후 바로 세척',
    body: '사용 직후 부드러운 극세사 천으로 접촉면을 닦아 피지·잔여물을 제거하세요. 깊은 세척은 미지근한 물과 순한 비누로 가볍게 하고 헹굽니다.',
  },
  {
    icon: 'wind',
    title: '완전히 건조하기',
    body: '방짜유기는 습기에 닿으면 변색·부식될 수 있어요. 보관 전 마른 천으로 물기를 완전히 닦아 충분히 말려 주세요.',
  },
  {
    icon: 'home',
    title: '서늘하고 건조한 곳',
    body: '직사광선·고온·습기를 피해 서늘하고 건조한 곳에 보관하세요. 세균이 많은 욕실 보관은 피하는 것이 좋습니다.',
  },
  {
    icon: 'package',
    title: '전용 파우치·케이스 사용',
    body: '부드러운 천 케이스나 파우치에 넣어 흠집과 충격으로부터 보호하세요. 떨어뜨리면 손상될 수 있으니 조심히 다뤄 주세요.',
  },
  {
    icon: 'battery-charging',
    title: '전원·배터리 관리',
    body: '사용 후에는 전원을 끄고, 오래 보관할 때는 적정 수준으로 충전해 두세요. 온열 접촉면은 깨끗이 닦은 뒤 보관합니다.',
  },
  {
    icon: 'refresh-cw',
    title: '정기 점검·소독',
    body: '약 5회 사용마다 세척하고, 주기적으로 마른 천으로 광택을 관리하세요. 위생적으로 오래 사용할 수 있어요.',
  },
];

// 올바른 세척 방법 가이드 카드 (괄사 세척법 참고하여 방짜유기 전자 디바이스에 맞게 작성)
const CLEANING_GUIDE: { icon: FeatherName; title: string; body: string }[] = [
  {
    icon: 'power',
    title: '전원 끄고 식히기',
    body: '사용 직후 전원을 끄고, 온열 접촉면이 충분히 식을 때까지 기다린 뒤 세척을 시작하세요.',
  },
  {
    icon: 'wind',
    title: '부드러운 천으로 닦기',
    body: '극세사 천으로 접촉면의 피지·오일·잔여물을 먼저 부드럽게 닦아냅니다.',
  },
  {
    icon: 'droplet',
    title: '순한 비누로 가볍게',
    body: '미지근한 물에 순한 비누를 묻혀 접촉면만 살살 닦아 주세요. 세게 문지르지 않습니다.',
  },
  {
    icon: 'check-circle',
    title: '헹구고 물기 제거',
    body: '깨끗한 물로 비누기를 헹군 뒤, 마른 천으로 물기를 꼼꼼히 닦아냅니다.',
  },
  {
    icon: 'sun',
    title: '완전히 건조 후 보관',
    body: '통풍이 잘 되는 곳에서 완전히 말린 뒤 보관하세요. 방짜유기는 습기에 변색될 수 있어요.',
  },
  {
    icon: 'shield',
    title: '주기적 소독',
    body: '주 1회 정도 알코올 솜으로 접촉면을 닦아 위생적으로 소독해 주세요.',
  },
];

// 기기 사용 기록 (예시 데이터 — 추후 실제 기기 연동 시 교체)
const USAGE_HISTORY = [
  { date: '2025.08.28', duration: '15분', area: '오른쪽 턱선(교근)', temp: '38°C', mode: '탄력 UP' },
  { date: '2025.08.27', duration: '12분', area: '광대·볼', temp: '40°C', mode: '릴렉스' },
  { date: '2025.08.26', duration: '10분', area: '이마·미간', temp: '36°C', mode: '집중' },
  { date: '2025.08.24', duration: '18분', area: '턱선·목', temp: '42°C', mode: '탄력 UP' },
  { date: '2025.08.22', duration: '9분', area: '눈가·관자놀이', temp: '35°C', mode: '수면' },
];

// 상위(App)에서 로그인한 사용자 정보와 로그아웃 기능을 받습니다.
type StoreScreenProps = {
  user: AppUser | null;
  onLogout: () => void;
};

export default function StoreScreen({ user, onLogout }: StoreScreenProps) {
  const [rec, setRec] = useState<RecommendationResult | null>(null);
  const [metrics, setMetrics] = useState<AiMetrics | null>(null); // AI 검증 지표
  const [usageOpen, setUsageOpen] = useState(false); // 사용 기록 팝업 열림 여부
  const [storageOpen, setStorageOpen] = useState(false); // 보관 가이드 팝업 열림 여부
  const [cleaningOpen, setCleaningOpen] = useState(false); // 세척 방법 가이드 팝업 열림 여부
  const needClean = CLEAN_USE_COUNT >= CLEAN_THRESHOLD; // 세척 필요 여부

  // 화면이 열릴 때 최신 분석 기반 추천을 불러옵니다.
  useEffect(() => {
    getRecommendations()
      .then(setRec)
      .catch((e) => console.log('추천 불러오기 실패:', e));
    // AI 검증 지표(검출 성공률·재사용률)도 함께 불러옵니다.
    getAiMetrics()
      .then(setMetrics)
      .catch((e) => console.log('지표 불러오기 실패:', e));
  }, []);

  return (
    <>
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* 상단 제목 + 설정 아이콘 */}
      <View style={styles.topBar}>
        <Text style={styles.title}>스토어 / 마이페이지</Text>
        <Feather name="settings" size={20} color={colors.textMuted} />
      </View>

      {/* 로그인한 사용자 정보 + 로그아웃 */}
      <View style={styles.accountCard}>
        <View style={styles.accountLeft}>
          <View style={styles.accountAvatar}>
            <Feather name="user" size={22} color={colors.amber400} />
          </View>
          <View>
            <Text style={styles.accountName}>{user?.display_name ?? '게스트'}</Text>
            <Text style={styles.accountProvider}>
              {user ? `${user.provider} 계정으로 로그인됨` : '로그인 정보가 없습니다'}
            </Text>
          </View>
        </View>
        <Pressable style={styles.logoutButton} onPress={onLogout}>
          <Feather name="log-out" size={16} color={colors.textMuted} />
          <Text style={styles.logoutText}>로그아웃</Text>
        </Pressable>
      </View>

      {/* 맞춤 솔루션 안내 */}
      <View style={styles.sectionHeader}>
        <Ionicons name="sparkles" size={18} color={colors.amber500} />
        <Text style={styles.sectionTitle}>나를 위한 맞춤 솔루션</Text>
      </View>

      {/* 분석 요약 (있으면 분석 기반, 없으면 안내) */}
      {rec?.has_record && rec.summary ? (
        <View style={styles.tagWrap}>
          <Text style={styles.analysisLabel}>AI 분석 기반:</Text>
          <Text style={styles.analysisChip}>부기 {rec.summary.balance}점</Text>
          <Text style={styles.analysisChip}>{rec.summary.skin_tone}</Text>
          <Text style={styles.analysisChip}>{rec.summary.skin_redness}</Text>
        </View>
      ) : (
        <Text style={styles.analysisMessage}>
          {rec?.message ?? 'AI스캔에서 분석하면 맞춤 추천을 받을 수 있어요.'}
        </Text>
      )}

      {/* 추천 제품 가로 스와이프 (카드 단위로 넘어감, 최대 5개) */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.productRow}
        snapToInterval={CARD_WIDTH + CARD_GAP}
        snapToAlignment="start"
        decelerationRate="fast"
      >
        {(rec?.products ?? []).map((p, idx) => (
          <View key={`${p.name}-${idx}`} style={styles.productCard}>
            <View style={styles.productThumb}>
              {p.image ? (
                // 제품 대표 이미지
                <Image source={{ uri: p.image }} style={styles.productImage} resizeMode="cover" />
              ) : (
                <Feather name="droplet" size={32} color="rgba(217,119,6,0.5)" />
              )}
            </View>
            <Text style={styles.productName}>{p.name}</Text>
            <Text style={styles.productDesc}>{p.desc}</Text>
            {/* 추천 이유 (분석 결과 기반) */}
            <Text style={styles.productReason}>{p.reason}</Text>
            <Pressable style={styles.buyButton}>
              <Text style={styles.buyButtonText}>구매하기</Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>

      {/* AI 검증 지표 (개발·검증용 — 실제 측정 데이터) */}
      <Text style={styles.deviceSectionTitle}>AI 검증 지표</Text>
      <View style={styles.metricsCard}>
        <View style={styles.metricRow}>
          <View style={styles.metricLeft}>
            <Feather name="target" size={18} color={colors.amber400} />
            <View>
              <Text style={styles.metricLabel}>랜드마크 검출 성공률</Text>
              <Text style={styles.metricSub}>
                분석 {metrics?.landmark.total_attempts ?? 0}회 중 {metrics?.landmark.success_count ?? 0}회 성공
              </Text>
            </View>
          </View>
          <Text style={styles.metricValue}>{metrics?.landmark.success_rate ?? 0}%</Text>
        </View>

        <View style={styles.metricDivider} />

        <View style={styles.metricRow}>
          <View style={styles.metricLeft}>
            <Feather name="repeat" size={18} color={colors.amber400} />
            <View>
              <Text style={styles.metricLabel}>재사용률</Text>
              <Text style={styles.metricSub}>
                사용자 {metrics?.retention.active_users ?? 0}명 중 {metrics?.retention.returning_users ?? 0}명 재사용
              </Text>
            </View>
          </View>
          <Text style={styles.metricValue}>{metrics?.retention.reuse_rate ?? 0}%</Text>
        </View>

        <View style={styles.metricDivider} />

        <View style={styles.metricRow}>
          <View style={styles.metricLeft}>
            <Feather name="smile" size={18} color={colors.amber400} />
            <View>
              <Text style={styles.metricLabel}>만족도 (CSAT)</Text>
              <Text style={styles.metricSub}>
                평가 {metrics?.csat.total_responses ?? 0}건 중 {metrics?.csat.satisfied_count ?? 0}건 만족
              </Text>
            </View>
          </View>
          <Text style={styles.metricValue}>{metrics?.csat.csat ?? 0}%</Text>
        </View>

        <View style={styles.metricDivider} />

        <View style={styles.metricRow}>
          <View style={styles.metricLeft}>
            <Feather name="clock" size={18} color={colors.amber400} />
            <View>
              <Text style={styles.metricLabel}>분석 처리 시간</Text>
              <Text style={styles.metricSub}>
                분석 {metrics?.latency.sample_count ?? 0}건 평균 (약 {metrics?.latency.approx_fps ?? 0}장/초)
              </Text>
            </View>
          </View>
          <Text style={styles.metricValue}>{metrics?.latency.avg_duration_ms ?? 0}ms</Text>
        </View>
      </View>

      {/* 내 디바이스 정보 및 관리 */}
      <Text style={styles.deviceSectionTitle}>내 디바이스 정보 및 관리</Text>
      <View style={styles.deviceCard}>
        {/* 기기 상태 헤더 */}
        <View style={styles.deviceHeader}>
          <View style={styles.deviceHeaderLeft}>
            <View style={styles.deviceIcon}>
              <Feather name="smartphone" size={24} color={colors.amber400} />
            </View>
            <View>
              <Text style={styles.deviceName}>HeOnn FaceFit</Text>
              <View style={styles.onlineRow}>
                <View style={styles.onlineDot} />
                <Text style={styles.onlineText}>온라인 (배터리 85%)</Text>
              </View>
            </View>
          </View>
          <Feather name="info" size={20} color={colors.textFaint} />
        </View>

        {/* 기기 정보 2열 그리드 */}
        <View style={styles.infoGrid}>
          {DEVICE_INFO.map((info) => (
            <View key={info.label} style={styles.infoCell}>
              <Text style={styles.infoLabel}>{info.label}</Text>
              <Text style={styles.infoValue}>{info.value}</Text>
            </View>
          ))}
        </View>

        {/* 알림/사용시간/가이드 목록 */}
        <View style={styles.listSection}>
          <Pressable style={styles.listRow} onPress={() => setCleaningOpen(true)}>
            <View style={[styles.listIcon, { backgroundColor: 'rgba(245,158,11,0.2)' }]}>
              <Feather name="bell" size={18} color={colors.amber500} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.cleanTitleRow}>
                <Text style={styles.listTitle}>세척 알림</Text>
                <Text style={styles.cleanCount}>
                  사용 {CLEAN_USE_COUNT}/{CLEAN_THRESHOLD}회
                </Text>
              </View>
              <Text style={[styles.listDesc, needClean && { color: colors.amber400 }]}>
                {needClean
                  ? `${CLEAN_THRESHOLD}회 사용했어요. 지금 세척해 주세요! (방법 보기)`
                  : `${CLEAN_THRESHOLD}회 사용 시 방짜유기 세척이 필요해요`}
              </Text>
            </View>
            <Feather name="chevron-right" size={16} color={colors.textFainter} />
          </Pressable>

          <Pressable style={styles.listRow} onPress={() => setUsageOpen(true)}>
            <View style={styles.listIcon}>
              <Feather name="activity" size={18} color={colors.textMuted} />
            </View>
            <View style={styles.listRowSplit}>
              <View>
                <Text style={styles.listTitle}>누적 사용 시간</Text>
                <Text style={styles.listDesc}>최근 30일 기준 · 눌러서 기록 보기</Text>
              </View>
              <View style={styles.listValueWrap}>
                <Text style={styles.listValue}>12h 30m</Text>
                <Feather name="chevron-right" size={16} color={colors.textFainter} />
              </View>
            </View>
          </Pressable>

          <Pressable
            style={[styles.listRow, { borderBottomWidth: 0 }]}
            onPress={() => setStorageOpen(true)}
          >
            <View style={styles.listIcon}>
              <Feather name="book-open" size={18} color={colors.textMuted} />
            </View>
            <Text style={[styles.listTitle, { flex: 1 }]}>올바른 보관 가이드 보기</Text>
            <Feather name="chevron-right" size={16} color={colors.textFainter} />
          </Pressable>
        </View>
      </View>
    </ScrollView>

    {/* 기기 사용 기록 팝업 */}
    <Modal
      visible={usageOpen}
      transparent
      animationType="fade"
      onRequestClose={() => setUsageOpen(false)}
    >
      <Pressable style={styles.modalOverlay} onPress={() => setUsageOpen(false)}>
        <Pressable style={styles.modalCard} onPress={() => {}}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>기기 사용 기록</Text>
              <Text style={styles.modalSub}>최근 30일 · 누적 12h 30m</Text>
            </View>
            <Pressable onPress={() => setUsageOpen(false)} hitSlop={10}>
              <Feather name="x" size={22} color={colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
            {USAGE_HISTORY.map((u, idx) => (
              <View key={idx} style={styles.usageRow}>
                {/* 날짜 + 사용 시간 */}
                <View style={styles.usageTop}>
                  <Text style={styles.usageDate}>{u.date}</Text>
                  <View style={styles.usageDuration}>
                    <Feather name="clock" size={12} color={colors.amber400} />
                    <Text style={styles.usageDurationText}>{u.duration}</Text>
                  </View>
                </View>

                {/* 부위 / 온도 / 모드 */}
                <View style={styles.usageTags}>
                  <View style={styles.usageTag}>
                    <Feather name="user" size={12} color={colors.textMuted} />
                    <Text style={styles.usageTagText}>{u.area}</Text>
                  </View>
                  <View style={styles.usageTag}>
                    <Feather name="thermometer" size={12} color={colors.textMuted} />
                    <Text style={styles.usageTagText}>{u.temp}</Text>
                  </View>
                  <View style={styles.usageTag}>
                    <Feather name="activity" size={12} color={colors.textMuted} />
                    <Text style={styles.usageTagText}>{u.mode}</Text>
                  </View>
                </View>
              </View>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>

    {/* 올바른 보관 가이드 팝업 (카드 상하 스크롤) */}
    <Modal
      visible={storageOpen}
      transparent
      animationType="slide"
      onRequestClose={() => setStorageOpen(false)}
    >
      <Pressable style={styles.modalOverlay} onPress={() => setStorageOpen(false)}>
        <Pressable style={styles.guideCard} onPress={() => {}}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>올바른 보관 가이드</Text>
              <Text style={styles.modalSub}>방짜유기 괄사 디바이스를 오래 쓰는 법</Text>
            </View>
            <Pressable onPress={() => setStorageOpen(false)} hitSlop={10}>
              <Feather name="x" size={22} color={colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView style={styles.guideList} showsVerticalScrollIndicator={false}>
            {STORAGE_GUIDE.map((g, idx) => (
              <View key={idx} style={styles.guideItem}>
                <View style={styles.guideIcon}>
                  <Feather name={g.icon} size={20} color={colors.amber400} />
                </View>
                <View style={styles.guideTextWrap}>
                  <Text style={styles.guideStepTitle}>
                    {idx + 1}. {g.title}
                  </Text>
                  <Text style={styles.guideStepBody}>{g.body}</Text>
                </View>
              </View>
            ))}
            <Text style={styles.guideFooter}>
              ※ 일반적인 괄사·뷰티 도구 보관법을 참고해 정리했어요.
            </Text>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>

    {/* 올바른 세척 방법 가이드 팝업 (카드 상하 스크롤 + 일러스트) */}
    <Modal
      visible={cleaningOpen}
      transparent
      animationType="slide"
      onRequestClose={() => setCleaningOpen(false)}
    >
      <Pressable style={styles.modalOverlay} onPress={() => setCleaningOpen(false)}>
        <Pressable style={styles.guideCard} onPress={() => {}}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>올바른 세척 방법</Text>
              <Text style={styles.modalSub}>방짜유기 괄사 디바이스를 위생적으로</Text>
            </View>
            <Pressable onPress={() => setCleaningOpen(false)} hitSlop={10}>
              <Feather name="x" size={22} color={colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView style={styles.guideList} showsVerticalScrollIndicator={false}>
            {/* 직접 그린 일러스트 (디바이스 + 물방울 + 반짝임) */}
            <View style={styles.cleanIllust}>
              <Svg width={200} height={96}>
                {/* 디바이스 본체 */}
                <Rect x={66} y={20} width={68} height={56} rx={16} fill={colors.surface2} stroke={colors.amber500} strokeWidth={2} />
                {/* 접촉면 하이라이트 */}
                <Rect x={74} y={28} width={52} height={18} rx={9} fill="rgba(245,158,11,0.25)" />
                {/* 물방울 */}
                <Circle cx={40} cy={40} r={7} fill={colors.amber400} opacity={0.8} />
                <Circle cx={52} cy={62} r={5} fill={colors.amber400} opacity={0.6} />
                <Circle cx={160} cy={46} r={7} fill={colors.amber400} opacity={0.8} />
                <Circle cx={150} cy={66} r={5} fill={colors.amber400} opacity={0.6} />
                {/* 반짝임 */}
                <Line x1={150} y1={18} x2={150} y2={30} stroke={colors.amber300} strokeWidth={2} />
                <Line x1={144} y1={24} x2={156} y2={24} stroke={colors.amber300} strokeWidth={2} />
              </Svg>
            </View>

            {CLEANING_GUIDE.map((g, idx) => (
              <View key={idx} style={styles.guideItem}>
                <View style={styles.guideIcon}>
                  <Feather name={g.icon} size={20} color={colors.amber400} />
                </View>
                <View style={styles.guideTextWrap}>
                  <Text style={styles.guideStepTitle}>
                    {idx + 1}. {g.title}
                  </Text>
                  <Text style={styles.guideStepBody}>{g.body}</Text>
                </View>
              </View>
            ))}

            {/* 주의 */}
            <View style={styles.cleanCaution}>
              <Feather name="alert-triangle" size={16} color={colors.red} />
              <Text style={styles.cleanCautionText}>
                충전 단자·전자 부품은 물에 담그지 마세요. 접촉면만 세척합니다.
              </Text>
            </View>
            <Text style={styles.guideFooter}>※ 일반적인 괄사 세척법을 참고해 정리했어요.</Text>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
    </>
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
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    color: colors.text,
    fontWeight: '500',
    fontSize: 16,
  },
  // 로그인 사용자 카드
  accountCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  accountLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexShrink: 1,
  },
  accountAvatar: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountName: {
    color: colors.text,
    fontWeight: '600',
    fontSize: 15,
  },
  accountProvider: {
    color: colors.textFaint,
    fontSize: 12,
    marginTop: 2,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    backgroundColor: colors.surface2,
  },
  logoutText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '500',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    color: colors.text,
    fontWeight: '500',
    fontSize: 15,
  },
  tagWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  analysisLabel: {
    color: colors.textFaint,
    fontSize: 14,
  },
  analysisMessage: {
    color: colors.textFaint,
    fontSize: 14,
    marginBottom: 16,
  },
  analysisChip: {
    color: colors.amber400,
    fontSize: 12,
    lineHeight: 18,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.3)',
    backgroundColor: 'rgba(245,158,11,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: 'hidden',
  },
  productRow: {
    gap: CARD_GAP,
    paddingBottom: 16,
  },
  productCard: {
    width: CARD_WIDTH,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 12,
  },
  productThumb: {
    height: 96,
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    marginBottom: 12,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  productName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  productDesc: {
    color: colors.textFaint,
    fontSize: 12,
    marginBottom: 8,
  },
  productReason: {
    color: colors.amber400,
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 12,
    minHeight: 32,
  },
  buyButton: {
    paddingVertical: 8,
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  buyButtonText: {
    color: colors.amber400,
    fontSize: 12,
    fontWeight: '500',
  },
  deviceSectionTitle: {
    color: colors.text,
    fontWeight: '500',
    fontSize: 15,
    marginTop: 16,
    marginBottom: 16,
  },
  // AI 검증 지표 카드
  metricsCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  metricLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexShrink: 1,
  },
  metricLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '500',
  },
  metricSub: {
    color: colors.textFaint,
    fontSize: 12,
    marginTop: 2,
  },
  metricValue: {
    color: colors.amber400,
    fontSize: 20,
    fontWeight: '700',
  },
  metricDivider: {
    height: 1,
    backgroundColor: colors.border,
  },
  deviceCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  deviceHeader: {
    padding: 16,
    backgroundColor: colors.surface2,
    borderBottomWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deviceHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  deviceIcon: {
    width: 48,
    height: 48,
    backgroundColor: 'rgba(245,158,11,0.1)',
    borderRadius: radius.full,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.2)',
  },
  deviceName: {
    color: colors.text,
    fontWeight: '500',
    fontSize: 15,
  },
  onlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: radius.full,
    backgroundColor: colors.emerald,
  },
  onlineText: {
    color: colors.emerald,
    fontSize: 12,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  infoCell: {
    width: '50%',
    padding: 16,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  infoLabel: {
    color: colors.textFaint,
    fontSize: 12,
    marginBottom: 4,
  },
  infoValue: {
    color: colors.textMuted,
    fontSize: 14,
  },
  listSection: {
    padding: 4,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 12,
    borderBottomWidth: 1,
    borderColor: 'rgba(39,39,42,0.5)',
  },
  listRowSplit: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  listIcon: {
    backgroundColor: colors.surface2,
    padding: 8,
    borderRadius: radius.md,
  },
  listTitle: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '500',
  },
  listDesc: {
    color: colors.textFaint,
    fontSize: 11,
    marginTop: 2,
  },
  listValue: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '500',
  },
  listValueWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  // 사용 기록 팝업
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
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  modalSub: {
    color: colors.textFaint,
    fontSize: 12,
    marginTop: 2,
  },
  // 보관 가이드 팝업
  guideCard: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '82%',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border2,
    padding: 16,
  },
  guideList: {
    flexGrow: 0,
    marginTop: 4,
  },
  guideItem: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: colors.surface2,
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: 10,
  },
  guideIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: 'rgba(245,158,11,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  guideTextWrap: { flex: 1 },
  guideStepTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  guideStepBody: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  guideFooter: {
    color: colors.textFainter,
    fontSize: 11,
    textAlign: 'center',
    paddingVertical: 12,
  },
  cleanTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cleanCount: {
    color: colors.amber400,
    fontSize: 11,
    fontWeight: '700',
    backgroundColor: 'rgba(245,158,11,0.12)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  cleanIllust: {
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 8,
  },
  cleanCaution: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
    borderRadius: radius.md,
    padding: 12,
    marginTop: 4,
  },
  cleanCautionText: {
    color: colors.textMuted,
    fontSize: 12,
    flex: 1,
    lineHeight: 17,
  },
  modalList: {
    flexGrow: 0,
  },
  usageRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: 'rgba(39,39,42,0.7)',
  },
  usageTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  usageDate: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '500',
  },
  usageDuration: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  usageDurationText: {
    color: colors.amber400,
    fontSize: 13,
    fontWeight: '500',
  },
  usageTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  usageTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surface2,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  usageTagText: {
    color: colors.textMuted,
    fontSize: 12,
  },
});
