import { useState, useEffect, useRef } from 'react'
import { sendOtp, confirmOtp } from '../../../api'
import styles from './EmailDialog.module.css'

const EMAIL_KEY = 'onesearch_like_email'
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function getSavedEmail() {
  return localStorage.getItem(EMAIL_KEY) || ''
}

export default function EmailDialog({ onConfirm, onCancel }) {
  const [step, setStep] = useState('email')   // 'email' | 'otp'
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const [wait, setWait] = useState(0)
  const inputRef = useRef(null)

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
    localStorage.setItem(EMAIL_KEY, email.trim().toLowerCase())
    setStep('success')
    setTimeout(() => onConfirm(email.trim().toLowerCase()), 1400)
  }

  return (
    <div className={styles.overlay} onMouseDown={e => { if (e.target === e.currentTarget) onCancel() }}>
      <div className={styles.terminal}>
        <div className={styles.scanlines} />
        <div className={styles.header}>
          <span className={styles.headerTitle}>ONESEARCH_LIKES.exe</span>
        </div>
        <div className={styles.body}>

          {step === 'success' && (
            <div className={styles.successWrap}>
              <div className={styles.successCircle}>
                <svg className={styles.successTick} viewBox="0 0 52 52">
                  <circle className={styles.successRing} cx="26" cy="26" r="23" />
                  <path className={styles.successCheck} d="M14 26 l9 9 l15 -15" />
                </svg>
              </div>
              <p className={styles.successMsg}>EMAIL VERIFIED</p>
              <p className={styles.successSub}>&gt;_ identity confirmed</p>
            </div>
          )}
          {step === 'email' && (
            <>
              <p className={styles.line}><span className={styles.prompt}>&gt;_</span> IDENTIFY USER TO REGISTER LIKE</p>
              <p className={styles.line2}>enter your email — a verification code will be sent</p>
              <form onSubmit={handleSendOtp} className={styles.form}>
                <div className={styles.inputRow}>
                  <span className={styles.inputPrompt}>&gt;</span>
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
                </div>
                {error && <p className={styles.error}><span className={styles.errorPrefix}>ERR //</span> {error}</p>}
                <div className={styles.actions}>
                  <button type="submit" className={styles.btnConfirm} disabled={sending}>
                    {sending ? '[SENDING...]' : '[SEND CODE]'}
                  </button>
                  <button type="button" className={styles.btnCancel} onClick={onCancel}>[CANCEL]</button>
                </div>
              </form>
            </>
          )}
          {step === 'otp' && (
            <>
              <p className={styles.line}><span className={styles.prompt}>&gt;_</span> ENTER VERIFICATION CODE</p>
              <p className={styles.line2}>code sent to {email}</p>
              <form onSubmit={handleConfirmOtp} className={styles.form}>
                <div className={styles.inputRow}>
                  <span className={styles.inputPrompt}>&gt;</span>
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
                </div>
                {error && <p className={styles.error}><span className={styles.errorPrefix}>ERR //</span> {error}</p>}
                <div className={styles.actions}>
                  <button type="submit" className={styles.btnConfirm} disabled={sending}>
                    {sending ? '[VERIFYING...]' : '[CONFIRM]'}
                  </button>
                  <button
                    type="button"
                    className={styles.btnCancel}
                    onClick={() => { setStep('email'); setOtp(''); setError('') }}
                  >[BACK]</button>
                  {wait > 0
                    ? <span className={styles.resendWait}>resend in {wait}s</span>
                    : <button type="button" className={styles.btnResend} onClick={handleSendOtp}>[RESEND]</button>
                  }
                </div>
              </form>
            </>
          )}

        </div>
      </div>
    </div>
  )
}
