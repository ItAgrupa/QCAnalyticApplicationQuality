// ── Shared ────────────────────────────────────────────────────────────────────
export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  pages: number
}

// ── Notification preferences ──────────────────────────────────────────────────
export interface NotificationPrefs {
  notify_on_reject: boolean
  notify_on_hold: boolean
  notify_all_passed: boolean
  notify_analysis_done: boolean
  notify_import_ready: boolean
  pass_rate_threshold: number | null
  digest_enabled: boolean
  digest_time: string
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  notify_on_reject: true,
  notify_on_hold: true,
  notify_all_passed: false,
  notify_analysis_done: false,
  notify_import_ready: false,
  pass_rate_threshold: null,
  digest_enabled: false,
  digest_time: '08:00',
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export interface MeResponse {
  id: number
  full_name: string
  email: string
  role: string
  is_active: boolean
  email_alerts_enabled: boolean
  notification_prefs?: NotificationPrefs
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
  notification_prefs?: NotificationPrefs
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
