import { ContactShadows, Environment, Float, Lightformer, OrbitControls, RoundedBox } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { Suspense, useRef, useState } from 'react'
import * as THREE from 'three'
import { useCanvasKick } from './useCanvasKick'

/**
 * The account twin in 3D: one satin disc per CNL division, stacked like a partner's "relationship".
 *   owned     → solid satin disc in the division ink; thickness grows with spend share
 *   whitespace→ clear glass disc that pulses with the model's probability
 * An annuity ring orbits when the partner buys services.
 */
export interface TwinLayer { code: string; name: string; color: string; share: number; owned: boolean; p: number }

function Disc({ layer, y, onHover, hovered }: { layer: TwinLayer; y: number; onHover: (c: string | null) => void; hovered: boolean }) {
  const ref = useRef<THREE.Mesh>(null)
  const ring = useRef<THREE.Mesh>(null)
  useFrame((s) => {
    const t = s.clock.elapsedTime
    if (ref.current) ref.current.scale.setScalar(hovered ? 1.05 : 1)
    if (ring.current && !layer.owned) {
      const k = (t * 0.7 + y) % 1
      ring.current.scale.setScalar(1 + k * 0.25 * (0.4 + layer.p))
      ;(ring.current.material as THREE.MeshBasicMaterial).opacity = (1 - k) * (0.25 + layer.p)
    }
  })
  const h = layer.owned ? 0.12 + layer.share * 0.35 : 0.12
  return (
    <group position={[0, y, 0]}>
      <RoundedBox ref={ref} args={[2.2, h, 2.2]} radius={Math.min(0.06, h / 2.2)} smoothness={6}
        onPointerOver={(e) => { e.stopPropagation(); onHover(layer.code) }} onPointerOut={() => onHover(null)}>
        {layer.owned ? (
          <meshPhysicalMaterial color={layer.color} roughness={0.35} metalness={0.15} clearcoat={0.8} clearcoatRoughness={0.25} />
        ) : (
          <meshPhysicalMaterial color={layer.color} transparent opacity={0.22} roughness={0.08} clearcoat={1} depthWrite={false} />
        )}
      </RoundedBox>
      {!layer.owned && (
        <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.58, 1.62, 96]} />
          <meshBasicMaterial color={layer.color} transparent side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  )
}

function Stack({ layers, annuity, onHover, hovered }: { layers: TwinLayer[]; annuity: boolean; onHover: (c: string | null) => void; hovered: string | null }) {
  const ring = useRef<THREE.Mesh>(null)
  useFrame((s) => { if (ring.current) ring.current.rotation.z = s.clock.elapsedTime * 0.6 })
  let y = -0.9
  const ys = layers.map((l) => {
    const h = l.owned ? 0.12 + l.share * 0.35 : 0.12
    const at = y + h / 2
    y += h + 0.18
    return at
  })
  return (
    <Float speed={1.1} rotationIntensity={0.12} floatIntensity={0.25}>
      <group rotation={[0, Math.PI / 4, 0]}>
        {layers.map((l, i) => <Disc key={l.code} layer={l} y={ys[i]} onHover={onHover} hovered={hovered === l.code} />)}
        {annuity && (
          <mesh ref={ring} position={[0, 0, 0]} rotation={[Math.PI / 2.3, 0, 0]}>
            <torusGeometry args={[2.05, 0.022, 16, 160]} />
            <meshStandardMaterial color="#3f7d5c" metalness={0.6} roughness={0.3} />
          </mesh>
        )}
      </group>
    </Float>
  )
}

export function TwinStack({ layers, annuity, className }: { layers: TwinLayer[]; annuity: boolean; className?: string }) {
  const [hovered, setHovered] = useState<string | null>(null)
  useCanvasKick()
  const h = layers.find((l) => l.code === hovered)
  return (
    <div className={`relative ${className ?? ''}`}>
      <Canvas dpr={[1, 2]} camera={{ position: [4.2, 2.6, 4.2], fov: 34 }} gl={{ antialias: true, alpha: true }}>
        <Suspense fallback={null}>
          <ambientLight intensity={0.6} />
          <directionalLight position={[4, 6, 3]} intensity={1.6} />
          <Environment resolution={256}>
            <Lightformer intensity={2} position={[0, 4, 2]} scale={[6, 1, 1]} color="#fff8ee" />
            <Lightformer intensity={1.2} position={[-4, 1, 2]} scale={[1, 4, 1]} color="#f5d9a8" />
            <Lightformer intensity={1} position={[4, 0, -2]} scale={[1, 4, 1]} color="#dbe5f0" />
          </Environment>
          <Stack layers={layers} annuity={annuity} onHover={setHovered} hovered={hovered} />
          <ContactShadows position={[0, -1.25, 0]} opacity={0.35} scale={8} blur={2.4} far={3} color="#3b2f22" />
          <OrbitControls enablePan={false} enableZoom={false} autoRotate autoRotateSpeed={0.6} minPolarAngle={0.6} maxPolarAngle={1.4} />
        </Suspense>
      </Canvas>
      {h && (
        <div className="pointer-events-none absolute left-4 top-4 rounded-xl bg-white/90 px-3 py-2 text-xs shadow-lg backdrop-blur">
          <div className="font-semibold">{h.name}</div>
          <div className="text-ink-soft">{h.owned ? `${Math.round(h.share * 100)}% of spend with CNL` : `Whitespace · ${Math.round(h.p * 100)}% likely in 120 days`}</div>
        </div>
      )}
    </div>
  )
}
