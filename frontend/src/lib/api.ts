import { useAuth } from './auth'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export async function api<T = any>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const token = useAuth.getState().token
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (init.json !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(path, {
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
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  let ws: WebSocket | null = null
  let closed = false
  const open = () => {
    ws = new WebSocket(`${proto}://${location.host}/api/ws/live`)
    ws.onmessage = (m) => {
      try {
        onEvent(JSON.parse(m.data))
      } catch {
        /* ignore */
      }
    }
    ws.onclose = () => {
      if (!closed) setTimeout(open, 3000)
    }
  }
  open()
  return () => {
    closed = true
    ws?.close()
  }
}
