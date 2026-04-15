import { useState, useEffect } from 'react'
import { getJiraStatus } from '../../../api/jira'
import styles from './JiraHeaderButton.module.css'

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
      <a href="/auth/jira/login" className={styles.connectBtn}>
        <img src="https://cdn.simpleicons.org/jira/ffffff" alt="" className={styles.icon} />
        Connect Jira
      </a>
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
