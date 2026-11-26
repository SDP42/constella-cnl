import { useMutation } from '@tanstack/react-query'
import { Award, Medal, Timer, TrendingDown } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Slider } from '@/components/ui/slider'
import { api } from '@/lib/api'
import { inr, pct } from '@/lib/format'
import { Bar, Card, Loading, Page, Reasoning, useApi } from '../kit'
import { DIV_COLORS_MAP } from '../theme'

const BADGE: Record<string, string> = { 'Solution seller': '#a16207', 'Annuity champion': '#3f7d5c', 'SLA hero': '#3e5c76', 'Team player': '#6b4e71', Closer: '#c2553d' }

function exportCsv(rows: any[], name: string) {
  if (!rows.length) return
  const keys = Object.keys(rows[0]).filter((k) => typeof rows[0][k] !== 'object')
  const csv = [keys.join(','), ...rows.map((r) => keys.map((k) => JSON.stringify(r[k] ?? '')).join(','))].join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  a.download = `${name}.csv`
  a.click()
}

export default function TeamHub() {
  const d = useApi<any>(['team'], '/api/team/overview')
  const [lead, setLead] = useState(70)
  const [rh, setRh] = useState(1)
  const [ra, setRa] = useState(4)
  const comm = useMutation({ mutationFn: () => api('/api/team/commission', { method: 'POST', json: { lead_share: lead / 100, rate_hardware: rh / 100, rate_annuity: ra / 100 } }) })
  useEffect(() => { const t = setTimeout(() => comm.mutate(), 200); return () => clearTimeout(t) }, [lead, rh, ra]) // eslint-disable-line react-hooks/exhaustive-deps
  const x = d.data
  if (!x) return <Page title="Team hub"><Loading rows={8} /></Page>
  const podium = x.leaderboard.slice(0, 3)
  return (
    <Page kicker="People & productivity" title="Team hub"
      actions={<button onClick={() => exportCsv(x.leaderboard, 'constella-leaderboard')} className="rounded-full bg-white px-4 py-2 text-sm">Export CSV</button>}>
      <div className="grid gap-4 md:grid-cols-3">
        {podium.map((r: any, i: number) => (
          <div key={r.id} className={`relative overflow-hidden rounded-[22px] p-5 ${i === 0 ? 'bg-ink text-white' : 'pane'}`}>
            <span aria-hidden className="absolute -right-8 -top-8 size-32 rounded-full opacity-30 blur-2xl" style={{ background: DIV_COLORS_MAP[r.division] }} />
            <div className="flex items-center gap-2"><Medal className={`size-5 ${i === 0 ? 'text-gold-bright' : 'text-gold'}`} /><span className="font-mono text-[11px] uppercase tracking-widest opacity-60">#{i + 1} · {r.division} · {r.region}</span></div>
            <div className="mt-2 text-2xl font-semibold">{r.name}</div>
            <div className="num mt-1 text-3xl font-semibold">{inr(r.credit)}</div>
            <div className="text-xs opacity-60">credit · {pct(r.attainment)} of quota · {inr(r.assist_credit)} from assists</div>
            <div className="mt-3 flex flex-wrap gap-1.5">{r.badges.map((b: string) => <span key={b} className="rounded-full px-2 py-0.5 text-[10px] font-medium text-white" style={{ background: BADGE[b] }}>{b}</span>)}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card title={<span className="flex items-center gap-2"><Award className="size-4" />Leaderboard & quota attainment</span>} sub="Split credit counts — assists are rewarded, so accounts get shared" pad={false}>
          <div className="max-h-[460px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white"><tr className="text-left text-[11px] uppercase tracking-wider text-ink-soft"><th className="px-5 py-2">Rep</th><th>Won</th><th className="w-40">Attainment</th><th className="text-right">Credit</th><th className="px-5">Badges</th></tr></thead>
              <tbody>
                {x.leaderboard.map((r: any) => (
                  <tr key={r.id} className="border-t border-ink/5">
                    <td className="px-5 py-2"><div className="font-medium">{r.name}</div><div className="text-[11px] text-ink-soft">{r.division} · {r.region}</div></td>
                    <td className="num">{r.won}</td>
                    <td><div className="flex items-center gap-2"><Bar value={Math.min(r.attainment, 1.5)} max={1.5} color={r.attainment >= 1 ? '#3f7d5c' : '#c99a2e'} /><span className="num w-10 text-right text-xs">{pct(r.attainment)}</span></div></td>
                    <td className="num text-right">{inr(r.credit)}</td>
                    <td className="px-5">{r.badges.map((b: string) => <span key={b} title={b} className="mr-1 inline-block size-2.5 rounded-full" style={{ background: BADGE[b] }} />)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <div className="space-y-4">
          <Card title="Commission simulator" sub="Change the split-credit contract and see payouts move">
            <div className="space-y-4">
              {[['Lead share of credit', lead, setLead, 50, 100], ['Rate on hardware (%)', rh, setRh, 0, 5], ['Rate on annuity (%)', ra, setRa, 0, 15]].map(([l, v, set, mn, mx]: any) => (
                <div key={l}><div className="mb-2 flex justify-between text-sm"><span>{l}</span><span className="num font-medium">{v}</span></div><Slider value={[v]} min={mn} max={mx} step={1} onValueChange={(vv) => set(vv[0])} aria-label={l} /></div>
              ))}
            </div>
            <ul className="mt-4 space-y-1.5">
              {(comm.data ?? []).slice(0, 6).map((c: any) => <li key={c.rep} className="flex justify-between text-sm"><span>{c.rep} <span className="text-xs text-ink-soft">{c.division}</span></span><span className="num">{inr(c.payout)}</span></li>)}
            </ul>
            <Reasoning how="Pool = closed value × rate (annuity paid at a higher rate). The lead gets the lead share; assists split the rest equally." why="Paying more for annuity and for assists is how the incentive plan pushes reps toward solutions and recurring revenue." />
          </Card>
          <Card title={<span className="flex items-center gap-2"><Timer className="size-4" />Stage velocity</span>} sub="Median days between stages, from the audit trail">
            <div className="flex items-end gap-2">
              {x.velocity.map((v: any) => (
                <div key={v.stage} className="flex flex-1 flex-col items-center">
                  <div className="num text-xs font-semibold">{v.days}d</div>
                  <div className="w-full rounded-t-lg bg-gold/70" style={{ height: `${Math.max(8, v.days * 14)}px` }} />
                  <div className="mt-1 text-center text-[9px] leading-tight text-ink-soft">{v.stage.replace('→', ' → ')}</div>
                </div>
              ))}
            </div>
          </Card>
          <Card title={<span className="flex items-center gap-2"><TrendingDown className="size-4" />Why deals are lost</span>}>
            <ul className="space-y-2">{x.loss_reasons.map((l: any) => <li key={l.reason} className="text-sm"><div className="flex justify-between"><span className="capitalize">{l.reason}</span><span className="num">{l.count}</span></div><Bar value={l.count} max={x.loss_reasons[0].count} color="#c2553d" /></li>)}</ul>
          </Card>
        </div>
      </div>
    </Page>
  )
}
