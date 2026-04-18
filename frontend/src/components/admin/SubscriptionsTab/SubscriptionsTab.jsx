import { useState, useEffect, useRef, useCallback } from 'react'
import { getAdminSubscriptions } from '../../../api'
import styles from './SubscriptionsTab.module.css'

const REFRESH_SEC = 120

export default function SubscriptionsTab({ secretKey }) {
  const [subs, setSubs]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [search, setSearch]     = useState('')
  const [countdown, setCountdown] = useState(REFRESH_SEC)
  const countdownRef = useRef(REFRESH_SEC)
  const timerRef     = useRef(null)

  const fetchSubs = useCallback(() => {
    setLoading(true)
    getAdminSubscriptions(secretKey)
      .then(setSubs)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
    countdownRef.current = REFRESH_SEC
    setCountdown(REFRESH_SEC)
  }, [secretKey])

  // Initial fetch + auto-refresh every 2 min
  useEffect(() => {
    fetchSubs()
    timerRef.current = setInterval(() => {
      countdownRef.current -= 1
      setCountdown(countdownRef.current)
      if (countdownRef.current <= 0) fetchSubs()
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [fetchSubs])

  const unique = [...new Set(subs.map(s => s.email))]

  const filtered = subs.filter(s =>
    s.email.toLowerCase().includes(search.toLowerCase()) ||
    s.publisher?.publisher_name?.toLowerCase().includes(search.toLowerCase()) ||
    s.topic?.toLowerCase().includes(search.toLowerCase())
  )

  if (error) return <p className={styles.errorMsg}>{error}</p>

  return (
    <div className={styles.wrap}>
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <span className={styles.statNum}>{loading ? '—' : unique.length}</span>
          <span className={styles.statLabel}>Unique Subscribers</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statNum}>{loading ? '—' : subs.length}</span>
          <span className={styles.statLabel}>Total Subscriptions</span>
        </div>
        <div className={styles.timerCard}>
          <span className={styles.timerNum}>
            {loading ? '…' : `${Math.floor(countdown / 60)}:${String(countdown % 60).padStart(2, '0')}`}
          </span>
          <span className={styles.timerLabel}>{loading ? 'refreshing' : 'next refresh'}</span>
          <button className={styles.refreshNowBtn} onClick={fetchSubs} disabled={loading}>
            ↻ now
          </button>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.listHeader}>
          <h2 className={styles.cardTitle}>Subscriptions</h2>
          <input
            className={styles.search}
            placeholder="search email, publisher, topic…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {filtered.length === 0
          ? <p className={styles.hint}>No subscriptions found.</p>
          : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Publisher</th>
                  <th>Topic</th>
                  <th>Frequency</th>
                  <th>Joined</th>
                  <th>Last Notified</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, i) => (
                  <tr key={i}>
                    <td>{s.email}</td>
                    <td>{s.publisher?.publisher_name ?? '—'}</td>
                    <td><span className={styles.topic}>{s.topic}</span></td>
                    <td className={styles.muted}>{s.frequency_in_days ? `${s.frequency_in_days}d` : '—'}</td>
                    <td className={styles.muted}>{s.joined_time ? new Date(s.joined_time).toLocaleDateString() : '—'}</td>
                    <td className={styles.muted}>{s.last_notified_at ? new Date(s.last_notified_at).toLocaleDateString() : 'Never'}</td>
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
