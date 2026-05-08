import { useEffect, useState } from 'react'
import { getIndividuals } from '../../../api'
import { INDIVIDUALS_META } from '../../../data/individuals'
import ImageLightbox from '../../ui/ImageLightbox/ImageLightbox'
import TagBadge from '../../ui/TagBadge/TagBadge'
import styles from './IndividualsSelector.module.css'

export default function IndividualsSelector({ selected, onChange, disabled }) {
  const [all, setAll] = useState([])
  const [query, setQuery] = useState('')
  const [browseQuery, setBrowseQuery] = useState('')
  const [lightbox, setLightbox] = useState(null) // { name, image, website }
  const [browseOpen, setBrowseOpen] = useState(false)

  useEffect(() => {
    getIndividuals().then(setAll).catch(() => {})
  }, [])

  function toggleSelect(name) {
    if (disabled) return
    onChange(
      selected.includes(name)
        ? selected.filter(s => s !== name)
        : [...selected, name]
    )
  }

  if (all.length === 0) return null

  function thumbOf(image) {
    return image ? image.replace(/(\.[^.]+)$/, '-thumb$1') : null
  }

  const q = query.toLowerCase().trim()
  const queryWords = q.split(/\s+/).filter(w => w.length > 0)
  const matchesQuery = name => {
    const nameWords = name.toLowerCase().split(/\s+/)
    return queryWords.every(qw => nameWords.some(nw => nw.startsWith(qw)))
  }
  const results = q.length >= 2
    ? all.filter(name => !selected.includes(name) && matchesQuery(name))
    : []
  const showOverlay = results.length > 0

  return (
    <div className={styles.group}>
      <div className={styles.labelRow}>
        <label className={styles.label}>Select individuals</label>
        <button
          type="button"
          className={styles.browseBtn}
          onClick={() => setBrowseOpen(true)}
          title="Browse all individuals"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
            <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
          </svg>
          Browse all
        </button>
      </div>

      {selected.length > 0 && (
        <div className={styles.tags}>
          {selected.map(name => (
            <TagBadge key={name} label={name} onRemove={() => !disabled && toggleSelect(name)} />
          ))}
        </div>
      )}

      <div className={styles.relative}>
        <input
          type="text"
          className={`${styles.search} ${disabled ? styles.searchDisabled : ''}`}
          placeholder={disabled ? 'Check "Individuals" above to enable' : 'Search individuals…'}
          value={query}
          disabled={disabled}
          onChange={e => setQuery(e.target.value)}
          autoComplete="off"
        />
        {!disabled && showOverlay && (
          <div className={styles.overlay}>
            {results.map(name => {
              const meta = INDIVIDUALS_META[name] || {}
              return (
                <div
                  key={name}
                  className={styles.card}
                  onMouseDown={e => { e.preventDefault(); toggleSelect(name); setQuery('') }}
                >
                  <div className={styles.avatarWrap}>
                    {meta.image ? (
                      <img
                        src={thumbOf(meta.image)}
                        alt={name}
                        className={styles.avatar}
                        onMouseDown={e => {
                          e.stopPropagation()
                          e.preventDefault()
                          setLightbox({ name, image: meta.image, website: meta.website })
                        }}
                      />
                    ) : (
                      <div className={styles.avatarFallback}>{name.charAt(0)}</div>
                    )}
                  </div>
                  <div className={styles.info}>
                    <span className={styles.name}>{name}</span>
                    {meta.bio && <span className={styles.bio}>{meta.bio}</span>}
                  </div>
                  <div className={styles.actions}>
                    {meta.website && (
                      <a
                        href={meta.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.siteLink}
                        onMouseDown={e => e.stopPropagation()}
                        title="Visit website"
                      >
                        ↗
                      </a>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {lightbox && (
        <ImageLightbox
          image={lightbox.image}
          name={lightbox.name}
          website={lightbox.website}
          onClose={() => setLightbox(null)}
        />
      )}

      {browseOpen && (
        <div className={styles.browseOverlay} onClick={() => setBrowseOpen(false)}>
          <div className={styles.browseModal} onClick={e => e.stopPropagation()}>
            <div className={styles.browseHeader}>
              <span className={styles.browseTitle}>All Individuals</span>
              <div className={styles.browseSearchWrap}>
                <svg className={styles.browseSearchIcon} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input
                  type="text"
                  className={styles.browseSearch}
                  placeholder="Search…"
                  value={browseQuery}
                  onChange={e => setBrowseQuery(e.target.value)}
                  autoFocus
                  autoComplete="off"
                />
                {browseQuery && (
                  <button type="button" className={styles.browseClearSearch} onClick={() => setBrowseQuery('')}>×</button>
                )}
              </div>
              <button type="button" className={styles.browseClose} onClick={() => { setBrowseOpen(false); setBrowseQuery('') }}>×</button>
            </div>
            <div className={styles.browseGrid}>
              {all.filter(name => {
                if (!browseQuery.trim()) return true
                const bq = browseQuery.toLowerCase().trim()
                return name.toLowerCase().split(/\s+/).some(w => w.startsWith(bq))
              }).map(name => {
                const meta = INDIVIDUALS_META[name] || {}
                const isSelected = selected.includes(name)
                return (
                  <div
                    key={name}
                    className={`${styles.browseCard} ${isSelected ? styles.browseCardSelected : ''} ${disabled ? styles.browseCardDisabled : ''}`}
                    onClick={() => { if (!disabled) toggleSelect(name) }}
                  >
                    <div className={styles.browseAvatarWrap}>
                      {meta.image ? (
                        <img
                          src={thumbOf(meta.image)}
                          alt={name}
                          className={styles.browseAvatar}
                          onClick={e => {
                            e.stopPropagation()
                            setLightbox({ name, image: meta.image, website: meta.website })
                          }}
                        />
                      ) : (
                        <div className={styles.browseAvatarFallback}>{name.charAt(0)}</div>
                      )}
                      {isSelected && <div className={styles.browseSelectedBadge}>✓</div>}
                    </div>
                    <span className={styles.browseName}>{name}</span>
                    {meta.bio && <span className={styles.browseBio}>{meta.bio}</span>}
                    {meta.website && (
                      <a
                        href={meta.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.browseSiteLink}
                        onClick={e => e.stopPropagation()}
                      >
                        {meta.website.replace(/^https?:\/\//, '')} ↗
                      </a>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
