import { ChangeEvent, KeyboardEvent, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { listDocuments, uploadDocument } from '../api/documents'
import { askQuestion } from '../api/qa'
import { LiquidGlass } from '../components/LiquidGlass'
import type { AskResponse, Document } from '../types'

interface TextMessage {
  id: string
  kind: 'text'
  role: 'user' | 'ai'
  text: string
  sources?: AskResponse['sources']
  timestamp: Date
  error?: boolean
}

interface UploadMessage {
  id: string
  kind: 'upload'
  documentId: string
  filename: string
  status: 'uploading' | 'processing' | 'ready' | 'failed'
  summary?: string | null
  errorMessage?: string | null
  timestamp: Date
}

type ChatMessage = TextMessage | UploadMessage

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

function formatTime(d: Date) {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function SpaceDetailPage() {
  const { spaceId } = useParams<{ spaceId: string }>()

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [question, setQuestion] = useState('')
  const [asking, setAsking] = useState(false)
  const [readyDocCount, setReadyDocCount] = useState(0)

  const chatEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!spaceId) return
    listDocuments(spaceId)
      .then(docs => setReadyDocCount(docs.filter(d => d.status === 'ready').length))
      .catch(() => {})
  }, [spaceId])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, asking])

  function autoResize() {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }

  function updateUploadMessage(id: string, patch: Partial<UploadMessage>) {
    setMessages(prev => prev.map(m => (m.kind === 'upload' && m.id === id ? { ...m, ...patch } : m)))
  }

  function pollUntilDone(spaceIdArg: string, messageId: string, documentId: string) {
    const iv = setInterval(async () => {
      try {
        const docs = await listDocuments(spaceIdArg)
        const doc = docs.find(d => d.id === documentId)
        if (!doc || doc.status === 'processing') return
        clearInterval(iv)
        updateUploadMessage(messageId, {
          status: doc.status,
          summary: doc.summary,
          errorMessage: doc.error_message,
        })
        if (doc.status === 'ready') setReadyDocCount(c => c + 1)
      } catch {
        clearInterval(iv)
      }
    }, 3000)
  }

  async function handleUpload(file: File) {
    if (!spaceId) return
    const messageId = uid()
    const uploadMsg: UploadMessage = {
      id: messageId,
      kind: 'upload',
      documentId: '',
      filename: file.name,
      status: 'uploading',
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, uploadMsg])

    try {
      const doc: Document = await uploadDocument(spaceId, file)
      updateUploadMessage(messageId, { documentId: doc.id, status: doc.status })
      if (doc.status === 'processing') pollUntilDone(spaceId, messageId, doc.id)
    } catch (err) {
      updateUploadMessage(messageId, {
        status: 'failed',
        errorMessage: err instanceof Error ? err.message : 'Upload failed',
      })
    }
  }

  function handleFileInput(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleUpload(file)
    e.target.value = ''
  }

  async function handleAsk() {
    const q = question.trim()
    if (!q || !spaceId || asking) return

    const userMsg: TextMessage = { id: uid(), kind: 'text', role: 'user', text: q, timestamp: new Date() }
    setMessages(prev => [...prev, userMsg])
    setQuestion('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    setAsking(true)

    try {
      const res = await askQuestion(spaceId, q)
      const aiMsg: TextMessage = {
        id: uid(),
        kind: 'text',
        role: 'ai',
        text: res.answer,
        sources: res.sources,
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, aiMsg])
    } catch (err) {
      const errMsg: TextMessage = {
        id: uid(),
        kind: 'text',
        role: 'ai',
        text: err instanceof Error ? err.message : 'Failed to get an answer. Please try again.',
        timestamp: new Date(),
        error: true,
      }
      setMessages(prev => [...prev, errMsg])
    } finally {
      setAsking(false)
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleAsk()
    }
  }

  return (
    <div className="chat-panel">
      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="chat-empty">
            <p className="chat-empty-text">Ask anything about your documents</p>
            <p className="chat-empty-hint">
              {readyDocCount > 0
                ? `${readyDocCount} document${readyDocCount !== 1 ? 's' : ''} ready · Ask a question below`
                : 'Attach a document below to get started'}
            </p>
          </div>
        ) : (
          messages.map(msg => {
            if (msg.kind === 'upload') {
              return (
                <div key={msg.id} className="message-row ai">
                  <div className="message-content">
                    <div className="message-bubble upload-bubble">
                      <span className={`status-dot ${msg.status}`} />
                      <span className="upload-filename">📎 {msg.filename}</span>
                      <span className="upload-status-text">
                        {msg.status === 'uploading' && 'Uploading…'}
                        {msg.status === 'processing' && 'Processing…'}
                        {msg.status === 'ready' && 'Ready'}
                        {msg.status === 'failed' && (msg.errorMessage || 'Failed')}
                      </span>
                    </div>
                    {msg.status === 'ready' && msg.summary && (
                      <div className="message-bubble ai-bubble">{msg.summary}</div>
                    )}
                    <span className="message-time">{formatTime(msg.timestamp)}</span>
                  </div>
                </div>
              )
            }

            return (
              <div key={msg.id} className={`message-row ${msg.role}`}>
                <div className="message-content">
                  <div
                    className={`message-bubble ${msg.role === 'ai' ? 'ai-bubble' : 'user-bubble'}`}
                    style={msg.error ? { borderColor: 'var(--danger)', background: 'var(--danger-subtle)' } : undefined}
                  >
                    {msg.error && <span style={{ color: 'var(--danger)' }}>⚠️ </span>}
                    {msg.text}
                  </div>
                  {msg.sources && msg.sources.length > 0 && (
                    <LiquidGlass className="sources-list">
                      {msg.sources.map((src, i) => (
                        <div key={i} className="source-chip">
                          <span className="source-chip-label">📄 {src.filename}</span>
                          <span>{src.snippet}</span>
                        </div>
                      ))}
                    </LiquidGlass>
                  )}
                  <span className="message-time">{formatTime(msg.timestamp)}</span>
                </div>
              </div>
            )
          })
        )}

        {asking && (
          <div className="message-row ai">
            <div className="message-content">
              <div className="message-bubble ai-bubble">
                <div className="typing-indicator">
                  <div className="typing-dot" />
                  <div className="typing-dot" />
                  <div className="typing-dot" />
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      <LiquidGlass className="chat-input-bar">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.txt,.md"
          onChange={handleFileInput}
          style={{ display: 'none' }}
        />
        <button
          type="button"
          className="attachment-btn"
          onClick={() => fileInputRef.current?.click()}
          title="Attach a document"
        >
          📎
        </button>
        <textarea
          ref={textareaRef}
          className="chat-textarea"
          placeholder="Ask Something"
          value={question}
          onChange={e => { setQuestion(e.target.value); autoResize() }}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={asking}
        />
        <button
          className="chat-send-btn"
          onClick={handleAsk}
          disabled={!question.trim() || asking}
          title="Send"
        >
          ➤
        </button>
      </LiquidGlass>
    </div>
  )
}
