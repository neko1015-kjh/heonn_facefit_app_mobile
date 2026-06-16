import { Feather } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import Text from '../components/AppText';
import { colors, radius } from '../theme';

// [2] 디바이스 페어링(블루투스 연결) 화면입니다.
// 상태(pairingState): 'searching'(검색 중) → 'found'(발견) → 'connected'(연결됨)
type PairingState = 'searching' | 'found' | 'connected';

type Props = {
  pairingState: PairingState;
  onConnect: () => void;
};

export default function PairingScreen({ pairingState, onConnect }: Props) {
  // 검색 중일 때 바깥으로 퍼지는 물결 애니메이션 값입니다.
  const ripple = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (pairingState === 'searching') {
      // 0 → 1 로 계속 반복하며 커지고 흐려지는 효과
      const loop = Animated.loop(
        Animated.timing(ripple, {
          toValue: 1,
          duration: 2000,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        })
      );
      loop.start();
      return () => loop.stop();
    }
  }, [pairingState, ripple]);

  // 물결 원의 크기와 투명도를 애니메이션 값과 연결합니다.
  const rippleStyle = {
    transform: [
      {
        scale: ripple.interpolate({ inputRange: [0, 1], outputRange: [0.6, 2.2] }),
      },
    ],
    opacity: ripple.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }),
  };

  return (
    <View style={styles.container}>
      {/* 상단 안내 문구 */}
      <View style={styles.header}>
        <Text style={styles.title}>디바이스 연결</Text>
        <Text style={styles.subtitle}>
          {pairingState === 'searching' && '근처의 HeOnn 괄사를 찾고 있습니다...'}
          {pairingState === 'found' && '기기를 발견했습니다!'}
          {pairingState === 'connected' && '연결이 완료되었습니다.'}
        </Text>
      </View>

      {/* 가운데 원형 아이콘 + 물결 애니메이션 */}
      <View style={styles.center}>
        <View style={styles.iconArea}>
          {pairingState === 'searching' && (
            <Animated.View style={[styles.ripple, rippleStyle]} />
          )}

          <View
            style={[
              styles.deviceCircle,
              pairingState === 'connected' && styles.deviceCircleConnected,
            ]}
          >
            {pairingState === 'connected' ? (
              <Feather name="check-circle" size={48} color={colors.bg} />
            ) : (
              <Feather name="smartphone" size={48} color={colors.amber400} />
            )}
          </View>
        </View>

        {/* 기기를 발견하면 나타나는 연결 카드 */}
        {pairingState === 'found' && (
          <Pressable style={styles.foundCard} onPress={onConnect}>
            <View style={styles.foundLeft}>
              <View style={styles.btIcon}>
                <Feather name="bluetooth" size={24} color={colors.amber400} />
              </View>
              <View>
                <Text style={styles.foundName}>HeOnn FaceFit (v1.0)</Text>
                <Text style={styles.foundSub}>BLE 연결 가능</Text>
              </View>
            </View>
            <View style={styles.connectBtn}>
              <Text style={styles.connectBtnText}>연결</Text>
            </View>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: 24,
  },
  header: {
    paddingTop: 48,
    paddingBottom: 32,
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 8,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconArea: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 200,
    height: 200,
  },
  ripple: {
    position: 'absolute',
    width: 128,
    height: 128,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.4)',
  },
  deviceCircle: {
    width: 128,
    height: 128,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deviceCircleConnected: {
    backgroundColor: colors.amber500,
    borderColor: colors.amber500,
  },
  foundCard: {
    width: '100%',
    marginTop: 64,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.5)',
    borderRadius: radius.xl,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  foundLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  btIcon: {
    backgroundColor: 'rgba(245,158,11,0.1)',
    padding: 8,
    borderRadius: radius.md,
  },
  foundName: {
    color: colors.text,
    fontWeight: '500',
    fontSize: 15,
  },
  foundSub: {
    color: colors.textFaint,
    fontSize: 12,
    marginTop: 2,
  },
  connectBtn: {
    backgroundColor: colors.amber600,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.md,
  },
  connectBtnText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '500',
  },
});
