// ─────────────────────────────────────────────────────────────
// 헤온 페이스핏 디바이스 BLE 통신 규격 (기기 스펙 자리표시자)
//
// ⚠️ 아래 UUID·명령 값은 하드웨어 펌웨어 스펙이 나오기 전의 "임시 값"입니다.
//    하드웨어 개발사에서 BLE 스펙 문서를 받으면 **이 파일만** 실제 값으로
//    바꾸면 앱 전체 통신이 그대로 동작하도록 설계했습니다.
// ─────────────────────────────────────────────────────────────

// 기기 검색 시 이름으로 찾기 (기기 광고 이름이 이 문구로 시작하면 헤온 기기로 판단)
export const DEVICE_NAME_PREFIXES = ['HeOnn', 'HEONN', 'FaceFit'];

// 서비스/특성(characteristic) UUID — 펌웨어 스펙 문서의 값으로 교체하세요.
export const BLE_SPEC = {
  // 헤온 기기 메인 서비스
  SERVICE_UUID: '0000ffe0-0000-1000-8000-00805f9b34fb',
  // 제어 명령 쓰기(온도·진동 모드 설정)
  CONTROL_CHAR_UUID: '0000ffe1-0000-1000-8000-00805f9b34fb',
  // 상태 알림 받기(배터리·현재 온도) — notify
  STATUS_CHAR_UUID: '0000ffe2-0000-1000-8000-00805f9b34fb',
  // 표준 배터리 서비스(기기가 지원한다면 이쪽 사용)
  BATTERY_SERVICE_UUID: '0000180f-0000-1000-8000-00805f9b34fb',
  BATTERY_CHAR_UUID: '00002a19-0000-1000-8000-00805f9b34fb',
};

// ── 제어 명령 만들기 (바이트 배열) ──
// 임시 프로토콜: [명령코드, 값] 2바이트. 실제 스펙이 오면 여기만 수정.
export const CMD = {
  SET_TEMP: 0x01, // 온도 설정 (값: °C)
  SET_MODE: 0x02, // 진동 모드 (값: 0=끔 1=릴렉스 2=탄력UP 3=집중)
  POWER_OFF: 0x03, // 전원 끄기
};

// 온도 설정 명령 바이트
export function buildTempCommand(tempC: number): Uint8Array {
  return new Uint8Array([CMD.SET_TEMP, Math.max(0, Math.min(60, Math.round(tempC)))]);
}

// 진동 모드 설정 명령 바이트 (modeIndex: 0=끔 1=릴렉스 2=탄력UP 3=집중)
export function buildModeCommand(modeIndex: number): Uint8Array {
  return new Uint8Array([CMD.SET_MODE, Math.max(0, Math.min(3, modeIndex))]);
}

// ── 상태 알림 해석 ──
// 임시 프로토콜: [배터리%, 현재온도°C] 2바이트라고 가정. 실제 스펙이 오면 여기만 수정.
export type DeviceStatus = { battery: number | null; temp: number | null };

export function parseStatus(bytes: Uint8Array): DeviceStatus {
  return {
    battery: bytes.length > 0 ? bytes[0] : null,
    temp: bytes.length > 1 ? bytes[1] : null,
  };
}
