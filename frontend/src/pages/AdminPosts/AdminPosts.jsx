import { useState, useCallback } from 'react'
import { getPosts } from '../../api'
import SecretKeyModal from '../../components/admin/SecretKeyModal/SecretKeyModal'
import PostsTable from '../../components/admin/PostsTable/PostsTable'
import styles from './AdminPosts.module.css'

export default function AdminPosts() {
  const [secretKey, setSecretKey] = useState('')
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleKeySubmit(key) {
    setSecretKey(key)
    setError('')
    setLoading(true)
    try {
      const data = await getPosts(key)
      if (Array.isArray(data)) {
        setPosts(data)
      } else {
        setError('Unauthorized or invalid key.')
        setSecretKey('')
      }
    } catch (err) {
      setError(err.message || 'Failed to load posts.')
      setSecretKey('')
    } finally {
      setLoading(false)
    }
  }

  const reload = useCallback(() => {
    if (secretKey) handleKeySubmit(secretKey)
  }, [secretKey])

  if (!secretKey) {
    return <SecretKeyModal onSubmit={handleKeySubmit} />
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Posts Admin</h1>
        <div className={styles.actions}>
          <button className={styles.reloadBtn} onClick={reload} disabled={loading}>
            {loading ? 'Loading…' : '↻ Refresh'}
          </button>
          <button
            className={styles.logoutBtn}
            onClick={() => {
              setSecretKey('')
              setPosts([])
            }}
          >
            Logout
          </button>
        </div>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {loading ? (
        <p className={styles.loading}>Loading posts…</p>
      ) : (
        <PostsTable posts={posts} secretKey={secretKey} onUpdated={reload} />
      )}
    </div>
  )
}
