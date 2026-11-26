import { Repeat } from 'lucide-react'
import { Bar as RBar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Link } from 'react-router-dom'
import { inr, pct } from '@/lib/format'
import { Card, Loading, Page, Reasoning, Stat, useApi } from '../kit'
import { CHART } from '../theme'

export default function Annuity() {
  const d = useApi<any>(['annuity'], '/api/annuity/ledger')
  const x = d.data
  return (
    <Page kicker="Recurring revenue & stickiness" title="Annuity ledger">
      {!x ? <Loading rows={6} /> : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <Stat label="Annuity ARR" value={inr(x.arr)} sub={`was ${inr(x.arr_prev)} a year ago`} tone="#3f7d5c" icon={<Repeat className="size-4" />} />
            <Stat label="Net revenue retention" value={pct(x.nrr)} sub="same partners, this year vs last" tone="#a16207" />
            <Stat label="Attach rate" value={pct(x.attach_rate)} sub="installed base with a service plan" tone="#3e5c76" />
            <Stat label="Partners on annuity" value={x.partners_with_annuity} sub={`of ${x.partners_with_installed_base} with installed base`} tone="#6b4e71" />
            <Stat label="Renewals in 90 days" value={x.renewals_due_90d} sub="auto-quoted by the renewal playbook" tone="#c2553d" />
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <Card title="ARR by service line">
              <div className="h-64">
                <ResponsiveContainer>
                  <BarChart data={x.by_category} layout="vertical" margin={{ left: 20 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="label" width={170} tick={{ fill: CHART.axis, fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(v: any) => inr(v)} cursor={{ fill: 'rgba(28,25,23,.04)' }} />
                    <RBar isAnimationActive={false} dataKey="arr" fill="#3f7d5c" radius={[0, 8, 8, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <Reasoning how="ARR = service-line revenue (filters, AMC, CMS licences, certification, DaaS, warranty) invoiced in the last 12 months. NRR = this year's annuity from partners who had annuity last year ÷ last year's annuity."
                why="The problem statement asks for 'recurring, annuity-based revenue that drives stickiness'. Annuity carries 24–55% margin and near-zero working capital, versus 3–5% EBITDA on hardware." />
            </Card>
            <Card title="Largest annuity partners">
              <ul className="space-y-2">
                {x.top_partners.map((t: any) => (
                  <li key={t.account_id} className="flex items-center justify-between text-sm">
                    <Link to={`/app/accounts/${t.account_id}`} className="hover:text-gold">{t.name}</Link><span className="num">{inr(t.arr)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
          <Card title="Renewal calendar — next 90 days" sub="From the installed-base twin: what is due, where, and for how many units" className="mt-4" pad={false}>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-[11px] uppercase tracking-wider text-ink-soft"><th className="px-5 py-2">Due</th><th>Partner</th><th>Installed</th><th>Service</th><th className="px-5 text-right">Units</th></tr></thead>
              <tbody>
                {x.renewals.map((r: any, i: number) => (
                  <tr key={i} className="border-t border-ink/5"><td className="num px-5 py-2">{r.due}</td><td>{r.name}</td><td className="text-ink-soft">{r.category}</td><td>{r.annuity}</td><td className="num px-5 text-right">{r.qty}</td></tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </Page>
  )
}
