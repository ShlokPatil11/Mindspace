import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest, clearToken, setToken } from './client'

describe('apiRequest', () => {
  beforeEach(() => {
    clearToken()
    vi.restoreAllMocks()
  })

  it('attaches an Authorization header when a token is present', async () => {
    setToken('abc123')
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ hello: 'world' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await apiRequest('/test')

    const headers = fetchMock.mock.calls[0][1].headers
    expect(headers['Authorization']).toBe('Bearer abc123')
  })

  it('omits the Authorization header when no token is present', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    })
    vi.stubGlobal('fetch', fetchMock)

    await apiRequest('/test')

    const headers = fetchMock.mock.calls[0][1].headers
    expect(headers['Authorization']).toBeUndefined()
  })

  it('throws with the server-provided detail message on a failed request', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ detail: 'Something went wrong' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(apiRequest('/test')).rejects.toThrow('Something went wrong')
  })
})
