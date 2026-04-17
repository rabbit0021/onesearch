import { useState, useCallback } from 'react'
import { getPosts } from '../../api'
import SecretKeyModal from '../../components/admin/SecretKeyModal/SecretKeyModal'
import PostsTable from '../../components/admin/PostsTable/PostsTable'
import PublishersTab from '../../components/admin/PublishersTab/PublishersTab'
import styles from './AdminPosts.module.css'

const TABS = ['Posts', 'Publishers']

export default function AdminPosts() {
  const [secretKey, setSecretKey] = useState('')
  const [posts, setPosts]         = useState([])
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [tab, setTab]             = useState('Posts')

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
        <h1 className={styles.title}>Admin</h1>
        <div className={styles.actions}>
          {tab === 'Posts' && (
            <button className={styles.reloadBtn} onClick={reload} disabled={loading}>
              {loading ? 'Loading…' : '↻ Refresh'}
            </button>
          )}
          <button
            className={styles.logoutBtn}
            onClick={() => { setSecretKey(''); setPosts([]) }}
          >
            Logout
          </button>
        </div>
      </div>

      <div className={styles.tabs}>
        {TABS.map(t => (
          <button
            key={t}
            className={`${styles.tab} ${tab === t ? styles.tabActive : ''}`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {tab === 'Posts' && (
        loading
          ? <p className={styles.loading}>Loading posts…</p>
          : <PostsTable posts={posts} secretKey={secretKey} onUpdated={reload} />
      )}

      {tab === 'Publishers' && (
        <PublishersTab secretKey={secretKey} />
      )}
    </div>
  )
}
