import { useEffect, useState } from 'react'
import { getIndividuals } from '../../../api'
import Dropdown from '../../ui/Dropdown/Dropdown'
import TagBadge from '../../ui/TagBadge/TagBadge'
import styles from './IndividualsSelector.module.css'

export default function IndividualsSelector({ selected, onChange, disabled }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [all, setAll] = useState([])

  useEffect(() => {
    getIndividuals().then(setAll).catch(() => {})
  }, [])

  const filtered = all.filter(
    (c) =>
      c.toLowerCase().includes(query.toLowerCase()) &&
      !selected.map((s) => s.toLowerCase()).includes(c.toLowerCase())
  )

  function handleSelect(name) {
    if (!selected.map((s) => s.toLowerCase()).includes(name.toLowerCase())) {
      onChange([...selected, name])
    }
    setQuery('')
    setOpen(false)
  }

  function handleRemove(name) {
    onChange(selected.filter((s) => s !== name))
  }

  return (
    <div className={styles.group}>
      <label className={styles.label}>Select individuals</label>

      {selected.length > 0 && (
        <div className={styles.tags}>
          {selected.map((c) => (
            <TagBadge key={c} label={c} onRemove={() => handleRemove(c)} />
          ))}
        </div>
      )}

      <div className={styles.relative}>
        <input
          type="text"
          className={`${styles.input} ${disabled ? styles.inputDisabled : ''}`}
          placeholder={disabled ? 'Check "Individuals" above to enable' : 'Search for an individual…'}
          value={query}
          disabled={disabled}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          autoComplete="off"
        />
        {!disabled && <Dropdown items={filtered} onSelect={handleSelect} visible={open && filtered.length > 0} />}
      </div>
    </div>
  )
}
