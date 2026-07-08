// 백엔드(FastAPI 서버)와 통신하기 위한 설정과 함수 모음입니다.
// 별도 폴더(../heonn_facefit_app_backend)의 Python 서버와 연결합니다.

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
// 휴대폰(iOS/Android)에서 사진 파일을 안정적으로 업로드하기 위한 Expo 공식 도구입니다.
// (최신 React Native에서는 fetch + FormData로 파일을 올리는 방식이 더 이상 동작하지 않아 이걸로 교체)
import { uploadAsync, FileSystemUploadType } from 'expo-file-system/legacy';
// 휴대폰에서 카카오 인증 창을 띄우고 결과(앱으로 복귀한 주소)를 받기 위한 Expo 공식 도구입니다.
import * as WebBrowser from 'expo-web-browser';

// 인증 후 브라우저 세션을 깔끔히 마무리(주로 웹에서 필요).
WebBrowser.maybeCompleteAuthSession();

// 백엔드 서버 주소입니다.
//
// 클라우드(Hugging Face Spaces)에 배포된 서버를 사용합니다.
// 이 주소 덕분에 PC 웹·휴대폰 앱 어디서나 같은 서버에 접속해 분석할 수 있습니다.
//
// 참고: 내 PC에서 백엔드를 직접 띄워 테스트하려면 아래 주소를
//       'http://localhost:8000' 으로 잠시 바꾸면 됩니다.
export const BACKEND_URL = 'https://neko1015-facefit-backend.hf.space';

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
// persist=true: 기기에 저장(자동 로그인 유지) / false: 이번 실행에만 사용(저장 안 함)
export async function setAuthToken(token: string | null, persist = true) {
  authToken = token;
  try {
    if (token && persist) {
      await AsyncStorage.setItem(TOKEN_KEY, token);
    } else {
      // 토큰이 없거나 자동 로그인을 끈 경우 → 저장된 토큰 제거
      await AsyncStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // 저장 실패는 무시(메모리에는 유지)
  }
}

// 인증 헤더를 만듭니다(토큰이 있을 때만).
function authHeaders(): Record<string, string> {
  return authToken ? { Authorization: `Bearer ${authToken}` } : {};
}

// ── 기기 연결(페어링) 기억 ─────────────────────────────────────
// 한 번 기기를 연결하면 기억해 두고, 다음 실행 때 페어링 화면을 건너뜁니다.
const PAIRED_KEY = 'facefit_paired';

// 저장된 "기기 연결됨" 상태를 불러옵니다.
export async function loadPaired(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(PAIRED_KEY)) === 'true';
  } catch {
    return false;
  }
}

// 기기 연결 상태를 저장(true) 또는 해제(false)합니다.
export async function setPaired(value: boolean) {
  try {
    if (value) await AsyncStorage.setItem(PAIRED_KEY, 'true');
    else await AsyncStorage.removeItem(PAIRED_KEY);
  } catch {
    // 저장 실패는 무시
  }
}

// ── 위치 포인트 데이터(기기 셋팅 캘리브레이션) ──────────────────
// 첫 연결 후 얼굴 부위별 포인트를 잡아 저장합니다. 데이터가 있으면 셋팅 가이드를 건너뜁니다.
const CALIB_KEY = 'facefit_calibration';
export type CalibrationPoint = { step: string; capturedAt: string };

// 저장된 위치 포인트 데이터를 불러옵니다. (없으면 null)
export async function loadCalibration(): Promise<CalibrationPoint[] | null> {
  try {
    const raw = await AsyncStorage.getItem(CALIB_KEY);
    return raw ? (JSON.parse(raw) as CalibrationPoint[]) : null;
  } catch {
    return null;
  }
}

// 위치 포인트 데이터가 있는지 여부. (셋팅 가이드 노출 판단)
export async function hasCalibration(): Promise<boolean> {
  const c = await loadCalibration();
  return !!(c && c.length > 0);
}

// 위치 포인트 데이터를 저장합니다.
export async function saveCalibration(points: CalibrationPoint[]) {
  try {
    await AsyncStorage.setItem(CALIB_KEY, JSON.stringify(points));
  } catch {
    // 저장 실패는 무시
  }
}

// (재설정용) 위치 포인트 데이터를 지웁니다.
export async function clearCalibration() {
  try {
    await AsyncStorage.removeItem(CALIB_KEY);
  } catch {
    // 무시
  }
}

// 로그인한 사용자 정보
export type AppUser = { id: number; provider: string; display_name: string; consented?: boolean };

// 소셜 버튼으로 로그인 → 토큰 발급 후 저장.
// remember=true면 기기에 저장(다음에 자동 로그인), false면 이번만 로그인.
export async function login(provider: string, remember = true): Promise<AppUser> {
  // 서버가 잠들어 있을 수 있어 먼저 깨우고, 일시적 실패면 자동 재시도합니다(콜드스타트 대비).
  await waitForBackendReady();
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(`${BACKEND_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      });
      if (res.status >= 500) {
        lastErr = new Error(`서버 준비 중(${res.status})`);
      } else {
        const data = await res.json();
        await setAuthToken(data.token, remember);
        return data.user;
      }
    } catch (e) {
      lastErr = e;
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw lastErr ?? new Error('로그인 실패');
}

// 휴대폰(네이티브)에서 진짜 소셜 로그인을 합니다(카카오·네이버 공용).
// 인앱 브라우저로 인증 → 백엔드가 앱(facefit://auth?token=)으로 돌려보내면 토큰을 꺼내 로그인.
// 성공 시 사용자, 사용자가 취소하면 null.
async function loginWithOAuthNative(provider: 'kakao' | 'naver' | 'google', remember = true): Promise<AppUser | null> {
  await waitForBackendReady(); // 콜드스타트면 미리 깨움(인증 콜백이 서버를 호출하므로)
  const authUrl = `${BACKEND_URL}/auth/${provider}/login?state=native`;
  const result = await WebBrowser.openAuthSessionAsync(authUrl, 'facefit://auth');
  if (result.type !== 'success' || !result.url) return null; // 취소/닫음
  const m = result.url.match(/[?&]token=([^&]+)/);
  if (!m) return null; // 로그인 실패(에러로 복귀)
  const token = decodeURIComponent(m[1]);
  await setAuthToken(token, remember);
  return await fetchMe();
}

// 카카오 네이티브 로그인
export function loginWithKakaoNative(remember = true): Promise<AppUser | null> {
  return loginWithOAuthNative('kakao', remember);
}

// 네이버 네이티브 로그인
export function loginWithNaverNative(remember = true): Promise<AppUser | null> {
  return loginWithOAuthNative('naver', remember);
}

// 구글 네이티브 로그인
export function loginWithGoogleNative(remember = true): Promise<AppUser | null> {
  return loginWithOAuthNative('google', remember);
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

// 약관·개인정보(얼굴 포함) 동의를 서버에 기록합니다. (로그인 후 동의 화면에서 호출)
// marketing: 마케팅 수신 동의(선택) 여부
export async function submitConsent(marketing: boolean): Promise<boolean> {
  try {
    const res = await fetch(`${BACKEND_URL}/auth/consent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ marketing }),
    });
    const data = await res.json();
    return !!data.ok;
  } catch (e) {
    console.log('동의 기록 실패:', e);
    return false;
  }
}

// 백엔드 깨우기(warmup): 무료 서버가 잠들어 있으면 미리 깨워 둡니다.
// 앱을 켤 때 호출해 두면, 분석할 때쯤엔 서버가 깨어 있어 콜드스타트(첫 요청 지연)를 피합니다.
export async function warmupBackend() {
  try {
    await fetch(`${BACKEND_URL}/`);
  } catch {
    // 실패해도 무시(분석 시 재시도가 처리)
  }
}

// 서버가 깨어날 때까지 기다립니다(콜드스타트 대비). 최대 약 70초.
// 무료 서버는 잠들어 있으면 깨어나는 데 30초~1분이 걸려, 사진을 보내기 전에 먼저 깨워 둡니다.
async function waitForBackendReady(): Promise<void> {
  for (let i = 0; i < 14; i++) {
    try {
      const res = await fetch(`${BACKEND_URL}/`);
      if (res.ok) return; // 서버가 깨어남 → 바로 진행
    } catch {
      // 아직 안 깨어남 → 잠시 후 다시 확인
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
  // 끝까지 못 깨워도 업로드는 한 번 시도해 봅니다(throw하지 않음).
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
  // 백엔드의 얼굴 분석 주소로 사진을 전송하고, 결과(JSON)를 돌려받습니다.
  const { json } = await uploadImageFile('/scan/landmarks', uri);
  return json;
}

// 얼굴 점수 하나의 형태입니다. (예: 안면 비대칭 개선도 95점)
export type FaceScore = {
  key: string; // 점수 종류 식별자
  label: string; // 화면에 보일 이름
  value: number; // 0~100 점수
  basis?: string; // 점수 근거(측정값+단위, 예: '좌우 폭 차이 5.9%')
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
  const { json } = await uploadImageFile('/scan/analyze', uri);
  return json;
}

// 저장된 이력(기록) 한 건의 형태입니다.
export type ScanRecord = {
  id: number; // 기록 번호
  created_at: string; // 분석한 시각
  image_url: string; // 사진 주소(서버 기준 상대 경로). 전체 주소는 BACKEND_URL을 앞에 붙입니다.
  scores: FaceScore[]; // 그때의 점수들
  care_side?: string; // 케어가 더 필요한 쪽('오른쪽'/'왼쪽')
  signature?: number[]; // 동일인 판별용 얼굴 서명(특징 벡터)
  age?: string; // 추정 나이대(참고용, 예: '25-32세')
};

// 사진 파일을 백엔드의 지정한 주소로 업로드하는 공통 함수입니다.
// 플랫폼별로 가장 안정적인 방식을 사용합니다:
//  - 웹: fetch + FormData(Blob)
//  - 휴대폰: Expo 공식 uploadAsync(멀티파트) — 최신 RN에서 표준 방식
// 반환값: { status: HTTP 상태코드, json: 파싱된 응답(JSON) | null }
async function uploadImageFile(
  endpoint: string,
  uri: string
): Promise<{ status: number; json: any }> {
  if (Platform.OS === 'web') {
    const res = await fetch(uri);
    const blob = await res.blob();
    const formData = new FormData();
    formData.append('file', blob, 'photo.jpg');
    const response = await fetch(`${BACKEND_URL}${endpoint}`, {
      method: 'POST',
      headers: authHeaders(),
      body: formData,
    });
    const json = await response.json().catch(() => null);
    return { status: response.status, json };
  }
  // 휴대폰: 사진 파일(uri)을 멀티파트로 직접 업로드합니다.
  const result = await uploadAsync(`${BACKEND_URL}${endpoint}`, uri, {
    httpMethod: 'POST',
    uploadType: FileSystemUploadType.MULTIPART,
    fieldName: 'file', // 백엔드가 받는 필드 이름
    mimeType: 'image/jpeg',
    headers: authHeaders(), // 로그인 토큰 등
  });
  let json: any = null;
  try {
    json = JSON.parse(result.body);
  } catch {
    json = null; // 응답이 JSON이 아니면 null
  }
  return { status: result.status, json };
}

// 얼굴 점 하나의 좌표입니다. x, y는 0~1 비율, z는 상대 깊이(간이 3D 표시용).
export type LandmarkPoint = { x: number; y: number; z?: number };

// 머리 각도(정면 정도). 0에 가까울수록 정면. 단위: 도(°)
export type HeadPose = { yaw: number; pitch: number; roll: number };

// 측정 품질 정보 — 분석에 어떤 보정이 적용됐는지(앱에서 배지로 표시)
export type ScanQuality = {
  frontal: boolean; // 정면 게이팅 통과
  angle_corrected: boolean; // 점수 각도 보정(고개 기울임 펴기) 적용
  light_corrected: boolean; // 조명 보정(피부톤) 적용
};

// 사진을 분석하고 그 결과를 이력으로 저장하는 함수입니다.
export async function saveScan(
  uri: string
): Promise<{
  detected: boolean;
  message: string;
  landmark_count?: number;
  image_size?: { width: number; height: number };
  landmarks?: LandmarkPoint[];
  age?: string;
  pose?: HeadPose | null; // 머리 각도(측정 품질 표시용)
  quality?: ScanQuality; // 적용된 보정 정보
  record?: ScanRecord;
}> {
  // 먼저 서버가 깨어날 때까지 기다립니다(콜드스타트 대비, 최대 약 70초).
  await waitForBackendReady();

  // 서버가 잠들어 있을 수 있어, 실패하거나 서버 오류(5xx)면 잠시 후 자동으로 다시 시도합니다.
  // (콜드스타트: 무료 서버가 깨어나는 데 시간이 걸려 첫 요청이 실패하는 문제 대비)
  // 실패 시 "왜 실패했는지"를 자세히 기록해, 화면에서 진짜 원인을 확인할 수 있게 합니다.
  let lastDetail = '원인 미상';
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const { status, json } = await uploadImageFile('/history/scan', uri);
      // 서버가 깨는 중이면 5xx가 올 수 있음 → 재시도
      if (status >= 500) {
        lastDetail = `서버 응답 ${status} (준비 중)`;
      } else if (json == null) {
        lastDetail = `서버 응답 해석 실패 (status ${status})`;
      } else {
        return json;
      }
    } catch (e: any) {
      // 네트워크 실패(서버 미응답·파일 전송 실패 등) → 재시도. 실제 메시지를 보관.
      lastDetail = `네트워크 오류: ${e?.message ?? String(e)}`;
    }
    // 다음 시도 전 대기 (서버가 깨어날 시간)
    await new Promise((resolve) => setTimeout(resolve, 4000));
  }
  // 5번 모두 실패 → 마지막 실패 이유를 그대로 알려줍니다(진단용).
  throw new Error(`5회 재시도 실패 — ${lastDetail}`);
}

// 실시간 촬영 가이드: 미리보기 프레임을 보내 '얼굴 인식·위치·정면' 안내를 받습니다.
// (카메라 화면에서 1~2초마다 호출 — 실패해도 조용히 넘어가 가이드만 멈춥니다)
// yaw: 좌우 고개 각도(도). 다중뷰(정면·좌·우) 가이드 촬영에 사용.
export type GuideResult = { detected: boolean; ok: boolean; hint: string; yaw?: number | null; pitch?: number | null };
export async function sendGuideFrame(uri: string): Promise<GuideResult> {
  try {
    const { json } = await uploadImageFile('/scan/guide', uri);
    if (json && typeof json.hint === 'string') return json as GuideResult;
  } catch {
    // 네트워크 일시 실패는 무시(다음 프레임에서 다시 시도)
  }
  return { detected: false, ok: false, hint: '' };
}

// 맞춤 헤드 도면 측정값 + DXF(base64)
export type HeadBuildResult = {
  ok: boolean;
  message?: string;
  views_used?: string[];
  measurements?: Record<string, number>;
  dxf_base64?: string;
};

// 정면(+좌/우) 사진으로 맞춤 헤드 CAD를 만듭니다. (다중뷰 → 서버가 턱선 곡선·헤드 도면 생성)
export async function buildHeadFromPhotos(
  front: string, left?: string | null, right?: string | null,
  opts?: { head_mm?: number; ipd_mm?: number }
): Promise<HeadBuildResult> {
  const fd = new FormData();
  const add = (name: string, uri?: string | null) => {
    if (uri) fd.append(name, { uri, name: `${name}.jpg`, type: 'image/jpeg' } as any);
  };
  add('front', front); add('left', left); add('right', right);
  fd.append('head_mm', String(opts?.head_mm ?? 75));
  fd.append('ipd_mm', String(opts?.ipd_mm ?? 63));
  try {
    const res = await fetch(`${BACKEND_URL}/head/build.json`, {
      method: 'POST', headers: authHeaders(), body: fd,
    });
    return (await res.json()) as HeadBuildResult;
  } catch (e: any) {
    return { ok: false, message: `업로드 실패: ${e?.message ?? e}` };
  }
}

// 저장된 모든 이력을 최신순으로 가져오는 함수입니다.
export async function getHistory(): Promise<{ count: number; records: ScanRecord[] }> {
  const response = await fetch(`${BACKEND_URL}/history`, { headers: authHeaders() });
  return response.json();
}

// 저장된 분석 사진(기록 id)에서 얼굴 특징점 478개를 다시 받아옵니다.
// 리포트 상세에서 "분석 부위를 사진 위에 표시"할 때 사용합니다.
export type ScanLandmarksResult = {
  detected: boolean;
  message?: string;
  landmark_count?: number;
  landmarks?: LandmarkPoint[];
};
export async function getScanLandmarks(id: number): Promise<ScanLandmarksResult> {
  const response = await fetch(`${BACKEND_URL}/scan/${id}/landmarks`, { headers: authHeaders() });
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
  csat: {
    total_responses: number; // 전체 평가 수
    satisfied_count: number; // 만족 응답 수
    csat: number; // 만족도(%)
  };
  latency: {
    sample_count: number; // 측정에 쓰인 분석 건수
    avg_duration_ms: number; // 평균 처리 시간(ms)
    approx_fps: number; // 환산 처리량(장/초, 참고용)
  };
};

// 검출 성공률·재사용률·만족도·처리 시간 지표를 한 번에 가져옵니다.
export async function getAiMetrics(): Promise<AiMetrics> {
  const [landmarkRes, retentionRes, csatRes, latencyRes] = await Promise.all([
    fetch(`${BACKEND_URL}/metrics/landmark`),
    fetch(`${BACKEND_URL}/metrics/retention`),
    fetch(`${BACKEND_URL}/metrics/csat`),
    fetch(`${BACKEND_URL}/metrics/latency`),
  ]);
  const landmark = await landmarkRes.json();
  const retention = await retentionRes.json();
  const csat = await csatRes.json();
  const latency = await latencyRes.json();
  return { landmark, retention, csat, latency };
}

// 만족도 평가를 제출합니다. (satisfied: true=도움됨, false=아니에요)
export async function submitFeedback(satisfied: boolean): Promise<void> {
  await fetch(`${BACKEND_URL}/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ satisfied }),
  });
}
