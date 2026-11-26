import { lazy, Suspense, useEffect, useRef } from 'react'
import { range, useSectionProgress } from './useSectionProgress'

const Constellation = lazy(() => import('@/components/three/Constellation').then((m) => ({ default: m.Constellation })))

/** progress → particle stage, with holds so each shape rests while its headline is on screen */
const KEYS: [number, number][] = [[0, 0], [0.06, 1], [0.19, 1], [0.27, 2], [0.4, 2], [0.48, 3], [0.6, 3], [0.68, 4], [0.8, 4], [0.88, 5], [1, 5]]
function stageAt(p: number) {
  for (let i = 0; i < KEYS.length - 1; i++) {
    const [a, sa] = KEYS[i], [b, sb] = KEYS[i + 1]
    if (p <= b) return sa + (sb - sa) * ((p - a) / (b - a))
  }
  return 5
}

type Anim = 'wipe' | 'rise' | 'curtain'
const SCENES: { a: number; b: number; k: string; h: string; gold: string; anim: Anim }[] = [
  { a: 0.06, b: 0.2, k: '01 · Silos', h: 'Every division sees only its slice.', gold: 'slice.', anim: 'wipe' },
  { a: 0.27, b: 0.41, k: '02 · Twin', h: 'One partner. One account twin.', gold: 'twin.', anim: 'rise' },
  { a: 0.48, b: 0.61, k: '03 · Solution', h: 'Sell the solution, not the SKU.', gold: 'solution,', anim: 'wipe' },
  { a: 0.68, b: 0.81, k: '04 · Annuity', h: 'Turn one-time deals into recurring revenue.', gold: 'recurring', anim: 'curtain' },
  { a: 0.88, b: 1.01, k: '05 · Scale', h: 'More revenue per partner. Zero extra hires.', gold: 'Zero', anim: 'rise' },
]
const DIV_LABELS = [['Enterprise', '#5f86b0'], ['Brands', '#e0b13e'], ['Gadgets', '#e0694e'], ['Consumer & AI', '#9a72a3'], ['Annuity', '#5aa57c']]

function Headline({ text, gold, t, anim }: { text: string; gold: string; t: number; anim: Anim }) {
  const words = text.split(' ')
  if (anim === 'rise') {
    return (
      <h2 className="text-[clamp(2.2rem,4.8vw,4.8rem)] font-medium leading-[0.98] tracking-[-0.03em]">
        {words.map((w, i) => {
          const wt = range(t, i * 0.08, i * 0.08 + 0.5)
          return (
            <span key={i} className="mr-[0.22em] inline-block overflow-hidden pb-[0.08em] align-bottom">
              <span className="inline-block" style={{ transform: `translateY(${(1 - wt) * 110}%)`, filter: `blur(${(1 - wt) * 8}px)`, color: w === gold ? '#f5b700' : undefined }}>{w}</span>
            </span>
          )
        })}
      </h2>
    )
  }
  const clip = anim === 'wipe' ? `inset(0 ${(1 - t) * 100}% 0 0)` : `inset(0 0 ${(1 - t) * 100}% 0)`
  return (
    <h2 className="text-[clamp(2.2rem,4.8vw,4.8rem)] font-medium leading-[0.98] tracking-[-0.03em]" style={{ clipPath: clip, WebkitClipPath: clip }}>
      {words.map((w, i) => <span key={i} className="mr-[0.22em] inline-block" style={{ color: w === gold ? '#f5b700' : undefined }}>{w}</span>)}
    </h2>
  )
}

export function ConstellationStory({ annuity }: { annuity?: number }) {
  const { ref, value, p } = useSectionProgress<HTMLElement>(500)
  const stage = useRef(0)
  const canvasWrap = useRef<HTMLDivElement>(null)

  // per-frame: stage for the shader + blur-zoom-through on the canvas, without React re-renders
  useEffect(() => {
    let raf = 0
    const tick = () => {
      const s = stageAt(value.current)
      stage.current = s
      const between = Math.sin(Math.PI * (s - Math.floor(s)))
      if (canvasWrap.current) {
        canvasWrap.current.style.filter = `blur(${(between * 7).toFixed(2)}px)`
        canvasWrap.current.style.transform = `scale(${(1 + between * 0.06).toFixed(4)})`
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value])

  return (
    <section ref={ref} id="story" className="relative h-[900vh] bg-night text-white" aria-label="How Constella turns silos into recurring revenue">
      <div className="sticky top-0 h-dvh overflow-hidden">
        <div ref={canvasWrap} className="absolute inset-0 will-change-[filter,transform]">
          <Suspense fallback={null}><Constellation stage={stage} className="absolute inset-0" /></Suspense>
        </div>
        {/* soft edges so copy always reads */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-night to-transparent" />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-night to-transparent" />

        {/* scene copy — one headline per scene, top-left, shared left edge */}
        <div className="pointer-events-none absolute inset-x-0 top-[13vh] mx-auto max-w-6xl px-[6vw] md:px-10">
          {SCENES.map((sc, i) => {
            const tin = range(p, sc.a - 0.035, sc.a + 0.02)
            const tout = range(p, sc.b - 0.03, sc.b + 0.01)
            const vis = tin > 0 && tout < 1
            if (!vis) return null
            return (
              <div key={sc.k} className="absolute left-[6vw] top-0 w-[min(760px,88vw)] md:left-10"
                style={{ opacity: 1 - tout, filter: `blur(${tout * 14}px)`, transform: `translate3d(${-tout * 60}px, ${-tout * 20}px, 0) scale(${1 + tout * 0.06})` }}>
                <p className="mb-4 font-mono text-[12px] uppercase tracking-[0.16em] text-white/55" style={{ clipPath: `inset(0 ${(1 - tin) * 100}% 0 0)` }}>{sc.k}</p>
                <Headline text={sc.h} gold={sc.gold} t={tin} anim={sc.anim} />
                {i === 4 && (
                  <a href="#seats" className="pointer-events-auto mt-8 inline-flex rounded-full bg-gold-bright px-7 py-3.5 text-base font-semibold text-ink transition-transform hover:scale-[1.04]"
                    style={{ opacity: range(tin, 0.6, 1), transform: `translateY(${(1 - range(tin, 0.6, 1)) * 16}px)` }}>Open the twin</a>
                )}
              </div>
            )
          })}
        </div>

        {/* scene 1: division labels under the five clusters, staggered left → right */}
        <div className="pointer-events-none absolute inset-x-0 bottom-[22vh] hidden md:block">
          {DIV_LABELS.map(([l, c], i) => {
            const t = range(p, 0.05 + i * 0.012, 0.09 + i * 0.012) * (1 - range(p, 0.19, 0.23))
            return (
              <span key={l} className="absolute -translate-x-1/2 whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.14em]"
                style={{ left: `${12 + i * 19}%`, color: c, opacity: t, transform: `translate(-50%, ${(1 - t) * 14}px)` }}>{l}</span>
            )
          })}
        </div>

        {/* scene 4: revenue line draws left → right, number resolves from blur */}
        {(() => {
          const t = range(p, 0.69, 0.78) * (1 - range(p, 0.8, 0.84))
          if (t <= 0) return null
          return (
            <div className="pointer-events-none absolute inset-x-0 bottom-[10vh] mx-auto max-w-6xl px-[6vw] md:px-10">
              <svg viewBox="0 0 1000 120" className="h-24 w-full" preserveAspectRatio="none" aria-hidden>
                <path d="M0 110 C 160 106, 260 96, 380 84 S 600 52, 720 40 S 900 16, 1000 8" fill="none" stroke="#f5b700" strokeWidth="2.5"
                  pathLength={1} strokeDasharray="1" strokeDashoffset={1 - t} />
              </svg>
              <div className="mt-2 flex items-baseline gap-3" style={{ filter: `blur(${(1 - t) * 10}px)`, opacity: t }}>
                <span className="num text-4xl font-semibold text-gold-bright">₹{(((annuity ?? 2.57e8) / 1e7) * t).toFixed(1)} Cr</span>
                <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-white/55">annuity found in the sample network</span>
              </div>
            </div>
          )
        })()}

        {/* scene progress rail */}
        <div className="absolute right-6 top-1/2 hidden -translate-y-1/2 flex-col gap-2 md:flex" aria-hidden>
          {SCENES.map((sc) => {
            const on = p >= sc.a - 0.04 && p < sc.b
            return <span key={sc.k} className={`h-6 w-[3px] rounded-full transition-colors duration-300 ${on ? 'bg-gold-bright' : 'bg-white/20'}`} />
          })}
        </div>
      </div>
    </section>
  )
}
