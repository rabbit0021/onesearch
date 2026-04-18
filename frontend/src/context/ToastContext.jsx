import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import Toast from '../components/ui/Toast/Toast'
import styles from '../components/ui/Toast/Toast.module.css'

const ToastContext = createContext(null)

const EXIT_DURATION = 280

export function ToastProvider({ children }) {
  const [toasts, setToasts]   = useState([])
  const [leaving, setLeaving] = useState(new Set())
  const idRef    = useRef(0)
  const timers   = useRef({})

  const dismiss = useCallback((id) => {
    if (leaving.has(id)) return
    clearTimeout(timers.current[id])
    setLeaving(prev => new Set(prev).add(id))
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
      setLeaving(prev => { const s = new Set(prev); s.delete(id); return s })
    }, EXIT_DURATION)
  }, [leaving])

  const dismissAll = useCallback(() => {
    setToasts(prev => {
      prev.forEach(t => {
        clearTimeout(timers.current[t.id])
        setLeaving(l => new Set(l).add(t.id))
      })
      setTimeout(() => {
        setToasts([])
        setLeaving(new Set())
      }, EXIT_DURATION)
      return prev
    })
  }, [])

  const showToast = useCallback((message, duration = 3000) => {
    const id = ++idRef.current
    setToasts(prev => [...prev, { id, message }])
    timers.current[id] = setTimeout(() => dismiss(id), duration)
  }, [dismiss])

  // click anywhere dismisses
  useEffect(() => {
    if (toasts.length === 0) return
    const handle = () => dismissAll()
    document.addEventListener('click', handle)
    return () => document.removeEventListener('click', handle)
  }, [toasts.length, dismissAll])

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
