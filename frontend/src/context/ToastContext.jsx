import { createContext, useCallback, useContext, useRef, useState } from 'react'
import Toast from '../components/ui/Toast/Toast'
import styles from '../components/ui/Toast/Toast.module.css'

const ToastContext = createContext(null)

const EXIT_DURATION = 320 // ms — must match popOut animation duration in CSS

export function ToastProvider({ children }) {
  const [toasts, setToasts]   = useState([])
  const [leaving, setLeaving] = useState(new Set())
  const idRef = useRef(0)

  const showToast = useCallback((message, duration = 3000) => {
    const id = ++idRef.current
    setToasts(prev => [...prev, { id, message }])

    setTimeout(() => {
      // start exit animation
      setLeaving(prev => new Set(prev).add(id))
      // remove from DOM after animation completes
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id))
        setLeaving(prev => { const s = new Set(prev); s.delete(id); return s })
      }, EXIT_DURATION)
    }, duration)
  }, [])

  const active = toasts.length > 0

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className={`${styles.backdrop} ${active ? styles.backdropActive : ''}`} />
      <div className={styles.container}>
        {toasts.map(t => (
          <Toast key={t.id} message={t.message} leaving={leaving.has(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}
