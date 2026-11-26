import { useGSAP } from '@gsap/react'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, ArrowUpRight, ChevronDown } from 'lucide-react'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Aura } from '@/components/Aura'
import { Glyph, GlyphRow, DIV_HEX, type DivCode } from '@/components/Glyph'
import { AppPreview } from '@/components/landing/AppPreview'
import { Brief } from '@/components/landing/Brief'
import { FivePoints } from '@/components/landing/FivePoints'
import { SolutionReel } from '@/components/landing/SolutionReel'
import CountUp from '@/components/reactbits/CountUp'
import { api, login } from '@/lib/api'
import { homeFor, type Role } from '@/lib/auth'
import { inr } from '@/lib/format'
import { gsap, prefersReducedMotion, ScrollTrigger, scrollToId, useSmoothScroll } from '@/lib/motion'

import networkSnapshot from '@/data/network.snapshot.json'
import statsSnapshot from '@/data/stats.snapshot.json'

const Globe = lazy(() => import('@/components/three/Globe').then((m) => ({ default: m.Globe })))

const CHAPTERS = [
  { k: '01 · The network', short: 'Network', t: '', d: 'CNL reaches 10,000+ channel partners across India — resellers, system integrators, retailers and enterprises — through five product divisions.', stat: 'Mumbai HQ · 31+ branches · 25+ brands' },
  { k: '02 · The routes', short: 'Routes', t: 'Every city. Every division.', d: 'Each partner buys from several divisions, but each division sees only its own slice. Constella stitches every slice into one account twin.', stat: '24 cities · 600 sample partners · 1 golden record each' },
  { k: '03 · One partner', short: 'Zoom', t: 'Zoom into Pune.', d: 'TechNova Systems buys panels and PCs — but no cabling, hubs or AMC. Constella spots the missing Smart Classroom, routes it to the right owner and drafts the pitch.', stat: 'p = 0.58 · fits credit · 70/30 split credit' },
]

const SEATS: { key: string; name: string; role: Role; title: string; div: DivCode }[] = [
  { key: 'priya', name: 'Priya Nair', role: 'rep', title: 'Key Account Manager · Enterprise', div: 'EB' },
  { key: 'arjun', name: 'Arjun Mehta', role: 'rep', title: 'Channel Sales · Gadgets', div: 'FMSG' },
  { key: 'rakesh', name: 'Rakesh Iyer', role: 'head', title: 'National Sales Head', div: 'HON' },
  { key: 'meera', name: 'Meera Shah', role: 'architect', title: 'Solutions Architect', div: 'FMCT' },
  { key: 'neha', name: 'Neha Kulkarni', role: 'steward', title: 'Data & RevOps Steward', div: 'SVC' },
  { key: 'vikram', name: 'Vikram Rao', role: 'partner', title: 'Partner · TechNova Systems', div: 'EB' },
]

export default function Landing() {
  useSmoothScroll()
  const nav = useNavigate()
  const root = useRef<HTMLDivElement>(null)
  const progress = useRef(0)
  const flightRef = useRef<HTMLElement>(null)
  const globeWrap = useRef<HTMLDivElement>(null)
  const [chapter, setChapter] = useState(0)
  // baked snapshots render instantly while the (possibly sleeping) free-tier API wakes up
  const net = useQuery<any>({ queryKey: ['public-network'], queryFn: () => api('/api/public/network'), staleTime: 300_000, placeholderData: networkSnapshot as any })
  const [busy, setBusy] = useState<string | null>(null)
  const [scrolled, setScrolled] = useState(false)
  const stats = useQuery<any>({ queryKey: ['public-stats'], queryFn: () => api('/api/public/stats'), staleTime: 60_000, placeholderData: statsSnapshot as any })

  // R3F measures its container once; nudge it after the sticky stage has laid out
  useEffect(() => {
    if (!net.data) return
    const ids = [120, 600, 1500].map((ms) => setTimeout(() => dispatchEvent(new Event('resize')), ms))
    return () => ids.forEach(clearTimeout)
  }, [net.data])

  useEffect(() => {
    const on = () => {
      setScrolled(scrollY > 30)
      const el = flightRef.current
      if (!el) return
      const top = el.offsetTop
      const span = el.offsetHeight - innerHeight
      const p = Math.min(1, Math.max(0, (scrollY - top) / span))
      progress.current = prefersReducedMotion() ? Math.max(p, 0.7) : p
      // exit: blur-zoom-through into the constellation
      const out = Math.min(1, Math.max(0, (p - 0.86) / 0.14))
      if (globeWrap.current) {
        globeWrap.current.style.filter = `blur(${(out * 18).toFixed(1)}px)`
        globeWrap.current.style.transform = `scale(${(1 + out * 0.35).toFixed(3)})`
        globeWrap.current.style.opacity = String(1 - out)
      }
      const c = p < 0.3 ? 0 : p < 0.62 ? 1 : 2
      setChapter((prev) => (prev === c ? prev : c))
    }
    on()
    // re-measure once layout settles (fonts, images, restored scroll), otherwise the first frame can show the wrong chapter
    const ids = [50, 300, 1000, 2500].map((ms) => setTimeout(on, ms))
    addEventListener('scroll', on, { passive: true })
    addEventListener('resize', on)
    addEventListener('load', on)
    return () => { ids.forEach(clearTimeout); removeEventListener('scroll', on); removeEventListener('resize', on); removeEventListener('load', on) }
  }, [])

  useGSAP(
    () => {
      if (prefersReducedMotion()) return
      gsap.utils.toArray<HTMLElement>('.reveal').forEach((el, i) =>
        gsap.from(el, { y: 40, opacity: 0, filter: 'blur(6px)', duration: 1, ease: 'expo.out', delay: (i % 4) * 0.05,
          scrollTrigger: { trigger: el, start: 'top 90%', once: true } }),
      )
      document.fonts?.ready.then(() => ScrollTrigger.refresh())
    },
    { scope: root },
  )

  const enter = async (key: string, role: Role) => {
    setBusy(key)
    try {
      await login(key)
      nav(homeFor(role))
    } finally {
      setBusy(null)
    }
  }
  const s = stats.data

  return (
    <div ref={root} className="relative overflow-x-clip text-ink">
      <Aura />

      {/* nav — glass */}
      <header className="fixed inset-x-0 top-3 z-50 flex justify-center px-3">
        <div className={`glass iris ${!scrolled ? '!bg-white/80' : ''} flex w-full max-w-6xl items-center justify-between rounded-full px-4 py-2 transition-all duration-300 ${scrolled ? 'shadow-xl' : ''}`}>
          <a href="#top" className="flex items-center gap-2.5 pl-1" aria-label="Constella home">
            <GlyphRow size={9} gap={3} />
            <span className="text-[17px] font-semibold tracking-tight">Constella</span>
          </a>
          <nav className="hidden items-center gap-1 text-sm md:flex">
            {[['brief', 'The brief'], ['solutions', 'Solutions'], ['journey', 'Our answer'], ['proof', 'Proof'], ['seats', 'Seats']].map(([id, l]) => (
              <button key={id} onClick={() => scrollToId(id)} className="rounded-full px-3.5 py-1.5 text-ink-soft transition-colors hover:bg-white/70 hover:text-ink">
                {l}
              </button>
            ))}
          </nav>
          <button onClick={() => scrollToId('seats')} className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-white transition-transform hover:scale-[1.03]">
            Open workspace
          </button>
        </div>
      </header>

      {/* cinematic 3D flight through the partner network (sticky stage, scroll-scrubbed) */}
      <section id="flight" ref={flightRef} className="relative h-[280vh] bg-night" aria-label="Flight through CNL's partner network">
        <div className="sticky top-0 h-dvh w-full overflow-hidden">
          {net.data && (
            <div ref={globeWrap} className="absolute inset-0 will-change-[filter,transform,opacity]">
              <Suspense fallback={null}>
                <Globe cities={net.data.cities} progress={progress} className="absolute inset-0" />
              </Suspense>
            </div>
          )}
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(12,10,9,.9)_0%,rgba(12,10,9,.55)_34%,transparent_60%)]" />
          {/* chapters */}
          <div className="pointer-events-none absolute inset-0 mx-auto flex max-w-6xl items-center px-5">
            <div className="relative h-[60vh] w-full max-w-xl">
              {CHAPTERS.map((c, i) => (
                <article key={c.k} className={`absolute inset-0 flex flex-col justify-center text-white transition-all duration-700 ease-out ${chapter === i ? 'translate-y-0 opacity-100 blur-0' : chapter > i ? '-translate-y-10 opacity-0 blur-sm' : 'translate-y-10 opacity-0 blur-sm'}`}>
                  <p className="font-mono text-xs uppercase tracking-[0.2em] text-white/60">{c.k}</p>
                  {i === 0 ? (
                    <h1 className="mt-4 text-[clamp(2.6rem,6.6vw,6rem)] font-semibold leading-[0.95] tracking-tight">
                      One partner.<br />Every division.<br /><span className="spectrum-text italic">One view.</span>
                    </h1>
                  ) : (
                    <h2 className="mt-4 text-[clamp(2.2rem,5vw,4.4rem)] font-semibold leading-[1] tracking-tight">{c.t}</h2>
                  )}
                  <p className="mt-5 max-w-md text-lg leading-relaxed text-white/75">{c.d}</p>
                  {c.stat && <p className="mt-6 font-mono text-sm text-white/90"><span className="text-gold-bright">●</span> {c.stat}</p>}
                  {i === 0 && (
                    <div className="pointer-events-auto mt-8 flex gap-3">
                      <button onClick={() => scrollToId('seats')} className="flex items-center gap-2 rounded-full bg-white px-6 py-3.5 font-medium text-ink transition-transform hover:scale-[1.03]">
                        Choose a seat <ArrowRight className="size-4" />
                      </button>
                      <span className="flex items-center gap-2 rounded-full border border-white/25 px-5 py-3.5 text-sm text-white/80">Scroll to fly in <ChevronDown className="size-4 animate-bounce" /></span>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </div>
          {/* Pune zoom: the account twin surfaces from the map */}
          <div className={`pointer-events-none absolute bottom-[14%] right-[6%] hidden w-80 rounded-2xl border border-white/15 bg-black/45 p-4 text-white backdrop-blur-xl transition-all duration-700 lg:block ${chapter === 2 ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'}`}>
            <p className="font-mono text-[10px] uppercase tracking-widest text-white/50">Account twin · Pune</p>
            <p className="mt-1 text-lg font-semibold">TechNova Systems</p>
            <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-white/10"><span className="bg-[#3e5c76]" style={{ width: '81%' }} /><span className="bg-[#6b4e71]" style={{ width: '19%' }} /></div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div><p className="text-white/50">Wallet share</p><p className="num text-base font-semibold">6%</p></div>
              <div><p className="text-white/50">Next best</p><p className="font-semibold text-gold-bright">Smart Classroom</p></div>
            </div>
            <p className="mt-3 text-[11px] text-white/60">Missing: Honeywell cabling & hubs · display AMC · drone kits</p>
          </div>
          {/* progress rail */}
          <div className="absolute right-5 top-1/2 hidden -translate-y-1/2 flex-col items-end gap-3 md:flex" aria-hidden>
            {CHAPTERS.map((c, i) => (
              <div key={c.k} className="flex items-center gap-3">
                <span className={`font-mono text-[11px] uppercase tracking-widest transition-colors ${chapter === i ? 'text-white' : 'text-white/35'}`}>{c.short}</span>
                <span className={`h-[3px] rounded-full transition-all duration-500 ${chapter === i ? 'w-10 bg-white' : 'w-4 bg-white/30'}`} />
              </div>
            ))}
          </div>
        </div>
      </section>
      <Brief />

      <SolutionReel />

      <FivePoints s={stats.data} />

      <AppPreview />

      {/* capabilities — two marquee rows moving in opposite directions (L→R / R→L), words only */}
      <section id="inventions" className="overflow-hidden py-24" aria-label="Capabilities">
        {[0, 1].map((row) => (
          <div key={row} className={`flex w-max gap-12 py-3 ${row ? 'animate-[marquee_46s_linear_infinite_reverse]' : 'animate-marquee'}`}>
            {Array.from({ length: 2 }).flatMap((_, k) =>
              (row ? ['Deal desk', 'Credit grades', 'Annuity ledger', 'Brand portal', 'Churn radar', 'FY29 path', 'Pilot lab', 'Audit trail']
                : ['Account twin', 'Next-best solution', 'Value-at-stake', 'Whisper capture', 'Split credit', 'DaaS-ify', 'Voice copilot', 'Zero-touch renewal']
              ).map((w, i) => (
                <span key={`${k}-${i}`} className="flex items-center gap-12 whitespace-nowrap text-[clamp(1.8rem,4vw,3.6rem)] font-medium tracking-[-0.03em] text-ink/85">
                  {w}<span className="size-2 rounded-full bg-gold-bright" />
                </span>
              )))}
          </div>
        ))}
      </section>

      {/* proof */}
      <section id="proof" className="bg-night px-5 py-28 text-white" aria-labelledby="proof-h">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 id="proof-h" className="text-[clamp(2rem,4.2vw,3.5rem)] font-semibold">Running live, right now.</h2>
            <p className="font-mono text-[11px] uppercase tracking-widest text-white/50">From the running API · synthetic CNL network</p>
          </div>
          <dl className="mt-10 grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-4">
            {[
              { k: 'Raw division records', v: s?.raw_records },
              { k: 'Golden partners', v: s?.accounts },
              { k: 'Signals detected', v: s?.signals },
              { k: 'Opportunities routed', v: s?.opportunities },
              { k: 'Open pipeline', v: s?.pipeline_value, money: true },
              { k: 'Annuity identified', v: s?.annuity_value, money: true },
              { k: 'Model AUC · back-test', v: s?.auc, dec: 3 },
              { k: 'Entity-match precision', v: s?.resolution_precision, pct: true },
            ].map((m) => (
              <div key={m.k} className="reveal border-t border-white/10 pt-4">
                <dt className="font-mono text-[11px] uppercase tracking-widest text-white/50">{m.k}</dt>
                <dd className="num mt-2 text-4xl font-semibold tracking-tight text-gold-bright md:text-5xl">
                  {m.v == null ? '—' : m.money ? inr(m.v, 1) : m.pct ? `${(m.v * 100).toFixed(1)}%` : m.dec ? m.v.toFixed(m.dec) : <CountUp to={m.v} separator="," duration={1.6} />}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* seats */}
      <section id="seats" className="mx-auto max-w-6xl px-5 py-32" aria-labelledby="seats-h">
        <h2 id="seats-h" className="reveal text-[clamp(2.2rem,4.8vw,4rem)] font-semibold">Take a seat.</h2>
        <p className="reveal mt-3 max-w-lg text-lg text-ink-soft">Six people, six jobs, one data model. Each seat signs in with its own role, territory and data permissions.</p>
        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SEATS.map((p) => (
            <button key={p.key} onClick={() => enter(p.key, p.role)} disabled={!!busy}
              className="reveal pane lift group relative flex min-h-48 flex-col justify-between overflow-hidden p-6 text-left disabled:opacity-60">
              <span aria-hidden className="absolute -right-10 -top-10 size-40 rounded-full opacity-25 blur-2xl transition-opacity duration-500 group-hover:opacity-60"
                style={{ background: DIV_HEX[p.div] }} />
              <div className="relative flex items-center justify-between">
                <span className="label">{p.role}</span>
                <span className="grid size-9 place-items-center rounded-full bg-ink text-white transition-transform duration-300 group-hover:rotate-45"><ArrowUpRight className="size-4" /></span>
              </div>
              <div className="relative">
                <div className="flex items-center gap-2"><Glyph div={p.div} size={12} /><span className="text-2xl font-semibold tracking-tight">{p.name}</span></div>
                <div className="mt-1 text-sm text-ink-soft">{busy === p.key ? 'Signing in…' : p.title}</div>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="bg-night px-5 py-32 text-center text-white">
        <p className="mx-auto max-w-4xl text-[clamp(2.4rem,6vw,5.5rem)] font-semibold leading-[1.02] tracking-tight">
          Sell the <span className="spectrum-text italic">solution</span>.<br />Keep the <span className="spectrum-text italic">service</span>.
        </p>
        <button onClick={() => scrollToId('seats')} className="mt-10 rounded-full bg-gold-bright px-8 py-4 font-semibold text-ink transition-transform hover:scale-[1.04]">Open the workspace</button>
      </section>

      <footer className="mx-auto max-w-6xl px-5 py-10">
        <div className="glass flex flex-wrap items-center justify-between gap-4 rounded-3xl px-6 py-5 text-sm text-ink-soft">
          <span className="flex items-center gap-2"><GlyphRow size={8} gap={3} /> Constella — built for the Creative Newtech × E-Cell IIT Bombay hackathon</span>
          <span>Data is synthetic · company facts cited from CNL public filings</span>
        </div>
      </footer>
    </div>
  )
}
