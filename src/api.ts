// 백엔드(FastAPI 서버)와 통신하기 위한 설정과 함수 모음입니다.
// 별도 폴더(../heonn_facefit_app_backend)의 Python 서버와 연결합니다.

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 백엔드 서버 주소입니다. (FastAPI는 8000번 포트에서 실행)
//
// 'localhost'를 사용합니다.
// - PC 웹 브라우저(localhost:8081)에서 그대로 동작합니다.
// - 안드로이드 USB(adb reverse) 연결 시에도 휴대폰이 localhost로 PC에 접근하므로 동일하게 동작합니다.
export const BACKEND_URL = 'http://localhost:8000';

// ── 로그인 토큰 관리 ──────────────────────────────────────────
// 로그인하면 받은 토큰을 메모리 + 기기에 저장해 두고, 모든 요청에 함께 보냅니다.
const TOKEN_KEY = 'facefit_token';
let authToken: string | null = null;

// 앱 시작 시 기기에 저장된 토큰을 불러옵니다.
export async function loadStoredToken(): Promise<string | null> {
  try {
    authToken = await AsyncStorage.getItem(TOKEN_KEY);
  } catch {
    authToken = null;
  }
  return authToken;
}

// 토큰을 저장(로그인) 또는 삭제(로그아웃)합니다.
export async function setAuthToken(token: string | null) {
  authToken = token;
  try {
    if (token) await AsyncStorage.setItem(TOKEN_KEY, token);
    else await AsyncStorage.removeItem(TOKEN_KEY);
  } catch {
    // 저장 실패는 무시(메모리에는 유지)
  }
}

// 인증 헤더를 만듭니다(토큰이 있을 때만).
function authHeaders(): Record<string, string> {
  return authToken ? { Authorization: `Bearer ${authToken}` } : {};
}

// 로그인한 사용자 정보
export type AppUser = { id: number; provider: string; display_name: string };

// 소셜 버튼으로 로그인 → 토큰 발급 후 저장.
export async function login(provider: string): Promise<AppUser> {
  const res = await fetch(`${BACKEND_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider }),
  });
  const data = await res.json();
  await setAuthToken(data.token);
  return data.user;
}

// 저장된 토큰으로 로그인 상태 확인(자동 로그인). 유효하면 사용자, 아니면 null.
export async function fetchMe(): Promise<AppUser | null> {
  if (!authToken) return null;
  try {
    const res = await fetch(`${BACKEND_URL}/auth/me`, { headers: authHeaders() });
    const data = await res.json();
    return data.authenticated ? data.user : null;
  } catch {
    return null;
  }
}

// 로그아웃: 토큰 삭제.
export async function logout() {
  await setAuthToken(null);
}

// 백엔드 서버가 켜져 있고 정상적으로 응답하는지 확인하는 함수입니다.
// 서버가 응답하면 true, 그렇지 않으면 false를 돌려줍니다.
export async function checkConnection(): Promise<boolean> {
  try {
    // 서버의 기본 주소로 한 번 요청을 보내봅니다.
    const response = await fetch(`${BACKEND_URL}/`);
    return response.ok; // 정상 응답(200 등)이면 true
  } catch (error) {
    // 서버가 꺼져 있거나 주소가 틀리면 여기로 옵니다.
    console.log('백엔드 연결 실패:', error);
    return false;
  }
}

// 백엔드가 돌려주는 얼굴 분석 결과의 형태입니다.
export type LandmarkResult = {
  detected: boolean; // 얼굴을 찾았는지 여부
  message: string; // 사람이 읽을 수 있는 안내 문구
  landmark_count?: number; // 찾은 특징점(점) 개수
  image_size?: { width: number; height: number }; // 사진 크기
  landmarks?: { x: number; y: number; z: number }[]; // 점들의 좌표(0~1 비율)
};

// 선택한 사진을 백엔드로 보내 얼굴 랜드마크(특징점)를 분석받는 함수입니다.
// uri: 사진의 위치(앱에서 사진을 고르면 받는 값)
export async function sendImageForLandmarks(uri: string): Promise<LandmarkResult> {
  // 서버에 파일을 보내기 위한 데이터 묶음을 만듭니다.
  const formData = new FormData();

  if (Platform.OS === 'web') {
    // 웹에서는 사진 주소를 실제 파일 데이터(Blob)로 바꿔서 담습니다.
    const res = await fetch(uri);
    const blob = await res.blob();
    formData.append('file', blob, 'photo.jpg');
  } else {
    // 휴대폰(iOS/Android)에서는 파일 정보를 형태에 맞춰 담습니다.
    formData.append('file', {
      uri,
      name: 'photo.jpg',
      type: 'image/jpeg',
    } as any);
  }

  // 백엔드의 얼굴 분석 주소로 사진을 전송하고, 결과(JSON)를 돌려받습니다.
  const response = await fetch(`${BACKEND_URL}/scan/landmarks`, {
    method: 'POST',
    body: formData,
  });
  return response.json();
}

// 얼굴 점수 하나의 형태입니다. (예: 안면 비대칭 개선도 95점)
export type FaceScore = {
  key: string; // 점수 종류 식별자
  label: string; // 화면에 보일 이름
  value: number; // 0~100 점수
};

// 점수 분석 결과의 형태입니다.
export type AnalyzeResult = {
  detected: boolean; // 얼굴을 찾았는지 여부
  message: string; // 안내 문구
  image_size?: { width: number; height: number };
  scores?: FaceScore[]; // 계산된 점수들
};

// 사진을 보내 진짜 점수(비대칭/좌우 균형)를 받는 함수입니다.
// 사진을 파일로 만드는 방식은 위 sendImageForLandmarks와 동일합니다.
export async function analyzeFaceScores(uri: string): Promise<AnalyzeResult> {
  const formData = new FormData();

  if (Platform.OS === 'web') {
    const res = await fetch(uri);
    const blob = await res.blob();
    formData.append('file', blob, 'photo.jpg');
  } else {
    formData.append('file', {
      uri,
      name: 'photo.jpg',
      type: 'image/jpeg',
    } as any);
  }

  const response = await fetch(`${BACKEND_URL}/scan/analyze`, {
    method: 'POST',
    body: formData,
  });
  return response.json();
}

// 저장된 이력(기록) 한 건의 형태입니다.
export type ScanRecord = {
  id: number; // 기록 번호
  created_at: string; // 분석한 시각
  image_url: string; // 사진 주소(서버 기준 상대 경로). 전체 주소는 BACKEND_URL을 앞에 붙입니다.
  scores: FaceScore[]; // 그때의 점수들
  care_side?: string; // 케어가 더 필요한 쪽('오른쪽'/'왼쪽')
  signature?: number[]; // 동일인 판별용 얼굴 서명(특징 벡터)
};

// 사진을 보내 파일 데이터를 FormData에 담는 공통 처리입니다.
async function buildImageFormData(uri: string): Promise<FormData> {
  const formData = new FormData();
  if (Platform.OS === 'web') {
    const res = await fetch(uri);
    const blob = await res.blob();
    formData.append('file', blob, 'photo.jpg');
  } else {
    formData.append('file', { uri, name: 'photo.jpg', type: 'image/jpeg' } as any);
  }
  return formData;
}

// 얼굴 점 하나의 좌표입니다. x, y는 0~1 비율, z는 상대 깊이(간이 3D 표시용).
export type LandmarkPoint = { x: number; y: number; z?: number };

// 사진을 분석하고 그 결과를 이력으로 저장하는 함수입니다.
export async function saveScan(
  uri: string
): Promise<{
  detected: boolean;
  message: string;
  landmark_count?: number;
  image_size?: { width: number; height: number };
  landmarks?: LandmarkPoint[];
  record?: ScanRecord;
}> {
  const formData = await buildImageFormData(uri);
  const response = await fetch(`${BACKEND_URL}/history/scan`, {
    method: 'POST',
    headers: authHeaders(),
    body: formData,
  });
  return response.json();
}

// 저장된 모든 이력을 최신순으로 가져오는 함수입니다.
export async function getHistory(): Promise<{ count: number; records: ScanRecord[] }> {
  const response = await fetch(`${BACKEND_URL}/history`, { headers: authHeaders() });
  return response.json();
}

// 추천 제품 하나의 형태입니다.
export type RecommendedProduct = {
  name: string; // 제품 이름
  desc: string; // 간단 설명
  reason: string; // 추천 이유(분석 결과 기반)
  image?: string; // 대표 이미지 주소
};

// 맞춤 추천 결과의 형태입니다.
export type RecommendationResult = {
  has_record: boolean; // 분석 기록이 있는지
  message?: string; // 기록이 없을 때 안내 문구
  summary?: {
    balance: number; // 부기(좌우 균형) 점수
    symmetry: number; // 비대칭 점수
    skin_tone: string; // 피부 톤(밝은/중간/어두운)
    skin_redness: string; // 붉은기 정도
  };
  products: RecommendedProduct[]; // 추천 제품 목록
};

// 최신 분석 결과 기반 맞춤 추천을 가져오는 함수입니다.
// 로그인한 사용자의 기록만 보도록 인증 헤더를 함께 보냅니다.
export async function getRecommendations(): Promise<RecommendationResult> {
  const response = await fetch(`${BACKEND_URL}/recommendations`, { headers: authHeaders() });
  return response.json();
}

// AI 검증 지표(개발·검증용)의 형태입니다.
export type AiMetrics = {
  landmark: {
    total_attempts: number; // 분석 시도 횟수
    success_count: number; // 검출 성공 횟수
    success_rate: number; // 검출 성공률(%)
  };
  retention: {
    active_users: number; // 분석 1회 이상 사용자 수
    returning_users: number; // 2회 이상 분석 사용자 수
    reuse_rate: number; // 재사용률(%)
  };
};

// 검출 성공률·재사용률 두 지표를 한 번에 가져옵니다.
export async function getAiMetrics(): Promise<AiMetrics> {
  const [landmarkRes, retentionRes] = await Promise.all([
    fetch(`${BACKEND_URL}/metrics/landmark`),
    fetch(`${BACKEND_URL}/metrics/retention`),
  ]);
  const landmark = await landmarkRes.json();
  const retention = await retentionRes.json();
  return { landmark, retention };
}
