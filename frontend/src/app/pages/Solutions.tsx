import { useMutation } from '@tanstack/react-query'
import { Check, Layers } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { inr, pct } from '@/lib/format'
import { Card, DivDot, Loading, Page, useApi, Reasoning } from '../kit'

export default function Solutions() {
  const sols = useApi<any[]>(['solutions'], '/api/solutions')
  const accounts = useApi<any>(['acc-compose'], '/api/accounts?limit=300&sort=whitespace')
  const [sel, setSel] = useState<string>('smart_classroom')
  const [aid, setAid] = useState<number>(1)
  const compose = useMutation({
    mutationFn: () => api('/api/solutions/compose', { method: 'POST', json: { account_id: aid, solution_id: sel } }),
    onError: (e: any) => toast.error(e.message),
  })
  const s = sols.data?.find((x) => x.id === sel)
  const r = compose.data
  return (
    <Page kicker="Turn baskets into solutions" title="Solution composer">
      {!sols.data ? <Loading rows={6} /> : (
        <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
          <div className="space-y-2">
            {sols.data.map((x) => (
              <button key={x.id} onClick={() => setSel(x.id)}
                className={`pane lift w-full !rounded-2xl p-4 text-left ${sel === x.id ? 'ring-2 ring-gold' : ''}`}>
                <div className="flex items-center justify-between"><span className="font-semibold">{x.name}</span><span className="flex gap-1">{x.divisions.map((d: string) => <DivDot key={d} div={d} />)}</span></div>
                <p className="mt-1 text-xs text-ink-soft">{x.tagline}</p>
                <p className="mt-2 text-[11px] text-ink-soft">Pipeline: <b className="num">{x.pipeline.count ?? 0}</b> deals · <b className="num">{inr(x.pipeline.value ?? 0)}</b></p>
              </button>
            ))}
          </div>
          <div className="space-y-4">
            {s && (
              <Card title={s.name} sub={`For: ${s.verticals.join(', ')}`}
                right={
                  <div className="flex items-center gap-2">
                    <label htmlFor="compose-acc" className="sr-only">Partner</label>
                    <select id="compose-acc" value={aid} onChange={(e) => setAid(Number(e.target.value))} className="h-9 max-w-56 rounded-xl border border-ink/10 bg-white px-2 text-sm">
                      {accounts.data?.items.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                    <button onClick={() => compose.mutate()} className="flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-sm font-medium text-white"><Layers className="size-4" />Compose BOM</button>
                  </div>
                }>
                <div className="grid gap-2 md:grid-cols-2">
                  {s.components.map((c: any) => (
                    <div key={c.category} className="flex items-center justify-between rounded-xl bg-white/70 px-3 py-2.5 text-sm">
                      <span className="flex items-center gap-2"><DivDot div={c.division} />{c.role}<span className="text-[11px] text-ink-soft">{c.label}</span></span>
                      {c.required && <span className="text-[10px] uppercase tracking-wide text-ink-soft">core</span>}
                    </div>
                  ))}
                </div>
                <Reasoning how="Quantities scale with the partner's size: own headcount for enterprises/retailers, project throughput (annual tech spend ÷ ₹60 L) for SIs and resellers. Components the partner already buys are removed automatically." why="One PO across divisions, with the service plan attached at the start, is how a distributor becomes a solutions provider." />
                <p className="mt-3 text-xs text-ink-soft">Annuity: {s.annuity.map((a: any) => `${a.label} (every ${a.period} mo)`).join(' · ')}</p>
              </Card>
            )}
            {r && (
              <Card title={`Bill of materials — ${r.account.name}`} sub="Components the partner already owns are excluded automatically">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-[11px] uppercase tracking-wider text-ink-soft"><th className="pb-2">Line</th><th className="pb-2">Brand</th><th className="pb-2 text-right">Qty</th><th className="pb-2 text-right">Amount</th><th className="pb-2 text-right">Margin</th></tr></thead>
                  <tbody>
                    {r.lines.map((l: any) => (
                      <tr key={l.category} className={`border-t border-ink/5 ${l.already_owned ? 'text-ink-soft line-through' : ''}`}>
                        <td className="py-2"><span className="flex items-center gap-2"><DivDot div={l.division} />{l.role}</span></td><td>{l.brand}</td>
                        <td className="num text-right">{l.qty}</td><td className="num text-right">{inr(l.amount)}</td><td className="num text-right">{pct(l.margin_pct)}</td>
                      </tr>
                    ))}
                    {r.annuity.map((l: any) => (
                      <tr key={l.category} className="border-t border-ink/5 text-spec-svc">
                        <td className="py-2">↻ {l.label}</td><td>annuity</td><td className="num text-right">{l.qty}</td><td className="num text-right">{inr(l.annual)}/yr</td><td className="num text-right">{pct(l.margin_pct)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                  {[['Hardware', inr(r.totals.hardware)], ['Gross profit', `${inr(r.totals.gross_profit)} · ${pct(r.totals.gp_pct)}`], ['Annuity / yr', inr(r.totals.arr)], ['3-yr value', inr(r.totals.three_year_value)]].map(([k, v]) => (
                    <div key={k} className="rounded-xl bg-ink/[0.03] p-3"><p className="label">{k}</p><p className="num mt-1 font-semibold">{v}</p></div>
                  ))}
                </div>
                <p className={`mt-3 flex items-center gap-1.5 text-sm ${r.totals.fits_credit ? 'text-spec-svc' : 'text-warn'}`}>
                  <Check className="size-4" />{r.totals.fits_credit ? 'Fits the partner’s credit headroom' : `Exceeds headroom (${inr(r.account.credit_headroom)}) — offer DaaS or phasing`} · one PO across {r.totals.divisions.join(', ')}
                </p>
              </Card>
            )}
          </div>
        </div>
      )}
    </Page>
  )
}
