// 웹용 BLE 빈 구현입니다.
// 웹 브라우저 미리보기에서는 기기 통신을 하지 않고, 항상 "사용 불가"로 동작해
// 앱이 데모 모드로 자연스럽게 넘어가게 합니다. (ble.ts와 같은 함수 목록 유지)

import { DeviceStatus } from './bleSpec';

export type BleDeviceInfo = { id: string; name: string };

export function bleSupported(): boolean {
  return false;
}

export async function requestBlePermissions(): Promise<boolean> {
  return false;
}

export async function scanForHeonnDevice(_timeoutMs = 8000): Promise<BleDeviceInfo | null> {
  return null;
}

export async function connectToHeonnDevice(_deviceId: string): Promise<boolean> {
  return false;
}

export async function disconnectDevice(): Promise<void> {
  // 웹에서는 할 일 없음
}

export function sendTemp(_tempC: number): Promise<boolean> {
  return Promise.resolve(false);
}

export function sendMode(_modeIndex: number): Promise<boolean> {
  return Promise.resolve(false);
}

export function isBleConnected(): boolean {
  return false;
}

export function getLatestStatus(): DeviceStatus {
  return { battery: null, temp: null };
}

export function onDeviceStatus(_cb: (s: DeviceStatus) => void): () => void {
  return () => {};
}

export function onConnectionChange(_cb: (connected: boolean) => void): () => void {
  return () => {};
}
