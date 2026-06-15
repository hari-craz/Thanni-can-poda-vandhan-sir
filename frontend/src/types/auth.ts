export type UserRole = 'superadmin' | 'admin'

export interface AuthUser {
  email: string
  name: string
  role: UserRole
}

export interface LoginCredentials {
  username: string
  password: string
}

export interface AuthResponse {
  access_token: string
  token_type: string
  user: AuthUser
}
