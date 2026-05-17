import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { ToastProvider } from './context/ToastContext'
import { ThemeProvider } from './context/ThemeContext'
import Home from './pages/Home/Home'
const AdminPosts = lazy(() => import('./pages/AdminPosts/AdminPosts'))
const ReaderPage = lazy(() => import('./pages/ReaderPage/ReaderPage'))

function AppRoutes() {
  const { pathname } = useLocation()
  return (
    <>
      {pathname !== '/admin' && <Home />}
      <Suspense fallback={null}>
        <Routes>
          <Route path="/read/:id" element={<ReaderPage />} />
          <Route path="/admin" element={<AdminPosts />} />
        </Routes>
      </Suspense>
    </>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </ToastProvider>
    </ThemeProvider>
  )
}
