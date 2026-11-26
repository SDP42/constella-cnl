import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Bloom, ChromaticAberration, EffectComposer, Noise, Vignette } from '@react-three/postprocessing'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useCanvasKick } from './useCanvasKick'

/**
 * One particle system that carries the whole story (motion spec from the design research agent):
 *   stage 0 scatter (deep space) → 1 silos (5 division clusters) → 2 twin (sphere + ring)
 *   → 3 solution (3 cards on an arc) → 4 annuity (3 orbiting rings) → 5 star (the call to action)
 * The vertex shader morphs between consecutive stages with a per-particle delay, so shapes "flock".
 * `stage` is a ref (0..5) written by the scroll handler; nothing here re-renders React.
 */

const N = 12000
const DIV = ['#5f86b0', '#e0b13e', '#e0694e', '#9a72a3', '#5aa57c'] // brighter inks for night + bloom

function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }
}
const gauss = (r: () => number) => Math.sqrt(-2 * Math.log(r() + 1e-9)) * Math.cos(2 * Math.PI * r())

function buildStages() {
  const r = rng(42)
  const S = Array.from({ length: 6 }, () => new Float32Array(N * 3))
  const color = new Float32Array(N * 3)
  const seed = new Float32Array(N)
  const c = new THREE.Color()
  for (let i = 0; i < N; i++) {
    const d = i % 5
    const set = (k: number, x: number, y: number, z: number) => { S[k][i * 3] = x; S[k][i * 3 + 1] = y; S[k][i * 3 + 2] = z }
    // 0 scatter: a deep tunnel behind the camera's target
    const a = r() * Math.PI * 2
    const rad = 6 + r() * 14
    set(0, Math.cos(a) * rad, Math.sin(a) * rad * 0.6, -20 - r() * 40)
    // 1 silos: five clusters, one per division, spread on X
    set(1, (d - 2) * 1.9 + gauss(r) * 0.36, gauss(r) * 0.42 + (d % 2 ? 0.25 : -0.25), gauss(r) * 0.42)
    // 2 twin: 72% sphere shell, 28% equatorial ring
    if (r() < 0.72) {
      const u = r() * 2 - 1, th = r() * Math.PI * 2, s = Math.sqrt(1 - u * u), R = 1.55 + gauss(r) * 0.03
      set(2, s * Math.cos(th) * R, u * R, s * Math.sin(th) * R)
    } else {
      const th = r() * Math.PI * 2, R = 2.55 + gauss(r) * 0.05
      set(2, Math.cos(th) * R, gauss(r) * 0.03, Math.sin(th) * R)
    }
    // 3 solution: three rounded cards on a gentle arc (border denser than fill)
    {
      const k = i % 3, cx = (k - 1) * 3.1, cz = k === 1 ? 0.6 : -0.3, rot = (k - 1) * -0.35
      let x: number, y: number
      if (r() < 0.45) {
        const t = r() * 4
        x = t < 1 ? -1.1 + t * 2.2 : t < 2 ? 1.1 : t < 3 ? 1.1 - (t - 2) * 2.2 : -1.1
        y = t < 1 ? 0.75 : t < 2 ? 0.75 - (t - 1) * 1.5 : t < 3 ? -0.75 : -0.75 + (t - 3) * 1.5
      } else { x = (r() - 0.5) * 2.0; y = (r() - 0.5) * 1.3 }
      set(3, cx + x * Math.cos(rot), y, cz + x * Math.sin(rot) + gauss(r) * 0.02)
    }
    // 4 annuity: three tilted rings around the card centres
    {
      const k = i % 3, th = r() * Math.PI * 2, R = 1.05 + gauss(r) * 0.03, tilt = 1.1
      const x = Math.cos(th) * R, z0 = Math.sin(th) * R
      set(4, (k - 1) * 3.1 + x, z0 * Math.sin(tilt) * 0.5, z0 * Math.cos(tilt) * 0.5)
    }
    // 5 star: five-point star outline + soft core
    {
      const t = r(), pts = 10, j = Math.floor(t * pts), f = t * pts - j
      const ang = (n: number) => -Math.PI / 2 + (n * Math.PI * 2) / pts
      const rr = (n: number) => (n % 2 ? 0.95 : 2.4)
      if (r() < 0.8) {
        const x0 = Math.cos(ang(j)) * rr(j), y0 = -Math.sin(ang(j)) * rr(j)
        const x1 = Math.cos(ang(j + 1)) * rr(j + 1), y1 = -Math.sin(ang(j + 1)) * rr(j + 1)
        set(5, x0 + (x1 - x0) * f + gauss(r) * 0.025, y0 + (y1 - y0) * f + gauss(r) * 0.025, gauss(r) * 0.05)
      } else set(5, gauss(r) * 0.35, gauss(r) * 0.35, gauss(r) * 0.2)
    }
    c.set(DIV[d])
    color.set([c.r, c.g, c.b], i * 3)
    seed[i] = r()
  }
  return { S, color, seed }
}

const vert = /* glsl */ `
  uniform float uStage;
  uniform float uTime;
  uniform float uPx;
  attribute vec3 aS0; attribute vec3 aS1; attribute vec3 aS2; attribute vec3 aS3; attribute vec3 aS4; attribute vec3 aS5;
  attribute vec3 aColor;
  attribute float aSeed;
  varying vec3 vColor;
  varying float vAlpha;
  vec3 pick(float k) {
    if (k < 0.5) return aS0; if (k < 1.5) return aS1; if (k < 2.5) return aS2;
    if (k < 3.5) return aS3; if (k < 4.5) return aS4; return aS5;
  }
  void main() {
    float k0 = floor(uStage);
    float f = uStage - k0;
    // per-particle delay => flocking morph instead of a rigid tween
    float d = aSeed * 0.45;
    float t = smoothstep(d, d + 0.55, f);
    vec3 p = mix(pick(k0), pick(min(k0 + 1.0, 5.0)), t);
    // transit swirl while between shapes
    float mid = sin(t * 3.14159);
    p += vec3(sin(aSeed * 40.0 + uTime), cos(aSeed * 31.0 + uTime * 0.8), sin(aSeed * 17.0)) * mid * 0.35;
    // living shimmer
    p += vec3(sin(uTime * 0.7 + aSeed * 60.0), cos(uTime * 0.6 + aSeed * 50.0), 0.0) * 0.015;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = (1.6 + aSeed * 2.2) * uPx * (8.0 / -mv.z);
    // colour: division inks while siloed, warming to CNL gold as they fuse
    vec3 gold = vec3(1.0, 0.78, 0.25);
    float warm = smoothstep(1.2, 2.2, uStage);
    vColor = mix(aColor, mix(gold, vec3(1.0, 0.93, 0.75), aSeed * 0.6), warm);
    vAlpha = 0.55 + aSeed * 0.45;
  }
`
const frag = /* glsl */ `
  varying vec3 vColor; varying float vAlpha;
  void main() {
    float r = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, r);
    gl_FragColor = vec4(vColor * (0.7 + pow(a, 3.0) * 1.6), a * vAlpha);
  }
`

function Particles({ stage }: { stage: React.MutableRefObject<number> }) {
  const mat = useRef<THREE.ShaderMaterial>(null)
  const group = useRef<THREE.Group>(null)
  const smooth = useRef(0)
  const { gl } = useThree()
  const geo = useMemo(() => {
    const { S, color, seed } = buildStages()
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(S[1].slice(), 3))
    S.forEach((arr, k) => g.setAttribute(`aS${k}`, new THREE.BufferAttribute(arr, 3)))
    g.setAttribute('aColor', new THREE.BufferAttribute(color, 3))
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 80)
    return g
  }, [])
  const uniforms = useMemo(() => ({ uStage: { value: 0 }, uTime: { value: 0 }, uPx: { value: Math.min(gl.getPixelRatio(), 2) } }), [gl])

  useFrame((state, dt) => {
    smooth.current += (stage.current - smooth.current) * (1 - Math.exp(-5 * dt))
    const s = smooth.current
    if (mat.current) {
      mat.current.uniforms.uStage.value = s
      mat.current.uniforms.uTime.value += dt
    }
    if (group.current) {
      // twin orbits, rings spin, star breathes
      // scroll-driven 40° orbit around the twin; every other scene faces the camera square-on
      const u = Math.min(1, Math.max(0, (s - 1.4) / 1.4))
      group.current.rotation.y = 0.7 * Math.sin(Math.PI * u)
      group.current.rotation.x = state.pointer.y * 0.08
      group.current.rotation.z = THREE.MathUtils.smoothstep(s, 3.6, 4.2) * Math.sin(state.clock.elapsedTime * 0.5) * 0.08
    }
    // camera: zoom-through at every transition, settle at each stage
    const between = Math.sin(Math.PI * (s - Math.floor(s)))
    const cam = state.camera
    const targetZ = 9 - between * 3.2 + (s < 1 ? (1 - s) * 2 : 0)
    cam.position.x += (state.pointer.x * 0.6 - cam.position.x) * (1 - Math.exp(-3 * dt))
    cam.position.z += (targetZ - cam.position.z) * (1 - Math.exp(-4 * dt))
    cam.lookAt(0, 0, 0)
  })

  return (
    <group ref={group} position={[0, -0.75, 0]}>
      <points geometry={geo} frustumCulled={false}>
        <shaderMaterial ref={mat} vertexShader={vert} fragmentShader={frag} uniforms={uniforms} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>
    </group>
  )
}

export function Constellation({ stage, className }: { stage: React.MutableRefObject<number>; className?: string }) {
  useCanvasKick()
  const ca = useMemo(() => new THREE.Vector2(0.0008, 0.0008), [])
  return (
    <div className={className}>
      <Canvas dpr={[1, 1.75]} camera={{ position: [0, 0, 11], fov: 45 }} gl={{ antialias: false, powerPreference: 'high-performance' }}>
        <color attach="background" args={['#0c0a09']} />
        <Particles stage={stage} />
        <EffectComposer multisampling={0}>
          <Bloom mipmapBlur intensity={1.1} luminanceThreshold={0.35} luminanceSmoothing={0.3} />
          <ChromaticAberration offset={ca} />
          <Noise opacity={0.035} />
          <Vignette offset={0.25} darkness={0.8} />
        </EffectComposer>
      </Canvas>
    </div>
  )
}
