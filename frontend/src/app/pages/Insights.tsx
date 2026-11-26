import { useState } from 'react'
import { Area, AreaChart, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, Bar as RBar } from 'recharts'
import { Slider } from '@/components/ui/slider'
import { inr, pct, titleCase } from '@/lib/format'
import { Card, Loading, Page, Stat, useApi } from '../kit'
import { CHART, DIV_COLORS_MAP, DIV_NAME } from '../theme'

function Fy29() {
  const [g, setG] = useState(18)
  const [u, setU] = useState(6)
  const [b, setB] = useState(6)
  const d = useApi<any>(['fy29', g, u, b], `/api/bi/fy29?base_growth=${g / 100}&uplift=${u / 100}&brand_gain=${b / 100}`, { placeholderData: (p: any) => p })
  const x = d.data
  return (
    <Card title="FY29 path — ₹6,000 Cr & 40% brand mix" sub="Sample network scaled to CNL's reported FY26 revenue. Move the sliders to test a plan.">
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <div className="space-y-5">
          {[['Organic growth / yr', g, setG, 0, 40], ['Constella uplift / yr', u, setU, 0, 20], ['Brand mix gain (pp / yr)', b, setB, 0, 15]].map(([l, v, set, min, max]: any) => (
            <div key={l}>
              <div className="mb-2 flex justify-between text-sm"><span>{l}</span><span className="num font-medium">{v}%</span></div>
              <Slider value={[v]} min={min} max={max} step={1} onValueChange={(vv) => set(vv[0])} aria-label={l} />
            </div>
          ))}
          {x && (
            <div className={`rounded-xl p-3 text-sm ${x.on_track ? 'bg-spec-svc/10 text-spec-svc' : 'bg-warn/10 text-warn'}`}>
              {x.on_track ? 'On track for both FY29 goals.' : `Gap at FY29: ${inr(x.gap_fy29)}. Needs ${pct(x.required_cagr, 1)} CAGR.`}
            </div>
          )}
        </div>
        <div className="h-72">
          {x && (
            <ResponsiveContainer>
              <ComposedChart data={x.years}>
                <CartesianGrid stroke={CHART.grid} vertical={false} />
                <XAxis dataKey="year" tick={{ fill: CHART.axis, fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="l" tickFormatter={(v) => inr(v, 0)} tick={{ fill: CHART.axis, fontSize: 11 }} axisLine={false} tickLine={false} width={70} />
                <YAxis yAxisId="r" orientation="right" domain={[0, 0.6]} tickFormatter={(v) => pct(v)} tick={{ fill: CHART.axis, fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: any, k: any) => (k === 'brand_share' ? pct(v) : inr(v))} />
                <RBar isAnimationActive={false} yAxisId="l" dataKey="baseline" fill="#d6d3d1" radius={[6, 6, 0, 0]} name="Without Constella" />
                <RBar isAnimationActive={false} yAxisId="l" dataKey="revenue" fill="#a16207" radius={[6, 6, 0, 0]} name="With Constella" />
                <Line isAnimationActive={false} yAxisId="r" dataKey="brand_share" stroke="#3f7d5c" strokeWidth={2.5} dot={{ r: 4 }} name="Brand share" />
                <ReferenceLine yAxisId="l" y={x.target_revenue} stroke="#1c1917" strokeDasharray="4 4" label={{ value: '₹6,000 Cr goal', fill: '#1c1917', fontSize: 11, position: 'insideTopLeft' }} />
                <ReferenceLine yAxisId="r" y={0.4} stroke="#3f7d5c" strokeDasharray="2 4" />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </Card>
  )
}

export default function Insights() {
  const d = useApi<any>(['bi'], '/api/bi/overview')
  const x = d.data
  if (!x) return <Page title="BI & forecast"><Loading rows={8} /></Page>
  const series = [...x.forecast.history.map((h: any) => ({ month: h.month, actual: h.total })),
    ...x.forecast.forecast.map((f: any) => ({ month: f.month, forecast: f.total, band: [f.lo, f.hi] }))]
  const cellMap: Record<string, number> = {}
  x.penetration.cells.forEach((c: any) => { cellMap[`${c.vertical}|${c.division}`] = c.share })

  return (
    <Page kicker="Business intelligence · predictive" title="BI & forecast">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Revenue (12m, sample)" value={inr(x.kpis.revenue_12m)} sub={`${pct(x.kpis.growth_yoy)} YoY`} tone="#3e5c76" />
        <Stat label="Next 6 months (forecast)" value={inr(x.kpis.next_6m_forecast)} sub={`back-test MAPE ${pct(x.forecast.backtest_mape)}`} tone="#a16207" />
        <Stat label="Brand-business share" value={pct(x.kpis.brand_share_latest)} sub="target 40% by FY29" tone="#3f7d5c" />
        <Stat label="Partners at churn risk" value={x.kpis.high_churn_risk} sub={`model AUC ${x.kpis.churn_model_auc}`} tone="#c2553d" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Card title="Revenue & 6-month forecast" sub={x.forecast.method}>
          <div className="h-72">
            <ResponsiveContainer>
              <AreaChart data={series}>
                <CartesianGrid stroke={CHART.grid} vertical={false} />
                <XAxis dataKey="month" tick={{ fill: CHART.axis, fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={24} />
                <YAxis tickFormatter={(v) => inr(v, 0)} tick={{ fill: CHART.axis, fontSize: 11 }} axisLine={false} tickLine={false} width={64} />
                <Tooltip formatter={(v: any) => (Array.isArray(v) ? `${inr(v[0])} – ${inr(v[1])}` : inr(v))} />
                <Area isAnimationActive={false} dataKey="band" stroke="none" fill="#c99a2e" fillOpacity={0.18} name="80% interval" />
                <Area isAnimationActive={false} dataKey="actual" stroke="#1c1917" fill="#1c1917" fillOpacity={0.06} strokeWidth={2} name="Actual" />
                <Area isAnimationActive={false} dataKey="forecast" stroke="#a16207" fill="none" strokeWidth={2.5} strokeDasharray="6 4" name="Forecast" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Brand-business share by month" sub="Honeywell · WOZOYO · CyberPowerPC · Infinova · AT&T">
          <div className="h-72">
            <ResponsiveContainer>
              <AreaChart data={x.brand_mix}>
                <CartesianGrid stroke={CHART.grid} vertical={false} />
                <XAxis dataKey="month" tick={{ fill: CHART.axis, fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={30} />
                <YAxis domain={[0, 0.5]} tickFormatter={(v) => pct(v)} tick={{ fill: CHART.axis, fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
                <Tooltip formatter={(v: any) => pct(v, 1)} />
                <ReferenceLine y={0.4} stroke="#3f7d5c" strokeDasharray="4 4" label={{ value: 'FY29 target', fontSize: 11, fill: '#3f7d5c', position: 'insideTopRight' }} />
                <Area isAnimationActive={false} dataKey="brand_share" stroke="#3f7d5c" fill="#3f7d5c" fillOpacity={0.15} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="mt-4"><Fy29 /></div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card title="Division penetration by industry" sub="Share of partners in each vertical buying from each division — the pale cells are cross-sell territory">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr><th />{x.penetration.divisions.map((dv: string) => <th key={dv} className="px-2 pb-2 text-xs font-medium text-ink-soft" title={DIV_NAME[dv]}>{dv}</th>)}</tr></thead>
              <tbody>
                {x.penetration.verticals.map((v: string) => (
                  <tr key={v}>
                    <td className="py-1 pr-3 text-xs text-ink-soft">{titleCase(v)}</td>
                    {x.penetration.divisions.map((dv: string) => {
                      const val = cellMap[`${v}|${dv}`] ?? 0
                      return (
                        <td key={dv} className="p-0.5">
                          <div className="num grid h-9 place-items-center rounded-lg text-[11px]" title={`${titleCase(v)} × ${DIV_NAME[dv]}: ${pct(val)}`}
                            style={{ background: `${DIV_COLORS_MAP[dv]}${Math.round(12 + val * 220).toString(16).padStart(2, '0')}`, color: val > 0.55 ? '#fff' : '#1c1917' }}>{pct(val)}</div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title="Anomaly feed" sub="Weekly division revenue more than 2.5σ from its own baseline">
          {x.anomalies.length ? (
            <ul className="space-y-2">
              {x.anomalies.map((an: any, i: number) => (
                <li key={i} className="flex items-center justify-between rounded-xl bg-white/70 px-3 py-2 text-sm">
                  <span><b className={an.direction === 'spike' ? 'text-spec-svc' : 'text-danger'}>{an.direction === 'spike' ? '▲' : '▼'}</b> {DIV_NAME[an.division]} · week of {an.week}</span>
                  <span className="num text-xs">{inr(an.value)} vs {inr(an.expected)} · z {an.z}</span>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-ink-soft">No anomalies this period — every division is inside its normal band.</p>}
        </Card>
      </div>
    </Page>
  )
}
