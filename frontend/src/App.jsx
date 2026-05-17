import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { ToastProvider } from './context/ToastContext'
import { ThemeProvider } from './context/ThemeContext'
import Home from './pages/Home/Home'
import AdminPosts from './pages/AdminPosts/AdminPosts'
import ReaderPage from './pages/ReaderPage/ReaderPage'

function AppRoutes() {
  const { pathname } = useLocation()
  return (
    <>
      {pathname !== '/admin' && <Home />}
      <Routes>
        <Route path="/read/:id" element={<ReaderPage />} />
        <Route path="/admin" element={<AdminPosts />} />
      </Routes>
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
