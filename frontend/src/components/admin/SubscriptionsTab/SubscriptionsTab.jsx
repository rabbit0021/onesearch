import { useState, useEffect } from 'react'
import { getAdminSubscriptions } from '../../../api'
import styles from './SubscriptionsTab.module.css'

export default function SubscriptionsTab({ secretKey }) {
  const [subs, setSubs]     = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    getAdminSubscriptions(secretKey)
      .then(setSubs)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [secretKey])

  const unique = [...new Set(subs.map(s => s.email))]

  const filtered = subs.filter(s =>
    s.email.toLowerCase().includes(search.toLowerCase()) ||
    s.publisher?.publisher_name?.toLowerCase().includes(search.toLowerCase()) ||
    s.topic?.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return <p className={styles.hint}>Loading…</p>
  if (error)   return <p className={styles.errorMsg}>{error}</p>

  return (
    <div className={styles.wrap}>

      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <span className={styles.statNum}>{unique.length}</span>
          <span className={styles.statLabel}>Total Subscribers</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statNum}>{subs.length}</span>
          <span className={styles.statLabel}>Total Subscriptions</span>
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
