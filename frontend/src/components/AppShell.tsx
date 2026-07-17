import { FormEvent, MouseEvent, useEffect, useRef, useState } from 'react'
import { Link, Outlet, useNavigate, useParams } from 'react-router-dom'
import { createSpace, deleteSpace, listSpaces } from '../api/spaces'
import { useAuth } from '../context/AuthContext'
import { LiquidGlass } from './LiquidGlass'
import type { Space } from '../types'

export function AppShell() {
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

  async function handleDelete(id: string, e: MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm('Delete this space and all its documents?')) return
    try {
      await deleteSpace(id)
      if (spaceId === id) navigate('/spaces')
      refresh()
    } catch {}
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-header">
          <Link to="/spaces" className="wordmark wordmark--small">MINDSPACE</Link>
        </div>

        <nav className="space-list">
          {spaces.map(space => (
            <Link
              key={space.id}
              to={`/spaces/${space.id}`}
              className={`space-item ${spaceId === space.id ? 'active' : ''}`}
            >
              <span className="space-item-name">{space.name}</span>
              <button
                className="space-item-delete"
                onClick={(e) => handleDelete(space.id, e)}
                title="Delete space"
              >
                ✕
              </button>
            </Link>
          ))}
        </nav>

        <button className="new-space-btn" onClick={() => setShowNewModal(true)}>
          + New Space
        </button>

        <button className="logout-btn" onClick={() => logout()}>
          Logout
        </button>
      </aside>

      <div className="main-content">
        <Outlet />
      </div>

      {showNewModal && (
        <div className="modal-overlay" onClick={() => setShowNewModal(false)}>
          <LiquidGlass className="modal">
            <div onClick={e => e.stopPropagation()}>
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
          </LiquidGlass>
        </div>
      )}
    </div>
  )
}
