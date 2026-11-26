import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Activity, BadgeCheck, Fingerprint, Scale, UserX } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { pct } from '@/lib/format'
import { Card, Loading, Page, Reasoning, Stat, useApi } from '../kit'

const PSI_TONE: Record<string, string> = { stable: '#3f7d5c', watch: '#b45309', drift: '#b42318' }
const CONSENT_TONE: Record<string, string> = { granted: '#3f7d5c', withdrawn: '#b42318', pending: '#b45309' }

export default function DataTrust() {
  const user = useAuth((s) => s.user)!
  const qc = useQueryClient()
  const d = useApi<any>(['trust'], '/api/trust/overview')
  const fb = useApi<any>(['fb-sum'], '/api/feedback/summary')
  const [name, setName] = useState('TECHNOVA SYSTEMS PVT LTD')
  const [city, setCity] = useState('Pune')
  const dd = useMutation({ mutationFn: () => api('/api/trust/dedupe', { method: 'POST', json: { name, city } }) })
  const erase = useMutation({
    mutationFn: (c: any) => api('/api/trust/erasure', { method: 'POST', json: { account_id: c.account_id, contact: c.contact, request: 'erasure' } }),
    onSuccess: () => { toast.success('Erasure logged — personal fields redacted, GST records retained'); qc.invalidateQueries({ queryKey: ['trust'] }) },
    onError: (e: any) => toast.error(e.message),
  })
  const x = d.data
  if (!x) return <Page title="Data trust"><Loading rows={8} /></Page>
  return (
    <Page kicker="Data quality · model health · DPDP Act 2023" title="Data trust & compliance">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="GSTIN checksum errors" value={x.gstin.invalid_checksum} sub={`of ${x.gstin.with_gstin} raw records with a GSTIN`} tone="#b42318" icon={<Fingerprint className="size-4" />} />
        <Stat label="Golden GSTINs valid" value={`${x.gstin.golden_valid}`} sub="after unification (PAN rescue)" tone="#3f7d5c" icon={<BadgeCheck className="size-4" />} />
        <Stat label="Features drifting" value={x.drift.filter((f: any) => f.status !== 'stable').length} sub="population stability index ≥ 0.1" tone="#b45309" icon={<Activity className="size-4" />} />
        <Stat label="“Not relevant” feedback" value={fb.data?.not_relevant_rate != null ? pct(fb.data.not_relevant_rate) : '—'} sub={`${fb.data?.total ?? 0} rep ratings · gate < 15%`} tone="#3e5c76" icon={<Scale className="size-4" />} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card title="GSTIN validation" sub="Mod-36 check-digit test on every raw division record">
          <ul className="space-y-1.5 text-sm">
            {x.gstin.invalid.map((g: any, i: number) => (
              <li key={i} className="flex items-center justify-between gap-2"><span className="min-w-0 truncate">“{g.raw_name}” <span className="text-xs text-ink-soft">{g.division}</span></span>
                <span className="num shrink-0 text-xs">{g.gstin} · <span className="text-spec-svc">rescued by {g.matched_by?.replace('_', ' ')}</span></span></li>
            ))}
          </ul>
          <Reasoning how="GSTIN's 15th character is a check digit over the first 14 (base-36, alternating ×1/×2 weights). A failed check means a keying error; the record is still matched via its PAN (characters 3–12) or fuzzy name." why="Invoices with a wrong GSTIN fail e-invoicing and input-tax credit for the partner — data quality is revenue protection, not hygiene." />
        </Card>
        <Card title="Model drift monitor" sub="Population stability index: training window vs live scoring features">
          <div className="space-y-2">
            {x.drift.map((f: any) => (
              <div key={f.feature} className="grid grid-cols-[170px_1fr_70px] items-center gap-3 text-sm">
                <span className="truncate font-mono text-xs">{f.feature}</span>
                <div className="h-2 rounded-full bg-ink/5"><div className="h-2 rounded-full" style={{ width: `${Math.min(100, f.psi * 250)}%`, background: PSI_TONE[f.status] }} /></div>
                <span className="text-right text-xs font-medium capitalize" style={{ color: PSI_TONE[f.status] }}>{f.psi} {f.status}</span>
              </div>
            ))}
          </div>
          <Reasoning how="PSI = Σ (live% − train%) × ln(live%/train%) over 10 quantile bins of the training distribution. < 0.1 stable, 0.1–0.25 watch, > 0.25 retrain." why="The nightly re-score job retrains on drift, so recommendations don't silently decay as the portfolio changes." />
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1.3fr]">
        <Card title="Onboarding duplicate check" sub="Before creating a ‘new’ partner, check it isn't already in the network">
          <div className="space-y-2">
            <input aria-label="Partner name" value={name} onChange={(e) => setName(e.target.value)} className="h-10 w-full rounded-xl border border-ink/10 bg-white px-3 text-sm" />
            <input aria-label="City" value={city} onChange={(e) => setCity(e.target.value)} className="h-10 w-full rounded-xl border border-ink/10 bg-white px-3 text-sm" />
            <button onClick={() => dd.mutate()} className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-white">Check</button>
            {dd.data && (
              <div className="rounded-xl bg-white/80 p-3 text-sm">
                <b className={dd.data.verdict === 'duplicate' ? 'text-danger' : dd.data.verdict === 'review' ? 'text-warn' : 'text-spec-svc'}>Verdict: {dd.data.verdict}</b>
                <ul className="mt-1 space-y-1 text-xs">{dd.data.candidates.map((c: any) => <li key={c.id}>{c.name} · {c.city} · {pct(c.score)} · {c.rule}</li>)}</ul>
              </div>
            )}
          </div>
        </Card>
        <Card title={<span className="flex items-center gap-2"><UserX className="size-4" />DPDP consent register</span>} sub={`Retention: contacts ${x.retention_policy.contacts}; audit log ${x.retention_policy.audit_log}`} pad={false}>
          <div className="max-h-80 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white"><tr className="text-left text-[11px] uppercase tracking-wider text-ink-soft"><th className="px-5 py-2">Contact</th><th>Consent</th><th>Retain until</th><th className="px-5" /></tr></thead>
              <tbody>
                {x.contacts.slice(0, 20).map((c: any, i: number) => (
                  <tr key={i} className="border-t border-ink/5">
                    <td className="px-5 py-2"><div>{c.contact} <span className="text-xs text-ink-soft">· {c.role}</span></div><div className="text-[11px] text-ink-soft">{c.account} · via {c.channel}</div></td>
                    <td><span className="rounded-full px-2 py-0.5 text-[11px] font-medium capitalize text-white" style={{ background: CONSENT_TONE[c.consent] }}>{c.consent}</span></td>
                    <td className="num text-xs">{c.retain_until}</td>
                    <td className="px-5 text-right">{(user.role === 'head' || user.role === 'steward') && <button onClick={() => erase.mutate(c)} className="rounded-full bg-ink/5 px-2.5 py-1 text-[11px] hover:bg-ink/10">Erase</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 pb-4">
            {x.erasures.length > 0 && <p className="mt-3 text-xs text-ink-soft">Last request: {x.erasures[0].request} for {x.erasures[0].contact} by {x.erasures[0].handled_by} — {x.erasures[0].note}</p>}
            <Reasoning how="Every partner contact carries purpose, consent status, capture date and a retention date. Erasure redacts personal fields from CRM notes while keeping invoices required under GST law." why="Under the DPDP Act 2023 a B2B contact's name, phone and email are personal data — consent, purpose limitation and erasure on request are obligations, not features." />
          </div>
        </Card>
      </div>
    </Page>
  )
}
