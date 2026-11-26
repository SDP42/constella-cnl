import { useMutation, useQuery } from '@tanstack/react-query'
import { CheckCircle2, ShieldCheck } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { GlyphRow } from '@/components/Glyph'
import { api } from '@/lib/api'
import { inr } from '@/lib/format'

/** Partner self-serve proposal page — opened from a signed, expiring link; no login, no PII. */
export default function Proposal() {
  const { token } = useParams()
  const q = useQuery({ queryKey: ['proposal', token], queryFn: () => api(`/api/public/proposals/${token}`), retry: false })
  const accept = useMutation({ mutationFn: () => api(`/api/public/proposals/${token}/accept`, { method: 'POST' }) })
  const p = q.data
  return (
    <div className="min-h-dvh bg-pearl px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 flex items-center justify-between">
          <span className="flex items-center gap-2 font-semibold"><GlyphRow size={8} gap={3} /> Creative Newtech</span>
          <span className="flex items-center gap-1.5 text-xs text-ink-soft"><ShieldCheck className="size-4" />Secure link · valid 14 days</span>
        </div>
        {q.isError && <div className="pane p-8 text-center">This proposal link has expired or is invalid. Please ask your Creative Newtech contact for a new one.</div>}
        {p && (
          <div className="overflow-hidden rounded-[28px] bg-white shadow-[0_40px_80px_-40px_rgba(28,25,23,.4)]">
            <div className="relative overflow-hidden bg-night px-8 py-10 text-white">
              <span aria-hidden className="absolute -right-16 -top-20 size-72 rounded-full bg-gold-bright/30 blur-3xl" />
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/55">Proposal for {p.partner} · {p.city}</p>
              <h1 className="relative mt-3 text-4xl font-semibold leading-tight tracking-tight">{p.solution ?? p.title}</h1>
              {p.tagline && <p className="relative mt-2 max-w-lg text-white/70">{p.tagline}</p>}
            </div>
            <div className="grid gap-8 p-8 md:grid-cols-[1.3fr_1fr]">
              <div>
                <p className="label">What's included</p>
                <ul className="mt-3 space-y-2">
                  {p.lines.map((l: any) => <li key={l.label} className="flex items-center justify-between rounded-xl bg-pearl px-4 py-3 text-sm"><span>{l.label}</span><span className="text-xs text-ink-soft">{l.brand}</span></li>)}
                </ul>
                <p className="label mt-6">Why it fits you</p>
                <ul className="mt-2 space-y-1.5 text-sm text-ink-soft">{p.why.map((w: string, i: number) => <li key={i}>• {w}</li>)}</ul>
              </div>
              <div className="space-y-3">
                <div className="rounded-2xl bg-pearl p-5"><p className="label">Upfront</p><p className="num mt-1 text-3xl font-semibold">{inr(p.value)}</p></div>
                <div className="rounded-2xl border border-gold/30 bg-gold/5 p-5"><p className="label">Or monthly (36 mo, incl. service)</p><p className="num mt-1 text-3xl font-semibold text-gold">{inr(p.monthly_option)}<span className="text-base font-normal">/mo</span></p></div>
                {p.annuity > 0 && <p className="text-xs text-ink-soft">Includes a service plan worth {inr(p.annuity)} a year — renewals handled automatically.</p>}
                {accept.isSuccess || p.status === 'negotiation' ? (
                  <div className="flex items-center gap-2 rounded-2xl bg-spec-svc/10 p-4 text-sm text-spec-svc"><CheckCircle2 className="size-5" />Accepted — your Creative Newtech contact will send the PO paperwork.</div>
                ) : (
                  <button onClick={() => accept.mutate()} disabled={accept.isPending} className="w-full rounded-full bg-ink py-4 font-semibold text-white transition-transform hover:scale-[1.02]">Accept proposal</button>
                )}
                <p className="text-center text-[11px] text-ink-soft">One PO · one point of contact · across every Creative Newtech division</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
