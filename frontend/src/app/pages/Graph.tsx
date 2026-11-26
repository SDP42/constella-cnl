import { OrbitControls, QuadraticBezierLine } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useCanvasKick } from '@/components/three/useCanvasKick'
import { pct } from '@/lib/format'
import { Card, Loading, Page, useApi } from '../kit'
import { DIV_COLORS_MAP, DIV_NAME } from '../theme'

const DIV_ORDER = ['EB', 'HON', 'FMSG', 'FMCT', 'SVC']

function Universe({ data, hovered, setHovered }: { data: any; hovered: string | null; setHovered: (s: string | null) => void }) {
  const g = useRef<THREE.Group>(null)
  useFrame((_, dt) => { if (g.current) g.current.rotation.y += dt * 0.05 })
  const pos = useMemo(() => {
    const m: Record<string, THREE.Vector3> = {}
    DIV_ORDER.forEach((d, di) => {
      const nodes = data.nodes.filter((n: any) => n.division === d)
      const a0 = (di / DIV_ORDER.length) * Math.PI * 2
      nodes.forEach((n: any, i: number) => {
        const a = a0 + (i - nodes.length / 2) * 0.16
        const r = 3.2 + (i % 2) * 0.6
        m[n.id] = new THREE.Vector3(Math.cos(a) * r, (di - 2) * 0.55 + Math.sin(i) * 0.4, Math.sin(a) * r)
      })
    })
    return m
  }, [data])
  return (
    <group ref={g}>
      {data.edges.map((e: any, i: number) => {
        const a = pos[e.source]
        const b = pos[e.target]
        if (!a || !b) return null
        const active = hovered && (e.source === hovered || e.target === hovered)
        const mid = a.clone().add(b).multiplyScalar(0.25)
        return <QuadraticBezierLine key={i} start={a} end={b} mid={mid} color={e.cross_division ? '#a16207' : '#78716c'} lineWidth={active ? 2.4 : 0.8} transparent opacity={hovered ? (active ? 0.95 : 0.06) : 0.28} />
      })}
      {data.nodes.map((n: any) => (
        <mesh key={n.id} position={pos[n.id]} onPointerOver={(e) => { e.stopPropagation(); setHovered(n.id) }} onPointerOut={() => setHovered(null)}>
          <sphereGeometry args={[0.1 + n.adoption * 0.5, 32, 32]} />
          <meshPhysicalMaterial color={DIV_COLORS_MAP[n.division]} roughness={0.3} clearcoat={1} emissive={DIV_COLORS_MAP[n.division]} emissiveIntensity={hovered === n.id ? 0.6 : 0.08} />
        </mesh>
      ))}
    </group>
  )
}

export default function Graph() {
  const d = useApi<any>(['graph'], '/api/graph/categories')
  const [hovered, setHovered] = useState<string | null>(null)
  useCanvasKick(d.data)
  const node = d.data?.nodes.find((n: any) => n.id === hovered)
  const links = d.data?.edges.filter((e: any) => hovered && (e.source === hovered || e.target === hovered)).sort((a: any, b: any) => b.lift - a.lift)
  return (
    <Page kicker="Which products are bought together" title="Product universe">
      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <Card pad={false} title="Co-purchase constellation" sub="Spheres = categories (size = adoption), gold arcs = cross-division pairs with lift > 1.4. Hover a sphere; drag to orbit.">
          {!d.data ? <div className="p-5"><Loading /></div> : (
            <div className="h-[560px] bg-[radial-gradient(circle_at_50%_40%,#ffffff,#efebe4)]">
              <Canvas camera={{ position: [0, 3.5, 9], fov: 45 }} dpr={[1, 2]}>
                <ambientLight intensity={0.8} />
                <directionalLight position={[5, 8, 5]} intensity={1.5} />
                <Universe data={d.data} hovered={hovered} setHovered={setHovered} />
                <OrbitControls enablePan={false} minDistance={5} maxDistance={14} />
              </Canvas>
            </div>
          )}
        </Card>
        <Card title={node ? node.label : 'Hover a category'} sub={node ? `${DIV_NAME[node.division]} · ${pct(node.adoption)} of partners buy it` : 'Its strongest co-purchase partners appear here'}>
          <ul className="space-y-2">
            {(links ?? []).slice(0, 10).map((e: any, i: number) => {
              const other = e.source === hovered ? e.target : e.source
              const on = d.data.nodes.find((n: any) => n.id === other)
              return (
                <li key={i} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2"><span className="size-2 rounded-full" style={{ background: DIV_COLORS_MAP[on?.division] }} />{on?.label}</span>
                  <span className={`num text-xs ${e.cross_division ? 'text-gold' : 'text-ink-soft'}`}>lift {e.lift}×</span>
                </li>
              )
            })}
          </ul>
          {!hovered && <p className="text-sm text-ink-soft">Gold arcs cross division boundaries — they are exactly the solution opportunities no single team can see today.</p>}
        </Card>
      </div>
    </Page>
  )
}
