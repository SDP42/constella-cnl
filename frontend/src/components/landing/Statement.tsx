import { range, useSectionProgress } from './useSectionProgress'

/** Word-by-word scroll-scrubbed statement on the night background (bridges the globe and the story). */
export function Statement() {
  const { ref, p } = useSectionProgress<HTMLElement>(200)
  const words = 'Stop selling SKUs. Start selling solutions — and the service that keeps them running.'.split(' ')
  return (
    <section ref={ref} className="relative h-[220vh] bg-night" aria-label="Our thesis">
      <div className="sticky top-0 grid h-dvh place-items-center overflow-hidden px-6">
        <div aria-hidden className="absolute left-1/2 top-1/2 size-[60vmax] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold-bright/10 blur-[120px]"
          style={{ opacity: 0.3 + range(p, 0, 0.8) * 0.7 }} />
        <p className="relative max-w-5xl text-center text-[clamp(2.2rem,5.6vw,5.4rem)] font-semibold leading-[1.05] tracking-tight">
          {words.map((w, i) => {
            const t = range(p, (i / words.length) * 0.75, (i / words.length) * 0.75 + 0.12)
            const gold = /solutions|service/.test(w)
            return (
              <span key={i} className="mr-[0.25em] inline-block transition-colors duration-150"
                style={{ color: gold ? `rgba(245,183,0,${0.15 + t * 0.85})` : `rgba(247,245,241,${0.12 + t * 0.88})`, transform: `translateY(${(1 - t) * 14}px)` }}>
                {w}
              </span>
            )
          })}
        </p>
        <p className="absolute bottom-10 font-mono text-[11px] uppercase tracking-[0.2em] text-white/40" style={{ opacity: range(p, 0.7, 0.95) }}>
          The Constella thesis for Creative Newtech
        </p>
      </div>
    </section>
  )
}
