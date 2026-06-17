// 로컬(시스템) 알림을 다루는 도우미입니다.
// 케어 타이머가 끝났을 때, 앱이 백그라운드여도 휴대폰 시스템 알림으로 알려줍니다.
// (웹 또는 권한 거부 시에는 안전하게 무시되도록 try/catch로 감쌉니다.)

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

// 알림이 화면에 어떻게 표시될지 설정합니다(앱이 켜져 있을 때도 배너 표시).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// 알림 권한을 요청합니다. (한 번 허용하면 다음부터는 자동)
export async function ensureNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false; // 웹은 시스템 알림 제한 → 앱 내 알림만 사용
  try {
    const settings = await Notifications.getPermissionsAsync();
    if (settings.granted) return true;
    const req = await Notifications.requestPermissionsAsync();
    return req.granted;
  } catch (e) {
    console.log('알림 권한 요청 실패:', e);
    return false;
  }
}

// 일정 시간(초) 뒤에 울리는 시스템 알림을 예약하고, 그 알림 id를 돌려줍니다.
// data에 넣은 값은 사용자가 알림을 눌렀을 때 어디로 이동할지 판단하는 데 씁니다.
export async function scheduleCareNotification(
  seconds: number,
  title: string,
  body: string
): Promise<string | null> {
  if (Platform.OS === 'web' || seconds <= 0) return null;
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: { title, body, data: { screen: 'care' } },
      trigger: { seconds, channelId: 'care' } as any,
    });
    return id;
  } catch (e) {
    console.log('알림 예약 실패:', e);
    return null;
  }
}

// 예약했던 알림을 취소합니다. (앱 화면에서 직접 처리했을 때 중복 방지)
export async function cancelNotification(id: string | null) {
  if (!id || Platform.OS === 'web') return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch (e) {
    console.log('알림 취소 실패:', e);
  }
}

// 사용자가 케어 알림을 눌렀을 때 실행할 동작(onCare)을 등록합니다.
// 반환값을 호출하면 등록 해제됩니다.
export function addCareNotificationResponseListener(onCare: () => void) {
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const screen = (response.notification.request.content.data as any)?.screen;
    if (screen === 'care') onCare();
  });
  return () => sub.remove();
}
