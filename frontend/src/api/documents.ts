import { getToken } from './client'
import type { Document } from '../types'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export async function listDocuments(spaceId: string): Promise<Document[]> {
  const response = await fetch(`${API_BASE_URL}/spaces/${spaceId}/documents`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  })
  if (!response.ok) {
    throw new Error('Failed to load documents')
  }
  return response.json()
}

export async function uploadDocument(spaceId: string, file: File): Promise<Document> {
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch(`${API_BASE_URL}/spaces/${spaceId}/documents`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getToken()}` },
    body: formData,
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Upload failed' }))
    throw new Error(error.detail || 'Upload failed')
  }
  return response.json()
}
