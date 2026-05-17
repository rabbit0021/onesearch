import { useState, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { timeAgo, faviconUrl, fireToStars } from '../../components/feed/BlogCard/BlogCard'
import { getPostContent } from '../../api'
import { useTheme } from '../../context/ThemeContext'
import hljs from 'highlight.js/lib/common'
import lightThemeCss from 'highlight.js/styles/github.min.css?inline'
import darkThemeCss from 'highlight.js/styles/github-dark-dimmed.min.css?inline'
import styles from './ReaderPage.module.css'

// Override hljs background so our CSS variable shows through
const HLJS_BG_OVERRIDE = '\n.hljs { background: transparent !important; }\n'

function readingTime(html) {
  const words = html.replace(/<[^>]+>/g, ' ').trim().split(/\s+/).filter(Boolean).length
  const mins = Math.max(1, Math.round(words / 200))
  return `${mins} min read`
}

export default function ReaderPage() {
  const { state } = useLocation()
  const navigate = useNavigate()
  const post = state?.post
  const { darkMode } = useTheme()

  const [content, setContent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [readTime, setReadTime] = useState(null)
  const contentRef = useRef(null)

  // Swap highlight.js theme when dark/light mode changes
  useEffect(() => {
    let style = document.getElementById('hljs-theme')
    if (!style) {
      style = document.createElement('style')
      style.id = 'hljs-theme'
      document.head.appendChild(style)
    }
    style.textContent = (darkMode ? darkThemeCss : lightThemeCss) + HLJS_BG_OVERRIDE
    return () => { /* keep the style tag, just update it */ }
  }, [darkMode])

  useEffect(() => {
    if (!post) return
    setLoading(true)
    setError(null)
    getPostContent(post.id)
      .then(data => {
        setContent(data.content)
        setReadTime(readingTime(data.content))
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [post?.id])

  // Run syntax highlighting after content renders, and re-run when theme switches
  useEffect(() => {
    if (!content || !contentRef.current) return
    contentRef.current.querySelectorAll('pre code').forEach(block => {
      // Reset any previous highlight so hljs re-parses cleanly
      block.removeAttribute('data-highlighted')
      hljs.highlightElement(block)
    })
  }, [content, darkMode])

  if (!post) {
    return (
      <div className={styles.errorWrap}>
        <p className={styles.errorMsg}>Post not found.</p>
        <button className={styles.backBtn} onClick={() => navigate(-1)}>← Back</button>
      </div>
    )
  }

  const favicon = faviconUrl(post.url)
  const tags = post.tags ? post.tags.split(',').map(t => t.trim()).filter(Boolean) : []

  return (
    <div className={styles.page}>
      {/* Top bar */}
      <div className={styles.topBar}>
        <button className={styles.backBtn} onClick={() => navigate(-1)}>← Back</button>
        <div className={styles.topMeta}>
          {favicon && (
            <img src={favicon} alt="" className={styles.favicon}
              onError={e => { e.currentTarget.style.display = 'none' }} />
          )}
          <span className={styles.publisher}>{post.publisher}</span>
          <span className={styles.dot}>·</span>
          <span className={styles.date}>{timeAgo(post.published_at)}</span>
          {post.topic && <span className={styles.topic}>{post.topic}</span>}
        </div>
        <a href={post.url} target="_blank" rel="noopener noreferrer" className={styles.openBtn}>
          Open original ↗
        </a>
      </div>

      {/* Scrollable reader area */}
      <div className={styles.readerBody}>
        <div className={styles.readerInner}>
          <h1 className={styles.title}>{post.title}</h1>

          <div className={styles.metaRow}>
            <div className={styles.statRow}>
              {post.like_count > 0 && (
                <span className={styles.stat}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                  </svg>
                  {post.like_count}
                </span>
              )}
              {post.view_count > 0 && (
                <span className={styles.stat}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                  {post.view_count}
                </span>
              )}
              {fireToStars(post.fire_count) > 0 && (
                <span className={styles.stat}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                  </svg>
                  {fireToStars(post.fire_count)}
                </span>
              )}
              {readTime && (
                <span className={styles.stat}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 16 14"/>
                  </svg>
                  {readTime}
                </span>
              )}
            </div>
            {tags.length > 0 && (
              <div className={styles.tags}>
                {tags.map(tag => <span key={tag} className={styles.tag}>{tag}</span>)}
              </div>
            )}
          </div>

          <div className={styles.divider} />

          {loading && (
            <div className={styles.skeleton}>
              <div className={`${styles.skLine} ${styles.skTitle}`} />
              <div className={`${styles.skLine} ${styles.skTitleShort}`} />
              <div className={styles.skMeta}>
                <div className={`${styles.skLine} ${styles.skStat}`} />
                <div className={`${styles.skLine} ${styles.skStat}`} />
                <div className={`${styles.skLine} ${styles.skTag}`} />
                <div className={`${styles.skLine} ${styles.skTag}`} />
              </div>
              <div className={styles.skDivider} />
              {[100, 92, 87, 100, 78, 95, 83, 100, 70, 88].map((w, i) => (
                <div key={i} className={styles.skLine} style={{ width: `${w}%`, marginBottom: '0.6rem' }} />
              ))}
              <div style={{ height: '1.5rem' }} />
              {[100, 85, 93, 100, 76].map((w, i) => (
                <div key={i} className={styles.skLine} style={{ width: `${w}%`, marginBottom: '0.6rem' }} />
              ))}
            </div>
          )}

          {error && (
            <div className={styles.errorBlock}>
              <p className={styles.errorMsg}>Could not extract article content.</p>
              <a href={post.url} target="_blank" rel="noopener noreferrer" className={styles.openBtn}>
                Open original ↗
              </a>
            </div>
          )}

          {content && (
            <div
              className={styles.articleContent}
              ref={el => {
                contentRef.current = el
                if (!el) return
                // Wrap bare tables for horizontal scroll
                el.querySelectorAll('table').forEach(t => {
                  if (t.parentElement.classList.contains(styles.tableWrap)) return
                  const wrap = document.createElement('div')
                  wrap.className = styles.tableWrap
                  t.parentNode.insertBefore(wrap, t)
                  wrap.appendChild(t)
                })
                // Hide images that fail to load
                el.querySelectorAll('img').forEach(img => {
                  img.addEventListener('error', () => {
                    img.style.display = 'none'
                    const fig = img.closest('figure')
                    if (fig && fig.querySelectorAll('img:not([style*="none"])').length === 0) {
                      fig.style.display = 'none'
                    }
                  })
                })
              }}
              dangerouslySetInnerHTML={{ __html: content }}
            />
          )}
        </div>
      </div>
    </div>
  )
}
