import { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Text from './AppText';
import { LandmarkPoint } from '../api';
import { FACE_MESH_EDGES } from '../faceMeshTesselation';
import { colors } from '../theme';

// 3D 얼굴 메시 뷰어입니다.
// 검출된 점(x, y, z)을 3D로 회전시키고, MediaPipe 공식 삼각망(정해진 연결)으로 '얼굴 면(mesh)'을 그립니다.
// 깊이 강조 + 원근감으로 입체적으로 보이게 합니다. (드래그 회전 / 자동 회전)

const BOX = 300;
const Z_AMP = 1.7; // 깊이(z) 강조 배수 — 코 등 돌출이 잘 보이도록
const FOCAL = BOX * 1.6; // 원근 초점거리

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
  const [yaw, setYaw] = useState(0.5);
  const [pitch, setPitch] = useState(0.05);
  const dragging = useRef(false);
  const start = useRef({ yaw: 0.5, pitch: 0.05 });

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

  // MediaPipe 공식 삼각망 연결(정해진 그물망). 점 개수 안에 드는 에지만 사용합니다.
  const edges = useMemo(() => {
    const n = pts.length;
    return FACE_MESH_EDGES.filter(([a, b]) => a < n && b < n);
  }, [pts.length]);

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

  // 모든 점을 회전·원근 투영
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
      return { x: BOX / 2 + xr * persp, y: BOX / 2 + yr * persp, z: zr2 };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pts, geo, yaw, pitch]);

  // 메시 선을 앞쪽/뒤쪽으로 나눠 그려서(뒤는 흐리게) 입체감을 줍니다.
  let frontPath = '';
  let backPath = '';
  for (const [a, b] of edges) {
    const pa = proj[a], pb = proj[b];
    const seg = `M${pa.x.toFixed(1)} ${pa.y.toFixed(1)}L${pb.x.toFixed(1)} ${pb.y.toFixed(1)}`;
    if ((pa.z + pb.z) / 2 <= 0) frontPath += seg; // 카메라 쪽(앞면)
    else backPath += seg;
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.box} {...pan.panHandlers}>
        <Svg width={BOX} height={BOX}>
          {/* 뒤쪽 면 (흐리게) */}
          <Path d={backPath} stroke={colors.amber600} strokeWidth={0.5} fill="none" opacity={0.25} />
          {/* 앞쪽 면 (또렷하게) */}
          <Path d={frontPath} stroke={colors.amber400} strokeWidth={0.8} fill="none" opacity={0.9} />
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
