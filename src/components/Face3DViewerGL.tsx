import { useRef } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';
import { GLView, ExpoWebGLRenderingContext } from 'expo-gl';
import * as THREE from 'three';
import Text from './AppText';
import { LandmarkPoint } from '../api';
import { buildDenseFaceGeometry } from '../faceGeom';
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

    // expo-gl 컨텍스트를 three.js 렌더러에 연결.
    // 웹에서는 실제 canvas(gl.canvas)를, 네이티브에서는 가짜 canvas 객체를 씁니다.
    const canvas = (gl as unknown as { canvas?: HTMLCanvasElement }).canvas ?? ({
      width, height, style: {},
      addEventListener: () => {}, removeEventListener: () => {},
      clientWidth: width, clientHeight: height,
    } as unknown as HTMLCanvasElement);
    const renderer = new THREE.WebGLRenderer({
      canvas,
      context: gl as unknown as WebGLRenderingContext,
      antialias: true,
    });
    renderer.setSize(width, height, false);
    renderer.setClearColor(0x0d0d10, 1);
    // 자연스러운 색·명암(필름 톤매핑 + sRGB)
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(0, 0, 2.9);

    // 3점 조명 + 반구광(하늘/땅 자연광)으로 입체감을 살립니다.
    scene.add(new THREE.HemisphereLight(0xfff6e6, 0x1a1208, 0.55));
    const key = new THREE.DirectionalLight(0xfff1d6, 1.25);   // 주광(위-앞-왼쪽)
    key.position.set(-0.7, 0.9, 1.2);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xbfd4ff, 0.35);  // 보조광(반대쪽, 차갑게)
    fill.position.set(1.0, 0.1, 0.6);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffb454, 0.75);   // 뒤쪽 앰버 림라이트(윤곽 강조)
    rim.position.set(0.2, -0.4, -1.2);
    scene.add(rim);

    // 검출점 → 조밀 3D 지오메트리(세분화+스무딩). 중심정렬·정규화합니다.
    const dense = buildDenseFaceGeometry(points, 2);
    const prep = dense.verts;
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
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setIndex(dense.indices);
    geo.computeVertexNormals(); // 부드러운 셰이딩용 법선

    const mat = new THREE.MeshStandardMaterial({
      color: 0xf2a63a, roughness: 0.62, metalness: 0.18,
      emissive: 0x2a1a06, emissiveIntensity: 0.35, // 살짝 은은한 골드 발광
      side: THREE.DoubleSide, flatShading: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    scene.add(mesh);

    const animate = () => {
      requestAnimationFrame(animate);
      if (!rot.current.dragging) rot.current.yaw += 0.005; // 자동 회전(부드럽게)
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
