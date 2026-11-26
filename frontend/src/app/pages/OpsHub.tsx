import { AlertTriangle, Boxes, FileText, Megaphone, PackageCheck, Wrench } from 'lucide-react'
import { Link } from 'react-router-dom'
import { inr, pct } from '@/lib/format'
import { Bar, Card, HScroll, Loading, Page, Reasoning, useApi } from '../kit'
import { DIV_COLORS_MAP } from '../theme'

const STATE_TONE: Record<string, string> = { low: '#b42318', overstock: '#b45309', healthy: '#3f7d5c' }

export default function OpsHub() {
  const d = useApi<any>(['ops'], '/api/ops/overview')
  const x = d.data
  if (!x) return <Page title="Operations hub"><Loading rows={8} /></Page>
  const low = x.inventory.filter((i: any) => i.state === 'low').length
  const over = x.inventory.filter((i: any) => i.state === 'overstock').length
  return (
    <Page kicker="Supply, projects, tenders, service, co-marketing" title="Operations hub">
      <p className="-mt-3 mb-5 rounded-xl bg-ink/[0.03] px-4 py-2 text-xs text-ink-soft">{x.note}</p>

      <Card title={<span className="flex items-center gap-2"><Boxes className="size-4" />Stock-aware selling</span>}
        sub={`${low} categories short, ${over} overstocked — recommendations shift with stock`}>
        <HScroll>
          {x.inventory.map((i: any) => (
            <div key={i.category} className="w-56 shrink-0 rounded-2xl border border-ink/5 bg-white/80 p-4">
              <div className="flex items-center justify-between text-xs"><span className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: DIV_COLORS_MAP[i.division] }} />{i.division}</span>
                <span className="rounded-full px-2 py-0.5 font-medium capitalize text-white" style={{ background: STATE_TONE[i.state] }}>{i.state}</span></div>
              <div className="mt-2 font-medium leading-snug">{i.label}</div>
              <div className="num mt-2 text-2xl font-semibold">{i.days_cover}<span className="text-sm font-normal text-ink-soft"> days cover</span></div>
              <Bar value={Math.min(i.days_cover, 150)} max={150} color={STATE_TONE[i.state]} />
              <p className="mt-2 text-xs text-ink-soft">{i.action}</p>
              {i.push_targets.length > 0 && <p className="mt-1 text-[11px]">Push to: {i.push_targets.map((t: any) => <Link key={t.id} to={`/app/accounts/${t.id}`} className="mr-1 text-gold hover:underline">{t.name}</Link>)}</p>}
            </div>
          ))}
        </HScroll>
        <Reasoning how="Days of cover = units on hand ÷ average daily units sold over the last 90 days. Overstocked categories are pushed to the partners the model rates most likely to buy them; short categories are suppressed from campaigns." why="Recommending what CNL cannot ship burns trust; clearing aged stock frees working capital — CNL's binding constraint." />
      </Card>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <Card title={<span className="flex items-center gap-2"><FileText className="size-4" />GeM & government tenders</span>} sub="Open tenders matched to the system integrators best placed to win them" pad={false}>
          <ul className="divide-y divide-ink/5">
            {x.tenders.map((t: any) => (
              <li key={t.id} className="grid gap-2 px-5 py-3 md:grid-cols-[1fr_auto]">
                <div className="min-w-0">
                  <div className="font-medium">{t.department} <span className="text-xs text-ink-soft">· {t.city}</span></div>
                  <div className="text-xs text-ink-soft">{t.id} · {t.solution} · EMD {inr(t.emd)} · closes {t.closes}</div>
                  <div className="mt-1 flex flex-wrap gap-1.5">{t.partners.map((p: any) => <Link key={p.id} to={`/app/accounts/${p.id}`} className="rounded-full bg-gold/10 px-2 py-0.5 text-[11px] text-gold hover:underline">{p.name} · fit {pct(p.fit)}</Link>)}</div>
                </div>
                <div className="num text-right text-lg font-semibold">{inr(t.value)}</div>
              </li>
            ))}
          </ul>
        </Card>
        <div className="space-y-4">
          <Card title={<span className="flex items-center gap-2"><PackageCheck className="size-4" />SI project tracker</span>} sub="Milestone billing for system-integration projects">
            <div className="space-y-4">
              {x.projects.map((p: any) => (
                <div key={p.project}>
                  <div className="flex items-start justify-between gap-2 text-sm"><b className="leading-snug">{p.project}</b><span className="num shrink-0">{inr(p.value)}</span></div>
                  <div className="mt-2 flex gap-1">
                    {p.milestones.map((m: any) => <span key={m.milestone} title={`${m.milestone} — ${m.status} (due ${m.due})`} className="h-2.5 flex-1 rounded-full" style={{ background: m.status === 'billed' ? '#3f7d5c' : m.status === 'in progress' ? '#c99a2e' : '#e7e5e4' }} />)}
                  </div>
                  <div className="mt-1 flex justify-between text-[11px] text-ink-soft"><span>Billed {pct(p.billed_pct)} · collected {pct(p.collected_pct)}</span><span className={p.risk === 'On track' ? 'text-spec-svc' : 'text-warn'}>{p.risk}</span></div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card title={<span className="flex items-center gap-2"><Wrench className="size-4" />Returns & warranty signals</span>} sub="RMA rate by brand × category across the installed base" pad={false}>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-[11px] uppercase tracking-wider text-ink-soft"><th className="px-5 py-2">Line</th><th className="text-right">Installed</th><th className="text-right">RMA</th><th className="px-5">Play</th></tr></thead>
            <tbody>
              {x.rma.map((r: any, i: number) => (
                <tr key={i} className="border-t border-ink/5">
                  <td className="px-5 py-2">{r.brand} <span className="text-xs text-ink-soft">{r.category}</span></td>
                  <td className="num text-right">{r.installed}</td>
                  <td className={`num text-right ${r.alert ? 'font-semibold text-danger' : ''}`}>{r.alert && <AlertTriangle className="mr-1 inline size-3" />}{pct(r.rma_rate, 1)}</td>
                  <td className="px-5 text-xs text-ink-soft">{r.play}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card title={<span className="flex items-center gap-2"><Megaphone className="size-4" />Co-marketing (MDF) planner</span>} sub="₹2.5 Cr of brand funds allocated where whitespace × growth is highest">
          <div className="space-y-2.5">
            {x.mdf.map((m: any) => (
              <div key={m.brand} className="grid grid-cols-[110px_1fr_auto] items-center gap-3 text-sm">
                <span className="truncate font-medium">{m.brand}</span>
                <Bar value={m.allocation} max={x.mdf[0].allocation} color="#a16207" />
                <span className="num text-xs">{inr(m.allocation)} → {inr(m.expected_revenue)}</span>
              </div>
            ))}
          </div>
          <Reasoning how="Allocation ∝ whitespace partners × (1 + brand growth). Expected revenue uses an assumed 2.2× base ROI plus growth momentum — to be replaced by measured campaign ROI." why="Brand principals fund what they can see working; this plan is the evidence pack for the MDF conversation." />
        </Card>
      </div>
    </Page>
  )
}
