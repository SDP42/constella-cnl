import { toast } from 'sonner'
import { useAuth } from './auth'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

/** Same-origin by default (Vite proxy locally, Vercel rewrite in production). Set VITE_API_URL to call the API directly. */
export const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

/** Free-tier hosts sleep when idle: ping as soon as the app opens so the API is awake before the first real call. */
export function warmUp() {
  fetch(`${API_BASE}/api/health`, { cache: 'no-store' }).catch(() => {})
}

let wakeNoticeShown = false
function slowNotice() {
  return setTimeout(() => {
    if (wakeNoticeShown) return
    wakeNoticeShown = true
    toast.loading('Waking the free-tier server… the first load can take up to a minute', { id: 'wake', duration: 60_000 })
  }, 2500)
}

export async function api<T = any>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const t = slowNotice()
  try {
    // While Render wakes from sleep the proxy answers 502/503/504 (or the fetch fails) in under a second, before the
    // request reaches the app, so retrying is safe. Keep trying for ~90 s with the wake notice up.
    const until = Date.now() + 90_000
    for (let wait = 1500; ; wait = Math.min(wait * 1.5, 6000)) {
      try {
        return await apiInner<T>(path, init)
      } catch (e) {
        const waking = !(e instanceof ApiError) || [502, 503, 504].includes(e.status)
        if (!waking || Date.now() + wait > until) throw e
        if (!wakeNoticeShown) {
          wakeNoticeShown = true
          toast.loading('Waking the free-tier server… the first load can take up to a minute', { id: 'wake', duration: 90_000 })
        }
        await new Promise((r) => setTimeout(r, wait))
      }
    }
  } finally {
    clearTimeout(t)
    if (wakeNoticeShown) toast.dismiss('wake')
  }
}

async function apiInner<T = any>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const token = useAuth.getState().token
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (init.json !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(path.startsWith('/') ? API_BASE + path : path, {
    ...init,
    headers: { ...headers, ...(init.headers as Record<string, string>) },
    body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
  })
  if (res.status === 401) {
    useAuth.getState().logout()
  }
  if (!res.ok) {
    let msg = res.statusText
    try {
      const j = await res.json()
      msg = typeof j.detail === 'string' ? j.detail : JSON.stringify(j.detail)
    } catch {
      /* not json */
    }
    throw new ApiError(res.status, msg)
  }
  return res.json() as Promise<T>
}

export async function login(persona: string) {
  const r = await api<{ token: string; user: any }>('/api/auth/login', { method: 'POST', json: { persona } })
  useAuth.getState().setSession(r.token, r.user)
  return r.user
}

export function liveSocket(onEvent: (e: any) => void) {
  // Vercel rewrites can't proxy WebSockets, so production points VITE_WS_URL at the Render host (wss://…/api/ws/live).
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  const url = import.meta.env.VITE_WS_URL || (API_BASE ? API_BASE.replace(/^http/, 'ws') + '/api/ws/live' : `${proto}://${location.host}/api/ws/live`)
  let ws: WebSocket | null = null
  let closed = false
  let tries = 0
  const open = () => {
    ws = new WebSocket(url)
    ws.onopen = () => { tries = 0 }
    ws.onmessage = (m) => {
      try {
        onEvent(JSON.parse(m.data))
      } catch {
        /* ignore */
      }
    }
    ws.onclose = () => {
      // back off (free-tier hosts sleep); live feed is optional, the app works without it
      if (!closed && tries < 8) setTimeout(open, Math.min(60000, 3000 * 2 ** tries++))
    }
  }
  open()
  return () => {
    closed = true
    ws?.close()
  }
}
