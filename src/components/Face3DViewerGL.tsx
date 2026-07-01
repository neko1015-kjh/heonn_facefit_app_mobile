import { useRef } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';
import { GLView, ExpoWebGLRenderingContext } from 'expo-gl';
import * as THREE from 'three';
import Text from './AppText';
import { LandmarkPoint } from '../api';
import { FACE_MESH_TRIS } from '../faceMeshTriangles';
import { prepareFacePoints } from '../faceGeom';
import { colors } from '../theme';

// 진짜 3D 엔진(three.js)로 그리는 얼굴 뷰어입니다. (휴대폰 앱 전용 — expo-gl 사용)
// 삼각형 면 + 부드러운 법선 셰이딩 + 조명으로 사실적인 입체 얼굴을 표현합니다.
const BOX = 300;

type Props = { points: LandmarkPoint[] };

export default function Face3DViewerGL({ points }: Props) {
  // 회전 상태(렌더 루프에서 읽으므로 ref로 관리)
  const rot = useRef({ yaw: 0.25, pitch: 0.0, dragging: false, syaw: 0, spitch: 0 });

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        rot.current.dragging = true;
        rot.current.syaw = rot.current.yaw;
        rot.current.spitch = rot.current.pitch;
      },
      onPanResponderMove: (_e, g) => {
        rot.current.yaw = rot.current.syaw + g.dx * 0.01;
        rot.current.pitch = Math.max(-1.0, Math.min(1.0, rot.current.spitch + g.dy * 0.01));
      },
      onPanResponderRelease: () => { rot.current.dragging = false; },
      onPanResponderTerminate: () => { rot.current.dragging = false; },
    })
  ).current;

  const onContextCreate = (gl: ExpoWebGLRenderingContext) => {
    const width = gl.drawingBufferWidth;
    const height = gl.drawingBufferHeight;

    // expo-gl 컨텍스트를 three.js 렌더러에 연결(가짜 canvas 객체 사용)
    const renderer = new THREE.WebGLRenderer({
      canvas: {
        width, height, style: {},
        addEventListener: () => {}, removeEventListener: () => {},
        clientWidth: width, clientHeight: height,
      } as unknown as HTMLCanvasElement,
      context: gl as unknown as WebGLRenderingContext,
      antialias: true,
    });
    renderer.setSize(width, height);
    renderer.setClearColor(0x0d0d10, 1);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0, 2.6);

    // 조명: 은은한 주변광 + 위-앞쪽 주광 + 앰버 림라이트
    scene.add(new THREE.AmbientLight(0xffffff, 0.45));
    const key = new THREE.DirectionalLight(0xfff2d8, 1.15);
    key.position.set(-0.5, 0.7, 1.0);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xffcf8a, 0.4);
    rim.position.set(0.6, -0.3, -0.8);
    scene.add(rim);

    // 검출점 → 3D 지오메트리(면). 롤보정+스무딩된 점을 중심정렬·정규화합니다.
    const prep = prepareFacePoints(points);
    const nPts = prep.length;
    let cx = 0, cy = 0, cz = 0;
    for (const p of prep) { cx += p.x; cy += p.y; cz += p.z; }
    cx /= nPts || 1; cy /= nPts || 1; cz /= nPts || 1;
    let maxR = 1e-4;
    for (const p of prep) maxR = Math.max(maxR, Math.abs(p.x - cx), Math.abs(p.y - cy));
    const s = 1.0 / maxR;
    const positions = new Float32Array(nPts * 3);
    for (let i = 0; i < nPts; i++) {
      positions[3 * i] = (prep[i].x - cx) * s;
      positions[3 * i + 1] = -(prep[i].y - cy) * s;   // 이미지 y(아래로+) → three y(위로+)
      positions[3 * i + 2] = -(prep[i].z - cz) * s;   // 코가 카메라 쪽(+z)으로 돌출
    }
    const indices: number[] = [];
    for (const [a, b, c] of FACE_MESH_TRIS) {
      if (a < nPts && b < nPts && c < nPts) indices.push(a, b, c);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals(); // 부드러운 셰이딩용 법선

    const mat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b, roughness: 0.55, metalness: 0.12,
      side: THREE.DoubleSide, flatShading: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    scene.add(mesh);

    const animate = () => {
      requestAnimationFrame(animate);
      if (!rot.current.dragging) rot.current.yaw += 0.006; // 자동 회전
      mesh.rotation.y = rot.current.yaw;
      mesh.rotation.x = rot.current.pitch;
      renderer.render(scene, camera);
      gl.endFrameEXP(); // expo-gl: 프레임 제출
    };
    animate();
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.box} {...pan.panHandlers}>
        <GLView style={{ width: BOX, height: BOX }} onContextCreate={onContextCreate} />
      </View>
      <Text style={styles.hint}>← 드래그해서 돌려보세요 · 가만히 두면 자동 회전 →</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  box: {
    width: BOX, height: BOX,
    backgroundColor: colors.bg,
    borderRadius: 16, borderWidth: 1, borderColor: colors.border,
    overflow: 'hidden',
  },
  hint: { color: colors.textFainter, fontSize: 11, marginTop: 10 },
});
