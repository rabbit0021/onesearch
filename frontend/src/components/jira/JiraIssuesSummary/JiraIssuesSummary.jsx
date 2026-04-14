import { useState, useEffect } from 'react'
import { getJiraStatus, getJiraIssues } from '../../../api/jira'
import styles from './JiraIssuesSummary.module.css'

export default function JiraIssuesSummary() {
  const [issues, setIssues] = useState(null)
  const [error, setError] = useState(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    getJiraStatus().then(status => {
      if (status.connected) {
        setConnected(true)
        fetchIssues()
      }
    }).catch(() => {})
  }, [])

  async function fetchIssues() {
    try {
      const data = await getJiraIssues()
      setIssues(data.issues.slice(0, 3))
    } catch (e) {
      setError(e.message)
    }
  }

  if (!connected) return null
  if (error) return <p style={{ fontSize: '0.8rem', color: '#c0392b', margin: '0 0 0.75rem' }}>Jira error: {error}</p>
  if (issues === null) return <p style={{ fontSize: '0.8rem', color: '#aaa', margin: '0 0 0.75rem' }}>Loading Jira issues…</p>
  if (issues.length === 0) return <p style={{ fontSize: '0.8rem', color: '#aaa', margin: '0 0 0.75rem' }}>No Jira issues assigned to you.</p>

  return (
    <div className={styles.container}>
      <p className={styles.heading}>Your Jira — Recent Items</p>
      <ul className={styles.list}>
        {issues.map(issue => (
          <li key={issue.key} className={styles.item}>
            <div className={styles.meta}>
              <span className={styles.key}>{issue.key}</span>
              <span className={styles.status}>{issue.status}</span>
            </div>
            <p className={styles.summary}>{issue.summary}</p>
            {issue.description && (
              <p className={styles.description}>{issue.description}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
