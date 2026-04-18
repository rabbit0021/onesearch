import { useState, useEffect, useMemo } from 'react'
import { getPendingNotifications, startJob, getJob } from '../../../api'
import styles from './NotificationsTab.module.css'

export default function NotificationsTab({ secretKey }) {
  const [pending, setPending]       = useState(null)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')
  const [sending, setSending]       = useState(null) // null | 'all' | email
  const [sendResults, setSendResults] = useState({}) // email -> 'ok'|'error'

  useEffect(() => {
    getPendingNotifications(secretKey)
      .then(setPending)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [secretKey])

  // group notifications by email
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
    } catch (e) {
      setSendResults(prev => ({ ...prev, [key]: 'error' }))
    } finally {
      setSending(null)
    }
  }

  if (loading) return <p className={styles.hint}>Loading…</p>
  if (error)   return <p className={styles.errorMsg}>{error}</p>

  const emailList = Object.keys(byEmail)

  return (
    <div className={styles.wrap}>

      <div className={styles.topRow}>
        <div className={styles.statCard}>
          <span className={styles.statNum}>{pending?.count ?? 0}</span>
          <span className={styles.statLabel}>Total Pending</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statNum}>{emailList.length}</span>
          <span className={styles.statLabel}>Subscribers with Pending</span>
        </div>
        {pending?.count > 0 && (
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
          const isSending = sending === email
          const result = sendResults[email]
          return (
            <div key={email} className={styles.subscriberCard}>
              <div className={styles.subscriberHeader}>
                <div className={styles.subscriberInfo}>
                  <span className={styles.email}>{email}</span>
                  <span className={styles.count}>{notifs.length} pending</span>
                </div>
                <div className={styles.actions}>
                  {result === 'ok'    && <span className={styles.ok}>✓ Sent</span>}
                  {result === 'error' && <span className={styles.err}>✗ Failed</span>}
                  <button
                    className={styles.sendBtn}
                    onClick={() => handleSend(email)}
                    disabled={!!sending}
                  >
                    {isSending ? <><span className={styles.spinner} /> Sending…</> : '✉ Send'}
                  </button>
                </div>
              </div>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Post</th>
                    <th>Maturity Date</th>
                  </tr>
                </thead>
                <tbody>
                  {notifs.map((n, i) => (
                    <tr key={i}>
                      <td>
                        <a href={n.post_url} target="_blank" rel="noreferrer" className={styles.postLink}>
                          {n.post_title}
                        </a>
                      </td>
                      <td className={styles.muted}>
                        {n.maturity_date ? new Date(n.maturity_date).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        })
      }
    </div>
  )
}
