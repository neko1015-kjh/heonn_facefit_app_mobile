// 3D 얼굴 형상 준비(공용) — 검출된 478점을 3D로 그리기 좋게 다듬습니다.
// ① 얼굴을 똑바로 세우고(roll 보정) ② 삼각망 이웃 기준 Taubin 스무딩으로 노이즈를 줄입니다.
// SVG 뷰어(웹)와 three.js 뷰어(앱)가 함께 씁니다.
import { LandmarkPoint } from './api';
import { FACE_MESH_EDGES } from './faceMeshTesselation';

export type Vec3 = { x: number; y: number; z: number };

// 스무딩용 이웃 목록: 각 점 → 삼각망으로 연결된 점들 (고정이라 한 번만 계산)
const ADJ: number[][] = (() => {
  const adj: number[][] = [];
  for (const [a, b] of FACE_MESH_EDGES) {
    (adj[a] ||= []).push(b);
    (adj[b] ||= []).push(a);
  }
  return adj;
})();

// Taubin 스무딩 — 이웃 평균 쪽으로 당겼다(λ) 살짝 밀어(μ) 부피를 유지하며 노이즈만 줄임.
function taubinSmooth(arr: Vec3[], iters = 2): Vec3[] {
  const lambda = 0.33, mu = -0.34;
  let cur = arr.map((p) => ({ x: p.x, y: p.y, z: p.z }));
  const pass = (f: number) => {
    cur = cur.map((p, i) => {
      const nb = ADJ[i];
      if (!nb || nb.length === 0) return p; // 이웃 없는 점(홍채 등)은 그대로
      let sx = 0, sy = 0, sz = 0;
      for (const j of nb) { const q = cur[j]; if (q) { sx += q.x; sy += q.y; sz += q.z; } }
      const k = nb.length;
      return { x: p.x + f * (sx / k - p.x), y: p.y + f * (sy / k - p.y), z: p.z + f * (sz / k - p.z) };
    });
  };
  for (let it = 0; it < iters; it++) { pass(lambda); pass(mu); }
  return cur;
}

// 롤 보정(똑바로 세우기) + 스무딩까지 끝낸 점 배열을 돌려줍니다.
export function prepareFacePoints(points: LandmarkPoint[]): Vec3[] {
  const f = points[10], c = points[152], o = points[1]; // 이마·턱·코끝
  let rolled: Vec3[];
  if (!f || !c || !o) {
    rolled = points.map((p) => ({ x: p.x, y: p.y, z: p.z ?? 0 }));
  } else {
    const roll = Math.atan2(c.x - f.x, c.y - f.y); // 똑바로(아래) 기준에서 벗어난 각
    const ca = Math.cos(roll), sa = Math.sin(roll);
    rolled = points.map((p) => ({
      x: o.x + (p.x - o.x) * ca - (p.y - o.y) * sa,
      y: o.y + (p.x - o.x) * sa + (p.y - o.y) * ca,
      z: p.z ?? 0,
    }));
  }
  return taubinSmooth(rolled);
}
