import { useState, useEffect, useRef } from 'react'
import { getJiraStatus } from '../../../api/jira'
import styles from './JiraHeaderButton.module.css'

function ConnectButton() {
  const [pending, setPending] = useState(false)
  const [showInfo, setShowInfo] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    if (!showInfo) return
    function handleClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setShowInfo(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showInfo])

  useEffect(() => {
    if (!pending) return
    const reset = () => setPending(false)
    const handleVisibility = () => { if (!document.hidden) reset() }
    window.addEventListener('focus', reset)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      window.removeEventListener('focus', reset)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [pending])

  function handleClick() {
    setPending(true)
  }

  return (
    <div className={styles.connectWrap} ref={wrapRef}>
      <a
        href="/auth/jira/login"
        className={`${styles.connectBtn} ${pending ? styles.connectBtnPending : ''}`}
        onClick={handleClick}
      >
        {pending
          ? <><span className={styles.spinner} /> Connecting…</>
          : <>
              <img src="https://cdn.simpleicons.org/jira/ffffff" alt="" className={styles.icon} />
              Connect Jira
              <button
                type="button"
                className={styles.infoBtn}
                onClick={e => { e.preventDefault(); e.stopPropagation(); setShowInfo(v => !v) }}
                aria-label="Why is this safe?"
              >i</button>
            </>
        }
      </a>
      {showInfo && (
        <div className={styles.infoPanel}>
          <p className={styles.infoTitle}>Safe &amp; compliant</p>
          <ul className={styles.infoList}>
            <li><span className={styles.infoBullet}>✓</span> Read-only — we don't have permission to create, edit, or delete your issues</li>
            <li><span className={styles.infoBullet}>✓</span> Issues flow directly from Atlassian to your browser — we don't store them anywhere - not at server & not even in cookies</li>
            <li><span className={styles.infoBullet}>✓</span> OAuth 2.0 via Atlassian — we never see your password</li>
            <li className={styles.infoItemWarn}><span className={styles.infoBulletWarn}>⚠</span> Check with your IT / HR before connecting work tools to third-party services</li>
          </ul>
          <a href="/privacy-policy.html" target="_blank" rel="noopener noreferrer" className={styles.privacyLink}>
            view privacy policy →
          </a>
        </div>
      )}
    </div>
  )
}

export default function JiraHeaderButton() {
  const [status, setStatus] = useState(null)

  useEffect(() => {
    getJiraStatus().then(setStatus).catch(() => setStatus({ connected: false }))

    const params = new URLSearchParams(window.location.search)
    if (params.get('jira') === 'connected') {
      window.history.replaceState({}, '', window.location.pathname)
      getJiraStatus().then(setStatus)
    }
  }, [])

  if (status === null) return null

  if (!status.connected) {
    return (
      <ConnectButton />
    )
  }

  return (
    <div className={styles.connected}>
      <span className={styles.check}>✓</span>
      <img src="https://cdn.simpleicons.org/jira/d97757" alt="" className={styles.icon} />
      <span className={styles.site}>connected to Jira</span>
    </div>
  )
}
