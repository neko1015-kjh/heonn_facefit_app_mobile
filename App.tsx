import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

import { addCareNotificationResponseListener } from './src/notify';
import * as api from './src/api';
import BottomNav, { TabKey } from './src/components/BottomNav';
import { colors } from './src/theme';
import IntroScreen from './src/screens/IntroScreen';
import LoginScreen from './src/screens/LoginScreen';
import PairingScreen from './src/screens/PairingScreen';
import HomeScreen from './src/screens/HomeScreen';
import ScanScreen from './src/screens/ScanScreen';
import CareScreen from './src/screens/CareScreen';
import ReportScreen from './src/screens/ReportScreen';
import StoreScreen from './src/screens/StoreScreen';

// 앱 전체 단계: 'intro'(인트로) → 'login'(로그인) → 'pairing'(기기 연결) → 'main'(메인 앱)
type AppState = 'intro' | 'login' | 'pairing' | 'main';
// 페어링 단계: 'searching'(검색) → 'found'(발견) → 'connecting'(동기화 중) → 'connected'(연결됨)
type PairingState = 'searching' | 'found' | 'connecting' | 'connected';

// FaceFit(HeOnn) 앱의 최상위 화면입니다.
// 여기서 "지금 어떤 화면을 보여줄지"를 결정하고, 각 화면을 연결합니다.
export default function App() {
  // 처음엔 인트로 화면부터 시작합니다.
  const [appState, setAppState] = useState<AppState>('intro');
  const [activeTab, setActiveTab] = useState<TabKey>('home');
  const [pairingState, setPairingState] = useState<PairingState>('searching');
  // 로그인한 사용자 정보(없으면 null)
  const [user, setUser] = useState<api.AppUser | null>(null);

  // 시스템 알림을 눌렀을 때, 해당 화면(케어 탭)으로 이동합니다.
  useEffect(() => {
    const unsubscribe = addCareNotificationResponseListener(() => {
      setAppState('main');
      setActiveTab('care');
    });
    return unsubscribe;
  }, []);

  // 앱을 켤 때: 인트로를 보여주는 동안 자동 로그인 + 기기 연결 상태를 확인합니다.
  // - 로그인됨 + 기기 연결 기억 → 바로 홈(메인)
  // - 로그인됨 + 연결 안 됨 → 기기 연결(페어링) 화면
  // - 로그인 안 됨 → 로그인 화면
  useEffect(() => {
    (async () => {
      // 인트로를 최소 2.2초는 보여줍니다(확인이 빨리 끝나도).
      const minIntro = new Promise((resolve) => setTimeout(resolve, 2200));
      let savedUser: api.AppUser | null = null;
      let paired = false;
      try {
        // 웹: 카카오 로그인 후 돌아오면 URL에 ?token= 이 붙어 있습니다.
        let urlToken: string | null = null;
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          const params = new URLSearchParams(window.location.search);
          urlToken = params.get('token');
          if (urlToken) {
            await api.setAuthToken(urlToken); // 기기에 저장(자동 로그인)
            window.history.replaceState({}, '', window.location.pathname);
          }
        }
        if (!urlToken) {
          await api.loadStoredToken();
        }
        savedUser = await api.fetchMe();
        paired = await api.loadPaired();
      } catch {
        // 확인 실패는 무시(로그인 화면으로)
      }
      await minIntro; // 인트로 최소 표시 시간 보장

      if (savedUser) {
        setUser(savedUser);
        if (paired) {
          // 로그인 + 기기 연결 기억 → 바로 홈
          setActiveTab('home');
          setAppState('main');
        } else {
          // 로그인됐지만 기기 연결 전 → 페어링
          setAppState('pairing');
          setPairingState('searching');
          setTimeout(() => setPairingState('found'), 2000);
        }
      } else {
        setAppState('login');
      }
    })();
  }, []);

  // Pretendard 폰트 파일들을 불러옵니다. (다 불러오기 전까지는 빈 화면 표시)
  const [fontsLoaded] = useFonts({
    'Pretendard-Regular': require('./assets/fonts/Pretendard-Regular.otf'),
    'Pretendard-Medium': require('./assets/fonts/Pretendard-Medium.otf'),
    'Pretendard-SemiBold': require('./assets/fonts/Pretendard-SemiBold.otf'),
    'Pretendard-Bold': require('./assets/fonts/Pretendard-Bold.otf'),
    // 아이콘 글꼴도 함께 로드(웹에서 아이콘이 깨지지 않도록 미리 준비)
    ...Feather.font,
    ...Ionicons.font,
    ...MaterialCommunityIcons.font,
  });

  // 폰트가 준비되지 않았으면 어두운 빈 화면만 잠깐 보여줍니다.
  if (!fontsLoaded) {
    return <View style={styles.root} />;
  }

  // 로그인 버튼을 눌렀을 때: 서버에 로그인 요청 → 성공하면 페어링 화면으로 이동
  // remember: 자동 로그인 체크 여부(끄면 다음 실행에 자동 로그인 안 함)
  async function handleLogin(provider: string, remember: boolean) {
    console.log(`${provider} 로그인 시도 (자동 로그인: ${remember})`);

    // 카카오는 실제 OAuth — 웹에서는 카카오 인증 페이지로 이동합니다.
    // (인증 후 백엔드 콜백을 거쳐 ?token= 을 달고 이 웹으로 돌아옵니다)
    if (provider === '카카오' && Platform.OS === 'web') {
      window.location.href = `${api.BACKEND_URL}/auth/kakao/login`;
      return;
    }

    try {
      const loggedIn = await api.login(provider, remember);
      setUser(loggedIn);
      setAppState('pairing');
      setPairingState('searching');
      setTimeout(() => setPairingState('found'), 2000);
    } catch (e) {
      // 서버가 꺼져 있거나 연결이 안 될 때 여기로 옵니다.
      console.log('로그인 실패:', e);
      alert('서버에 연결할 수 없어 로그인하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    }
  }

  // 로그아웃: 저장된 로그인 정보를 지우고 로그인 화면으로 돌아갑니다.
  async function handleLogout() {
    await api.logout();
    setUser(null);
    setActiveTab('home');
    setAppState('login');
  }

  // 기기 "연결" 버튼을 눌렀을 때:
  // 동기화(싱크) 로딩 → 완료 표시 → 메인 앱으로 이동
  function handleConnect() {
    setPairingState('connecting');
    // 동기화 단계 진행 시간(약 3.2초) 후 완료
    setTimeout(() => {
      setPairingState('connected');
      // 기기 연결을 기억합니다(다음 실행 때 페어링 건너뛰고 바로 홈).
      api.setPaired(true);
      setTimeout(() => setAppState('main'), 1200);
    }, 3200);
  }

  return (
    <View style={styles.root}>
      {/* 화면 가운데에 휴대폰 모양으로 앱을 배치합니다(웹에서 볼 때 보기 좋도록). */}
      <View style={styles.phone}>
        {appState === 'intro' && <IntroScreen />}

        {appState === 'login' && <LoginScreen onLogin={handleLogin} />}

        {appState === 'pairing' && (
          <PairingScreen pairingState={pairingState} onConnect={handleConnect} />
        )}

        {appState === 'main' && (
          <View style={styles.mainArea}>
            {/* 선택된 탭에 따라 알맞은 화면을 보여줍니다. */}
            {activeTab === 'home' && <HomeScreen goTab={setActiveTab} />}
            {activeTab === 'scan' && <ScanScreen />}
            {activeTab === 'care' && <CareScreen />}
            {activeTab === 'report' && <ReportScreen />}
            {activeTab === 'store' && <StoreScreen user={user} onLogout={handleLogout} />}

            {/* 화면 맨 아래 고정 탭 바 */}
            <BottomNav activeTab={activeTab} onChange={setActiveTab} />
          </View>
        )}
      </View>

      {/* 상단 상태바: 배경이 어두우므로 밝은 글자(light)로 표시 */}
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.black,
    alignItems: 'center',
  },
  phone: {
    flex: 1,
    width: '100%',
    maxWidth: 420, // 큰 화면(PC)에서는 휴대폰 너비로 제한
    backgroundColor: colors.bg,
  },
  mainArea: {
    flex: 1,
  },
});
