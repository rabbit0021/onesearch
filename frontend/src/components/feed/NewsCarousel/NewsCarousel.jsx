import { useState, useEffect } from 'react'
import { getNewsBanners } from '../../../api'
import styles from './NewsCarousel.module.css'

const STATIC_NEWS = [
  {
    id: 1,
    publisher: 'Meta',
    time_label: '2h ago',
    headline: 'Meta introduced Muse, a new generative AI model for video and creative production',
    tags: 'AI/ML,Product',
    link: null,
    image_url: null,
    search_query: 'generative AI video production',
  },
  {
    id: 2,
    publisher: 'OpenAI',
    time_label: '1d ago',
    headline: 'GPT-5 is now available to all ChatGPT users, including free tier with rate limits',
    tags: 'AI/ML',
    link: null,
    image_url: null,
    search_query: 'GPT large language model',
  },
  {
    id: 3,
    publisher: 'Google DeepMind',
    time_label: '3d ago',
    headline: 'Gemini Ultra 2.0 achieves new state-of-the-art on coding and reasoning benchmarks',
    tags: 'AI/ML,Research',
    link: null,
    image_url: null,
    search_query: 'Gemini AI coding reasoning',
  },
  {
    id: 4,
    publisher: 'Anthropic',
    time_label: '4d ago',
    headline: 'Claude now supports extended context windows up to 1M tokens in API and Claude.ai',
    tags: 'AI/ML,Engineering',
    link: null,
    image_url: null,
    search_query: 'LLM context window tokens',
  },
  {
    id: 5,
    publisher: 'Vercel',
    time_label: '5d ago',
    headline: 'Next.js 15.2 ships with partial pre-rendering stable and improved dev server performance',
    tags: 'Frontend,Open Source',
    link: null,
    image_url: null,
    search_query: 'Next.js frontend performance',
  },
]

const COMPACT_MODE = true

function parseTags(tags) {
  if (!tags) return []
  return tags.split(',').map(t => t.trim()).filter(Boolean)
}

export default function NewsCarousel() {
  const [items, setItems] = useState([])
  const [current, setCurrent] = useState(0)
  const [dir, setDir] = useState(null)
  const [animating, setAnimating] = useState(false)

  useEffect(() => {
    getNewsBanners()
      .then(banners => { if (banners) setItems(banners) })
      .catch(() => {})
  }, [])

  const total = items.length

  function go(next, direction) {
    if (animating || next === current) return
    setDir(direction)
    setAnimating(true)
    setTimeout(() => {
      setCurrent(next)
      setAnimating(false)
      setDir(null)
    }, 200)
  }

  function prev() { go((current - 1 + total) % total, 'right') }
  function next() { go((current + 1) % total, 'left') }

  function handleCardClick() {
    const item = items[current]
    if (!item.link) return
    window.open(item.link, '_blank', 'noopener,noreferrer')
  }

  if (items.length === 0) return null

  const item = items[current]
  const tags = parseTags(item.tags)

  if (COMPACT_MODE) return (
    <div
      className={`${styles.ticker} ${item.link ? styles.tickerClickable : ''}`}
      onClick={handleCardClick}
    >
      <span className={styles.tickerBadge}>NEWS</span>
      <span className={styles.tickerPublisher}>{item.publisher}</span>
      <span className={styles.tickerSep}>·</span>
      <span
        className={`${styles.tickerHeadline} ${animating ? (dir === 'left' ? styles.exitLeft : styles.exitRight) : ''}`}
      >
        {item.headline}
      </span>
      {total > 1 && (
        <button
          className={styles.tickerMore}
          onClick={e => { e.stopPropagation(); next() }}
          aria-label="Next"
        >
          more ›
        </button>
      )}
    </div>
  )

  return (
    <div className={styles.wrapper}>
      <div className={styles.accentBar} />

      <div className={styles.cardWrap}>
        <div
          className={`${styles.card} ${animating ? (dir === 'left' ? styles.exitLeft : styles.exitRight) : ''} ${item.link ? styles.clickable : ''}`}
          onClick={handleCardClick}
        >
          <div className={styles.body}>
            <div className={styles.newsImage}>
              <img
                src={item.image_url || `https://picsum.photos/seed/${item.id}/160/120`}
                alt={item.publisher}
              />
            </div>

            <div className={styles.content}>
              <div className={styles.meta}>
                <span className={styles.publisher}>{item.publisher}</span>
                <span className={styles.sep}>·</span>
                <span className={styles.time}>{item.time_label}</span>
                {item.link && (
                  <a
                    className={styles.link}
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                  >
                    ↗
                  </a>
                )}
              </div>

              <p className={styles.headline}>{item.headline}</p>

              <div className={styles.footer}>
                <div className={styles.tags}>
                  {tags.map(t => (
                    <span key={t} className={styles.tag}>{t}</span>
                  ))}
                </div>

                <div className={styles.dots}>
                  {items.map((_, i) => (
                    <button
                      key={i}
                      className={`${styles.dotBtn} ${i === current ? styles.dotActive : ''}`}
                      onClick={e => { e.stopPropagation(); go(i, i > current ? 'left' : 'right') }}
                      aria-label={`News ${i + 1}`}
                    />
                  ))}
                </div>

                <span className={styles.counter}>{current + 1} / {total}</span>

                <div className={styles.arrows}>
                  <button className={styles.arrow} onClick={e => { e.stopPropagation(); prev() }} aria-label="Previous">‹</button>
                  <button className={styles.arrow} onClick={e => { e.stopPropagation(); next() }} aria-label="Next">›</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
