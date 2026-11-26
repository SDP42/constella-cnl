import { useQuery, type UseQueryOptions } from '@tanstack/react-query'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { api } from '@/lib/api'
import { DIV_COLORS_MAP, KIND } from './theme'

export function useApi<T = any>(key: unknown[], path: string | null, opts: Partial<UseQueryOptions<T>> = {}) {
  return useQuery<T>({ queryKey: key, queryFn: () => api<T>(path!), enabled: !!path, ...opts })
}

export function Page({ title, kicker, actions, children }: { title: ReactNode; kicker?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[1400px] px-5 pb-16 pt-6 md:px-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          {kicker && <p className="label mb-2">{kicker}</p>}
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{title}</h1>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  )
}

export function Card({ title, sub, right, children, className = '', pad = true }: {
  title?: ReactNode; sub?: ReactNode; right?: ReactNode; children: ReactNode; className?: string; pad?: boolean
}) {
  return (
    <section className={`pane overflow-hidden ${className}`}>
      {(title || right) && (
        <header className="flex items-start justify-between gap-3 px-5 pb-1 pt-4">
          <div>
            {title && <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>}
            {sub && <p className="mt-0.5 text-xs text-ink-soft">{sub}</p>}
          </div>
          {right}
        </header>
      )}
      <div className={pad ? 'p-5 pt-3' : ''}>{children}</div>
    </section>
  )
}

export function Stat({ label, value, sub, tone, icon }: { label: string; value: ReactNode; sub?: ReactNode; tone?: string; icon?: ReactNode }) {
  return (
    <div className="pane relative overflow-hidden p-4">
      {tone && <span aria-hidden className="absolute -right-6 -top-6 size-20 rounded-full opacity-20 blur-2xl" style={{ background: tone }} />}
      <div className="flex items-center justify-between">
        <p className="label">{label}</p>
        {icon && <span className="text-ink-soft">{icon}</span>}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight num">{value}</div>
      {sub && <div className="mt-1 text-xs text-ink-soft">{sub}</div>}
    </div>
  )
}

export function KindPill({ kind }: { kind: string }) {
  const k = KIND[kind] ?? { label: kind, color: '#5b6275' }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{ background: `${k.color}18`, color: k.color }}>
      <span className="size-1.5 rounded-full" style={{ background: k.color }} />{k.label}
    </span>
  )
}

export function DivDot({ div, label = false }: { div: string; label?: boolean }) {
  const c = DIV_COLORS_MAP[div] ?? '#5b6275'
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-ink-soft">
      <span className="size-2 rounded-full" style={{ background: c, boxShadow: `0 0 0 2px ${c}22` }} />
      {label && div}
    </span>
  )
}

const STATUS_TONE: Record<string, string> = {
  assigned: '#3e5c76', accepted: '#6b4e71', contacted: '#0ea5e9', proposal: '#f59e0b', negotiation: '#ea580c',
  won: '#3f7d5c', lost: '#94a3b8', nurture: '#64748b', new: '#3e5c76',
}
export function StatusPill({ status }: { status: string }) {
  const c = STATUS_TONE[status] ?? '#5b6275'
  return <span className="rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize" style={{ borderColor: `${c}55`, color: c }}>{status}</span>
}

export function Bar({ value, color = '#3e5c76', max = 1 }: { value: number; color?: string; max?: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink/6">
      <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.min(100, (value / max) * 100)}%`, background: color }} />
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="grid place-items-center rounded-2xl border border-dashed border-ink/10 p-10 text-sm text-ink-soft">{children}</div>
}

export function Loading({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-busy>
      {Array.from({ length: rows }).map((_, i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-ink/5" />)}
    </div>
  )
}

/** "How this is calculated / why it matters" — every number on screen carries its reasoning. */
export function Reasoning({ how, why, source }: { how: ReactNode; why?: ReactNode; source?: ReactNode }) {
  return (
    <details className="group mt-4 rounded-xl border border-ink/5 bg-ink/[0.02] px-3 py-2 text-xs text-ink-soft open:bg-white/60">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 font-medium text-ink/70">
        <span className="grid size-4 place-items-center rounded-full bg-gold/15 text-[10px] text-gold">i</span>
        How this is calculated & why it matters
        <span className="ml-auto transition-transform group-open:rotate-180">⌄</span>
      </summary>
      <div className="mt-2 space-y-1.5 leading-relaxed">
        <p><b className="text-ink/80">How:</b> {how}</p>
        {why && <p><b className="text-ink/80">Why:</b> {why}</p>}
        {source && <p><b className="text-ink/80">Source:</b> {source}</p>}
      </div>
    </details>
  )
}

/** Horizontal scroller: snap points, faded edges, arrow buttons, and vertical wheel → sideways scroll. */
export function HScroll({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [edge, setEdge] = useState({ left: false, right: true })
  const update = () => {
    const el = ref.current
    if (!el) return
    setEdge({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 })
  }
  useEffect(() => {
    const el = ref.current
    if (!el) return
    update()
    const wheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return
      const atStart = el.scrollLeft <= 0 && e.deltaY < 0
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1 && e.deltaY > 0
      if (atStart || atEnd) return // let the page scroll when the row is exhausted
      e.preventDefault()
      e.stopPropagation()
      el.scrollBy({ left: e.deltaY, behavior: 'auto' })
    }
    el.addEventListener('wheel', wheel, { passive: false })
    addEventListener('resize', update)
    return () => { el.removeEventListener('wheel', wheel); removeEventListener('resize', update) }
  }, [])
  const go = (dir: number) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.8, behavior: 'smooth' })
  return (
    <div className={`relative min-w-0 ${className}`}>
      <div ref={ref} onScroll={update} data-lenis-prevent
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-2 [scrollbar-width:thin] [&>*]:snap-start">
        {children}
      </div>
      <div aria-hidden className={`pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-white to-transparent transition-opacity ${edge.left ? 'opacity-100' : 'opacity-0'}`} />
      <div aria-hidden className={`pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-white to-transparent transition-opacity ${edge.right ? 'opacity-100' : 'opacity-0'}`} />
      {edge.left && <button onClick={() => go(-1)} aria-label="Scroll left" className="absolute left-1 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-white text-ink shadow-md ring-1 ring-ink/10 hover:bg-pearl">‹</button>}
      {edge.right && <button onClick={() => go(1)} aria-label="Scroll right" className="absolute right-1 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-white text-ink shadow-md ring-1 ring-ink/10 hover:bg-pearl">›</button>}
    </div>
  )
}
