import { Feather, Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../theme';

// [7] 스토어 / 마이페이지 화면입니다.
// 맞춤 화장품 추천과 내 기기 정보·관리를 보여줍니다.

// 추천 제품 데이터 (프로토타입용)
const PRODUCTS = [
  { name: 'HeOnn 리페어 앰플', desc: '고주파 괄사 전용', icon: 'droplet' as const },
  { name: 'HeOnn 진정 크림', desc: '마사지 후 피부 진정', icon: 'circle' as const },
];

// 내 기기 정보 항목 (2열로 표시)
const DEVICE_INFO = [
  { label: '모델명', value: 'HF-PRO-01' },
  { label: '펌웨어 버전', value: 'v1.0.4 (최신)' },
  { label: 'MAC 주소', value: '00:1A:7D:XX:XX' },
  { label: '보증 기간', value: '~2027.05' },
];

export default function StoreScreen() {
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
      <View style={styles.tagRow}>
        <Text style={styles.analysisLabel}>AI 데이터 분석 기반:</Text>
        <Text style={styles.analysisChip}>탄력 저하 피부</Text>
      </View>

      {/* 추천 제품 가로 스크롤 */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.productRow}
      >
        {PRODUCTS.map((p) => (
          <View key={p.name} style={styles.productCard}>
            <View style={styles.productThumb}>
              <Feather name={p.icon} size={32} color="rgba(217,119,6,0.5)" />
            </View>
            <Text style={styles.productName}>{p.name}</Text>
            <Text style={styles.productDesc}>{p.desc}</Text>
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
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  analysisLabel: {
    color: colors.textFaint,
    fontSize: 14,
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
    width: 140,
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
    marginBottom: 12,
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
