import { Check, MessageCircle } from 'lucide-react'
import type { ReactNode } from 'react'
import { inr } from '@/lib/format'
import { easeOut, useSectionProgress } from './useSectionProgress'

/** PS1's five "what you need to do" points, answered one panel each on a pinned horizontal track. */
const DIV = [['EB', '#3E5C76'], ['HON', '#C99A2E'], ['FMSG', '#C2553D'], ['FMCT', '#6B4E71'], ['SVC', '#3F7D5C']] as const

function Panel({ n, title, line, stat, children, k }: { n: number; title: string; line: string; stat: ReactNode; children: ReactNode; k: number }) {
  return (
    <article className="flex h-full w-[100vw] shrink-0 items-center px-5">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-10 md:grid-cols-[1fr_1.1fr]">
        <div style={{ opacity: 0.25 + 0.75 * k, transform: `translateY(${(1 - k) * 24}px)` }}>
          <span className="font-mono text-[12px] uppercase tracking-[0.25em] text-gold">0{n} / 05</span>
          <h3 className="mt-3 text-[clamp(2.2rem,5vw,4.4rem)] font-semibold leading-[0.98] tracking-tight">{title}</h3>
          <p className="mt-4 max-w-md text-lg leading-relaxed text-ink-soft">{line}</p>
          <p className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 font-mono text-sm shadow-sm"><span className="size-2 rounded-full bg-gold-bright" />{stat}</p>
        </div>
        <div className="relative" style={{ opacity: k, transform: `scale(${0.92 + 0.08 * k})`, filter: `blur(${(1 - k) * 6}px)` }}>{children}</div>
      </div>
    </article>
  )
}

export function FivePoints({ s }: { s: any }) {
  const { ref, p } = useSectionProgress<HTMLElement>(400)
  // each panel dwells, then glides to the next (smoothstep within each of the 4 transitions)
  const raw = Math.min(3.9999, p * 4.4 - 0.2 < 0 ? 0 : p * 4.4 - 0.2)
  const seg = Math.floor(raw)
  const t = Math.min(1, Math.max(0, (raw - seg - 0.3) / 0.55))
  const x = (seg + t * t * (3 - 2 * t)) / 4
  const k = (i: number) => easeOut(1 - Math.min(1, Math.abs(x * 4 - i) * 1.4))
  return (
    <section id="journey" ref={ref} className="relative h-[480vh] bg-pearl" aria-label="How Constella answers the five points">
      <div className="sticky top-0 h-dvh overflow-hidden">
        <div className="absolute inset-x-0 top-24 z-10 mx-auto flex max-w-6xl items-center justify-between px-5">
          <p className="label">Our answer · five points</p>
          <div className="flex gap-1.5">{[0, 1, 2, 3, 4].map((i) => <span key={i} className="h-1 rounded-full transition-all duration-300" style={{ width: Math.round(x * 4) === i ? 28 : 10, background: Math.round(x * 4) >= i ? '#A16207' : 'rgba(28,25,23,.15)' }} />)}</div>
        </div>
        <div className="flex h-full will-change-transform" style={{ transform: `translate3d(${-x * 400}vw,0,0)` }}>
          <Panel n={1} k={k(0)} title="Model the data" line="Five division ERPs, one golden record per partner: purchases, installed base, interactions, credit and signals, matched on GSTIN → PAN → name."
            stat={<>{s?.raw_records?.toLocaleString() ?? '—'} raw records → {s?.accounts ?? '—'} partners · {(s?.resolution_precision * 100 || 0).toFixed(1)}% precision</>}>
            <div className="pane p-6">
              <div className="flex flex-wrap gap-2">
                {DIV.map(([d, c], i) => (
                  <span key={d} className="rounded-full px-3 py-1.5 text-xs font-semibold text-white transition-transform duration-500"
                    style={{ background: c, transform: `translate(${(1 - k(0)) * (i - 2) * 30}px, ${(1 - k(0)) * -30}px)` }}>{d}</span>
                ))}
              </div>
              <div className="mt-5 rounded-2xl bg-night p-5 text-white">
                <p className="font-mono text-[10px] uppercase tracking-widest text-white/50">Golden record · 27AAACT…</p>
                <p className="mt-1 text-xl font-semibold">TechNova Systems</p>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  {[['Spend 12m', '₹3.8 L'], ['Divisions', '1 of 5'], ['Wallet', '₹3.3 Cr']].map(([a, b]) => <div key={a} className="rounded-lg bg-white/5 p-2"><p className="text-white/50">{a}</p><p className="num font-semibold">{b}</p></div>)}
                </div>
              </div>
            </div>
          </Panel>

          <Panel n={2} k={k(1)} title="Detect the opportunity" line="A calibrated model reads each partner's basket against peers and solution blueprints, and names the next product or the full solution, with reasons."
            stat={<>Back-test AUC {s?.auc?.toFixed(3) ?? '—'} · {s?.signals?.toLocaleString() ?? '—'} signals</>}>
            <div className="pane p-6">
              <p className="label">TechNova's basket vs the Smart Classroom blueprint</p>
              <ul className="mt-3 space-y-2">
                {[['Interactive panels', true], ['Mini PCs', true], ['Projectors', true], ['Structured cabling', false], ['Hubs & connectivity', false], ['Display AMC (annuity)', false]].map(([l, own], i) => (
                  <li key={l as string} className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm ${own ? 'bg-ink/[0.04]' : 'border border-dashed border-gold/60 bg-gold/5'}`}
                    style={{ opacity: Math.min(1, k(1) * 1.4 - i * 0.08) }}>
                    <span className="flex items-center gap-2">{own ? <Check className="size-4 text-spec-svc" /> : <span className="size-4 rounded-full border-2 border-gold" />}{l}</span>
                    <span className={`text-xs ${own ? 'text-ink-soft' : 'font-semibold text-gold'}`}>{own ? 'owned' : 'missing'}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-sm"><b>Smart Classroom</b> · p = 0.58 · reasons: peer adoption, intent in notes, credit headroom</p>
            </div>
          </Panel>

          <Panel n={3} k={k(2)} title="Capture & route to action" line="Each opportunity gets one lead owner, assists from other divisions with split credit, an SLA, and an escalation ladder if no one acts."
            stat={<>{s?.opportunities?.toLocaleString() ?? '—'} opportunities routed · median 3 min</>}>
            <div className="pane p-6">
              <div className="flex items-center gap-3">
                <span className="grid size-12 place-items-center rounded-full bg-[#3E5C76] font-semibold text-white">PN</span>
                <div><p className="font-semibold">Priya Nair · lead (70%)</p><p className="text-xs text-ink-soft">Enterprise Business · owns TechNova</p></div>
              </div>
              <div className="ml-6 mt-2 border-l-2 border-dashed border-ink/10 pl-6">
                <p className="py-2 text-sm"><span className="mr-2 inline-block size-2 rounded-full bg-[#C99A2E]" />Assist: Licensed brands desk (cabling) · 15%</p>
                <p className="py-2 text-sm"><span className="mr-2 inline-block size-2 rounded-full bg-[#3F7D5C]" />Assist: Services desk (AMC) · 15%</p>
              </div>
              <div className="mt-4 grid grid-cols-4 gap-1.5 text-center text-[11px]">
                {['L1 nudge 48h', 'L2 reassign', 'L3 head', 'L4 nurture'].map((l, i) => <span key={l} className="rounded-lg py-2" style={{ background: `rgba(194,85,61,${0.08 + i * 0.1})` }}>{l}</span>)}
              </div>
            </div>
          </Panel>

          <Panel n={4} k={k(3)} title="A working prototype" line="Reps get a morning brief on WhatsApp and one-tap accept. Heads get a command centre. Automation handles the follow-ups, so the network scales without new hires."
            stat={<>6 role workspaces · voice copilot · {inr(s?.pipeline_value)} pipeline</>}>
            <div className="pane overflow-hidden p-0">
              <div className="flex items-center gap-2 bg-[#075E54] px-4 py-3 text-white"><MessageCircle className="size-4" /><span className="text-sm font-medium">Constella brief · 9:00</span></div>
              <div className="space-y-2 bg-[#ECE5DD] p-4 text-sm">
                <p className="max-w-[85%] rounded-xl rounded-tl-none bg-white p-3 shadow-sm">Good morning Priya. 3 opportunities today. Top one: <b>Smart Classroom for TechNova</b>, ₹9.6 L, SLA 46h.</p>
                <p className="ml-auto max-w-[60%] rounded-xl rounded-tr-none bg-[#DCF8C6] p-3 shadow-sm">Accept ✅</p>
                <p className="max-w-[85%] rounded-xl rounded-tl-none bg-white p-3 shadow-sm">Done. Pitch and BOM sent to your inbox. Assists notified.</p>
              </div>
            </div>
          </Panel>

          <Panel n={5} k={k(4)} title="Prove it works" line="A 6-month pilot against a randomised control group. Gates at months 2, 3, 4 and 6 decide whether to scale or stop, and order matching attributes every win."
            stat={<>Treatment vs 20% control · scale / stop gates</>}>
            <div className="pane p-6">
              <p className="label">GP per partner, 6 months (simulated pilot)</p>
              <div className="mt-4 flex h-44 items-end gap-6">
                {[['Control', 0.55, '#a8a29e'], ['Constella', 0.82, '#A16207']].map(([l, h, c]) => (
                  <div key={l as string} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                    <div className="w-full rounded-t-xl transition-all duration-700" style={{ height: `${(h as number) * 100 * k(4)}%`, background: c as string }} />
                    <span className="text-sm font-medium">{l}</span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-sm text-ink-soft">Cross-sell, solution attach and annuity ARR are each tracked against the control group.</p>
            </div>
          </Panel>
        </div>
      </div>
    </section>
  )
}
