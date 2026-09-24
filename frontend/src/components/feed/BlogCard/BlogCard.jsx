import { useState, useRef, useEffect } from 'react'
import Markdown from 'react-markdown'
import { useNavigate } from 'react-router-dom'
import { likePost, getLikedPostIds, getIndividualStats, recordView, getOrCreateDeviceId, getPostSummary } from '../../../api'
import EmailDialog, { getSavedEmail } from '../../ui/EmailDialog/EmailDialog'
import ImageLightbox from '../../ui/ImageLightbox/ImageLightbox'
import { INDIVIDUALS_META } from '../../../data/individuals'
import { useTheme } from '../../../context/ThemeContext'
import { useToast } from '../../../context/ToastContext'
import styles from './BlogCard.module.css'

const PALETTES = {
  // Original neon
  neon: {
    'Software Engineering':       '#FF5555',
    'Frontend Engineering':       '#55FFFF',
    'Backend Engineering':        '#5555FF',
    'Mobile Engineering':         '#FF55FF',
    'Platform & Infrastructure':  '#FFAA55',
    'Data Engineering':           '#55AAFF',
    'Data Science':               '#AA55FF',
    'Machine Learning & AI':      '#FF55AA',
    'Data Analytics':             '#55FFAA',
    'Security Engineering':       '#FF2222',
    'QA & Testing':               '#55FF55',
    'Product Management':         '#FFFF55',
    'General':                    '#AAAAAA',
  },
  // Tailwind-700 deep
  deep: {
    'Software Engineering':       '#2563EB',
    'Frontend Engineering':       '#0891B2',
    'Backend Engineering':        '#6D28D9',
    'Mobile Engineering':         '#BE185D',
    'Platform & Infrastructure':  '#C2410C',
    'Data Engineering':           '#0369A1',
    'Data Science':               '#7C3AED',
    'Machine Learning & AI':      '#9D174D',
    'Data Analytics':             '#047857',
    'Security Engineering':       '#B91C1C',
    'QA & Testing':               '#15803D',
    'Product Management':         '#B45309',
    'General':                    '#475569',
  },
  // Jewel tones — dark, muted, premium
  jewel: {
    'Software Engineering':       '#1A3A5C',
    'Frontend Engineering':       '#0D4A4A',
    'Backend Engineering':        '#2D1B69',
    'Mobile Engineering':         '#5C1A4A',
    'Platform & Infrastructure':  '#5C2D0A',
    'Data Engineering':           '#0A3D5C',
    'Data Science':               '#3D1A5C',
    'Machine Learning & AI':      '#5C1A2D',
    'Data Analytics':             '#1A4A2D',
    'Security Engineering':       '#4A0D0D',
    'QA & Testing':               '#1A4A1A',
    'Product Management':         '#4A3000',
    'General':                    '#2D3748',
  },
  // Wizard grays — --bg-wizard at varying opacities
  wizard: {
    'Software Engineering':       'color-mix(in srgb, var(--bg-card-thumbnail) 80%, transparent)',
    'Frontend Engineering':       'color-mix(in srgb, var(--bg-card-thumbnail) 65%, transparent)',
    'Backend Engineering':        'color-mix(in srgb, var(--bg-card-thumbnail) 20%, transparent)',
    'Mobile Engineering':         'color-mix(in srgb, var(--bg-card-thumbnail) 40%, transparent)',
    'Platform & Infrastructure':  'color-mix(in srgb, var(--bg-card-thumbnail) 30%, transparent)',
    'Data Engineering':           'color-mix(in srgb, var(--bg-card-thumbnail) 70%, transparent)',
    'Data Science':               'color-mix(in srgb, var(--bg-card-thumbnail) 55%, transparent)',
    'Machine Learning & AI':      'color-mix(in srgb, var(--bg-card-thumbnail) 45%, transparent)',
    'Data Analytics':             'color-mix(in srgb, var(--bg-card-thumbnail) 35%, transparent)',
    'Security Engineering':       'color-mix(in srgb, var(--bg-card-thumbnail) 25%, transparent)',
    'QA & Testing':               'color-mix(in srgb, var(--bg-card-thumbnail) 60%, transparent)',
    'Product Management':         'color-mix(in srgb, var(--bg-card-thumbnail) 75%, transparent)',
    'General':                    'color-mix(in srgb, var(--bg-card-thumbnail) 20%, transparent)',
  },
  // Soft pastels — light, airy, smooth
  soft: {
    'Software Engineering':       '#93C5FD',
    'Frontend Engineering':       '#67E8F9',
    'Backend Engineering':        '#A5B4FC',
    'Mobile Engineering':         '#F9A8D4',
    'Platform & Infrastructure':  '#FCA5A5',
    'Data Engineering':           '#7DD3FC',
    'Data Science':               '#C4B5FD',
    'Machine Learning & AI':      '#FDA4AF',
    'Data Analytics':             '#6EE7B7',
    'Security Engineering':       '#FCA5A5',
    'QA & Testing':               '#86EFAC',
    'Product Management':         '#FCD34D',
    'General':                    '#CBD5E1',
  },
  // Nature — muted, warm-neutral friendly, easy on the eyes
  nature: {
    'Software Engineering':       '#5B8DB8',  // ocean blue
    'Frontend Engineering':       '#4A9E8E',  // teal
    'Backend Engineering':        '#7B6FAB',  // soft purple
    'Mobile Engineering':         '#C47E6B',  // terracotta
    'Platform & Infrastructure':  '#C4964A',  // amber
    'Data Engineering':           '#4A8FA8',  // steel blue
    'Data Science':               '#9B6BAE',  // lavender
    'Machine Learning & AI':      '#7A9E6B',  // sage green
    'Data Analytics':             '#5BA88A',  // sea green
    'Security Engineering':       '#B85B5B',  // muted red
    'QA & Testing':               '#6B9E7A',  // forest
    'Product Management':         '#B8935B',  // warm sand
    'General':                    '#8A9BAB',  // slate
  },
  // Sunset dark — same sunset hues, mid-tone for dark bg (#22201e)
  sunsetDark: {
    'Software Engineering':       '#3A7A9E',
    'Frontend Engineering':       '#3A8A8A',
    'Backend Engineering':        '#6A5A9E',
    'Mobile Engineering':         '#9E5A6A',
    'Platform & Infrastructure':  '#9E6A3A',
    'Data Engineering':           '#2E6A8A',
    'Data Science':               '#7A5A9E',
    'Machine Learning & AI':      '#9E5A6E',
    'Data Analytics':             '#3A7A9E',
    'Security Engineering':       '#9E3A4A',
    'QA & Testing':               '#3A7A7A',
    'Product Management':         '#C4845A',
    'General':                    '#6A6A8A',
  },
  // Sunset — inspired by peach→coral→mauve→periwinkle→ocean gradient
  sunset: {
    'Software Engineering':       '#00577F',  // deep ocean
    'Frontend Engineering':       '#2E8AB0',  // cyan-teal
    'Backend Engineering':        '#6B5EA8',  // purple
    'Mobile Engineering':         '#E08C3A',  // warm orange
    'Platform & Infrastructure':  '#ED717F',  // coral
    'Data Engineering':           '#2E8A6A',  // teal green
    'Data Science':               '#9B6E9E',  // soft violet
    'Machine Learning & AI':      '#D4828E',  // dusty rose
    'Data Analytics':             '#5B8FAE',  // sky blue
    'Security Engineering':       '#B05A6A',  // deep coral
    'QA & Testing':               '#6E8EAE',  // muted blue
    'Product Management':         '#F5AD92',  // peach
    'General':                    '#A0A0A0',  // neutral gray
  },
}

export const TOPIC_COLORS = PALETTES.soft // fallback for external imports

export function faviconUrl(postUrl) {
  try {
    const { origin } = new URL(postUrl)
    return `https://www.google.com/s2/favicons?domain=${origin}&sz=64`
  } catch {
    return null
  }
}

export function publisherIconUrl(publisher) {
  if (!publisher) return null
  return `https://cdn.simpleicons.org/${encodeURIComponent(publisher.toLowerCase().replace(/\s+/g, ''))}`
}

export function fireToStars(fireCount) {
  if (!fireCount || fireCount <= 0) return 0
  if (fireCount <= 20) return 1
  if (fireCount <= 40) return 2
  if (fireCount <= 60) return 3
  if (fireCount <= 80) return 4
  return 5
}

export function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Today'
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

export default function BlogCard({ post, readProgress, likedPostIds = new Set(), setLikedPostIds }) {
  const navigate = useNavigate()
  const { darkMode } = useTheme()
  const { showToast } = useToast()
  const palette = darkMode ? PALETTES.wizard : PALETTES.wizard
  const color = palette[post.topic] || palette['General']
  const accent = PALETTES.sunset[post.topic] || PALETTES.sunset['General']
  const favicon = faviconUrl(post.url)
  const publisherIcon = publisherIconUrl(post.publisher)
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

  // summary state: null | 'widget' | 'loading' | 'done'
  const [summaryState, setSummaryState] = useState('widget')
  const [summary, setSummary] = useState(post.summary || null)
  const [hovered, setHovered] = useState(false)
  const hoverTimer = useRef(null)

  function handleMouseEnter() {
    hoverTimer.current = setTimeout(() => {
      setHovered(true)
    }, 1200)
  }

  function handleMouseLeave() {
    clearTimeout(hoverTimer.current)
    setHovered(false)
  }

  const [flipped, setFlipped] = useState(false)
  const [backVisible, setBackVisible] = useState(false)
  const cardOuterRef = useRef(null)

  function flipOpen() {
    setBackVisible(false)
    setFlipped(true)
    // content fades in after rotation settles
    setTimeout(() => setBackVisible(true), 400)
    setTimeout(() => {
      cardOuterRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
    }, 500)
  }

  function handleSummarize(e) {
    e.stopPropagation()
    if (summary) { flipOpen(); return }
    setSummaryState('loading')
    getPostSummary(post.id)
      .then(data => { setSummary(data.summary); setSummaryState('done'); flipOpen() })
      .catch(() => setSummaryState('widget'))
  }

  function handleFlipBack(e) {
    e.stopPropagation()
    // fade out content first, then rotate back
    setBackVisible(false)
    setTimeout(() => {
      setFlipped(false)
      setSummaryState('widget')
    }, 280)
  }

  const [displayCount, setDisplayCount] = useState(post.like_count || 0)
  const [viewCount, setViewCount] = useState(Math.max(post.view_count || 0, post.like_count || 0))
  const [showEmailDialog, setShowEmailDialog] = useState(false)
  const [showLightbox, setShowLightbox] = useState(false)
  const [individualLikeCount, setIndividualLikeCount] = useState(null)

  function handleCardClick(e) {
    e.preventDefault()
    const email = getSavedEmail()
    const userIdentifier = email || 'anonymous'
    const deviceId = getOrCreateDeviceId()
    recordView(post.id, userIdentifier, deviceId).then(() => {
      setViewCount(c => Math.max(c + 1, displayCount))
    }).catch(() => {})
    navigate(`/read/${post.id}`, { state: { post } })
  }

  async function submitLike(email) {
    try {
      const data = await likePost(post.id, email)
      if (!data.count && data.count !== 0) return
      setDisplayCount(data.count)
      if (setLikedPostIds) {
        setLikedPostIds(prev => {
          const next = new Set(prev)
          data.is_new ? next.add(post.id) : next.delete(post.id)
          return next
        })
      }
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
        onConfirm={async email => {
          setShowEmailDialog(false)
          const ids = await getLikedPostIds(email)
          if (ids.includes(post.id)) {
            if (setLikedPostIds) setLikedPostIds(prev => new Set([...prev, post.id]))
            showToast('You already liked this post!')
            return
          }
          submitLike(email)
        }}
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
    <div className={styles.cardPerspective}>
    <div
      ref={cardOuterRef}
      className={`${styles.cardOuter} ${flipped ? styles.cardFlipped : ''}`}
      style={{ '--card-accent': accent }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* FRONT */}
      <div
        className={`${styles.card} ${styles.cardFront} ${match ? styles.cardMatched : ''}`}
        onClick={handleCardClick}
        role="link"
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && handleCardClick(e)}
        style={{ cursor: 'pointer' }}
      >
        <div className={styles.cardHeader}>
          {individualThumb ? (
            <div className={styles.individualProfile}>
              <img
                src={individualThumb}
                alt={post.publisher}
                className={styles.individualAvatar}
                onError={e => { e.currentTarget.style.display = 'none' }}
                style={{ cursor: 'pointer' }}
              />
            </div>
          ) : publisherIcon ? (
            <img
              src={publisherIcon}
              alt=""
              className={styles.favicon}
              onError={e => { e.currentTarget.src = favicon || ''; if (!favicon) e.currentTarget.style.display = 'none' }}
            />
          ) : null}
          <span className={styles.publisherName}>{post.publisher}</span>
        </div>

        {readProgress != null && (
          <div className={styles.readProgress}>
            <div className={styles.readProgressBar} style={{ width: `${readProgress}%` }} />
          </div>
        )}

        <div className={styles.body}>
          <div className={styles.meta}>
            <div className={styles.metadesc}>
              <span className={styles.date}>{timeAgo(post.published_at)}</span>
            </div>
            <div className={styles.iconTray}>
              <div className={`${styles.iconItem} ${styles.viewItem}`}>
                <svg className={styles.viewIcon} width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5C21.27 7.61 17 4.5 12 4.5zm0 12.5c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                </svg>
                <span className={styles.viewCounter}>{viewCount}</span>
              </div>

              {fireToStars(post.fire_count) > 0 && (
                <div className={`${styles.iconItem} ${styles.starItem}`}>
                  <div className={styles.starRating}>
                    <svg className={styles.starFilled} width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 3l2.45 4.97 5.48.8-3.97 3.87.94 5.46L12 15.6l-4.9 2.57.94-5.46L4.07 8.77l5.48-.8z"/>
                    </svg>
                    <span className={styles.starCount}>{fireToStars(post.fire_count)}</span>
                  </div>
                </div>
              )}

              <div
                className={`${styles.iconItem} ${styles.likeBtn}`}
                role="button"
                tabIndex={0}
                onClick={handleLike}
                onKeyDown={e => e.key === 'Enter' && handleLike(e)}
              >
                <span className={`${styles.heart} ${styles.heartActive} ${!likedPostIds.has(post.id) ? styles.heartZero : ''}`}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
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


          <span className={styles.topicLabel}><span className={styles.topicDot}>●</span>{post.topic}</span>
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

        {summaryState === 'loading' && (
          <div className={`${styles.summaryWidget} ${styles.summaryWidgetVisible}`}>
            <span className={styles.summaryDot} />
            <span className={styles.summaryDot} />
            <span className={styles.summaryDot} />
          </div>
        )}

        {summaryState === 'widget' && (
          <button
            className={`${styles.summaryWidget} ${hovered ? styles.summaryWidgetVisible : ''}`}
            onClick={handleSummarize}
          >
            <span className={styles.summaryBotIcon}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="8" width="18" height="13" rx="3"/>
                <path d="M8 8V6a4 4 0 0 1 8 0v2"/>
                <circle cx="9" cy="14" r="1" fill="currentColor" stroke="none"/>
                <circle cx="15" cy="14" r="1" fill="currentColor" stroke="none"/>
                <path d="M9 18h6"/>
              </svg>
            </span>
            <span className={styles.summaryWidgetText}>{summary ? 'view summary' : 'summarize'}</span>
          </button>
        )}
      </div>

      {/* BACK */}
      <div className={`${styles.card} ${styles.cardBack} ${backVisible ? styles.cardBackVisible : ''}`}>
        <div className={styles.cardHeader}>
          {individualThumb ? (
            <img src={individualThumb} alt={post.publisher} className={styles.individualAvatar} onError={e => { e.currentTarget.style.display = 'none' }} />
          ) : publisherIcon ? (
            <img src={publisherIcon} alt="" className={styles.favicon} onError={e => { e.currentTarget.src = favicon || ''; if (!favicon) e.currentTarget.style.display = 'none' }} />
          ) : null}
          <span className={styles.publisherName}>{post.publisher}</span>
          <button className={styles.flipBack} onClick={handleFlipBack} title="Back to article">&#x2715;</button>
        </div>
        <div className={styles.summaryBack}>
          {summary && <Markdown>{summary}</Markdown>}
        </div>
        <div style={{ borderTop: '0.5px solid var(--border)', padding: '0.6rem 1rem 0.75rem' }}>
          <span className={styles.topicLabel}>
            <span className={styles.topicDot}>●</span>{post.topic}
          </span>
        </div>
      </div>
    </div>
    </div>
    </>
  )
}
