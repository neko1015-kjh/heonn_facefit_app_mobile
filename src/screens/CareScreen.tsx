import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../theme';

// [5] 실시간 맞춤 케어 화면입니다.
// 부위별 마사지 가이드, 방짜유기 온도 제어 바, 4가지 진동 모드를 보여줍니다.
const MODES = ['릴렉스', '탄력 UP', '집중', '수면'];

export default function CareScreen() {
  // 현재 선택된 진동 모드 번호 (기본: '탄력 UP')
  const [activeMode, setActiveMode] = useState(1);

  return (
    <View style={styles.container}>
      {/* 상단: 제목 + 남은 시간 */}
      <View style={styles.header}>
        <View style={{ width: 32 }} />
        <Text style={styles.headerText}>실시간 맞춤 케어</Text>
        <View style={styles.timer}>
          <Feather name="clock" size={12} color={colors.amber400} />
          <Text style={styles.timerText}>03:15</Text>
        </View>
      </View>

      {/* 가운데: 얼굴 그래픽 + 마사지 안내 말풍선 */}
      <View style={styles.center}>
        <View style={styles.faceArea}>
          <Feather name="user" size={120} color={colors.surface2} />
          <View style={styles.guideBadge}>
            <Feather name="chevron-right" size={16} color={colors.bg} />
          </View>
        </View>

        <View style={styles.bubble}>
          <Text style={styles.bubbleText}>
            오른쪽 턱선(교근) 부위를{'\n'}부드럽게 위로 쓸어주세요
          </Text>
        </View>
      </View>

      {/* 하단 제어 패널 */}
      <View style={styles.panel}>
        {/* 온도 제어 */}
        <View style={styles.panelRow}>
          <View style={styles.panelTitleRow}>
            <Feather name="thermometer" size={18} color={colors.amber500} />
            <Text style={styles.panelTitle}>방짜유기 온도 제어</Text>
          </View>
          <Text style={styles.panelValue}>38°C</Text>
        </View>

        {/* 온도 막대 (40% 정도 채워진 상태) */}
        <View style={styles.tempTrack}>
          <View style={styles.tempFill} />
          <View style={styles.tempThumb} />
        </View>
        <Text style={styles.tempMax}>Max 60°C (화상 방지)</Text>

        {/* 진동 모드 선택 */}
        <View style={styles.modeTitleRow}>
          <Feather name="activity" size={18} color={colors.amber500} />
          <Text style={styles.panelTitle}>진동 모드</Text>
        </View>
        <View style={styles.modeGrid}>
          {MODES.map((mode, idx) => {
            const active = idx === activeMode;
            return (
              <Pressable
                key={mode}
                style={[styles.modeBtn, active && styles.modeBtnActive]}
                onPress={() => setActiveMode(idx)}
              >
                <Text style={[styles.modeText, active && styles.modeTextActive]}>{mode}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingBottom: 100,
  },
  header: {
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerText: {
    color: colors.text,
    fontWeight: '500',
    fontSize: 16,
  },
  timer: {
    backgroundColor: colors.surface2,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timerText: {
    color: colors.amber400,
    fontSize: 13,
    fontWeight: '500',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  faceArea: {
    position: 'relative',
  },
  guideBadge: {
    position: 'absolute',
    top: '45%',
    right: -16,
    backgroundColor: colors.amber500,
    borderRadius: radius.full,
    padding: 4,
  },
  bubble: {
    marginTop: 48,
    backgroundColor: 'rgba(24,24,27,0.8)',
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: radius.full,
  },
  bubbleText: {
    color: colors.amber400,
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 20,
  },
  panel: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: 24,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  panelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  panelTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  panelTitle: {
    color: colors.text,
    fontWeight: '500',
    fontSize: 15,
  },
  panelValue: {
    color: colors.textMuted,
    fontSize: 14,
  },
  tempTrack: {
    width: '100%',
    height: 8,
    backgroundColor: colors.surface2,
    borderRadius: radius.full,
    marginBottom: 8,
    justifyContent: 'center',
  },
  tempFill: {
    position: 'absolute',
    left: 0,
    height: 8,
    width: '40%',
    backgroundColor: colors.amber500,
    borderRadius: radius.full,
  },
  tempThumb: {
    position: 'absolute',
    left: '40%',
    width: 20,
    height: 20,
    borderRadius: radius.full,
    backgroundColor: colors.text,
    borderWidth: 4,
    borderColor: colors.surface,
    marginLeft: -10,
  },
  tempMax: {
    color: colors.textFainter,
    fontSize: 11,
    textAlign: 'right',
    marginBottom: 24,
  },
  modeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  modeGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.md,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
  },
  modeBtnActive: {
    backgroundColor: 'rgba(245,158,11,0.2)',
    borderColor: 'rgba(245,158,11,0.5)',
  },
  modeText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '500',
  },
  modeTextActive: {
    color: colors.amber400,
  },
});
