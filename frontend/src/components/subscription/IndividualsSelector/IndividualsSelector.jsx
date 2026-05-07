import { useEffect, useState } from 'react'
import { getIndividuals } from '../../../api'
import { INDIVIDUALS_META } from '../../../data/individuals'
import ImageLightbox from '../../ui/ImageLightbox/ImageLightbox'
import TagBadge from '../../ui/TagBadge/TagBadge'
import styles from './IndividualsSelector.module.css'

export default function IndividualsSelector({ selected, onChange, disabled }) {
  const [all, setAll] = useState([])
  const [query, setQuery] = useState('')
  const [lightbox, setLightbox] = useState(null) // { name, image, website }

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
      <label className={styles.label}>Select individuals</label>

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
                        src={meta.image}
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
    </div>
  )
}
