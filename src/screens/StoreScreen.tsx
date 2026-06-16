import { Feather, Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Text from '../components/AppText';
import { getRecommendations, RecommendationResult } from '../api';
import { colors, radius } from '../theme';

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

// 기기 사용 기록 (예시 데이터 — 추후 실제 기기 연동 시 교체)
const USAGE_HISTORY = [
  { date: '2025.08.28', duration: '15분', area: '오른쪽 턱선(교근)', temp: '38°C', mode: '탄력 UP' },
  { date: '2025.08.27', duration: '12분', area: '광대·볼', temp: '40°C', mode: '릴렉스' },
  { date: '2025.08.26', duration: '10분', area: '이마·미간', temp: '36°C', mode: '집중' },
  { date: '2025.08.24', duration: '18분', area: '턱선·목', temp: '42°C', mode: '탄력 UP' },
  { date: '2025.08.22', duration: '9분', area: '눈가·관자놀이', temp: '35°C', mode: '수면' },
];

export default function StoreScreen() {
  const [rec, setRec] = useState<RecommendationResult | null>(null);
  const [usageOpen, setUsageOpen] = useState(false); // 사용 기록 팝업 열림 여부

  // 화면이 열릴 때 최신 분석 기반 추천을 불러옵니다.
  useEffect(() => {
    getRecommendations()
      .then(setRec)
      .catch((e) => console.log('추천 불러오기 실패:', e));
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

      {/* 맞춤 솔루션 안내 */}
      <View style={styles.sectionHeader}>
        <Ionicons name="sparkles" size={18} color={colors.amber500} />
        <Text style={styles.sectionTitle}>너를 위한 맞춤 솔루션</Text>
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
          <View style={styles.listRow}>
            <View style={[styles.listIcon, { backgroundColor: 'rgba(245,158,11,0.2)' }]}>
              <Feather name="bell" size={18} color={colors.amber500} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.listTitle}>세척 알림</Text>
              <Text style={styles.listDesc}>5회 사용 후 방짜유기 세척이 필요해요</Text>
            </View>
          </View>

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

          <Pressable style={[styles.listRow, { borderBottomWidth: 0 }]}>
            <View style={styles.listIcon}>
              <Feather name="play" size={18} color={colors.textMuted} />
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
