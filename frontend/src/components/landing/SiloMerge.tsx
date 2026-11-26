import { easeOut, range, useSectionProgress } from './useSectionProgress'

const SLICES = [
  { code: 'EB', team: 'Enterprise Business', color: '#3e5c76', sees: '₹62 L a year', detail: 'Interactive panels, mini PCs, monitors', verdict: 'Thinks TechNova is a loyal panel buyer' },
  { code: 'HON', team: 'Licensed brands', color: '#c99a2e', sees: '₹0', detail: 'Never bought Honeywell cabling or hubs', verdict: 'Doesn’t know TechNova exists' },
  { code: 'FMSG', team: 'Gadgets & drones', color: '#c2553d', sees: '₹0', detail: 'No drone STEM kits for its school clients', verdict: 'Doesn’t know TechNova exists' },
  { code: 'FMCT', team: 'Consumer & AI tech', color: '#6b4e71', sees: '₹14 L', detail: 'Two gaming PC orders for a campus lab', verdict: 'Sees an occasional small buyer' },
  { code: 'SVC', team: 'Services & annuity', color: '#3f7d5c', sees: '₹0', detail: '82 panels installed, no AMC on any of them', verdict: 'Nobody owns the renewal' },
]

/** Five divisions each see a fragment of the same partner; on scroll the fragments fuse into one twin. */
export function SiloMerge() {
  const { ref, p } = useSectionProgress<HTMLElement>(200)
  const merge = easeOut(range(p, 0.35, 0.7))
  const reveal = range(p, 0.68, 0.85)
  return (
    <section ref={ref} id="problem" className="relative h-[320vh]" aria-labelledby="silo-h">
      <div className="sticky top-0 flex h-dvh flex-col justify-center overflow-hidden px-5 py-20">
        <div className="mx-auto w-full max-w-6xl">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="label">The problem, in CNL’s own words</p>
              <h2 id="silo-h" className="mt-3 max-w-xl text-[clamp(2.2rem,4.6vw,4rem)] font-semibold leading-[1.02] tracking-tight">
                {merge < 0.5 ? <>Five teams. <span className="text-ink-soft">Five partial views.</span></> : <>One partner. <span className="text-gold">One twin.</span></>}
              </h2>
            </div>
            <p className="max-w-sm text-ink-soft">
              “What a customer buys is spread across product divisions, and each team largely sees only its own slice of the account.”
              <span className="mt-1 block text-xs">— Problem statement 1</span>
            </p>
          </div>

          <div className="relative mt-12 h-[360px]">
            {SLICES.map((s, i) => {
              const spread = (i - 2) * 232
              const x = spread * (1 - merge)
              const y = (i % 2 ? 22 : -10) * (1 - merge) + i * 6 * merge
              const rot = (i - 2) * 2.5 * (1 - merge)
              return (
                <div key={s.code} className="absolute inset-x-0 top-0 flex justify-center" style={{ zIndex: 10 - Math.abs(i - 2) }}>
                <div className="w-[220px] rounded-[20px] border border-white bg-white/90 p-4 shadow-[0_20px_50px_-24px_rgba(28,25,23,.35)] backdrop-blur"
                  style={{ transform: `translate(${x}px, ${y}px) rotate(${rot}deg) scale(${1 - merge * 0.04 * Math.abs(i - 2)})`, opacity: 1 - reveal }}>
                  <div className="flex items-center gap-2 text-xs font-medium"><span className="size-2.5 rounded-full" style={{ background: s.color }} />{s.team}</div>
                  <div className="num mt-3 text-2xl font-semibold">{s.sees}</div>
                  <div className="mt-1 text-xs text-ink-soft">{s.detail}</div>
                  <div className="mt-3 rounded-lg bg-ink/[0.04] px-2 py-1.5 text-[11px] text-ink-soft">“{s.verdict}”</div>
                </div>
                </div>
              )
            })}

            {/* the unified twin */}
            <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-center">
            <div className="w-[min(560px,92vw)] rounded-[24px] bg-ink p-6 text-white shadow-[0_40px_80px_-30px_rgba(28,25,23,.7)]"
              style={{ opacity: reveal, transform: `translateY(${(1 - reveal) * 30}px) scale(${0.94 + reveal * 0.06})` }}>
              <div className="flex items-center justify-between">
                <div><p className="font-mono text-[11px] uppercase tracking-widest text-white/50">Account twin</p><p className="text-2xl font-semibold">TechNova Systems · Pune</p></div>
                <span className="rounded-full bg-gold-bright px-3 py-1 text-xs font-semibold text-ink">6% wallet share</span>
              </div>
              <div className="mt-5 flex h-3 overflow-hidden rounded-full">
                {SLICES.map((s) => <span key={s.code} style={{ background: s.color, flex: s.code === 'EB' ? 81 : s.code === 'FMCT' ? 19 : 0.0001 }} />)}
              </div>
              <div className="mt-5 grid grid-cols-3 gap-3 text-sm">
                <div><p className="text-white/50">Buys today</p><p className="font-medium">Panels, PCs, gaming rigs</p></div>
                <div><p className="text-white/50">Missing</p><p className="font-medium">Cabling, hubs, AMC, drones</p></div>
                <div><p className="text-white/50">Next best</p><p className="font-medium text-gold-bright">Smart Classroom · p 0.58</p></div>
              </div>
              <p className="mt-5 text-xs text-white/50">One golden record from SAP B1, Tally, Zoho and Excel — matched on GSTIN, PAN and fuzzy name.</p>
            </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
