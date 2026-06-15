// User and Auth types
export interface User {
  id: string;
  email: string;
  name?: string;
  role: 'admin' | 'operator' | 'viewer';
  devices: string[]; // device IDs they have access to
  is_active: boolean;
  created_at?: string;
}

export interface AuthToken {
  access_token: string;
  token_type: string;
  expires_in?: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthContext {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  error?: string;
}

export type UserRole = 'admin' | 'operator' | 'viewer';
