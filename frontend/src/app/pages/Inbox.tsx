import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, BadgePercent, CalendarClock, CheckCircle2, Flame, Mic, Rocket, Sparkles, TrendingDown } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import CountUp from '@/components/reactbits/CountUp'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { inr, pct } from '@/lib/format'
import { Card, Empty, HScroll, KindPill, Loading, Page, Reasoning, Stat, StatusPill, useApi } from '../kit'
import { OpportunityDrawer } from '../OpportunityDrawer'

export function OppRow({ o, onOpen }: { o: any; onOpen: (id: number) => void }) {
  return (
    <button onClick={() => onOpen(o.id)} className="group grid w-full grid-cols-12 items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors hover:bg-white">
      <div className="col-span-12 min-w-0 md:col-span-6">
        <div className="flex items-center gap-2"><KindPill kind={o.kind} />{o.sla_breached && <span className="flex items-center gap-1 text-[11px] font-medium text-danger"><AlertTriangle className="size-3" />SLA</span>}</div>
        <div className="mt-1 truncate font-medium">{o.title}</div>
        <div className="truncate text-xs text-ink-soft">{o.why?.[0]}</div>
      </div>
      <div className="col-span-3 md:col-span-2"><div className="num font-semibold">{inr(o.est_value)}</div><div className="text-[11px] text-ink-soft">p {pct(o.probability)}</div></div>
      <div className="col-span-3 md:col-span-2"><div className="num text-sm text-warn">{inr(o.cost_of_delay.per_day)}/d</div><div className="text-[11px] text-ink-soft">cost of delay</div></div>
      <div className="col-span-6 flex items-center justify-end gap-2 md:col-span-2"><StatusPill status={o.status} /></div>
    </button>
  )
}

function Capture() {
  const qc = useQueryClient()
  const accounts = useApi(['acc-mini'], '/api/accounts?limit=200&sort=whitespace')
  const [aid, setAid] = useState<number | ''>('')
  const [text, setText] = useState('Vikram says the Pune school tender for 40 classrooms closes next month — Redington also quoted.')
  const m = useMutation({
    mutationFn: () => api('/api/capture', { method: 'POST', json: { account_id: Number(aid), text } }),
    onSuccess: (r) => {
      toast.success(r.merged_into ? `Merged into “${r.merged_into.title}” — no duplicate created` : r.opportunity ? `New opportunity routed to ${r.opportunity.lead_rep?.name}` : 'Signal logged')
      qc.invalidateQueries()
    },
    onError: (e: any) => toast.error(e.message),
  })
  const res = m.data
  return (
    <Card title={<span className="flex items-center gap-2"><Mic className="size-4" />Whisper capture</span>} sub="Paste a WhatsApp line or call note — intent, quantity, timing and competitor are extracted and routed.">
      <div className="space-y-2">
        <label className="sr-only" htmlFor="cap-acc">Partner</label>
        <select id="cap-acc" value={aid} onChange={(e) => setAid(Number(e.target.value))} className="h-10 w-full rounded-xl border border-ink/10 bg-white px-3 text-sm">
          <option value="">Choose partner…</option>
          {accounts.data?.items.map((a: any) => <option key={a.id} value={a.id}>{a.name} · {a.city}</option>)}
        </select>
        <label className="sr-only" htmlFor="cap-text">Note</label>
        <textarea id="cap-text" value={text} onChange={(e) => setText(e.target.value)} rows={3} className="w-full rounded-xl border border-ink/10 bg-white p-3 text-sm" />
        <button disabled={!aid || m.isPending} onClick={() => m.mutate()} className="rounded-full bg-[#1c1917] px-4 py-2 text-sm font-medium text-white disabled:opacity-40">
          {m.isPending ? 'Extracting…' : 'Capture & route'}
        </button>
        {res && (
          <div className="mt-2 grid gap-1.5 rounded-xl bg-white/80 p-3 text-xs">
            <div><b>Categories:</b> {res.parsed.categories.map((c: any) => c.label).join(', ') || '—'}</div>
            <div><b>Quantity:</b> {res.parsed.quantities.map((q: any) => q.span).join(', ') || '—'} · <b>Timing:</b> {res.parsed.timing.replace('_', ' ')} · <b>Competitor:</b> {res.parsed.competitor ?? '—'}</div>
            {res.parsed.solutions[0] && <div><b>Solution pattern:</b> {res.parsed.solutions[0].name} ({Math.round(res.parsed.solutions[0].coverage * 100)}% matched)</div>}
            {res.automations?.length > 0 && <div><b>Automations fired:</b> {res.automations.map((a: any) => a.rule).join(', ')}</div>}
          </div>
        )}
      </div>
    </Card>
  )
}

export default function Inbox() {
  const user = useAuth((s) => s.user)!
  const repId = user.rep_id ?? 1
  const inbox = useApi(['inbox', repId], `/api/reps/${repId}/inbox`)
  const nudges = useApi(['nudges'], '/api/ai/nudges')
  const churn = useApi(['churn'], '/api/predict/churn?limit=6')
  const next = useApi(['next-orders'], '/api/predict/next-orders?limit=6')
  const today = useApi<any>(['today', repId], `/api/reps/${repId}/today`)
  const schemes = useApi<any[]>(['schemes'], '/api/schemes/progress?limit=5')
  const [done, setDone] = useState<Record<number, boolean>>({})
  const qc = useQueryClient()
  const [open, setOpen] = useState<number | null>(null)
  const [filter, setFilter] = useState<string>('all')
  const launch = useMutation({
    mutationFn: (segment_id: string) => api('/api/campaigns/launch', { method: 'POST', json: { segment_id, max_accounts: 15 } }),
    onSuccess: (r) => { toast.success(`Campaign launched — ${r.opportunities_created} opportunities routed, ${r.messages_queued} messages queued`); qc.invalidateQueries() },
    onError: (e: any) => toast.error(e.message),
  })
  const d = inbox.data
  const lead = (d?.lead ?? []).filter((o: any) => filter === 'all' || o.kind === filter || (filter === 'sla' && o.sla_breached))

  return (
    <Page kicker={`Good morning, ${user.name.split(' ')[0]}`} title="Mission inbox">
      {d && (
        <div className="mb-5 grid gap-3 md:grid-cols-[1.4fr_1fr]">
          <div className="relative overflow-hidden rounded-[22px] bg-[#1c1917] p-6 text-white">
            <span aria-hidden className="absolute -right-10 -top-16 size-64 rounded-full bg-[#f5b700] opacity-30 blur-3xl" />
            <span aria-hidden className="absolute -bottom-20 right-24 size-56 rounded-full bg-[#c2553d] opacity-20 blur-3xl" />
            <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-white/60"><Sparkles className="size-3.5" />Today’s brief · AI generated</p>
            <ul className="relative mt-3 space-y-2">
              {d.brief.map((b: string, i: number) => <li key={i} className="text-[15px] leading-relaxed text-white/90">{b}</li>)}
            </ul>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Open (lead)" value={<CountUp to={d.stats.open} />} tone="#3e5c76" />
            <Stat label="Pipeline" value={inr(d.stats.pipeline_value)} tone="#c99a2e" />
            <Stat label="Credit earned" value={inr(d.stats.credit_earned)} sub={`${d.stats.won} won as lead`} tone="#10b981" />
            <Stat label="Idle cost / day" value={inr(d.stats.cost_of_delay_per_day)} sub={`${d.stats.breached} past SLA`} tone="#e8590c" />
          </div>
        </div>
      )}

      <Card title={<span className="flex items-center gap-2"><CheckCircle2 className="size-4" />Today’s 10 actions</span>}
        sub={today.data ? `Ranked across ${today.data.generated}` : 'Building your day…'} className="mb-4">
        {!today.data ? <Loading rows={3} /> : (
          <ol className="grid gap-2 md:grid-cols-2">
            {today.data.actions.map((a: any, i: number) => (
              <li key={i} className={`flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors ${done[i] ? 'bg-spec-svc/5 opacity-60' : 'bg-white/70 hover:bg-white'}`}>
                <button onClick={() => setDone((d) => ({ ...d, [i]: !d[i] }))} aria-label={done[i] ? 'Mark not done' : 'Mark done'}
                  className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border text-[10px] ${done[i] ? 'border-spec-svc bg-spec-svc text-white' : 'border-ink/20'}`}>{done[i] ? '✓' : i + 1}</button>
                <div className="min-w-0 text-sm">
                  <div className={`font-medium ${done[i] ? 'line-through' : ''}`}>
                    <span className="mr-1.5 rounded-full bg-ink/5 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-ink-soft">{a.type}</span>{a.title}
                  </div>
                  <div className="truncate text-xs text-ink-soft">{a.why}</div>
                </div>
                {a.opportunity_id && <button onClick={() => setOpen(a.opportunity_id)} className="ml-auto shrink-0 text-xs text-gold hover:underline">Open</button>}
              </li>
            ))}
          </ol>
        )}
        <Reasoning how="One list built from five sources: open deals ranked by cost of delay, breached SLAs (weighted ×2), reorders the rhythm model says are due, partners the churn model flags above 85%, and partners within reach of a brand-scheme rebate slab. Quotas keep the day balanced."
          why="Reps don't need another dashboard — they need to know who to call first. Headcount stays flat because the ranking, not extra people, decides where effort goes." />
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-4">
          <Card title="AI-suggested campaigns" sub="Segments the models found in your territory — launch one to create routed opportunities and queue outreach.">
            {!nudges.data ? <Loading rows={2} /> : (
              <HScroll>
                {nudges.data.slice(0, 10).map((n: any) => (
                  <div key={n.id} className="flex w-[min(300px,80vw)] shrink-0 flex-col justify-between rounded-2xl border border-ink/5 bg-white/80 p-4">
                    <div className="flex items-center justify-between text-[11px] text-ink-soft">
                      <span className="rounded-full bg-ink/5 px-2 py-0.5 capitalize">{n.kind}</span>
                      <span className="num">{Math.round(n.confidence * 100)}% conf.</span>
                    </div>
                    <div className="mt-2 font-medium leading-snug">{n.title}</div>
                    <p className="mt-1 line-clamp-3 text-xs text-ink-soft">{n.why}</p>
                    <div className="mt-3 flex items-center justify-between">
                      <div className="text-xs"><b className="num">{n.account_count}</b> partners · <b className="num">{inr(n.est_value)}</b></div>
                      <button onClick={() => launch.mutate(n.id)} disabled={launch.isPending} className="flex items-center gap-1 rounded-full bg-[#1c1917] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">
                        <Rocket className="size-3" />Launch
                      </button>
                    </div>
                  </div>
                ))}
              </HScroll>
            )}
          </Card>

          <Card title="Your opportunities" sub="Ranked by value-at-stake (margin × cash velocity × credit fit + annuity)"
            right={
              <div className="flex flex-wrap gap-1 rounded-full bg-ink/5 p-0.5 text-xs">
                {[['all', 'All'], ['solution', 'Solutions'], ['cross_sell', 'Cross-sell'], ['recurring', 'Annuity'], ['sla', 'Past SLA']].map(([k, l]) => (
                  <button key={k} onClick={() => setFilter(k)} className={`rounded-full px-2.5 py-1 ${filter === k ? 'bg-white shadow-sm' : 'text-ink-soft'}`}>{l}</button>
                ))}
              </div>
            } pad={false}>
            <div className="px-2 pb-2">
              {!d ? <div className="p-4"><Loading /></div> : lead.length ? lead.slice(0, 40).map((o: any) => <OppRow key={o.id} o={o} onOpen={setOpen} />) : <div className="p-4"><Empty>Nothing here.</Empty></div>}
            </div>
          </Card>

          {d?.assist?.length > 0 && (
            <Card title="Assisting" sub="Deals where you hold split credit as relationship or component owner" pad={false}>
              <div className="px-2 pb-2">{d.assist.slice(0, 8).map((o: any) => <OppRow key={o.id} o={o} onOpen={setOpen} />)}</div>
            </Card>
          )}
        </div>

        <div className="min-w-0 space-y-4">
          <Capture />
          <Card title={<span className="flex items-center gap-2"><BadgePercent className="size-4" />Scheme slabs within reach</span>} sub="Partners close to the next brand rebate — a reason to call today">
            <ul className="space-y-2.5">
              {schemes.data?.map((x: any, i: number) => (
                <li key={i} className="text-sm">
                  <div className="flex items-center justify-between"><span className="truncate font-medium">{x.name}</span><span className="num shrink-0 text-xs text-gold">{inr(x.gap)} to go</span></div>
                  <div className="text-xs text-ink-soft">{x.scheme} · unlocks {pct(x.next_rebate, 1)} (+{inr(x.rebate_gain)})</div>
                </li>
              ))}
            </ul>
            <Reasoning how="Quarter-to-date turnover per partner per brand compared with that brand's rebate slabs; shown only when the gap is under 60% of the next slab." why="Brand schemes are often left unclaimed. Telling a partner '₹88k more Samsung earns you 2.5% back' is the easiest cross-sell conversation there is." />
          </Card>
          <Card title={<span className="flex items-center gap-2"><CalendarClock className="size-4" />Reorders due</span>} sub="Predicted from each partner’s ordering rhythm">
            <ul className="space-y-2">
              {next.data?.map((n: any) => (
                <li key={n.account_id} className="flex items-center justify-between text-sm">
                  <span className="min-w-0 truncate">{n.name}<span className="block text-xs text-ink-soft">every ~{n.median_gap_days}d · typ. {inr(n.typical_order)}</span></span>
                  <span className={`num shrink-0 rounded-full px-2 py-0.5 text-xs ${n.overdue ? 'bg-danger/10 text-danger' : 'bg-spec-svc/10 text-spec-svc'}`}>{n.overdue ? `${-n.days_to_next}d late` : `in ${n.days_to_next}d`}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card title={<span className="flex items-center gap-2"><TrendingDown className="size-4" />Churn watch</span>} sub={churn.data ? `Logistic model · AUC ${churn.data.model.auc}` : ''}>
            <ul className="space-y-2.5">
              {churn.data?.items.map((c: any) => (
                <li key={c.account_id} className="text-sm">
                  <div className="flex items-center justify-between"><span className="truncate font-medium">{c.name}</span><span className="num flex items-center gap-1 text-xs text-danger"><Flame className="size-3" />{pct(c.risk)}</span></div>
                  <div className="text-xs text-ink-soft">{c.drivers.join(' · ')}</div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
      <OpportunityDrawer id={open} onClose={() => setOpen(null)} />
    </Page>
  )
}
