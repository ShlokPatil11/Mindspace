import { ChangeEvent, FormEvent, useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { listDocuments, uploadDocument } from '../api/documents'
import { askQuestion } from '../api/qa'
import type { AskResponse, Document } from '../types'

export function SpaceDetailPage() {
  const { spaceId } = useParams<{ spaceId: string }>()
  const [documents, setDocuments] = useState<Document[]>([])
  const [documentsError, setDocumentsError] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState<AskResponse | null>(null)
  const [asking, setAsking] = useState(false)
  const [askError, setAskError] = useState<string | null>(null)

  const refreshDocuments = useCallback(async () => {
    if (!spaceId) return
    try {
      setDocuments(await listDocuments(spaceId))
      setDocumentsError(null)
    } catch (err) {
      setDocumentsError(err instanceof Error ? err.message : 'Failed to load documents')
    }
  }, [spaceId])

  useEffect(() => {
    refreshDocuments()
  }, [refreshDocuments])

  useEffect(() => {
    const hasProcessing = documents.some((d) => d.status === 'processing')
    if (!hasProcessing) return
    const interval = setInterval(refreshDocuments, 3000)
    return () => clearInterval(interval)
  }, [documents, refreshDocuments])

  async function handleUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !spaceId) return
    setUploadError(null)
    try {
      await uploadDocument(spaceId, file)
      refreshDocuments()
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
    }
    e.target.value = ''
  }

  async function handleAsk(e: FormEvent) {
    e.preventDefault()
    if (!question.trim() || !spaceId) return
    setAsking(true)
    setAskError(null)
    try {
      setAnswer(await askQuestion(spaceId, question.trim()))
    } catch (err) {
      setAskError(err instanceof Error ? err.message : 'Failed to get an answer')
    } finally {
      setAsking(false)
    }
  }

  return (
    <div>
      <h1>Documents</h1>
      {documentsError && <p role="alert">{documentsError}</p>}
      {uploadError && <p role="alert">{uploadError}</p>}
      <input type="file" accept=".pdf,.docx,.txt,.md" onChange={handleUpload} />
      <ul>
        {documents.map((doc) => (
          <li key={doc.id}>
            <strong>{doc.filename}</strong> — {doc.status}
            {doc.status === 'ready' && doc.summary && <p>{doc.summary}</p>}
            {doc.status === 'failed' && <p role="alert">{doc.error_message}</p>}
          </li>
        ))}
      </ul>

      <h1>Ask a question</h1>
      <form onSubmit={handleAsk}>
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask about these documents..."
        />
        <button type="submit" disabled={asking}>
          {asking ? 'Asking...' : 'Ask'}
        </button>
      </form>
      {askError && <p role="alert">{askError}</p>}
      {answer && (
        <div>
          <p>{answer.answer}</p>
          <ul>
            {answer.sources.map((s, i) => (
              <li key={i}>
                <em>{s.filename}</em>: {s.snippet}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
