import { Search } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { inr, pct, titleCase } from '@/lib/format'
import { Bar, Card, Loading, Page, useApi } from '../kit'

export default function Accounts() {
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('whitespace')
  const [type, setType] = useState('')
  const d = useApi<any>(['accounts', q, sort, type], `/api/accounts?limit=120&sort=${sort}${q ? `&q=${encodeURIComponent(q)}` : ''}${type ? `&type=${type}` : ''}`)
  return (
    <Page kicker="Golden records across every division" title="Account twins"
      actions={<span className="text-sm text-ink-soft">{d.data?.total ?? '…'} partners in your view</span>}>
      <Card pad={false}>
        <div className="flex flex-wrap items-center gap-2 border-b border-ink/5 p-4">
          <label className="relative flex-1">
            <span className="sr-only">Search partners</span>
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-soft" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or city" className="h-10 w-full rounded-xl border border-ink/10 bg-white pl-9 pr-3 text-sm" />
          </label>
          <label className="sr-only" htmlFor="acc-type">Type</label>
          <select id="acc-type" value={type} onChange={(e) => setType(e.target.value)} className="h-10 rounded-xl border border-ink/10 bg-white px-3 text-sm">
            <option value="">All types</option>
            {['system_integrator', 'reseller', 'retailer', 'enterprise', 'sub_distributor'].map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}
          </select>
          <div className="flex gap-1 rounded-full bg-ink/5 p-0.5 text-xs">
            {[['whitespace', 'Open value'], ['spend', '12m spend'], ['share', 'Lowest share']].map(([k, l]) => (
              <button key={k} onClick={() => setSort(k)} className={`rounded-full px-3 py-1.5 ${sort === k ? 'bg-white shadow-sm' : 'text-ink-soft'}`}>{l}</button>
            ))}
          </div>
        </div>
        {!d.data ? <div className="p-4"><Loading /></div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-[11px] uppercase tracking-wider text-ink-soft">
                <th className="px-5 py-3 font-medium">Partner</th><th className="px-3 py-3 font-medium">Type</th><th className="px-3 py-3 text-right font-medium">12m spend</th>
                <th className="w-40 px-3 py-3 font-medium">Wallet share</th><th className="px-3 py-3 text-right font-medium">Leakage</th><th className="px-3 py-3 text-right font-medium">Open value</th><th className="px-5 py-3 text-right font-medium">Opps</th>
              </tr></thead>
              <tbody>
                {d.data.items.map((a: any) => (
                  <tr key={a.id} className="border-t border-ink/5 transition-colors hover:bg-white">
                    <td className="px-5 py-3"><Link to={`/app/accounts/${a.id}`} className="font-medium hover:text-gold">{a.name}</Link><div className="text-xs text-ink-soft">{a.city} · {titleCase(a.vertical)} · {a.tier}</div></td>
                    <td className="px-3 py-3 text-ink-soft">{titleCase(a.type)}</td>
                    <td className="num px-3 py-3 text-right">{inr(a.spend_12m)}</td>
                    <td className="px-3 py-3"><div className="flex items-center gap-2"><Bar value={a.wallet_share} color="#a16207" /><span className="num w-10 text-right text-xs">{pct(a.wallet_share)}</span></div></td>
                    <td className="num px-3 py-3 text-right text-ink-soft">{inr(a.leakage)}</td>
                    <td className="num px-3 py-3 text-right font-medium">{inr(a.open_value)}</td>
                    <td className="num px-5 py-3 text-right">{a.open_opps}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </Page>
  )
}
