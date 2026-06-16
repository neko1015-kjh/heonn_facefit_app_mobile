// 백엔드(FastAPI 서버)와 통신하기 위한 설정과 함수 모음입니다.
// 별도 폴더(../heonn_facefit_app_backend)의 Python 서버와 연결합니다.

// 백엔드 서버 주소입니다.
// FastAPI 서버는 보통 8000번 포트에서 실행되므로 기본값으로 둡니다.
//
// 참고:
// - 웹 브라우저 미리보기(npm run web)에서는 아래 'localhost' 주소가 그대로 잘 동작합니다.
// - 나중에 실제 휴대폰(Expo Go 앱)으로 테스트할 때는 'localhost' 대신
//   컴퓨터의 IP 주소(예: http://192.168.0.10:8000)로 바꿔야 합니다.
export const BACKEND_URL = 'http://localhost:8000';

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
