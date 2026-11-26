import { ArrowLeft, Database, Radio, ShieldCheck } from 'lucide-react'
import { lazy, Suspense, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { inr, pct, titleCase } from '@/lib/format'
import { Bar, Card, DivDot, Loading, Page, Stat, useApi, Reasoning } from '../kit'
import { OppRow } from './Inbox'
import { OpportunityDrawer } from '../OpportunityDrawer'
import { CHART, DIV_COLORS_MAP, DIV_NAME } from '../theme'

const TwinStack = lazy(() => import('@/components/three/TwinStack').then((m) => ({ default: m.TwinStack })))

export default function AccountTwin() {
  const { id } = useParams()
  const d = useApi<any>(['twin', id], `/api/accounts/${id}`)
  const [open, setOpen] = useState<number | null>(null)
  const t = d.data
  if (!t) return <Page title="Loading…"><Loading rows={8} /></Page>
  const a = t.account
  const totalSpend = t.divisions.reduce((s: number, x: any) => s + x.spend, 0) || 1
  const layers = t.divisions.map((dv: any) => {
    const cats = t.categories.filter((c: any) => c.division === dv.code)
    const best = Math.max(0, ...cats.filter((c: any) => !c.owned).map((c: any) => c.probability ?? 0))
    return { code: dv.code, name: dv.name, color: DIV_COLORS_MAP[dv.code], share: dv.spend / totalSpend, owned: dv.spend > 0, p: best }
  })
  const whitespace = t.categories.filter((c: any) => !c.owned && c.probability != null).sort((x: any, y: any) => y.probability - x.probability)

  return (
    <Page kicker={<Link to="/app/accounts" className="flex items-center gap-1 hover:text-ink"><ArrowLeft className="size-3" />Account twins</Link>}
      title={a.name}
      actions={<span className="rounded-full bg-white px-3 py-1.5 text-xs text-ink-soft">{titleCase(a.type)} · {titleCase(a.vertical)} · {a.city} · GSTIN {a.gstin}</span>}>
      <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
        <Card title="The twin" sub="One disc per CNL division · solid = buys today · glass = whitespace (pulses with model probability) · drag to rotate" pad={false}>
          <Suspense fallback={<div className="h-[380px]" />}>
            <TwinStack layers={layers} annuity={layers.find((l: any) => l.code === 'SVC')?.owned ?? false} className="h-[380px]" />
          </Suspense>
          <div className="flex flex-wrap gap-3 border-t border-ink/5 px-5 py-3">
            {layers.map((l: any) => (
              <span key={l.code} className="flex items-center gap-1.5 text-xs">
                <span className="size-2.5 rounded-full" style={{ background: l.owned ? l.color : 'transparent', border: `2px solid ${l.color}` }} />
                {l.name} <span className="num text-ink-soft">{l.owned ? pct(l.share) : 'none'}</span>
              </span>
            ))}
          </div>
        </Card>
        <div className="grid content-start gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Stat label="12m spend with CNL" value={inr(a.spend_12m)} tone="#3e5c76" />
            <Stat label="Wallet share" value={pct(a.wallet_share)} sub={`of ~${inr(a.est_annual_tech_spend)} est. tech spend`} tone="#c99a2e" />
            <Stat label="Leakage" value={inr(t.leakage)} sub="spend going to other distributors (est.)" tone="#c2553d" />
            <Stat label="Credit headroom" value={inr(a.credit_headroom)} sub={`${a.avg_payment_days} avg payment days`} tone="#3f7d5c" />
          </div>
          <Card title="Whitespace" sub="What this partner is likely to buy next (gradient-boosted propensity, 120-day horizon)">
            <Reasoning how="Probability that the partner places a first order in the category within 120 days, from the gradient-boosted model. 'Peers' = share of partners with the same type and industry who already buy it." why="Wallet share grows fastest where the partner already behaves like peers who buy more — that is the safest cross-sell conversation." />
            <div className="space-y-2">
              {whitespace.slice(0, 7).map((c: any) => (
                <div key={c.category} className="grid grid-cols-[1fr_120px_42px] items-center gap-3 text-sm">
                  <span className="flex items-center gap-2 truncate"><DivDot div={c.division} />{c.label}
                    {c.peer_adoption != null && <span className="text-[11px] text-ink-soft">peers {pct(c.peer_adoption)}</span>}</span>
                  <Bar value={c.probability} max={0.6} color={DIV_COLORS_MAP[c.division]} />
                  <span className="num text-right text-xs">{pct(c.probability)}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card title="Spend by division over time" sub="The silos, made visible" className="xl:col-span-2">
          <div className="h-60">
            <ResponsiveContainer>
              <AreaChart data={t.timeline}>
                <CartesianGrid stroke={CHART.grid} vertical={false} />
                <XAxis dataKey="month" tick={{ fill: CHART.axis, fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={30} />
                <YAxis tickFormatter={(v) => inr(v, 0)} tick={{ fill: CHART.axis, fontSize: 11 }} axisLine={false} tickLine={false} width={60} />
                <Tooltip formatter={(v: any, k: any) => [inr(v), DIV_NAME[k] ?? k]} />
                {['EB', 'HON', 'FMSG', 'FMCT', 'SVC'].map((k) => (
                  <Area isAnimationActive={false} key={k} type="monotone" dataKey={k} stackId="1" stroke={DIV_COLORS_MAP[k]} fill={DIV_COLORS_MAP[k]} fillOpacity={0.55} />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Solution coverage" sub="Core components owned per solution template">
          <div className="space-y-3">
            {t.solutions.filter((s: any) => s.fit).slice(0, 5).map((s: any) => (
              <div key={s.id}>
                <div className="mb-1 flex justify-between text-sm"><span>{s.name}</span><span className="num text-xs text-ink-soft">{pct(s.coverage)}</span></div>
                <div className="flex gap-1">
                  {s.components.map((c: any) => (
                    <span key={c.category} title={`${c.label}${c.owned ? ' — owned' : ` — ${pct(c.p)} likely`}`}
                      className="h-2 flex-1 rounded-full" style={{ background: c.owned ? DIV_COLORS_MAP[c.division] : `${DIV_COLORS_MAP[c.division]}30` }} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <Card title="Opportunities on this partner" pad={false}>
          <div className="px-2 pb-2">{t.opportunities.length ? t.opportunities.map((o: any) => <OppRow key={o.id} o={o} onOpen={setOpen} />) : <p className="p-4 text-sm text-ink-soft">None open — this partner may be in the pilot control group.</p>}</div>
        </Card>
        <div className="space-y-4">
          <Card title={<span className="flex items-center gap-2"><Database className="size-4" />Golden-record lineage</span>} sub="How each division's raw record was stitched in">
            <ul className="space-y-2 text-sm">
              {t.lineage.map((l: any, i: number) => (
                <li key={i} className="flex items-center justify-between gap-2">
                  <span className="min-w-0"><DivDot div={l.division} /> <span className="truncate">“{l.raw_name}”</span><span className="block text-[11px] text-ink-soft">{l.system} · GSTIN {l.raw_gstin ?? 'missing'}</span></span>
                  <span className="shrink-0 rounded-full bg-ink/5 px-2 py-0.5 text-[11px]">{l.rule?.replace('_', ' ')} · {pct(l.confidence)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 flex items-center gap-1.5 text-[11px] text-ink-soft"><ShieldCheck className="size-3.5" />PII masked for your role</p>
          </Card>
          <Card title={<span className="flex items-center gap-2"><Radio className="size-4" />Signals & conversations</span>}>
            <ul className="max-h-72 space-y-2.5 overflow-y-auto pr-1 text-sm">
              {t.signals.slice(0, 10).map((s: any) => (
                <li key={s.id}><span className="mr-1.5 rounded-full bg-ink/5 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-ink-soft">{s.kind.replace('_', ' ')}</span>{s.title}</li>
              ))}
              {t.interactions.slice(0, 5).map((n: any) => (
                <li key={`n${n.id}`} className="text-ink-soft"><span className="mr-1.5 rounded-full bg-gold/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-gold">{n.channel}</span>{n.note}</li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
      <OpportunityDrawer id={open} onClose={() => setOpen(null)} />
    </Page>
  )
}
