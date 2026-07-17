import { apiRequest } from './client'
import type { AskResponse } from '../types'

export function askQuestion(spaceId: string, question: string): Promise<AskResponse> {
  return apiRequest<AskResponse>(`/spaces/${spaceId}/ask`, {
    method: 'POST',
    body: { question },
  })
}
