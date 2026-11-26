import { AlertOctagon, Banknote, ShieldAlert, TrendingUp } from 'lucide-react'
import { useState } from 'react'
import { Bar as RBar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Slider } from '@/components/ui/slider'
import { useAuth } from '@/lib/auth'
import { inr, pct } from '@/lib/format'
import { Card, Loading, Page, Reasoning, Stat, useApi } from '../kit'
import { CHART } from '../theme'

const GRADE_COLOR: Record<string, string> = { A: '#3f7d5c', B: '#6f9a63', C: '#c99a2e', D: '#c2553d', E: '#8f2a1c' }

function Nwc() {
  const [dso, setDso] = useState(62)
  const [dio, setDio] = useState(38)
  const [dpo, setDpo] = useState(55)
  const d = useApi<any>(['nwc', dso, dio, dpo], `/api/bi/nwc?dso=${dso}&dio=${dio}&dpo=${dpo}`, { placeholderData: (p: any) => p })
  const x = d.data
  return (
    <Card title="Working-capital simulator" sub="Calibrated to CNL's disclosed 45 net working-capital days (H1 FY27)">
      <div className="grid gap-6 md:grid-cols-[1fr_220px]">
        <div className="space-y-5">
          {[['Debtor days (DSO)', dso, setDso], ['Inventory days (DIO)', dio, setDio], ['Creditor days (DPO)', dpo, setDpo]].map(([l, v, set]: any) => (
            <div key={l}>
              <div className="mb-2 flex justify-between text-sm"><span>{l}</span><span className="num font-medium">{v} d</span></div>
              <Slider value={[v]} min={10} max={120} step={1} onValueChange={(vv) => set(vv[0])} aria-label={l} />
            </div>
          ))}
        </div>
        {x && (
          <div className="flex flex-col justify-center rounded-2xl bg-ink p-5 text-white">
            <p className="font-mono text-[11px] uppercase tracking-widest text-white/60">Net working capital</p>
            <p className="num mt-1 text-4xl font-semibold">{x.nwc_days} <span className="text-lg text-white/60">days</span></p>
            <p className="mt-1 text-xs text-white/60">base {x.base_nwc_days} days</p>
            <p className={`num mt-4 text-xl font-semibold ${x.cash_released >= 0 ? 'text-gold-bright' : 'text-[#ff9a85]'}`}>{x.cash_released >= 0 ? '+' : ''}{inr(x.cash_released)}</p>
            <p className="text-xs text-white/60">cash {x.cash_released >= 0 ? 'released' : 'absorbed'} · {inr(x.interest_saved)}/yr interest at 12%</p>
          </div>
        )}
      </div>
      <Reasoning how="NWC days = DSO + DIO − DPO. Each day is worth CNL's FY26 revenue ÷ 365 (≈ ₹7.4 Cr). Cash released = (base NWC − new NWC) × value per day."
        why="CNL earns 3–5% EBITDA, so a few days of working capital are worth more than a percentage point of margin. Every cross-sell Constella recommends is also scored on its cash cycle."
        source="CNL Q2 FY27 earnings call (NWC 45 days, down from 75); FY26 consolidated revenue from the investor presentation." />
    </Card>
  )
}

export default function CreditCash() {
  const user = useAuth((s) => s.user)!
  const sc = useApi<any>(['credit'], '/api/credit/scores')
  const wl = useApi<any[]>(['worklist'], '/api/credit/worklist?limit=20')
  const x = sc.data
  return (
    <Page kicker="Credit & working capital" title="Credit & cash">
      {!x ? <Loading rows={6} /> : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Grade A/B partners" value={(x.distribution.A ?? 0) + (x.distribution.B ?? 0)} sub="eligible for higher limits" tone="#3f7d5c" icon={<TrendingUp className="size-4" />} />
            <Stat label="Safe limit unlock" value={inr(x.headroom_unlock)} sub="more credit for good payers = more wallet share" tone="#a16207" icon={<Banknote className="size-4" />} />
            <Stat label="Early warnings" value={x.early_warning.length} sub="grade D/E and >80% utilised" tone="#c2553d" icon={<ShieldAlert className="size-4" />} />
            <Stat label="Overdue in worklist" value={inr((wl.data ?? []).reduce((s: number, w: any) => s + w.overdue, 0))} sub="estimated, beyond 45-day terms" tone="#8f2a1c" icon={<AlertOctagon className="size-4" />} />
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1.3fr]">
            <Card title="Partner credit grades" sub={x.method}>
              <div className="h-56">
                <ResponsiveContainer>
                  <BarChart data={Object.entries(x.distribution).map(([g, n]) => ({ g, n }))}>
                    <XAxis dataKey="g" tick={{ fill: CHART.axis, fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: CHART.axis, fontSize: 11 }} axisLine={false} tickLine={false} width={34} />
                    <Tooltip cursor={{ fill: 'rgba(28,25,23,.04)' }} />
                    <RBar isAnimationActive={false} dataKey="n" name="Partners" radius={[8, 8, 0, 0]}>{Object.keys(x.distribution).map((g) => <Cell key={g} fill={GRADE_COLOR[g]} />)}</RBar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <Reasoning how="Score 0–100 = 40% payment discipline (avg payment days) + 25% limit utilisation + 20% 6-month order momentum + 15% retention (1 − churn-model risk). Grades: A ≥ 80, B ≥ 65, C ≥ 50, D ≥ 35, E below."
                why="Static credit limits block growth with good partners and over-expose CNL to weak ones. A grade-driven limit (A +25%, B +10%, D −10%, E −25%) grows wallet share where it is safe." />
            </Card>
            <Card title="Early warning" sub="Partners whose grade and utilisation suggest default risk — act before the next order ships" pad={false}>
              <table className="w-full text-sm">
                <thead><tr className="text-left text-[11px] uppercase tracking-wider text-ink-soft"><th className="px-5 py-2">Partner</th><th>Grade</th><th className="text-right">Utilised</th><th className="text-right">Pay days</th><th className="px-5 text-right">New limit</th></tr></thead>
                <tbody>
                  {x.early_warning.slice(0, 8).map((r: any) => (
                    <tr key={r.id} className="border-t border-ink/5">
                      <td className="px-5 py-2"><div className="font-medium">{r.name}</div><div className="text-xs text-ink-soft">{r.city}</div></td>
                      <td><span className="rounded-full px-2 py-0.5 text-xs font-semibold text-white" style={{ background: GRADE_COLOR[r.grade] }}>{r.grade}</span></td>
                      <td className="num text-right">{pct(r.util)}</td><td className="num text-right">{r.avg_payment_days}</td>
                      <td className="num px-5 text-right">{inr(r.recommended_limit)} <span className="text-xs text-danger">{pct(r.limit_change_pct)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-[1.3fr_1fr]">
            <Card title={`Collections worklist${user.role === 'rep' ? ' — your territory' : ''}`} sub="Ranked by overdue × (1 + churn risk): chase what is both large and likely to walk away" pad={false}>
              {!wl.data ? <div className="p-5"><Loading /></div> : (
                <ul className="divide-y divide-ink/5">
                  {wl.data.slice(0, 10).map((w) => (
                    <li key={w.account_id} className="grid grid-cols-[1fr_auto] items-center gap-3 px-5 py-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2"><span className="font-medium">{w.name}</span><span className="rounded-full px-1.5 text-[10px] font-semibold text-white" style={{ background: GRADE_COLOR[w.grade] }}>{w.grade}</span></div>
                        <div className="text-xs text-ink-soft">{w.city} · pays in {w.payment_days} days · {w.action}</div>
                      </div>
                      <div className="text-right"><div className="num font-semibold text-danger">{inr(w.overdue)}</div><div className="num text-[11px] text-ink-soft">of {inr(w.receivable)}</div></div>
                    </li>
                  ))}
                </ul>
              )}
              <div className="px-5 pb-4"><Reasoning how="Receivable ≈ monthly spend × payment days ÷ 30; overdue = the share beyond 45-day standard terms. Actions escalate from WhatsApp reminder to early-payment discount to order hold." why="CNL's debtor days rose from ~50 to ~79 over two years (Screener). Collections that run from a ranked list recover more cash with the same team." /></div>
            </Card>
            <Nwc />
          </div>
        </>
      )}
    </Page>
  )
}
