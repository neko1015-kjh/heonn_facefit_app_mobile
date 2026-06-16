import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import Text from './AppText';
import { colors } from '../theme';

// 하단 탭 바에서 사용하는 탭 종류입니다.
export type TabKey = 'home' | 'scan' | 'care' | 'report' | 'store';

// 탭 목록 (아이콘 + 라벨)
const TABS: { id: TabKey; label: string }[] = [
  { id: 'home', label: '홈' },
  { id: 'scan', label: 'AI스캔' },
  { id: 'care', label: '맞춤케어' },
  { id: 'report', label: '리포트' },
  { id: 'store', label: '마이' },
];

type Props = {
  activeTab: TabKey;
  onChange: (tab: TabKey) => void;
};

// 탭별 아이콘을 그려주는 작은 함수입니다. (탭마다 아이콘 종류가 달라서 분리)
function TabIcon({ id, color }: { id: TabKey; color: string }) {
  const size = 22;
  if (id === 'home') return <Feather name="home" size={size} color={color} />;
  if (id === 'scan')
    return <MaterialCommunityIcons name="face-recognition" size={size} color={color} />;
  if (id === 'care') return <Ionicons name="sparkles" size={size} color={color} />;
  if (id === 'report') return <Feather name="bar-chart-2" size={size} color={color} />;
  return <Feather name="user" size={size} color={color} />;
}

// 화면 하단에 고정으로 보이는 탭 바입니다.
export default function BottomNav({ activeTab, onChange }: Props) {
  return (
    <View style={styles.bar}>
      {TABS.map((tab) => {
        const active = activeTab === tab.id;
        const color = active ? colors.amber400 : colors.textFainter;
        return (
          <Pressable key={tab.id} style={styles.tab} onPress={() => onChange(tab.id)}>
            <TabIcon id={tab.id} color={color} />
            <Text style={[styles.label, { color }]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(9,9,11,0.95)',
    borderTopWidth: 1,
    borderColor: colors.surface,
    paddingTop: 12,
    paddingBottom: 20,
    paddingHorizontal: 24,
  },
  tab: {
    alignItems: 'center',
    gap: 6,
  },
  label: {
    fontSize: 10,
    fontWeight: '500',
  },
});
