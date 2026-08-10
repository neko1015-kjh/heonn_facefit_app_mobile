// 헤온 페이스핏 디바이스 BLE 통신 모듈 (휴대폰 전용)
//
// - 기기 검색 → 연결 → 명령 전송(온도·진동) → 상태 수신(배터리·온도)을 담당합니다.
// - 통신 규격(UUID·명령 바이트)은 src/bleSpec.ts 한 곳에 모아뒀습니다.
//   (하드웨어 스펙 문서가 나오면 bleSpec.ts만 고치면 됩니다)
// - 웹에서는 같은 이름의 ble.web.ts(빈 구현)가 대신 사용됩니다.
// - Expo Go에는 BLE 네이티브 모듈이 없어 동작하지 않습니다 → 개발/프리뷰 빌드(APK)에서만 실동작.
//   그런 환경에서도 앱이 죽지 않도록 모든 부분을 안전하게 감쌌습니다(사용 불가 시 데모 모드).

import { PermissionsAndroid, Platform } from 'react-native';
import { BLE_SPEC, DEVICE_NAME_PREFIXES, DeviceStatus, buildModeCommand, buildTempCommand, parseStatus } from './bleSpec';

// react-native-ble-plx의 타입(빌드 환경에 따라 없을 수 있어 최소한만 사용)
type BleManagerLike = any;
type DeviceLike = any;

export type BleDeviceInfo = { id: string; name: string };

// ── 내부 상태 ──
let manager: BleManagerLike | null = null;
let managerFailed = false; // 네이티브 모듈이 없어 만들기 실패(Expo Go 등)
let connectedDevice: DeviceLike | null = null;
let latestStatus: DeviceStatus = { battery: null, temp: null };

const statusListeners = new Set<(s: DeviceStatus) => void>();
const connListeners = new Set<(connected: boolean) => void>();

// ── base64 도우미 (BLE 값은 base64 문자열로 주고받습니다) ──
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function bytesToBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    out += B64[a >> 2] + B64[((a & 3) << 4) | (b >> 4)];
    out += i + 1 < bytes.length ? B64[((b & 15) << 2) | (c >> 6)] : '=';
    out += i + 2 < bytes.length ? B64[c & 63] : '=';
  }
  return out;
}

function base64ToBytes(s: string): Uint8Array {
  const clean = s.replace(/[^A-Za-z0-9+/]/g, '');
  const out: number[] = [];
  for (let i = 0; i < clean.length; i += 4) {
    const n =
      (B64.indexOf(clean[i]) << 18) |
      (B64.indexOf(clean[i + 1]) << 12) |
      ((B64.indexOf(clean[i + 2]) & 63) << 6) |
      (B64.indexOf(clean[i + 3]) & 63);
    out.push((n >> 16) & 255);
    if (clean[i + 2] !== undefined) out.push((n >> 8) & 255);
    if (clean[i + 3] !== undefined) out.push(n & 255);
  }
  return new Uint8Array(out);
}

// ── 매니저 준비 ──
function getManager(): BleManagerLike | null {
  if (manager) return manager;
  if (managerFailed) return null;
  try {
    // 네이티브 모듈이 없는 환경(Expo Go·웹)에서는 여기서 예외가 납니다.
    const { BleManager } = require('react-native-ble-plx');
    manager = new BleManager();
    return manager;
  } catch {
    managerFailed = true;
    return null;
  }
}

// 이 기기(폰)에서 BLE 사용이 가능한지 (라이브러리 로드 기준)
export function bleSupported(): boolean {
  return getManager() !== null;
}

// ── 권한 요청 (안드로이드는 런타임 허용이 필요) ──
export async function requestBlePermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true; // iOS는 시스템이 자동으로 물어봄
  try {
    const api = typeof Platform.Version === 'number' ? Platform.Version : parseInt(String(Platform.Version), 10);
    if (api >= 31) {
      // 안드로이드 12 이상: 블루투스 검색·연결 권한
      const res = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      ]);
      return Object.values(res).every((v) => v === PermissionsAndroid.RESULTS.GRANTED);
    }
    // 안드로이드 11 이하: 위치 권한이 있어야 BLE 검색 가능
    const res = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
    return res === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

// 블루투스 어댑터가 켜질 때까지 잠깐 기다립니다.
async function waitPoweredOn(m: BleManagerLike, timeoutMs = 5000): Promise<boolean> {
  try {
    const st = await m.state();
    if (st === 'PoweredOn') return true;
    return await new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => {
        sub?.remove?.();
        resolve(false);
      }, timeoutMs);
      const sub = m.onStateChange((s: string) => {
        if (s === 'PoweredOn') {
          clearTimeout(timer);
          sub?.remove?.();
          resolve(true);
        }
      }, true);
    });
  } catch {
    return false;
  }
}

// 헤온 기기인지 이름으로 판단
function isHeonnName(name?: string | null): boolean {
  if (!name) return false;
  return DEVICE_NAME_PREFIXES.some((p) => name.toUpperCase().startsWith(p.toUpperCase()));
}

// ── 기기 검색: 제한 시간 안에 헤온 기기를 찾으면 정보 반환, 못 찾으면 null ──
export async function scanForHeonnDevice(timeoutMs = 8000): Promise<BleDeviceInfo | null> {
  const m = getManager();
  if (!m) return null;
  const ok = await requestBlePermissions();
  if (!ok) return null;
  if (!(await waitPoweredOn(m))) return null;

  return await new Promise<BleDeviceInfo | null>((resolve) => {
    let done = false;
    const finish = (r: BleDeviceInfo | null) => {
      if (done) return;
      done = true;
      try {
        m.stopDeviceScan();
      } catch {
        // 무시
      }
      resolve(r);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    try {
      m.startDeviceScan(null, { allowDuplicates: false }, (error: any, device: DeviceLike) => {
        if (error) {
          clearTimeout(timer);
          finish(null);
          return;
        }
        if (device && (isHeonnName(device.name) || isHeonnName(device.localName))) {
          clearTimeout(timer);
          finish({ id: device.id, name: device.name || device.localName || 'HeOnn FaceFit' });
        }
      });
    } catch {
      clearTimeout(timer);
      finish(null);
    }
  });
}

// 상태 알림(배터리·온도) 값 반영 + 화면에 알리기
function updateStatus(next: Partial<DeviceStatus>) {
  latestStatus = { ...latestStatus, ...next };
  statusListeners.forEach((cb) => cb(latestStatus));
}

function notifyConn(connected: boolean) {
  connListeners.forEach((cb) => cb(connected));
}

// ── 연결: 성공하면 true. 상태 알림 구독·배터리 읽기까지 시도합니다. ──
export async function connectToHeonnDevice(deviceId: string): Promise<boolean> {
  const m = getManager();
  if (!m) return false;
  try {
    const device = await m.connectToDevice(deviceId, { timeout: 10000 });
    await device.discoverAllServicesAndCharacteristics();
    connectedDevice = device;

    // 연결이 끊기면 화면에 알립니다.
    try {
      m.onDeviceDisconnected(deviceId, () => {
        connectedDevice = null;
        updateStatus({ battery: null, temp: null });
        notifyConn(false);
      });
    } catch {
      // 무시
    }

    // 상태 알림 구독 (기기가 이 특성을 지원할 때만 — 실패해도 연결은 유지)
    try {
      device.monitorCharacteristicForService(
        BLE_SPEC.SERVICE_UUID,
        BLE_SPEC.STATUS_CHAR_UUID,
        (error: any, ch: any) => {
          if (!error && ch?.value) updateStatus(parseStatus(base64ToBytes(ch.value)));
        }
      );
    } catch {
      // 무시
    }

    // 표준 배터리 서비스 읽기 시도 (지원 안 하면 조용히 넘어감)
    try {
      const ch = await device.readCharacteristicForService(BLE_SPEC.BATTERY_SERVICE_UUID, BLE_SPEC.BATTERY_CHAR_UUID);
      if (ch?.value) {
        const bytes = base64ToBytes(ch.value);
        if (bytes.length > 0) updateStatus({ battery: bytes[0] });
      }
    } catch {
      // 무시
    }

    notifyConn(true);
    return true;
  } catch {
    connectedDevice = null;
    return false;
  }
}

// 연결 해제
export async function disconnectDevice(): Promise<void> {
  const m = getManager();
  if (m && connectedDevice) {
    try {
      await m.cancelDeviceConnection(connectedDevice.id);
    } catch {
      // 무시
    }
  }
  connectedDevice = null;
  updateStatus({ battery: null, temp: null });
  notifyConn(false);
}

// ── 명령 전송 ──
async function writeControl(bytes: Uint8Array): Promise<boolean> {
  if (!connectedDevice) return false;
  const value = bytesToBase64(bytes);
  try {
    // 응답 없는 쓰기 먼저(빠름) → 실패하면 응답 있는 쓰기로 재시도
    await connectedDevice.writeCharacteristicWithoutResponseForService(
      BLE_SPEC.SERVICE_UUID,
      BLE_SPEC.CONTROL_CHAR_UUID,
      value
    );
    return true;
  } catch {
    try {
      await connectedDevice.writeCharacteristicWithResponseForService(
        BLE_SPEC.SERVICE_UUID,
        BLE_SPEC.CONTROL_CHAR_UUID,
        value
      );
      return true;
    } catch {
      return false;
    }
  }
}

// 온도 설정(°C) 전송
export function sendTemp(tempC: number): Promise<boolean> {
  return writeControl(buildTempCommand(tempC));
}

// 진동 모드 전송 (0=끔 1=릴렉스 2=탄력UP 3=집중)
export function sendMode(modeIndex: number): Promise<boolean> {
  return writeControl(buildModeCommand(modeIndex));
}

// ── 화면에서 쓰는 조회·구독 ──
export function isBleConnected(): boolean {
  return connectedDevice !== null;
}

export function getLatestStatus(): DeviceStatus {
  return latestStatus;
}

// 상태(배터리·온도) 변화 구독 — 반환값을 호출하면 구독 해제
export function onDeviceStatus(cb: (s: DeviceStatus) => void): () => void {
  statusListeners.add(cb);
  return () => statusListeners.delete(cb);
}

// 연결/해제 변화 구독 — 반환값을 호출하면 구독 해제
export function onConnectionChange(cb: (connected: boolean) => void): () => void {
  connListeners.add(cb);
  return () => connListeners.delete(cb);
}
