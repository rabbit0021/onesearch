import { useEffect, useState } from 'react'
import { subscribe } from '../../../../api/index'
import styles from './KnowledgeNugget.module.css'

export default function KnowledgeNugget({ nugget, onContinue, round, totalRounds }) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('idle') // idle | submitting | done | error

  useEffect(() => {
    const t = setTimeout(onContinue, 7000)
    return () => clearTimeout(t)
  }, [onContinue])

  async function handleSubscribe(e) {
    e.preventDefault()
    e.stopPropagation()
    if (!email || status === 'submitting' || status === 'done') return
    setStatus('submitting')
    try {
      await subscribe({ email, topic: 'Software Engineering', frequency: 7, techteams: [], individuals: [] })
      setStatus('done')
    } catch {
      setStatus('error')
    }
  }

  return (
    <div className={styles.overlay} onClick={onContinue}>
      <div className={styles.card} onClick={e => e.stopPropagation()}>
        <div className={styles.tag}>📬 Meanwhile, at OneSearch...</div>
        <p className={styles.fact}>{nugget?.fact}</p>
        <p className={styles.sub}>{nugget?.sub}</p>

        {status === 'done' ? (
          <p className={styles.successMsg}>You're in! Check your inbox.</p>
        ) : (
          <form className={styles.form} onSubmit={handleSubscribe}>
            <input
              className={styles.emailInput}
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
            <button
              className={styles.submitBtn}
              type="submit"
              disabled={status === 'submitting'}
            >
              {status === 'submitting' ? 'Subscribing…' : 'Try OneSearch free →'}
            </button>
            {status === 'error' && <p className={styles.errorMsg}>Something went wrong. Try again.</p>}
          </form>
        )}

        <div className={styles.footer}>
          <span className={styles.rounds}>Round {round + 1} of {totalRounds} done</span>
          <span className={styles.hint} onClick={onContinue} style={{ cursor: 'pointer' }}>tap to continue →</span>
        </div>
      </div>
    </div>
  )
}
