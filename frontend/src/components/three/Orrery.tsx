import { ContactShadows, Environment, Html, Lightformer, Line } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { Suspense, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'

/**
 * The account orrery — Constella's core visual metaphor.
 *   sun      = the partner (golden record)
 *   rings    = CNL divisions (EB, HON, FMSG, FMCT, SVC)
 *   planets  = categories the partner buys (lacquered, division ink)
 *   sockets  = whitespace: categories not bought yet (hollow; pulse gold with model probability)
 *   thread   = a solution: gold constellation linking sockets across rings
 *
 * `stage` (0..2, can be a ref for scroll-scrubbing):
 *   0 = silos (rings apart, each team sees only its slice) · 1 = unified twin · 2 = solution drawn
 */

export interface OrreryPlanet {
  id: string
  label: string
  owned: boolean
  p?: number | null
  inSolution?: boolean
}
export interface OrreryRing {
  code: string
  name: string
  color: string
  planets: OrreryPlanet[]
}

export const DEMO_RINGS: OrreryRing[] = [
  { code: 'EB', name: 'Enterprise Business', color: '#2b5d8c', planets: [
    { id: 'ifp', label: 'Interactive panels', owned: true }, { id: 'mon', label: 'Monitors', owned: true },
    { id: 'pc', label: 'Mini PCs', owned: true }, { id: 'proj', label: 'Projectors', owned: true },
    { id: 'sig', label: 'Signage', owned: false, p: 0.12 }] },
  { code: 'HON', name: 'Honeywell Licensing', color: '#c98a00', planets: [
    { id: 'cab', label: 'Structured cabling', owned: false, p: 0.42, inSolution: true },
    { id: 'conn', label: 'Connectivity', owned: false, p: 0.38, inSolution: true },
    { id: 'air', label: 'Air purifiers', owned: false, p: 0.11 }, { id: 'aud', label: 'Audio', owned: false, p: 0.08 }] },
  { code: 'FMSG', name: 'Social-Media Gadgets', color: '#a8326e', planets: [
    { id: 'act', label: 'Action cams', owned: false, p: 0.05 }, { id: 'mem', label: 'Memory', owned: false, p: 0.09 }] },
  { code: 'FMCT', name: 'Consumer Technology', color: '#5b4a9e', planets: [
    { id: 'gpc', label: 'Gaming PCs', owned: true }, { id: 'per', label: 'Peripherals', owned: false, p: 0.21 }] },
  { code: 'SVC', name: 'Services & Annuity', color: '#2e7d5b', planets: [
    { id: 'amc', label: 'Display AMC', owned: false, p: 0.55, inSolution: true },
    { id: 'cert', label: 'Cabling certification', owned: false, p: 0.31, inSolution: true },
    { id: 'daas', label: 'Device-as-a-Service', owned: false, p: 0.18 }] },
]

const RADII = [1.35, 1.95, 2.55, 3.15, 3.75]
// where each ring sits when the company is siloed: spread out across the page, tilted differently
const SILO_POS: [number, number, number][] = [[-3.6, 0.9, -0.6], [3.4, 1.1, 0.0], [-2.4, -1.5, 0.4], [2.6, -1.4, -0.3], [0, 2.1, -1.6]]
const SILO_SCALE = [0.5, 0.42, 0.34, 0.3, 0.27]

const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)
const clamp01 = (x: number) => Math.min(1, Math.max(0, x))

type StageSrc = number | React.MutableRefObject<number>
const readStage = (s: StageSrc) => (typeof s === 'number' ? s : s.current)

const brass = new THREE.MeshPhysicalMaterial({ color: '#b98a3a', metalness: 1, roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.25 })
const darkBrass = new THREE.MeshPhysicalMaterial({ color: '#6f5426', metalness: 1, roughness: 0.45 })

function Planet({ planet, angle, radius, color, stageRef, onHover, hovered, interactive }: {
  planet: OrreryPlanet; angle: number; radius: number; color: string; stageRef: StageSrc
  onHover: (id: string | null) => void; hovered: boolean; interactive: boolean
}) {
  const mesh = useRef<THREE.Mesh>(null)
  const ghost = useRef<THREE.Mesh>(null)
  const mat = useMemo(() => new THREE.MeshPhysicalMaterial({ color, metalness: 0.1, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.08 }), [color])
  const ghostMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#c98a00', wireframe: true, transparent: true, opacity: 0.55 }), [])
  const goldMat = useMemo(() => new THREE.MeshPhysicalMaterial({ color: '#f5b700', metalness: 0.85, roughness: 0.2, emissive: '#7a4f00', emissiveIntensity: 0.25 }), [])
  const size = planet.owned ? 0.17 : 0.13 + (planet.p ?? 0) * 0.12

  useFrame((state) => {
    const st = readStage(stageRef)
    const fill = planet.inSolution ? easeInOut(clamp01(st - 1.25)) : 0
    const pulse = planet.owned ? 0 : (Math.sin(state.clock.elapsedTime * 2.4 + angle * 3) * 0.5 + 0.5) * (planet.p ?? 0)
    if (ghost.current) {
      ghost.current.visible = !planet.owned
      const s = size * (1 + pulse * 0.35) * (hovered ? 1.35 : 1)
      ghost.current.scale.setScalar(s)
      ghost.current.material = fill > 0.5 ? goldMat : ghostMat
      ghostMat.opacity = 0.35 + pulse * 0.6
      ghost.current.rotation.y += 0.01
    }
    if (mesh.current) mesh.current.scale.setScalar(size * (hovered ? 1.25 : 1))
  })

  const x = Math.cos(angle) * radius
  const z = Math.sin(angle) * radius
  return (
    <group position={[x, 0, z]}>
      {/* support rod down to the ring plate, like a real orrery arm */}
      <mesh position={[0, -0.18, 0]} material={darkBrass}>
        <cylinderGeometry args={[0.012, 0.012, 0.36, 6]} />
      </mesh>
      {planet.owned ? (
        <mesh ref={mesh} material={mat} castShadow
          onPointerOver={interactive ? (e) => { e.stopPropagation(); onHover(planet.id) } : undefined}
          onPointerOut={interactive ? () => onHover(null) : undefined}>
          <sphereGeometry args={[1, 48, 48]} />
        </mesh>
      ) : (
        <mesh ref={ghost} material={ghostMat}
          onPointerOver={interactive ? (e) => { e.stopPropagation(); onHover(planet.id) } : undefined}
          onPointerOut={interactive ? () => onHover(null) : undefined}>
          <icosahedronGeometry args={[1, 1]} />
        </mesh>
      )}
      {hovered && (
        <Html center distanceFactor={9} position={[0, 0.42, 0]} style={{ pointerEvents: 'none' }}>
          <div className="whitespace-nowrap rounded-md border border-black/15 bg-[#fbf7ef] px-2.5 py-1.5 text-[11px] leading-tight text-[#17140f] shadow-lg">
            <div className="font-semibold">{planet.label}</div>
            <div className="font-mono text-[10px] text-[#5a5045]">
              {planet.owned ? 'Buys today' : `Whitespace · ${Math.round((planet.p ?? 0) * 100)}% likely`}
            </div>
          </div>
        </Html>
      )}
    </group>
  )
}

function OrreryRig({ rings, stage, interactive, spin }: { rings: OrreryRing[]; stage: StageSrc; interactive: boolean; spin: boolean }) {
  const ringGroups = useRef<(THREE.Group | null)[]>([])
  const spinners = useRef<(THREE.Group | null)[]>([])
  const sun = useRef<THREE.Mesh>(null)
  const root = useRef<THREE.Group>(null)
  const [hovered, setHovered] = useState<string | null>(null)

  // planet world-ish positions for the solution thread (computed in ring-local space, updated each frame)
  const threadPts = useMemo(() => {
    const pts: { ring: number; angle: number }[] = []
    rings.forEach((r, ri) => r.planets.forEach((p, pi) => {
      if (p.inSolution) pts.push({ ring: ri, angle: (pi / r.planets.length) * Math.PI * 2 + ri * 0.7 })
    }))
    return pts
  }, [rings])
  const lineRef = useRef<any>(null)

  useFrame((state, dt) => {
    const st = readStage(stage)
    const unify = easeInOut(clamp01(st))
    const t = state.clock.elapsedTime
    rings.forEach((_, i) => {
      const g = ringGroups.current[i]
      if (!g) return
      const sp = SILO_POS[i]
      g.position.set(sp[0] * (1 - unify), sp[1] * (1 - unify), sp[2] * (1 - unify))
      g.scale.setScalar(THREE.MathUtils.lerp(SILO_SCALE[i] * 2.4, 1, unify))
      g.rotation.x = THREE.MathUtils.lerp(0.5 + i * 0.25, 0.06 * i, unify)
      g.rotation.z = THREE.MathUtils.lerp((i % 2 ? -1 : 1) * 0.35, 0, unify)
      const s = spinners.current[i]
      if (s && spin) s.rotation.y += dt * (0.18 / (i + 1)) * (1 - 0.6 * clamp01(st - 1.2))
    })
    if (sun.current) {
      sun.current.scale.setScalar(THREE.MathUtils.lerp(0.25, 0.62, unify))
      ;(sun.current.material as THREE.MeshPhysicalMaterial).emissiveIntensity = 0.1 + unify * 0.25 + Math.sin(t * 1.5) * 0.04
    }
    if (root.current) {
      root.current.rotation.y = state.pointer.x * 0.25
      root.current.rotation.x = 0.42 - state.pointer.y * 0.12
    }
    // solution thread: compute current world positions of solution planets
    if (lineRef.current) {
      const thread = clamp01((st - 1.35) * 1.6)
      const pts: THREE.Vector3[] = threadPts.map(({ ring, angle }) => {
        const v = new THREE.Vector3(Math.cos(angle) * RADII[ring], 0, Math.sin(angle) * RADII[ring])
        const s = spinners.current[ring]
        if (s) v.applyMatrix4(s.matrixWorld)
        return root.current ? root.current.worldToLocal(v) : v
      })
      if (pts.length > 1) {
        const closed = [...pts, pts[0]]
        lineRef.current.geometry.setPositions(closed.flatMap((p) => [p.x, p.y, p.z]))
      }
      lineRef.current.material.opacity = thread
      lineRef.current.material.dashOffset -= dt * 0.6
    }
  })

  return (
    <group ref={root}>
      <mesh ref={sun} castShadow>
        <sphereGeometry args={[1, 64, 64]} />
        <meshPhysicalMaterial color="#f5b700" metalness={0.9} roughness={0.18} clearcoat={1} emissive="#8a5a00" emissiveIntensity={0.2} />
      </mesh>
      {/* central spindle + base */}
      <mesh position={[0, -0.9, 0]} material={brass}><cylinderGeometry args={[0.04, 0.04, 1.4, 12]} /></mesh>
      <mesh position={[0, -1.6, 0]} material={darkBrass} receiveShadow><cylinderGeometry args={[0.9, 1.1, 0.12, 64]} /></mesh>

      {rings.map((r, i) => (
        <group key={r.code} ref={(el) => { ringGroups.current[i] = el }}>
          <mesh rotation={[Math.PI / 2, 0, 0]} material={brass} castShadow>
            <torusGeometry args={[RADII[i], 0.018, 12, 160]} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -0.36, 0]}>
            <torusGeometry args={[RADII[i], 0.006, 6, 160]} />
            <meshStandardMaterial color={r.color} />
          </mesh>
          <group ref={(el) => { spinners.current[i] = el }}>
            {r.planets.map((p, pi) => (
              <Planet key={p.id} planet={p} angle={(pi / r.planets.length) * Math.PI * 2 + i * 0.7} radius={RADII[i]}
                color={r.color} stageRef={stage} hovered={hovered === p.id} onHover={setHovered} interactive={interactive} />
            ))}
          </group>
        </group>
      ))}
      <Line ref={lineRef} points={[[0, 0, 0], [0, 0, 0]]} color="#c98a00" lineWidth={2.2} dashed dashSize={0.18} gapSize={0.09}
        transparent opacity={0} />
    </group>
  )
}

export function Orrery({ rings = DEMO_RINGS, stage = 1, interactive = false, spin = true, className }: {
  rings?: OrreryRing[]; stage?: StageSrc; interactive?: boolean; spin?: boolean; className?: string
}) {
  return (
    <div className={className}>
      <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 3.2, 9.5], fov: 38 }} gl={{ antialias: true, alpha: true }}>
        <Suspense fallback={null}>
          <ambientLight intensity={0.55} color="#fff3dc" />
          <directionalLight position={[4, 8, 5]} intensity={2.2} color="#fff1d6" castShadow shadow-mapSize={[1024, 1024]} />
          <directionalLight position={[-6, 2, -4]} intensity={0.6} color="#d9e6ff" />
          {/* studio reflections built locally — no HDR download */}
          <Environment resolution={256}>
            <Lightformer intensity={2.2} position={[0, 5, -2]} scale={[10, 3, 1]} color="#fff4e0" />
            <Lightformer intensity={1.2} position={[-5, 1, 2]} scale={[3, 6, 1]} color="#ffe2a8" />
            <Lightformer intensity={0.8} position={[5, 1, 2]} scale={[3, 6, 1]} color="#ffffff" />
          </Environment>
          <OrreryRig rings={rings} stage={stage} interactive={interactive} spin={spin} />
          <ContactShadows position={[0, -1.68, 0]} opacity={0.38} scale={14} blur={2.6} far={4} color="#4a3510" />
        </Suspense>
      </Canvas>
    </div>
  )
}
