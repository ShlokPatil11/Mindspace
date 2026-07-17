import { FormEvent, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { SplashScreen } from '../components/SplashScreen'

type Mode = 'login' | 'signup'

export function AuthPage() {
  const location = useLocation()
  const [showSplash, setShowSplash] = useState(true)
  const [mode, setMode] = useState<Mode>(location.pathname === '/signup' ? 'signup' : 'login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { login, signup } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      if (mode === 'login') {
        await login(email, password)
      } else {
        await signup(email, password)
      }
      navigate('/spaces')
    } catch (err) {
      setError(err instanceof Error ? err.message : `${mode === 'login' ? 'Login' : 'Signup'} failed`)
    } finally {
      setLoading(false)
    }
  }

  function switchMode(next: Mode) {
    setMode(next)
    setError(null)
  }

  return (
    <div className="auth-page">
      {showSplash && <SplashScreen onDone={() => setShowSplash(false)} />}

      {!showSplash && (
        <div className="auth-form-card">
          <span className="auth-wordmark">MINDSPACE</span>

          {error && (
            <div className="alert error">
              <span>⚠️</span> {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="auth-email">Email</label>
              <input
                id="auth-email"
                className="form-input"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="auth-password">Password</label>
              <input
                id="auth-password"
                className="form-input"
                type="password"
                placeholder={mode === 'signup' ? 'Minimum 8 characters' : '••••••••'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={mode === 'signup' ? 8 : undefined}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
            </div>

            <button type="submit" className="btn-primary" disabled={loading}>
              {loading
                ? (mode === 'login' ? 'Signing in…' : 'Creating account…')
                : (mode === 'login' ? 'Sign in' : 'Create account')}
            </button>
          </form>

          <p className="auth-footer">
            {mode === 'login' ? (
              <>
                No account?{' '}
                <button type="button" className="auth-link" onClick={() => switchMode('signup')}>
                  Create one
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button type="button" className="auth-link" onClick={() => switchMode('login')}>
                  Sign in
                </button>
              </>
            )}
          </p>
        </div>
      )}
    </div>
  )
}
