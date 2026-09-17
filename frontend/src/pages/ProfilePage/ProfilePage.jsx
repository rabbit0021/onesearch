import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { getSubscriptionsForEmail, deleteSubscription, updateSubscriptionFrequency } from '../../api'
import { INDIVIDUALS_META } from '../../data/individuals'
import ThemeSwitcher from '../../components/layout/ThemeSwitcher/ThemeSwitcher'
import styles from './ProfilePage.module.css'

const FREQ_OPTIONS = [
  { value: 0, label: 'immediate' },
  { value: 1, label: 'daily' },
  { value: 2, label: 'every 2 days' },
  { value: 3, label: 'every 3 days' },
  { value: 7, label: 'weekly' },
  { value: 14, label: 'fortnightly' },
]

function publisherFavicon(name) {
  const slug = name.toLowerCase().replace(/\s+/g, '')
  return `https://www.google.com/s2/favicons?domain=${slug}.com&sz=64`
}

function ConfirmDialog({ name, onConfirm, onCancel }) {
  return (
    <div className={styles.overlay} onMouseDown={e => { if (e.target === e.currentTarget) onCancel() }}>
      <div className={styles.dialog}>
        <div className={styles.dialogIcon}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#d94f4f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            <path d="M10 11v6M14 11v6"/>
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
          </svg>
        </div>
        <h2 className={styles.dialogHeading}>remove subscription?</h2>
        <p className={styles.dialogSub}>you'll stop receiving digests from <strong>{name}</strong></p>
        <div className={styles.dialogActions}>
          <button className={styles.dialogConfirm} onClick={onConfirm}>remove</button>
          <button className={styles.dialogCancel} onClick={onCancel}>cancel</button>
        </div>
      </div>
    </div>
  )
}

function SubscriptionCard({ sub, email, onRemove }) {
  const [freq, setFreq] = useState(sub.frequency_in_days ?? 3)
  const [saving, setSaving] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [removing, setRemoving] = useState(false)

  const individualMeta = INDIVIDUALS_META[sub.publisher.publisher_name?.toLowerCase()]
  const thumb = individualMeta?.image?.replace(/(\.[^.]+)$/, '-thumb$1')
  const favicon = publisherFavicon(sub.publisher.publisher_name)

  async function handleFreqChange(e) {
    const val = Number(e.target.value)
    setFreq(val)
    setSaving(true)
    try { await updateSubscriptionFrequency(sub.id, email, val) }
    finally { setSaving(false) }
  }

  async function handleConfirmRemove() {
    setConfirming(false)
    setRemoving(true)
    try {
      await deleteSubscription(sub.id, email)
      onRemove(sub.id)
    } finally { setRemoving(false) }
  }

  const joinedDate = sub.joined_time
    ? new Date(sub.joined_time).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : null

  return (
    <>
      {confirming && (
        <ConfirmDialog
          name={sub.publisher.publisher_name}
          onConfirm={handleConfirmRemove}
          onCancel={() => setConfirming(false)}
        />
      )}
      <div className={styles.card}>
        <button
          className={styles.removeBtn}
          onClick={() => setConfirming(true)}
          disabled={removing}
          aria-label="Remove subscription"
        >
          {removing ? '…' : (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              <path d="M10 11v6M14 11v6"/>
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
            </svg>
          )}
        </button>

        <div className={styles.cardLogo}>
          {thumb ? (
            <img src={thumb} alt={sub.publisher.publisher_name} className={styles.logoImg} />
          ) : (
            <img
              src={favicon}
              alt={sub.publisher.publisher_name}
              className={styles.logoImg}
              onError={e => {
                e.currentTarget.style.display = 'none'
                e.currentTarget.nextSibling.style.display = 'flex'
              }}
            />
          )}
          <div className={styles.logoFallback} style={{ display: 'none' }}>
            {sub.publisher.publisher_name[0].toUpperCase()}
          </div>
        </div>

        <div className={styles.cardBody}>
          <div className={styles.cardTop}>
            <span className={styles.cardName}>{sub.publisher.publisher_name}</span>
            {joinedDate && <span className={styles.cardJoined}>since {joinedDate}</span>}
          </div>
          <span className={styles.cardType}>{sub.publisher.publisher_type}</span>
          <div className={styles.cardFooter}>
            <label className={styles.freqLabel}>digest</label>
            <select className={styles.freqSelect} value={freq} onChange={handleFreqChange} disabled={saving}>
              {FREQ_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            {saving && <span className={styles.saving}>saving…</span>}
          </div>
        </div>
      </div>
    </>
  )
}

export default function ProfilePage() {
  const { email, logout } = useAuth()
  const navigate = useNavigate()
  const [subs, setSubs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!email) { navigate('/'); return }
    getSubscriptionsForEmail(email).then(setSubs).finally(() => setLoading(false))
  }, [email, navigate])

  const handleRemove = useCallback((id) => setSubs(prev => prev.filter(s => s.id !== id)), [])

  const [query, setQuery] = useState('')

  const filtered = query.trim()
    ? subs.filter(s => s.publisher.publisher_name.toLowerCase().includes(query.toLowerCase()))
    : subs

  const grouped = filtered.reduce((acc, s) => {
    const t = s.topic || 'General'
    if (!acc[t]) acc[t] = []
    acc[t].push(s)
    return acc
  }, {})

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <button className={styles.backBtn} onClick={() => navigate(-1)}>← back</button>
        <div className={styles.topMeta}>
          <div className={styles.avatar}>{email[0]?.toUpperCase()}</div>
          <span className={styles.emailLabel}>{email}</span>
        </div>
        <div className={styles.topBarRight}>
          <ThemeSwitcher bare />
          <button className={styles.logoutBtn} onClick={() => { logout(); navigate('/') }}>sign out</button>
        </div>
      </div>

      <div className={styles.container}>
        {!loading && subs.length > 0 && (
          <div className={styles.searchWrap}>
            <svg className={styles.searchIcon} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              className={styles.searchInput}
              type="text"
              placeholder="search subscriptions…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
            {query && (
              <button className={styles.searchClear} onClick={() => setQuery('')}>×</button>
            )}
          </div>
        )}
        {loading && <p className={styles.empty}>loading…</p>}
        {!loading && subs.length === 0 && <p className={styles.empty}>no active subscriptions</p>}
        {!loading && query && filtered.length === 0 && <p className={styles.empty}>no results for "{query}"</p>}
        {!loading && Object.entries(grouped).map(([topic, items]) => (
          <div key={topic} className={styles.group}>
            <p className={styles.topicLabel}>{topic} <span className={styles.topicCount}>{items.length}</span></p>
            <div className={styles.cardGrid}>
              {items.map(s => <SubscriptionCard key={s.id} sub={s} email={email} onRemove={handleRemove} />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
