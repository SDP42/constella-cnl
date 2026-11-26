import { pct } from '@/lib/format'
import { Card, DivDot, Loading, Page, Stat, useApi } from '../kit'

export default function DataUnifier() {
  const d = useApi<any>(['unify'], '/api/data/unification')
  const x = d.data
  if (!x) return <Page title="Data unifier"><Loading rows={6} /></Page>
  const r = x.report
  return (
    <Page kicker="Model the data · collect, clean, unify" title="Data unifier">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Raw division records" value={r.records} tone="#3e5c76" />
        <Stat label="Golden partners" value={r.golden_accounts} sub={`${r.duplicates_collapsed} duplicates collapsed`} tone="#a16207" />
        <Stat label="Match precision" value={pct(r.precision, 1)} tone="#3f7d5c" />
        <Stat label="Match recall" value={pct(r.recall, 1)} tone="#6b4e71" />
        <Stat label="Missing GSTIN" value={pct(x.quality.missing_gstin_pct)} sub="resolved by fuzzy match" tone="#c2553d" />
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1.4fr]">
        <div className="space-y-4">
          <Card title="Matching rules" sub="GSTIN exact → PAN → fuzzy name in the same city">
            <ul className="space-y-2">
              {Object.entries(r.by_rule).map(([k, v]: any) => (
                <li key={k} className="flex items-center justify-between text-sm"><span className="capitalize">{k.replace(/_/g, ' ')}</span><span className="num">{v}</span></li>
              ))}
            </ul>
          </Card>
          <Card title="Source systems" sub="Where each division keeps its partner records">
            <ul className="space-y-2">
              {x.systems.map((s: any, i: number) => (
                <li key={i} className="flex items-center justify-between text-sm"><span className="flex items-center gap-2"><DivDot div={s.division} label />{s.system}</span><span className="num">{s.records}</span></li>
              ))}
            </ul>
          </Card>
          <Card title="Steward review queue" sub="Low-confidence matches a human confirms">
            {x.review_queue.length ? (
              <ul className="space-y-2">
                {x.review_queue.map((q: any) => (
                  <li key={q.id} className="rounded-xl bg-white/70 p-3 text-sm">“{q.raw_name}” <span className="text-ink-soft">({q.division}, {q.city})</span><div className="text-xs text-ink-soft">→ {q.candidate ?? 'no candidate'} · {pct(q.confidence)}</div></li>
                ))}
              </ul>
            ) : <p className="text-sm text-ink-soft">Queue empty.</p>}
          </Card>
        </div>
        <Card title="Clusters — one partner, many names" sub="Raw records from different divisions resolved into one golden record">
          <div className="space-y-3">
            {x.sample_clusters.slice(0, 10).map((c: any) => (
              <div key={c.golden.id} className="rounded-2xl bg-white/70 p-3">
                <div className="flex items-center justify-between"><b className="text-sm">{c.golden.name}</b><span className="text-xs text-ink-soft">{c.golden.city} · quality {pct(c.golden.quality)}</span></div>
                <ul className="mt-2 space-y-1">
                  {c.records.map((rr: any, i: number) => (
                    <li key={i} className="flex items-center justify-between gap-2 text-xs">
                      <span className="flex min-w-0 items-center gap-2"><DivDot div={rr.division} /><span className="truncate">“{rr.raw_name}”</span><span className="text-ink-soft">{rr.system}</span></span>
                      <span className="shrink-0 text-ink-soft">{rr.rule.replace(/_/g, ' ')} · {pct(rr.confidence)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </Page>
  )
}
