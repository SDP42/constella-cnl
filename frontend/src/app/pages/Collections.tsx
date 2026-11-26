import { AlertTriangle, CalendarClock, IndianRupee, Timer } from 'lucide-react'
import { Bar as RBar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Link } from 'react-router-dom'
import { inr } from '@/lib/format'
import { Bar, Card, Loading, Page, Reasoning, Stat, useApi } from '../kit'
import { CHART } from '../theme'

const RISK: Record<string, string> = { 'Call owner today; hold new credit': '#b42318', 'WhatsApp reminder with UPI link': '#b45309', 'Auto-reminder 3 days before due': '#3f7d5c' }

export default function Collections() {
  const d = useApi<any>(['collections'], '/api/money/collections')
  const x = d.data
  if (!x) return <Page title="Collections & cash"><Loading rows={8} /></Page>
  const maxAge = Math.max(...x.aging.map((a: any) => a.amount))
  return (
    <Page kicker="Money · receivables · working capital" title="Collections & cash forecast">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Receivables open" value={inr(x.ar_outstanding)} sub={`${x.open_invoices} invoices`} icon={<IndianRupee className="size-4" />} />
        <Stat label="DSO" value={`${x.dso} days`} sub="AR ÷ average daily sales (90 d)" tone="#3E5C76" icon={<Timer className="size-4" />} />
        <Stat label="Predicted to pay late" value={inr(x.expected_late_value)} sub="> 10 days past terms" tone="#C2553D" icon={<AlertTriangle className="size-4" />} />
        <Stat label="Pay-date model error" value={`± ${x.model.mae_days} d`} sub={`naive average ± ${x.model.naive_mae_days} d`} tone="#3F7D5C" icon={<CalendarClock className="size-4" />} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card title="13-week cash-in forecast" sub="Contractual (by due date) vs expected (by predicted pay date)">
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={x.weeks} margin={{ left: 0, right: 8, top: 8 }}>
                <CartesianGrid stroke={CHART.grid} vertical={false} />
                <XAxis dataKey="week" tickFormatter={(w) => `W${w}`} tick={{ fontSize: 11, fill: CHART.axis }} />
                <YAxis tickFormatter={(v) => inr(v, 0)} tick={{ fontSize: 10, fill: CHART.axis }} width={60} />
                <Tooltip formatter={(v: any) => inr(v)} labelFormatter={(w) => `Week ${w}`} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <RBar dataKey="contractual" name="Contractual" fill="#d6d3d1" radius={[6, 6, 0, 0]} isAnimationActive={false} />
                <RBar dataKey="expected" name="Expected" fill="#A16207" radius={[6, 6, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <Reasoning how={`A gradient-boosted regressor learns days-to-pay from ${x.model.trained_on.toLocaleString()} settled invoices (terms, the partner's payment history, credit utilisation, ticket size, quarter-end, weekday), then predicts each open invoice's pay date. Back-tested on the last 90 days.`}
            why="CNL's growth is bounded by working capital. Knowing which rupees arrive when lets treasury plan purchases and lets sales stop extending credit to partners who will pay late." />
        </Card>
        <div className="space-y-4">
          <Card title="Ageing">
            <div className="space-y-2">{x.aging.map((a: any) => (
              <div key={a.bucket} className="grid grid-cols-[70px_1fr_80px] items-center gap-3 text-sm"><span>{a.bucket}</span><Bar value={a.amount} max={maxAge} color={a.bucket === 'Not due' ? '#3f7d5c' : a.bucket === '1–30' ? '#c99a2e' : '#c2553d'} /><span className="num text-right text-xs">{inr(a.amount)}</span></div>
            ))}</div>
          </Card>
          <Card title="What drives late payment">
            <ul className="space-y-1.5 text-sm">{x.model.drivers.map((f: any) => <li key={f.feature} className="grid grid-cols-[120px_1fr_40px] items-center gap-2"><span className="font-mono text-xs">{f.feature}</span><Bar value={f.corr} max={1} color="#3E5C76" /><span className="num text-right text-xs">{f.corr}</span></li>)}</ul>
          </Card>
        </div>
      </div>

      <Card className="mt-4" title="Collection worklist" sub="Ranked by amount × predicted lateness. The action is set automatically per risk band" pad={false}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead><tr className="text-left text-[11px] uppercase tracking-wider text-ink-soft"><th className="px-5 py-2">Partner</th><th className="text-right">Outstanding</th><th className="text-right">Terms</th><th className="text-right">Overdue</th><th className="text-right">Pred. late</th><th>Expected by</th><th className="px-5">Next action</th></tr></thead>
            <tbody>
              {x.worklist.map((w: any) => (
                <tr key={w.account_id} className="border-t border-ink/5">
                  <td className="px-5 py-2"><Link to={`/app/accounts/${w.account_id}`} className="font-medium hover:text-gold">{w.name}</Link><div className="text-[11px] text-ink-soft">{w.invoices} invoice{w.invoices > 1 ? 's' : ''}</div></td>
                  <td className="num text-right">{inr(w.outstanding)}</td><td className="num text-right">{w.terms} d</td><td className="num text-right">{w.overdue_days} d</td>
                  <td className="num text-right font-semibold" style={{ color: w.predicted_late_days > 30 ? '#b42318' : w.predicted_late_days > 10 ? '#b45309' : '#3f7d5c' }}>+{w.predicted_late_days} d</td>
                  <td className="num text-xs">{w.expected_by}</td>
                  <td className="px-5"><span className="rounded-full px-2.5 py-1 text-[11px] font-medium text-white" style={{ background: RISK[w.action] }}>{w.action}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="px-5 pb-4 pt-2 text-[11px] text-ink-soft">{x.note}</p>
      </Card>
    </Page>
  )
}
