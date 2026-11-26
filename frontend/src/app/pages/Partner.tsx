import { Lock } from 'lucide-react'
import { inr, pct } from '@/lib/format'
import { Card, KindPill, Loading, Page, Stat, useApi } from '../kit'

/** Vikram's view: one CNL face, every proposal in one place, only his own data. */
export default function Partner() {
  const d = useApi<any>(['partner-twin'], '/api/accounts/1')
  const t = d.data
  if (!t) return <Page title="Your proposals"><Loading rows={5} /></Page>
  return (
    <Page kicker="TechNova Systems × Creative Newtech" title="Your proposals">
      <div className="mb-4 flex items-center gap-2 rounded-2xl bg-ink/[0.03] px-4 py-3 text-sm text-ink-soft">
        <Lock className="size-4" /> You are signed in as a partner — you can only see TechNova’s own account and proposals.
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Bought from CNL (12m)" value={inr(t.account.spend_12m)} tone="#3e5c76" />
        <Stat label="Credit available" value={inr(t.account.credit_headroom)} tone="#3f7d5c" />
        <Stat label="Open proposals" value={t.opportunities.filter((o: any) => !['won', 'lost'].includes(o.status)).length} tone="#a16207" />
        <Stat label="Your CNL contact" value={<span className="text-lg">{t.owner?.name ?? '—'}</span>} sub="one point of contact for every division" tone="#6b4e71" />
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {t.opportunities.map((o: any) => (
          <Card key={o.id}>
            <KindPill kind={o.kind} />
            <div className="mt-2 text-lg font-semibold leading-snug">{o.title.replace(` for ${t.account.name}`, '').replace(` — ${t.account.name}`, '')}</div>
            <ul className="mt-2 space-y-1 text-sm text-ink-soft">{o.why.slice(0, 3).map((w: string, i: number) => <li key={i}>• {w}</li>)}</ul>
            <div className="mt-4 flex items-end justify-between">
              <div><div className="num text-xl font-semibold">{inr(o.est_value)}</div>{o.est_annuity > 0 && <div className="text-xs text-spec-svc">+ {inr(o.est_annuity)}/yr service plan</div>}</div>
              <span className="text-xs text-ink-soft">{o.fits_credit ? 'Fits your credit line' : 'Ask about monthly plans'} · {pct(o.probability)} match</span>
            </div>
          </Card>
        ))}
      </div>
    </Page>
  )
}
