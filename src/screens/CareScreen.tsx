import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Text from '../components/AppText';
import { colors, radius } from '../theme';

// [5] 실시간 맞춤 케어 화면입니다.
// 부위별 마사지 가이드, 방짜유기 온도 제어 바, 4가지 진동 모드를 보여줍니다.
// 각 모드는 괄사(온열 유기) 케어 방식과 설명을 함께 가집니다.
const MODES = [
  {
    name: '릴렉스',
    desc: '약한 진동과 은은한 온열로 얼굴 근육의 긴장을 부드럽게 풀어주는 모드예요. 하루를 마무리하며 편안하게 사용하기 좋아요.',
  },
  {
    name: '탄력 UP',
    desc: '강약을 반복하는 진동으로 피부와 근육을 자극해 탄력과 혈색 개선을 돕는 모드예요. 또렷한 윤곽 관리에 좋아요.',
  },
  {
    name: '집중',
    desc: '강한 진동으로 뭉친 부위(턱선·광대 등)를 집중적으로 풀어주는 모드예요. 짧고 굵게 케어하고 싶을 때 사용하세요.',
  },
  {
    name: '부기',
    desc: '림프 흐름을 따라 부드럽게 쓸어내리는 리듬으로 얼굴 부기 완화를 돕는 모드예요. 아침에 사용하면 갸름한 라인에 도움돼요.',
  },
];

// 온도 조절 범위 (방짜유기 접촉면)
const TEMP_MIN = 1;
const TEMP_MAX = 45;

// 온도에 따른 막대 색상입니다.
// 30°C 이하는 평소 색(amber), 30→45°C로 갈수록 점점 빨간색으로 변합니다.
function tempColor(t: number) {
  if (t <= 30) return '#f59e0b'; // amber-500
  const ratio = Math.min(1, (t - 30) / (45 - 30));
  // amber(245,158,11) → red(239,68,68) 사이를 비율만큼 섞습니다.
  const r = Math.round(245 + (239 - 245) * ratio);
  const g = Math.round(158 + (68 - 158) * ratio);
  const b = Math.round(11 + (68 - 11) * ratio);
  return `rgb(${r}, ${g}, ${b})`;
}

export default function CareScreen() {
  // 현재 선택된 진동 모드 번호 (기본: '탄력 UP')
  const [activeMode, setActiveMode] = useState(1);
  // 현재 설정 온도(°C)와 온도 막대의 실제 가로 길이
  const [temp, setTemp] = useState(38);
  const [trackWidth, setTrackWidth] = useState(0);

  // 막대에서 손가락이 닿은 가로 위치를 1~45°C 값으로 바꿉니다.
  function updateTempFromTouch(locationX: number) {
    if (trackWidth <= 0) return;
    let ratio = locationX / trackWidth;
    if (ratio < 0) ratio = 0;
    if (ratio > 1) ratio = 1;
    setTemp(Math.round(TEMP_MIN + ratio * (TEMP_MAX - TEMP_MIN)));
  }

  // 현재 온도를 막대 채움 비율(%)로 환산합니다.
  const tempPercent = ((temp - TEMP_MIN) / (TEMP_MAX - TEMP_MIN)) * 100;

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
          <Text style={[styles.panelValue, { color: tempColor(temp), fontWeight: '700' }]}>
            {temp}°C
          </Text>
        </View>

        {/* 온도 막대 (좌우로 드래그해서 1~45°C 조절) */}
        <View
          style={styles.tempTrack}
          onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderGrant={(e) => updateTempFromTouch(e.nativeEvent.locationX)}
          onResponderMove={(e) => updateTempFromTouch(e.nativeEvent.locationX)}
        >
          <View
            style={[styles.tempFill, { width: `${tempPercent}%`, backgroundColor: tempColor(temp) }]}
          />
          <View style={[styles.tempThumb, { left: `${tempPercent}%` }]} />
        </View>
        <Text style={styles.tempMax}>1°C ~ 45°C (화상 방지)</Text>

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
                key={mode.name}
                style={[styles.modeBtn, active && styles.modeBtnActive]}
                onPress={() => setActiveMode(idx)}
              >
                <Text style={[styles.modeText, active && styles.modeTextActive]}>
                  {mode.name}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* 선택한 모드 설명 */}
        <View style={styles.modeDescBox}>
          <Text style={styles.modeDescTitle}>{MODES[activeMode].name} 모드</Text>
          <Text style={styles.modeDescText}>{MODES[activeMode].desc}</Text>
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
    height: 16,
    backgroundColor: colors.surface2,
    borderRadius: radius.full,
    marginBottom: 8,
    justifyContent: 'center',
  },
  tempFill: {
    position: 'absolute',
    left: 0,
    height: 16,
    width: '40%',
    backgroundColor: colors.amber500,
    borderRadius: radius.full,
  },
  tempThumb: {
    position: 'absolute',
    top: -2,
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
  // 선택한 모드 설명란
  modeDescBox: {
    marginTop: 12,
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.25)',
    padding: 14,
  },
  modeDescTitle: {
    color: colors.amber400,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  modeDescText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
});
