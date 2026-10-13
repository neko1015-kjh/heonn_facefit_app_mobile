import { useEffect, useRef } from 'react';
import { PanResponder, Platform, StyleSheet, View } from 'react-native';
import { GLView, ExpoWebGLRenderingContext } from 'expo-gl';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import Text from './AppText';
import { LandmarkPoint } from '../api';
import { buildDenseFaceGeometry } from '../faceGeom';
import { colors } from '../theme';

// 진짜 3D 엔진(three.js)로 그리는 얼굴 뷰어입니다. (휴대폰 앱 — expo-gl 사용 / 웹 미리보기도 사용)
// 삼각형 면 + 부드러운 법선 셰이딩 + 조명으로 사실적인 입체 얼굴을 표현합니다.
//
// 안정성(앱 꺼짐·멈춤 방지):
//  · 창을 닫으면(화면에서 사라지면) 그리기 반복을 즉시 멈추고 메모리를 정리합니다.
//    (예전에는 닫은 뒤에도 사라진 그림판에 계속 그려 앱이 꺼지고, 열 때마다 반복이 쌓여 버벅였음)
//  · 휴대폰에서는 무거운 환경 반사맵(PMREM)을 쓰지 않습니다 — 기종에 따라 그래픽 기능 부족으로 멈춤·종료 원인.
//  · 준비 중 오류가 나면 onError로 알려 가벼운 SVG판으로 전환합니다.
const BOX = 300;
const IS_WEB = Platform.OS === 'web';

type Props = { points: LandmarkPoint[]; onError?: () => void };

export default function Face3DViewerGL({ points, onError }: Props) {
  // 회전 상태(렌더 루프에서 읽으므로 ref로 관리). vyaw = 놓았을 때의 관성 속도.
  const rot = useRef({ yaw: 0.25, pitch: 0.0, dragging: false, syaw: 0, spitch: 0, vyaw: 0 });
  // 화면에 떠 있는 동안만 true. 닫히면 그리기 반복이 이 값을 보고 멈춥니다.
  const alive = useRef(true);
  const rafId = useRef<number | null>(null);
  const cleanup = useRef<(() => void) | null>(null);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (rafId.current !== null) cancelAnimationFrame(rafId.current);
      rafId.current = null;
      cleanup.current?.();
      cleanup.current = null;
    };
  }, []);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        rot.current.dragging = true;
        rot.current.syaw = rot.current.yaw;
        rot.current.spitch = rot.current.pitch;
        rot.current.vyaw = 0;
      },
      onPanResponderMove: (_e, g) => {
        const newYaw = rot.current.syaw + g.dx * 0.01;
        rot.current.vyaw = (newYaw - rot.current.yaw); // 최근 이동량 = 관성 속도
        rot.current.yaw = newYaw;
        rot.current.pitch = Math.max(-1.0, Math.min(1.0, rot.current.spitch + g.dy * 0.01));
      },
      onPanResponderRelease: () => { rot.current.dragging = false; },
      onPanResponderTerminate: () => { rot.current.dragging = false; },
    })
  ).current;

  const onContextCreate = (gl: ExpoWebGLRenderingContext) => {
    if (!alive.current) return;
    try {
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
        antialias: IS_WEB,          // 휴대폰은 끔(expo-gl에서 부담·호환성 문제)
      });
      renderer.setSize(width, height, false);
      renderer.setClearColor(0x0d0d10, 1);
      // 자연스러운 색·명암(필름 톤매핑 + sRGB)
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.95;
      renderer.outputColorSpace = THREE.SRGBColorSpace;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
      camera.position.set(0, 0, 2.9);

      // 환경 반사(금속 재질 반사) — 웹에서만. 휴대폰은 조명만으로 그립니다(안정성).
      let envTex: THREE.Texture | null = null;
      if (IS_WEB) {
        try {
          const pmrem = new THREE.PMREMGenerator(renderer);
          envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
          scene.environment = envTex;
          pmrem.dispose();
        } catch (e) {
          // 환경맵 실패해도 조명만으로 렌더(안전)
        }
      }

      // 3점 조명 + 반구광(하늘/땅 자연광)으로 입체감을 살립니다. 반사맵이 없는 휴대폰은 조금 더 밝게.
      const boost = envTex ? 1.0 : 1.25;
      scene.add(new THREE.HemisphereLight(0xfff6e6, 0x1a1208, 0.55 * boost));
      const key = new THREE.DirectionalLight(0xfff1d6, 1.25 * boost);   // 주광(위-앞-왼쪽)
      key.position.set(-0.7, 0.9, 1.2);
      scene.add(key);
      const fill = new THREE.DirectionalLight(0xbfd4ff, 0.35 * boost);  // 보조광(반대쪽, 차갑게)
      fill.position.set(1.0, 0.1, 0.6);
      scene.add(fill);
      const rim = new THREE.DirectionalLight(0xffb454, 0.75);           // 뒤쪽 앰버 림라이트(윤곽 강조)
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

      // 매트한 청동 느낌. 웹은 물리 재질(클리어코트), 휴대폰은 가벼운 표준 재질(셰이더 부담↓).
      const mat: THREE.Material = IS_WEB
        ? new THREE.MeshPhysicalMaterial({
            color: 0xc9862b, roughness: 0.72, metalness: 0.35,
            clearcoat: 0.1, clearcoatRoughness: 0.7,
            envMapIntensity: 0.45,
            side: THREE.DoubleSide, flatShading: false,
          })
        : new THREE.MeshStandardMaterial({
            color: 0xc9862b, roughness: 0.7, metalness: 0.2,
            side: THREE.DoubleSide, flatShading: false,
          });
      const mesh = new THREE.Mesh(geo, mat);
      scene.add(mesh);

      // 닫힐 때 정리할 것들
      cleanup.current = () => {
        geo.dispose();
        mat.dispose();
        envTex?.dispose();
        renderer.dispose();
      };

      const animate = () => {
        if (!alive.current) return;            // 창이 닫혔으면 더 그리지 않음
        if (!rot.current.dragging) {
          if (Math.abs(rot.current.vyaw) > 0.0006) {
            rot.current.yaw += rot.current.vyaw;   // 놓은 뒤 관성으로 계속 돌다가
            rot.current.vyaw *= 0.94;              // 서서히 감속
          } else {
            rot.current.yaw += 0.005;              // 멈추면 은은한 자동 회전
          }
        }
        mesh.rotation.y = rot.current.yaw;
        mesh.rotation.x = rot.current.pitch;
        renderer.render(scene, camera);
        gl.endFrameEXP(); // expo-gl: 프레임 제출
        rafId.current = requestAnimationFrame(animate);
      };
      animate();
    } catch (e) {
      // 이 기기에서 3D 엔진 준비 실패 → 가벼운 SVG판으로 전환
      console.warn('3D 뷰어(three.js) 실패, SVG판으로 전환:', e);
      onError?.();
    }
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
