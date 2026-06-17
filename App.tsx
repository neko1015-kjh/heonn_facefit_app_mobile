import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { addCareNotificationResponseListener } from './src/notify';
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

  // 시스템 알림을 눌렀을 때, 해당 화면(케어 탭)으로 이동합니다.
  useEffect(() => {
    const unsubscribe = addCareNotificationResponseListener(() => {
      setAppState('main');
      setActiveTab('care');
    });
    return unsubscribe;
  }, []);

  // Pretendard 폰트 파일들을 불러옵니다. (다 불러오기 전까지는 빈 화면 표시)
  const [fontsLoaded] = useFonts({
    'Pretendard-Regular': require('./assets/fonts/Pretendard-Regular.otf'),
    'Pretendard-Medium': require('./assets/fonts/Pretendard-Medium.otf'),
    'Pretendard-SemiBold': require('./assets/fonts/Pretendard-SemiBold.otf'),
    'Pretendard-Bold': require('./assets/fonts/Pretendard-Bold.otf'),
  });

  // 폰트가 준비되지 않았으면 어두운 빈 화면만 잠깐 보여줍니다.
  if (!fontsLoaded) {
    return <View style={styles.root} />;
  }

  // 로그인 버튼을 눌렀을 때: 페어링 화면으로 이동 → 2초 뒤 기기 발견
  function handleLogin(provider: string) {
    console.log(`${provider} 로그인 시도`);
    setAppState('pairing');
    setPairingState('searching');
    setTimeout(() => setPairingState('found'), 2000);
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
            {activeTab === 'store' && <StoreScreen />}

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
