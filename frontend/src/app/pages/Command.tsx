import { AlertTriangle, ArrowUpRight, Bot, GitMerge, Hourglass, Trophy } from 'lucide-react'
import { useState } from 'react'
import { Bar as RBar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import CountUp from '@/components/reactbits/CountUp'
import { inr, pct } from '@/lib/format'
import { Bar, Card, KindPill, Loading, Page, Stat, useApi, Reasoning } from '../kit'
import { OppRow } from './Inbox'
import { OpportunityDrawer } from '../OpportunityDrawer'
import { CHART, DIV_COLORS_MAP, DIV_NAME, KIND } from '../theme'

export default function Command() {
  const d = useApi<any>(['head-dash'], '/api/dashboard/head', { refetchInterval: 20_000 })
  const auto = useApi<any>(['auto-rules'], '/api/automation/rules')
  const [open, setOpen] = useState<number | null>(null)
  const x = d.data

  return (
    <Page kicker="National view · all divisions" title="Command center">
      {!x ? <Loading rows={6} /> : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Stat label="Open pipeline" value={inr(x.kpis.pipeline_value)} sub={`${x.kpis.open_opps} opportunities`} tone="#3e5c76" />
            <Stat label="Annuity in pipe" value={inr(x.kpis.pipeline_annuity)} sub="per year, recurring" tone="#3f7d5c" />
            <Stat label="Won" value={inr(x.kpis.won_value)} sub={`${x.kpis.won} deals · ${pct(x.kpis.win_rate)} win rate`} tone="#c99a2e" icon={<Trophy className="size-4" />} />
            <Stat label="Past SLA" value={<CountUp to={x.kpis.sla_breached} />} sub="escalation ladder active" tone="#b42318" icon={<AlertTriangle className="size-4" />} />
            <Stat label="Idle cost / day" value={inr(x.kpis.cost_of_delay_per_day)} sub="decaying value-at-stake" tone="#b45309" icon={<Hourglass className="size-4" />} />
            <Stat label="Cross-division deals" value={<CountUp to={x.kpis.cross_division_deals} />} sub={`${x.kpis.nurture_auto} in zero-touch nurture`} tone="#6b4e71" icon={<GitMerge className="size-4" />} />
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-3">
            <Card title="Signal → revenue funnel" sub="Opportunities reaching each stage (treatment group)">
              <div className="space-y-2.5">
                {x.funnel.map((f: any, i: number) => (
                  <div key={f.stage}>
                    <div className="mb-1 flex justify-between text-xs"><span className="capitalize">{f.stage}</span><span className="num">{f.count}</span></div>
                    <div className="h-7 overflow-hidden rounded-lg bg-ink/5">
                      <div className="h-full rounded-lg" style={{ width: `${(f.count / Math.max(1, x.funnel[0].count)) * 100}%`, background: `linear-gradient(90deg, #c99a2e, ${i > 3 ? '#3f7d5c' : '#a16207'})`, opacity: 1 - i * 0.08 }} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
            <Card title="Pipeline by lead division" sub="Value routed to each division">
              <div className="h-64">
                <ResponsiveContainer>
                  <BarChart data={x.by_division.filter((b: any) => b.division !== '—')} layout="vertical" margin={{ left: 10, right: 16 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="division" width={50} tick={{ fill: CHART.axis, fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(v: any) => inr(v)} labelFormatter={(l: any) => DIV_NAME[String(l)] ?? l} cursor={{ fill: 'rgba(28,25,23,.04)' }} />
                    <RBar isAnimationActive={false} dataKey="value" radius={[0, 8, 8, 0]}>
                      {x.by_division.filter((b: any) => b.division !== '—').map((b: any) => <Cell key={b.division} fill={DIV_COLORS_MAP[b.division] ?? '#999'} />)}
                    </RBar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card title="Opportunity mix" sub="From product to solution to annuity">
              <div className="space-y-3 pt-1">
                {Object.entries(x.by_kind).map(([k, v]: any) => (
                  <div key={k}>
                    <div className="mb-1 flex items-center justify-between"><KindPill kind={k} /><span className="num text-sm">{v}</span></div>
                    <Bar value={v} max={Math.max(...(Object.values(x.by_kind) as number[]))} color={KIND[k]?.color} />
                  </div>
                ))}
                <Reasoning how="Kinds come from the opportunity ladder: cross-sell (new category), upsell (Essential→Pro with spend momentum), solution (part-built template), annuity (installed base without a service plan or a renewal due)."
                  why="The problem statement asks to move from individual products to integrated solutions and annuity — this mix is the direct measure of that shift." />
                <div className="mt-4 rounded-xl bg-ink/[0.03] p-3 text-xs text-ink-soft">
                  Escalation ladder: {Object.entries(x.escalations).map(([l, n]) => `L${l}: ${n}`).join(' · ')}
                </div>
              </div>
            </Card>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[1.5fr_1fr]">
            <Card title="Highest value-at-stake right now" sub="Click any row to open the dossier" pad={false}>
              <div className="px-2 pb-2">{x.top_open.map((o: any) => <OppRow key={o.id} o={o} onOpen={setOpen} />)}</div>
            </Card>
            <div className="space-y-4">
              <Card title="Rep capacity" sub="Open leads vs capacity — the router balances this automatically">
                <Reasoning how="Utilisation = open opportunities led ÷ the rep's capacity. When a rep is full the router borrows the least-loaded rep of the same division nationally; when all are full the automation-assisted annuity desk takes first touch." why="CNL cannot add reps in proportion to its 5,000-SKU portfolio; load-aware routing is how coverage grows without headcount." />
                <div className="max-h-80 space-y-2.5 overflow-y-auto pr-1">
                  {x.reps.slice(0, 20).map((r: any) => (
                    <div key={r.id} className="grid grid-cols-[1fr_90px_40px] items-center gap-3 text-sm">
                      <span className="truncate">{r.name}<span className="ml-1.5 text-[11px] text-ink-soft">{r.division} · {r.region}</span></span>
                      <Bar value={r.utilisation} max={1.2} color={r.utilisation > 1 ? '#b42318' : r.utilisation > 0.8 ? '#b45309' : '#3f7d5c'} />
                      <span className="num text-right text-xs">{Math.round(r.utilisation * 100)}%</span>
                    </div>
                  ))}
                </div>
              </Card>
              {auto.data && (
                <Card title={<span className="flex items-center gap-2"><Bot className="size-4" />Automation dividend</span>} sub="Work the playbooks did instead of people">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div><div className="num text-2xl font-semibold">{auto.data.runs}</div><div className="text-[11px] text-ink-soft">rule runs</div></div>
                    <div><div className="num text-2xl font-semibold">{auto.data.hours_saved}</div><div className="text-[11px] text-ink-soft">hours saved</div></div>
                    <div><div className="num text-2xl font-semibold">{auto.data.fte_equivalent}</div><div className="text-[11px] text-ink-soft">FTE / month</div></div>
                  </div>
                  <a href="/app/automation" className="mt-3 flex items-center gap-1 text-xs text-gold">Open playbooks <ArrowUpRight className="size-3" /></a>
                </Card>
              )}
            </div>
          </div>
        </>
      )}
      <OpportunityDrawer id={open} onClose={() => setOpen(null)} />
    </Page>
  )
}
