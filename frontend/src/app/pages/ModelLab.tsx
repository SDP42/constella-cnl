import { Bar as RBar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { pct } from '@/lib/format'
import { Card, Loading, Page, Stat, useApi, Reasoning } from '../kit'
import { CHART } from '../theme'

const NAMES: Record<string, string> = { constella_gbm: 'Constella GBM', popularity: 'Peer popularity', item_cf: 'Item-to-item CF', association_rules: 'Association rules' }

export default function ModelLab() {
  const d = useApi<any>(['model'], '/api/model/metrics')
  const m = d.data
  if (!m) return <Page title="Model lab"><Loading rows={6} /></Page>
  const g = m.models.constella_gbm
  return (
    <Page kicker="Detect the opportunity · how accurate is it?" title="Model lab">
      <p className="-mt-3 mb-5 max-w-3xl text-sm text-ink-soft">
        Time-split back-test: features are frozen at {m.eval_cutoff}; the label is what each partner actually bought in the next {m.horizon_days} days. No future data leaks into training ({m.train_pairs.toLocaleString()} training pairs, {m.eval_pairs.toLocaleString()} test pairs).
      </p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="ROC AUC" value={g.auc} tone="#3e5c76" />
        <Stat label="Avg precision" value={g.avg_precision} sub={`base rate ${pct(m.eval_positive_rate, 1)}`} tone="#a16207" />
        <Stat label="Hit rate @5" value={pct(g['hit_rate@5'])} sub="partners with ≥1 correct top-5" tone="#3f7d5c" />
        <Stat label="Recall @5" value={pct(g['recall@5'])} tone="#6b4e71" />
        <Stat label="Brier score" value={m.brier} sub="calibration (lower is better)" tone="#c2553d" />
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card title="Against three baselines" sub="Average precision on the same held-out window">
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={Object.entries(m.models).map(([k, v]: any) => ({ name: NAMES[k] ?? k, ap: v.avg_precision, auc: v.auc }))}>
                <CartesianGrid stroke={CHART.grid} vertical={false} />
                <XAxis dataKey="name" tick={{ fill: CHART.axis, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: CHART.axis, fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
                <Tooltip />
                <RBar isAnimationActive={false} dataKey="ap" name="Avg precision" fill="#a16207" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Calibration" sub="Predicted vs actual purchase rate by decile — on the diagonal means the probabilities can be trusted">
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={m.calibration}>
                <CartesianGrid stroke={CHART.grid} />
                <XAxis dataKey="predicted" type="number" domain={[0, 'dataMax']} tickFormatter={(v) => pct(v)} tick={{ fill: CHART.axis, fontSize: 11 }} />
                <YAxis dataKey="actual" type="number" domain={[0, 'dataMax']} tickFormatter={(v) => pct(v)} tick={{ fill: CHART.axis, fontSize: 11 }} width={44} />
                <Tooltip formatter={(v: any) => pct(v, 1)} />
                <ReferenceLine segment={[{ x: 0, y: 0 }, { x: 0.3, y: 0.3 }]} stroke="#a8a29e" strokeDasharray="4 4" />
                <Line isAnimationActive={false} dataKey="actual" stroke="#3e5c76" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Cumulative gain" sub="Share of all next-120-day purchases captured by working the top X% of scored pairs">
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={[{ pct_pairs: 0, pct_captured: 0 }, ...m.gain_curve]}>
                <CartesianGrid stroke={CHART.grid} />
                <XAxis dataKey="pct_pairs" tickFormatter={(v) => `${v}%`} tick={{ fill: CHART.axis, fontSize: 11 }} />
                <YAxis tickFormatter={(v) => pct(v)} tick={{ fill: CHART.axis, fontSize: 11 }} width={44} />
                <Tooltip formatter={(v: any) => pct(v)} labelFormatter={(l) => `Top ${l}% of pairs`} />
                <ReferenceLine segment={[{ x: 0, y: 0 }, { x: 100, y: 1 }]} stroke="#a8a29e" strokeDasharray="4 4" />
                <Line isAnimationActive={false} dataKey="pct_captured" stroke="#3f7d5c" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="What drives a prediction" sub="Permutation importance on the test window">
          <Reasoning how="Each feature is shuffled in turn on a 6,000-pair sample of the test window; the drop in average precision is its importance. The same importances × each pair's deviation from the median give the per-opportunity reason codes in the dossier." why="Reps act on recommendations they understand. Peer adoption, intent in notes and co-purchase lift dominating — rather than an opaque ID feature — is what makes the model explainable." />
          <div className="space-y-2">
            {m.feature_importance.slice(0, 10).map((f: any) => (
              <div key={f.feature} className="grid grid-cols-[180px_1fr_44px] items-center gap-3 text-sm">
                <span className="truncate">{f.label}</span>
                <div className="h-2 rounded-full bg-ink/5"><div className="h-2 rounded-full bg-gold" style={{ width: `${(f.importance / m.feature_importance[0].importance) * 100}%` }} /></div>
                <span className="num text-right text-xs">{pct(f.importance)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </Page>
  )
}
