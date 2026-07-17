import { FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { createSpace, deleteSpace, listSpaces } from '../api/spaces'
import type { Space } from '../types'

export function SpacesListPage() {
  const [spaces, setSpaces] = useState<Space[]>([])
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function refresh() {
    try {
      setSpaces(await listSpaces())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load spaces')
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setError(null)
    try {
      await createSpace(name.trim())
      setName('')
      refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create space')
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this space and all its documents?')) return
    setError(null)
    try {
      await deleteSpace(id)
      refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete space')
    }
  }

  return (
    <div>
      <h1>Your Spaces</h1>
      {error && <p role="alert">{error}</p>}
      <form onSubmit={handleCreate}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New space name" />
        <button type="submit">Create</button>
      </form>
      <ul>
        {spaces.map((space) => (
          <li key={space.id}>
            <Link to={`/spaces/${space.id}`}>{space.name}</Link>
            <button onClick={() => handleDelete(space.id)}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  )
}
