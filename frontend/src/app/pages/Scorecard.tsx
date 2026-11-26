import { AlertTriangle, ArrowUpRight, CheckCircle2, Scale } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Area, AreaChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, ComposedChart, Bar as RBar } from 'recharts'
import { inr, pct } from '@/lib/format'
import { Card, Loading, Page, Reasoning, useApi } from '../kit'
import { CHART } from '../theme'

const TONES = ['#3E5C76', '#A16207', '#C2553D', '#6B4E71', '#3F7D5C']

export default function Scorecard() {
  const d = useApi<any>(['scorecard'], '/api/proof/scorecard')
  const [open, setOpen] = useState(1)
  const x = d.data
  if (!x) return <Page title="PS1 scorecard"><Loading rows={10} /></Page>
  const h = x.headline
  const cur = x.points.find((p: any) => p.no === open)
  const rpcGrowth = h.rev_per_customer_then ? h.rev_per_customer / h.rev_per_customer_then - 1 : 0
  return (
    <Page kicker="Problem statement 1 · Beyond Distribution · live evidence" title="Does Constella answer the brief?">
      {/* hero band */}
      <div className="relative overflow-hidden rounded-[28px] bg-night p-6 text-white md:p-8">
        <span aria-hidden className="absolute -right-20 -top-24 size-80 rounded-full bg-gold-bright/25 blur-3xl" />
        <span aria-hidden className="absolute -bottom-32 left-1/3 size-72 rounded-full bg-[#3E5C76]/40 blur-3xl" />
        <p className="relative max-w-3xl text-lg leading-relaxed text-white/80 md:text-xl">
          “Design a mechanism that <b className="text-white">increases the revenue CNL earns per B2B customer</b> and moves it toward <b className="text-white">selling integrated solutions</b>.”
        </p>
        <div className="relative mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            ['Revenue / customer / month', inr(h.rev_per_customer), `${rpcGrowth >= 0 ? '+' : ''}${pct(rpcGrowth, 0)} over 22 months`],
            ['Divisions per customer', h.divisions_per_customer, 'the silo metric to push up'],
            ['Pilot GP uplift vs control', `+${h.gp_uplift_pct}%`, `decision: ${h.pilot_verdict.toUpperCase()}`],
            ['Workflow automated', pct(h.automation_share), 'scale without headcount'],
          ].map(([l, v, s]) => (
            <div key={l as string} className="rounded-2xl bg-white/[0.06] p-4 ring-1 ring-white/10 backdrop-blur">
              <p className="font-mono text-[10px] uppercase tracking-widest text-white/50">{l}</p>
              <p className="num mt-1 text-3xl font-semibold text-gold-bright">{v}</p>
              <p className="text-xs text-white/60">{s}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 5 points rail */}
      <div className="mt-5 grid gap-2 md:grid-cols-5">
        {x.points.map((p: any, i: number) => (
          <button key={p.no} onClick={() => setOpen(p.no)}
            className={`group relative overflow-hidden rounded-2xl p-4 text-left transition ${open === p.no ? 'bg-white shadow-[0_20px_40px_-24px_rgba(28,25,23,.5)]' : 'bg-white/50 hover:bg-white/80'}`}>
            <span className="absolute inset-x-0 top-0 h-1" style={{ background: TONES[i] }} />
            <div className="flex items-center justify-between">
              <span className="grid size-8 place-items-center rounded-full text-sm font-bold text-white" style={{ background: TONES[i] }}>{p.no}</span>
              {p.gaps.length ? <span className="flex items-center gap-1 text-[10px] text-warn"><AlertTriangle className="size-3" />{p.gaps.length} gap{p.gaps.length > 1 ? 's' : ''}</span> : null}
            </div>
            <p className="mt-3 font-semibold leading-tight">{p.title}</p>
            <p className="mt-1 flex items-center gap-1 text-xs text-spec-svc"><CheckCircle2 className="size-3.5" />Covered · {p.evidence.length} proofs</p>
          </button>
        ))}
      </div>

      {cur && (
        <div className="mt-3 grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <Card title={<span>{cur.no}. {cur.title}</span>} sub={<i>The brief: {cur.ask}</i>}>
            <div className="grid gap-3 sm:grid-cols-2">
              {cur.evidence.map((e: any) => (
                <div key={e.label} className="rounded-2xl border border-ink/5 bg-pearl/70 p-4">
                  <p className="label">{e.label}</p>
                  <p className={`mt-1 font-semibold leading-snug ${/^[₹\d.,%+–→\s-]+$/.test(String(e.value).split(' ')[0]) && String(e.value).length < 26 ? 'num text-2xl' : 'text-[15px]'}`}>{e.value}</p>
                  {e.note && <p className="mt-1 text-xs text-ink-soft">{e.note}</p>}
                </div>
              ))}
            </div>
            <Reasoning how={cur.how} why="Every figure on this card is queried live from the running system. Advance the clock or ingest orders and they move." />
          </Card>
          <div className="space-y-4">
            <Card title="See it working">
              <div className="flex flex-wrap gap-2">
                {cur.screens.map(([l, to]: string[]) => <Link key={to + l} to={to} className="flex items-center gap-1 rounded-full bg-ink px-4 py-2 text-xs font-medium text-white hover:bg-ink/85">{l}<ArrowUpRight className="size-3.5" /></Link>)}
              </div>
            </Card>
            <Card title={<span className="flex items-center gap-2"><AlertTriangle className="size-4 text-warn" />Known gaps — stated, not hidden</span>}>
              {cur.gaps.length ? <ul className="space-y-2 text-sm text-ink-soft">{cur.gaps.map((g: string) => <li key={g} className="rounded-xl bg-warn/5 px-3 py-2">{g}</li>)}</ul> : <p className="text-sm text-ink-soft">None open.</p>}
            </Card>
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card title="Revenue per B2B customer" sub="The PS headline metric — monthly billing ÷ active customers, with divisions per customer">
          <div className="h-64">
            <ResponsiveContainer>
              <ComposedChart data={x.revenue_per_customer} margin={{ left: 0, right: 0, top: 8 }}>
                <CartesianGrid stroke={CHART.grid} vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: CHART.axis }} interval={3} />
                <YAxis yAxisId="l" tickFormatter={(v) => inr(v, 0)} tick={{ fontSize: 10, fill: CHART.axis }} width={60} />
                <YAxis yAxisId="r" orientation="right" domain={[1, 2]} tick={{ fontSize: 10, fill: CHART.axis }} width={30} />
                <Tooltip formatter={(v: any, n: any) => (n === 'Divisions / customer' ? v : inr(v))} />
                <RBar yAxisId="l" dataKey="rev_per_customer" name="Revenue / customer" fill="#A16207" radius={[6, 6, 0, 0]} isAnimationActive={false} />
                <Line yAxisId="r" dataKey="divisions_per_customer" name="Divisions / customer" stroke="#3E5C76" strokeWidth={2.5} dot={false} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <Reasoning how="Per month: Σ invoice value ÷ distinct billed partners. Divisions per customer = mean count of distinct CNL divisions a partner bought from that month." why="If Constella works, both lines rise together: more wallet per partner, spread across more divisions (solutions, not boxes)." />
        </Card>
        <Card title="6-month pilot — cumulative revenue per treated partner" sub="Treatment vs control-calibrated counterfactual, 90% band">
          <div className="h-64">
            <ResponsiveContainer>
              <AreaChart data={x.pilot_monthly} margin={{ left: 0, right: 8, top: 8 }}>
                <CartesianGrid stroke={CHART.grid} vertical={false} />
                <XAxis dataKey="month" tickFormatter={(m) => `M${m}`} tick={{ fontSize: 11, fill: CHART.axis }} />
                <YAxis tickFormatter={(v) => inr(v, 0)} tick={{ fontSize: 10, fill: CHART.axis }} width={60} />
                <Tooltip formatter={(v: any) => inr(v)} labelFormatter={(m) => `Month ${m}`} />
                <Area dataKey="t_hi" stroke="none" fill="#F5B700" fillOpacity={0.15} isAnimationActive={false} name="Treatment p95" />
                <Area dataKey="treatment" stroke="#A16207" strokeWidth={2.5} fill="#F5B700" fillOpacity={0.25} isAnimationActive={false} name="Treatment" />
                <Area dataKey="control" stroke="#57534e" strokeWidth={2} strokeDasharray="5 4" fill="none" isAnimationActive={false} name="Counterfactual" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card className="mt-4" title={<span className="flex items-center gap-2"><Scale className="size-4" />Judging criteria → where the evidence is</span>} pad={false}>
        <div className="grid divide-y divide-ink/5 md:grid-cols-2 md:divide-x md:divide-y-0">
          {[0, 1].map((col) => (
            <ul key={col} className="divide-y divide-ink/5">
              {x.criteria.slice(col * 3, col * 3 + 3).map((c: any) => (
                <li key={c.criterion} className="px-5 py-3"><p className="text-sm font-semibold">{c.criterion}</p><p className="text-xs text-ink-soft">{c.evidence}</p></li>
              ))}
            </ul>
          ))}
        </div>
      </Card>
    </Page>
  )
}
