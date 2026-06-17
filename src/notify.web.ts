// 웹용 알림 빈 구현입니다.
// expo-notifications는 웹에서 번들 문제가 있어, 웹에서는 시스템 알림을 사용하지 않고
// 아무 동작도 하지 않는 안전한 함수들로 대체합니다. (앱 내 알림/팝업은 그대로 동작)

export async function ensureNotificationPermission(): Promise<boolean> {
  return false;
}

export async function scheduleCareNotification(
  _seconds: number,
  _title: string,
  _body: string
): Promise<string | null> {
  return null;
}

export async function cancelNotification(_id: string | null): Promise<void> {
  // 웹에서는 할 일 없음
}

export function addCareNotificationResponseListener(_onCare: () => void) {
  return () => {
    // 웹에서는 등록 해제할 것 없음
  };
}
