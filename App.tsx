import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Text from './src/components/AppText';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

import { addCareNotificationResponseListener } from './src/notify';
import * as api from './src/api';
import BottomNav, { TabKey } from './src/components/BottomNav';
import { colors } from './src/theme';
import LoginScreen from './src/screens/LoginScreen';
import PairingScreen from './src/screens/PairingScreen';
import HomeScreen from './src/screens/HomeScreen';
import ScanScreen from './src/screens/ScanScreen';
import CareScreen from './src/screens/CareScreen';
import ReportScreen from './src/screens/ReportScreen';
import StoreScreen from './src/screens/StoreScreen';

// 앱 전체 단계: 'login'(로그인) → 'pairing'(기기 연결) → 'main'(메인 앱)
type AppState = 'login' | 'pairing' | 'main';
// 페어링 단계: 'searching'(검색) → 'found'(발견) → 'connected'(연결됨)
type PairingState = 'searching' | 'found' | 'connected';

// FaceFit(HeOnn) 앱의 최상위 화면입니다.
// 여기서 "지금 어떤 화면을 보여줄지"를 결정하고, 각 화면을 연결합니다.
export default function App() {
  const [appState, setAppState] = useState<AppState>('login');
  const [activeTab, setActiveTab] = useState<TabKey>('home');
  const [pairingState, setPairingState] = useState<PairingState>('searching');
  // 로그인한 사용자 정보(없으면 null)
  const [user, setUser] = useState<api.AppUser | null>(null);
  // 앱 시작 시 저장된 로그인 정보를 확인하는 중인지 (true면 로딩 화면 표시)
  const [checkingAuto, setCheckingAuto] = useState(true);

  // 시스템 알림을 눌렀을 때, 해당 화면(케어 탭)으로 이동합니다.
  useEffect(() => {
    const unsubscribe = addCareNotificationResponseListener(() => {
      setAppState('main');
      setActiveTab('care');
    });
    return unsubscribe;
  }, []);

  // 앱을 켤 때: 기기에 저장된 로그인 정보가 있으면 자동으로 불러옵니다.
  // (다시 로그인하지 않아도 됨. 기기 연결 단계는 그대로 거칩니다.)
  useEffect(() => {
    (async () => {
      try {
        await api.loadStoredToken();
        const savedUser = await api.fetchMe();
        if (savedUser) {
          setUser(savedUser);
          setAppState('pairing');
          setPairingState('searching');
          setTimeout(() => setPairingState('found'), 2000);
        }
      } finally {
        // 확인이 끝나면 로딩 화면을 닫습니다(성공/실패 무관).
        setCheckingAuto(false);
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

  // 앱 시작 시 저장된 로그인 정보를 확인하는 동안 로딩 화면을 보여줍니다.
  if (checkingAuto) {
    return (
      <View style={styles.root}>
        <View style={styles.loading}>
          <Text style={styles.loadingLogo}>HeOnn Facefit</Text>
          <ActivityIndicator size="large" color={colors.amber400} style={styles.loadingSpinner} />
          <Text style={styles.loadingText}>자동 로그인 중…</Text>
        </View>
        <StatusBar style="light" />
      </View>
    );
  }

  // 로그인 버튼을 눌렀을 때: 서버에 로그인 요청 → 성공하면 페어링 화면으로 이동
  // remember: 자동 로그인 체크 여부(끄면 다음 실행에 자동 로그인 안 함)
  async function handleLogin(provider: string, remember: boolean) {
    console.log(`${provider} 로그인 시도 (자동 로그인: ${remember})`);
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

  // 기기 "연결" 버튼을 눌렀을 때: 연결됨 표시 → 1.5초 뒤 메인 앱으로 이동
  function handleConnect() {
    setPairingState('connected');
    setTimeout(() => setAppState('main'), 1500);
  }

  return (
    <View style={styles.root}>
      {/* 화면 가운데에 휴대폰 모양으로 앱을 배치합니다(웹에서 볼 때 보기 좋도록). */}
      <View style={styles.phone}>
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
  // 자동 로그인 확인 중 로딩 화면
  loading: {
    flex: 1,
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  loadingLogo: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.amber300,
    marginBottom: 28,
  },
  loadingSpinner: {
    marginBottom: 16,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 14,
  },
});
