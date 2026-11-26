import { CheckCircle2, Mic, Rocket, Sparkles } from 'lucide-react'
import { easeOut, range, useSectionProgress } from './useSectionProgress'

const ACTIONS = [
  ['deal', 'Attach Display AMC to 82 installed panels', 'Vision Bank · ₹7.4 L · p 0.40'],
  ['sla', 'Smart Classroom for TechNova Systems', 'Past SLA — escalates to head in 6h'],
  ['scheme', 'Indus Labs: ₹88K to next Samsung slab', 'Unlocks 4% rebate (+₹47K)'],
  ['churn', 'Call Vertex IT Mart — churn risk 97%', 'No order for 108 days'],
  ['reorder', 'Reorder due from Kaveri Group', 'Orders every ~41 days · due in 1d'],
]

/** A faithful, static rendering of the Mission inbox that tilts flat and zooms as you scroll. */
export function AppPreview() {
  const { ref, p } = useSectionProgress<HTMLElement>(200)
  const t = easeOut(range(p, 0.05, 0.55))
  const rx = 28 * (1 - t)
  const sc = 0.78 + 0.22 * t
  const labels = range(p, 0.5, 0.7)
  return (
    <section ref={ref} className="relative h-[240vh]" aria-labelledby="preview-h">
      <div className="sticky top-0 flex h-dvh flex-col items-center justify-center overflow-hidden px-4">
        <div className="mb-8 text-center" style={{ opacity: 1 - range(p, 0.55, 0.75) * 0.4 }}>
          <p className="label">Inside the workspace</p>
          <h2 id="preview-h" className="mt-3 text-[clamp(2rem,4.2vw,3.6rem)] font-semibold tracking-tight">Monday 9:00 for a key account manager.</h2>
        </div>
        <div className="w-full max-w-5xl" style={{ perspective: '1600px' }}>
          <div className="relative overflow-hidden rounded-[22px] border border-white bg-[#f7f5f1] shadow-[0_60px_120px_-40px_rgba(28,25,23,.55)]"
            style={{ transform: `rotateX(${rx}deg) scale(${sc})`, transformOrigin: '50% 0%' }}>
            <div className="flex">
              <aside className="hidden w-44 shrink-0 bg-ink p-4 text-[11px] text-white/60 md:block">
                <div className="mb-4 font-semibold text-white">Constella</div>
                {['Mission inbox', 'Account twins', 'Solution composer', 'Deal desk', 'Credit & cash', 'Annuity ledger', 'Automation'].map((x, i) => (
                  <div key={x} className={`mb-1 rounded-lg px-2 py-1.5 ${i === 0 ? 'bg-white/10 text-white' : ''}`}>{x}</div>
                ))}
              </aside>
              <div className="min-w-0 flex-1 p-5">
                <div className="grid gap-3 md:grid-cols-[1.3fr_1fr]">
                  <div className="rounded-2xl bg-ink p-4 text-white">
                    <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-white/50"><Sparkles className="size-3" />Today’s brief · AI generated</p>
                    <p className="mt-2 text-[13px] leading-relaxed text-white/90">Start with Vision Bank: attach display AMC to 82 installed panels — ₹7.4 L at 40% likelihood. 2 deals are past SLA. Idle pipeline costs ≈ ₹44,754/day.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[['Open', '63'], ['Pipeline', '₹5.8 Cr'], ['Credit earned', '₹87 L'], ['Idle cost/day', '₹45K']].map(([k, v]) => (
                      <div key={k} className="rounded-xl bg-white p-2.5"><p className="font-mono text-[9px] uppercase tracking-wider text-ink-soft">{k}</p><p className="num mt-1 text-base font-semibold">{v}</p></div>
                    ))}
                  </div>
                </div>
                <div className="mt-3 rounded-2xl bg-white p-4">
                  <p className="flex items-center gap-1.5 text-[13px] font-semibold"><CheckCircle2 className="size-4" />Today’s 10 actions</p>
                  <ol className="mt-2 grid gap-1.5 md:grid-cols-2">
                    {ACTIONS.map(([k, a, b], i) => (
                      <li key={a} className="flex gap-2 rounded-lg bg-[#f7f5f1] px-2.5 py-2 text-[12px]">
                        <span className="grid size-4 shrink-0 place-items-center rounded-full border border-ink/20 text-[9px]">{i + 1}</span>
                        <span className="min-w-0"><span className="mr-1 rounded bg-ink/5 px-1 text-[9px] uppercase text-ink-soft">{k}</span>{a}<span className="block truncate text-[10px] text-ink-soft">{b}</span></span>
                      </li>
                    ))}
                  </ol>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <span className="flex flex-1 items-center gap-2 rounded-full bg-white px-3 py-2 text-[12px] text-ink-soft"><Mic className="size-3.5" />“What should I pitch to TechNova next?”</span>
                  <span className="flex items-center gap-1 rounded-full bg-ink px-3 py-2 text-[11px] text-white"><Rocket className="size-3" />Launch campaign</span>
                </div>
              </div>
            </div>
          </div>
          {/* callouts */}
          <div className="pointer-events-none mt-5 grid gap-2 text-center text-xs text-ink-soft md:grid-cols-3" style={{ opacity: labels, transform: `translateY(${(1 - labels) * 10}px)` }}>
            <span><b className="text-ink">AI brief</b> — written from the rep’s own pipeline every morning</span>
            <span><b className="text-ink">10 actions</b> — deals, SLAs, reorders, churn and rebate slabs in one list</span>
            <span><b className="text-ink">Voice copilot</b> — ask in plain English, hear the answer back</span>
          </div>
        </div>
      </div>
    </section>
  )
}
