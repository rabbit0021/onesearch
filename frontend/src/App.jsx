import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ToastProvider } from './context/ToastContext'
import Home from './pages/Home/Home'
import AdminPosts from './pages/AdminPosts/AdminPosts'

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/admin" element={<AdminPosts />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  )
}
