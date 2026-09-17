import { useState, useEffect, useRef } from 'react'
import { sendOtp, confirmOtp } from '../../../api'
import { useAuth } from '../../../context/AuthContext'
import styles from './EmailDialog.module.css'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** @deprecated use useAuth().email instead */
export function getSavedEmail() {
  return localStorage.getItem('onesearch_like_email') || ''
}

export default function EmailDialog({ onConfirm, onCancel, heading = "who's liking this?", sub = "we need your email to tie this like to a unique identity", successMsg = "liked" }) {
  const [step, setStep] = useState('email')   // 'email' | 'otp'
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const [wait, setWait] = useState(0)
  const inputRef = useRef(null)
  const { setEmail: setAuthEmail } = useAuth()

  useEffect(() => { inputRef.current?.focus() }, [step])

  useEffect(() => {
    if (wait <= 0) return
    const t = setTimeout(() => setWait(w => w - 1), 1000)
    return () => clearTimeout(t)
  }, [wait])

  async function handleSendOtp(e) {
    e?.preventDefault()
    if (!EMAIL_REGEX.test(email.trim())) { setError('invalid email address'); return }
    setSending(true); setError('')
    const res = await sendOtp(email.trim().toLowerCase())
    setSending(false)
    if (res.error) { setError(res.error); if (res.wait) setWait(res.wait); return }
    setStep('otp')
  }

  async function handleConfirmOtp(e) {
    e.preventDefault()
    if (otp.length !== 6) { setError('enter the 6-digit code'); return }
    setSending(true); setError('')
    const res = await confirmOtp(email.trim().toLowerCase(), otp.trim())
    setSending(false)
    if (res.error) { setError(res.error); return }
    setAuthEmail(email.trim().toLowerCase())
    setStep('success')
    setTimeout(() => onConfirm(email.trim().toLowerCase()), 1400)
  }

  return (
    <div className={styles.overlay} onMouseDown={e => { if (e.target === e.currentTarget) onCancel() }}>
      <div className={styles.dialog}>

        {step === 'success' && (
          <div className={styles.successWrap}>
            <svg className={styles.successTick} viewBox="0 0 52 52">
              <circle className={styles.successRing} cx="26" cy="26" r="23" />
              <path className={styles.successCheck} d="M14 26 l9 9 l15 -15" />
            </svg>
            <p className={styles.successMsg}>{successMsg}</p>
          </div>
        )}

        {step === 'email' && (
          <>
            <div className={styles.icon}>♡</div>
            <h2 className={styles.heading}>{heading}</h2>
            <p className={styles.sub}>{sub}</p>
            <form onSubmit={handleSendOtp} className={styles.form}>
              <input
                ref={inputRef}
                className={styles.input}
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={e => { setEmail(e.target.value); setError('') }}
                autoComplete="email"
                spellCheck={false}
              />
              {error && <p className={styles.error}>{error}</p>}
              <button type="submit" className={styles.btnPrimary} disabled={sending}>
                {sending ? 'sending...' : 'send code'}
              </button>
              <button type="button" className={styles.btnGhost} onClick={onCancel}>cancel</button>
            </form>
          </>
        )}

        {step === 'otp' && (
          <>
            <div className={styles.icon}>✉︎</div>
            <h2 className={styles.heading}>check your inbox</h2>
            <p className={styles.sub}>6-digit code sent to {email}</p>
            <form onSubmit={handleConfirmOtp} className={styles.form}>
              <input
                ref={inputRef}
                className={`${styles.input} ${styles.otpInput}`}
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={otp}
                onChange={e => { setOtp(e.target.value.replace(/\D/g, '')); setError('') }}
                spellCheck={false}
                autoComplete="one-time-code"
              />
              {error && <p className={styles.error}>{error}</p>}
              <button type="submit" className={styles.btnPrimary} disabled={sending}>
                {sending ? 'verifying...' : 'confirm'}
              </button>
              <div className={styles.secondaryRow}>
                <button type="button" className={styles.btnGhost} onClick={() => { setStep('email'); setOtp(''); setError('') }}>back</button>
                {wait > 0
                  ? <span className={styles.resendWait}>resend in {wait}s</span>
                  : <button type="button" className={styles.btnLink} onClick={handleSendOtp}>resend code</button>
                }
              </div>
            </form>
          </>
        )}

      </div>
    </div>
  )
}
