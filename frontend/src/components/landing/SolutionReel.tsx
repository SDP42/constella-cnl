import { useEffect, useRef, useState } from 'react'
import { prefersReducedMotion } from '@/lib/motion'
import { easeOut, range, useSectionProgress } from './useSectionProgress'

/**
 * "Solutions in the field": scroll-scrubbed frames from six professional clips (Pexels License —
 * free incl. commercial; creators credited in docs/DATA_SOURCES.md). Each shot pairs a real scene
 * with the Constella signal that would sell that solution.
 */
const PER = 22
const CH = [
  { k: 'Distribution data', t: ['Every scan, invoice and SKU', 'becomes a signal.'], card: ['Account twin', '5 division ledgers → 1 partner record', 'GSTIN → PAN → name match · 99% precision'], tone: '#C2553D' },
  { k: 'Intelligence', t: ['Constella reads the basket', 'against every solution.'], card: ['Opportunity detected', 'Panels + PCs, no cabling or AMC', 'Smart Classroom · p 0.58 · ₹9.6 L'], tone: '#3E5C76' },
  { k: 'Smart Classroom', t: ['Panels, compute, cabling,', 'and a care plan.'], card: ['Bill of materials', 'ViewSonic panels · MSI mini PCs · Honeywell cabling', '+ display AMC ₹96K / yr'], tone: '#6B4E71' },
  { k: 'Smart City & Campus Security', t: ['Cameras, fire safety', 'and the command room.'], card: ['Routed to owner', 'Lead: EB key account · assist: SI desk', 'SLA 48 h · split credit 70/30'], tone: '#A16207' },
  { k: 'Hybrid Meeting Room', t: ['One room, four divisions,', 'one proposal.'], card: ['Proposal link sent', 'Upfront or ₹/month (Device-as-a-Service)', 'Partner accepts on phone'], tone: '#3F7D5C' },
  { k: 'Network + annuity', t: ['Installed once.', 'Renewed every year.'], card: ['Recurring revenue', 'Cabling certification + AMC renewals', 'Zero-touch renewal 30 days ahead'], tone: '#C99A2E' },
] as const
const N = PER * CH.length
const src = (i: number) => `/frames/solutions/${String(i).padStart(3, '0')}.jpg`
const clip = (dir: number, k: number) => {
  const r = (1 - k) * 100
  return dir % 2 ? `inset(0 0 0 ${r}%)` : `inset(0 ${r}% 0 0)`
}

export function SolutionReel() {
  const { ref, value, p } = useSectionProgress<HTMLElement>(500)
  const canvas = useRef<HTMLCanvasElement>(null)
  const imgs = useRef<HTMLImageElement[]>([])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // chapter heads first, then in-betweens, only once the section is near (keeps the landing light)
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting || imgs.current.length) return
      const order = [...Array(N).keys()].sort((a, b) => Number(b % PER === 0) - Number(a % PER === 0) || a - b)
      const arr: HTMLImageElement[] = []
      for (const i of order) { const im = new Image(); im.decoding = 'async'; if (i === 0) im.onload = () => setReady(true); im.src = src(i); arr[i] = im }
      imgs.current = arr
    }, { rootMargin: '150% 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [ref])

  useEffect(() => {
    let raf = 0
    let shown = -1
    let smooth = 0
    const draw = () => {
      raf = requestAnimationFrame(draw)
      const c = canvas.current
      if (!c || !imgs.current.length) return
      smooth += ((prefersReducedMotion() ? 0.02 : value.current) - smooth) * 0.15
      const fx = smooth * (N - 1)
      let f = Math.min(N - 1, Math.max(0, Math.round(fx)))
      if (!imgs.current[f]?.complete) f = Math.floor(f / PER) * PER
      const im = imgs.current[f]
      if (!im?.complete || !im.naturalWidth) return
      const dpr = Math.min(2, devicePixelRatio || 1)
      const W = c.clientWidth * dpr
      const H = c.clientHeight * dpr
      if (c.width !== W || c.height !== H) { c.width = W; c.height = H; shown = -1 }
      const local = (fx % PER) / PER
      const zoom = 1.02 + 0.1 * easeOut(local)
      const key = f * 1000 + Math.round(zoom * 400)
      if (key === shown) return
      shown = key
      const ctx = c.getContext('2d')!
      const s = Math.max(W / im.naturalWidth, H / im.naturalHeight) * zoom
      ctx.drawImage(im, (W - im.naturalWidth * s) / 2, (H - im.naturalHeight * s) / 2, im.naturalWidth * s, im.naturalHeight * s)
      const edge = Math.min(local, 1 - local) * PER
      c.style.filter = edge < 2 ? `blur(${((2 - edge) * 5).toFixed(1)}px)` : ''
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [value])

  const seg = 1 / CH.length
  const cur = Math.min(CH.length - 1, Math.floor(p / seg))
  return (
    <section id="solutions" ref={ref} className="relative h-[560vh] bg-night" aria-label="Constella's solutions in the field">
      <div className="sticky top-0 h-dvh overflow-hidden">
        <canvas ref={canvas} className="absolute inset-0 h-full w-full transition-opacity duration-700" style={{ opacity: ready ? 1 : 0 }} aria-hidden />
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-r from-night/90 via-night/45 to-night/10" />
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-t from-night/70 via-transparent to-night/50" />

        <div className="absolute left-0 right-0 top-24 mx-auto flex max-w-6xl items-center justify-between px-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-gold-bright">Solutions in the field</p>
          <p className="font-mono text-[11px] text-white/50">{String(cur + 1).padStart(2, '0')} / {String(CH.length).padStart(2, '0')}</p>
        </div>

        {CH.map((c, i) => {
          const a = i * seg
          if (p < a - 0.01 || p > a + seg + 0.01) return null
          const k = easeOut(range(p, a, a + seg * 0.35))
          const out = i === CH.length - 1 ? 0 : range(p, a + seg * 0.82, a + seg)
          const kc = easeOut(range(p, a + seg * 0.18, a + seg * 0.5))
          return (
            <div key={c.k} className="absolute inset-0 mx-auto grid max-w-6xl items-center gap-10 px-5 md:grid-cols-[1.3fr_1fr]"
              style={{ opacity: 1 - out, filter: `blur(${(out * 14).toFixed(1)}px)`, transform: `translateY(${-out * 40}px)` }}>
              <div className="text-white">
                <p className="mb-4 flex items-center gap-3 text-sm font-medium" style={{ clipPath: clip(0, k) }}>
                  <span className="h-px w-10" style={{ background: c.tone }} /><span style={{ color: '#ffe7a8' }}>{c.k}</span>
                </p>
                {c.t.map((line, j) => (
                  <h2 key={line} className="text-[clamp(2.2rem,5.6vw,5.2rem)] font-semibold leading-[0.98] tracking-[-0.03em]"
                    style={{ clipPath: clip(i + j, easeOut(range(p, a + j * seg * 0.08, a + seg * 0.4 + j * seg * 0.08))) }}>
                    {j === c.t.length - 1 ? <span className="bg-gradient-to-r from-white to-gold-bright bg-clip-text text-transparent">{line}</span> : line}
                  </h2>
                ))}
              </div>
              <div className="hidden md:block" style={{ opacity: kc, transform: `translateX(${(1 - kc) * 60}px) scale(${0.95 + kc * 0.05})` }}>
                <div className="rounded-3xl border border-white/15 bg-white/10 p-6 text-white shadow-2xl backdrop-blur-xl">
                  <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-white/60"><span className="size-2 animate-pulse rounded-full" style={{ background: c.tone }} />Constella · {c.card[0]}</p>
                  <p className="mt-3 text-xl font-semibold leading-snug">{c.card[1]}</p>
                  <p className="mt-2 text-sm text-white/70">{c.card[2]}</p>
                </div>
              </div>
            </div>
          )
        })}

        <div className="absolute inset-x-0 bottom-0 h-[3px] bg-white/10"><div className="h-full bg-gold-bright" style={{ width: `${p * 100}%` }} /></div>
        <p className="pointer-events-none absolute bottom-4 right-6 text-[10px] text-white/40">Footage: Pexels (Pexels License)</p>
      </div>
    </section>
  )
}
