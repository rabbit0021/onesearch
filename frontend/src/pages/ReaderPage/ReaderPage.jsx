import { useState, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { timeAgo, faviconUrl, fireToStars } from '../../components/feed/BlogCard/BlogCard'
import { getPostContent, sendReadEvent, getReadEvent, getOrCreateDeviceId } from '../../api'
import { useTheme } from '../../context/ThemeContext'
import { useToast } from '../../context/ToastContext'
import ThemeSwitcher from '../../components/layout/ThemeSwitcher/ThemeSwitcher'
import hljs from 'highlight.js/lib/common'
import lightThemeCss from 'highlight.js/styles/github.min.css?inline'
import darkThemeCss from 'highlight.js/styles/github-dark-dimmed.min.css?inline'
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch'
import styles from './ReaderPage.module.css'

// Override hljs background so our CSS variable shows through
const HLJS_BG_OVERRIDE = '\n.hljs { background: transparent !important; }\n'

const DEFAULT_READING_SPEED = 200 // words per minute — override per-user when personalisation is added

const FONT_SCALES  = [0.85, 0.93, 1, 1.1, 1.2]
const FONT_FAMILIES = [
  { key: 'system',    label: 'System UI',     css: "system-ui, -apple-system, sans-serif" },
  { key: 'lucida',    label: 'Lucida',        css: "'Lucida Grande', 'Lucida Sans', Lato, sans-serif" },
  { key: 'inter',     label: 'Inter',         css: "'Inter', 'Helvetica Neue', Arial, sans-serif" },
  { key: 'georgia',   label: 'Georgia',       css: "Georgia, Cambria, 'Times New Roman', serif" },
  { key: 'palatino',  label: 'Palatino',      css: "'Palatino Linotype', Palatino, 'Book Antiqua', serif" },
  { key: 'garamond',  label: 'Garamond',      css: "'EB Garamond', Garamond, 'Apple Garamond', serif" },
  { key: 'baskerville', label: 'Baskerville', css: "'Libre Baskerville', Baskerville, 'Times New Roman', serif" },
  { key: 'charter',   label: 'Charter',       css: "Charter, 'Bitstream Charter', 'Sitka Text', Cambria, serif" },
  { key: 'iowan',     label: 'Iowan',         css: "'Iowan Old Style', 'Apple Garamond', Palatino, serif" },
  { key: 'mono',      label: 'Monospace',     css: "'Fira Code', 'Cascadia Code', 'Courier New', monospace" },
]

function readingTime(html, wpm = DEFAULT_READING_SPEED) {
  const words = html.replace(/<[^>]+>/g, ' ').trim().split(/\s+/).filter(Boolean).length
  const mins = Math.max(1, Math.round(words / wpm))
  return `${mins} min read`
}

function Lightbox({ src, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className={styles.lightboxOverlay}>
      {/* Separate backdrop so panning never triggers close */}
      <div className={styles.lightboxBackdrop} onClick={onClose} />
      <button className={styles.lightboxClose} onClick={onClose} aria-label="Close">×</button>
      <TransformWrapper
        initialScale={1}
        minScale={0.5}
        maxScale={8}
        limitToBounds
        centerOnInit
        centerZoomedOut
        wheel={{ step: 0.05, smoothStep: 0.002 }}
        pinch={{ step: 5, allowPanning: true }}
        panning={{ allowLeftClickPan: true, velocityDisabled: true }}
        doubleClick={{ mode: 'zoomIn', step: 0.7 }}
      >
        {({ state, resetTransform }) => (
          <>
            <TransformComponent
              wrapperStyle={{
                width: 'calc(100vw - 5rem)',
                height: 'calc(100vh - 5rem)',
                position: 'relative',
                zIndex: 1,
              }}
              contentStyle={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <img
                src={src}
                className={styles.lightboxImg}
                alt=""
                style={{ cursor: state.scale > 1 ? 'grab' : 'zoom-in' }}
              />
            </TransformComponent>
            {state.scale > 1 && (
              <button
                className={styles.lightboxReset}
                onClick={e => { e.stopPropagation(); resetTransform() }}
              >
                Reset zoom
              </button>
            )}
          </>
        )}
      </TransformWrapper>
    </div>
  )
}

function FontSelect({ value, onChange, align = 'left' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const active = FONT_FAMILIES.find(f => f.key === value)

  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div className={styles.fontSelectWrap} ref={ref}>
      <button
        className={styles.fontSelectTrigger}
        style={{ fontFamily: active?.css }}
        onClick={() => setOpen(o => !o)}
      >
        {active?.label}
        <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
          <path d="M2 3.5 L5 6.5 L8 3.5" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {open && (
        <div className={styles.fontSelectDropdown} style={align === 'right' ? { right: 0, left: 'auto' } : {}}>
          {FONT_FAMILIES.map(f => (
            <button
              key={f.key}
              className={`${styles.fontSelectOption} ${f.key === value ? styles.fontSelectOptionActive : ''}`}
              style={{ fontFamily: f.css }}
              onClick={() => { onChange(f.key); setOpen(false) }}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function DevOverlay({ timeSpent, maxDepth, isActiveRef, openedOriginal }) {
  const [collapsed, setCollapsed] = useState(false)
  return (
    <div className={styles.devOverlay}>
      <div className={styles.devHeader}>
        <span className={styles.devTitle}>Engagement</span>
        <button className={styles.devToggle} onClick={() => setCollapsed(c => !c)}>
          {collapsed ? '▸' : '▾'}
        </button>
      </div>
      {!collapsed && (
        <>
          <div className={styles.devRow}>
            <span className={styles.devLabel}>Active time</span>
            <span className={styles.devValue}>
              {String(Math.floor(timeSpent / 60)).padStart(2, '0')}:{String(timeSpent % 60).padStart(2, '0')}
            </span>
          </div>
          <div className={styles.devRow}>
            <span className={styles.devLabel}>Max depth</span>
            <span className={styles.devValue}>{maxDepth}%</span>
          </div>
          <div className={styles.devRow}>
            <span className={styles.devLabel}>Idle</span>
            <span className={`${styles.devValue} ${!isActiveRef.current ? styles.devBad : styles.devGood}`}>
              {isActiveRef.current ? 'active' : 'idle'}
            </span>
          </div>
          <div className={styles.devRow}>
            <span className={styles.devLabel}>Opened original</span>
            <span className={`${styles.devValue} ${openedOriginal ? styles.devGood : ''}`}>
              {openedOriginal ? 'yes' : 'no'}
            </span>
          </div>
        </>
      )}
    </div>
  )
}

export default function ReaderPage() {
  const { state } = useLocation()
  const navigate = useNavigate()
  const post = state?.post
  const { darkMode } = useTheme()
  const { showToast } = useToast()

  const [content, setContent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [readTime, setReadTime] = useState(null)
  const [fontLevel, setFontLevel] = useState(() => {
    const saved = localStorage.getItem('reader-font-level')
    return saved !== null ? Number(saved) : 2
  })
  const [fontFamily, setFontFamily] = useState(() => {
    return localStorage.getItem('reader-font-family') || 'lucida'
  })
  const [progress, setProgress] = useState(0)
  const [toolsOpen, setToolsOpen] = useState(false)
  const [atTop, setAtTop] = useState(true)
  const [lightboxSrc, setLightboxSrc] = useState(null)
  const [resumeOverlay, setResumeOverlay] = useState(false) // true=visible, 'fading'=fading out

  // ── Engagement tracking ──
  const [timeSpent, setTimeSpent] = useState(0)
  const [maxDepth, setMaxDepth] = useState(0)
  const [openedOriginal, setOpenedOriginal] = useState(false)
  // Refs mirror state so sendBeacon closure always sees latest values
  const timeSpentRef = useRef(0)
  const maxDepthRef = useRef(0)
  const openedOriginalRef = useRef(false)
  const isActiveRef = useRef(true)
  const idleTimer = useRef(null)
  const IDLE_LIMIT = 60

  const contentRef = useRef(null)
  const readerBodyRef = useRef(null)
  const overflowRef = useRef(null)

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  // Send engagement event on page leave (unload or tab hide)
  useEffect(() => {
    if (!post?.id) return
    const flush = () => {
      sendReadEvent(post.id, {
        deviceId:       getOrCreateDeviceId(),
        userEmail:      localStorage.getItem('onesearch_like_email') || null,
        timeSpent:      timeSpentRef.current,
        maxDepth:       maxDepthRef.current,
        openedOriginal: openedOriginalRef.current,
      })
    }
    window.addEventListener('beforeunload', flush)
    document.addEventListener('visibilitychange', () => { if (document.hidden) flush() })
    return () => {
      flush() // also fire when navigating within the SPA
      window.removeEventListener('beforeunload', flush)
    }
  }, [post?.id])

  useEffect(() => { localStorage.setItem('reader-font-level', fontLevel) }, [fontLevel])
  useEffect(() => { localStorage.setItem('reader-font-family', fontFamily) }, [fontFamily])

  // Active-time timer — ticks only when tab visible + user not idle
  useEffect(() => {
    const tick = setInterval(() => {
      if (isActiveRef.current) setTimeSpent(t => { const n = t + 1; timeSpentRef.current = n; return n })
    }, 1000)
    return () => clearInterval(tick)
  }, [])

  // Pause on tab hide, resume on tab show
  useEffect(() => {
    const onVisibility = () => {
      isActiveRef.current = !document.hidden
      if (!document.hidden) resetIdle()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  // Reset idle timeout on any activity
  function resetIdle() {
    isActiveRef.current = true
    clearTimeout(idleTimer.current)
    idleTimer.current = setTimeout(() => { isActiveRef.current = false }, IDLE_LIMIT * 1000)
  }

  useEffect(() => {
    resetIdle()
    const events = ['scroll', 'mousemove', 'keydown', 'touchstart']
    events.forEach(e => window.addEventListener(e, resetIdle, { passive: true }))
    return () => {
      clearTimeout(idleTimer.current)
      events.forEach(e => window.removeEventListener(e, resetIdle))
    }
  }, [])


  useEffect(() => {
    if (!toolsOpen) return
    const handler = (e) => {
      if (overflowRef.current && !overflowRef.current.contains(e.target)) setToolsOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [toolsOpen])

  // Always start at top initially
  useEffect(() => {
    if (readerBodyRef.current) readerBodyRef.current.scrollTop = 0
  }, [])

  // After content loads, fetch saved progress and scroll to it
  useEffect(() => {
    if (!content || !post?.id) return
    getReadEvent(post.id, getOrCreateDeviceId()).then(event => {
      if (!event) return
      const pct = event.max_depth
      if (pct < 5 || pct >= 95) return
      setResumeOverlay(true)
      requestAnimationFrame(() => {
        const el = readerBodyRef.current
        if (!el) return
        const max = el.scrollHeight - el.clientHeight
        el.scrollTop = Math.round((pct / 100) * max)
        showToast(`Resumed from ${pct}%`, 1000)
        setTimeout(() => setResumeOverlay('fading'), 300)
      })
    })
  }, [content, post?.id])

  // Track reading progress + toolbar visibility + max depth
  useEffect(() => {
    const el = readerBodyRef.current
    if (!el) return
    const onScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = el
      const max = scrollHeight - clientHeight
      const pct = max > 0 ? Math.min(100, Math.round((scrollTop / max) * 100)) : 0
      setProgress(pct)
      setAtTop(scrollTop < 10)
      setMaxDepth(d => { const n = Math.max(d, pct); maxDepthRef.current = n; return n })
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

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
  const totalMins = readTime ? parseInt(readTime, 10) : 0
  const minsLeft = totalMins > 0 ? Math.max(0, Math.round(totalMins * (1 - progress / 100))) : null
  const activeFontCss = FONT_FAMILIES.find(f => f.key === fontFamily)?.css

  const fontSizeControls = (
    <div className={styles.toolGroup}>
      <button className={styles.toolIconBtn} onClick={() => setFontLevel(l => Math.max(0, l - 1))} disabled={fontLevel === 0} title="Decrease font size">
        <svg width="18" height="14" viewBox="0 0 22 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 13 L7 1 L12 13"/><path d="M3.8 9 L10.2 9"/><path d="M15 7 L20 7"/>
        </svg>
      </button>
      <span className={styles.toolScale}>{Math.round(FONT_SCALES[fontLevel] * 100)}%</span>
      <button className={styles.toolIconBtn} onClick={() => setFontLevel(l => Math.min(4, l + 1))} disabled={fontLevel === 4} title="Increase font size">
        <svg width="18" height="14" viewBox="0 0 22 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 13 L7 1 L12 13"/><path d="M3.8 9 L10.2 9"/><path d="M15 7 L20 7"/><path d="M17.5 4.5 L17.5 9.5"/>
        </svg>
      </button>
    </div>
  )

  const fontFamilyControls = <FontSelect value={fontFamily} onChange={setFontFamily} />
  const fontFamilyControlsRight = <FontSelect value={fontFamily} onChange={setFontFamily} align="right" />

  const resetControl = (
    <button className={styles.toolResetBtn} onClick={() => { setFontLevel(2); setFontFamily('lucida') }} title="Reset to defaults">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>
      </svg>
      Reset
    </button>
  )

  return (
    <div className={styles.page}>
      {/* Top bar — on desktop the reader controls live here */}
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
        {/* Desktop: all controls inline in nav */}
        <div className={styles.topBarControls}>
          <div className={styles.toolTheme}><ThemeSwitcher /></div>
          <div className={styles.toolSep} />
          {fontSizeControls}
          <div className={styles.toolSep} />
          {fontFamilyControls}
          <div className={styles.toolSep} />
          {resetControl}
        </div>
        <a href={post.url} target="_blank" rel="noopener noreferrer" className={styles.openBtn} onClick={() => { setOpenedOriginal(true); openedOriginalRef.current = true }}>
          Open original ↗
        </a>
      </div>

      {/* Mobile toolbar — hidden when scrolled */}
      <div className={`${styles.readerToolbar} ${atTop ? '' : styles.readerToolbarHidden}`}>
        <div className={styles.toolTheme}><ThemeSwitcher /></div>
        <div className={styles.toolSep} />
        {fontSizeControls}
        {/* These collapse into ⋮ on very narrow screens */}
        <div className={`${styles.toolSep} ${styles.toolSepOverflow}`} />
        <div className={styles.toolOverflowItems}>
          {fontFamilyControls}
          <div className={styles.toolSep} />
          {resetControl}
        </div>
        {/* ⋮ button + popup — only shown when items above are hidden */}
        <div className={styles.toolOverflowMenu} ref={overflowRef}>
          <button
            className={styles.toolDotsBtn}
            onClick={() => setToolsOpen(o => !o)}
            aria-label="More reading options"
          >
            more
          </button>
          {toolsOpen && (
            <div className={styles.toolsPopover}>
              <div className={styles.toolsPanelRow}>
                {fontFamilyControlsRight}
              </div>
              <div className={styles.toolsPanelDivider} />
              <div className={styles.toolsPanelRow}>
                {resetControl}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Scrollable reader area */}
      <div className={styles.readerBody} ref={readerBodyRef}>
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
              style={{
                fontSize: `calc(var(--fs-lg) * ${FONT_SCALES[fontLevel]})`,
                fontFamily: activeFontCss,
              }}
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
                // Hide images that fail to load; make successful ones clickable
                el.querySelectorAll('img').forEach(img => {
                  img.addEventListener('error', () => {
                    img.style.display = 'none'
                    const fig = img.closest('figure')
                    if (fig && fig.querySelectorAll('img:not([style*="none"])').length === 0) {
                      fig.style.display = 'none'
                    }
                  })
                  img.style.cursor = 'zoom-in'
                  img.addEventListener('click', () => {
                    if (img.src) setLightboxSrc(img.src)
                  })
                })
              }}
              dangerouslySetInnerHTML={{ __html: content }}
            />
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lightboxSrc && <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}

      {/* Progress dock — desktop only */}
      {content && (
        <div className={styles.readerDock}>
          <div className={styles.dockPill}>
            <div className={styles.dockTrack}>
              <div className={styles.dockFill} style={{ width: `${progress}%` }} />
            </div>
            <span className={styles.dockText}>
              {progress}%
              {minsLeft !== null && progress < 100 && (
                <span className={styles.dockSub}> · {minsLeft > 0 ? `${minsLeft} min` : 'almost done'}</span>
              )}
            </span>
          </div>
        </div>
      )}

      {/* Resume scroll overlay */}
      {resumeOverlay && (
        <div
          className={`${styles.resumeFade} ${resumeOverlay === 'fading' ? styles.resumeFadeOut : ''}`}
          onAnimationEnd={() => setResumeOverlay(false)}
        />
      )}

      {/* Dev-only engagement metrics overlay */}
      {import.meta.env.DEV && <DevOverlay timeSpent={timeSpent} maxDepth={maxDepth} isActiveRef={isActiveRef} openedOriginal={openedOriginal} />}
    </div>
  )
}
