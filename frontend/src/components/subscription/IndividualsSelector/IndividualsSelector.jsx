import { useEffect, useState } from 'react'
import { getIndividuals } from '../../../api'
import { INDIVIDUALS_META } from '../../../data/individuals'
import ImageLightbox from '../../ui/ImageLightbox/ImageLightbox'
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

  const q = query.toLowerCase()
  const visible = all.filter(name =>
    selected.includes(name) ||
    (q.length >= 2 && name.toLowerCase().split(/\s+/).some(word => word.startsWith(q)))
  )

  return (
    <div className={styles.group}>
      <label className={styles.label}>Select individuals</label>
      <input
        type="text"
        className={`${styles.search} ${disabled ? styles.searchDisabled : ''}`}
        placeholder={disabled ? 'Check "Individuals" above to enable' : 'Search individuals…'}
        value={query}
        disabled={disabled}
        onChange={e => setQuery(e.target.value)}
        autoComplete="off"
      />
      <div className={`${styles.grid} ${disabled ? styles.gridDisabled : ''}`}>
        {visible.map(name => {
          const meta = INDIVIDUALS_META[name] || {}
          const isSelected = selected.includes(name)
          return (
            <div
              key={name}
              className={`${styles.card} ${isSelected ? styles.cardSelected : ''} ${disabled ? styles.cardDisabled : ''}`}
              onClick={() => toggleSelect(name)}
            >
              <div className={styles.avatarWrap}>
                {meta.image ? (
                  <img
                    src={meta.image}
                    alt={name}
                    className={styles.avatar}
                    onClick={e => {
                      e.stopPropagation()
                      setLightbox({ name, image: meta.image, website: meta.website })
                    }}
                  />
                ) : (
                  <div className={styles.avatarFallback}>
                    {name.charAt(0)}
                  </div>
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
                    onClick={e => e.stopPropagation()}
                    title="Visit website"
                  >
                    ↗
                  </a>
                )}
                <div className={`${styles.checkbox} ${isSelected ? styles.checkboxChecked : ''}`}>
                  {isSelected && '✓'}
                </div>
              </div>
            </div>
          )
        })}
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
