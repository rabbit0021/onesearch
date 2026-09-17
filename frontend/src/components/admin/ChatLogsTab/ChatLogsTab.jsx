import { useState, useEffect, useCallback } from 'react'
import { getAdminChatLogs } from '../../../api'
import styles from './ChatLogsTab.module.css'

export default function ChatLogsTab({ secretKey }) {
  const [data, setData] = useState({ logs: [], summary: {} })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchLogs = useCallback(() => {
    setLoading(true)
    getAdminChatLogs(secretKey)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [secretKey])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  const { logs, summary } = data

  return (
    <div className={styles.wrap}>
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <span className={styles.statNum}>{summary.total_queries ?? '—'}</span>
          <span className={styles.statLabel}>Total queries</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statNum}>{summary.unique_posts ?? '—'}</span>
          <span className={styles.statLabel}>Unique articles</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statNum}>{(summary.total_input_tokens ?? 0).toLocaleString()}</span>
          <span className={styles.statLabel}>Input tokens</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statNum}>{(summary.total_output_tokens ?? 0).toLocaleString()}</span>
          <span className={styles.statLabel}>Output tokens</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statNum}>{(summary.total_tokens ?? 0).toLocaleString()}</span>
          <span className={styles.statLabel}>Total tokens</span>
        </div>
        <div className={styles.refreshCard}>
          <button className={styles.refreshBtn} onClick={fetchLogs} disabled={loading}>
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Chat Queries</h2>
        {error && <p className={styles.errorMsg}>{error}</p>}
        {!loading && !error && logs.length === 0 && (
          <p className={styles.hint}>No chat queries yet.</p>
        )}
        {logs.length > 0 && (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Article</th>
                <th>Question</th>
                <th>Words</th>
                <th>In tokens</th>
                <th>Out tokens</th>
                <th>Total</th>
                <th>Model</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(row => (
                <tr key={row.id}>
                  <td>
                    <div className={styles.postTitle}>{row.post_title || `Post #${row.post_id}`}</div>
                  </td>
                  <td className={styles.question}>{row.question}</td>
                  <td className={styles.mono}>{row.word_count}</td>
                  <td className={styles.mono}>{row.input_tokens?.toLocaleString() ?? '—'}</td>
                  <td className={styles.mono}>{row.output_tokens?.toLocaleString() ?? '—'}</td>
                  <td className={styles.mono}>{row.total_tokens?.toLocaleString() ?? '—'}</td>
                  <td className={styles.muted}>{row.model ?? '—'}</td>
                  <td className={styles.muted}>{new Date(row.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
