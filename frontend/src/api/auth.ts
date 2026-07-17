import { apiRequest, setToken } from './client'

interface TokenResponse {
  access_token: string
}

export async function signup(email: string, password: string): Promise<void> {
  const data = await apiRequest<TokenResponse>('/auth/signup', {
    method: 'POST',
    body: { email, password },
  })
  setToken(data.access_token)
}

export async function login(email: string, password: string): Promise<void> {
  const data = await apiRequest<TokenResponse>('/auth/login', {
    method: 'POST',
    body: { email, password },
  })
  setToken(data.access_token)
}
