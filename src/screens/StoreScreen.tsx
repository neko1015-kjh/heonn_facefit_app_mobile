import { Feather, Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getRecommendations, RecommendationResult } from '../api';
import { colors, radius } from '../theme';

// [7] 스토어 / 마이페이지 화면입니다.
// 최신 얼굴 분석(부기·피부톤)에 맞춘 추천 제품과 내 기기 정보·관리를 보여줍니다.

// 내 기기 정보 항목 (2열로 표시)
const DEVICE_INFO = [
  { label: '모델명', value: 'HF-PRO-01' },
  { label: '펌웨어 버전', value: 'v1.0.4 (최신)' },
  { label: 'MAC 주소', value: '00:1A:7D:XX:XX' },
  { label: '보증 기간', value: '~2027.05' },
];

export default function StoreScreen() {
  const [rec, setRec] = useState<RecommendationResult | null>(null);

  // 화면이 열릴 때 최신 분석 기반 추천을 불러옵니다.
  useEffect(() => {
    getRecommendations()
      .then(setRec)
      .catch((e) => console.log('추천 불러오기 실패:', e));
  }, []);

  return (
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
        <Text style={styles.analysisLabel}>
          {rec?.message ?? 'AI스캔에서 분석하면 맞춤 추천을 받을 수 있어요.'}
        </Text>
      )}

      {/* 추천 제품 가로 스크롤 (분석 결과에 따라 달라짐) */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.productRow}
      >
        {(rec?.products ?? []).map((p, idx) => (
          <View key={`${p.name}-${idx}`} style={styles.productCard}>
            <View style={styles.productThumb}>
              <Feather name="droplet" size={32} color="rgba(217,119,6,0.5)" />
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

          <View style={styles.listRow}>
            <View style={styles.listIcon}>
              <Feather name="activity" size={18} color={colors.textMuted} />
            </View>
            <View style={styles.listRowSplit}>
              <View>
                <Text style={styles.listTitle}>누적 사용 시간</Text>
                <Text style={styles.listDesc}>최근 30일 기준</Text>
              </View>
              <Text style={styles.listValue}>12h 30m</Text>
            </View>
          </View>

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
    marginBottom: 16,
  },
  analysisChip: {
    color: colors.amber400,
    fontSize: 12,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.3)',
    backgroundColor: 'rgba(245,158,11,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  productRow: {
    gap: 16,
    paddingBottom: 16,
  },
  productCard: {
    width: 170,
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
});
