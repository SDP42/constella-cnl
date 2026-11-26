import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Copy, Hourglass, Languages, Link2, Mail, MessageCircle, Scale, ThumbsDown, ThumbsUp, Users } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { inr, pct } from '@/lib/format'
import { DivDot, KindPill, StatusPill } from './kit'
import { DIV_COLORS_MAP } from './theme'

const NEXT: Record<string, { action: string; label: string }[]> = {
  assigned: [{ action: 'accept', label: 'Accept' }, { action: 'decline', label: 'Decline' }],
  new: [{ action: 'accept', label: 'Accept' }],
  accepted: [{ action: 'contact', label: 'Log contact' }, { action: 'proposal', label: 'Send proposal' }],
  contacted: [{ action: 'proposal', label: 'Send proposal' }],
  proposal: [{ action: 'negotiate', label: 'Negotiating' }, { action: 'win', label: 'Mark won' }, { action: 'lose', label: 'Mark lost' }],
  negotiation: [{ action: 'win', label: 'Mark won' }, { action: 'lose', label: 'Mark lost' }],
}

export function OpportunityDrawer({ id, onClose }: { id: number | null; onClose: () => void }) {
  const qc = useQueryClient()
  const user = useAuth((s) => s.user)
  const q = useQuery({ queryKey: ['opp', id], queryFn: () => api(`/api/opportunities/${id}`), enabled: !!id })
  const shape = useQuery({ queryKey: ['shape', id], queryFn: () => api(`/api/opportunities/${id}/shape`), enabled: !!id })
  const [tab, setTab] = useState<'whatsapp' | 'email'>('whatsapp')
  const [lang, setLang] = useState('en')
  const localPitch = useQuery({ queryKey: ['pitch', id, lang], queryFn: () => api(`/api/opportunities/${id}/pitch?lang=${lang}`), enabled: !!id && lang !== 'en' })
  const fb = useMutation({
    mutationFn: (useful: boolean) => api(`/api/opportunities/${id}/feedback`, { method: 'POST', json: { useful, reason: useful ? null : 'Not relevant for this partner' } }),
    onSuccess: (_, useful) => { toast.success(useful ? 'Thanks — this trains the model' : 'Noted — the model will learn from it'); qc.invalidateQueries({ queryKey: ['opp', id] }) },
  })
  const share = useMutation({
    mutationFn: () => api(`/api/proposals/${id}/share`, { method: 'POST' }),
    onSuccess: (r) => { const url = `${location.origin}${r.path}`; navigator.clipboard?.writeText(url); toast.success('Partner proposal link copied (valid 14 days)'); window.open(url, '_blank') },
  })
  const act = useMutation({
    mutationFn: (action: string) => api(`/api/opportunities/${id}/action`, { method: 'POST', json: { action, note: action === 'lose' ? 'Lost on price' : undefined } }),
    onSuccess: (_, action) => { toast.success(`Done: ${action}`); qc.invalidateQueries() },
    onError: (e: any) => toast.error(e.message),
  })
  const o = q.data
  const pitch = lang !== 'en' && tab === 'whatsapp' ? localPitch.data?.text : o?.explanation?.pitch?.[tab]

  return (
    <Sheet open={!!id} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full overflow-y-auto border-l border-white/70 bg-pearl/95 p-0 backdrop-blur-xl sm:max-w-xl">
        {!o ? <div className="p-6 text-sm text-ink-soft">Loading…</div> : (
          <div>
            <SheetHeader className="border-b border-ink/5 px-6 py-5">
              <div className="flex flex-wrap items-center gap-2"><KindPill kind={o.kind} /><StatusPill status={o.status} />
                {o.escalation_level > 0 && <span className="rounded-full bg-warn/10 px-2 py-0.5 text-[11px] font-medium text-warn">L{o.escalation_level} · {o.escalation_label}</span>}
              </div>
              <SheetTitle className="mt-2 text-xl leading-snug">{o.title}</SheetTitle>
              <SheetDescription asChild>
                <Link to={`/app/accounts/${o.account.id}`} className="text-sm text-spec-eb hover:underline">{o.account.name} · {o.account.city} →</Link>
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-5 px-6 py-5">
              <div className="grid grid-cols-3 gap-2">
                {[['Value', inr(o.est_value)], ['Win prob.', pct(o.probability)], ['Annuity / yr', inr(o.est_annuity)]].map(([k, v]) => (
                  <div key={k} className="pane !rounded-xl p-3"><p className="label">{k}</p><p className="num mt-1 text-lg font-semibold">{v}</p></div>
                ))}
              </div>

              <div className="pane !rounded-xl flex items-center gap-3 p-3">
                <Hourglass className="size-5 text-warn" />
                <div className="text-sm">
                  <b className="num">{inr(o.cost_of_delay.per_day)}/day</b> of value-at-stake decays while this sits idle
                  <div className="text-xs text-ink-soft">Half-life {o.cost_of_delay.half_life_days} days · {o.cost_of_delay.decayed_pct}% already decayed</div>
                </div>
              </div>

              <div>
                <p className="label mb-2">Why now</p>
                <ul className="space-y-1.5">
                  {o.why.map((w: string, i: number) => <li key={i} className="flex gap-2 text-sm"><span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-spec-eb" />{w}</li>)}
                </ul>
                {!!o.explanation?.reason_codes?.length && (
                  <div className="mt-3 space-y-1.5">
                    {o.explanation.reason_codes.map((r: any) => (
                      <div key={r.feature} className="flex items-center gap-2 text-xs">
                        <span className="w-40 shrink-0 text-ink-soft">{r.label}</span>
                        <div className="relative h-2 flex-1 rounded-full bg-ink/5">
                          <div className="absolute top-0 h-2 rounded-full" style={{ left: r.contribution < 0 ? `${50 + r.contribution * 400}%` : '50%', width: `${Math.min(50, Math.abs(r.contribution) * 400)}%`, background: r.contribution > 0 ? '#3f7d5c' : '#b42318' }} />
                          <div className="absolute left-1/2 top-[-2px] h-3 w-px bg-ink/20" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {o.explanation?.missing && (
                <div>
                  <p className="label mb-2">Solution — missing components</p>
                  <div className="grid gap-1.5">
                    {o.explanation.missing.map((m: any) => (
                      <div key={m.category} className="flex items-center justify-between rounded-xl bg-white/70 px-3 py-2 text-sm">
                        <span>{m.role}{m.required && <span className="ml-1 text-[10px] text-ink-soft">required</span>}</span>
                        <span className="num text-xs text-ink-soft">p={m.p}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="label mb-2 flex items-center gap-1.5"><Users className="size-3.5" /> Ownership</p>
                <div className="flex flex-wrap gap-2 text-sm">
                  {o.lead_rep && <span className="rounded-full bg-[#1c1917] px-3 py-1 text-white">Lead · {o.lead_rep.name} ({o.lead_division})</span>}
                  {o.assists.map((a: any) => <span key={a.rep_id} className="rounded-full bg-white px-3 py-1">{a.role} · {a.name} · {Math.round((a.credit ?? 0) * 100)}%</span>)}
                </div>
                {o.explanation?.routing && <p className="mt-2 text-xs text-ink-soft">{o.explanation.routing.division_rule} · {o.explanation.routing.rep_rule}</p>}
              </div>

              {shape.data && (
                <div>
                  <p className="label mb-2 flex items-center gap-1.5"><Scale className="size-3.5" /> Deal shaping · credit headroom {inr(shape.data.credit_headroom)}</p>
                  <div className="grid grid-cols-3 gap-2">
                    {shape.data.options.map((op: any) => (
                      <div key={op.id} className={`rounded-xl border p-3 text-xs ${shape.data.recommended === op.id ? 'border-spec-svc bg-spec-svc/5' : 'border-ink/10 bg-white/60'}`}>
                        <div className="flex items-center justify-between font-medium">{op.name}{shape.data.recommended === op.id && <Check className="size-3.5 text-spec-svc" />}</div>
                        <div className="num mt-1.5">{op.monthly_fee ? `${inr(op.monthly_fee)}/mo` : inr(op.upfront_value)}</div>
                        <div className="mt-1 text-ink-soft">ARR {inr(op.annual_recurring)} · {op.cash_cycle_days}d cycle</div>
                        <div className={`mt-1 ${op.fits_credit ? 'text-spec-svc' : 'text-danger'}`}>{op.fits_credit ? 'fits credit' : 'blocked by credit'}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {pitch && (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="label">Drafted outreach</p>
                    <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1 text-xs text-ink-soft"><Languages className="size-3.5" />
                      <select aria-label="Pitch language" value={lang} onChange={(e) => { setLang(e.target.value); setTab('whatsapp') }} className="rounded-full bg-ink/5 px-2 py-1 text-xs">
                        {[['en', 'English'], ['hi', 'हिन्दी'], ['mr', 'मराठी'], ['gu', 'ગુજરાતી'], ['ta', 'தமிழ்']].map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                      </select>
                    </label>
                    <div className="flex gap-1 rounded-full bg-ink/5 p-0.5 text-xs">
                      <button onClick={() => setTab('whatsapp')} className={`flex items-center gap-1 rounded-full px-2.5 py-1 ${tab === 'whatsapp' ? 'bg-white shadow-sm' : ''}`}><MessageCircle className="size-3" />WhatsApp</button>
                      <button onClick={() => setTab('email')} className={`flex items-center gap-1 rounded-full px-2.5 py-1 ${tab === 'email' ? 'bg-white shadow-sm' : ''}`}><Mail className="size-3" />Email</button>
                    </div>
                    </div>
                  </div>
                  <div className="relative whitespace-pre-wrap rounded-xl bg-white/80 p-3 text-sm">
                    {pitch}
                    <button onClick={() => { navigator.clipboard.writeText(pitch); toast.success('Copied') }} aria-label="Copy pitch" className="absolute right-2 top-2 rounded-lg p-1.5 hover:bg-ink/5"><Copy className="size-3.5" /></button>
                  </div>
                </div>
              )}

              {user?.role !== 'partner' && NEXT[o.status] && (
                <div className="flex flex-wrap gap-2">
                  {NEXT[o.status].map((n, i) => (
                    <button key={n.action} onClick={() => act.mutate(n.action)} disabled={act.isPending}
                      className={`rounded-full px-4 py-2 text-sm font-medium transition-transform hover:scale-[1.03] disabled:opacity-50 ${i === 0 ? 'bg-[#1c1917] text-white' : 'bg-white'}`}>{n.label}</button>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 rounded-xl bg-ink/[0.03] p-3 text-xs">
                <span className="mr-auto text-ink-soft">Was this recommendation useful?</span>
                <button onClick={() => fb.mutate(true)} className="flex items-center gap-1 rounded-full bg-white px-3 py-1.5 hover:bg-spec-svc/10"><ThumbsUp className="size-3.5" />Useful</button>
                <button onClick={() => fb.mutate(false)} className="flex items-center gap-1 rounded-full bg-white px-3 py-1.5 hover:bg-danger/10"><ThumbsDown className="size-3.5" />Not relevant</button>
                {user?.role !== 'partner' && <button onClick={() => share.mutate()} className="flex items-center gap-1 rounded-full bg-ink px-3 py-1.5 text-white"><Link2 className="size-3.5" />Share proposal link</button>}
              </div>

              <div>
                <p className="label mb-2">Audit trail</p>
                <ol className="relative space-y-3 border-l border-ink/10 pl-4">
                  {o.events.map((e: any) => (
                    <li key={e.id} className="relative text-sm">
                      <span className="absolute -left-[21px] top-1.5 size-2.5 rounded-full border-2 border-white" style={{ background: e.kind === 'won' ? '#3f7d5c' : e.kind.includes('escal') ? '#b45309' : DIV_COLORS_MAP[o.lead_division] ?? '#3e5c76' }} />
                      <div>{e.detail}</div>
                      <div className="text-xs text-ink-soft">{new Date(e.ts).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })} · {e.actor}</div>
                    </li>
                  ))}
                </ol>
              </div>
              <div className="flex flex-wrap gap-2">{o.divisions.map((d: string) => <DivDot key={d} div={d} label />)}</div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
