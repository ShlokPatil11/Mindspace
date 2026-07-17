import { FormEvent, useEffect, useRef, useState } from 'react'
import { Link, Outlet, useNavigate, useParams } from 'react-router-dom'
import { createSpace, deleteSpace, listSpaces } from '../api/spaces'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import type { Space } from '../types'

export function AppShell() {
  const { theme, toggleTheme } = useTheme()
  const { logout } = useAuth()
  const navigate = useNavigate()
  const { spaceId } = useParams<{ spaceId?: string }>()

  const [spaces, setSpaces] = useState<Space[]>([])
  const [showNewModal, setShowNewModal] = useState(false)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function refresh() {
    try {
      setSpaces(await listSpaces())
    } catch {}
  }

  useEffect(() => { refresh() }, [])

  useEffect(() => {
    if (showNewModal) setTimeout(() => inputRef.current?.focus(), 50)
  }, [showNewModal])

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (!newName.trim() || creating) return
    setCreating(true)
    try {
      const space = await createSpace(newName.trim())
      setNewName('')
      setShowNewModal(false)
      await refresh()
      navigate(`/spaces/${space.id}`)
    } catch {
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm('Delete this space and all its documents?')) return
    try {
      await deleteSpace(id)
      if (spaceId === id) navigate('/spaces')
      refresh()
    } catch {}
  }

  function getSpaceInitial(name: string) {
    return name.charAt(0).toUpperCase()
  }

  function getSpaceEmoji(name: string) {
    const emojis = ['📁', '📂', '🗂️', '📋', '📌', '🔖', '💼', '📚']
    let hash = 0
    for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffff
    return emojis[hash % emojis.length]
  }

  const activeSpace = spaces.find(s => s.id === spaceId)

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <Link to="/spaces" className="logo">
            <div className="logo-icon">🧠</div>
            <span className="logo-text">MindSpace</span>
          </Link>
        </div>

        <span className="sidebar-section-label">Your Spaces</span>

        {spaces.map(space => (
          <Link
            key={space.id}
            to={`/spaces/${space.id}`}
            className={`space-item ${spaceId === space.id ? 'active' : ''}`}
          >
            <div className="space-item-icon">{getSpaceEmoji(space.name)}</div>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {space.name}
            </span>
            <button
              className="space-item-delete"
              onClick={(e) => handleDelete(space.id, e)}
              title="Delete space"
            >
              ✕
            </button>
          </Link>
        ))}

        <button className="new-space-btn" onClick={() => setShowNewModal(true)}>
          <span style={{ fontSize: 16 }}>+</span>
          <span>New Space</span>
        </button>

        {/* Bottom controls */}
        <div style={{ marginTop: 'auto', display: 'flex', gap: 8 }}>
          <button
            className="icon-btn"
            onClick={toggleTheme}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            style={{ flex: 1 }}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <button
            className="icon-btn"
            onClick={logout}
            title="Sign out"
            style={{ flex: 1 }}
          >
            🚪
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="main-content">
        {/* Topbar */}
        <header className="topbar">
          <span className="topbar-title">
            {activeSpace ? `📂 ${activeSpace.name}` : 'MindSpace'}
          </span>
          <div className="topbar-actions">
            <button className="icon-btn" onClick={toggleTheme} title="Toggle theme">
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
          </div>
        </header>

        <Outlet />
      </div>

      {/* New Space Modal */}
      {showNewModal && (
        <div className="modal-overlay" onClick={() => setShowNewModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">Create New Space</h2>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label className="form-label" htmlFor="new-space-name">Space name</label>
                <input
                  id="new-space-name"
                  ref={inputRef}
                  className="form-input"
                  type="text"
                  placeholder="e.g. Research Papers, Q3 Reports…"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  required
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowNewModal(false)}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={creating || !newName.trim()}
                  style={{ flex: 1 }}
                >
                  {creating ? 'Creating…' : 'Create Space'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
