import axiosClient from './axiosClient'

export interface LoginRequest {
  username: string
  password: string
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
}

export interface MeResponse {
  id: number
  full_name: string
  email: string
  role: string
  is_active: boolean
  email_alerts_enabled: boolean
}

export async function login(data: LoginRequest): Promise<TokenResponse> {
  const params = new URLSearchParams()
  params.append('username', data.username)
  params.append('password', data.password)
  const res = await axiosClient.post<TokenResponse>('/auth/login', params, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })
  return res.data
}

export async function getMe(): Promise<MeResponse> {
  const res = await axiosClient.get<MeResponse>('/auth/me')
  return res.data
}
