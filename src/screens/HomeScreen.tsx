import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Text from '../components/AppText';
import { getHistory, ScanRecord } from '../api';
import { colors, radius } from '../theme';
import type { TabKey } from '../components/BottomNav';

// 홈 알림센터에 표시할 공지사항·괄사 사용 알림 (예시 데이터)
const NOTIFICATIONS = [
  {
    id: 1,
    cat: '공지',
    icon: 'info' as const,
    title: 'HeOnn Facefit v1.0.4 업데이트',
    body: '부기 분석 정확도가 향상되고 맞춤 추천이 더 정교해졌어요.',
    time: '방금',
    unread: true,
  },
  {
    id: 2,
    cat: '이벤트',
    icon: 'gift' as const,
    title: '여름 부기 케어 챌린지',
    body: '7일 연속 케어하고 리워드를 받아보세요.',
    time: '1시간 전',
    unread: true,
  },
  {
    id: 3,
    cat: '케어',
    icon: 'clock' as const,
    title: '오늘의 케어 리마인더',
    body: '자기 전 10분, 부기 모드로 하루를 마무리해요.',
    time: '3시간 전',
    unread: false,
  },
  {
    id: 4,
    cat: '기기',
    icon: 'droplet' as const,
    title: '방짜유기 세척 안내',
    body: '5회 사용 후 깨끗한 세척이 필요해요. 위생적으로 관리하세요.',
    time: '어제',
    unread: false,
  },
  {
    id: 5,
    cat: '리포트',
    icon: 'bar-chart-2' as const,
    title: '주간 변화 리포트 도착',
    body: '이번 주 좌우 균형이 좋아졌어요. 리포트 탭에서 확인해 보세요.',
    time: '2일 전',
    unread: false,
  },
];

// [3] 홈 화면(메인 대시보드)입니다.
// 기기 연결 상태, 오늘의 안면 컨디션, AI스캔/맞춤케어 진입 버튼, 팁을 보여줍니다.
// goTab: 다른 탭으로 이동하는 함수 (App.tsx에서 전달받음)
type Props = {
  goTab: (tab: TabKey) => void;
};

// 기록에서 특정 점수 값을 꺼냅니다.
function scoreOf(record: ScanRecord | undefined, key: string) {
  return record?.scores.find((s) => s.key === key)?.value;
}

// "오늘의 안면 컨디션" 문구를 분석 기록에 맞춰 만들어 줍니다.
function renderCondition(newest?: ScanRecord, previous?: ScanRecord) {
  // 기록이 없을 때
  if (!newest) {
    return (
      <Text style={styles.conditionTitle}>
        AI 스캔으로 첫 얼굴 분석을{'\n'}시작해 보세요.
      </Text>
    );
  }

  const symN = scoreOf(newest, 'symmetry');
  const balN = scoreOf(newest, 'balance');

  // 첫 분석(비교할 직전 기록이 없을 때)
  if (!previous) {
    return (
      <Text style={styles.conditionTitle}>
        첫 분석 완료!{'\n'}
        <Text style={{ color: colors.amber400 }}>
          비대칭 {symN}점 · 균형 {balN}점
        </Text>
      </Text>
    );
  }

  // 직전 기록과 좌우 균형(부기) 점수 비교
  const balP = scoreOf(previous, 'balance') ?? balN ?? 0;
  const delta = (balN ?? 0) - balP;

  if (delta > 0) {
    return (
      <Text style={styles.conditionTitle}>
        직전보다 좌우 균형이{'\n'}
        <Text style={{ color: colors.emerald }}>{delta}점 좋아졌어요!</Text>
      </Text>
    );
  }
  if (delta < 0) {
    return (
      <Text style={styles.conditionTitle}>
        직전보다 좌우 균형이{'\n'}
        <Text style={{ color: colors.red }}>{Math.abs(delta)}점 낮아졌어요</Text>
      </Text>
    );
  }
  return (
    <Text style={styles.conditionTitle}>
      직전과 비슷한 상태를{'\n'}유지하고 있어요.
    </Text>
  );
}

export default function HomeScreen({ goTab }: Props) {
  // 최신 분석 기록을 불러와 "오늘의 안면 컨디션"에 반영합니다.
  const [records, setRecords] = useState<ScanRecord[]>([]);
  const [notifOpen, setNotifOpen] = useState(false); // 알림센터 팝업 열림 여부
  const [hasUnread, setHasUnread] = useState(true); // 안 읽은 알림 표시(빨간 점)

  useEffect(() => {
    getHistory()
      .then((d) => setRecords(d.records))
      .catch((e) => console.log('이력 불러오기 실패:', e));
  }, []);

  const newest = records[0];
  const previous = records[1];

  // 알림 열기: 팝업 표시 + 빨간 점 제거
  function openNotifications() {
    setNotifOpen(true);
    setHasUnread(false);
  }

  return (
    <>
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* 상단: 로고 + 알림/프로필 아이콘 */}
      <View style={styles.topBar}>
        <Text style={styles.logo}>HeOnn Facefit</Text>
        <View style={styles.topIcons}>
          {/* 알림 아이콘 — 누르면 알림센터 팝업 */}
          <Pressable onPress={openNotifications} hitSlop={8}>
            <Feather name="bell" size={24} color={colors.textMuted} />
            {hasUnread && <View style={styles.redDot} />}
          </Pressable>
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

      {/* 오늘의 안면 컨디션 카드 (실제 분석 기록 기반) */}
      <View style={styles.conditionCard}>
        <Text style={styles.conditionLabel}>오늘의 안면 컨디션</Text>
        {renderCondition(newest, previous)}
        <Pressable style={styles.conditionLink} onPress={() => goTab(newest ? 'report' : 'scan')}>
          <Text style={styles.conditionLinkText}>
            {newest ? '상세 리포트 보기' : 'AI 스캔 시작하기'}
          </Text>
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

    {/* 알림센터 팝업 (공지사항 · 괄사 사용 알림) */}
    <Modal
      visible={notifOpen}
      transparent
      animationType="fade"
      onRequestClose={() => setNotifOpen(false)}
    >
      <Pressable style={styles.notifOverlay} onPress={() => setNotifOpen(false)}>
        <Pressable style={styles.notifCard} onPress={() => {}}>
          <View style={styles.notifHeader}>
            <Text style={styles.notifTitle}>알림</Text>
            <Pressable onPress={() => setNotifOpen(false)} hitSlop={10}>
              <Feather name="x" size={22} color={colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView style={styles.notifList} showsVerticalScrollIndicator={false}>
            {NOTIFICATIONS.map((n) => (
              <View key={n.id} style={[styles.notifItem, n.unread && styles.notifItemUnread]}>
                {/* 카테고리 아이콘 */}
                <View style={styles.notifIcon}>
                  <Feather name={n.icon} size={18} color={colors.amber400} />
                </View>
                {/* 내용 */}
                <View style={styles.notifBody}>
                  <View style={styles.notifTopRow}>
                    <Text style={styles.notifCat}>{n.cat}</Text>
                    <Text style={styles.notifTime}>{n.time}</Text>
                  </View>
                  <Text style={styles.notifItemTitle}>{n.title}</Text>
                  <Text style={styles.notifItemBody}>{n.body}</Text>
                </View>
                {/* 안 읽음 표시 */}
                {n.unread && <View style={styles.notifUnreadDot} />}
              </View>
            ))}
            <Text style={styles.notifFooter}>최근 알림을 모두 확인했어요</Text>
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
    fontWeight: '700',
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
  // 알림센터 팝업
  notifOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  notifCard: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '78%',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border2,
    padding: 16,
  },
  notifHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  notifTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  notifList: {
    flexGrow: 0,
  },
  notifItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: radius.md,
    borderBottomWidth: 1,
    borderColor: 'rgba(63,63,70,0.4)',
  },
  notifItemUnread: {
    backgroundColor: 'rgba(245,158,11,0.06)',
  },
  notifIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    backgroundColor: 'rgba(245,158,11,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  notifBody: {
    flex: 1,
  },
  notifTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  notifCat: {
    color: colors.amber400,
    fontSize: 11,
    fontWeight: '700',
  },
  notifTime: {
    color: colors.textFainter,
    fontSize: 11,
  },
  notifItemTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 3,
  },
  notifItemBody: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  notifUnreadDot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.amber500,
    marginTop: 6,
  },
  notifFooter: {
    color: colors.textFainter,
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 16,
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
