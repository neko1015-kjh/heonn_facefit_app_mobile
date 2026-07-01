import { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Text from './AppText';
import { LandmarkPoint } from '../api';
import { FACE_MESH_EDGES } from '../faceMeshTesselation';
import { FACE_MESH_TRIS } from '../faceMeshTriangles';
import { colors } from '../theme';

// 3D 얼굴 메시 뷰어입니다.
// 검출된 점(x, y, z)을 3D로 회전시키고, MediaPipe 표준 삼각형(면)으로 얼굴을 '솔리드'하게 칠합니다.
// 깊이·법선 셰이딩 + 뒷면 숨김 + 원근감으로 입체적인 얼굴로 보이게 합니다. (드래그 회전 / 자동 회전)

const BOX = 300;
const Z_AMP = 1.0; // 깊이(z) 배수 — MediaPipe z는 x축과 비슷한 실제 비율이라 1.0이 실물에 맞음(과장하면 코가 너무 깊어 보임)
const FOCAL = BOX * 1.6; // 원근 초점거리
const SHADE_BUCKETS = 12; // 밝기 단계 수(면을 이 단계로 묶어 빠르게 그림)

// 빛 방향(뷰 공간): 위-앞쪽에서 비추는 광원. z<0 = 카메라 쪽.
const LX = -0.35, LY = -0.52, LZ = -0.78;
const LLEN = Math.hypot(LX, LY, LZ);

// 밝기 t(0~1) → 앰버 계열 색. 어두운 갈색앰버 → 밝은 골드.
function shadeColor(t: number): string {
  const r = Math.round(38 + (255 - 38) * t);
  const g = Math.round(24 + (208 - 24) * t);
  const b = Math.round(6 + (126 - 6) * t);
  return `rgb(${r},${g},${b})`;
}

// 스무딩(표면 매끈하게)에 쓰는 이웃 목록: 각 점 → 삼각망으로 연결된 점들.
// 삼각망은 고정이라 앱 시작 시 한 번만 만들어 둡니다.
const ADJ: number[][] = (() => {
  const adj: number[][] = [];
  for (const [a, b] of FACE_MESH_EDGES) {
    (adj[a] ||= []).push(b);
    (adj[b] ||= []).push(a);
  }
  return adj;
})();

// Taubin 스무딩 — 이웃 평균 쪽으로 당겼다(λ) 살짝 밀어(μ) 부피를 유지하며 노이즈만 줄입니다.
function taubinSmooth(arr: LandmarkPoint[], iters = 2): LandmarkPoint[] {
  const lambda = 0.33, mu = -0.34;
  let cur = arr.map((p) => ({ x: p.x, y: p.y, z: p.z ?? 0 }));
  const pass = (f: number) => {
    cur = cur.map((p, i) => {
      const nb = ADJ[i];
      if (!nb || nb.length === 0) return p; // 이웃 없는 점(홍채 등)은 그대로
      let sx = 0, sy = 0, sz = 0;
      for (const j of nb) { const q = cur[j]; if (q) { sx += q.x; sy += q.y; sz += q.z ?? 0; } }
      const k = nb.length;
      return {
        x: p.x + f * (sx / k - p.x),
        y: p.y + f * (sy / k - p.y),
        z: p.z + f * (sz / k - p.z),
      };
    });
  };
  for (let it = 0; it < iters; it++) { pass(lambda); pass(mu); }
  return cur;
}

type Props = {
  points: LandmarkPoint[];
};

export default function Face3DViewer({ points }: Props) {
  const [yaw, setYaw] = useState(0.3);
  const [pitch, setPitch] = useState(0.04);
  const dragging = useRef(false);
  const start = useRef({ yaw: 0.3, pitch: 0.04 });

  // [각도 보정 반영] 점수 계산과 똑같이, 얼굴을 똑바로 세운(roll 보정) 좌표로 3D를 그립니다.
  // 이마(10)→턱(152) 축의 기울기를 구해 코끝(1) 기준으로 회전시켜 펴 줍니다.
  const pts = useMemo(() => {
    const f = points[10], c = points[152], o = points[1];
    if (!f || !c || !o) return points;
    const roll = Math.atan2(c.x - f.x, c.y - f.y); // 똑바로(아래) 기준에서 벗어난 각
    const cosA = Math.cos(roll), sinA = Math.sin(roll);
    const rolled = points.map((p) => ({
      x: o.x + (p.x - o.x) * cosA - (p.y - o.y) * sinA,
      y: o.y + (p.x - o.x) * sinA + (p.y - o.y) * cosA,
      z: p.z ?? 0,
    }));
    // 삼각망 이웃 기준으로 표면을 매끈하게(검출 노이즈 제거)
    return taubinSmooth(rolled);
  }, [points]);

  // 점들의 중심·스케일을 한 번만 계산
  const geo = useMemo(() => {
    if (pts.length === 0) return { cx: 0.5, cy: 0.5, cz: 0, scale: BOX };
    let sx = 0, sy = 0, sz = 0;
    for (const p of pts) {
      sx += p.x; sy += p.y; sz += p.z ?? 0;
    }
    const cx = sx / pts.length, cy = sy / pts.length, cz = sz / pts.length;
    let maxR = 0.0001;
    for (const p of pts) maxR = Math.max(maxR, Math.abs(p.x - cx), Math.abs(p.y - cy));
    return { cx, cy, cz, scale: (BOX * 0.4) / maxR };
  }, [pts]);

  // 자동 회전(드래그 중이 아닐 때)
  useEffect(() => {
    const id = setInterval(() => {
      if (!dragging.current) setYaw((y) => y + 0.045);
    }, 90);
    return () => clearInterval(id);
  }, []);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        dragging.current = true;
        start.current = { yaw, pitch };
      },
      onPanResponderMove: (_e, g) => {
        setYaw(start.current.yaw + g.dx * 0.01);
        setPitch(Math.max(-1.1, Math.min(1.1, start.current.pitch + g.dy * 0.01)));
      },
      onPanResponderRelease: () => { dragging.current = false; },
      onPanResponderTerminate: () => { dragging.current = false; },
    })
  ).current;
  if (!dragging.current) start.current = { yaw, pitch };

  const cosY = Math.cos(yaw), sinY = Math.sin(yaw);
  const cosP = Math.cos(pitch), sinP = Math.sin(pitch);

  // 모든 점을 회전·원근 투영. 화면좌표(x,y)와 뷰공간 3D좌표(vx,vy,vz)를 함께 돌려줍니다.
  // (vx,vy,vz는 법선·뒷면판별·셰이딩 계산에 씁니다.)
  const proj = useMemo(() => {
    return pts.map((p) => {
      const x0 = (p.x - geo.cx) * geo.scale;
      const y0 = (p.y - geo.cy) * geo.scale;
      const z0 = ((p.z ?? 0) - geo.cz) * geo.scale * Z_AMP;
      const xr = x0 * cosY + z0 * sinY;
      const zr = -x0 * sinY + z0 * cosY;
      const yr = y0 * cosP - zr * sinP;
      const zr2 = y0 * sinP + zr * cosP;
      const persp = FOCAL / (FOCAL + zr2);
      return { x: BOX / 2 + xr * persp, y: BOX / 2 + yr * persp, vx: xr, vy: yr, vz: zr2 };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pts, geo, yaw, pitch]);

  // 삼각형(면)을 밝기 단계별로 묶어 솔리드 셰이딩합니다.
  // ① 뷰공간 법선 계산 → ② 메시 중심 기준으로 바깥쪽으로 정렬 → ③ 뒷면 숨김 → ④ 광원 셰이딩.
  // 밝기 단계별 Path 하나로 묶어(면 수백 개 → 12개 Path) 부드럽고 빠르게 그립니다.
  const bucketPaths = useMemo(() => {
    const buckets: string[] = new Array(SHADE_BUCKETS).fill('');
    // 메시 중심(뒷면 판별용)
    let mcx = 0, mcy = 0, mcz = 0;
    for (const q of proj) { mcx += q.vx; mcy += q.vy; mcz += q.vz; }
    const n = proj.length || 1;
    mcx /= n; mcy /= n; mcz /= n;
    for (const [ia, ib, ic] of FACE_MESH_TRIS) {
      const pa = proj[ia], pb = proj[ib], pc = proj[ic];
      if (!pa || !pb || !pc) continue;
      // 두 변의 외적 = 법선
      const e1x = pb.vx - pa.vx, e1y = pb.vy - pa.vy, e1z = pb.vz - pa.vz;
      const e2x = pc.vx - pa.vx, e2y = pc.vy - pa.vy, e2z = pc.vz - pa.vz;
      let nx = e1y * e2z - e1z * e2y;
      let ny = e1z * e2x - e1x * e2z;
      let nz = e1x * e2y - e1y * e2x;
      const nl = Math.hypot(nx, ny, nz) || 1;
      nx /= nl; ny /= nl; nz /= nl;
      // 바깥쪽으로 정렬(삼각형 중심 - 메시 중심 방향과 같게)
      const tcx = (pa.vx + pb.vx + pc.vx) / 3 - mcx;
      const tcy = (pa.vy + pb.vy + pc.vy) / 3 - mcy;
      const tcz = (pa.vz + pb.vz + pc.vz) / 3 - mcz;
      if (nx * tcx + ny * tcy + nz * tcz < 0) { nx = -nx; ny = -ny; nz = -nz; }
      // 뒷면 숨김: 바깥 법선이 카메라(-z) 반대로 향하면 건너뜀
      if (nz > 0.05) continue;
      // 광원 셰이딩(주변광 0.18 + 확산광)
      let br = (nx * LX + ny * LY + nz * LZ) / LLEN;
      br = 0.18 + 0.82 * Math.max(0, br);
      const bi = Math.min(SHADE_BUCKETS - 1, Math.max(0, Math.floor(br * SHADE_BUCKETS)));
      buckets[bi] +=
        `M${pa.x.toFixed(1)} ${pa.y.toFixed(1)}` +
        `L${pb.x.toFixed(1)} ${pb.y.toFixed(1)}` +
        `L${pc.x.toFixed(1)} ${pc.y.toFixed(1)}Z`;
    }
    return buckets;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proj]);

  return (
    <View style={styles.wrap}>
      <View style={styles.box} {...pan.panHandlers}>
        <Svg width={BOX} height={BOX}>
          {/* 밝기 단계별로 면을 칠합니다(어두운 면 먼저 → 밝은 면 위로). 이음새를 메우려 살짝 겹쳐 그림 */}
          {bucketPaths.map((d, i) =>
            d ? (
              <Path
                key={i}
                d={d}
                fill={shadeColor((i + 0.5) / SHADE_BUCKETS)}
                stroke={shadeColor((i + 0.5) / SHADE_BUCKETS)}
                strokeWidth={0.6}
              />
            ) : null
          )}
        </Svg>
      </View>
      <Text style={styles.hint}>← 드래그해서 돌려보세요 · 가만히 두면 자동 회전 →</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  box: {
    width: BOX,
    height: BOX,
    backgroundColor: colors.bg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  hint: { color: colors.textFainter, fontSize: 11, marginTop: 10 },
});
