import { Layers3, Puzzle, Users } from 'lucide-react'
import { easeOut, range, useSectionProgress } from './useSectionProgress'

/** The brief, straight from PS1, as three problems and one goal. Light sticky stage (220vh), CSS-only motion. */
const PROBLEMS = [
  { icon: Layers3, t: 'Every division sees a slice', d: 'A partner buys across divisions and sales teams, and each team sees only its own part of the account.', tone: '#3E5C76' },
  { icon: Puzzle, t: 'Solutions go unspotted', d: 'There is no systematic way to see when several products together form a solution or an upsell.', tone: '#C2553D' },
  { icon: Users, t: 'Headcount can’t keep pace', d: 'The portfolio grows faster than CNL can hire salespeople to sell it.', tone: '#6B4E71' },
]

export function Brief() {
  const { ref, p } = useSectionProgress<HTMLElement>(200)
  const q = easeOut(range(p, 0, 0.22))
  const goal = easeOut(range(p, 0.68, 0.86))
  return (
    <section id="brief" ref={ref} className="relative h-[230vh]" aria-labelledby="brief-h">
      <div className="sticky top-0 flex h-dvh items-center overflow-hidden">
        <div className="mx-auto w-full max-w-6xl px-5">
          <p className="label" style={{ opacity: q }}>Problem statement 1 · Beyond Distribution</p>
          <h2 id="brief-h" className="mt-4 max-w-4xl text-[clamp(2rem,4.6vw,4rem)] font-semibold leading-[1.02] tracking-tight"
            style={{ clipPath: `inset(0 ${(1 - q) * 100}% 0 0)` }}>
            Grow the revenue CNL earns <span className="text-gold">per B2B customer</span>, and sell <span className="text-gold">solutions</span>, not boxes.
          </h2>

          <div className="mt-10 grid gap-3 md:grid-cols-3">
            {PROBLEMS.map((x, i) => {
              const k = easeOut(range(p, 0.18 + i * 0.12, 0.36 + i * 0.12))
              const I = x.icon
              return (
                <div key={x.t} className="pane relative overflow-hidden p-6"
                  style={{ opacity: k, transform: `translateY(${(1 - k) * 60}px) scale(${0.96 + k * 0.04})`, filter: `blur(${(1 - k) * 8}px)` }}>
                  <span aria-hidden className="absolute -right-8 -top-8 size-28 rounded-full opacity-25 blur-2xl" style={{ background: x.tone }} />
                  <span className="grid size-10 place-items-center rounded-xl text-white" style={{ background: x.tone }}><I className="size-5" /></span>
                  <p className="mt-4 text-xl font-semibold tracking-tight">{x.t}</p>
                  <p className="mt-2 text-sm leading-relaxed text-ink-soft">{x.d}</p>
                </div>
              )
            })}
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3" style={{ opacity: goal, transform: `translateX(${(1 - goal) * -40}px)` }}>
            <span className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-white">The goal</span>
            <span className="text-base text-ink-soft">More wallet share · integrated solutions · recurring, annuity revenue that keeps partners loyal.</span>
          </div>
        </div>
      </div>
    </section>
  )
}
