import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Text from '../components/AppText';
import { colors, radius } from '../theme';

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
      {/* 가운데 영역: 로고와 안내 문구, 로그인 버튼들 */}
      <View style={styles.center}>
        <Text style={styles.logo}>HeOnn Facefit</Text>
        <Text style={styles.tagline}>초개인화 맞춤형 뷰티 플랫폼</Text>

        {/* 큰 원형 로고 아이콘 */}
        <View style={styles.logoCircle}>
          <Ionicons name="sparkles" size={48} color={colors.amber400} />
        </View>

        {/* 자동 로그인 체크박스 */}
        <Pressable style={styles.rememberRow} onPress={() => setRemember((v) => !v)}>
          <Ionicons
            name={remember ? 'checkbox' : 'square-outline'}
            size={20}
            color={remember ? colors.amber400 : colors.textFaint}
          />
          <Text style={styles.rememberText}>자동 로그인</Text>
        </Pressable>

        {/* 소셜 로그인 버튼 묶음 */}
        <View style={styles.buttonGroup}>
          <Pressable
            style={[styles.loginButton, { backgroundColor: colors.kakao }]}
            onPress={() => onLogin('카카오', remember)}
          >
            <Text style={[styles.loginText, { color: colors.black }]}>
              카카오로 3초 만에 시작하기
            </Text>
          </Pressable>

          <Pressable
            style={[styles.loginButton, { backgroundColor: colors.naver }]}
            onPress={() => onLogin('네이버', remember)}
          >
            <Text style={[styles.loginText, { color: colors.white }]}>
              네이버로 시작하기
            </Text>
          </Pressable>

          <Pressable
            style={[styles.loginButton, styles.googleButton]}
            onPress={() => onLogin('구글', remember)}
          >
            <Text style={[styles.loginText, { color: '#1a1a1a' }]}>
              Google로 시작하기
            </Text>
          </Pressable>
        </View>

        {/* 약관 안내 */}
        <Text style={styles.terms}>
          시작하기를 누르면 코레보 서비스 이용약관 및 개인정보처리방침에 동의하게 됩니다.
        </Text>
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
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    fontSize: 34,
    fontWeight: '700',
    color: colors.amber300,
    marginBottom: 8,
  },
  tagline: {
    color: colors.textMuted,
    fontSize: 13,
    letterSpacing: 2,
    marginBottom: 48,
  },
  logoCircle: {
    width: 128,
    height: 128,
    borderRadius: radius.full,
    backgroundColor: 'rgba(245,158,11,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 64,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    marginBottom: 14,
    paddingVertical: 4,
  },
  rememberText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  buttonGroup: {
    width: '100%',
    gap: 12,
  },
  loginButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  googleButton: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: '#e4e4e7',
  },
  loginText: {
    fontSize: 15,
    fontWeight: '500',
  },
  terms: {
    color: colors.textFainter,
    fontSize: 12,
    marginTop: 24,
    textAlign: 'center',
    lineHeight: 18,
  },
});
