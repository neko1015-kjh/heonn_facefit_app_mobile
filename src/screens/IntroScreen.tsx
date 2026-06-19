import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Text from '../components/AppText';
import { colors, radius } from '../theme';

// [0] 인트로(스플래시) 화면입니다.
// 앱을 켜면 잠깐 보여주고, 그 사이 자동 로그인·기기 연결을 확인한 뒤 다음 화면으로 넘어갑니다.
export default function IntroScreen() {
  // 로고가 부드럽게 나타나며 살짝 커지는 애니메이션
  const fade = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.92)).current;
  // 로고 둘레로 퍼지는 물결
  const ripple = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 700, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 6, tension: 40, useNativeDriver: true }),
    ]).start();

    const loop = Animated.loop(
      Animated.timing(ripple, {
        toValue: 1,
        duration: 1800,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [fade, scale, ripple]);

  const rippleStyle = {
    transform: [{ scale: ripple.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.9] }) }],
    opacity: ripple.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
  };

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.center, { opacity: fade, transform: [{ scale }] }]}>
        <View style={styles.logoWrap}>
          <Animated.View style={[styles.ripple, rippleStyle]} />
          <View style={styles.logoCircle}>
            <Ionicons name="sparkles" size={52} color={colors.amber400} />
          </View>
        </View>
        <Text style={styles.logo}>HeOnn Facefit</Text>
        <Text style={styles.tagline}>초개인화 맞춤형 뷰티 플랫폼</Text>
      </Animated.View>

      <Text style={styles.footer}>온열 유기(방짜유기) 괄사 케어</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    alignItems: 'center',
  },
  logoWrap: {
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  ripple: {
    position: 'absolute',
    width: 128,
    height: 128,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.4)',
  },
  logoCircle: {
    width: 128,
    height: 128,
    borderRadius: radius.full,
    backgroundColor: 'rgba(245,158,11,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.amber300,
    marginBottom: 8,
  },
  tagline: {
    color: colors.textMuted,
    fontSize: 13,
    letterSpacing: 2,
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    color: colors.textFainter,
    fontSize: 12,
  },
});
