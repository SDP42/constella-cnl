import { useMutation, useQuery } from '@tanstack/react-query'
import { Bot, Loader2, Mic, MicOff, Send, Sparkles, Volume2, VolumeX, Wrench } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { api } from '@/lib/api'

type Msg = { role: 'user' | 'ai'; text: string; steps?: any[]; citations?: any[]; mode?: string; ms?: number; voice?: boolean }

/** Renders **bold**, _italic_ and bullet lines from the agent's markdown-lite answers. */
function Rich({ text }: { text: string }) {
  return (
    <div className="space-y-1.5 text-sm leading-relaxed">
      {text.split('\n').filter(Boolean).map((line, i) => {
        const parts = line.split(/(\*\*[^*]+\*\*|_[^_]+_)/g)
        return (
          <p key={i} className={line.startsWith('- ') ? 'pl-3' : ''}>
            {parts.map((p, j) => p.startsWith('**') ? <b key={j}>{p.slice(2, -2)}</b>
              : p.startsWith('_') && p.endsWith('_') && p.length > 2 ? <em key={j} className="text-ink-soft">{p.slice(1, -1)}</em>
                : <span key={j}>{p.replace(/^- /, '• ')}</span>)}
          </p>
        )
      })}
    </div>
  )
}

const plain = (t: string) => t.replace(/\*\*|_|#/g, '').replace(/₹/g, 'rupees ').replace(/\bCr\b/g, 'crore').replace(/\bL\b/g, 'lakh')
  .replace(/^- /gm, '').split('\n').filter((l) => !l.toLowerCase().startsWith('playbook')).join('. ')

// Browser speech APIs (Chrome/Edge/Safari). Feature-detected; the chat works without them.
const SR: any = typeof window !== 'undefined' ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition : null

function VoiceOrb({ state }: { state: 'idle' | 'listening' | 'thinking' | 'speaking' }) {
  const active = state !== 'idle'
  return (
    <div className="relative grid size-28 place-items-center" aria-hidden>
      {active && [0, 1, 2].map((i) => (
        <span key={i} className="absolute inset-0 rounded-full border border-gold-bright/60"
          style={{ animation: `ping ${state === 'listening' ? 1.4 : 2.2}s cubic-bezier(0,0,.2,1) ${i * 0.35}s infinite` }} />
      ))}
      <span className={`size-20 rounded-full shadow-[0_10px_40px_-8px_rgba(161,98,7,.6)] transition-transform duration-500 ${state === 'speaking' ? 'scale-110' : state === 'listening' ? 'scale-105' : ''}`}
        style={{ background: 'radial-gradient(circle at 30% 25%, #fff6d6, #f5b700 35%, #a16207 70%, #3b2a10)' }} />
      {state === 'thinking' && <Loader2 className="absolute size-6 animate-spin text-white" />}
    </div>
  )
}

export function Copilot({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const info = useQuery({ queryKey: ['agent-info'], queryFn: () => api('/api/agent/info'), enabled: open })
  const params = useParams()
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [q, setQ] = useState('')
  const [listening, setListening] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [speak, setSpeak] = useState(true)
  const [handsFree, setHandsFree] = useState(false)
  const rec = useRef<any>(null)
  const end = useRef<HTMLDivElement>(null)
  const voiceTurn = useRef(false)

  const say = (text: string) => {
    if (!speak || !('speechSynthesis' in window)) return
    speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(plain(text).slice(0, 900))
    u.lang = 'en-IN'
    u.rate = 1.04
    const v = speechSynthesis.getVoices().find((x) => x.lang === 'en-IN') ?? speechSynthesis.getVoices().find((x) => x.lang.startsWith('en'))
    if (v) u.voice = v
    u.onstart = () => setSpeaking(true)
    u.onend = () => { setSpeaking(false); if (handsFree) startListening() }
    speechSynthesis.speak(u)
  }

  const ask = useMutation({
    mutationFn: (question: string) => api('/api/agent/ask', { method: 'POST', json: { question, account_id: params.id ? Number(params.id) : null } }),
    onSuccess: (r) => {
      setMsgs((m) => [...m, { role: 'ai', text: r.answer, steps: r.steps, citations: r.citations, mode: r.mode, ms: r.latency_ms }])
      if (voiceTurn.current) say(r.answer)
    },
    onError: (e: any) => setMsgs((m) => [...m, { role: 'ai', text: `Sorry — ${e.message}` }]),
  })

  const send = (text: string, viaVoice = false) => {
    if (!text.trim() || ask.isPending) return
    voiceTurn.current = viaVoice
    setMsgs((m) => [...m, { role: 'user', text, voice: viaVoice }])
    setQ('')
    ask.mutate(text)
  }

  const startListening = () => {
    if (!SR) return
    speechSynthesis?.cancel()
    const r = new SR()
    r.lang = 'en-IN'
    r.interimResults = true
    r.continuous = false
    let finalText = ''
    r.onresult = (e: any) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript
        if (e.results[i].isFinal) finalText += t
        else interim += t
      }
      setQ(finalText || interim)
    }
    r.onend = () => { setListening(false); if (finalText.trim()) send(finalText.trim(), true) }
    r.onerror = () => setListening(false)
    rec.current = r
    setListening(true)
    r.start()
  }
  const stopListening = () => { rec.current?.stop(); setListening(false) }

  useEffect(() => end.current?.scrollIntoView({ behavior: 'smooth' }), [msgs, ask.isPending])
  useEffect(() => { if (!open) { rec.current?.stop(); if ('speechSynthesis' in window) speechSynthesis.cancel() } }, [open])

  const orbState = listening ? 'listening' : ask.isPending ? 'thinking' : speaking ? 'speaking' : 'idle'

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 border-l border-white/70 bg-pearl/95 p-0 backdrop-blur-xl sm:max-w-lg">
        <SheetHeader className="border-b border-ink/5 px-5 py-4">
          <SheetTitle className="flex items-center gap-2"><Bot className="size-5" /> Constella Copilot
            {info.data && <span className="rounded-full bg-gold/10 px-2 py-0.5 text-[11px] font-medium capitalize text-gold">{info.data.role} mode</span>}
          </SheetTitle>
          <SheetDescription className="text-xs">
            LangGraph agent · retrieve → plan → act → guard ·{' '}
            {info.data ? (info.data.mode === 'llm' ? `Claude (${info.data.model})` : 'offline planner (set ANTHROPIC_API_KEY for Claude)') : '…'}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {!msgs.length && (
            <div className="flex flex-col items-center text-center">
              <VoiceOrb state={orbState} />
              <p className="mt-3 max-w-xs text-sm text-ink-soft">{info.data?.greeting ?? 'Ask anything about your partners and pipeline.'}</p>
              <div className="mt-5 flex w-full flex-col gap-2">
                {(info.data?.suggestions ?? []).map((s: string) => (
                  <button key={s} onClick={() => send(s)} className="pane lift flex items-center gap-2 !rounded-xl px-3 py-2.5 text-left text-sm">
                    <Sparkles className="size-4 shrink-0 text-gold" />{s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {msgs.map((m, i) => m.role === 'user' ? (
            <div key={i} className="ml-auto flex max-w-[85%] items-start gap-2 rounded-2xl rounded-br-md bg-ink px-4 py-2.5 text-sm text-white">
              {m.voice && <Mic className="mt-0.5 size-3.5 shrink-0 opacity-70" />}{m.text}
            </div>
          ) : (
            <div key={i} className="pane max-w-[95%] !rounded-2xl !rounded-bl-md p-4">
              <Rich text={m.text} />
              <div className="mt-2 flex items-center gap-2">
                <button onClick={() => say(m.text)} className="flex items-center gap-1 rounded-full bg-ink/5 px-2 py-0.5 text-[11px] text-ink-soft hover:bg-ink/10" aria-label="Read aloud">
                  <Volume2 className="size-3" /> Listen
                </button>
                {!!m.steps?.length && (
                  <details className="text-xs text-ink-soft">
                    <summary className="flex cursor-pointer items-center gap-1.5"><Wrench className="size-3.5" /> {m.steps.filter((s) => s.tool).length} tool calls · {m.mode} · {m.ms} ms</summary>
                    <ol className="mt-2 space-y-1 font-mono text-[11px]">
                      {m.steps.map((s, j) => <li key={j}>{s.tool ? `→ ${s.tool}(${JSON.stringify(s.input)}) ${s.ms}ms` : `· ${s.node}: ${s.detail ?? ''}`}</li>)}
                    </ol>
                  </details>
                )}
              </div>
              {!!m.citations?.length && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {m.citations.slice(0, 3).map((c, j) => <span key={j} className="rounded-full bg-ink/5 px-2 py-0.5 text-[10px] text-ink-soft" title={c.text}>Source: {c.title}</span>)}
                </div>
              )}
            </div>
          ))}
          {ask.isPending && <div className="flex items-center gap-2 text-sm text-ink-soft"><Loader2 className="size-4 animate-spin" /> Retrieving playbooks, calling tools…</div>}
          {msgs.length > 0 && (listening || speaking) && <div className="flex justify-center"><VoiceOrb state={orbState} /></div>}
          <div ref={end} />
        </div>

        <div className="border-t border-ink/5 p-3">
          <div className="mb-2 flex items-center justify-between px-1 text-[11px] text-ink-soft">
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={handsFree} onChange={(e) => setHandsFree(e.target.checked)} className="accent-[#a16207]" /> Hands-free conversation</label>
            <button onClick={() => { setSpeak((v) => !v); speechSynthesis?.cancel() }} className="flex items-center gap-1" aria-label="Toggle spoken replies">
              {speak ? <Volume2 className="size-3.5" /> : <VolumeX className="size-3.5" />} {speak ? 'Voice replies on' : 'Voice replies off'}
            </button>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); send(q) }} className="flex items-center gap-2">
            {SR ? (
              <button type="button" onClick={() => (listening ? stopListening() : startListening())} aria-label={listening ? 'Stop listening' : 'Speak'}
                className={`grid size-11 shrink-0 place-items-center rounded-full transition-colors ${listening ? 'animate-pulse bg-gold-bright text-ink' : 'bg-white text-ink ring-1 ring-ink/10'}`}>
                {listening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
              </button>
            ) : <span className="text-[10px] text-ink-soft">voice not supported in this browser</span>}
            <label htmlFor="copilot-q" className="sr-only">Ask the copilot</label>
            <input id="copilot-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder={listening ? 'Listening…' : 'Ask about a partner, a deal, your day…'}
              className="h-11 flex-1 rounded-full border border-ink/10 bg-white px-4 text-sm outline-none focus:border-gold" />
            <button type="submit" disabled={ask.isPending} aria-label="Send" className="grid size-11 place-items-center rounded-full bg-ink text-white disabled:opacity-50"><Send className="size-4" /></button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  )
}
