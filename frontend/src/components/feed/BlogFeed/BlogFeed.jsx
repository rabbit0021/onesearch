import { useState, useEffect, useMemo } from 'react'
import { getFeed, getSuggestedFeed, getMostLikedFeed, likePost } from '../../../api'
import { getJiraStatus, getJiraIssues } from '../../../api/jira'
import styles from './BlogFeed.module.css'

const TOPIC_COLORS = {
  'Software Engineering':    '#FF5555', // CGA bright red
  'Frontend Engineering':    '#55FFFF', // CGA bright cyan
  'Backend Engineering':     '#5555FF', // CGA bright blue
  'Mobile Engineering':      '#FF55FF', // CGA bright magenta
  'Platform & Infrastructure': '#FFAA55', // CGA orange
  'Data Engineering':        '#55AAFF', // light blue
  'Data Science':            '#AA55FF', // purple
  'Machine Learning & AI':   '#FF55AA', // hot pink
  'Data Analytics':          '#55FFAA', // mint green
  'Security Engineering':    '#FF2222', // danger red
  'QA & Testing':            '#55FF55', // phosphor green
  'Product Management':      '#FFFF55', // CGA bright yellow
  'General':                 '#AAAAAA', // grey
}

const DATE_OPTIONS = [
  { label: 'Any time',   days: null },
  { label: 'Today',      days: 1 },
  { label: 'This week',  days: 7 },
  { label: 'This month', days: 30 },
]

function faviconUrl(postUrl) {
  try {
    const { origin } = new URL(postUrl)
    return `https://www.google.com/s2/favicons?domain=${origin}&sz=32`
  } catch {
    return null
  }
}

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

function BlogCard({ post, jiraConnected }) {
  const color = TOPIC_COLORS[post.topic] || TOPIC_COLORS['General']
  const favicon = faviconUrl(post.url)
  const tags = post.tags ? post.tags.split(',').map(t => t.trim()).filter(Boolean) : []
  const match = post.matched_issue
  const [likeCount, setLikeCount] = useState(post.like_count || 0)

  async function handleLike(e) {
    e.preventDefault()
    e.stopPropagation()
    if (!jiraConnected) return
    try {
      const data = await likePost(post.id)
      setLikeCount(data.count)
    } catch { /* silently fail */ }
  }

  return (
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
        <div
          className={`${styles.likeBtn} ${!jiraConnected ? styles.likeBtnLocked : ''}`}
          role="button"
          tabIndex={0}
          onClick={handleLike}
        >
          {jiraConnected
            ? <><i className="fas fa-heart" /><span className={styles.likeCount}>{likeCount}</span></>
            : <><i className="fas fa-heart" /><span className={styles.likeCount}>–</span></>
          }
        </div>
      </div>
      <div className={styles.body}>
        <div className={styles.meta}>
          <span className={styles.publisher}>{post.publisher}</span>
          <span className={styles.date}>{timeAgo(post.published_at)}</span>
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
  )
}

export default function BlogFeed() {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [jiraConnected, setJiraConnected] = useState(false)
  const [mostLiked, setMostLiked] = useState([])

  const [search, setSearch] = useState('')
  const [publisher, setPublisher] = useState('')
  const [activeTags, setActiveTags] = useState([])
  const [dateDays, setDateDays] = useState(null)
  const [tagSearch, setTagSearch] = useState('')

  useEffect(() => {
    getMostLikedFeed(5).then(setMostLiked).catch(() => {})

    async function loadFeed() {
      try {
        const status = await getJiraStatus()
        if (status.connected) {
          setJiraConnected(true)
          const data = await getJiraIssues()
          const issues = data.issues || []
          if (issues.length > 0) {
            const suggested = await getSuggestedFeed(issues, 100)
            setPosts(suggested)
            setLoading(false)
            return
          }
        }
      } catch {
        // fall through to regular feed
      }
      getFeed(100)
        .then(setPosts)
        .catch(e => setError(e.message))
        .finally(() => setLoading(false))
    }
    loadFeed()
  }, [])

  const publishers = useMemo(
    () => [...new Set(posts.map(p => p.publisher).filter(Boolean))].sort(),
    [posts]
  )

  const allTags = useMemo(() => {
    const set = new Set()
    posts.forEach(p => {
      if (p.tags) p.tags.split(',').map(t => t.trim()).filter(Boolean).forEach(t => set.add(t))
    })
    return [...set].sort()
  }, [posts])

  const filterPredicate = useMemo(() => {
    const q = search.toLowerCase()
    const cutoff = dateDays ? Date.now() - dateDays * 86400000 : null
    return p => {
      if (q && !p.title.toLowerCase().includes(q)) return false
      if (publisher && p.publisher !== publisher) return false
      if (cutoff && new Date(p.published_at).getTime() < cutoff) return false
      if (activeTags.length > 0) {
        const postTags = p.tags ? p.tags.split(',').map(t => t.trim()) : []
        if (!activeTags.every(t => postTags.includes(t))) return false
      }
      return true
    }
  }, [search, publisher, dateDays, activeTags])

  const filtered = useMemo(() => posts.filter(filterPredicate), [posts, filterPredicate])
  const filteredMostLiked = useMemo(() => mostLiked.filter(filterPredicate), [mostLiked, filterPredicate])

  function toggleTag(tag) {
    setActiveTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    )
  }

  const hasFilters = search || publisher || dateDays || activeTags.length > 0

  const grouped = useMemo(() => {
    const groups = {}
    const unmatched = []
    filtered.forEach(post => {
      if (post.matched_issue) {
        const key = post.matched_issue.key
        if (!groups[key]) groups[key] = { issue: post.matched_issue, posts: [] }
        groups[key].posts.push(post)
      } else {
        unmatched.push(post)
      }
    })
    return { groups: Object.values(groups), unmatched }
  }, [filtered])

  if (loading) return (
    <div className={styles.loadingWrap}>
      <span className={styles.spinner} />
      <span className={styles.loadingText}>loading posts<span className={styles.blink}>_</span></span>
    </div>
  )
  if (error) return <p className={styles.hint}>Could not load posts. {error}</p>
  if (posts.length === 0) return <p className={styles.hint}>No posts yet.</p>

  return (
    <div className={styles.wrapper}>

      <div className={styles.filterBar}>
        <div className={styles.toolbar}>
          <div className={styles.searchWrap}>
            <span className={styles.searchPrompt}>▸</span>
            <input
              className={styles.searchInput}
              type="text"
              placeholder="search posts..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button className={styles.searchClear} onClick={() => setSearch('')}>×</button>
            )}
          </div>
          <select
            className={styles.filterSelect}
            value={publisher}
            onChange={e => setPublisher(e.target.value)}
          >
            <option value="">All Publishers</option>
            {publishers.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select
            className={styles.filterSelect}
            value={dateDays ?? ''}
            onChange={e => setDateDays(e.target.value ? Number(e.target.value) : null)}
          >
            {DATE_OPTIONS.map(o => (
              <option key={o.label} value={o.days ?? ''}>{o.label}</option>
            ))}
          </select>
        </div>

        {allTags.length > 0 && (
          <div className={styles.tagFilter}>
            <span className={styles.tagLabel}>tags//</span>
            <input
              className={styles.tagSearch}
              type="text"
              placeholder="type"
              value={tagSearch}
              onChange={e => setTagSearch(e.target.value)}
            />
            {(() => {
              const filtered = allTags.filter(t => t.toLowerCase().includes(tagSearch.toLowerCase()))
              const visible = filtered.slice(0, 2)
              const extra = filtered.length - visible.length
              return <>
                {visible.map(tag => (
                  <button
                    key={tag}
                    className={`${styles.tagPill} ${activeTags.includes(tag) ? styles.tagPillActive : ''}`}
                    onClick={() => toggleTag(tag)}
                  >
                    {tag}
                  </button>
                ))}
                {extra > 0 && <span className={styles.moreTags}>+{extra} more</span>}
              </>
            })()}
            {hasFilters && (
              <button
                className={styles.resetAll}
                onClick={() => { setSearch(''); setPublisher(''); setDateDays(null); setActiveTags([]); setTagSearch('') }}
              >
                reset
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Section order:
            Jira connected + matches → [Posts for You (grouped)] → [Most Liked] → [Other Posts]
            Otherwise               → [Most Liked (locked/real)] → [Posts for You]
      ── */}

      {jiraConnected && grouped.groups.length > 0 ? (
        <>
          {/* 1. Posts for You — Jira grouped */}
          <div className={styles.section}>
            <p className={styles.heading}>
              {hasFilters ? `${filtered.length} post${filtered.length !== 1 ? 's' : ''} found` : 'Posts for You'}
            </p>
            {filtered.length === 0
              ? <p className={styles.hint}>No posts match your filters.</p>
              : grouped.groups.map(group => (
                  <div key={group.issue.key} className={styles.issueSection}>
                    <div className={styles.issueHeading}>
                      <img src="https://cdn.simpleicons.org/jira/2584FF" className={styles.issueIcon} alt="" />
                      <span className={styles.issueKey}>{group.issue.key}</span>
                      <span className={styles.issueSummary}>{group.issue.summary}</span>
                    </div>
                    <div className={styles.grid}>
                      {group.posts.map(post => <BlogCard key={post.id} post={post} jiraConnected={jiraConnected} />)}
                    </div>
                  </div>
                ))
            }
          </div>

          {/* 2. Most Liked Recently */}
          {filteredMostLiked.length > 0 && (
            <div className={styles.section}>
              <p className={styles.heading}>Trending Blog Posts</p>
              <div className={styles.scrollRow}>
                {filteredMostLiked.map(post => (
                  <div key={post.id} className={styles.scrollCard}>
                    <BlogCard post={post} jiraConnected={jiraConnected} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. Other Posts — exclude posts already shown in Most Liked */}
          {(() => {
            const mostLikedIds = new Set(filteredMostLiked.map(p => p.id))
            const otherPosts = grouped.unmatched.filter(p => !mostLikedIds.has(p.id))
            return otherPosts.length > 0 && (
              <div className={styles.section}>
                <p className={styles.heading}>Other Posts</p>
                <div className={styles.grid}>
                  {otherPosts.map(post => <BlogCard key={post.id} post={post} jiraConnected={jiraConnected} />)}
                </div>
              </div>
            )
          })()}
        </>
      ) : (
        <>
          {/* 1. Most Liked Recently (locked teaser or real) */}
          <div className={styles.section}>
            <p className={styles.heading}>Most Liked Recently</p>
            {jiraConnected && filteredMostLiked.length > 0 ? (
              <div className={styles.scrollRow}>
                {filteredMostLiked.map(post => (
                  <div key={post.id} className={styles.scrollCard}>
                    <BlogCard post={post} jiraConnected={jiraConnected} />
                  </div>
                ))}
              </div>
            ) : !jiraConnected ? (
              <div className={styles.lockedContainer}>
                <div className={styles.ghostGrid}>
                  {[0, 1, 2].map(i => <div key={i} className={styles.ghostCard} />)}
                </div>
                <div className={styles.lockedOverlay}>
                  <span className={styles.lockIcon}>⬡</span>
                  <p className={styles.lockedMsg}>&gt;_ connect jira to see trending blog posts</p>
                </div>
              </div>
            ) : null}
          </div>

          {/* 2. Posts for You — exclude posts already shown in Most Liked */}
          {(() => {
            const mostLikedIds = new Set(filteredMostLiked.map(p => p.id))
            const postsForYou = jiraConnected ? filtered.filter(p => !mostLikedIds.has(p.id)) : filtered
            return (
              <div className={styles.section}>
                <p className={styles.heading}>
                  {hasFilters ? `${postsForYou.length} post${postsForYou.length !== 1 ? 's' : ''} found` : 'Posts for You'}
                </p>
                {postsForYou.length === 0
                  ? <p className={styles.hint}>No posts match your filters.</p>
                  : <div className={styles.grid}>
                      {postsForYou.map(post => <BlogCard key={post.id} post={post} jiraConnected={jiraConnected} />)}
                    </div>
                }
              </div>
            )
          })()}
        </>
      )}
      
    </div>
  )
}