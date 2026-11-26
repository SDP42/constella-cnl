import { range, useSectionProgress } from './useSectionProgress'

const STEPS = [
  { k: 'Model', t: 'Unify the partner', d: 'Every division record from SAP B1, Tally, Zoho and Excel is stitched into one account twin — purchases, installed base, credit, notes and signals.', m: '1,698 raw records → 600 partners · 99% match precision' },
  { k: 'Detect', t: 'Predict the next solution', d: 'A gradient-boosted model reads peer adoption, co-purchase lift, solution coverage and what reps hear on WhatsApp — and ranks by margin and cash cycle, not revenue alone.', m: 'AUC 0.83 · beats 3 baselines in a time-split back-test' },
  { k: 'Route', t: 'Give it one owner', d: 'One lead, assists on a 70/30 split-credit contract, duplicates merged, and an SLA ladder that ends in a zero-touch WhatsApp nurture — nothing rots.', m: 'L1 nudge → L2 reassign → L3 head → L4 nurture' },
  { k: 'Act', t: 'Make yes easy', d: 'A drafted pitch, a one-click bill of materials, a deal desk that shows the true pocket margin, and Device-as-a-Service when credit blocks the deal.', m: '8 automation playbooks · voice copilot' },
  { k: 'Prove', t: 'Earn the right to scale', d: '20% of partners are a randomised control group. Uplift is measured with confidence bands and judged at month-2, 3, 4 and 6 gates.', m: 'Scale only if GP uplift > 0 at 90% confidence' },
]

/** Five steps with a gold progress line that fills as you scroll; each step lights up when reached. */
export function Timeline() {
  const { ref, p } = useSectionProgress<HTMLElement>(300)
  const fill = range(p, 0.05, 0.9)
  return (
    <section ref={ref} id="journey" className="relative h-[300vh]" aria-labelledby="journey-h">
      <div className="sticky top-0 flex h-dvh items-center overflow-hidden px-5">
        <div className="mx-auto grid w-full max-w-6xl gap-10 md:grid-cols-[0.9fr_1.1fr]">
          <div className="self-center">
            <p className="label">Signal → signed → renewed</p>
            <h2 id="journey-h" className="mt-3 text-[clamp(2.2rem,4.6vw,4rem)] font-semibold leading-[1.02] tracking-tight">Five moves. <span className="text-ink-soft">One revenue engine.</span></h2>
            <p className="mt-5 max-w-sm text-ink-soft">Each move answers one point of the problem statement — and each runs without adding a single salesperson.</p>
            <div className="num mt-8 text-7xl font-semibold text-gold">0{Math.min(5, Math.floor(fill * 5) + 1)}</div>
          </div>
          <ol className="relative space-y-3 pl-10">
            <span aria-hidden className="absolute bottom-3 left-[11px] top-3 w-[2px] rounded-full bg-ink/10" />
            <span aria-hidden className="absolute left-[11px] top-3 w-[2px] rounded-full bg-gradient-to-b from-gold-bright to-gold transition-[height] duration-150" style={{ height: `calc(${fill * 100}% - 24px)` }} />
            {STEPS.map((s, i) => {
              const on = fill >= i / 5
              const current = Math.min(4, Math.floor(fill * 5)) === i
              return (
                <li key={s.k} className={`relative rounded-2xl p-4 transition-all duration-500 ${on ? 'bg-white shadow-[0_16px_40px_-24px_rgba(28,25,23,.35)]' : 'opacity-40'}`}>
                  <span className={`absolute -left-[37px] top-5 grid size-6 place-items-center rounded-full border-2 text-[10px] font-semibold transition-colors duration-300 ${on ? 'border-gold bg-gold-bright text-ink' : 'border-ink/15 bg-pearl text-ink-soft'}`}>{i + 1}</span>
                  <div className="flex flex-wrap items-baseline gap-x-3"><span className="text-xl font-semibold tracking-tight">{s.k}</span><span className="text-sm text-ink-soft">{s.t}</span></div>
                  <p className={`overflow-hidden text-sm leading-relaxed text-ink-soft transition-all duration-500 ${current ? 'mt-1.5 max-h-40 opacity-100' : 'max-h-0 opacity-0'}`}>{s.d}</p>
                  {on && <p className="num mt-1.5 text-[11px] text-gold">{s.m}</p>}
                </li>
              )
            })}
          </ol>
        </div>
      </div>
    </section>
  )
}
