import { useState, useEffect, useMemo } from 'react'
import { getPendingNotifications, startJob, getJob } from '../../../api'
import styles from './NotificationsTab.module.css'

export default function NotificationsTab({ secretKey }) {
  const [pending, setPending]         = useState(null)
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState('')
  const [sending, setSending]         = useState(null)
  const [sendResults, setSendResults] = useState({})

  useEffect(() => {
    getPendingNotifications(secretKey)
      .then(setPending)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [secretKey])

  // group by email
  const byEmail = useMemo(() => {
    const map = {}
    if (pending?.notifications) {
      pending.notifications.forEach(n => {
        if (!map[n.email]) map[n.email] = []
        map[n.email].push(n)
      })
    }
    return map
  }, [pending])

  async function handleSend(email = null) {
    const key = email || 'all'
    setSending(key)
    try {
      const { job_id } = await startJob('send', secretKey, email)
      const result = await new Promise((resolve) => {
        const poll = async () => {
          try {
            const data = await getJob(job_id, secretKey)
            if (data.status !== 'running') resolve(data)
            else setTimeout(poll, 500)
          } catch { resolve({ status: 'error' }) }
        }
        setTimeout(poll, 300)
      })
      setSendResults(prev => ({ ...prev, [key]: result.status === 'done' ? 'ok' : 'error' }))
      const p = await getPendingNotifications(secretKey)
      setPending(p)
    } catch {
      setSendResults(prev => ({ ...prev, [key]: 'error' }))
    } finally {
      setSending(null)
    }
  }

  if (loading) return <p className={styles.hint}>Loading…</p>
  if (error)   return <p className={styles.errorMsg}>{error}</p>

  const emailList = Object.keys(byEmail)
  const totalMatured = pending?.matured_count ?? 0

  return (
    <div className={styles.wrap}>

      <div className={styles.topRow}>
        <div className={styles.statCard}>
          <span className={styles.statNum}>{pending?.count ?? 0}</span>
          <span className={styles.statLabel}>Total Queued</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statNum}>{totalMatured}</span>
          <span className={styles.statLabel}>Ready to Send</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statNum}>{emailList.length}</span>
          <span className={styles.statLabel}>Subscribers</span>
        </div>
        {totalMatured > 0 && (
          <button className={styles.sendAllBtn} onClick={() => handleSend()} disabled={!!sending}>
            {sending === 'all' ? <><span className={styles.spinner} /> Sending all…</> : '✉ Send All'}
          </button>
        )}
        {sendResults['all'] && (
          <span className={sendResults['all'] === 'ok' ? styles.ok : styles.err}>
            {sendResults['all'] === 'ok' ? '✓ All sent' : '✗ Failed'}
          </span>
        )}
      </div>

      {emailList.length === 0
        ? <p className={styles.empty}>No pending notifications. All caught up.</p>
        : emailList.map(email => {
          const notifs = byEmail[email]
          const matured = notifs.filter(n => n.is_matured)
          const queued  = notifs.filter(n => !n.is_matured)
          const isSending = sending === email
          const result = sendResults[email]
          return (
            <div key={email} className={styles.subscriberCard}>
              <div className={styles.subscriberHeader}>
                <div className={styles.subscriberInfo}>
                  <span className={styles.email}>{email}</span>
                  {matured.length > 0 && (
                    <span className={styles.countReady}>{matured.length} ready</span>
                  )}
                  {queued.length > 0 && (
                    <span className={styles.countQueued}>{queued.length} queued</span>
                  )}
                </div>
                <div className={styles.actions}>
                  {result === 'ok'    && <span className={styles.ok}>✓ Sent</span>}
                  {result === 'error' && <span className={styles.err}>✗ Failed</span>}
                  <button
                    className={styles.sendBtn}
                    onClick={() => handleSend(email)}
                    disabled={!!sending || matured.length === 0}
                    title={matured.length === 0 ? 'No matured notifications to send' : undefined}
                  >
                    {isSending ? <><span className={styles.spinner} /> Sending…</> : '✉ Send'}
                  </button>
                </div>
              </div>

              {matured.length > 0 && (
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Post</th>
                      <th>Maturity Date</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matured.map((n, i) => (
                      <tr key={i}>
                        <td>
                          <a href={n.post_url} target="_blank" rel="noreferrer" className={styles.postLink}>
                            {n.post_title}
                          </a>
                        </td>
                        <td className={styles.muted}>{n.maturity_date ? new Date(n.maturity_date).toLocaleDateString() : '—'}</td>
                        <td><span className={styles.badgeReady}>Ready</span></td>
                      </tr>
                    ))}
                    {queued.map((n, i) => (
                      <tr key={`q${i}`} className={styles.rowQueued}>
                        <td>
                          <a href={n.post_url} target="_blank" rel="noreferrer" className={styles.postLink}>
                            {n.post_title}
                          </a>
                        </td>
                        <td className={styles.muted}>{n.maturity_date ? new Date(n.maturity_date).toLocaleDateString() : '—'}</td>
                        <td><span className={styles.badgeQueued}>Queued</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {matured.length === 0 && queued.length > 0 && (
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Post</th>
                      <th>Sends After</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {queued.map((n, i) => (
                      <tr key={i} className={styles.rowQueued}>
                        <td>
                          <a href={n.post_url} target="_blank" rel="noreferrer" className={styles.postLink}>
                            {n.post_title}
                          </a>
                        </td>
                        <td className={styles.muted}>{n.maturity_date ? new Date(n.maturity_date).toLocaleDateString() : '—'}</td>
                        <td><span className={styles.badgeQueued}>Queued</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )
        })
      }
    </div>
  )
}
