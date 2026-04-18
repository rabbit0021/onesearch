import { useState } from 'react'
import styles from './SecretKeyModal.module.css'

/**
 * Props:
 *   onSubmit  – (key: string) => void
 */
export default function SecretKeyModal({ onSubmit, error, loading }) {
  const [key, setKey] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    if (key.trim()) onSubmit(key.trim())
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <h2 className={styles.title}>Admin Access</h2>
        <p className={styles.hint}>Enter the secret key to view and manage posts.</p>
        <form onSubmit={handleSubmit} className={styles.form}>
          <input
            type="password"
            className={styles.input}
            placeholder="Secret key…"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            autoFocus
          />
          <button type="submit" className={styles.btn} disabled={!key.trim() || loading}>
            {loading ? 'Verifying…' : 'Enter'}
          </button>
        </form>
        {error && <p className={styles.error}>{error}</p>}
      </div>
    </div>
  )
}
