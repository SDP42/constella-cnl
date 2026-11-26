import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Activity, BarChart3, Bot, Boxes, Building2, Clock, Command as CmdIcon, Database, FlaskConical, Gauge, Inbox, LogOut,
  Network, Search, ShieldCheck, Sparkles, Tags, Workflow,
} from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { GlyphRow } from '@/components/Glyph'
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { api } from '@/lib/api'
import { useAuth, type Role } from '@/lib/auth'
import { Copilot } from './Copilot'

type NavItem = { to: string; label: string; icon: ReactNode; roles: Role[] }
const NAV: { group: string; items: NavItem[] }[] = [
  { group: 'Work', items: [
    { to: '/app/inbox', label: 'Mission inbox', icon: <Inbox className="size-4" />, roles: ['rep', 'head', 'architect'] },
    { to: '/app/command', label: 'Command center', icon: <Gauge className="size-4" />, roles: ['head'] },
    { to: '/app/accounts', label: 'Account twins', icon: <Building2 className="size-4" />, roles: ['rep', 'head', 'architect', 'steward'] },
    { to: '/app/solutions', label: 'Solution composer', icon: <Boxes className="size-4" />, roles: ['architect', 'head', 'rep'] },
    { to: '/app/partner', label: 'My proposals', icon: <Sparkles className="size-4" />, roles: ['partner'] },
  ] },
  { group: 'Intelligence', items: [
    { to: '/app/insights', label: 'BI & forecast', icon: <BarChart3 className="size-4" />, roles: ['head', 'architect', 'steward'] },
    { to: '/app/brands', label: 'Brand portal', icon: <Tags className="size-4" />, roles: ['head', 'architect', 'steward', 'rep'] },
    { to: '/app/graph', label: 'Product universe', icon: <Network className="size-4" />, roles: ['rep', 'head', 'architect', 'steward'] },
    { to: '/app/model', label: 'Model lab', icon: <FlaskConical className="size-4" />, roles: ['rep', 'head', 'architect', 'steward'] },
    { to: '/app/pilot', label: 'Pilot lab', icon: <Activity className="size-4" />, roles: ['head'] },
  ] },
  { group: 'Operations', items: [
    { to: '/app/automation', label: 'Automation', icon: <Workflow className="size-4" />, roles: ['head', 'rep', 'architect', 'steward'] },
    { to: '/app/data', label: 'Data unifier', icon: <Database className="size-4" />, roles: ['steward', 'head'] },
    { to: '/app/security', label: 'Security & audit', icon: <ShieldCheck className="size-4" />, roles: ['head'] },
  ] },
]

export function AppShell() {
  const user = useAuth((s) => s.user)!
  const logout = useAuth((s) => s.logout)
  const nav = useNavigate()
  const qc = useQueryClient()
  const [cmd, setCmd] = useState(false)
  const [copilot, setCopilot] = useState(false)
  const meta = useQuery({ queryKey: ['meta'], queryFn: () => api('/api/meta'), refetchInterval: 15_000 })
  const accounts = useQuery({ queryKey: ['acc-search'], queryFn: () => api('/api/accounts?limit=600&sort=name'), enabled: cmd && user.role !== 'partner' })

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setCmd((v) => !v) }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') { e.preventDefault(); setCopilot((v) => !v) }
    }
    addEventListener('keydown', k)
    return () => removeEventListener('keydown', k)
  }, [])

  const advance = async (hours: number) => {
    const r = await api('/api/clock/advance', { method: 'POST', json: { hours } })
    toast.success(`Clock +${hours}h — ${r.escalations.length} SLA escalations processed`)
    qc.invalidateQueries()
  }
  const items = NAV.map((g) => ({ ...g, items: g.items.filter((i) => i.roles.includes(user.role)) })).filter((g) => g.items.length)
  const now = meta.data?.now ? new Date(meta.data.now) : null

  return (
    <div className="flex min-h-dvh bg-pearl">
      {/* sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col bg-[#1c1917] text-white md:flex">
        <button onClick={() => nav('/')} className="flex items-center gap-2.5 px-5 pb-4 pt-5 text-left">
          <GlyphRow size={8} gap={3} />
          <span className="text-[17px] font-semibold tracking-tight">Constella</span>
        </button>
        <div className="mx-3 mb-3 rounded-2xl border border-white/10 bg-white/5 p-3">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-full bg-gradient-to-br from-[#f5b700] to-[#c2553d] text-sm font-semibold">
              {user.name.split(' ').map((w) => w[0]).join('')}
            </span>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{user.name}</div>
              <div className="truncate text-[11px] text-white/55">{user.persona.title}</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4" aria-label="Workspace">
          {items.map((g) => (
            <div key={g.group}>
              <p className="px-3 pb-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-white/35">{g.group}</p>
              {g.items.map((i) => (
                <NavLink key={i.to} to={i.to}
                  className={({ isActive }) => `group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors ${isActive ? 'bg-white/10 text-white' : 'text-white/65 hover:bg-white/5 hover:text-white'}`}>
                  {({ isActive }) => (<>
                    {isActive && <span className="absolute left-0 top-2 h-[calc(100%-16px)] w-[3px] rounded-full bg-gradient-to-b from-[#f5b700] to-[#c2553d]" />}
                    {i.icon}{i.label}
                  </>)}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <button onClick={() => { logout(); nav('/') }} className="m-3 flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-white/60 hover:bg-white/5 hover:text-white">
          <LogOut className="size-4" /> Switch seat
        </button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* top bar */}
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-white/70 bg-pearl/80 px-5 py-3 backdrop-blur-xl md:px-8">
          <button onClick={() => setCmd(true)} className="pane flex w-full max-w-md items-center gap-2 !rounded-full px-4 py-2 text-sm text-ink-soft">
            <Search className="size-4" /> Search partners, jump to a screen…
            <kbd className="ml-auto flex items-center gap-0.5 rounded-md bg-ink/5 px-1.5 py-0.5 font-mono text-[10px]"><CmdIcon className="size-3" />K</kbd>
          </button>
          <div className="ml-auto flex items-center gap-2">
            {now && (
              <span className="hidden items-center gap-1.5 rounded-full bg-white/80 px-3 py-1.5 text-xs text-ink-soft lg:flex" title="Demo clock (drives SLAs)">
                <Clock className="size-3.5" />{now.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
              </span>
            )}
            {user.role === 'head' && (
              <button onClick={() => advance(24)} className="rounded-full bg-white/80 px-3 py-1.5 text-xs font-medium hover:bg-white" title="Advance the demo clock 24h and run the SLA sweep">
                +24h ⏩
              </button>
            )}
            <button onClick={() => setCopilot(true)}
              className="flex items-center gap-2 rounded-full bg-[#1c1917] px-4 py-2 text-sm font-medium text-white shadow-[0_8px_24px_-10px_rgba(11,14,34,.8)] transition-transform hover:scale-[1.03]">
              <Bot className="size-4" /> Copilot <kbd className="hidden rounded bg-white/15 px-1 font-mono text-[10px] sm:inline">⌘J</kbd>
            </button>
          </div>
        </header>
        <main className="min-w-0 flex-1"><Outlet /></main>
      </div>

      <CommandDialog open={cmd} onOpenChange={setCmd} title="Search" description="Jump to a screen or a partner">
        <CommandInput placeholder="Type a partner, city or screen…" />
        <CommandList>
          <CommandEmpty>No match.</CommandEmpty>
          <CommandGroup heading="Screens">
            {items.flatMap((g) => g.items).map((i) => (
              <CommandItem key={i.to} onSelect={() => { setCmd(false); nav(i.to) }}>{i.icon}{i.label}</CommandItem>
            ))}
          </CommandGroup>
          {accounts.data && (
            <CommandGroup heading="Partners">
              {accounts.data.items.slice(0, 600).map((a: any) => (
                <CommandItem key={a.id} value={`${a.name} ${a.city}`} onSelect={() => { setCmd(false); nav(`/app/accounts/${a.id}`) }}>
                  <Building2 className="size-4" />{a.name}<span className="ml-auto text-xs text-ink-soft">{a.city}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
      <Copilot open={copilot} onOpenChange={setCopilot} />
    </div>
  )
}
