import { useMutation, useQueryClient } from '@tanstack/react-query'
import { BrainCircuit, Crown, FileUp, Loader2, RefreshCw, ShoppingCart, ThumbsDown, ThumbsUp } from 'lucide-react'
import { useRef, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { inr, pct, titleCase } from '@/lib/format'
import { Card, Loading, Page, Reasoning, Stat, useApi } from '../kit'
import { CHART } from '../theme'

export default function Learning() {
  const qc = useQueryClient()
  const role = useAuth((s) => s.user)!.role
  const st = useApi<any>(['learn'], '/api/learn/status', { refetchInterval: (q: any) => (q.state.data?.running ? 2500 : 15000) } as any)
  const [last, setLast] = useState<any>(null)
  const file = useRef<HTMLInputElement>(null)
  const after = (r: any, msg: string) => { setLast(r); toast.success(msg); qc.invalidateQueries() }
  const orders = useMutation({ mutationFn: () => api('/api/learn/demo-orders?n=30', { method: 'POST' }),
    onSuccess: (r: any) => after(r, `${r.ingested} orders ingested · ${r.attribution.matched} opportunities won · ${r.rescore.opportunities_moved} re-scored`), onError: (e: any) => toast.error(e.message) })
  const retrain = useMutation({ mutationFn: () => api('/api/learn/retrain', { method: 'POST' }),
    onSuccess: (r: any) => after(r, r.status === 'busy' ? 'A retrain is already running' : `v${r.version} ${r.promoted ? 'promoted' : 'rejected — champion kept'}`), onError: (e: any) => toast.error(e.message) })
  const upload = useMutation({ mutationFn: (f: File) => { const fd = new FormData(); fd.append('file', f); return api('/api/learn/orders/csv', { method: 'POST', body: fd }) },
    onSuccess: (r: any) => after(r, `${r.ingested} rows ingested, ${r.errors.length} rejected`), onError: (e: any) => toast.error(e.message) })
  const x = st.data
  if (!x) return <Page title="Learning loop"><Loading rows={8} /></Page>
  const canWrite = role === 'steward' || role === 'head'
  const hist = x.history.map((h: any) => ({ ...h, v: `v${h.version}` }))
  const cats = Object.entries(x.feedback.category ?? {}).sort((a: any, b: any) => (b[1].useful + b[1].not) - (a[1].useful + a[1].not)).slice(0, 10)
  const moves = last?.rescore?.top_moves ?? last?.top_moves ?? []
  return (
    <Page kicker="Dynamic backend · the model keeps learning" title="Learning loop"
      actions={<>
        <button onClick={() => orders.mutate()} disabled={orders.isPending} className="flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-sm text-white">{orders.isPending ? <Loader2 className="size-4 animate-spin" /> : <ShoppingCart className="size-4" />}Simulate a day of ERP orders</button>
        <button onClick={() => retrain.mutate()} disabled={retrain.isPending || x.running} className="flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm">{retrain.isPending || x.running ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}Retrain now</button>
        {canWrite && <><button onClick={() => file.current?.click()} className="flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm"><FileUp className="size-4" />Upload orders CSV</button>
          <input ref={file} type="file" accept=".csv" hidden onChange={(e) => e.target.files?.[0] && upload.mutate(e.target.files[0])} /></>}
      </>}>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Champion model" value={`v${x.history.length}`} sub={`AUC ${x.champion.auc} · GP@5 ${pct(x.champion.gp5, 1)}`} tone="#A16207" icon={<Crown className="size-4" />} />
        <Stat label="Orders since last train" value={x.orders_since_train} sub={`auto-retrain at ${x.retrain_threshold}`} tone="#3E5C76" icon={<ShoppingCart className="size-4" />} />
        <Stat label="Rep feedback" value={x.feedback.n} sub={`network useful rate ${pct(x.feedback.base_rate)}`} tone="#3F7D5C" icon={<ThumbsUp className="size-4" />} />
        <Stat label="Status" value={x.running ? 'Training…' : 'Idle'} sub={x.running ? 'challenger being back-tested' : `clock ${x.now.slice(0, 16)}`} tone={x.running ? '#C2553D' : '#3F7D5C'} icon={<BrainCircuit className="size-4" />} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card title="Model versions" sub="Every retrain is a challenger. It replaces the champion only if it captures at least as much gross profit">
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={hist} margin={{ left: -10, right: 10, top: 10 }}>
                <CartesianGrid stroke={CHART.grid} vertical={false} />
                <XAxis dataKey="v" tick={{ fontSize: 11, fill: CHART.axis }} />
                <YAxis domain={[0.6, 0.9]} tick={{ fontSize: 11, fill: CHART.axis }} />
                <Tooltip formatter={(v: any) => Number(v).toFixed(4)} />
                <Line dataKey="auc" name="AUC" stroke="#3E5C76" strokeWidth={2.5} dot={{ r: 4 }} isAnimationActive={false} />
                <Line dataKey="gp5" name="GP capture@5" stroke="#A16207" strokeWidth={2.5} dot={{ r: 4 }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-2 divide-y divide-ink/5 text-sm">
            {[...x.history].reverse().map((h: any) => (
              <li key={h.version} className="flex items-center justify-between gap-3 py-2">
                <span className="flex items-center gap-2"><b className="num">v{h.version}</b><span className="text-xs text-ink-soft">{h.reason}</span></span>
                <span className="flex items-center gap-3 text-xs"><span className="num">AUC {h.auc}</span><span className="num">GP@5 {pct(h.gp5, 1)}</span>
                  <span className={`rounded-full px-2 py-0.5 font-medium ${h.promoted ? 'bg-spec-svc/10 text-spec-svc' : 'bg-danger/10 text-danger'}`}>{h.promoted ? 'promoted' : 'rejected'}</span></span>
              </li>
            ))}
          </ul>
        </Card>
        <div className="space-y-4">
          <Card title="Feedback priors" sub="Beta(2,2)-smoothed usefulness per category multiplies live probabilities">
            {cats.length === 0 ? <p className="text-sm text-ink-soft">No ratings yet. Use 👍 / 👎 on any opportunity in the inbox.</p> : (
              <ul className="space-y-2 text-sm">
                {cats.map(([c, v]: any) => (
                  <li key={c} className="flex items-center justify-between gap-2">
                    <span className="truncate">{titleCase(c)}</span>
                    <span className="flex items-center gap-2 text-xs"><ThumbsUp className="size-3 text-spec-svc" />{v.useful}<ThumbsDown className="size-3 text-danger" />{v.not}
                      <b className={`num w-12 text-right ${v.mult < 1 ? 'text-danger' : 'text-spec-svc'}`}>×{v.mult}</b></span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="What the last action changed">
            {!last ? <p className="text-sm text-ink-soft">Simulate orders or retrain to see opportunities move.</p> : (
              <>
                {last.ingested != null && <p className="mb-2 text-sm">{last.ingested} orders · {last.attribution?.matched} won by attribution ({inr(last.attribution?.value)}){last.retrain_queued && ' · retrain queued'}</p>}
                {last.version && <p className="mb-2 text-sm">v{last.version}: GP@5 {pct(last.challenger_gp5, 1)} vs champion {pct(last.champion_gp5, 1)} in {last.seconds}s</p>}
                <ul className="space-y-1.5 text-xs">
                  {moves.map((m: any) => (
                    <li key={m.id} className="flex items-center justify-between gap-2"><span className="truncate">{m.title}</span>
                      <span className="num shrink-0">{pct(m.from)} → <b className={m.to > m.from ? 'text-spec-svc' : 'text-danger'}>{pct(m.to)}</b></span></li>
                  ))}
                </ul>
              </>
            )}
          </Card>
        </div>
      </div>
      <Reasoning
        how="Online: each order batch rebuilds the whitespace snapshot. Filled gaps vanish, co-purchase lift updates, and open opportunities are re-scored by how far their pair probabilities moved. Retrain: a calibrated gradient-boosted challenger is trained on all history up to the clock with the same time-split back-test, and is promoted only if GP capture@5 ≥ champion − 0.5 pt. Nightly at 02:00 and automatically after 25 new orders."
        why="A static model decays as partners buy and markets shift. Here every order and every rep rating changes tomorrow's inbox, and a worse model cannot ship." />
      <p className="mt-2 text-xs text-ink-soft">CSV columns: account_id, sku or category, qty, amount (optional), tx_date (optional, ISO).</p>
    </Page>
  )
}
