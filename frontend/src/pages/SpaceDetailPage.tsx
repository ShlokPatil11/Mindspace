import { ChangeEvent, KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { listDocuments, uploadDocument } from '../api/documents'
import { askQuestion } from '../api/qa'
import type { AskResponse, Document } from '../types'

/* ──────────────────────────────────────
   Types
────────────────────────────────────── */
interface ChatMessage {
  id: string
  role: 'user' | 'ai'
  text: string
  sources?: AskResponse['sources']
  timestamp: Date
  error?: boolean
}

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

function formatTime(d: Date) {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function docIcon(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase()
  if (ext === 'pdf') return { icon: '📄', cls: 'pdf' }
  if (ext === 'md') return { icon: '📝', cls: 'md' }
  if (ext === 'docx' || ext === 'doc') return { icon: '📃', cls: 'docx' }
  return { icon: '📋', cls: 'txt' }
}

/* ──────────────────────────────────────
   Component
────────────────────────────────────── */
export function SpaceDetailPage() {
  const { spaceId } = useParams<{ spaceId: string }>()

  /* Documents */
  const [documents, setDocuments] = useState<Document[]>([])
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  /* Chat */
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [question, setQuestion] = useState('')
  const [asking, setAsking] = useState(false)

  const chatEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  /* ── Fetch documents ── */
  const refreshDocuments = useCallback(async () => {
    if (!spaceId) return
    try {
      setDocuments(await listDocuments(spaceId))
    } catch {}
  }, [spaceId])

  useEffect(() => { refreshDocuments() }, [refreshDocuments])

  useEffect(() => {
    const hasProcessing = documents.some(d => d.status === 'processing')
    if (!hasProcessing) return
    const iv = setInterval(refreshDocuments, 3000)
    return () => clearInterval(iv)
  }, [documents, refreshDocuments])

  /* ── Scroll to bottom on new message ── */
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, asking])

  /* ── Auto-resize textarea ── */
  function autoResize() {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }

  /* ── Upload ── */
  async function handleUpload(file: File) {
    if (!spaceId) return
    setUploadError(null)
    setUploading(true)
    try {
      await uploadDocument(spaceId, file)
      refreshDocuments()
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  function handleFileInput(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleUpload(file)
    e.target.value = ''
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleUpload(file)
  }

  /* ── Ask ── */
  async function handleAsk() {
    const q = question.trim()
    if (!q || !spaceId || asking) return

    const userMsg: ChatMessage = { id: uid(), role: 'user', text: q, timestamp: new Date() }
    setMessages(prev => [...prev, userMsg])
    setQuestion('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    setAsking(true)

    try {
      const res = await askQuestion(spaceId, q)
      const aiMsg: ChatMessage = {
        id: uid(),
        role: 'ai',
        text: res.answer,
        sources: res.sources,
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, aiMsg])
    } catch (err) {
      const errMsg: ChatMessage = {
        id: uid(),
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

  const readyDocs = documents.filter(d => d.status === 'ready').length

  return (
    <div className="space-detail">
      {/* ── Documents Panel ── */}
      <aside className="docs-panel">
        <p className="panel-title">Documents</p>

        {/* Upload zone */}
        <div
          className={`upload-zone ${dragOver ? 'drag-over' : ''}`}
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <input type="file" accept=".pdf,.docx,.txt,.md" onChange={handleFileInput} />
          <span className="upload-zone-icon">{uploading ? '⏳' : '⬆️'}</span>
          <p className="upload-zone-text">{uploading ? 'Uploading…' : 'Drop a file or click to upload'}</p>
          <p className="upload-zone-hint">PDF, DOCX, TXT, MD</p>
        </div>

        {uploadError && (
          <div className="alert error">
            <span>⚠️</span> {uploadError}
          </div>
        )}

        {/* Doc list */}
        {documents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 13 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📂</div>
            No documents yet
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {documents.map(doc => {
              const { icon, cls } = docIcon(doc.filename)
              return (
                <div key={doc.id} className="doc-item">
                  <div className={`doc-icon ${cls}`}>{icon}</div>
                  <div className="doc-info">
                    <div className="doc-name" title={doc.filename}>{doc.filename}</div>
                    <div className="doc-status">
                      <span className={`status-dot ${doc.status}`} />
                      <span style={{
                        color: doc.status === 'ready' ? 'var(--success)' :
                               doc.status === 'failed' ? 'var(--danger)' : 'var(--warning)',
                        fontSize: 11
                      }}>
                        {doc.status === 'ready' ? 'Ready' :
                         doc.status === 'processing' ? 'Processing…' : 'Failed'}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Stats footer */}
        {documents.length > 0 && (
          <div style={{
            marginTop: 'auto',
            paddingTop: 12,
            borderTop: '1px solid var(--glass-border)',
            fontSize: 12,
            color: 'var(--text-muted)',
            display: 'flex',
            flexDirection: 'column',
            gap: 4
          }}>
            <span>📄 {documents.length} document{documents.length !== 1 ? 's' : ''}</span>
            <span>✅ {readyDocs} ready for Q&amp;A</span>
          </div>
        )}
      </aside>

      {/* ── Chat Panel ── */}
      <div className="chat-panel">
        {/* Messages */}
        <div className="chat-messages">
          {messages.length === 0 ? (
            <div className="chat-empty">
              <div className="chat-empty-icon">💬</div>
              <p className="chat-empty-text">Ask anything about your documents</p>
              <p className="chat-empty-hint">
                {readyDocs > 0
                  ? `${readyDocs} document${readyDocs !== 1 ? 's' : ''} ready · Ask a question below`
                  : 'Upload documents first, then ask questions'}
              </p>
            </div>
          ) : (
            messages.map(msg => (
              <div key={msg.id} className={`message-row ${msg.role}`}>
                <div className={`avatar ${msg.role}`}>
                  {msg.role === 'user' ? '👤' : '🧠'}
                </div>
                <div className="message-content">
                  <div
                    className="message-bubble"
                    style={msg.error ? { borderColor: 'var(--danger)', background: 'var(--danger-subtle)' } : undefined}
                  >
                    {msg.error && <span style={{ color: 'var(--danger)' }}>⚠️ </span>}
                    {msg.text}
                  </div>
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="sources-list">
                      {msg.sources.map((src, i) => (
                        <div key={i} className="source-chip">
                          <span className="source-chip-label">📄 {src.filename}</span>
                          <span>{src.snippet}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <span className="message-time">{formatTime(msg.timestamp)}</span>
                </div>
              </div>
            ))
          )}

          {/* Typing indicator */}
          {asking && (
            <div className="message-row ai">
              <div className="avatar ai">🧠</div>
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

        {/* Input area */}
        <div className="chat-input-area">
          <div className="chat-input-wrapper">
            <textarea
              ref={textareaRef}
              className="chat-textarea"
              placeholder={
                readyDocs > 0
                  ? 'Ask a question about your documents… (Enter to send, Shift+Enter for newline)'
                  : 'Upload and process documents first…'
              }
              value={question}
              onChange={e => { setQuestion(e.target.value); autoResize() }}
              onKeyDown={handleKeyDown}
              rows={1}
              disabled={asking}
            />
            <button
              id="chat-send-btn"
              className="chat-send-btn"
              onClick={handleAsk}
              disabled={!question.trim() || asking}
              title="Send"
            >
              ➤
            </button>
          </div>
          <p className="chat-input-hint">
            Press <kbd style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: 4, padding: '1px 5px', fontSize: 10 }}>Enter</kbd> to send &nbsp;·&nbsp;
            <kbd style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: 4, padding: '1px 5px', fontSize: 10 }}>Shift+Enter</kbd> for new line
          </p>
        </div>
      </div>
    </div>
  )
}
