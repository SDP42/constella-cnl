import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Mail, MessageCircle, Play, Smartphone, Webhook, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { Card, Loading, Page, Stat, useApi } from '../kit'

const CH: Record<string, React.ReactNode> = {
  whatsapp: <MessageCircle className="size-3.5" />, email: <Mail className="size-3.5" />, in_app: <Smartphone className="size-3.5" />, webhook: <Webhook className="size-3.5" />,
}

export default function Automation() {
  const user = useAuth((s) => s.user)!
  const qc = useQueryClient()
  const rules = useApi<any>(['auto-rules'], '/api/automation/rules')
  const jobs = useApi<any[]>(['jobs'], '/api/automation/jobs', { refetchInterval: 15_000 })
  const outbox = useApi<any[]>(['outbox'], '/api/automation/outbox?limit=40', { refetchInterval: 15_000 })
  const isHead = user.role === 'head'
  const toggle = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => api(`/api/automation/rules/${id}`, { method: 'PATCH', json: { enabled } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['auto-rules'] }),
    onError: (e: any) => toast.error(e.message),
  })
  const run = useMutation({
    mutationFn: (name: string) => api(`/api/automation/jobs/${name}/run`, { method: 'POST' }),
    onSuccess: (r) => { toast.success(`${r.job}: ${r.summary}`); qc.invalidateQueries() },
    onError: (e: any) => toast.error(e.message),
  })
  return (
    <Page kicker="Scale without headcount" title="Automation">
      {rules.data && (
        <div className="mb-4 grid grid-cols-3 gap-3">
          <Stat label="Rule runs" value={rules.data.runs} tone="#a16207" />
          <Stat label="Hours saved" value={rules.data.hours_saved} tone="#3f7d5c" />
          <Stat label="FTE-equivalent" value={rules.data.fte_equivalent} sub="per month of rep time" tone="#3e5c76" />
        </div>
      )}
      <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <Card title="Playbooks" sub="WHEN trigger · IF conditions · THEN actions — editable data, not code">
          {!rules.data ? <Loading /> : (
            <ul className="divide-y divide-ink/5">
              {rules.data.rules.map((r: any) => (
                <li key={r.id} className="flex items-start gap-4 py-3">
                  <Zap className={`mt-0.5 size-4 shrink-0 ${r.enabled ? 'text-gold' : 'text-ink-soft'}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2"><b className="text-sm">{r.name}</b><span className="rounded-full bg-ink/5 px-2 py-0.5 font-mono text-[10px]">WHEN {r.trigger}</span></div>
                    <p className="mt-0.5 text-sm text-ink-soft">{r.description}</p>
                    <p className="mt-1 text-[11px] text-ink-soft">{r.runs} runs · {r.hours_saved_per_run}h saved each</p>
                  </div>
                  <Switch checked={r.enabled} disabled={!isHead} onCheckedChange={(v) => toggle.mutate({ id: r.id, enabled: v })} aria-label={`Toggle ${r.name}`} />
                </li>
              ))}
            </ul>
          )}
        </Card>
        <div className="space-y-4">
          <Card title="Scheduled jobs">
            <ul className="space-y-2">
              {jobs.data?.map((j) => (
                <li key={j.job} className="flex items-center justify-between gap-3 rounded-xl bg-white/70 px-3 py-2 text-sm">
                  <span className="min-w-0"><b>{j.job}</b> <span className="text-xs text-ink-soft">· {j.every}</span><span className="block truncate text-xs text-ink-soft">{j.last ? j.last.summary : j.description}</span></span>
                  {isHead && <button onClick={() => run.mutate(j.job)} aria-label={`Run ${j.job}`} className="grid size-8 shrink-0 place-items-center rounded-full bg-ink text-white"><Play className="size-3.5" /></button>}
                </li>
              ))}
            </ul>
          </Card>
          <Card title="Outbox" sub="Messages the automations sent (WhatsApp Business / email / in-app)">
            <ul className="max-h-96 space-y-2 overflow-y-auto pr-1">
              {outbox.data?.map((o) => (
                <li key={o.id} className="rounded-xl bg-white/70 p-3 text-sm">
                  <div className="flex items-center justify-between text-xs text-ink-soft"><span className="flex items-center gap-1.5">{CH[o.channel]}{o.channel} → {o.to}</span><span>{o.status}</span></div>
                  <div className="mt-1 font-medium">{o.subject}</div>
                  <p className="line-clamp-2 text-xs text-ink-soft">{o.body}</p>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </Page>
  )
}
