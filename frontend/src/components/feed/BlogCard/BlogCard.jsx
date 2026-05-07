import { useState } from 'react'
import { likePost } from '../../../api'
import EmailDialog, { getSavedEmail } from '../../ui/EmailDialog/EmailDialog'
import styles from './BlogCard.module.css'

export const TOPIC_COLORS = {
  'Software Engineering': '#FF5555',
  'Frontend Engineering': '#55FFFF',
  'Backend Engineering': '#5555FF',
  'Mobile Engineering': '#FF55FF',
  'Platform & Infrastructure': '#FFAA55',
  'Data Engineering': '#55AAFF',
  'Data Science': '#AA55FF',
  'Machine Learning & AI': '#FF55AA',
  'Data Analytics': '#55FFAA',
  'Security Engineering': '#FF2222',
  'QA & Testing': '#55FF55',
  'Product Management': '#FFFF55',
  'General': '#AAAAAA',
}

export function faviconUrl(postUrl) {
  try {
    const { origin } = new URL(postUrl)
    return `https://www.google.com/s2/favicons?domain=${origin}&sz=64`
  } catch {
    return null
  }
}

export function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

export default function BlogCard({ post }) {
  const color = TOPIC_COLORS[post.topic] || TOPIC_COLORS['General']
  const favicon = faviconUrl(post.url)
  const tags = post.tags ? post.tags.split(',').map(t => t.trim()).filter(Boolean) : []
  const match = post.matched_issue

  const [displayCount, setDisplayCount] = useState(post.like_count || 0)
  const [showEmailDialog, setShowEmailDialog] = useState(false)

  async function submitLike(email) {
    try {
      const data = await likePost(post.id, email)
      if (!data.count && data.count !== 0) return
      setDisplayCount(data.count)
    } catch { /* network error, silently ignore */ }
  }

  function handleLike(e) {
    e.preventDefault()
    e.stopPropagation()
    const email = getSavedEmail()
    if (email) {
      submitLike(email)
    } else {
      setShowEmailDialog(true)
    }
  }

  return (
    <>
    {showEmailDialog && (
      <EmailDialog
        onConfirm={email => { setShowEmailDialog(false); submitLike(email) }}
        onCancel={() => setShowEmailDialog(false)}
      />
    )}
    <a
      href={post.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`${styles.card} ${match ? styles.cardMatched : ''}`}
    >
      <div className={styles.thumbnail} style={{ background: color }}>
        {favicon && (
          <img
            src={favicon}
            alt=""
            className={styles.favicon}
            onError={e => { e.currentTarget.style.display = 'none' }}
          />
        )}
        <span className={styles.topicLabel}>{post.topic}</span>
      </div>

      <div className={styles.body}>
        <div className={styles.meta}>
          <div className={styles.metadesc}>
            <span className={styles.publisher}>{post.publisher}</span>
            <span className={styles.date}>{timeAgo(post.published_at)}</span>
          </div>
          <div className={styles.iconTray}>
            <div
              className={`${styles.iconItem} ${styles.likeBtn}`}
              role="button"
              tabIndex={0}
              onClick={handleLike}
              onKeyDown={e => e.key === 'Enter' && handleLike(e)}
            >
              <span className={`${styles.heart} ${styles.heartActive} ${displayCount === 0 ? styles.heartZero : ''}`}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                </svg>
              </span>
              <span key={displayCount} className={styles.likeCounter}>{displayCount}</span>
            </div>

            {post.recent_like_count > 0 && (
              <div className={styles.iconItem}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="19" x2="12" y2="5"/>
                  <polyline points="5 12 12 5 19 12"/>
                </svg>
                <span className={styles.recentCount}>{post.recent_like_count}</span>
              </div>
            )}
          </div>
        </div>
        <p className={styles.title}>{post.title}</p>
        {tags.length > 0 && (
          <div className={styles.tags}>
            {tags.slice(0, 3).map(tag => (
              <span key={tag} className={styles.tag}>{tag}</span>
            ))}

          </div>
        )}
        {match && (
          <div className={styles.matchTip}>
            <span className={styles.matchPrompt}>▸</span>
            <span className={styles.matchKey}>{match.key}</span>
            <span className={styles.matchSummary}>{match.summary}</span>
          </div>
        )}
      </div>
    </a>
    </>
  )
}
