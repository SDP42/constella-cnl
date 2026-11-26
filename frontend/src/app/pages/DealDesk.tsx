import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Gavel, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Slider } from '@/components/ui/slider'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { inr, pct } from '@/lib/format'
import { Card, Empty, Loading, Page, Reasoning, useApi } from '../kit'

const TONE: Record<string, string> = { auto_approved: '#3f7d5c', approved: '#3f7d5c', pending: '#b45309', rejected: '#b42318' }

function Waterfall({ w }: { w: any }) {
  // floating-bar waterfall drawn with plain elements: each step starts where the previous one ended
  let run = 0
  const rows = w.steps.map((st: any) => {
    const from = run
    run += st.value
    return { label: st.step, from, to: run, value: st.value }
  })
  rows.push({ label: 'Pocket margin', from: 0, to: w.pocket_margin, value: w.pocket_margin, total: true })
  const max = Math.max(...rows.map((r: any) => Math.max(r.from, r.to)), 1)
  return (
    <div className="flex h-56 items-end gap-2 rounded-xl bg-ink/[0.02] p-3">
      {rows.map((r: any) => {
        const lo = Math.min(r.from, r.to)
        const hi = Math.max(r.from, r.to)
        return (
          <div key={r.label} className="flex h-full flex-1 flex-col items-center justify-end">
            <div className="relative w-full flex-1">
              <div className="absolute inset-x-1 rounded-md transition-all duration-500"
                style={{ bottom: `${(lo / max) * 100}%`, height: `${Math.max(1.5, ((hi - lo) / max) * 100)}%`,
                  background: r.total ? '#1c1917' : r.value >= 0 ? '#3f7d5c' : '#c2553d' }}
                title={`${r.label}: ${inr(r.value)}`} />
            </div>
            <div className={`num mt-1 text-[11px] ${r.value < 0 ? 'text-danger' : ''}`}>{r.value < 0 ? '−' : ''}{inr(Math.abs(r.value), 1)}</div>
            <div className="mt-0.5 h-7 text-center text-[10px] leading-tight text-ink-soft">{r.label}</div>
          </div>
        )
      })}
    </div>
  )
}

export default function DealDesk() {
  const user = useAuth((s) => s.user)!
  const qc = useQueryClient()
  const inbox = useApi<any>(['inbox-dd', user.rep_id], user.rep_id ? `/api/reps/${user.rep_id}/inbox` : '/api/opportunities?open_only=true&limit=40')
  const opps = user.rep_id ? inbox.data?.lead ?? [] : inbox.data?.items ?? []
  const [oid, setOid] = useState<number | null>(null)
  const [disc, setDisc] = useState(4)
  const [reason, setReason] = useState('Matching a competing distributor quote')
  const sel = oid ?? opps[0]?.id
  const prev = useApi<any>(['dd-prev', sel, disc], sel ? `/api/dealdesk/preview?opportunity_id=${sel}&discount_pct=${disc / 100}` : null, { placeholderData: (p: any) => p })
  const list = useApi<any[]>(['dd-list'], '/api/dealdesk/requests', { refetchInterval: 15_000 })
  const submit = useMutation({
    mutationFn: () => api('/api/dealdesk/requests', { method: 'POST', json: { opportunity_id: sel, discount_pct: disc / 100, reason } }),
    onSuccess: (r) => { toast.success(r.status === 'auto_approved' ? 'Auto-approved by policy' : `Sent for ${r.approver_role.toUpperCase()} approval`); qc.invalidateQueries({ queryKey: ['dd-list'] }) },
    onError: (e: any) => toast.error(e.message),
  })
  const decide = useMutation({
    mutationFn: ({ id, d }: { id: number; d: string }) => api(`/api/dealdesk/requests/${id}/${d}`, { method: 'POST' }),
    onSuccess: () => { toast.success('Decision recorded in the audit trail'); qc.invalidateQueries({ queryKey: ['dd-list'] }) },
    onError: (e: any) => toast.error(e.message),
  })
  const p = prev.data
  return (
    <Page kicker="Pricing, margin & approvals" title="Deal desk">
      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <Card title="Price a deal" sub="See what a discount really costs before you offer it">
          {!opps.length ? <Loading /> : (
            <div className="space-y-4">
              <label className="block text-sm"><span className="label">Opportunity</span>
                <select value={sel} onChange={(e) => setOid(Number(e.target.value))} className="mt-1 h-10 w-full rounded-xl border border-ink/10 bg-white px-3 text-sm">
                  {opps.slice(0, 40).map((o: any) => <option key={o.id} value={o.id}>{o.title} · {inr(o.est_value)}</option>)}
                </select>
              </label>
              <div><div className="mb-2 flex justify-between text-sm"><span>Discount requested</span><span className="num font-medium">{disc}%</span></div>
                <Slider value={[disc]} min={0} max={15} step={0.5} onValueChange={(v) => setDisc(v[0])} aria-label="Discount" /></div>
              {p && (
                <>
                  <Waterfall w={p.waterfall} />
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <span className="rounded-full bg-ink/5 px-3 py-1">Pocket margin <b className="num">{inr(p.waterfall.pocket_margin)}</b> ({pct(p.waterfall.pocket_pct, 1)})</span>
                    <span className={`rounded-full px-3 py-1 ${p.auto_approve ? 'bg-spec-svc/10 text-spec-svc' : 'bg-warn/10 text-warn'}`}>
                      {p.auto_approve ? 'Within rep authority — auto-approves' : `Needs ${p.approver_role.toUpperCase()} approval`}
                    </span>
                  </div>
                  <label className="block text-sm"><span className="label">Reason</span>
                    <input value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1 h-10 w-full rounded-xl border border-ink/10 bg-white px-3 text-sm" /></label>
                  {user.role !== 'partner' && (
                    <button onClick={() => submit.mutate()} className="flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white"><Gavel className="size-4" />Submit to deal desk</button>
                  )}
                </>
              )}
              <Reasoning how="Pocket margin = list gross margin − discount + brand-scheme rebate − freight (1.2%) − cost of credit (12% p.a. × the partner's payment days). Approval matrix: ≤3% rep, ≤6% sales head, above that or pocket margin < 2.5% → CFO."
                why="On a 3–5% EBITDA business, an unchecked 5% discount can wipe out the whole deal's profit. The waterfall makes the trade-off visible before the quote goes out, and every decision is audited." />
            </div>
          )}
        </Card>
        <Card title="Requests" sub={user.role === 'head' ? 'Approve or reject — decisions land in the opportunity’s audit trail' : 'Your requests and their status'}>
          {!list.data ? <Loading /> : list.data.length ? (
            <ul className="space-y-2">
              {list.data.map((r) => (
                <li key={r.id} className="rounded-xl bg-white/70 p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0"><div className="truncate font-medium">{r.title}</div><div className="text-xs text-ink-soft">{r.account} · by {r.requested_by} · “{r.reason}”</div></div>
                    <span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium capitalize text-white" style={{ background: TONE[r.status] }}>{r.status.replace('_', ' ')}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="num">{pct(r.discount_pct, 1)} off {inr(r.value)} · pocket {pct(r.waterfall.pocket_pct, 1)} · needs {r.approver_role}</span>
                    {r.status === 'pending' && user.role === 'head' && (
                      <span className="flex gap-1">
                        <button onClick={() => decide.mutate({ id: r.id, d: 'approve' })} aria-label="Approve" className="grid size-7 place-items-center rounded-full bg-spec-svc text-white"><Check className="size-3.5" /></button>
                        <button onClick={() => decide.mutate({ id: r.id, d: 'reject' })} aria-label="Reject" className="grid size-7 place-items-center rounded-full bg-danger text-white"><X className="size-3.5" /></button>
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : <Empty>No requests yet — price a deal on the left.</Empty>}
        </Card>
      </div>
    </Page>
  )
}
