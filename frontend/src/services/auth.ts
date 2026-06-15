import api from './api'
import type { AuthResponse } from '@/types/auth'

export async function loginUser(username: string, password: string): Promise<AuthResponse> {
  const formData = new URLSearchParams()
  formData.append('username', username)
  formData.append('password', password)

  const { data } = await api.post<AuthResponse>('/auth/token', formData, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })
  return data
}

export async function logoutUser(): Promise<void> {
  await api.post('/auth/logout')
}
