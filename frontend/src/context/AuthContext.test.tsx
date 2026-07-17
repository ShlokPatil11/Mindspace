import { act, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as authApi from '../api/auth'
import { clearToken } from '../api/client'
import { AuthProvider, useAuth } from './AuthContext'

function TestComponent() {
  const { isAuthenticated, login, logout } = useAuth()
  return (
    <div>
      <span data-testid="status">{isAuthenticated ? 'in' : 'out'}</span>
      <button onClick={() => login('a@b.com', 'pw')}>login</button>
      <button onClick={() => logout()}>logout</button>
    </div>
  )
}

describe('AuthProvider', () => {
  beforeEach(() => {
    clearToken()
  })

  it('starts unauthenticated, becomes authenticated after login, then unauthenticated after logout', async () => {
    vi.spyOn(authApi, 'login').mockResolvedValue(undefined)

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>,
    )

    expect(screen.getByTestId('status').textContent).toBe('out')

    await act(async () => {
      screen.getByText('login').click()
    })
    expect(screen.getByTestId('status').textContent).toBe('in')

    act(() => {
      screen.getByText('logout').click()
    })
    expect(screen.getByTestId('status').textContent).toBe('out')
  })
})
