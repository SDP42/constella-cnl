import { useMutation } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Slider } from '@/components/ui/slider'
import { api } from '@/lib/api'
import { inr, pct } from '@/lib/format'
import { Card, Loading, Page } from '../kit'
import { CHART } from '../theme'

const LABEL: Record<string, string> = {
  cross_sell_rate: 'Cross-sell rate', solution_attach_rate: 'Solution attach rate', arr_per_account: 'Annuity per partner',
  gp_per_account: 'Gross profit per partner', revenue_per_account: 'Revenue per partner',
}

export default function Pilot() {
  const [action, setAction] = useState(65)
  const [uplift, setUplift] = useState(100)
  const sim = useMutation({ mutationFn: () => api('/api/pilot/simulate', { method: 'POST', json: { action_rate: action / 100, uplift_scale: uplift / 100, runs: 300 } }) })
  useEffect(() => { const t = setTimeout(() => sim.mutate(), 250); return () => clearTimeout(t) }, [action, uplift]) // eslint-disable-line react-hooks/exhaustive-deps
  const r = sim.data
  const verdictTone = r?.decision.verdict === 'scale' ? 'bg-spec-svc text-white' : r?.decision.verdict === 'extend' ? 'bg-warn text-white' : 'bg-danger text-white'
  return (
    <Page kicker="Prove it works · 6-month pilot" title="Pilot lab">
      <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
        <Card title="Assumptions" sub="Randomised holdout: 20% of partners (stratified by type) get no routed opportunities.">
          <div className="space-y-6">
            <div><div className="mb-2 flex justify-between text-sm"><span>Rep action rate</span><span className="num font-medium">{action}%</span></div><Slider value={[action]} min={10} max={100} onValueChange={(v) => setAction(v[0])} aria-label="Rep action rate" /></div>
            <div><div className="mb-2 flex justify-between text-sm"><span>Uplift strength</span><span className="num font-medium">{uplift}%</span></div><Slider value={[uplift]} min={0} max={200} onValueChange={(v) => setUplift(v[0])} aria-label="Uplift strength" /></div>
            {r && <p className="text-xs text-ink-soft">{r.assumptions.treatment_accounts} treatment vs {r.assumptions.control_accounts} control partners · {r.assumptions.runs} Monte-Carlo runs</p>}
          </div>
          {r && (
            <div className={`mt-6 rounded-2xl p-4 ${verdictTone}`}>
              <p className="font-mono text-[11px] uppercase tracking-widest opacity-80">Month-6 decision</p>
              <p className="mt-1 text-2xl font-semibold uppercase">{r.decision.verdict}</p>
              <p className="mt-1 text-sm opacity-90">{r.decision.message}</p>
            </div>
          )}
        </Card>
        <div className="space-y-4">
          {!r ? <Loading rows={4} /> : (
            <>
              <div className="grid gap-3 md:grid-cols-5">
                {Object.entries(r.kpis).map(([k, v]: any) => (
                  <div key={k} className="pane p-4">
                    <p className="label">{LABEL[k]}</p>
                    <p className="num mt-2 text-2xl font-semibold text-spec-svc">+{v.uplift_pct}%</p>
                    <p className="num mt-1 text-[11px] text-ink-soft">{k.includes('rate') ? `${pct(v.treatment.mean, 1)} vs ${pct(v.control.mean, 1)}` : `${inr(v.treatment.mean)} vs ${inr(v.control.mean)}`}</p>
                    <p className="num text-[11px] text-ink-soft">90% CI {k.includes('rate') ? `${pct(v.uplift.p5, 1)}…${pct(v.uplift.p95, 1)}` : `${inr(v.uplift.p5)}…${inr(v.uplift.p95)}`}</p>
                  </div>
                ))}
              </div>
              <Card title="Cumulative revenue per partner — treatment vs control" sub="Band = 90% interval across simulations">
                <div className="h-72">
                  <ResponsiveContainer>
                    <ComposedChart data={r.monthly.map((m: any) => ({ ...m, band: [m.t_lo, m.t_hi], month: `M${m.month}` }))}>
                      <CartesianGrid stroke={CHART.grid} vertical={false} />
                      <XAxis dataKey="month" tick={{ fill: CHART.axis, fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={(v) => inr(v, 0)} tick={{ fill: CHART.axis, fontSize: 11 }} axisLine={false} tickLine={false} width={64} />
                      <Tooltip formatter={(v: any) => (Array.isArray(v) ? `${inr(v[0])} – ${inr(v[1])}` : inr(v))} />
                      <Area dataKey="band" fill="#3f7d5c" fillOpacity={0.15} stroke="none" />
                      <Line dataKey="treatment" stroke="#3f7d5c" strokeWidth={3} dot={{ r: 3 }} name="Treatment (Constella)" />
                      <Line dataKey="control" stroke="#a8a29e" strokeWidth={2.5} strokeDasharray="6 4" dot={{ r: 3 }} name="Control (holdout)" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </Card>
              <Card title="Scale-or-stop gates">
                <ol className="grid gap-2 md:grid-cols-2">
                  {r.decision.gates.map((g: any) => (
                    <li key={g.month} className="rounded-xl bg-white/70 p-3 text-sm">
                      <div className="flex items-center justify-between"><b>Month {g.month} · {g.gate}</b></div>
                      <p className="mt-1">{g.metric}</p>
                      <p className="mt-1 text-xs text-ink-soft">If it fails: {g.if_fail}</p>
                    </li>
                  ))}
                </ol>
              </Card>
            </>
          )}
        </div>
      </div>
    </Page>
  )
}
