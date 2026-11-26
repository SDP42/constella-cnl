import { QuadraticBezierLine } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { Bloom, EffectComposer } from '@react-three/postprocessing'
import { Suspense, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { INDIA } from '@/lib/geo'
import { GIBS_GLOBE } from '@/lib/geoLayers'

/**
 * Night-side globe facing India. Scroll progress (0..1) zooms the camera from orbit to India to Pune.
 * Real geometry: partner cities + counts come from /api/public/network (aggregate, no PII).
 */

export interface GlobeCity { city: string; lat: number; lng: number; partners: { hero: boolean }[] }

const R = 2

function inPoly(x: number, y: number, poly: [number, number][]) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]
    const [xj, yj] = poly[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

export function latLng(lat: number, lng: number, r = R) {
  const phi = ((90 - lat) * Math.PI) / 180
  const theta = ((lng + 180) * Math.PI) / 180
  return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta))
}

const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)
const seg = (p: number, a: number, b: number) => ease(Math.min(1, Math.max(0, (p - a) / (b - a))))

// Day/night Earth from NASA GIBS (Blue Marble NG + VIIRS Black Marble), blended across a soft terminator.
const earthVert = `varying vec2 vUv; varying vec3 vNw; varying vec3 vP; void main(){ vUv = uv; vNw = normalize(mat3(modelMatrix)*normal); vec4 mv = modelViewMatrix*vec4(position,1.0); vP = mv.xyz; gl_Position = projectionMatrix*mv; }`
const earthFrag = `uniform sampler2D uDay; uniform sampler2D uNight; uniform vec3 uSun; uniform float uReady; uniform float uNightBoost;
varying vec2 vUv; varying vec3 vNw; varying vec3 vP;
void main(){
  float d = dot(normalize(vNw), normalize(uSun));
  float k = smoothstep(-0.18, 0.28, d);
  vec3 day = texture2D(uDay, vUv).rgb; day = pow(day, vec3(0.95)) * (0.18 + 1.05*max(d, 0.0));
  vec3 nt = texture2D(uNight, vUv).rgb; float lum = dot(nt, vec3(0.299,0.587,0.114));
  vec3 night = vec3(0.012,0.016,0.03) + vec3(1.0,0.78,0.45) * pow(lum, 1.6) * uNightBoost;
  vec3 col = mix(night, day, k);
  float rim = pow(1.0 - abs(dot(normalize(-vP), normalize((viewMatrix*vec4(vNw,0.0)).xyz))), 4.0);
  col += vec3(0.35,0.55,0.9) * rim * 0.35 * k;
  gl_FragColor = vec4(mix(vec3(0.137,0.114,0.09), col, uReady), 1.0);
}`

const atmoVert = `varying vec3 vN; varying vec3 vP; void main(){ vN = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.0); vP = mv.xyz; gl_Position = projectionMatrix*mv; }`
const atmoFrag = `uniform vec3 uC; uniform float uI; varying vec3 vN; varying vec3 vP; void main(){ float f = pow(1.0 - abs(dot(normalize(-vP), vN)), 3.0); gl_FragColor = vec4(uC, f*uI); }`

function Earth({ cities, progress }: { cities: GlobeCity[]; progress: React.MutableRefObject<number> }) {
  const group = useRef<THREE.Group>(null)
  const arcs = useRef<any[]>([])
  const lights = useRef<THREE.Group>(null)
  const pune = useRef<THREE.Mesh>(null)
  const earthMat = useRef<THREE.ShaderMaterial>(null)
  const tex = useRef<{ day: THREE.Texture | null; night: THREE.Texture | null }>({ day: null, night: null })
  const earthU = useMemo(() => ({ uDay: { value: null as THREE.Texture | null }, uNight: { value: null as THREE.Texture | null },
    uSun: { value: new THREE.Vector3(-0.85, 0.3, 0.55) }, uReady: { value: 0 }, uNightBoost: { value: 2.4 } }), [])
  useEffect(() => {
    const loader = new THREE.TextureLoader()
    loader.setCrossOrigin('anonymous')
    const ok = (key: 'day' | 'night') => (t: THREE.Texture) => {
      t.colorSpace = THREE.SRGBColorSpace
      t.anisotropy = 8
      t.needsUpdate = true
      tex.current[key] = t
    }
    loader.load(GIBS_GLOBE.day, ok('day'), undefined, (e) => console.warn('GIBS day texture failed', e))
    loader.load(GIBS_GLOBE.night, ok('night'), undefined, (e) => console.warn('GIBS night texture failed', e))
  }, [])

  // orient so India (22N, 80E) faces the camera (+z)
  const baseQ = useMemo(() => new THREE.Quaternion().setFromUnitVectors(latLng(22, 80).normalize(), new THREE.Vector3(0, 0, 1)), [])
  const puneQ = useMemo(() => new THREE.Quaternion().setFromUnitVectors(latLng(18.0, 74.6).normalize(), new THREE.Vector3(0, 0, 1)), [])
  const q = useMemo(() => new THREE.Quaternion(), [])

  const land = useMemo(() => {
    const pts: number[] = []
    for (let lat = 6; lat <= 37; lat += 0.42) {
      for (let lng = 67; lng <= 97.5; lng += 0.42 / Math.cos((lat * Math.PI) / 180)) {
        if (inPoly(lng, lat, INDIA)) pts.push(...latLng(lat, lng, R * 1.001).toArray())
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    return g
  }, [])

  const graticule = useMemo(() => {
    // faint world dot-sphere so the globe reads as a planet, not a ball
    const pts: number[] = []
    const n = 9000
    const golden = Math.PI * (3 - Math.sqrt(5))
    for (let i = 0; i < n; i++) {
      const y = 1 - (i / (n - 1)) * 2
      const rad = Math.sqrt(1 - y * y)
      const th = golden * i
      pts.push(Math.cos(th) * rad * R * 1.0005, y * R * 1.0005, Math.sin(th) * rad * R * 1.0005)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    return g
  }, [])

  const hub = useMemo(() => latLng(19.08, 72.88, R * 1.003), [])
  const arcData = useMemo(() => cities.filter((c) => c.city !== 'Mumbai').map((c) => {
    const end = latLng(c.lat, c.lng, R * 1.003)
    const mid = hub.clone().add(end).multiplyScalar(0.5)
    const lift = 1 + hub.distanceTo(end) * 0.35
    mid.normalize().multiplyScalar(R * lift)
    return { end, mid }
  }), [cities, hub])

  useFrame((state, dt) => {
    const p = progress.current
    const t = state.clock.elapsedTime
    if (group.current) {
      const drift = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.sin(t * 0.08) * 0.25 * (1 - seg(p, 0.2, 0.5)), 0))
      q.copy(baseQ).slerp(puneQ, seg(p, 0.55, 0.9))
      group.current.quaternion.copy(drift).multiply(q)
    }
    const mu = earthMat.current?.uniforms
    if (mu && tex.current.day && tex.current.night) {
      mu.uDay.value = tex.current.day
      mu.uNight.value = tex.current.night
      mu.uReady.value = Math.min(1, mu.uReady.value + dt * 0.8)
    }
    const arcOn = seg(p, 0.25, 0.5)
    arcs.current.forEach((l, i) => {
      if (!l) return
      l.visible = arcOn > 0.01
      l.material.transparent = true
      l.material.opacity = arcOn * 0.85
      l.material.dashOffset -= dt * (0.4 + (i % 4) * 0.1)
    })
    lights.current?.children.forEach((c, i) => {
      const s = 1 + 0.25 * Math.sin(t * 2 + i)
      c.scale.setScalar(s * (1 - 0.45 * seg(p, 0.4, 0.9)))
    })
    if (pune.current) {
      const k = (t * 0.6) % 1
      pune.current.scale.setScalar(0.01 + k * 0.07 * (0.3 + seg(p, 0.55, 0.85)))
      ;(pune.current.material as THREE.MeshBasicMaterial).opacity = (1 - k) * (0.3 + seg(p, 0.55, 0.85) * 0.7)
    }
  })

  const punePos = latLng(18.52, 73.86, R * 1.004)
  return (
    <group ref={group}>
      <mesh>
        <sphereGeometry args={[R, 128, 128]} />
        <shaderMaterial ref={earthMat} vertexShader={earthVert} fragmentShader={earthFrag} uniforms={earthU} />
      </mesh>
      <points geometry={graticule}>
        <pointsMaterial size={0.01} color="#6b5d4a" transparent opacity={0.12} sizeAttenuation />
      </points>
      <points geometry={land}>
        <pointsMaterial size={0.014} color="#f5c56a" transparent opacity={0.32} sizeAttenuation />
      </points>
      <group ref={lights}>
        {cities.map((c) => {
          const v = latLng(c.lat, c.lng, R * 1.004)
          const r = 0.007 + Math.sqrt(c.partners.length) * 0.0018
          return (
            <mesh key={c.city} position={v}>
              <sphereGeometry args={[r, 16, 16]} />
              <meshBasicMaterial color="#ffd27a" toneMapped={false} />
            </mesh>
          )
        })}
      </group>
      <mesh ref={pune} position={punePos} quaternion={new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), punePos.clone().normalize())}>
        <ringGeometry args={[0.8, 1, 64]} />
        <meshBasicMaterial color="#ffd27a" transparent side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      {arcData.map((a, i) => (
        <QuadraticBezierLine key={i} ref={(el) => { arcs.current[i] = el }} start={hub} end={a.end} mid={a.mid}
          color="#f5b700" lineWidth={1.4} dashed dashScale={8} dashSize={0.5} gapSize={0.35} transparent opacity={0} />
      ))}
      {/* atmosphere */}
      <mesh scale={1.06}>
        <sphereGeometry args={[R, 64, 64]} />
        <shaderMaterial vertexShader={atmoVert} fragmentShader={atmoFrag} transparent side={THREE.BackSide} depthWrite={false}
          uniforms={{ uC: { value: new THREE.Color('#7fb2ff') }, uI: { value: 0.85 } }} />
      </mesh>
      <mesh scale={1.002}>
        <sphereGeometry args={[R, 64, 64]} />
        <shaderMaterial vertexShader={atmoVert} fragmentShader={atmoFrag} transparent depthWrite={false} blending={THREE.AdditiveBlending}
          uniforms={{ uC: { value: new THREE.Color('#9cc4ff') }, uI: { value: 0.28 } }} />
      </mesh>
    </group>
  )
}

function Stars() {
  const g = useMemo(() => {
    const pts: number[] = []
    for (let i = 0; i < 1800; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(30 + Math.random() * 30)
      pts.push(v.x, v.y, v.z)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    return geo
  }, [])
  return <points geometry={g}><pointsMaterial size={0.08} color="#e7dcc8" transparent opacity={0.6} /></points>
}

function CameraRig({ progress }: { progress: React.MutableRefObject<number> }) {
  const smooth = useRef(0)
  useFrame((state, dt) => {
    smooth.current += (progress.current - smooth.current) * Math.min(1, dt * 2.4)
    const p = smooth.current
    const z = THREE.MathUtils.lerp(8.2, 4.4, seg(p, 0.05, 0.45)) - 1.15 * seg(p, 0.55, 0.9)
    const x = -2.1 * (1 - seg(p, 0.05, 0.45)) - 0.9 * seg(p, 0.05, 0.45)
    const y = 0.15
    const cam = state.camera
    cam.position.lerp(new THREE.Vector3(x + state.pointer.x * 0.15, y + state.pointer.y * 0.1, z), Math.min(1, dt * 4))
    cam.lookAt(x * 0.55, y * 0.6, 0)
  })
  return null
}

export function Globe({ cities, progress, className }: { cities: GlobeCity[]; progress: React.MutableRefObject<number>; className?: string }) {
  return (
    <div className={className}>
      <Canvas dpr={[1, 2]} camera={{ position: [-2.1, 0.15, 8.2], fov: 35 }} gl={{ antialias: true }}>
        <color attach="background" args={['#0c0a09']} />
        <Suspense fallback={null}>
          <ambientLight intensity={0.55} />
          <directionalLight position={[-6, 3, 4]} intensity={1.6} color="#ffe2b8" />
          <Stars />
          <Earth cities={cities} progress={progress} />
          <CameraRig progress={progress} />
          <EffectComposer multisampling={0}>
            <Bloom mipmapBlur intensity={0.7} luminanceThreshold={0.62} luminanceSmoothing={0.2} />
          </EffectComposer>
        </Suspense>
      </Canvas>
    </div>
  )
}
