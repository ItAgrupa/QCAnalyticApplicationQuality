import { useState, useEffect } from 'react'
import type { Company } from '@/types'

interface CompanyState {
  currentCompany: Company | null
}

type CompanyStore = CompanyState & {
  setCompany: (company: Company) => void
  clearCompany: () => void
}

let _state: CompanyState = {
  currentCompany: (() => {
    try {
      const raw = localStorage.getItem('active_company')
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

export function useCompanyStore<T>(selector: (s: CompanyStore) => T): T {
  const [, forceUpdate] = useState(0)

  useEffect(() => {
    const cb = () => forceUpdate((n) => n + 1)
    subscribers.add(cb)
    return () => {
      subscribers.delete(cb)
    }
  }, [])

  const store: CompanyStore = {
    ..._state,
    setCompany(company: Company) {
      localStorage.setItem('active_company', JSON.stringify(company))
      _state = { currentCompany: company }
      notify()
    },
    clearCompany() {
      localStorage.removeItem('active_company')
      _state = { currentCompany: null }
      notify()
    },
  }

  return selector(store)
}
