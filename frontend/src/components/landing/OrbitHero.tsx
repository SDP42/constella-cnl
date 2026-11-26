import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { prefersReducedMotion } from '@/lib/motion'
import { easeOut, range, useSectionProgress } from './useSectionProgress'

/**
 * Scroll-scrubbed real footage: 120 frames captured from NASA's public-domain
 * "Earth Views from the International Space Station" (HDEV camera, NASA HQ 2019).
 * Three chapters (limb → cloud deck → sunrise) joined with blur-zoom cuts; minimal type
 * revealed with masks from left→right, top→bottom and right→left.
 */
const N = 120
const CUTS = [40, 80] // chapter boundaries in frame space
const src = (i: number) => `/frames/orbit/${String(i).padStart(3, '0')}.jpg`

const BEATS = [
  { a: 0.0, b: 0.16, kicker: 'Live from orbit', title: ['Constella'], sub: 'Revenue intelligence for Creative Newtech', dir: 'tb' },
  { a: 0.2, b: 0.4, kicker: '10,000+ partners · 5 divisions', title: ['One country.', 'One network.'], sub: '', dir: 'lr' },
  { a: 0.45, b: 0.66, kicker: 'Each division sees a slice', title: ['Constella sees', 'the whole partner.'], sub: '', dir: 'rl' },
  { a: 0.72, b: 0.94, kicker: 'Signal → owner → revenue', title: ['Find the solution.', 'Route it. Prove it.'], sub: '', dir: 'bt' },
] as const

function mask(dir: string, k: number) {
  const r = (1 - k) * 100
  return dir === 'lr' ? `inset(0 ${r}% 0 0)` : dir === 'rl' ? `inset(0 0 0 ${r}%)` : dir === 'tb' ? `inset(0 0 ${r}% 0)` : `inset(${r}% 0 0 0)`
}

export function OrbitHero() {
  const { ref, value, p } = useSectionProgress<HTMLElement>(400)
  const canvas = useRef<HTMLCanvasElement>(null)
  const imgs = useRef<HTMLImageElement[]>([])
  const [loaded, setLoaded] = useState(0)

  // preload frames (first chapter first so the hero paints immediately)
  useEffect(() => {
    let n = 0
    imgs.current = Array.from({ length: N }, (_, i) => {
      const im = new Image()
      im.decoding = 'async'
      im.onload = () => setLoaded(++n)
      im.src = src(i)
      return im
    })
  }, [])

  // draw loop: frame from scroll, slow push-in, blur at chapter cuts
  useEffect(() => {
    let raf = 0
    let shown = -1
    let smooth = 0
    const draw = () => {
      raf = requestAnimationFrame(draw)
      const c = canvas.current
      if (!c) return
      const target = prefersReducedMotion() ? 0.05 : value.current
      smooth += (target - smooth) * 0.14
      const f = Math.min(N - 1, Math.max(0, Math.round(smooth * (N - 1))))
      const im = imgs.current[f]
      if (!im?.complete || !im.naturalWidth) return
      const dpr = Math.min(2, devicePixelRatio || 1)
      const W = c.clientWidth * dpr
      const H = c.clientHeight * dpr
      if (c.width !== W || c.height !== H) { c.width = W; c.height = H; shown = -1 }
      const local = f < CUTS[0] ? f / CUTS[0] : f < CUTS[1] ? (f - CUTS[0]) / (CUTS[1] - CUTS[0]) : (f - CUTS[1]) / (N - CUTS[1])
      const zoom = 1.04 + 0.16 * easeOut(local)
      const key = f * 1000 + Math.round(zoom * 500)
      if (key === shown) return
      shown = key
      const ctx = c.getContext('2d')!
      const s = Math.max(W / im.naturalWidth, H / im.naturalHeight) * zoom
      const w = im.naturalWidth * s
      const h = im.naturalHeight * s
      ctx.drawImage(im, (W - w) / 2, (H - h) / 2, w, h)
      const dCut = Math.min(...CUTS.map((x) => Math.abs(f - x + 0.5)))
      c.style.filter = dCut < 4 ? `blur(${((4 - dCut) * 3).toFixed(1)}px) brightness(${(1 + (4 - dCut) * 0.08).toFixed(2)})` : ''
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [value])

  const exit = range(p, 0.94, 1)
  return (
    <section id="top" ref={ref} className="relative h-[560vh] bg-night" aria-label="Constella — from orbit to every partner">
      <div className="sticky top-0 h-dvh overflow-hidden">
        <canvas ref={canvas} className="absolute inset-0 h-full w-full transition-[filter] duration-150" style={{ transform: `scale(${1 + exit * 0.25})`, opacity: 1 - exit }} aria-hidden />
        {/* cinematic grade */}
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(12,10,9,.78)_100%)]" />
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-b from-night/70 via-transparent to-night/80" />
        <div aria-hidden className="grain pointer-events-none absolute inset-0 opacity-[.07]" />

        {/* beats */}
        <div className="absolute inset-0 flex items-center">
          <div className="mx-auto w-full max-w-6xl px-6">
            {BEATS.map((b, i) => {
              const k = easeOut(range(p, b.a, b.a + 0.06))
              const out = range(p, b.b - 0.05, b.b)
              if (p < b.a - 0.01 || p > b.b + 0.01) return null
              return (
                <div key={i} className="absolute inset-x-6 top-1/2 mx-auto max-w-6xl -translate-y-1/2 text-white"
                  style={{ opacity: 1 - out, filter: `blur(${(out * 14).toFixed(1)}px)`, transform: `translateY(calc(-50% - ${out * 40}px)) scale(${1 + out * 0.06})` }}>
                  <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.3em] text-gold-bright" style={{ clipPath: mask('lr', k) }}>{b.kicker}</p>
                  {b.title.map((t, j) => (
                    <h1 key={t} className={`font-semibold leading-[0.95] tracking-[-0.03em] ${i === 0 ? 'text-[clamp(3.5rem,12vw,11rem)]' : 'text-[clamp(2.6rem,7vw,6.5rem)]'}`}
                      style={{ clipPath: mask(b.dir, easeOut(range(p, b.a + j * 0.025, b.a + 0.07 + j * 0.025))) }}>
                      {j === b.title.length - 1 && i > 0 ? <span className="bg-gradient-to-r from-white via-[#ffe7a8] to-gold-bright bg-clip-text text-transparent">{t}</span> : t}
                    </h1>
                  ))}
                  {b.sub && <p className="mt-5 max-w-md text-lg text-white/70" style={{ clipPath: mask('lr', easeOut(range(p, b.a + 0.03, b.a + 0.1))) }}>{b.sub}</p>}
                </div>
              )
            })}
          </div>
        </div>

        {/* HUD */}
        <div className="pointer-events-none absolute bottom-6 left-6 font-mono text-[10px] uppercase tracking-widest text-white/55">
          <div>ISS · 408 km · 27,600 km/h</div>
          <div className="mt-1">Frame {String(Math.round(p * (N - 1))).padStart(3, '0')} / {N} · {loaded < N ? `buffering ${Math.round((loaded / N) * 100)}%` : 'real footage'}</div>
        </div>
        <div className="pointer-events-none absolute right-6 top-1/2 hidden h-48 w-px -translate-y-1/2 bg-white/15 md:block">
          <div className="absolute left-0 top-0 w-px bg-gold-bright" style={{ height: `${p * 100}%` }} />
          {[0, 0.2, 0.45, 0.72].map((m) => <span key={m} className={`absolute -left-[3px] size-[7px] rounded-full ${p >= m ? 'bg-gold-bright' : 'bg-white/30'}`} style={{ top: `${m * 100}%` }} />)}
        </div>
        <p className="pointer-events-none absolute bottom-6 right-6 text-[10px] text-white/45">Footage: NASA · ISS HDEV, “Earth Views from the International Space Station” (public domain)</p>
        <div className="absolute bottom-16 left-1/2 flex -translate-x-1/2 flex-col items-center gap-1 text-[11px] text-white/60" style={{ opacity: 1 - range(p, 0, 0.05) }}>
          Scroll to descend <ChevronDown className="size-4 animate-bounce" />
        </div>
      </div>
    </section>
  )
}
