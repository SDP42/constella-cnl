import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export type Role = 'rep' | 'head' | 'architect' | 'steward' | 'partner'
export interface Persona {
  key: string
  role: Role
  title: string
  city: string
  goal: string
  pain: string
}
export interface User {
  sub: string
  name: string
  role: Role
  rep_id: number | null
  region: string | null
  account_id?: number
  persona: Persona
}

interface AuthState {
  token: string | null
  user: User | null
  setSession: (token: string, user: User) => void
  logout: () => void
}

// sessionStorage: the token dies with the tab (no long-lived token at rest in the browser)
export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setSession: (token, user) => set({ token, user }),
      logout: () => set({ token: null, user: null }),
    }),
    { name: 'constella-session', storage: createJSONStorage(() => sessionStorage) },
  ),
)

export const homeFor = (role: Role) =>
  ({ rep: '/app/inbox', head: '/app/command', architect: '/app/solutions', steward: '/app/data', partner: '/app/partner' })[role]
