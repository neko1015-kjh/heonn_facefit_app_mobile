// 3D 얼굴 형상 준비(공용) — 검출된 478점을 3D로 그리기 좋게 다듬습니다.
// ① 얼굴을 똑바로 세우고(roll 보정) ② 삼각망 이웃 기준 Taubin 스무딩으로 노이즈를 줄입니다.
// SVG 뷰어(웹)와 three.js 뷰어(앱)가 함께 씁니다.
import { LandmarkPoint } from './api';
import { FACE_MESH_EDGES } from './faceMeshTesselation';
import { FACE_MESH_TRIS } from './faceMeshTriangles';

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

// ── 조밀화(세분화) ─────────────────────────────────────────────
// 각 삼각형을 네 개로 쪼개 정점·면을 늘립니다(midpoint subdivision).
// 이어서 스무딩하면 곡면이 부드러워져 Loop 세분화에 가까운 매끈한 표면이 됩니다.
// ※ 새 검출/모델 없이 기존 점을 보간하는 방식이라 라이선스 안전합니다.
function subdivideOnce(verts: Vec3[], tris: number[][]): { verts: Vec3[]; tris: number[][] } {
  const out = verts.map((v) => ({ x: v.x, y: v.y, z: v.z }));
  const cache = new Map<string, number>();
  const midpoint = (a: number, b: number): number => {
    const key = a < b ? a + '_' + b : b + '_' + a;
    const hit = cache.get(key);
    if (hit !== undefined) return hit;
    const va = out[a], vb = out[b];
    const idx = out.length;
    out.push({ x: (va.x + vb.x) / 2, y: (va.y + vb.y) / 2, z: (va.z + vb.z) / 2 });
    cache.set(key, idx);
    return idx;
  };
  const newTris: number[][] = [];
  for (const [a, b, c] of tris) {
    const ab = midpoint(a, b), bc = midpoint(b, c), ca = midpoint(c, a);
    newTris.push([a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]);
  }
  return { verts: out, tris: newTris };
}

// 삼각형 연결로 이웃을 만들어 Taubin 스무딩(세분화된 메시용).
function smoothWithTris(verts: Vec3[], tris: number[][], iters = 1): Vec3[] {
  const adj: Set<number>[] = verts.map(() => new Set<number>());
  for (const [a, b, c] of tris) {
    adj[a].add(b); adj[a].add(c);
    adj[b].add(a); adj[b].add(c);
    adj[c].add(a); adj[c].add(b);
  }
  const nb = adj.map((s) => Array.from(s));
  let cur = verts.map((v) => ({ x: v.x, y: v.y, z: v.z }));
  const pass = (f: number) => {
    cur = cur.map((p, i) => {
      const ns = nb[i];
      if (!ns.length) return p;
      let sx = 0, sy = 0, sz = 0;
      for (const j of ns) { sx += cur[j].x; sy += cur[j].y; sz += cur[j].z; }
      const k = ns.length;
      return { x: p.x + f * (sx / k - p.x), y: p.y + f * (sy / k - p.y), z: p.z + f * (sz / k - p.z) };
    });
  };
  for (let it = 0; it < iters; it++) { pass(0.33); pass(-0.34); }
  return cur;
}

// 조밀한 3D 얼굴 지오메트리(정점 + 삼각형 인덱스)를 만듭니다.
// levels: 세분화 단계(1=약 3.6천 면, 2=약 1.4만 면). 기본 2.
export function buildDenseFaceGeometry(points: LandmarkPoint[], levels = 2): { verts: Vec3[]; indices: number[] } {
  let verts = prepareFacePoints(points);
  let tris: number[][] = FACE_MESH_TRIS
    .filter((t) => t[0] < verts.length && t[1] < verts.length && t[2] < verts.length)
    .map((t) => [t[0], t[1], t[2]]);
  for (let l = 0; l < levels; l++) {
    const sub = subdivideOnce(verts, tris);
    verts = smoothWithTris(sub.verts, sub.tris, 1);
    tris = sub.tris;
  }
  const indices: number[] = [];
  for (const t of tris) { indices.push(t[0], t[1], t[2]); }
  return { verts, indices };
}
