import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../theme';
import type { TabKey } from '../components/BottomNav';

// [3] 홈 화면(메인 대시보드)입니다.
// 기기 연결 상태, 오늘의 안면 컨디션, AI스캔/맞춤케어 진입 버튼, 팁을 보여줍니다.
// goTab: 다른 탭으로 이동하는 함수 (App.tsx에서 전달받음)
type Props = {
  goTab: (tab: TabKey) => void;
};

export default function HomeScreen({ goTab }: Props) {
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* 상단: 로고 + 알림/프로필 아이콘 */}
      <View style={styles.topBar}>
        <Text style={styles.logo}>HeOnn</Text>
        <View style={styles.topIcons}>
          <View>
            <Feather name="bell" size={24} color={colors.textMuted} />
            <View style={styles.redDot} />
          </View>
          <Feather name="user" size={24} color={colors.textMuted} />
        </View>
      </View>

      {/* 기기 연결 상태 바 */}
      <View style={styles.statusBar}>
        <View style={styles.statusLeft}>
          <Feather name="bluetooth" size={16} color={colors.emerald} />
          <Text style={styles.connectedText}>연결됨</Text>
        </View>
        <View style={styles.statusRight}>
          <View style={styles.statusItem}>
            <Feather name="battery" size={16} color={colors.textMuted} />
            <Text style={styles.statusItemText}>85%</Text>
          </View>
          <View style={styles.statusItem}>
            <Feather name="thermometer" size={16} color={colors.textMuted} />
            <Text style={styles.statusItemText}>32°C</Text>
          </View>
        </View>
      </View>

      {/* 오늘의 안면 컨디션 카드 */}
      <View style={styles.conditionCard}>
        <Text style={styles.conditionLabel}>오늘의 안면 컨디션</Text>
        <Text style={styles.conditionTitle}>
          어제보다 안면 부기가{'\n'}
          <Text style={{ color: colors.amber400 }}>15% 감소</Text>했어요!
        </Text>
        <Pressable style={styles.conditionLink} onPress={() => goTab('report')}>
          <Text style={styles.conditionLinkText}>상세 리포트 보기</Text>
          <Feather name="chevron-right" size={16} color={colors.amber400} />
        </Pressable>
      </View>

      {/* AI 스캔 / 맞춤 케어 진입 버튼 2개 */}
      <View style={styles.grid}>
        <Pressable style={styles.gridCard} onPress={() => goTab('scan')}>
          <View style={styles.gridIconDark}>
            <MaterialCommunityIcons name="face-recognition" size={24} color={colors.amber400} />
          </View>
          <Text style={styles.gridText}>AI 3D 스캔</Text>
        </Pressable>

        <Pressable style={[styles.gridCard, styles.gridCardAmber]} onPress={() => goTab('care')}>
          <View style={styles.gridIconAmber}>
            <Ionicons name="sparkles" size={22} color={colors.bg} />
          </View>
          <Text style={[styles.gridText, { color: colors.white }]}>맞춤 케어 시작</Text>
        </Pressable>
      </View>

      {/* HeOnn 팁 카드 */}
      <Pressable style={styles.tipCard}>
        <View>
          <View style={styles.tipHeader}>
            <View style={styles.amberDot} />
            <Text style={styles.tipTitle}>HeOnn Tip</Text>
          </View>
          <Text style={styles.tipText}>탄력 저하 시 맞춤 루틴 확인하기</Text>
        </View>
        <Feather name="chevron-right" size={20} color={colors.textFainter} />
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
    paddingBottom: 110, // 하단 탭 바에 가리지 않도록 여백
    gap: 16,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  logo: {
    fontSize: 24,
    fontFamily: 'serif',
    color: colors.amber300,
  },
  topIcons: {
    flexDirection: 'row',
    gap: 16,
  },
  redDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 10,
    height: 10,
    borderRadius: radius.full,
    backgroundColor: colors.red,
    borderWidth: 2,
    borderColor: colors.bg,
  },
  statusBar: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  connectedText: {
    color: colors.emerald,
    fontSize: 14,
    fontWeight: '500',
  },
  statusRight: {
    flexDirection: 'row',
    gap: 16,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusItemText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  conditionCard: {
    backgroundColor: colors.surface2,
    borderRadius: radius.lg,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border2,
  },
  conditionLabel: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  conditionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 16,
    lineHeight: 28,
  },
  conditionLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  conditionLinkText: {
    color: colors.amber400,
    fontSize: 14,
    fontWeight: '500',
  },
  grid: {
    flexDirection: 'row',
    gap: 12,
  },
  gridCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  gridCardAmber: {
    backgroundColor: colors.amber600,
    borderColor: colors.amber600,
  },
  gridIconDark: {
    backgroundColor: colors.surface2,
    padding: 12,
    borderRadius: radius.full,
  },
  gridIconAmber: {
    backgroundColor: colors.amber500,
    padding: 12,
    borderRadius: radius.full,
  },
  gridText: {
    color: colors.text,
    fontWeight: '500',
    fontSize: 14,
  },
  tipCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  amberDot: {
    width: 6,
    height: 6,
    borderRadius: radius.full,
    backgroundColor: colors.amber500,
  },
  tipTitle: {
    color: colors.text,
    fontWeight: '500',
  },
  tipText: {
    color: colors.textFaint,
    fontSize: 14,
  },
});
