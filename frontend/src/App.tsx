import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AuthProvider } from './context/AuthContext'
import { AuthPage } from './pages/AuthPage'
import { SpaceDetailPage } from './pages/SpaceDetailPage'
import { AppShell } from './components/AppShell'

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<AuthPage />} />
          <Route path="/signup" element={<AuthPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route path="/spaces" element={
                <div className="empty-state">
                  <div className="empty-state-icon">🧠</div>
                  <h2 className="empty-state-title">Welcome to MindSpace</h2>
                  <p className="empty-state-desc">
                    Select a space from the sidebar, or create a new one to start uploading documents and asking AI-powered questions.
                  </p>
                </div>
              } />
              <Route path="/spaces/:spaceId" element={<SpaceDetailPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/spaces" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
