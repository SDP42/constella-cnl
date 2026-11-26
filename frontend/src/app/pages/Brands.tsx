import { inr, pct } from '@/lib/format'
import { Bar, Card, Loading, Page, useApi, Reasoning } from '../kit'

export default function Brands() {
  const d = useApi<any[]>(['brands'], '/api/brands')
  const max = Math.max(1, ...(d.data ?? []).map((b) => b.revenue_12m))
  return (
    <Page kicker="For brand principals & category managers" title="Brand portal">
      <p className="-mt-3 mb-5 max-w-2xl text-sm text-ink-soft">
        What every brand sells through CNL’s network, how fast it is growing and how many fitting partners have never bought it — the conversation CNL can have with Honeywell, Samsung or Infinova about co-marketing funds.
      </p>
      <Reasoning how="Revenue and partners from the last 12 months of invoices by brand; growth vs the 12 months before; whitespace = partners in industries where the brand's categories are core needs who have not bought it." why="Brand principals fund co-marketing (MDF) where they see whitespace. CNL's FY29 plan needs brand business to rise from ~19% to 40% of revenue." />
      {!d.data ? <Loading rows={8} /> : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {d.data.map((b) => (
            <Card key={b.brand}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-lg font-semibold tracking-tight">{b.brand}</div>
                  <div className="text-xs text-ink-soft">{b.categories.length} categories{b.brand_business && <span className="ml-1.5 rounded-full bg-spec-svc/10 px-1.5 py-0.5 text-spec-svc">brand business</span>}</div>
                </div>
                {b.growth != null && <span className={`num rounded-full px-2 py-0.5 text-xs ${b.growth >= 0 ? 'bg-spec-svc/10 text-spec-svc' : 'bg-danger/10 text-danger'}`}>{b.growth >= 0 ? '+' : ''}{pct(b.growth)}</span>}
              </div>
              <div className="mt-4 num text-2xl font-semibold">{inr(b.revenue_12m)}</div>
              <Bar value={b.revenue_12m} max={max} color="#a16207" />
              <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                <div><div className="num text-base font-semibold">{b.partners}</div><div className="text-ink-soft">partners</div></div>
                <div><div className="num text-base font-semibold">{pct(b.penetration)}</div><div className="text-ink-soft">penetration</div></div>
                <div><div className="num text-base font-semibold text-gold">{b.whitespace_partners}</div><div className="text-ink-soft">whitespace</div></div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </Page>
  )
}
