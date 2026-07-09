// ── Shared ────────────────────────────────────────────────────────────────────
export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  pages: number
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export interface MeResponse {
  id: number
  full_name: string
  email: string
  role: string
  is_active: boolean
  email_alerts_enabled: boolean
}

// ── Roles ─────────────────────────────────────────────────────────────────────
export interface Role {
  id: number
  name: string
  description: string | null
  is_active: boolean
  created_at: string
}

// ── Users ─────────────────────────────────────────────────────────────────────
export interface UserRole {
  id: number
  name: string
}

export interface User {
  id: number
  full_name: string
  email: string
  role: UserRole
  is_active: boolean
  email_alerts_enabled: boolean
  last_login_at: string | null
  created_at: string
  updated_at: string
}

export interface UserCreate {
  full_name: string
  email: string
  password: string
  role_id: number
  is_active?: boolean
}

export interface UserUpdate {
  full_name?: string
  email?: string
  role_id?: number
  is_active?: boolean
}

// ── Audit ─────────────────────────────────────────────────────────────────────
export interface AuditLog {
  id: number
  user_id: number | null
  user_email: string | null
  action: string
  entity_type: string | null
  entity_id: number | null
  old_value_json: Record<string, unknown> | null
  new_value_json: Record<string, unknown> | null
  ip_address: string | null
  created_at: string
}
