import { useState, useRef, useEffect } from 'react'
import { likePost, getIndividualStats } from '../../../api'
import EmailDialog, { getSavedEmail } from '../../ui/EmailDialog/EmailDialog'
import ImageLightbox from '../../ui/ImageLightbox/ImageLightbox'
import { INDIVIDUALS_META } from '../../../data/individuals'
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
  const individualMeta = INDIVIDUALS_META[post.publisher?.toLowerCase()]
  const individualThumb = individualMeta?.image?.replace(/(\.[^.]+)$/, '-thumb$1')
  const tags = post.tags ? post.tags.split(',').map(t => t.trim()).filter(Boolean) : []
  const match = post.matched_issue

  const tagsContainerRef = useRef(null)
  const [tagsSlice, setTagsSlice] = useState(null)

  useEffect(() => {
    const container = tagsContainerRef.current
    if (!container) return
    const els = Array.from(container.querySelectorAll('[data-tag]'))
    if (!els.length) return
    const seenTops = []
    for (const el of els) {
      const top = el.offsetTop
      if (!seenTops.includes(top)) seenTops.push(top)
      if (seenTops.length === 3) {
        const idx = els.indexOf(el)
        setTagsSlice(Math.max(1, idx - 1))
        return
      }
    }
    setTagsSlice(null)
  }, [post.tags])

  const [displayCount, setDisplayCount] = useState(post.like_count || 0)
  const [showEmailDialog, setShowEmailDialog] = useState(false)
  const [showLightbox, setShowLightbox] = useState(false)
  const [individualLikeCount, setIndividualLikeCount] = useState(null)

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
    {showLightbox && individualMeta && (
      <ImageLightbox
        image={individualMeta.image}
        name={post.publisher}
        realName={individualMeta.realName}
        website={individualMeta.website}
        likeCount={individualLikeCount}
        onClose={() => setShowLightbox(false)}
      />
    )}
    <a
      href={post.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`${styles.card} ${match ? styles.cardMatched : ''}`}
    >
      <div className={styles.thumbnail} style={{ background: color }}>
        {individualThumb ? (
          <div className={styles.individualProfile}>
            <img
              src={individualThumb}
              alt={post.publisher}
              className={styles.individualAvatar}
              onError={e => { e.currentTarget.style.display = 'none' }}
              onClick={e => {
                e.preventDefault()
                e.stopPropagation()
                setShowLightbox(true)
                getIndividualStats().then(stats => {
                  setIndividualLikeCount(stats[post.publisher?.toLowerCase()] ?? 0)
                }).catch(() => {})
              }}
              style={{ cursor: 'pointer' }}
            />
          </div>
        ) : favicon ? (
          <img
            src={favicon}
            alt=""
            className={styles.favicon}
            onError={e => { e.currentTarget.style.display = 'none' }}
          />
        ) : null}
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
                <span className={styles.recentPlus}>+</span>
                <span className={styles.recentCount}>{post.recent_like_count}</span>
              </div>
            )}
          </div>
        </div>
        <p className={styles.title}>{post.title}</p>
        {tags.length > 0 && (
          <div className={styles.tags} ref={tagsContainerRef}>
            {(tagsSlice !== null ? tags.slice(0, tagsSlice) : tags).map(tag => (
              <span key={tag} data-tag="" className={styles.tag}>{tag}</span>
            ))}
            {tagsSlice !== null && (
              <span className={styles.tagMore}>+{tags.length - tagsSlice} tags</span>
            )}
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
