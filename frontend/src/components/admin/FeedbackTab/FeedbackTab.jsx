import { useState, useEffect, useCallback } from 'react'
import { getAdminTempdata } from '../../../api'
import styles from './FeedbackTab.module.css'

export default function FeedbackTab({ secretKey }) {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  const fetchData = useCallback(() => {
    setLoading(true)
    getAdminTempdata(secretKey)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [secretKey])

  useEffect(() => { fetchData() }, [fetchData])

  if (error) return <p className={styles.errorMsg}>{error}</p>

  const feedbacks = data?.feedbacks ?? []

  return (
    <div className={styles.wrap}>
      <div className={styles.statsRow}>
        <div className={styles.heroCard}>
          <span className={styles.heroLabel}>Interested Count</span>
          <span className={styles.heroNum}>{loading ? '—' : (data?.['interested-count'] ?? 0)}</span>
          <span className={styles.heroSub}>people clicked "I'm interested"</span>
        </div>

        <div className={styles.statCard}>
          <span className={styles.statNum}>{loading ? '—' : feedbacks.length}</span>
          <span className={styles.statLabel}>Total Feedbacks</span>
        </div>

        <div className={styles.refreshCard}>
          <button className={styles.refreshBtn} onClick={fetchData} disabled={loading}>
            {loading ? '…' : '↻ Refresh'}
          </button>
        </div>
      </div>

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Feedback</h2>
        {loading
          ? <p className={styles.hint}>Loading…</p>
          : feedbacks.length === 0
            ? <p className={styles.hint}>No feedback submitted yet.</p>
            : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Feedback</th>
                    <th>Submitted At</th>
                  </tr>
                </thead>
                <tbody>
                  {feedbacks.map((f, i) => (
                    <tr key={i}>
                      <td className={styles.muted}>{feedbacks.length - i}</td>
                      <td>{f.text}</td>
                      <td className={styles.muted}>
                        {f.timestamp ? new Date(f.timestamp).toLocaleString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
        }
      </div>
    </div>
  )
}
