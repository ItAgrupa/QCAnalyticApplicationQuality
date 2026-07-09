/**
 * Simple auth state using localStorage + a custom hook.
 * Phase 2 will wire this up to real JWT refresh logic.
 */
import { useState, useEffect } from 'react'

interface AuthState {
  isAuthenticated: boolean
  accessToken: string | null
  user: { id: number; full_name: string; email: string; role: string; email_alerts_enabled: boolean } | null
}

type AuthStore = AuthState & {
  login: (accessToken: string, refreshToken: string, user: AuthState['user']) => void
  logout: () => void
  setUser: (user: AuthState['user']) => void
}

// Simple singleton state — replace with Zustand or Context in Phase 2
let _state: AuthState = {
  isAuthenticated: !!localStorage.getItem('access_token'),
  accessToken: localStorage.getItem('access_token'),
  user: (() => {
    try {
      const raw = localStorage.getItem('user')
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })(),
}

const subscribers = new Set<() => void>()

function notify() {
  subscribers.forEach((cb) => cb())
}

export function useAuthStore<T>(selector: (s: AuthStore) => T): T {
  const [, forceUpdate] = useState(0)

  useEffect(() => {
    const cb = () => forceUpdate((n) => n + 1)
    subscribers.add(cb)
    return () => { subscribers.delete(cb) }
  }, [])

  const store: AuthStore = {
    ..._state,
    login(accessToken, refreshToken, user) {
      localStorage.setItem('access_token', accessToken)
      localStorage.setItem('refresh_token', refreshToken)
      if (user) localStorage.setItem('user', JSON.stringify(user))
      _state = { isAuthenticated: true, accessToken, user }
      notify()
    },
    logout() {
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      localStorage.removeItem('user')
      _state = { isAuthenticated: false, accessToken: null, user: null }
      notify()
    },
    setUser(user) {
      if (user) localStorage.setItem('user', JSON.stringify(user))
      _state = { ..._state, user }
      notify()
    },
  }

  return selector(store)
}
