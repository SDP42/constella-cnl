import { Edges } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { Suspense, useMemo, useRef } from 'react'
import * as THREE from 'three'

/**
 * The Revenue Machine — Bauhaus kinetic sculpture (design-system/constella/MASTER.md).
 *  stage 0  silos      : each division's parts lie in its own pile (what CNL's teams see today)
 *  stage 1  machine    : the parts assemble into one balanced construction (the account twin)
 *  stage 2  running    : annuity rings spin, the long tail of SKUs orbits (solution + recurring)
 */

type Kind = 'cube' | 'sphere' | 'cone' | 'cylinder' | 'ring' | 'beam'
type Div = 'EB' | 'HON' | 'FMSG' | 'FMCT' | 'SVC'
interface Part {
  kind: Kind
  div: Div
  size: number
  silo: THREE.Vector3
  siloRot: THREE.Euler
  siloScale: number
  built: THREE.Vector3
  builtRot: THREE.Euler
  delay: number
  orbit?: { r: number; y: number; speed: number; phase: number }
}

export const DIV_HEX: Record<Div, string> = { EB: '#1040c0', HON: '#f5b700', FMSG: '#d02020', FMCT: '#121212', SVC: '#1e8f4e' }
const PILES: Record<Div, [number, number]> = { EB: [-2.4, -0.7], HON: [2.4, -0.5], FMSG: [-1.5, 1.7], FMCT: [1.6, 1.8], SVC: [0.1, -2.3] }
const FLOOR = -1.6

function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }
}

function buildParts(): Part[] {
  const r = rng(11)
  const parts: Part[] = []
  const pileCount: Record<Div, number> = { EB: 0, HON: 0, FMSG: 0, FMCT: 0, SVC: 0 }
  const add = (kind: Kind, div: Div, size: number, built: [number, number, number], builtRot: [number, number, number] = [0, 0, 0]) => {
    const [px, pz] = PILES[div]
    const n = pileCount[div]++
    const layer = Math.floor(n / 3)
    const flat = kind === 'ring'
    const siloSize = (kind === 'ring' ? Math.min(size, 0.5) : kind === 'beam' ? 0.5 : size) * 0.62
    const silo = new THREE.Vector3(px + (r() - 0.5) * 1.0, FLOOR + (flat ? 0.06 : siloSize * 0.5) + layer * 0.34, pz + (r() - 0.5) * 1.0)
    parts.push({
      kind, div, size, silo, siloScale: siloSize / (kind === 'beam' ? 1 : size),
      siloRot: flat ? new THREE.Euler(Math.PI / 2, 0, r() * Math.PI) : new THREE.Euler((r() - 0.5) * 0.3, r() * Math.PI, (r() - 0.5) * 0.3),
      built: new THREE.Vector3(...built), builtRot: new THREE.Euler(...builtRot), delay: r() * 0.35,
    })
  }
  // —— the construction (asymmetric, balanced) ——
  add('cube', 'EB', 0.9, [-0.55, -1.15, 0.5]); add('cube', 'EB', 0.9, [0.45, -1.15, 0.45])
  add('cube', 'EB', 0.9, [-0.5, -1.15, -0.5]); add('cube', 'EB', 0.7, [0.4, -1.25, -0.5])
  add('beam', 'EB', 1, [0.95, 1.05, 0], [0, 0, 0.12]); add('cube', 'EB', 0.45, [2.15, 1.45, 0], [0.4, 0.5, 0])
  add('cylinder', 'FMCT', 0.8, [0, -0.3, 0]); add('cylinder', 'FMCT', 0.8, [0, 0.5, 0]); add('cylinder', 'FMCT', 0.6, [0, 1.2, 0])
  add('cylinder', 'FMCT', 0.4, [-1.45, -1.3, 1.0]); add('cylinder', 'FMCT', 0.35, [1.5, -1.35, 1.1])
  add('sphere', 'HON', 1.1, [0, 2.15, 0]); add('sphere', 'HON', 0.45, [2.15, 2.0, 0]); add('sphere', 'HON', 0.4, [-1.6, 0.55, -0.4])
  add('sphere', 'HON', 0.3, [1.2, -0.2, 1.3])
  add('cone', 'FMSG', 0.7, [-1.6, 1.25, -0.4], [0, 0, 0.15]); add('cone', 'FMSG', 0.55, [-1.3, -1.2, 1.0], [0, 0, 0])
  add('cone', 'FMSG', 0.5, [1.2, 0.35, 1.3], [Math.PI, 0, 0]); add('cone', 'FMSG', 0.4, [0.0, 3.05, 0], [0, 0, 0])
  add('ring', 'SVC', 1.55, [0, 0.0, 0], [Math.PI / 2, 0, 0]); add('ring', 'SVC', 1.15, [0, 1.0, 0], [Math.PI / 2 - 0.25, 0, 0.1])
  add('ring', 'SVC', 0.8, [0, 2.15, 0], [0.4, 0, 0.9])
  // —— long tail of SKUs: small parts that pile in silos, then orbit the machine ——
  const divs: Div[] = ['EB', 'HON', 'FMSG', 'FMCT', 'SVC']
  const kinds: Record<Div, Kind> = { EB: 'cube', HON: 'sphere', FMSG: 'cone', FMCT: 'cylinder', SVC: 'ring' }
  for (let i = 0; i < 40; i++) {
    const d = divs[i % 5]
    add(kinds[d], d, 0.16 + r() * 0.1, [0, 0, 0])
    parts[parts.length - 1].orbit = { r: 2.6 + r() * 1.4, y: -0.6 + r() * 2.6, speed: 0.15 + r() * 0.25, phase: r() * Math.PI * 2 }
  }
  return parts
}

function geometryFor(kind: Kind, size: number): THREE.BufferGeometry {
  switch (kind) {
    case 'cube': return new THREE.BoxGeometry(size, size, size)
    case 'beam': return new THREE.BoxGeometry(2.7, 0.18, 0.18)
    case 'sphere': return new THREE.SphereGeometry(size / 2, 40, 28)
    case 'cone': return new THREE.ConeGeometry(size / 2, size * 1.1, 32)
    case 'cylinder': return new THREE.CylinderGeometry(size / 2.2, size / 2.2, size, 36)
    case 'ring': return new THREE.TorusGeometry(size, Math.max(0.035, size * 0.045), 16, 96)
  }
}

const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)
const clamp01 = (x: number) => Math.min(1, Math.max(0, x))

type StageSrc = number | React.MutableRefObject<number>
const read = (s: StageSrc) => (typeof s === 'number' ? s : s.current)

function Rig({ stage, offsetX }: { stage: StageSrc; offsetX: number }) {
  const parts = useMemo(buildParts, [])
  const meshes = useRef<(THREE.Mesh | null)[]>([])
  const root = useRef<THREE.Group>(null)
  const geos = useMemo(() => parts.map((p) => geometryFor(p.kind, p.size)), [parts])
  const mats = useMemo(
    () => parts.map((p) => new THREE.MeshStandardMaterial({ color: DIV_HEX[p.div], roughness: p.div === 'HON' ? 0.35 : 0.62, metalness: p.div === 'HON' ? 0.15 : 0 })),
    [parts],
  )
  const smooth = useRef(0)
  const q1 = useMemo(() => new THREE.Quaternion(), [])
  const q2 = useMemo(() => new THREE.Quaternion(), [])

  useFrame((state, dt) => {
    smooth.current += (read(stage) - smooth.current) * Math.min(1, dt * 3)
    const st = smooth.current
    const t = state.clock.elapsedTime
    parts.forEach((p, i) => {
      const m = meshes.current[i]
      if (!m) return
      const k = ease(clamp01((clamp01(st) - p.delay) / (1 - p.delay)))
      const run = clamp01(st - 1)
      let target = p.built
      if (p.orbit) {
        const a = p.orbit.phase + t * p.orbit.speed * (0.3 + run)
        target = new THREE.Vector3(Math.cos(a) * p.orbit.r, p.orbit.y + Math.sin(a * 2) * 0.15, Math.sin(a) * p.orbit.r)
      }
      m.position.lerpVectors(p.silo, target, k)
      m.scale.setScalar(THREE.MathUtils.lerp(p.siloScale, 1, k))
      // lift in an arc while travelling so parts don't clip through each other
      m.position.y += Math.sin(k * Math.PI) * 1.2 * (1 - (p.orbit ? 0.5 : 0))
      q1.setFromEuler(p.siloRot)
      q2.setFromEuler(p.builtRot)
      m.quaternion.slerpQuaternions(q1, q2, k)
      if (p.kind === 'ring' && !p.orbit) m.rotateZ(t * (0.15 + run * 1.4) * (i % 2 ? 1 : -1))
      if (p.orbit) m.rotation.set(t * 0.6 + i, t * 0.4, 0)
    })
    if (root.current) {
      root.current.rotation.y += (state.pointer.x * 0.5 + st * 0.35 - root.current.rotation.y) * Math.min(1, dt * 2)
      root.current.rotation.x += (-state.pointer.y * 0.12 - root.current.rotation.x) * Math.min(1, dt * 2)
    }
  })

  return (
    <group ref={root} position={[offsetX, 0, 0]}>
      {parts.map((p, i) => (
        <mesh key={i} ref={(el) => { meshes.current[i] = el }} geometry={geos[i]} material={mats[i]} castShadow receiveShadow>
          <Edges threshold={28} color="#121212" lineWidth={p.orbit ? 1 : 1.6} />
        </mesh>
      ))}
    </group>
  )
}

export function Machine({ stage = 1, className, offsetX = 0 }: { stage?: StageSrc; className?: string; offsetX?: number }) {
  return (
    <div className={className}>
      <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 2.2, 13.5], fov: 34 }} gl={{ antialias: true, alpha: true }}>
        <Suspense fallback={null}>
          <ambientLight intensity={1.1} />
          <hemisphereLight args={['#ffffff', '#d8d0bf', 0.6]} />
          <directionalLight position={[5, 9, 6]} intensity={2.1} castShadow shadow-mapSize={[2048, 2048]}
            shadow-camera-left={-8} shadow-camera-right={8} shadow-camera-top={8} shadow-camera-bottom={-8} shadow-bias={-0.0004} />
          <Rig stage={stage} offsetX={offsetX} />
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, FLOOR, 0]} receiveShadow>
            <planeGeometry args={[60, 40]} />
            <shadowMaterial opacity={0.22} color="#121212" />
          </mesh>
        </Suspense>
      </Canvas>
    </div>
  )
}
