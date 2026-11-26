import { QuadraticBezierLine, RoundedBox } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing'
import { Suspense, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

/**
 * Scroll-driven flight through CNL's partner network (real geometry from /api/public/network).
 *   p 0.00–0.18  overview — 600 partner towers rise over 24 cities
 *   p 0.18–0.38  zoom to Pune — towers split into five division segments (silos)
 *   p 0.38–0.56  dive into TechNova — the tower explodes into floors; missing divisions are ghosts
 *   p 0.56–0.78  solution — ghost floors fly in and lock; annuity ring starts orbiting
 *   p 0.78–1.00  pull out — routing arcs light up across India
 */

export interface NetCity { city: string; lat: number; lng: number; partners: { hero: boolean; total: number; mix: number[] }[] }

export const DIVS = ['EB', 'HON', 'FMSG', 'FMCT', 'SVC'] as const
export const DIV_COLORS = ['#4f7bff', '#ffc21a', '#ff4d6d', '#9b6bff', '#19d39a']

const proj = (lat: number, lng: number) => new THREE.Vector3((lng - 80) * 0.62, 0, -(lat - 21) * 0.68)
const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)
const seg = (p: number, a: number, b: number) => ease(Math.min(1, Math.max(0, (p - a) / (b - a))))

// camera keyframes: [progress, position, target]
const KEYS: [number, [number, number, number], [number, number, number]][] = [
  [0.0, [-3.8, 12.5, 12.5], [-4.6, 0, 0.2]],
  [0.17, [-1.2, 7.5, 9.8], [-3.4, 0, 0.4]],
  [0.33, [-2.6, 3.4, 6.2], [-4.6, 0.3, 1.5]],
  [0.48, [-2.2, 1.9, 6.0], [-4.55, 0.8, 1.69]],
  [0.66, [-2.6, 2.1, 4.6], [-4.75, 0.95, 1.69]],
  [0.84, [-1.6, 8.5, 9.5], [-3.2, 0, 0.3]],
  [1.0, [-3.0, 12.5, 12], [-4.2, 0, 0.2]],
]
const posCurve = new THREE.CatmullRomCurve3(KEYS.map((k) => new THREE.Vector3(...k[1])), false, 'centripetal')

function cameraAt(p: number, outPos: THREE.Vector3, outTgt: THREE.Vector3) {
  let i = 0
  while (i < KEYS.length - 2 && p > KEYS[i + 1][0]) i++
  const [p0, , t0] = KEYS[i]
  const [p1, , t1] = KEYS[i + 1]
  const local = ease(Math.min(1, Math.max(0, (p - p0) / (p1 - p0))))
  const u = (i + local) / (KEYS.length - 1)
  outPos.copy(posCurve.getPoint(u))
  outTgt.set(t0[0] + (t1[0] - t0[0]) * local, t0[1] + (t1[1] - t0[1]) * local, t0[2] + (t1[2] - t0[2]) * local)
}

function Towers({ cities, progress }: { cities: NetCity[]; progress: React.MutableRefObject<number> }) {
  const meshes = useRef<(THREE.InstancedMesh | null)[]>([])
  const caps = useRef<THREE.InstancedMesh>(null)
  const layout = useMemo(() => {
    const items: { x: number; z: number; h: number; mix: number[]; delay: number }[] = []
    cities.forEach((c) => {
      const center = proj(c.lat, c.lng)
      let k = 0
      c.partners.forEach((pt) => {
        if (pt.hero) return
        const r = 0.12 * Math.sqrt(k + (c.city === 'Pune' ? 9 : 1))
        const th = k * 2.39996
        k++
        const h = Math.max(0.12, (Math.log10(pt.total + 10) - 4.6) * 0.42)
        items.push({ x: center.x + Math.cos(th) * r, z: center.z + Math.sin(th) * r, h, mix: pt.mix, delay: Math.random() * 0.5 })
      })
    })
    return items
  }, [cities])
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const n = layout.length

  useFrame((state) => {
    const p = progress.current
    const grow = Math.max(seg(p, 0.0, 0.14), ease(Math.min(1, state.clock.elapsedTime / 2.8)))
    const split = seg(p, 0.2, 0.34) * (1 - seg(p, 0.8, 0.95))
    // while we are inside the hero partner, the rest of the network sinks away
    const sink = 1 - 0.97 * seg(p, 0.36, 0.45) * (1 - seg(p, 0.74, 0.84))
    DIVS.forEach((_, d) => {
      const m = meshes.current[d]
      if (!m) return
      for (let i = 0; i < n; i++) {
        const it = layout[i]
        const g = Math.min(1, Math.max(0, (grow * 1.5 - it.delay))) * sink
        let y = 0
        for (let j = 0; j < d; j++) y += it.mix[j] * it.h * g + (it.mix[j] > 0 ? split * 0.09 : 0)
        const hSeg = Math.max(0.0001, it.mix[d] * it.h * g)
        dummy.position.set(it.x, y + hSeg / 2, it.z)
        dummy.scale.set(it.mix[d] > 0 ? 0.075 : 0.0001, hSeg, it.mix[d] > 0 ? 0.075 : 0.0001)
        dummy.updateMatrix()
        m.setMatrixAt(i, dummy.matrix)
      }
      m.instanceMatrix.needsUpdate = true
    })
    if (caps.current) {
      for (let i = 0; i < n; i++) {
        const it = layout[i]
        const g = Math.min(1, Math.max(0, (grow * 1.5 - it.delay))) * sink
        const used = it.mix.filter((v) => v > 0).length
        dummy.position.set(it.x, it.h * g + split * 0.09 * Math.max(0, used - 1) + 0.012, it.z)
        dummy.scale.set(0.08, 0.012, 0.08)
        dummy.updateMatrix()
        caps.current.setMatrixAt(i, dummy.matrix)
      }
      caps.current.instanceMatrix.needsUpdate = true
    }
  })

  return (
    <group>
      {DIVS.map((d, i) => (
        <instancedMesh key={d} ref={(el) => { meshes.current[i] = el }} args={[undefined, undefined, n]} frustumCulled={false}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={DIV_COLORS[i]} roughness={0.35} metalness={0.15} emissive={DIV_COLORS[i]} emissiveIntensity={0.18} />
        </instancedMesh>
      ))}
      <instancedMesh ref={caps} args={[undefined, undefined, n]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </instancedMesh>
    </group>
  )
}

function HeroTower({ origin, mix, progress }: { origin: THREE.Vector3; mix: number[]; progress: React.MutableRefObject<number> }) {
  const floors = useRef<(THREE.Group | null)[]>([])
  const ghosts = useRef<(THREE.LineSegments | null)[]>([])
  const solids = useRef<(THREE.Mesh | null)[]>([])
  const ring = useRef<THREE.Mesh>(null)
  const beacon = useRef<THREE.Mesh>(null)
  const owned = mix.map((v) => v > 0)

  useFrame((state) => {
    const p = progress.current
    const t = state.clock.elapsedTime
    const appear = seg(p, 0.22, 0.34)
    const explode = seg(p, 0.38, 0.5) * (1 - seg(p, 0.62, 0.74))
    const fill = seg(p, 0.56, 0.7)
    floors.current.forEach((f, d) => {
      if (!f) return
      // the floor slot (and its ghost outline) stays in place
      f.position.set(origin.x, 0.16 + d * 0.3 * appear + explode * d * 0.14, origin.z)
      f.rotation.y = explode * (d % 2 ? 0.3 : -0.3)
      f.scale.setScalar(Math.max(0.001, appear))
      const g = ghosts.current[d]
      const so = solids.current[d]
      if (!g || !so) return
      if (owned[d]) {
        so.position.set(0, 0, 0)
        so.rotation.set(0, 0, 0)
        ;(so.material as THREE.MeshStandardMaterial).opacity = 1
        g.visible = false
      } else {
        // missing division: the solid floor flies in from outside during the solution chapter
        const away = 1 - fill
        so.position.set((d % 2 ? 1 : -1) * away * 2.4, away * 1.6, away * 1.2)
        so.rotation.set(away * 1.2, away * Math.PI, 0)
        ;(so.material as THREE.MeshStandardMaterial).opacity = Math.min(1, fill * 1.4)
        so.visible = fill > 0.01
        g.visible = true
        ;(g.material as THREE.LineBasicMaterial).opacity = (1 - fill) * (0.8 + 0.2 * Math.sin(t * 4 + d))
      }
    })
    if (ring.current) {
      const r = seg(p, 0.64, 0.76)
      ring.current.scale.setScalar(Math.max(0.001, r))
      ring.current.rotation.z = t * 0.9
      ring.current.position.set(origin.x, 0.8 + Math.sin(t) * 0.04, origin.z)
    }
    if (beacon.current) {
      beacon.current.position.set(origin.x, 1.75 + explode * 0.9, origin.z)
      beacon.current.scale.setScalar(appear * (1 + 0.2 * Math.sin(t * 3)))
    }
  })

  return (
    <group>
      {DIVS.map((d, i) => (
        <group key={d} ref={(el) => { floors.current[i] = el }}>
          <RoundedBox ref={(el: THREE.Mesh | null) => { solids.current[i] = el }} args={[0.62, 0.26, 0.62]} radius={0.04} smoothness={4}>
            <meshStandardMaterial color={DIV_COLORS[i]} roughness={0.25} metalness={0.2} emissive={DIV_COLORS[i]} emissiveIntensity={0.35} transparent />
          </RoundedBox>
          <lineSegments ref={(el: any) => { ghosts.current[i] = el }}>
            <edgesGeometry args={[new THREE.BoxGeometry(0.66, 0.28, 0.66)]} />
            <lineBasicMaterial color={DIV_COLORS[i]} transparent toneMapped={false} />
          </lineSegments>
        </group>
      ))}
      <mesh ref={ring} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.72, 0.018, 16, 120]} />
        <meshBasicMaterial color={DIV_COLORS[4]} toneMapped={false} />
      </mesh>
      <mesh ref={beacon}>
        <sphereGeometry args={[0.05, 24, 24]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </mesh>
    </group>
  )
}

function Arcs({ cities, hub, progress }: { cities: NetCity[]; hub: THREE.Vector3; progress: React.MutableRefObject<number> }) {
  const refs = useRef<any[]>([])
  const arcs = useMemo(() => cities.filter((c) => c.city !== 'Pune').map((c) => {
    const end = proj(c.lat, c.lng)
    const mid = hub.clone().lerp(end, 0.5)
    mid.y = 0.8 + hub.distanceTo(end) * 0.22
    return { end, mid }
  }), [cities, hub])
  useFrame((_, dt) => {
    const o = seg(progress.current, 0.76, 0.9)
    refs.current.forEach((l, i) => {
      if (!l) return
      l.visible = o > 0.01
      l.material.transparent = true
      l.material.opacity = o * (0.55 + (i % 3) * 0.15)
      l.material.dashOffset -= dt * (0.8 + (i % 4) * 0.2)
    })
  })
  return (
    <group>
      {arcs.map((a, i) => (
        <QuadraticBezierLine key={i} ref={(el) => { refs.current[i] = el }} start={hub} end={a.end} mid={a.mid}
          color="#ffd166" lineWidth={1.6} dashed dashScale={6} dashSize={0.6} gapSize={0.4} transparent opacity={0} />
      ))}
    </group>
  )
}

function CityDiscs({ cities, progress }: { cities: NetCity[]; progress: React.MutableRefObject<number> }) {
  const ref = useRef<THREE.Group>(null)
  useFrame((state) => {
    const o = 0.35 + seg(progress.current, 0.0, 0.12) * 0.4
    ref.current?.children.forEach((c, i) => {
      const m = (c as THREE.Mesh).material as THREE.MeshBasicMaterial
      m.opacity = o * (0.6 + 0.4 * Math.sin(state.clock.elapsedTime * 1.5 + i))
    })
  })
  return (
    <group ref={ref}>
      {cities.map((c) => {
        const v = proj(c.lat, c.lng)
        const r = 0.18 + Math.sqrt(c.partners.length) * 0.09
        return (
          <mesh key={c.city} position={[v.x, 0.002, v.z]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[r * 0.92, r, 64]} />
            <meshBasicMaterial color="#8fa8ff" transparent opacity={0.5} toneMapped={false} />
          </mesh>
        )
      })}
    </group>
  )
}

function Ground() {
  const uniforms = useMemo(() => ({ uC: { value: new THREE.Color('#283063') } }), [])
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]}>
      <circleGeometry args={[26, 96]} />
      <shaderMaterial transparent uniforms={uniforms} depthWrite={false}
        vertexShader={`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`}
        fragmentShader={`uniform vec3 uC; varying vec2 vUv; void main(){ float d = distance(vUv, vec2(0.5)); float a = smoothstep(0.5, 0.0, d); gl_FragColor = vec4(uC, a*0.85); }`} />
    </mesh>
  )
}

function Rig({ progress }: { progress: React.MutableRefObject<number> }) {
  const { camera } = useThree()
  const smooth = useRef(0)
  const pos = useMemo(() => new THREE.Vector3(), [])
  const tgt = useMemo(() => new THREE.Vector3(), [])
  const look = useRef(new THREE.Vector3())
  useLayoutEffect(() => {
    cameraAt(0, pos, tgt)
    camera.position.copy(pos)
    look.current.copy(tgt)
  }, [camera, pos, tgt])
  useFrame((state, dt) => {
    smooth.current += (progress.current - smooth.current) * Math.min(1, dt * 2.6)
    cameraAt(smooth.current, pos, tgt)
    pos.x += state.pointer.x * 0.35
    pos.y += state.pointer.y * 0.2
    camera.position.lerp(pos, Math.min(1, dt * 4))
    look.current.lerp(tgt, Math.min(1, dt * 4))
    camera.lookAt(look.current)
  })
  return null
}

export function NetworkFlight({ cities, progress, className }: { cities: NetCity[]; progress: React.MutableRefObject<number>; className?: string }) {
  const hero = useMemo(() => {
    for (const c of cities) {
      const h = c.partners.find((p) => p.hero)
      if (h) return { origin: proj(c.lat, c.lng), mix: h.mix }
    }
    return { origin: proj(18.52, 73.86), mix: [0.8, 0, 0, 0.2, 0] }
  }, [cities])
  return (
    <div className={className}>
      <Canvas dpr={[1, 1.75]} camera={{ fov: 42, near: 0.05, far: 120 }} gl={{ antialias: true }}>
        <color attach="background" args={['#0b0e22']} />
        <fog attach="fog" args={['#0b0e22', 12, 34]} />
        <Suspense fallback={null}>
          <hemisphereLight args={['#c9d4ff', '#1a1440', 0.9]} />
          <directionalLight position={[6, 12, 6]} intensity={1.8} />
          <pointLight position={[hero.origin.x, 2.4, hero.origin.z + 1]} intensity={6} distance={6} color="#ffe2a8" />
          <Ground />
          <CityDiscs cities={cities} progress={progress} />
          <Towers cities={cities} progress={progress} />
          <HeroTower origin={hero.origin} mix={hero.mix} progress={progress} />
          <Arcs cities={cities} hub={hero.origin} progress={progress} />
          <Rig progress={progress} />
          <EffectComposer multisampling={0}>
            <Bloom mipmapBlur intensity={0.9} luminanceThreshold={0.55} luminanceSmoothing={0.2} />
            <Vignette eskil={false} offset={0.2} darkness={0.75} />
          </EffectComposer>
        </Suspense>
      </Canvas>
    </div>
  )
}
