import { apiRequest } from './client'
import type { Space } from '../types'

export function listSpaces(): Promise<Space[]> {
  return apiRequest<Space[]>('/spaces')
}

export function createSpace(name: string): Promise<Space> {
  return apiRequest<Space>('/spaces', { method: 'POST', body: { name } })
}

export function deleteSpace(id: string): Promise<void> {
  return apiRequest<void>(`/spaces/${id}`, { method: 'DELETE' })
}
