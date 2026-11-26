import { ContactShadows, OrbitControls, RoundedBox } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { ArrowLeft, CheckCircle2, CircleDashed, Map as MapIcon } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { Mesh } from 'three'
import { useCanvasKick } from '@/components/three/useCanvasKick'
import { inr, pct, titleCase } from '@/lib/format'
import { Card, Loading, Page, Reasoning, useApi } from '../kit'
import { DIV_COLORS_MAP } from '../theme'

type Slot = { x: number; y: number; z: number; mesh: string }
type Comp = { category: string; label: string; role: string; status: 'owned' | 'missing'; units: number; value: number; division: string; brand: string; required: boolean; slots: Slot[] }

const DIMS: Record<string, [number, number, number]> = {
  panel: [2.3, 1.35, 0.08], projector: [0.45, 0.16, 0.38], box: [0.26, 0.07, 0.26], tray: [8.6, 0.06, 0.32], hub: [0.22, 0.05, 0.12],
  monitor: [0.07, 0.75, 1.3], speaker: [0.28, 0.42, 0.22], camera: [0.14, 0.14, 0.26], panelbox: [0.42, 0.62, 0.12], detector: [0.22, 0.05, 0.22],
  tower: [0.32, 0.95, 0.42], drone: [0.5, 0.08, 0.5], rack: [0.75, 2.0, 0.95],
}
const BODY: Record<string, string> = { panel: '#151515', projector: '#e7e5e4', box: '#2b2b2b', tray: '#9ca3af', hub: '#3a3a3a', monitor: '#1a1a1a', speaker: '#2d2d2d',
  camera: '#f5f5f4', panelbox: '#b42318', detector: '#fafaf9', tower: '#e7e5e4', drone: '#262626', rack: '#1f2937' }

function Device({ c, s, hot, onHover }: { c: Comp; s: Slot; hot: boolean; onHover: (v: string | null) => void }) {
  const ref = useRef<Mesh>(null)
  const ghost = c.status === 'missing'
  useFrame(({ clock }) => {
    if (!ref.current) return
    const k = ghost ? 0.35 + Math.sin(clock.elapsedTime * 2.4 + s.x) * 0.15 : 1
    ;(ref.current.material as any).opacity = hot ? Math.min(1, k + 0.35) : k
    ref.current.position.y = s.y + (ghost ? Math.sin(clock.elapsedTime * 1.6 + s.z) * 0.03 : 0)
  })
  const d = DIMS[s.mesh] ?? DIMS.box
  return (
    <group>
      <mesh ref={ref} position={[s.x, s.y, s.z]} castShadow onPointerOver={(e) => { e.stopPropagation(); onHover(c.category) }} onPointerOut={() => onHover(null)}>
        <boxGeometry args={d} />
        {ghost
          ? <meshStandardMaterial color="#F5B700" emissive="#F5B700" emissiveIntensity={hot ? 1.2 : 0.6} transparent opacity={0.4} wireframe={false} roughness={0.3} />
          : <meshStandardMaterial color={BODY[s.mesh] ?? '#444'} roughness={0.45} metalness={0.25} transparent opacity={1} />}
      </mesh>
      {!ghost && s.mesh === 'panel' && <mesh position={[s.x, s.y, s.z + 0.045]}><planeGeometry args={[2.18, 1.23]} /><meshStandardMaterial color="#1e3a5f" emissive="#3E5C76" emissiveIntensity={0.9} /></mesh>}
      {!ghost && s.mesh === 'monitor' && <mesh position={[s.x + (s.x < 0 ? 0.04 : -0.04), s.y, s.z]} rotation={[0, s.x < 0 ? Math.PI / 2 : -Math.PI / 2, 0]}><planeGeometry args={[1.2, 0.66]} /><meshStandardMaterial color="#1e3a5f" emissive="#3E5C76" emissiveIntensity={0.8} /></mesh>}
      {ghost && <mesh position={[s.x, s.y, s.z]}><boxGeometry args={[d[0] + 0.06, d[1] + 0.06, d[2] + 0.06]} /><meshBasicMaterial color="#F5B700" wireframe transparent opacity={0.55} /></mesh>}
    </group>
  )
}

function Room({ comps, hot, setHot }: { comps: Comp[]; hot: string | null; setHot: (v: string | null) => void }) {
  const desks = useMemo(() => {
    const out: [number, number][] = []
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) out.push([-3 + c * 2, -0.8 + r * 1.5])
    return out
  }, [])
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[10, 8]} /><meshStandardMaterial color="#d6c7ae" roughness={0.85} /></mesh>
      <mesh position={[0, 1.5, -4]} receiveShadow><boxGeometry args={[10, 3, 0.1]} /><meshStandardMaterial color="#F7F5F1" roughness={0.95} /></mesh>
      <mesh position={[-5, 1.5, 0]} receiveShadow><boxGeometry args={[0.1, 3, 8]} /><meshStandardMaterial color="#EFEAE2" roughness={0.95} /></mesh>
      <mesh position={[5, 0.06, 0]} receiveShadow><boxGeometry args={[0.1, 0.12, 8]} /><meshStandardMaterial color="#cbbfae" /></mesh>
      {/* window on the left wall */}
      <mesh position={[-4.94, 1.8, 1.2]} rotation={[0, Math.PI / 2, 0]}><planeGeometry args={[3.2, 1.2]} /><meshStandardMaterial color="#cfe3f5" emissive="#cfe3f5" emissiveIntensity={0.6} /></mesh>
      {desks.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <RoundedBox args={[1.4, 0.05, 0.6]} radius={0.02} position={[0, 0.74, 0]} castShadow receiveShadow><meshStandardMaterial color="#a68a64" roughness={0.6} /></RoundedBox>
          <mesh position={[0, 0.37, 0]}><boxGeometry args={[1.3, 0.72, 0.04]} /><meshStandardMaterial color="#57534e" /></mesh>
          <mesh position={[0, 0.25, 0.55]} castShadow><boxGeometry args={[0.42, 0.5, 0.42]} /><meshStandardMaterial color="#3E5C76" roughness={0.7} /></mesh>
        </group>
      ))}
      {comps.flatMap((c) => c.slots.map((s, i) => <Device key={`${c.category}-${i}`} c={c} s={s} hot={hot === c.category} onHover={setHot} />))}
    </group>
  )
}

export default function SiteTwin() {
  const { id } = useParams()
  const [sol, setSol] = useState<string | null>(null)
  const [hot, setHot] = useState<string | null>(null)
  const d = useApi<any>(['site', id, sol], `/api/geo/site/${id}${sol ? `?solution=${sol}` : ''}`)
  useCanvasKick(d.data)
  const x = d.data
  if (!x) return <Page title="Site twin"><Loading rows={8} /></Page>
  const hc = x.components.find((c: Comp) => c.category === hot)
  return (
    <Page kicker={<span className="flex items-center gap-2"><Link to="/app/territory" className="flex items-center gap-1 hover:text-gold"><ArrowLeft className="size-3" />Territory</Link> · Site twin · {x.account.city}</span>}
      title={<>{x.solution.name} <span className="text-ink-soft">at</span> {x.account.name}</>}
      actions={<div className="flex flex-wrap gap-1.5">{x.alternatives.map((a: any) => <button key={a.id} onClick={() => setSol(a.id)} className={`rounded-full px-3 py-1.5 text-xs ${a.id === x.solution.id ? 'bg-ink text-white' : 'bg-white'}`}>{a.name}</button>)}</div>}>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="relative h-[66vh] min-h-[480px] overflow-hidden rounded-[26px] bg-gradient-to-b from-[#efe9df] to-[#d9cfbf]">
          <Canvas shadows dpr={[1, 2]} camera={{ position: [7.5, 6.2, 8.5], fov: 38 }}>
            <hemisphereLight args={['#fff7ea', '#8a7a66', 0.85]} />
            <directionalLight position={[6, 9, 4]} intensity={1.6} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-7} shadow-camera-right={7} shadow-camera-top={7} shadow-camera-bottom={-7} />
            <pointLight position={[0, 2.6, 0]} intensity={6} distance={9} color="#ffe7b8" />
            <Room comps={x.components} hot={hot} setHot={setHot} />
            <ContactShadows position={[0, 0.005, 0]} opacity={0.35} scale={12} blur={2.4} far={3} />
            <OrbitControls target={[0, 1, -0.5]} minDistance={5} maxDistance={18} maxPolarAngle={Math.PI / 2.15} autoRotate autoRotateSpeed={0.35} enableDamping />
          </Canvas>
          <div className="pointer-events-none absolute left-4 top-4 flex gap-2 text-[11px]">
            <span className="flex items-center gap-1.5 rounded-full bg-white/85 px-3 py-1 backdrop-blur"><span className="size-2 rounded-full bg-ink" />Owned</span>
            <span className="flex items-center gap-1.5 rounded-full bg-white/85 px-3 py-1 backdrop-blur"><span className="size-2 rounded-full bg-gold-bright" />Missing (ghost)</span>
          </div>
          {hc && (
            <div className="pointer-events-none absolute bottom-4 left-4 rounded-2xl bg-night/85 px-4 py-3 text-white backdrop-blur">
              <p className="font-mono text-[10px] uppercase tracking-widest text-white/50">{hc.role}</p>
              <p className="font-semibold">{hc.label} · {hc.brand}</p>
              <p className="text-xs text-white/70">{hc.units} units · {inr(hc.value)} · {hc.status === 'owned' ? 'already installed' : 'not yet bought from CNL'}</p>
            </div>
          )}
          <p className="absolute bottom-3 right-4 text-[10px] text-ink-soft">Drag to orbit · scroll to zoom · hover a device</p>
        </div>

        <div className="space-y-4">
          <div className="pane relative overflow-hidden p-5">
            <div className="flex items-center gap-5">
              <svg viewBox="0 0 120 120" className="size-28 shrink-0 -rotate-90">
                <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(28,25,23,.08)" strokeWidth="12" />
                <circle cx="60" cy="60" r="50" fill="none" stroke="#A16207" strokeWidth="12" strokeLinecap="round" strokeDasharray={`${x.completion * 314} 314`} />
              </svg>
              <div>
                <p className="label">Solution completion</p>
                <p className="num text-4xl font-semibold">{pct(x.completion)}</p>
                <p className="text-xs text-ink-soft">Owned {inr(x.owned_value)} · gap <b className="text-gold">{inr(x.gap_value)}</b></p>
              </div>
            </div>
            <p className="mt-3 text-sm text-ink-soft">{x.solution.tagline}</p>
          </div>
          <Card title="Bill of materials on site" sub={`Sized for ${x.account.employees} people · ${titleCase(x.account.vertical)}`} pad={false}>
            <ul className="divide-y divide-ink/5">
              {x.components.map((c: Comp) => (
                <li key={c.category} onMouseEnter={() => setHot(c.category)} onMouseLeave={() => setHot(null)} className={`flex items-center gap-3 px-5 py-2.5 text-sm transition ${hot === c.category ? 'bg-gold/5' : ''}`}>
                  {c.status === 'owned' ? <CheckCircle2 className="size-4 shrink-0 text-spec-svc" /> : <CircleDashed className="size-4 shrink-0 text-gold" />}
                  <div className="min-w-0 flex-1"><div className="truncate font-medium">{c.label} <span className="text-xs font-normal text-ink-soft">× {c.units}</span></div><div className="truncate text-[11px] text-ink-soft">{c.role} · {c.brand}{c.required ? '' : ' · optional'}</div></div>
                  <span className="size-2 rounded-full" style={{ background: DIV_COLORS_MAP[c.division] }} title={c.division} />
                  <span className={`num text-xs ${c.status === 'missing' ? 'font-semibold text-gold' : 'text-ink-soft'}`}>{inr(c.value)}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card title="Recurring layer" sub="Annuity attached once the site is complete">
            <ul className="space-y-1 text-sm">{x.annuity.map((a: any) => <li key={a.category} className="flex justify-between"><span>{a.label}</span><span className="num">{inr(a.value)}/yr</span></li>)}</ul>
            <div className="mt-3 flex gap-2">
              <Link to="/app/solutions" className="rounded-full bg-ink px-4 py-2 text-xs font-medium text-white">Compose proposal</Link>
              <Link to={`/app/accounts/${x.account.id}`} className="flex items-center gap-1 rounded-full bg-ink/5 px-4 py-2 text-xs"><MapIcon className="size-3.5" />Account twin</Link>
            </div>
            <Reasoning how={x.how} why="A partner sees one room where some devices are real and some are gold ghosts. That makes the missing value concrete, and it's how a CNL architect would walk through a site survey." />
          </Card>
        </div>
      </div>
    </Page>
  )
}
