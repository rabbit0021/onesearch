import { useState, useEffect, useCallback } from 'react'
import { getAdminComments } from '../../../api'
import styles from './CommentsTab.module.css'

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr + 'Z').getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export default function CommentsTab({ secretKey }) {
  const [data, setData] = useState({ comments: [], summary: {} })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  const fetchData = useCallback(() => {
    setLoading(true)
    getAdminComments(secretKey)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [secretKey])

  useEffect(() => { fetchData() }, [fetchData])

  const { comments, summary } = data

  const filtered = comments.filter(c =>
    !search ||
    c.author?.toLowerCase().includes(search.toLowerCase()) ||
    c.body?.toLowerCase().includes(search.toLowerCase()) ||
    c.post_title?.toLowerCase().includes(search.toLowerCase())
  )

  // Unique authors
  const uniqueAuthors = [...new Map(comments.map(c => [c.email || c.device_id, c.author])).values()]

  return (
    <div className={styles.wrap}>
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <span className={styles.statNum}>{summary.total ?? '—'}</span>
          <span className={styles.statLabel}>Total Comments</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statNum}>{summary.unique_authors ?? '—'}</span>
          <span className={styles.statLabel}>Unique Authors</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statNum}>{summary.total_likes ?? '—'}</span>
          <span className={styles.statLabel}>Total Likes</span>
        </div>
        <div className={styles.refreshCard}>
          <button className={styles.refreshBtn} onClick={fetchData} disabled={loading}>
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Unique authors */}
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Unique Commenters ({uniqueAuthors.length})</h2>
        <div className={styles.authorList}>
          {uniqueAuthors.map((name, i) => (
            <span key={i} className={styles.authorChip}>{name}</span>
          ))}
          {uniqueAuthors.length === 0 && <p className={styles.hint}>No commenters yet.</p>}
        </div>
      </div>

      {/* Comment history */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>Comment History</h2>
          <input
            className={styles.search}
            placeholder="Search comments…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        {error && <p className={styles.errorMsg}>{error}</p>}
        {!loading && !error && filtered.length === 0 && (
          <p className={styles.hint}>No comments found.</p>
        )}
        {filtered.length > 0 && (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Author</th>
                <th>Comment</th>
                <th>Article</th>
                <th>Likes</th>
                <th>Reply</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(row => (
                <tr key={row.id}>
                  <td>
                    <div className={styles.author}>{row.author}</div>
                    <div className={styles.muted}>{row.email || row.device_id?.slice(0, 8) + '…'}</div>
                  </td>
                  <td className={styles.body}>{row.body}</td>
                  <td className={styles.postTitle}>{row.post_title || `Post #${row.post_id}`}</td>
                  <td className={styles.mono}>{row.like_count}</td>
                  <td className={styles.muted}>{row.parent_id ? `↳ #${row.parent_id}` : '—'}</td>
                  <td className={styles.muted}>{timeAgo(row.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
