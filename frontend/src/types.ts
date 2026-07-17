export interface Space {
  id: string
  name: string
  created_at: string
}

export interface Document {
  id: string
  filename: string
  file_type: string
  status: 'processing' | 'ready' | 'failed'
  summary: string | null
  error_message: string | null
  uploaded_at: string
}

export interface SourceSnippet {
  document_id: string
  filename: string
  snippet: string
}

export interface AskResponse {
  answer: string
  sources: SourceSnippet[]
}
