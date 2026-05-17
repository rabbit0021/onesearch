import { useState, useEffect, useMemo } from 'react'
import { getFeed, getSuggestedFeed, getMostLikedFeed, getMostLikedAllTimeFeed, getIndividualsFeed, getRecommendedFeed } from '../../../api'
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
  const [mostLikedAllTime, setMostLikedAllTime] = useState([])
  const [individualsPosts, setIndividualsPosts] = useState([])
  const [recommended, setRecommended] = useState([])

  const [search, setSearch] = useState('')
  const [publisher, setPublisher] = useState('')
  const [topic, setTopic] = useState('')
  const [activeTags, setActiveTags] = useState([])
  const [dateDays, setDateDays] = useState(null)
  const [tagSearch, setTagSearch] = useState('')

  const [filterClosed, setFilterClosed] = useState(true)
  const [sortBy, setSortBy] = useState(null)

  useEffect(() => {
    getMostLikedFeed(10).then(setMostLiked).catch(() => { })
    getMostLikedAllTimeFeed(15).then(setMostLikedAllTime).catch(() => { })
    getIndividualsFeed(15).then(setIndividualsPosts).catch(() => { })
    getRecommendedFeed(15).then(setRecommended).catch(() => { })

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
    const handleScroll = () => {}
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [formRef])

  const publishers = useMemo(
    () => [...new Set([...posts, ...mostLiked, ...mostLikedAllTime, ...individualsPosts].map(p => p.publisher).filter(Boolean))].sort(),
    [posts, mostLiked, mostLikedAllTime, individualsPosts]
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
      if (q) {
        const inTitle = p.title?.toLowerCase().includes(q)
        const inPublisher = p.publisher?.toLowerCase().includes(q)
        const inTags = p.tags?.toLowerCase().includes(q)
        if (!inTitle && !inPublisher && !inTags) return false
      }
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

  const filtered = useMemo(() => {
    const arr = posts.filter(filterPredicate)
    if (sortBy === 'likes') return [...arr].sort((a, b) => (b.like_count || 0) - (a.like_count || 0))
    if (sortBy === 'views') return [...arr].sort((a, b) => (b.view_count || 0) - (a.view_count || 0))
    if (sortBy === 'stars') return [...arr].sort((a, b) => (b.fire_count || 0) - (a.fire_count || 0))
    return arr // date — already sorted by API
  }, [posts, filterPredicate, sortBy])
  const filteredMostLiked = useMemo(() => mostLiked.filter(filterPredicate), [mostLiked, filterPredicate])
  const filteredMostLikedAllTime = useMemo(() => mostLikedAllTime.filter(filterPredicate), [mostLikedAllTime, filterPredicate])
  const filteredIndividualsPosts = useMemo(() => individualsPosts.filter(filterPredicate), [individualsPosts, filterPredicate])

  function toggleTag(tag) {
    setActiveTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    )
  }

  const hasRealFilters = search || publisher || topic || dateDays || activeTags.length > 0
  const hasFilters = hasRealFilters || sortBy
  const activeFilterCount = [search, publisher, topic, dateDays].filter(Boolean).length + activeTags.length
  function clearAllFilters() { setSearch(''); setPublisher(''); setTopic(''); setDateDays(null); setActiveTags([]); setTagSearch(''); setSortBy(null) }

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

        <div
          className={styles.filterBarHeader}
          onClick={() => setFilterClosed(prev => !prev)}
        >
          <span className={styles.filterHeading}>&gt;_ filters</span>

          <span className={styles.filterToggle}>
            {filterClosed ? '[+]' : '[-]'}
          </span>

          <div className={styles.sortRow} onClick={e => e.stopPropagation()}>
            <span className={styles.sortLabel}>sort //</span>

            <button className={`${styles.sortPill} ${styles.sortPillLikes} ${sortBy === 'likes' ? styles.sortPillActive : ''}`} onClick={() => setSortBy(s => s === 'likes' ? null : 'likes')}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
            </button>

            <button className={`${styles.sortPill} ${styles.sortPillViews} ${sortBy === 'views' ? styles.sortPillActive : ''}`} onClick={() => setSortBy(s => s === 'views' ? null : 'views')}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </button>

            <button className={`${styles.sortPill} ${styles.sortPillStars} ${sortBy === 'stars' ? styles.sortPillActive : ''}`} onClick={() => setSortBy(s => s === 'stars' ? null : 'stars')}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
            </button>
          </div>
        </div>

        {filterClosed && hasRealFilters && (
          <div className={styles.filterActiveMeta}>
            <span className={styles.filterActiveCount}>{activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''} active</span>
            <button className={styles.filterActiveClear} onClick={clearAllFilters}>clear</button>
          </div>
        )}

        <div className={`${styles.filterBody} ${filterClosed ? styles.filterBodyCollapsed : ''}`}>

        {/* Row 1: search */}
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
                onClick={clearAllFilters}
              >
                reset
              </button>
            )}
          </div>
        )}

        </div>{/* end filterBody */}
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

          {!hasFilters && (
            <>
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

              {/* 3. Recently from Individuals */}
              {filteredIndividualsPosts.length > 0 && (
                <div className={styles.section}>
                  <p className={styles.heading}>Recently from Individuals</p>
                  <div className={styles.scrollRow}>
                    {filteredIndividualsPosts.map(post => (
                      <div key={post.id} className={styles.scrollCard}>
                        <BlogCard post={post} jiraConnected={jiraConnected} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 4. Recommended by OneSearch */}
              {recommended.length > 0 && (
                <div className={styles.section}>
                  <p className={styles.heading}>Recommended by OneSearch</p>
                  <div className={styles.scrollRow}>
                    {recommended.map(post => (
                      <div key={post.id} className={styles.scrollCard}>
                        <BlogCard post={post} jiraConnected={jiraConnected} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 4. All Time Favourites */}
              {filteredMostLikedAllTime.length > 0 && (
                <div className={styles.section}>
                  <p className={styles.heading}>All Time Favourites</p>
                  <div className={styles.scrollRow}>
                    {filteredMostLikedAllTime.map(post => (
                      <div key={post.id} className={styles.scrollCard}>
                        <BlogCard post={post} jiraConnected={jiraConnected} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* 5. All Posts */}
          <div className={styles.section}>
            <p className={styles.heading}>
              {hasFilters ? `${filtered.length} post${filtered.length !== 1 ? 's' : ''} found` : 'All Posts'}
            </p>
            {filtered.length === 0
              ? <p className={styles.hint}>No posts match your filters.</p>
              : <div className={styles.grid}>
                  {filtered.map(post => <BlogCard key={post.id} post={post} jiraConnected={jiraConnected} />)}
                </div>
            }
          </div>
        </>
      ) : (
        <>
          {!hasFilters && (
            <>
              {/* 1. Trending — visible to all users */}
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

              {/* 2. Recently from Individuals */}
              {filteredIndividualsPosts.length > 0 && (
                <div className={styles.section}>
                  <p className={styles.heading}>Recently from Individuals</p>
                  <div className={styles.scrollRow}>
                    {filteredIndividualsPosts.map(post => (
                      <div key={post.id} className={styles.scrollCard}>
                        <BlogCard post={post} jiraConnected={jiraConnected} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 3. Recommended by OneSearch */}
              {recommended.length > 0 && (
                <div className={styles.section}>
                  <p className={styles.heading}>Recommended by OneSearch</p>
                  <div className={styles.scrollRow}>
                    {recommended.map(post => (
                      <div key={post.id} className={styles.scrollCard}>
                        <BlogCard post={post} jiraConnected={jiraConnected} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 3. All Time Favourites */}
              {filteredMostLikedAllTime.length > 0 && (
                <div className={styles.section}>
                  <p className={styles.heading}>All Time Favourites</p>
                  <div className={styles.scrollRow}>
                    {filteredMostLikedAllTime.map(post => (
                      <div key={post.id} className={styles.scrollCard}>
                        <BlogCard post={post} jiraConnected={jiraConnected} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* 4. All Posts */}
          <div className={styles.section}>
            <p className={styles.heading}>
              {hasFilters ? `${filtered.length} post${filtered.length !== 1 ? 's' : ''} found` : 'All Posts'}
            </p>
            {filtered.length === 0
              ? <p className={styles.hint}>No posts match your filters.</p>
              : <div className={styles.grid}>
                  {filtered.map(post => <BlogCard key={post.id} post={post} jiraConnected={jiraConnected} />)}
                </div>
            }
          </div>
        </>
      )}

    </div>
  )
}