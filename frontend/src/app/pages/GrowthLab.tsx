import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Sankey, Scatter, ScatterChart, Tooltip, Treemap, XAxis, YAxis, ZAxis,
} from 'recharts'
import { INDIA } from '@/lib/geo'
import { inr, pct } from '@/lib/format'
import { Card, Loading, Page, Reasoning, useApi } from '../kit'
import { CHART, DIV_COLORS_MAP } from '../theme'

const SEG_COLOR: Record<string, string> = {
  Champion: '#3f7d5c', Loyal: '#6f9a63', 'Needs attention': '#c99a2e', New: '#3e5c76', 'At risk': '#c2553d', Hibernating: '#a8a29e',
}
const shareColor = (s: number) => `hsl(${28 + s * 110} 45% ${78 - s * 38}%)`

function TreeCell(props: any) {
  const { x, y, width, height, name, share } = props
  if (width < 2 || height < 2) return null
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} rx={6} fill={shareColor(share ?? 0)} stroke="#f7f5f1" strokeWidth={2} />
      {width > 80 && height > 34 && (
        <>
          <text x={x + 8} y={y + 18} fontSize={11} fill="#1c1917" fontWeight={600}>{String(name).slice(0, Math.floor(width / 7))}</text>
          <text x={x + 8} y={y + 32} fontSize={10} fill="#57534e">{pct(share)} share</text>
        </>
      )}
    </g>
  )
}

function IndiaMap({ cities }: { cities: any[] }) {
  const [hover, setHover] = useState<any>(null)
  const W = 420, H = 470
  const px = (lng: number) => ((lng - 67) / (98 - 67)) * W
  const py = (lat: number) => H - ((lat - 6) / (37.5 - 6)) * H
  const path = INDIA.map(([lng, lat], i) => `${i ? 'L' : 'M'}${px(lng).toFixed(1)},${py(lat).toFixed(1)}`).join(' ') + 'Z'
  const max = Math.max(...cities.map((c) => c.open), 1)
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto h-[420px] w-full" role="img" aria-label="India map of whitespace by city">
        <defs>
          <linearGradient id="land" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#efe9df" /><stop offset="1" stopColor="#e4dccd" /></linearGradient>
        </defs>
        <path d={path} fill="url(#land)" stroke="#c9bfae" strokeWidth={1.2} />
        {cities.map((c) => {
          const r = 5 + Math.sqrt(c.open / max) * 26
          return (
            <g key={c.city} onMouseEnter={() => setHover(c)} onMouseLeave={() => setHover(null)} className="cursor-pointer">
              <circle cx={px(c.lng)} cy={py(c.lat)} r={r} fill={shareColor(c.share)} fillOpacity={0.75} stroke="#1c1917" strokeOpacity={0.25}>
                <animate attributeName="r" values={`${r * 0.92};${r};${r * 0.92}`} dur={`${3 + (c.partners % 3)}s`} repeatCount="indefinite" />
              </circle>
              {r > 14 && <text x={px(c.lng)} y={py(c.lat) + 3} textAnchor="middle" fontSize={9} fill="#1c1917">{c.city}</text>}
            </g>
          )
        })}
      </svg>
      {hover && (
        <div className="pointer-events-none absolute right-2 top-2 rounded-xl bg-white/95 p-3 text-xs shadow-lg">
          <div className="text-sm font-semibold">{hover.city}</div>
          <div>{hover.partners} partners · {pct(hover.share)} wallet share</div>
          <div>Open whitespace <b className="num">{inr(hover.open)}</b></div>
          <div>Leakage <b className="num">{inr(hover.leakage)}</b></div>
        </div>
      )}
    </div>
  )
}

export default function GrowthLab() {
  const d = useApi<any>(['growth'], '/api/growth/overview')
  const rfm = useApi<any[]>(['rfm'], '/api/growth/rfm')
  const x = d.data
  if (!x) return <Page title="Growth lab"><Loading rows={8} /></Page>
  const segCounts: Record<string, number> = {}
  rfm.data?.forEach((r) => { segCounts[r.segment] = (segCounts[r.segment] ?? 0) + 1 })

  return (
    <Page kicker="Where the next rupee of wallet share is" title="Growth lab">
      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card title="Wallet-share treemap" sub="Box size = partner's estimated tech spend · colour = share CNL captures (red → green)">
          <div className="h-[420px]">
            <ResponsiveContainer>
              <Treemap data={x.treemap} dataKey="size" nameKey="name" isAnimationActive={false} content={<TreeCell />}>
                <Tooltip formatter={(v: any) => inr(v)} />
              </Treemap>
            </ResponsiveContainer>
          </div>
          <Reasoning how="Estimated annual tech spend per partner (firmographic model) vs what it bought from CNL in the last 12 months." why="Big boxes in warm colours are the largest wallets CNL barely touches — the first place to send solution specialists." />
        </Card>
        <Card title="Whitespace map" sub="Bubble = open opportunity value per city · colour = wallet share">
          <IndiaMap cities={x.cities} />
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card title="Money flows: partner type → division" sub="12-month revenue — thin lines are the cross-division whitespace">
          <div className="h-80">
            <ResponsiveContainer>
              <Sankey data={x.flows} nodePadding={18} nodeWidth={12} link={{ stroke: '#c99a2e', strokeOpacity: 0.28 }}
                node={{ fill: '#3e5c76', stroke: 'none' } as any} margin={{ left: 10, right: 90, top: 10, bottom: 10 }}>
                <Tooltip formatter={(v: any) => inr(v)} />
              </Sankey>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Category portfolio matrix" sub="Growth (YoY) vs revenue share · bubble = margin · Stars / Cash cows / Question marks / Dogs">
          <div className="h-80">
            <ResponsiveContainer>
              <ScatterChart margin={{ left: 0, right: 20, top: 10, bottom: 10 }}>
                <CartesianGrid stroke={CHART.grid} />
                <ReferenceArea x1={0.03} x2={0.3} y1={0.3} y2={3} fill="#3f7d5c" fillOpacity={0.05} />
                <XAxis type="number" dataKey="share" tickFormatter={(v) => pct(v)} tick={{ fill: CHART.axis, fontSize: 11 }} name="Share" />
                <YAxis type="number" dataKey="growth" tickFormatter={(v) => pct(v)} tick={{ fill: CHART.axis, fontSize: 11 }} name="Growth" width={46} />
                <ZAxis type="number" dataKey="margin" range={[40, 420]} />
                <ReferenceLine x={0.03} stroke="#a8a29e" strokeDasharray="4 4" />
                <ReferenceLine y={0.3} stroke="#a8a29e" strokeDasharray="4 4" />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} content={({ payload }: any) => payload?.[0] ? (
                  <div className="rounded-lg bg-white p-2 text-xs shadow"><b>{payload[0].payload.label}</b><br />{payload[0].payload.quadrant} · growth {pct(payload[0].payload.growth)} · margin {pct(payload[0].payload.margin)}</div>) : null} />
                {['EB', 'HON', 'FMSG', 'FMCT', 'SVC'].map((dv) => (
                  <Scatter key={dv} isAnimationActive={false} data={x.matrix.filter((m: any) => m.division === dv)} fill={DIV_COLORS_MAP[dv]} fillOpacity={0.75} />
                ))}
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card title="Partner segments (RFM)" sub="Recency × frequency, bubble = 12-month spend" className="xl:col-span-2">
          <div className="h-72">
            {rfm.data && (
              <ResponsiveContainer>
                <ScatterChart margin={{ left: 0, right: 16, top: 10, bottom: 10 }}>
                  <CartesianGrid stroke={CHART.grid} />
                  <XAxis type="number" dataKey="recency" name="Days since last order" domain={[0, 400]} tick={{ fill: CHART.axis, fontSize: 11 }} reversed />
                  <YAxis type="number" dataKey="frequency" name="Orders (12m)" tick={{ fill: CHART.axis, fontSize: 11 }} width={34} />
                  <ZAxis type="number" dataKey="monetary" range={[12, 260]} />
                  <Tooltip content={({ payload }: any) => payload?.[0] ? (<div className="rounded-lg bg-white p-2 text-xs shadow"><b>{payload[0].payload.name}</b><br />{payload[0].payload.segment} · {inr(payload[0].payload.monetary)}</div>) : null} />
                  {Object.keys(SEG_COLOR).map((sg) => <Scatter key={sg} isAnimationActive={false} data={rfm.data!.filter((r) => r.segment === sg)} fill={SEG_COLOR[sg]} fillOpacity={0.7} />)}
                </ScatterChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {Object.entries(SEG_COLOR).map(([k, c]) => <span key={k} className="flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs"><span className="size-2 rounded-full" style={{ background: c }} />{k} <b className="num">{segCounts[k] ?? 0}</b></span>)}
          </div>
        </Card>
        <Card title="Concentration (Pareto)" sub={`Top 20% of partners = ${pct(x.pareto.top20_share)} of revenue`}>
          <div className="h-56">
            <ResponsiveContainer>
              <LineChart data={[{ partners_pct: 0, revenue_pct: 0 }, ...x.pareto.curve]}>
                <CartesianGrid stroke={CHART.grid} />
                <XAxis dataKey="partners_pct" type="number" tickFormatter={(v) => pct(v)} tick={{ fill: CHART.axis, fontSize: 11 }} />
                <YAxis tickFormatter={(v) => pct(v)} tick={{ fill: CHART.axis, fontSize: 11 }} width={40} />
                <ReferenceLine y={0.8} stroke="#a16207" strokeDasharray="4 4" />
                <Line isAnimationActive={false} dataKey="revenue_pct" stroke="#1c1917" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
            {Object.entries(x.pareto.abc).map(([k, v]: any) => <div key={k} className="rounded-xl bg-white/70 p-2"><b className="text-lg">{k}</b><div className="num">{v} partners</div></div>)}
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card title="Cohort retention" sub="Share of each first-purchase quarter still ordering N quarters later">
          <div className="space-y-1">
            {x.cohorts.rows.map((r: any) => (
              <div key={r.cohort} className="flex items-center gap-1">
                <span className="num w-16 shrink-0 text-[11px] text-ink-soft">{r.cohort}</span>
                {r.retention.map((v: number, i: number) => (
                  <span key={i} className="num grid h-7 flex-1 place-items-center rounded text-[10px]" title={`Q+${i}: ${pct(v)}`}
                    style={{ background: `rgba(63,125,92,${0.08 + v * 0.85})`, color: v > 0.55 ? '#fff' : '#1c1917' }}>{Math.round(v * 100)}</span>
                ))}
              </div>
            ))}
          </div>
        </Card>
        <Card title="Seasonality heatmap" sub="Monthly demand index by category (1.0 = average month)">
          <div className="space-y-1">
            <div className="flex gap-1 pl-[132px]">{x.seasonality.months.map((m: string, i: number) => <span key={i} className="flex-1 text-center text-[10px] text-ink-soft">{m}</span>)}</div>
            {x.seasonality.rows.map((r: any) => (
              <div key={r.category} className="flex items-center gap-1">
                <span className="w-32 shrink-0 truncate text-[11px] text-ink-soft">{r.label}</span>
                {r.index.map((v: number, i: number) => (
                  <span key={i} className="h-6 flex-1 rounded" title={`${r.label} · ${x.seasonality.months[i]}: ${v}`} style={{ background: `rgba(161,98,7,${Math.min(0.95, 0.05 + v * 0.35)})` }} />
                ))}
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_1fr_1fr]">
        {x.affinity && (
          <Card title="Co-purchase affinity" sub="Lift between the most-owned categories — gold = bought together far more than chance">
            <div className="overflow-x-auto">
              <table className="text-[10px]">
                <tbody>
                  {x.affinity.matrix.map((row: number[], i: number) => (
                    <tr key={i}>
                      <td className="max-w-[110px] truncate pr-2 text-ink-soft">{x.affinity.categories[i].label}</td>
                      {row.map((v, j) => <td key={j} className="p-[1px]"><div className="size-6 rounded-sm" title={`${x.affinity.categories[i].label} × ${x.affinity.categories[j].label}: lift ${v}`} style={{ background: i === j ? '#e7e5e4' : `rgba(201,154,46,${Math.min(0.95, Math.max(0, (v - 0.8) / 2.2))})` }} /></td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
        <Card title="What partners buy next" sub="Most common first-purchase sequences (Markov transitions)">
          <ul className="space-y-2">
            {x.paths.slice(0, 9).map((pth: any, i: number) => (
              <li key={i} className="flex items-center gap-2 text-xs">
                <span className="min-w-0 flex-1 truncate">{pth.from}</span>
                <span className={`shrink-0 rounded-full px-1.5 ${pth.cross_division ? 'bg-gold/15 text-gold' : 'bg-ink/5 text-ink-soft'}`}>→ {pct(pth.prob)}</span>
                <span className="min-w-0 flex-1 truncate text-right font-medium">{pth.to}</span>
              </li>
            ))}
          </ul>
          <Reasoning how="For each partner, the first purchase date of every category gives a sequence; we count A→B transitions." why="Gold arrows cross divisions — the next sale lives in another team's catalogue." />
        </Card>
        <Card title="Revenue at risk" sub={`Churn risk × 12m spend · total ${inr(x.at_risk.total)}`}>
          <ul className="space-y-2">
            {x.at_risk.items.slice(0, 8).map((r: any) => (
              <li key={r.id} className="flex items-center justify-between text-sm">
                <Link to={`/app/accounts/${r.id}`} className="truncate hover:text-gold">{r.name}</Link>
                <span className="num shrink-0 text-xs text-danger">{inr(r.at_risk)} · {pct(r.risk)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </Page>
  )
}
