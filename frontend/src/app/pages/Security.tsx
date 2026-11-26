import { KeyRound, Lock, ShieldCheck, Timer, UserCheck } from 'lucide-react'
import { Card, Loading, Page, useApi } from '../kit'

const CONTROLS = [
  { icon: <KeyRound className="size-4" />, t: 'Signed, expiring tokens', d: 'HMAC-SHA256 tokens, 8-hour expiry, stored in sessionStorage (dies with the tab). Production: OIDC via Azure AD / Google SSO.' },
  { icon: <UserCheck className="size-4" />, t: 'Role-based access', d: 'rep · head · architect · steward · partner — every endpoint checks a permission, including the AI copilot’s tool calls.' },
  { icon: <Lock className="size-4" />, t: 'Territory scoping & PII masking', d: 'Reps see their region or deals they lead/assist; GSTIN, PAN and phone are masked unless the role needs them.' },
  { icon: <Timer className="size-4" />, t: 'Rate limits & security headers', d: 'Token bucket per client (stricter on login), CSP, frame-deny, nosniff, no-store on API responses.' },
  { icon: <ShieldCheck className="size-4" />, t: 'Append-only audit log', d: 'Every write and every sensitive read is logged with actor, role, path, status and IP.' },
]

export default function Security() {
  const d = useApi<any[]>(['audit'], '/api/audit?limit=80', { refetchInterval: 10_000 })
  return (
    <Page kicker="Compliance & risk" title="Security & audit">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {CONTROLS.map((c) => (
          <div key={c.t} className="pane p-4">
            <span className="grid size-8 place-items-center rounded-full bg-gold/10 text-gold">{c.icon}</span>
            <div className="mt-3 font-semibold">{c.t}</div>
            <p className="mt-1 text-xs leading-relaxed text-ink-soft">{c.d}</p>
          </div>
        ))}
      </div>
      <Card title="Live audit trail" sub="Refreshes every 10 seconds" className="mt-4" pad={false}>
        {!d.data ? <div className="p-5"><Loading /></div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-[11px] uppercase tracking-wider text-ink-soft"><th className="px-5 py-3">Time</th><th className="px-3">Actor</th><th className="px-3">Role</th><th className="px-3">Action</th><th className="px-3">Status</th><th className="px-5">IP</th></tr></thead>
              <tbody>
                {d.data.map((a) => (
                  <tr key={a.id} className="border-t border-ink/5">
                    <td className="num px-5 py-2 text-xs text-ink-soft">{new Date(a.ts).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</td>
                    <td className="px-3">{a.actor}</td><td className="px-3 text-ink-soft">{a.role}</td>
                    <td className="px-3 font-mono text-xs">{a.method} {a.path}</td>
                    <td className="px-3"><span className={`num rounded-full px-2 py-0.5 text-xs ${a.status < 300 ? 'bg-spec-svc/10 text-spec-svc' : 'bg-danger/10 text-danger'}`}>{a.status}</span></td>
                    <td className="num px-5 text-xs text-ink-soft">{a.ip}</td>
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
