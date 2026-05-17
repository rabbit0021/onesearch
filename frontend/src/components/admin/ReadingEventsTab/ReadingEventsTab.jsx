import { useState, useEffect, useCallback } from 'react'
import { getAdminReadingEvents } from '../../../api'
import styles from './ReadingEventsTab.module.css'

function fmt(secs) {
  if (!secs) return '—'
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

function depthBar(pct) {
  return (
    <div className={styles.depthWrap}>
      <div className={styles.depthTrack}>
        <div className={styles.depthFill} style={{ width: `${pct}%` }} />
      </div>
      <span className={styles.depthLabel}>{pct}%</span>
    </div>
  )
}

export default function ReadingEventsTab({ secretKey }) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchEvents = useCallback(() => {
    setLoading(true)
    getAdminReadingEvents(secretKey)
      .then(setEvents)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [secretKey])

  useEffect(() => { fetchEvents() }, [fetchEvents])

  const totalReads   = events.length
  const uniqueUsers  = new Set(events.map(e => e.user_email || e.device_id)).size
  const avgDepth     = events.length ? Math.round(events.reduce((s, e) => s + e.max_depth, 0) / events.length) : 0
  const completed    = events.filter(e => e.max_depth >= 90).length
  const openedOrig   = events.filter(e => e.opened_original).length

  return (
    <div className={styles.wrap}>
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <span className={styles.statNum}>{totalReads}</span>
          <span className={styles.statLabel}>Total reads</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statNum}>{uniqueUsers}</span>
          <span className={styles.statLabel}>Unique readers</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statNum}>{avgDepth}%</span>
          <span className={styles.statLabel}>Avg depth</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statNum}>{completed}</span>
          <span className={styles.statLabel}>Completed (≥90%)</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statNum}>{openedOrig}</span>
          <span className={styles.statLabel}>Opened original</span>
        </div>
        <div className={styles.refreshCard}>
          <button className={styles.refreshBtn} onClick={fetchEvents} disabled={loading}>
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Reading Events</h2>
        {error && <p className={styles.errorMsg}>{error}</p>}
        {!loading && !error && events.length === 0 && (
          <p className={styles.hint}>No reading events recorded yet.</p>
        )}
        {events.length > 0 && (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Article</th>
                <th>Reader</th>
                <th>Active time</th>
                <th>Max depth</th>
                <th>Opened original</th>
                <th>Last read</th>
              </tr>
            </thead>
            <tbody>
              {events.map(e => (
                <tr key={e.id}>
                  <td>
                    <a href={e.url} target="_blank" rel="noopener noreferrer" className={styles.postLink}>
                      {e.title}
                    </a>
                    <div className={styles.muted}>{e.publisher}</div>
                  </td>
                  <td>
                    <div>{e.user_email || <span className={styles.muted}>anonymous</span>}</div>
                    <div className={styles.deviceId}>{e.device_id.slice(0, 8)}…</div>
                  </td>
                  <td className={styles.mono}>{fmt(e.time_spent)}</td>
                  <td>{depthBar(e.max_depth)}</td>
                  <td>
                    <span className={e.opened_original ? styles.yes : styles.no}>
                      {e.opened_original ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className={styles.muted}>{new Date(e.last_read_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
