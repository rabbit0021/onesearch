import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { ToastProvider } from './context/ToastContext'
import { ThemeProvider } from './context/ThemeContext'
import { AuthProvider } from './context/AuthContext'
import Home from './pages/Home/Home'
const AdminPosts = lazy(() => import('./pages/AdminPosts/AdminPosts'))
const ReaderPage = lazy(() => import('./pages/ReaderPage/ReaderPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage/ProfilePage'))
const GamePage = lazy(() => import('./pages/GamePage/GamePage'))

function AppRoutes() {
  const { pathname } = useLocation()
  return (
    <>
      {pathname !== '/admin' && !pathname.startsWith('/read') && pathname !== '/profile' && pathname !== '/game' && <Home />}
      <Suspense fallback={null}>
        <Routes>
          <Route path="/read/:id" element={<ReaderPage />} />
          <Route path="/admin" element={<AdminPosts />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/game" element={<GamePage />} />
        </Routes>
      </Suspense>
    </>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
