import { useGSAP } from '@gsap/react'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, ArrowUpRight } from 'lucide-react'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Glyph, GlyphRow, type DivCode } from '@/components/Glyph'
import { Cursor } from '@/components/landing/Cursor'
import { WireTicker } from '@/components/landing/WireTicker'
import CountUp from '@/components/reactbits/CountUp'
import Magnet from '@/components/reactbits/Magnet'
import { api, login } from '@/lib/api'
import { homeFor, type Role } from '@/lib/auth'
import { inr } from '@/lib/format'
import { gsap, prefersReducedMotion, ScrollTrigger, scrollToId, useSmoothScroll } from '@/lib/motion'

const Machine = lazy(() => import('@/components/three/Machine').then((m) => ({ default: m.Machine })))

const STAGES = [
  { n: '01', title: 'Silos', body: 'Five divisions. Five piles of parts. Each team sees only its own slice of the partner.', color: '#d02020' },
  { n: '02', title: 'Twin', body: 'Every division record stitched into one golden partner — GSTIN, PAN and fuzzy matching.', color: '#1040c0' },
  { n: '03', title: 'Machine', body: 'Parts assemble into solutions; annuity rings start turning. Revenue per partner compounds.', color: '#1e8f4e' },
]

const STEPS = [
  { k: 'MODEL', t: 'Unify the partner', d: 'Purchases, installed base, credit, notes and signals from SAP B1, Tally, Zoho and Excel → one account twin.', div: 'EB' },
  { k: 'DETECT', t: 'Predict the next machine', d: 'Gradient-boosted propensity + co-purchase lift + solution coverage, back-tested against 3 baselines.', div: 'HON' },
  { k: 'ROUTE', t: 'Give it an owner', d: 'One lead, assists with 70/30 split credit, overlap merge, SLA ladder that ends in zero-touch nurture.', div: 'FMSG' },
  { k: 'ACT', t: 'Make it easy to say yes', d: 'Copilot pitch, one-click BOM, DaaS-ify when credit blocks, WhatsApp-native automation.', div: 'FMCT' },
  { k: 'PROVE', t: 'Earn the right to scale', d: 'Randomised holdout, uplift with confidence bands, month-2/3/4/6 scale-or-stop gates.', div: 'SVC' },
] as const

const INVENTIONS = [
  { t: 'Value-at-Stake', d: 'Ranks by margin × cash velocity × credit fit — CNL’s own Quadrant logic as one number.', div: 'HON', span: 'md:col-span-2 md:row-span-2', big: true },
  { t: 'Cost of Delay', d: 'Every idle opportunity shows ₹ lost per day as its signal decays.', div: 'FMSG', span: '' },
  { t: 'DaaS-ify', d: 'Credit-blocked deal? Turn it into a 36-month subscription. Hardware margin + annuity.', div: 'SVC', span: '' },
  { t: 'Whisper Capture', d: 'Paste a WhatsApp line — intent, quantity, timing, competitor extracted and routed.', div: 'EB', span: 'md:col-span-2' },
  { t: 'Brand Bundle Lever', d: '“Want Honeywell? Stock WOZOYO.” Scarce brands unlock attach bundles automatically.', div: 'FMCT', span: '' },
  { t: 'Split-Credit Contract', d: 'Sharing an account never costs the owner. Hoarding disappears.', div: 'HON', span: '' },
  { t: 'Agentic Copilot', d: 'LangGraph + Claude over the platform’s own tools, RBAC-scoped, with RAG playbooks.', div: 'EB', span: 'md:col-span-2' },
  { t: 'FY29 Path', d: 'Live run-rate vs the ₹6,000 Cr goal and 40% brand mix, with scenario sliders.', div: 'FMSG', span: '' },
]

const SEATS: { key: string; name: string; role: Role; title: string; div: DivCode }[] = [
  { key: 'priya', name: 'Priya Nair', role: 'rep', title: 'Key Account Manager · EB', div: 'EB' },
  { key: 'arjun', name: 'Arjun Mehta', role: 'rep', title: 'Channel Sales · FMSG', div: 'FMSG' },
  { key: 'rakesh', name: 'Rakesh Iyer', role: 'head', title: 'National Sales Head', div: 'HON' },
  { key: 'meera', name: 'Meera Shah', role: 'architect', title: 'Solutions Architect', div: 'FMCT' },
  { key: 'neha', name: 'Neha Kulkarni', role: 'steward', title: 'Data & RevOps Steward', div: 'SVC' },
  { key: 'vikram', name: 'Vikram Rao', role: 'partner', title: 'Partner · TechNova Systems', div: 'EB' },
]

function KineticHeadline() {
  const lines = [['SELL', 'THE'], ['MACHINE,'], ['NOT', 'THE'], ['PARTS.']]
  return (
    <h1 className="display text-[clamp(3.2rem,9.2vw,9.6rem)]" aria-label="Sell the machine, not the parts.">
      {lines.map((ln, i) => (
        <span key={i} className="block overflow-hidden pb-[0.04em]" aria-hidden>
          {ln.map((w, j) => (
            <span key={j} className={`kin-word mr-[0.18em] inline-block ${w === 'MACHINE,' ? 'text-bau-blue' : ''} ${w === 'PARTS.' ? 'text-stroke' : ''}`}>
              {w}
            </span>
          ))}
        </span>
      ))}
    </h1>
  )
}

export default function Landing() {
  useSmoothScroll()
  const nav = useNavigate()
  const root = useRef<HTMLDivElement>(null)
  const stage = useRef(0)
  const [stageIdx, setStageIdx] = useState(0)
  const [busy, setBusy] = useState<string | null>(null)
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const on = () => setScrolled(scrollY > 40)
    addEventListener('scroll', on, { passive: true })
    return () => removeEventListener('scroll', on)
  }, [])
  const stats = useQuery({ queryKey: ['public-stats'], queryFn: () => api('/api/public/stats'), staleTime: 60_000 })

  useGSAP(
    () => {
      const reduced = prefersReducedMotion()
      gsap.from('.kin-word', { yPercent: 110, rotate: 6, duration: 1.05, ease: 'expo.out', stagger: 0.07, delay: 0.15 })
      gsap.from('.hero-meta > *', { opacity: 0, y: 14, duration: 0.6, stagger: 0.06, delay: 0.7, ease: 'power3.out' })
      if (reduced) {
        stage.current = 2
        setStageIdx(2)
        return
      }
      ScrollTrigger.create({
        trigger: '#machine-pin',
        start: 'top top',
        end: '+=220%',
        pin: true,
        scrub: 1,
        onUpdate: (self) => {
          stage.current = self.progress * 2.15
          setStageIdx(self.progress < 0.33 ? 0 : self.progress < 0.7 ? 1 : 2)
        },
      })
      gsap.utils.toArray<HTMLElement>('.reveal').forEach((el) =>
        gsap.from(el, { y: 60, opacity: 0, duration: 0.9, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 88%', once: true } }),
      )
      // horizontal journey through the 5 PS steps
      const track = document.querySelector<HTMLElement>('#journey-track')
      if (track) {
        gsap.to(track, {
          x: () => -(track.scrollWidth - innerWidth + 48),
          ease: 'none',
          scrollTrigger: { trigger: '#journey', start: 'top top', end: () => `+=${track.scrollWidth}`, pin: true, scrub: 1, invalidateOnRefresh: true },
        })
      }
      gsap.utils.toArray<HTMLElement>('.spin-in').forEach((el, i) =>
        gsap.from(el, { rotate: i % 2 ? -12 : 12, y: 80, opacity: 0, duration: 0.9, ease: 'back.out(1.4)', delay: (i % 3) * 0.08,
          scrollTrigger: { trigger: el, start: 'top 92%', once: true } }),
      )
      // positions shift once fonts and the 3D canvas settle
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
    <div ref={root} className="relative overflow-x-clip bg-bone text-ink">
      <Cursor />

      {/* ——— nav ——— */}
      <header className={`fixed inset-x-0 top-0 z-50 flex items-center justify-between px-5 py-3.5 transition-colors duration-200 md:px-10 ${scrolled ? 'border-b-2 border-ink bg-bone/90 backdrop-blur' : ''}`}>
        <a href="#top" className="flex items-center gap-3" data-cursor="top" aria-label="Constella home">
          <GlyphRow size={16} gap={3} />
          <span className="display text-xl tracking-tight">Constella</span>
        </a>
        <nav className="hidden items-center gap-7 text-sm font-medium md:flex">
          {[['machine-pin', 'Machine'], ['journey', 'How'], ['inventions', 'Inventions'], ['proof', 'Proof'], ['seats', 'Seats']].map(([id, l]) => (
            <button key={id} onClick={() => scrollToId(id)} className="hover:underline hover:decoration-2 hover:underline-offset-4" data-cursor="go">
              {l}
            </button>
          ))}
        </nav>
        <button onClick={() => scrollToId('seats')} data-cursor="enter"
          className="press rounded-full border-2 border-ink bg-bau-yellow px-5 py-2 text-sm font-bold uppercase shadow-[3px_3px_0_0_#121212]">
          Enter
        </button>
      </header>

      {/* ——— hero + pinned machine ——— */}
      <section id="machine-pin" className="relative h-dvh w-full" aria-label="The revenue machine">
        <div id="top" className="absolute inset-0 grid grid-cols-1 md:grid-cols-12">
          <div className="pointer-events-none relative z-10 flex flex-col justify-end px-5 pb-10 pt-28 md:col-span-6 md:px-10 md:pb-14 [&_button]:pointer-events-auto">
            <p className="caps mb-5 flex items-center gap-2 text-ink-soft">
              <span className="inline-block size-2.5 rounded-full bg-bau-red" /> Creative Newtech × E-Cell IIT Bombay · Problem 01
            </p>
            <KineticHeadline />
            <div className="hero-meta mt-8 flex flex-wrap items-end gap-x-10 gap-y-5">
              <p className="max-w-[38ch] text-[17px] leading-relaxed text-ink-soft">
                Constella turns CNL’s 10,000-partner network into account twins, predicts the next <b className="text-ink">solution</b> each
                partner will buy, routes it to an owner across divisions and proves the uplift.
              </p>
              <Magnet padding={60} magnetStrength={3}>
                <button onClick={() => scrollToId('seats')} data-cursor="choose"
                  className="press flex items-center gap-3 rounded-full border-2 border-ink bg-ink px-7 py-4 text-base font-bold uppercase text-bone shadow-[5px_5px_0_0_#f5b700]">
                  Choose a seat <ArrowRight className="size-5" />
                </button>
              </Magnet>
            </div>
          </div>
        </div>
        <Suspense fallback={null}>
          <Machine stage={stage} offsetX={typeof window !== 'undefined' && innerWidth > 900 ? 3.1 : 0} className="absolute inset-0" />
        </Suspense>
        {/* stage captions */}
        <ol className="absolute bottom-6 right-5 z-10 hidden gap-2 md:right-10 md:flex" aria-label="Scroll stages">
          {STAGES.map((st, i) => (
            <li key={st.n} className={`w-52 border-2 border-ink p-3 transition-all duration-300 ${stageIdx === i ? 'bg-surface shadow-[4px_4px_0_0_#121212]' : 'bg-transparent opacity-45'}`}>
              <div className="flex items-center justify-between">
                <span className="num text-xs">{st.n}</span>
                <span className="size-3" style={{ background: st.color }} />
              </div>
              <div className="display mt-1 text-xl">{st.title}</div>
              <p className="mt-1 text-xs leading-snug text-ink-soft">{st.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ——— marquees ——— */}
      <div className="relative z-10 -rotate-[1.2deg] border-y-2 border-ink bg-bau-yellow py-3">
        <div className="flex w-max animate-marquee gap-8 whitespace-nowrap">
          {Array.from({ length: 2 }).map((_, k) => (
            <span key={k} className="display flex items-center gap-8 text-4xl">
              {['Cross-sell', 'Solution', 'Annuity', 'Wallet share', 'Split credit', 'DaaS', 'Zero-touch renewal', 'FY29 Path'].map((w, i) => (
                <span key={w} className="flex items-center gap-8">{w}<Glyph div={(['EB', 'HON', 'FMSG', 'FMCT', 'SVC'] as DivCode[])[i % 5]} size={26} /></span>
              ))}
            </span>
          ))}
        </div>
      </div>
      <div className="relative z-10 rotate-[0.6deg]"><WireTicker /></div>

      {/* ——— the problem, as numbers ——— */}
      <section className="px-5 py-28 md:px-10" aria-labelledby="problem-h">
        <div className="grid gap-10 md:grid-cols-12">
          <div className="md:col-span-5">
            <p className="caps text-bau-red">The problem, in CNL’s words</p>
            <h2 id="problem-h" className="display reveal mt-4 text-[clamp(2.6rem,6vw,5.5rem)]">Each team sees only its slice.</h2>
            <p className="reveal mt-6 max-w-[46ch] text-lg leading-relaxed text-ink-soft">
              Purchases are spread across product divisions. Nobody sees when several products together form a solution — and the company
              cannot grow headcount in proportion to its portfolio.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4 md:col-span-7 md:grid-cols-3">
            {[
              { v: '10,000+', l: 'channel partners', c: 'bg-bau-blue text-bone', shape: 'EB' },
              { v: '25+ / 5,000+', l: 'brands / SKUs', c: 'bg-surface', shape: 'FMSG' },
              { v: '5.31%', l: 'EBITDA margin, Q2 FY27', c: 'bg-bau-yellow', shape: 'HON' },
              { v: '₹6,000 Cr', l: 'FY29 revenue goal', c: 'bg-ink text-bone', shape: 'FMCT' },
              { v: '45 days', l: 'net working capital', c: 'bg-surface', shape: 'SVC' },
              { v: '₹3,195 Cr', l: 'BharatNet SI order — the shift to solutions', c: 'bg-bau-red text-bone', shape: 'FMSG' },
            ].map((b) => (
              <div key={b.l} className={`spin-in relative flex aspect-square flex-col justify-between border-2 border-ink p-4 shadow-[4px_4px_0_0_#121212] ${b.c}`}>
                <Glyph div={b.shape} size={22} />
                <div>
                  <div className="display text-[clamp(1.4rem,2.6vw,2.4rem)] leading-none">{b.v}</div>
                  <div className="mt-2 text-sm opacity-80">{b.l}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <p className="caps mt-6 text-ink-soft">Sources: CNL investor presentation Q1 FY26 · Q2 FY27 earnings call (29 Oct 2026)</p>
      </section>

      {/* ——— horizontal journey (the 5 PS steps) ——— */}
      <section id="journey" className="relative h-dvh overflow-hidden bg-ink text-bone" aria-labelledby="journey-h">
        <div className="absolute left-5 top-24 md:left-10">
          <p className="caps text-bau-yellow">Signal → signed → renewed</p>
          <h2 id="journey-h" className="display mt-3 text-[clamp(2.2rem,5vw,4.5rem)]">Five moves. One machine.</h2>
        </div>
        <div id="journey-track" className="absolute bottom-16 left-0 flex gap-6 pl-5 md:pl-10">
          {STEPS.map((st, i) => (
            <article key={st.k} className="relative flex h-[52vh] w-[78vw] shrink-0 flex-col justify-between border-2 border-bone p-7 md:w-[38vw]">
              <div className="flex items-start justify-between">
                <span className="num text-sm text-bone/60">0{i + 1} / 05</span>
                <Glyph div={st.div} size={44} />
              </div>
              <div>
                <div className="display text-[clamp(3rem,7vw,6.5rem)]" style={{ color: i === 3 ? '#f0ede6' : undefined }}>{st.k}</div>
                <h3 className="mt-3 text-2xl font-semibold">{st.t}</h3>
                <p className="mt-2 max-w-[44ch] text-bone/75">{st.d}</p>
              </div>
            </article>
          ))}
          <div className="w-[10vw] shrink-0" />
        </div>
      </section>

      {/* ——— inventions ——— */}
      <section id="inventions" className="px-5 py-28 md:px-10" aria-labelledby="inv-h">
        <div className="mb-12 flex flex-wrap items-end justify-between gap-6">
          <h2 id="inv-h" className="display reveal text-[clamp(2.6rem,6vw,5.5rem)]">Inventions<span className="text-bau-red">.</span></h2>
          <p className="reveal max-w-[40ch] text-ink-soft">Not another lead-scoring widget. Each mechanism answers a constraint CNL actually has — thin margins, credit, silos, headcount.</p>
        </div>
        <div className="grid auto-rows-[minmax(170px,auto)] gap-4 md:grid-cols-4">
          {INVENTIONS.map((f, i) => (
            <article key={f.t} data-cursor="read"
              className={`reveal group relative flex flex-col justify-between border-2 border-ink bg-surface p-6 shadow-[4px_4px_0_0_#121212] transition-colors duration-200 hover:bg-ink hover:text-bone ${f.span}`}>
              <div className="flex items-start justify-between">
                <span className="num text-xs opacity-60">{String(i + 1).padStart(2, '0')}</span>
                <Glyph div={f.div} size={f.big ? 64 : 30} className="transition-transform duration-300 group-hover:rotate-45" />
              </div>
              <div>
                <h3 className={`display ${f.big ? 'text-5xl md:text-6xl' : 'text-2xl'}`}>{f.t}</h3>
                <p className={`mt-3 leading-relaxed opacity-80 ${f.big ? 'max-w-[36ch] text-lg' : 'text-sm'}`}>{f.d}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ——— live proof ——— */}
      <section id="proof" className="border-y-2 border-ink bg-bau-blue px-5 py-24 text-bone md:px-10" aria-labelledby="proof-h">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <h2 id="proof-h" className="display reveal text-[clamp(2.4rem,5.5vw,5rem)]">Running live, right now.</h2>
          <p className="caps text-bone/70">From the running API · synthetic CNL network</p>
        </div>
        <dl className="mt-14 grid grid-cols-2 gap-px border-2 border-bone bg-bone md:grid-cols-4">
          {[
            { k: 'Raw division records', v: s?.raw_records, f: (n: number) => n.toLocaleString('en-IN') },
            { k: 'Golden partners', v: s?.accounts },
            { k: 'Signals detected', v: s?.signals },
            { k: 'Opportunities routed', v: s?.opportunities },
            { k: 'Open pipeline', v: s?.pipeline_value, money: true },
            { k: 'Annuity identified', v: s?.annuity_value, money: true },
            { k: 'Model AUC (back-test)', v: s?.auc, dec: 3 },
            { k: 'Entity-match precision', v: s?.resolution_precision, pct: true },
          ].map((m) => (
            <div key={m.k} className="bg-bau-blue p-6">
              <dt className="caps text-bone/70">{m.k}</dt>
              <dd className="display mt-3 text-4xl md:text-5xl">
                {m.v == null ? '—' : m.money ? inr(m.v, 1) : m.pct ? `${(m.v * 100).toFixed(1)}%` : m.dec ? m.v.toFixed(m.dec) : <CountUp to={m.v} separator="," duration={1.6} />}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ——— seats ——— */}
      <section id="seats" className="px-5 py-28 md:px-10" aria-labelledby="seats-h">
        <h2 id="seats-h" className="display reveal text-[clamp(2.6rem,6vw,5.5rem)]">Take a seat.</h2>
        <p className="reveal mt-4 max-w-[52ch] text-lg text-ink-soft">Six people, six jobs, one data model. Each seat logs in with its own role, territory and data permissions.</p>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SEATS.map((p, i) => (
            <button key={p.key} onClick={() => enter(p.key, p.role)} disabled={!!busy} data-cursor="sit"
              className="press group relative flex min-h-56 flex-col justify-between overflow-hidden border-2 border-ink bg-surface p-6 text-left shadow-[5px_5px_0_0_#121212] transition-colors duration-200 hover:bg-bau-yellow disabled:opacity-60">
              <div className="flex items-start justify-between">
                <span className="caps">{p.role}</span>
                <ArrowUpRight className="size-6 transition-transform duration-200 group-hover:rotate-45" />
              </div>
              <div className="absolute -right-6 -top-6 opacity-15 transition-transform duration-500 group-hover:rotate-90 group-hover:opacity-30">
                <Glyph div={p.div} size={150} />
              </div>
              <div className="relative">
                <div className="display text-3xl">{p.name}</div>
                <div className="mt-1 text-sm text-ink-soft group-hover:text-ink">{p.title}</div>
                {busy === p.key && <div className="caps mt-2">Signing in…</div>}
              </div>
              <span className="num absolute bottom-4 right-5 text-xs opacity-50">0{i + 1}</span>
            </button>
          ))}
        </div>
      </section>

      {/* ——— finale ——— */}
      <section className="relative overflow-hidden border-t-2 border-ink bg-ink px-5 py-28 text-bone md:px-10">
        <div className="display text-[clamp(4rem,17vw,17rem)] leading-[0.8]">
          Assem<span className="text-bau-yellow">ble</span>.
        </div>
        <div className="mt-10 flex flex-wrap items-center justify-between gap-6">
          <p className="max-w-[48ch] text-bone/75">Built for the Creative Newtech × E-Cell IIT Bombay hackathon. Data is synthetic; company facts are cited from CNL’s public filings.</p>
          <button onClick={() => scrollToId('seats')} data-cursor="go"
            className="press rounded-full border-2 border-bone bg-bau-yellow px-7 py-4 font-bold uppercase text-ink shadow-[5px_5px_0_0_#f0ede6]">
            Start the machine
          </button>
        </div>
      </section>
    </div>
  )
}
