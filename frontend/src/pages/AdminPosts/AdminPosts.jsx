import { useState, useCallback, useEffect } from 'react'
import { getPosts } from '../../api'
import SecretKeyModal from '../../components/admin/SecretKeyModal/SecretKeyModal'
import PostsTable from '../../components/admin/PostsTable/PostsTable'
import PublishersTab from '../../components/admin/PublishersTab/PublishersTab'
import SubscriptionsTab from '../../components/admin/SubscriptionsTab/SubscriptionsTab'
import JobsTab from '../../components/admin/JobsTab/JobsTab'
import NotificationsTab from '../../components/admin/NotificationsTab/NotificationsTab'
import styles from './AdminPosts.module.css'

const TABS = ['Posts', 'Publishers', 'Subscriptions', 'Notifications', 'Jobs']
const STORAGE_KEY = 'admin_secret_key'
const TTL_MS = 3 * 24 * 60 * 60 * 1000 // 3 days

function saveKey(key) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ key, expires: Date.now() + TTL_MS }))
}

function loadKey() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const { key, expires } = JSON.parse(raw)
    if (Date.now() > expires) { localStorage.removeItem(STORAGE_KEY); return null }
    return key
  } catch { return null }
}

function clearKey() {
  localStorage.removeItem(STORAGE_KEY)
}

export default function AdminPosts() {
  const [secretKey, setSecretKey] = useState('')
  const [posts, setPosts]         = useState([])
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [tab, setTab]             = useState('Posts')

  // Auto-login on mount if a valid saved key exists
  useEffect(() => {
    const saved = loadKey()
    if (saved) handleKeySubmit(saved)
  }, [])

  async function handleKeySubmit(key) {
    setError('')
    setLoading(true)
    try {
      const data = await getPosts(key)
      if (Array.isArray(data)) {
        setSecretKey(key)
        setPosts(data)
        saveKey(key)
      } else {
        setError('Unauthorized or invalid key.')
        clearKey()
      }
    } catch (err) {
      setError(err.message || 'Failed to load posts.')
      clearKey()
    } finally {
      setLoading(false)
    }
  }

  const reload = useCallback(() => {
    if (secretKey) handleKeySubmit(secretKey)
  }, [secretKey])

  if (!secretKey && !loading) {
    return <SecretKeyModal onSubmit={handleKeySubmit} error={error} loading={loading} />
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
            onClick={() => { setSecretKey(''); setPosts([]); clearKey() }}
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

      {tab === 'Subscriptions' && (
        <SubscriptionsTab secretKey={secretKey} />
      )}

      {tab === 'Notifications' && (
        <NotificationsTab secretKey={secretKey} />
      )}

      {tab === 'Jobs' && (
        <JobsTab secretKey={secretKey} />
      )}
    </div>
  )
}
