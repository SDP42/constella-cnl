import { useGSAP } from '@gsap/react'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, ArrowUpRight, ChevronDown } from 'lucide-react'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Aura } from '@/components/Aura'
import { Glyph, GlyphRow, DIV_HEX, type DivCode } from '@/components/Glyph'
import { WireTicker } from '@/components/landing/WireTicker'
import CountUp from '@/components/reactbits/CountUp'
import SpotlightCard from '@/components/reactbits/SpotlightCard'
import { api, login } from '@/lib/api'
import { homeFor, type Role } from '@/lib/auth'
import { inr } from '@/lib/format'
import { gsap, prefersReducedMotion, ScrollTrigger, scrollToId, useSmoothScroll } from '@/lib/motion'

const NetworkFlight = lazy(() => import('@/components/three/NetworkFlight').then((m) => ({ default: m.NetworkFlight })))
const DIVS = ['EB', 'HON', 'FMSG', 'FMCT', 'SVC'] as const
const DIV_COLORS = ['#4f7bff', '#ffc21a', '#ff4d6d', '#9b6bff', '#19d39a']

const CHAPTERS = [
  { k: '01 · The network', short: 'Network', t: '', d: '600 partners across 24 cities — a sample of CNL’s 10,000-strong channel. Tower height is what each partner spends with CNL.', stat: '24 cities · 600 partners · 5 divisions' },
  { k: '02 · The silos', short: 'Silos', t: 'Five teams. Five slices.', d: 'Zoom into Pune: every tower splits into five colours. Each division sees only its own segment of the partner — nobody sees the whole.', stat: 'Each team sees 1 of 5 segments' },
  { k: '03 · The twin', short: 'Twin', t: 'TechNova, opened up.', d: 'Constella unifies every division record into one account twin. The glowing wireframe floors are what TechNova should be buying from CNL — and isn’t.', stat: 'Brands, gadgets and annuity: missing' },
  { k: '04 · The solution', short: 'Solution', t: 'Sell the building, not the bricks.', d: 'The missing floors fly in as one Smart Classroom solution — cabling, hubs and AMC — and an annuity ring starts turning.', stat: 'p = 0.58 · fits credit · 70/30 split credit' },
  { k: '05 · The machine', short: 'Routing', t: 'Every signal finds an owner.', d: 'Pull out: opportunities route from signal to the right rep in every city, with SLAs, escalation and automation behind them.', stat: '1,670 routed · 8 automation playbooks' },
]

const STEPS: { k: string; t: string; d: string; div: DivCode }[] = [
  { k: 'Model', t: 'Unify the partner', d: 'SAP B1, Tally, Zoho and Excel records stitched by GSTIN, PAN and fuzzy match into one account twin.', div: 'EB' },
  { k: 'Detect', t: 'Predict the next solution', d: 'Gradient-boosted propensity, co-purchase lift, solution coverage — back-tested against three baselines.', div: 'HON' },
  { k: 'Route', t: 'Give it an owner', d: 'One lead, assists on 70/30 split credit, overlap merge, an SLA ladder that ends in zero-touch nurture.', div: 'FMSG' },
  { k: 'Act', t: 'Make yes easy', d: 'Copilot pitch, one-click bill of materials, DaaS when credit blocks, WhatsApp-native automation.', div: 'FMCT' },
  { k: 'Prove', t: 'Earn the right to scale', d: 'Randomised holdout, uplift with confidence bands and month-2/3/4/6 scale-or-stop gates.', div: 'SVC' },
]

const INVENTIONS: { t: string; d: string; div: DivCode; span?: string; big?: boolean }[] = [
  { t: 'Value-at-Stake', d: 'Ranks every deal by margin × cash velocity × credit fit — CNL’s own Quadrant logic, as one number.', div: 'HON', span: 'md:col-span-2 md:row-span-2', big: true },
  { t: 'Cost of Delay', d: 'Idle opportunities show the ₹ they lose each day as the signal decays.', div: 'FMSG' },
  { t: 'DaaS-ify', d: 'Credit-blocked deal becomes a 36-month subscription: hardware margin now, annuity forever.', div: 'SVC' },
  { t: 'Whisper Capture', d: 'Paste one WhatsApp line — intent, quantity, timing and competitor are extracted and routed.', div: 'EB', span: 'md:col-span-2' },
  { t: 'Brand Bundle Lever', d: '“Want Honeywell? Stock WOZOYO.” Scarce brands unlock attach bundles automatically.', div: 'FMCT' },
  { t: 'Split-Credit Contract', d: 'Sharing an account never costs its owner — so nobody hoards.', div: 'HON' },
  { t: 'Agentic Copilot', d: 'LangGraph + Claude over the platform’s own tools, scoped by role, grounded in playbooks.', div: 'EB', span: 'md:col-span-2' },
  { t: 'FY29 Path', d: 'Run-rate vs the ₹6,000 Cr goal and 40% brand mix, with live scenario sliders.', div: 'FMSG' },
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
  const [chapter, setChapter] = useState(0)
  const net = useQuery({ queryKey: ['public-network'], queryFn: () => api('/api/public/network'), staleTime: 300_000 })
  const [busy, setBusy] = useState<string | null>(null)
  const [scrolled, setScrolled] = useState(false)
  const stats = useQuery({ queryKey: ['public-stats'], queryFn: () => api('/api/public/stats'), staleTime: 60_000 })

  useEffect(() => {
    const on = () => {
      setScrolled(scrollY > 30)
      const el = flightRef.current
      if (!el) return
      const top = el.offsetTop
      const span = el.offsetHeight - innerHeight
      const p = Math.min(1, Math.max(0, (scrollY - top) / span))
      progress.current = prefersReducedMotion() ? Math.max(p, 0.7) : p
      const c = p < 0.17 ? 0 : p < 0.36 ? 1 : p < 0.55 ? 2 : p < 0.76 ? 3 : 4
      setChapter((prev) => (prev === c ? prev : c))
    }
    on()
    addEventListener('scroll', on, { passive: true })
    return () => removeEventListener('scroll', on)
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
            {[['flight', 'Flight'], ['journey', 'How it works'], ['inventions', 'Inventions'], ['proof', 'Proof'], ['seats', 'Seats']].map(([id, l]) => (
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
      <section id="flight" ref={flightRef} className="relative h-[700vh] bg-[#0b0e22]" aria-label="Flight through CNL's partner network">
        <div className="sticky top-0 h-dvh w-full overflow-hidden">
          {net.data && (
            <Suspense fallback={null}>
              <NetworkFlight cities={net.data.cities} progress={progress} className="absolute inset-0" />
            </Suspense>
          )}
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(11,14,34,.92)_0%,rgba(11,14,34,.7)_32%,transparent_58%)]" />
          {/* chapters */}
          <div className="pointer-events-none absolute inset-0 mx-auto flex max-w-6xl items-center px-5">
            <div className="relative h-[60vh] w-full max-w-xl">
              {CHAPTERS.map((c, i) => (
                <article key={c.k} className={`absolute inset-0 flex flex-col justify-center text-white transition-all duration-700 ease-out ${chapter === i ? 'translate-y-0 opacity-100 blur-0' : chapter > i ? '-translate-y-10 opacity-0 blur-sm' : 'translate-y-10 opacity-0 blur-sm'}`}>
                  <p className="font-mono text-xs uppercase tracking-[0.2em] text-white/60">{c.k}</p>
                  {i === 0 ? (
                    <h1 className="mt-4 text-[clamp(2.6rem,6.6vw,6rem)] font-semibold leading-[0.95] tracking-tight">
                      One partner.<br />Every division.<br /><span className="spectrum-text">One view.</span>
                    </h1>
                  ) : (
                    <h2 className="mt-4 text-[clamp(2.2rem,5vw,4.4rem)] font-semibold leading-[1] tracking-tight">{c.t}</h2>
                  )}
                  <p className="mt-5 max-w-md text-lg leading-relaxed text-white/75">{c.d}</p>
                  {c.stat && <p className="mt-6 font-mono text-sm text-white/90"><span className="text-[#ffd166]">●</span> {c.stat}</p>}
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
          {/* progress rail */}
          <div className="absolute right-5 top-1/2 hidden -translate-y-1/2 flex-col items-end gap-3 md:flex" aria-hidden>
            {CHAPTERS.map((c, i) => (
              <div key={c.k} className="flex items-center gap-3">
                <span className={`font-mono text-[11px] uppercase tracking-widest transition-colors ${chapter === i ? 'text-white' : 'text-white/35'}`}>{c.short}</span>
                <span className={`h-[3px] rounded-full transition-all duration-500 ${chapter === i ? 'w-10 bg-white' : 'w-4 bg-white/30'}`} />
              </div>
            ))}
          </div>
          {/* division legend */}
          <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 flex-wrap justify-center gap-2" aria-label="Division colours">
            {DIVS.map((d, i) => (
              <span key={d} className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/85 backdrop-blur">
                <span className="size-2 rounded-full" style={{ background: DIV_COLORS[i], boxShadow: `0 0 10px ${DIV_COLORS[i]}` }} />
                {({ EB: 'Enterprise', HON: 'Licensed & own brands', FMSG: 'Gadgets & drones', FMCT: 'Consumer & AI', SVC: 'Annuity' } as Record<string, string>)[d]}
              </span>
            ))}
          </div>
        </div>
      </section>
      <div aria-hidden className="h-40 bg-gradient-to-b from-[#0b0e22] to-transparent" />

      <div className="relative z-10 mx-auto max-w-6xl px-3"><WireTicker /></div>

      {/* the problem */}
      <section className="mx-auto max-w-6xl px-5 py-32" aria-labelledby="problem-h">
        <div className="grid gap-12 md:grid-cols-12">
          <div className="md:col-span-5">
            <p className="label">The problem, in CNL’s words</p>
            <h2 id="problem-h" className="reveal mt-4 text-[clamp(2.2rem,4.8vw,4rem)] font-semibold leading-[1.02]">Each team sees only its own colour.</h2>
            <p className="reveal mt-6 text-lg leading-relaxed text-ink-soft">
              Purchases are spread across product divisions. Nobody sees when several products together form a solution — and headcount cannot grow
              with the portfolio.
            </p>
            <p className="label mt-8">Sources · CNL investor deck Q1 FY26 · Q2 FY27 earnings call, 29 Oct 2026</p>
          </div>
          <div className="grid grid-cols-2 gap-3 md:col-span-7 md:grid-cols-3">
            {[
              { v: '10,000+', l: 'channel partners', d: 'EB' },
              { v: '5,000+', l: 'SKUs across 25+ brands', d: 'FMSG' },
              { v: '5.31%', l: 'EBITDA margin, Q2 FY27', d: 'HON' },
              { v: '₹6,000 Cr', l: 'FY29 revenue goal', d: 'FMCT' },
              { v: '45 days', l: 'net working capital', d: 'SVC' },
              { v: '₹3,195 Cr', l: 'BharatNet order — the shift to solutions', d: 'EB' },
            ].map((b) => (
              <div key={b.l} className="reveal pane lift flex aspect-[1/1.05] flex-col justify-between p-5">
                <Glyph div={b.d} size={16} />
                <div>
                  <div className="text-[clamp(1.4rem,2.6vw,2.2rem)] font-semibold leading-none tracking-tight">{b.v}</div>
                  <div className="mt-2 text-sm text-ink-soft">{b.l}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* journey */}
      <section id="journey" className="mx-auto max-w-6xl px-5 pb-32" aria-labelledby="journey-h">
        <p className="label">Signal → signed → renewed</p>
        <h2 id="journey-h" className="reveal mt-4 text-[clamp(2.2rem,4.8vw,4rem)] font-semibold">Five moves, one solution.</h2>
        <ol className="relative mt-14 space-y-3">
          <span aria-hidden className="absolute bottom-6 left-[27px] top-6 w-[2px] rounded-full bg-gradient-to-b from-spec-eb via-spec-fmsg to-spec-svc opacity-60" />
          {STEPS.map((st, i) => (
            <li key={st.k} className="reveal pane lift relative grid items-center gap-4 p-5 pl-20 md:grid-cols-12">
              <span className="absolute left-4 top-1/2 grid size-[26px] -translate-y-1/2 place-items-center rounded-full bg-white shadow"><Glyph div={st.div} size={14} /></span>
              <div className="md:col-span-3">
                <div className="num text-xs text-ink-soft">0{i + 1}</div>
                <div className="text-3xl font-semibold tracking-tight">{st.k}</div>
              </div>
              <div className="text-lg font-medium md:col-span-3">{st.t}</div>
              <p className="text-ink-soft md:col-span-6">{st.d}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* inventions */}
      <section id="inventions" className="mx-auto max-w-6xl px-5 pb-32" aria-labelledby="inv-h">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
          <h2 id="inv-h" className="reveal text-[clamp(2.2rem,4.8vw,4rem)] font-semibold">Inventions</h2>
          <p className="reveal max-w-md text-ink-soft">Not another lead-scoring widget — each mechanism answers a constraint CNL actually has: thin margins, credit, silos, headcount.</p>
        </div>
        <div className="grid auto-rows-[minmax(180px,auto)] gap-3 md:grid-cols-4">
          {INVENTIONS.map((f, i) => (
            <SpotlightCard key={f.t} spotlightColor={`${DIV_HEX[f.div]}30`}
              className={`reveal pane lift !rounded-[20px] !border-white/90 !bg-white/80 !p-6 ${f.span ?? ''}`}>
              <div className="flex h-full flex-col justify-between gap-6">
                <div className="flex items-center justify-between">
                  <span className="num text-xs text-ink-soft">{String(i + 1).padStart(2, '0')}</span>
                  <Glyph div={f.div} size={f.big ? 40 : 18} />
                </div>
                <div>
                  <h3 className={`font-semibold tracking-tight ${f.big ? 'text-5xl' : 'text-xl'}`}>{f.t}</h3>
                  <p className={`mt-2 leading-relaxed text-ink-soft ${f.big ? 'max-w-sm text-lg' : 'text-sm'}`}>{f.d}</p>
                </div>
              </div>
            </SpotlightCard>
          ))}
        </div>
      </section>

      {/* proof */}
      <section id="proof" className="mx-auto max-w-6xl px-5 pb-32" aria-labelledby="proof-h">
        <div className="glass iris rounded-[32px] p-8 md:p-12">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 id="proof-h" className="text-[clamp(2rem,4.2vw,3.5rem)] font-semibold">Running live, right now.</h2>
            <p className="label">From the running API · synthetic CNL network</p>
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
              <div key={m.k}>
                <dt className="label">{m.k}</dt>
                <dd className="mt-2 text-4xl font-semibold tracking-tight md:text-5xl">
                  {m.v == null ? '—' : m.money ? inr(m.v, 1) : m.pct ? `${(m.v * 100).toFixed(1)}%` : m.dec ? m.v.toFixed(m.dec) : <CountUp to={m.v} separator="," duration={1.6} />}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* seats */}
      <section id="seats" className="mx-auto max-w-6xl px-5 pb-32" aria-labelledby="seats-h">
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

      <footer className="mx-auto max-w-6xl px-5 pb-12">
        <div className="glass flex flex-wrap items-center justify-between gap-4 rounded-3xl px-6 py-5 text-sm text-ink-soft">
          <span className="flex items-center gap-2"><GlyphRow size={8} gap={3} /> Constella — built for the Creative Newtech × E-Cell IIT Bombay hackathon</span>
          <span>Data is synthetic · company facts cited from CNL public filings</span>
        </div>
      </footer>
    </div>
  )
}
