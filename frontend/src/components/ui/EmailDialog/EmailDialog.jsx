import { useState, useEffect, useRef } from 'react'
import styles from './EmailDialog.module.css'

const EMAIL_KEY = 'onesearch_like_email'

export function getSavedEmail() {
  return localStorage.getItem(EMAIL_KEY) || ''
}

export default function EmailDialog({ onConfirm, onCancel }) {
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  function handleSubmit(e) {
    e.preventDefault()
    const email = value.trim().toLowerCase()
    if (!email || !email.includes('@') || !email.includes('.')) {
      setError('invalid email address')
      return
    }
    localStorage.setItem(EMAIL_KEY, email)
    onConfirm(email)
  }

  return (
    <div className={styles.overlay} onMouseDown={e => { if (e.target === e.currentTarget) onCancel() }}>
      <div className={styles.terminal}>
        <div className={styles.scanlines} />
        <div className={styles.header}>
          <span className={styles.headerTitle}>Onesearch</span>
        </div>
        <div className={styles.body}>
          <p className={styles.line}><span className={styles.prompt}>&gt;_</span> IDENTIFY USER TO REGISTER LIKE</p>
          <p className={styles.line2}>enter your email</p>
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.inputRow}>
              <span className={styles.inputPrompt}>&gt;</span>
              <input
                ref={inputRef}
                className={styles.input}
                type="email"
                placeholder="you@company.com"
                value={value}
                onChange={e => { setValue(e.target.value); setError('') }}
                autoComplete="email"
                spellCheck={false}
              />
            </div>
            {error && <p className={styles.error}><span className={styles.errorPrefix}>ERR //</span> {error}</p>}
            <div className={styles.actions}>
              <button type="submit" className={styles.btnConfirm}>[CONFIRM]</button>
              <button type="button" className={styles.btnCancel} onClick={onCancel}>[CANCEL]</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
