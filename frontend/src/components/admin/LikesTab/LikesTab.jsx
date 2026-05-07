import { useState, useEffect, useCallback } from 'react'
import { getAdminLikes } from '../../../api'
import styles from './LikesTab.module.css'

export default function LikesTab({ secretKey }) {
  const [likes, setLikes]     = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  const fetchLikes = useCallback(() => {
    setLoading(true)
    getAdminLikes(secretKey)
      .then(setLikes)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [secretKey])

  useEffect(() => { fetchLikes() }, [fetchLikes])

  if (error) return <p className={styles.errorMsg}>{error}</p>

  const byPost = likes.reduce((acc, row) => {
    const key = row.url
    if (!acc[key]) acc[key] = { title: row.title, publisher: row.publisher, url: row.url, total: row.total_likes, likers: [] }
    acc[key].likers.push({ email: row.user_email, at: row.liked_at })
    return acc
  }, {})

  const posts = Object.values(byPost).sort((a, b) => b.total - a.total)

  return (
    <div className={styles.wrap}>
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <span className={styles.statNum}>{loading ? '—' : likes.length}</span>
          <span className={styles.statLabel}>Total Likes</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statNum}>{loading ? '—' : posts.length}</span>
          <span className={styles.statLabel}>Liked Posts</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statNum}>{loading ? '—' : new Set(likes.map(l => l.user_email)).size}</span>
          <span className={styles.statLabel}>Unique Users</span>
        </div>
        <div className={styles.refreshCard}>
          <button className={styles.refreshBtn} onClick={fetchLikes} disabled={loading}>
            {loading ? '…' : '↻ Refresh'}
          </button>
        </div>
      </div>

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Likes by Post</h2>
        {loading
          ? <p className={styles.hint}>Loading…</p>
          : posts.length === 0
            ? <p className={styles.hint}>No likes yet.</p>
            : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Post</th>
                    <th>Publisher</th>
                    <th>Likes</th>
                    <th>Liked By</th>
                  </tr>
                </thead>
                <tbody>
                  {posts.map(post => (
                    <tr key={post.url}>
                      <td>
                        <a href={post.url} target="_blank" rel="noopener noreferrer" className={styles.postLink}>
                          {post.title}
                        </a>
                      </td>
                      <td className={styles.muted}>{post.publisher}</td>
                      <td className={styles.count}>{post.total}</td>
                      <td className={styles.emailList}>
                        {post.likers.map((l, i) => (
                          <span key={i} className={styles.emailPill} title={new Date(l.at).toLocaleString()}>
                            {l.email}
                          </span>
                        ))}
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
