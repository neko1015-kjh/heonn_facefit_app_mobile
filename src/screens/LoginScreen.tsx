import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import Text from '../components/AppText';
import { colors, radius } from '../theme';

// 메인(로그인) 화면에 보여줄 괄사 디바이스 대표 이미지
const GUASHA_IMAGE = require('../../assets/products/device1.jpg');

// [1] 로그인(온보딩) 화면입니다.
// 카카오/네이버/구글 버튼을 누르면 다음 단계(기기 페어링)로 넘어갑니다.
// onLogin: 로그인 버튼을 눌렀을 때 실행할 함수 (App.tsx에서 전달받음)
//   remember: 자동 로그인 체크 여부(켜면 다음에 자동 로그인)
type Props = {
  onLogin: (provider: string, remember: boolean) => void;
};

export default function LoginScreen({ onLogin }: Props) {
  // 자동 로그인 체크 상태 (기본: 켜짐)
  const [remember, setRemember] = useState(true);

  return (
    <View style={styles.container}>
      {/* 화면 위쪽에 은은하게 퍼지는 골드 빛 (프리미엄 뷰티테크 느낌) */}
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <RadialGradient id="glow" cx="50%" cy="32%" r="62%">
            <Stop offset="0" stopColor={colors.amber500} stopOpacity="0.22" />
            <Stop offset="0.45" stopColor={colors.amber500} stopOpacity="0.06" />
            <Stop offset="1" stopColor={colors.amber500} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#glow)" />
      </Svg>

      {/* 가운데 영역: 로고와 안내 문구, 로그인 버튼들 */}
      <View style={styles.center}>
        {/* 브랜드 로고 + 한 줄 소개 */}
        <View style={styles.brand}>
          <Text style={styles.logo}>
            HeOnn <Text style={styles.logoAccent}>Facefit</Text>
          </Text>
          <View style={styles.taglineRow}>
            <View style={styles.taglineDot} />
            <Text style={styles.tagline}>초개인화 맞춤형 뷰티 플랫폼</Text>
            <View style={styles.taglineDot} />
          </View>
        </View>

        {/* 큰 원형 영역에 괄사 디바이스 이미지 (빛나는 링) */}
        <View style={styles.deviceWrap}>
          <View style={styles.deviceHalo} />
          <View style={styles.logoCircle}>
            <Image source={GUASHA_IMAGE} style={styles.logoImage} resizeMode="cover" />
          </View>
        </View>

        {/* 소셜 로그인 버튼 묶음 */}
        <View style={styles.buttonGroup}>
          <Pressable
            style={({ pressed }) => [
              styles.loginButton,
              styles.kakaoButton,
              pressed && styles.pressed,
            ]}
            onPress={() => onLogin('카카오', remember)}
          >
            <Ionicons name="chatbubble" size={18} color={colors.black} style={styles.btnIcon} />
            <Text style={[styles.loginText, { color: colors.black }]}>
              카카오로 3초 만에 시작하기
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.loginButton,
              { backgroundColor: colors.naver },
              pressed && styles.pressed,
            ]}
            onPress={() => onLogin('네이버', remember)}
          >
            <Text style={[styles.naverMark, styles.btnIcon]}>N</Text>
            <Text style={[styles.loginText, { color: colors.white }]}>네이버로 시작하기</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.loginButton,
              styles.googleButton,
              pressed && styles.pressed,
            ]}
            onPress={() => onLogin('구글', remember)}
          >
            <Ionicons name="logo-google" size={18} color="#1a1a1a" style={styles.btnIcon} />
            <Text style={[styles.loginText, { color: '#1a1a1a' }]}>Google로 시작하기</Text>
          </Pressable>
        </View>

        {/* 자동 로그인 체크 (버튼 아래로 옮겨 정돈) */}
        <Pressable style={styles.rememberRow} onPress={() => setRemember((v) => !v)}>
          <Ionicons
            name={remember ? 'checkmark-circle' : 'ellipse-outline'}
            size={20}
            color={remember ? colors.amber400 : colors.textFaint}
          />
          <Text style={[styles.rememberText, remember && { color: colors.text }]}>
            자동 로그인 유지
          </Text>
        </Pressable>
      </View>

      {/* 약관 안내 (하단 고정) */}
      <Text style={styles.terms}>
        시작하기를 누르면 코레보 서비스 이용약관 및{'\n'}개인정보처리방침에 동의하게 됩니다.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: 28,
    paddingTop: 64,
    paddingBottom: 28,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  brand: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    fontSize: 36,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  logoAccent: {
    fontSize: 36,
    fontWeight: '700',
    color: colors.amber400,
  },
  taglineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  taglineDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.amber500,
    opacity: 0.6,
  },
  tagline: {
    color: colors.textMuted,
    fontSize: 13,
    letterSpacing: 1,
  },
  deviceWrap: {
    width: 168,
    height: 168,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 56,
  },
  // 이미지 뒤에서 퍼지는 부드러운 빛 (그림자로 표현)
  deviceHalo: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: radius.full,
    backgroundColor: colors.amber500,
    opacity: 0.18,
    shadowColor: colors.amber500,
    shadowOpacity: 0.9,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 0 },
    elevation: 24,
  },
  logoCircle: {
    width: 136,
    height: 136,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: 'rgba(251,191,36,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden', // 이미지를 원형으로 자르기
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  buttonGroup: {
    width: '100%',
    gap: 12,
  },
  loginButton: {
    flexDirection: 'row',
    width: '100%',
    height: 56,
    borderRadius: radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // 눌렀을 때 살짝 작아지며 흐려지는 반응
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.985 }],
  },
  btnIcon: {
    marginRight: 8,
  },
  kakaoButton: {
    backgroundColor: colors.kakao,
  },
  googleButton: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: '#e4e4e7',
  },
  naverMark: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.white,
  },
  loginText: {
    fontSize: 15.5,
    fontWeight: '600',
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 22,
    paddingVertical: 4,
  },
  rememberText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  terms: {
    color: colors.textFainter,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
});
