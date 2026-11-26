import { useMutation, useQuery } from '@tanstack/react-query'
import { Bot, Loader2, Send, Sparkles, Wrench } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { api } from '@/lib/api'

type Msg = { role: 'user' | 'ai'; text: string; steps?: any[]; citations?: any[]; mode?: string; ms?: number }

/** Renders **bold** and line breaks from the agent's markdown-lite answers. */
function Rich({ text }: { text: string }) {
  return (
    <div className="space-y-1.5 text-sm leading-relaxed">
      {text.split('\n').filter(Boolean).map((line, i) => {
        const parts = line.split(/(\*\*[^*]+\*\*|_[^_]+_)/g)
        return (
          <p key={i} className={line.startsWith('- ') ? 'pl-3' : ''}>
            {parts.map((p, j) => p.startsWith('**') ? <b key={j}>{p.slice(2, -2)}</b> : p.startsWith('_') && p.endsWith('_') ? <em key={j} className="text-ink-soft">{p.slice(1, -1)}</em> : <span key={j}>{p.replace(/^- /, '• ')}</span>)}
          </p>
        )
      })}
    </div>
  )
}

export function Copilot({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const info = useQuery({ queryKey: ['agent-info'], queryFn: () => api('/api/agent/info'), enabled: open })
  const params = useParams()
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [q, setQ] = useState('')
  const end = useRef<HTMLDivElement>(null)
  const ask = useMutation({
    mutationFn: (question: string) => api('/api/agent/ask', { method: 'POST', json: { question, account_id: params.id ? Number(params.id) : null } }),
    onSuccess: (r) => setMsgs((m) => [...m, { role: 'ai', text: r.answer, steps: r.steps, citations: r.citations, mode: r.mode, ms: r.latency_ms }]),
    onError: (e: any) => setMsgs((m) => [...m, { role: 'ai', text: `Sorry — ${e.message}` }]),
  })
  useEffect(() => end.current?.scrollIntoView({ behavior: 'smooth' }), [msgs, ask.isPending])
  const send = (text: string) => {
    if (!text.trim() || ask.isPending) return
    setMsgs((m) => [...m, { role: 'user', text }])
    setQ('')
    ask.mutate(text)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 border-l border-white/70 bg-pearl/95 p-0 backdrop-blur-xl sm:max-w-lg">
        <SheetHeader className="border-b border-ink/5 px-5 py-4">
          <SheetTitle className="flex items-center gap-2"><Bot className="size-5" /> Constella Copilot</SheetTitle>
          <SheetDescription className="text-xs">
            LangGraph agent · retrieve → plan → act → guard ·{' '}
            {info.data ? (info.data.mode === 'llm' ? `Claude (${info.data.model})` : 'offline planner (set ANTHROPIC_API_KEY for Claude)') : '…'}
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {!msgs.length && (
            <div>
              <p className="label mb-3">Try</p>
              <div className="flex flex-col gap-2">
                {(info.data?.suggestions ?? []).map((s: string) => (
                  <button key={s} onClick={() => send(s)} className="pane lift flex items-center gap-2 !rounded-xl px-3 py-2.5 text-left text-sm">
                    <Sparkles className="size-4 shrink-0 text-spec-fmct" />{s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {msgs.map((m, i) => m.role === 'user' ? (
            <div key={i} className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-[#1c1917] px-4 py-2.5 text-sm text-white">{m.text}</div>
          ) : (
            <div key={i} className="pane max-w-[95%] !rounded-2xl !rounded-bl-md p-4">
              <Rich text={m.text} />
              {!!m.steps?.length && (
                <details className="mt-3 text-xs text-ink-soft">
                  <summary className="flex cursor-pointer items-center gap-1.5"><Wrench className="size-3.5" /> {m.steps.filter((s) => s.tool).length} tool calls · {m.mode} · {m.ms} ms</summary>
                  <ol className="mt-2 space-y-1 font-mono text-[11px]">
                    {m.steps.map((s, j) => <li key={j}>{s.tool ? `→ ${s.tool}(${JSON.stringify(s.input)}) ${s.ms}ms` : `· ${s.node}: ${s.detail ?? ''}`}</li>)}
                  </ol>
                </details>
              )}
              {!!m.citations?.length && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {m.citations.slice(0, 3).map((c, j) => <span key={j} className="rounded-full bg-ink/5 px-2 py-0.5 text-[10px] text-ink-soft" title={c.text}>📎 {c.title}</span>)}
                </div>
              )}
            </div>
          ))}
          {ask.isPending && <div className="flex items-center gap-2 text-sm text-ink-soft"><Loader2 className="size-4 animate-spin" /> Retrieving playbooks, calling tools…</div>}
          <div ref={end} />
        </div>
        <form onSubmit={(e) => { e.preventDefault(); send(q) }} className="flex items-center gap-2 border-t border-ink/5 p-3">
          <label htmlFor="copilot-q" className="sr-only">Ask the copilot</label>
          <input id="copilot-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask about a partner, a deal, the pilot…"
            className="h-11 flex-1 rounded-full border border-ink/10 bg-white px-4 text-sm outline-none focus:border-spec-eb" />
          <button type="submit" disabled={ask.isPending} aria-label="Send" className="grid size-11 place-items-center rounded-full bg-[#1c1917] text-white disabled:opacity-50"><Send className="size-4" /></button>
        </form>
      </SheetContent>
    </Sheet>
  )
}
