import { useState, useEffect, useMemo } from 'react'
import { getFeed, getSuggestedFeed, getMostLikedFeed } from '../../../api'
import { getJiraStatus, getJiraIssues } from '../../../api/jira'
import BlogCard, { TOPIC_COLORS } from '../BlogCard/BlogCard'
import styles from './BlogFeed.module.css'

const DATE_OPTIONS = [
  { label: 'Any time', days: null },
  { label: 'Today', days: 1 },
  { label: 'This week', days: 7 },
  { label: 'This month', days: 30 },
]

export default function BlogFeed({ formRef }) {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [jiraConnected, setJiraConnected] = useState(false)
  const [mostLiked, setMostLiked] = useState([])

  const [search, setSearch] = useState('')
  const [publisher, setPublisher] = useState('')
  const [topic, setTopic] = useState('')
  const [activeTags, setActiveTags] = useState([])
  const [dateDays, setDateDays] = useState(null)
  const [tagSearch, setTagSearch] = useState('')

  const [filterClosed, setFilterClosed] = useState(false)
  const [hasScrolled, setHasScrolled] = useState(false)

  useEffect(() => {
    getMostLikedFeed(5).then(setMostLiked).catch(() => { })

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

  useEffect(() => {
    const handleScroll = () => {
      const isMobile = window.innerWidth <= 768
      if (isMobile && formRef?.current) {
        const formBottom = formRef.current.getBoundingClientRect().bottom
        setHasScrolled(formBottom < 0)
        if (formBottom >= 0) setFilterClosed(false)
      } else {
        setHasScrolled(window.scrollY > 80)
        if (window.scrollY < 5) setFilterClosed(false)
      }
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [formRef])

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
      if (topic && p.topic !== topic) return false
      if (cutoff && new Date(p.published_at).getTime() < cutoff) return false
      if (activeTags.length > 0) {
        const postTags = p.tags ? p.tags.split(',').map(t => t.trim()) : []
        if (!activeTags.every(t => postTags.includes(t))) return false
      }
      return true
    }
  }, [search, publisher, topic, dateDays, activeTags])

  const filtered = useMemo(() => posts.filter(filterPredicate), [posts, filterPredicate])
  const filteredMostLiked = useMemo(() => mostLiked.filter(filterPredicate), [mostLiked, filterPredicate])

  function toggleTag(tag) {
    setActiveTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    )
  }

  const hasFilters = search || publisher || topic || dateDays || activeTags.length > 0

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

      <div className={`${styles.filterBar} ${filterClosed ? styles.filterBarHidden : ''}`}>

        {/* Row 1: search + close */}
        <div className={styles.searchRow}>
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
          <button
            className={`${styles.filterCloseBtn} ${hasScrolled ? styles.filterCloseBtnVisible : styles.filterCloseBtnHidden}`}
            onClick={() => hasScrolled && setFilterClosed(true)}
            title="hide filters"
            tabIndex={hasScrolled ? 0 : -1}
          >✕</button>
        </div>

        {/* Row 2: publisher, date, topic */}
        <div className={styles.filterRow}>
          <label className={`${styles.filterLabel} ${publisher ? styles.filterLabelActive : ''}`}>
            <span className={styles.filterPrefix}>pub //</span>
            <select
              className={styles.filterSelect}
              value={publisher}
              onChange={e => setPublisher(e.target.value)}
            >
              <option value="">all</option>
              {publishers.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <label className={`${styles.filterLabel} ${dateDays ? styles.filterLabelActive : ''}`}>
            <span className={styles.filterPrefix}>date //</span>
            <select
              className={styles.filterSelect}
              value={dateDays ?? ''}
              onChange={e => setDateDays(e.target.value ? Number(e.target.value) : null)}
            >
              {DATE_OPTIONS.map(o => (
                <option key={o.label} value={o.days ?? ''}>{o.label}</option>
              ))}
            </select>
          </label>
          <label className={`${styles.filterLabel} ${topic ? styles.filterLabelActive : ''}`}>
            <span className={styles.filterPrefix}>field //</span>
            <select
              className={styles.filterSelect}
              value={topic}
              onChange={e => setTopic(e.target.value)}
            >
              <option value="">all</option>
              {Object.keys(TOPIC_COLORS).map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>
        </div>

        {/* Row 3: tags */}
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
                onClick={() => { setSearch(''); setPublisher(''); setTopic(''); setDateDays(null); setActiveTags([]); setTagSearch('') }}
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
            <div className={styles.trendingSection}>
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
            <p className={styles.heading}>Trending Blog Posts</p>
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
                  <p className={styles.lockedMsg}>&gt;_ connect jira to view trending blog posts</p>
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