import { useState, useCallback, useEffect } from 'react'
import { getPosts } from '../../api'
import SecretKeyModal from '../../components/admin/SecretKeyModal/SecretKeyModal'
import PostsTable from '../../components/admin/PostsTable/PostsTable'
import PublishersTab from '../../components/admin/PublishersTab/PublishersTab'
import SubscriptionsTab from '../../components/admin/SubscriptionsTab/SubscriptionsTab'
import JobsTab from '../../components/admin/JobsTab/JobsTab'
import NotificationsTab from '../../components/admin/NotificationsTab/NotificationsTab'
import FeedbackTab from '../../components/admin/FeedbackTab/FeedbackTab'
import LikesTab from '../../components/admin/LikesTab/LikesTab'
import ReadingEventsTab from '../../components/admin/ReadingEventsTab/ReadingEventsTab'
import ChatLogsTab from '../../components/admin/ChatLogsTab/ChatLogsTab'
import NewsBannersTab from '../../components/admin/NewsBannersTab/NewsBannersTab'
import CommentsTab from '../../components/admin/CommentsTab/CommentsTab'
import styles from './AdminPosts.module.css'

function JevWinnersTab({ secretKey }) {
  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')  // 'all' | 'winners'

  useEffect(() => {
    fetch('/api/admin/jev-games', { headers: { 'X-SECRET-KEY': secretKey } })
      .then(r => r.json())
      .then(data => { setGames(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [secretKey])

  if (loading) return <p style={{ padding: '1rem' }}>Loading...</p>

  const shown = filter === 'winners' ? games.filter(g => g.score >= 10) : games

  return (
    <div style={{ padding: '1rem', overflowX: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem' }}>
        <h3 style={{ margin: 0 }}>⚡ Jev Games ({games.length})</h3>
        <select value={filter} onChange={e => setFilter(e.target.value)} style={{ fontSize: '0.85rem', padding: '0.25rem 0.5rem' }}>
          <option value="all">All games</option>
          <option value="winners">Winners only (score 10)</option>
        </select>
      </div>
      {!shown.length
        ? <p>No games found.</p>
        : <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#f5f5f5', textAlign: 'left' }}>
                <th style={th}>#</th>
                <th style={th}>Score</th>
                <th style={th}>Joke</th>
                <th style={th}>Environment</th>
                <th style={th}>Email</th>
                <th style={th}>Device</th>
                <th style={th}>Date</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((g, i) => (
                <tr key={g.id} style={{ borderBottom: '1px solid #eee', background: g.score >= 10 ? '#fffbe6' : 'white' }}>
                  <td style={td}>{i + 1}</td>
                  <td style={{ ...td, fontWeight: 700, color: g.score >= 10 ? '#b8860b' : g.score >= 7 ? 'green' : g.score >= 4 ? '#888' : '#c00' }}>
                    {g.score}/10 {g.score >= 10 ? '🏆' : ''}
                  </td>
                  <td style={{ ...td, maxWidth: 360 }}>{g.joke}</td>
                  <td style={td}>{(() => { try { return g.env_labels ? JSON.parse(g.env_labels).join(', ') : '—' } catch { return g.env_labels || '—' } })()}</td>
                  <td style={td}>{g.email || '—'}</td>
                  <td style={{ ...td, fontFamily: 'monospace', fontSize: '0.72rem' }}>{g.device_id}</td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>{new Date(g.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
      }
    </div>
  )
}

const th = { padding: '0.5rem 0.75rem', fontWeight: 600, whiteSpace: 'nowrap' }
const td = { padding: '0.5rem 0.75rem', verticalAlign: 'top' }

const TABS = ['Posts', 'Publishers', 'Subscriptions', 'Notifications', 'Jobs', 'Feedback', 'Likes', 'Reading', 'Chat', 'Comments', 'News', 'Jev Winners']
const STORAGE_KEY = 'admin_secret_key'

function saveKey(key) {
  sessionStorage.setItem(STORAGE_KEY, key)
}

function loadKey() {
  return sessionStorage.getItem(STORAGE_KEY) || null
}

function clearKey() {
  sessionStorage.removeItem(STORAGE_KEY)
}

export default function AdminPosts() {
  // Force light theme for admin — independent of user preference
  useEffect(() => {
    const prev = document.documentElement.getAttribute('data-theme')
    document.documentElement.removeAttribute('data-theme')
    return () => {
      if (prev) document.documentElement.setAttribute('data-theme', prev)
    }
  }, [])

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

      {tab === 'Feedback' && (
        <FeedbackTab secretKey={secretKey} />
      )}

      {tab === 'Likes' && (
        <LikesTab secretKey={secretKey} />
      )}

      {tab === 'Reading' && (
        <ReadingEventsTab secretKey={secretKey} />
      )}

      {tab === 'Chat' && (
        <ChatLogsTab secretKey={secretKey} />
      )}

      {tab === 'Comments' && (
        <CommentsTab secretKey={secretKey} />
      )}

      {tab === 'News' && (
        <NewsBannersTab secretKey={secretKey} />
      )}

      {tab === 'Jev Winners' && (
        <JevWinnersTab secretKey={secretKey} />
      )}
    </div>
  )
}
