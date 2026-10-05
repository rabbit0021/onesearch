import { useEffect, useRef, useState } from 'react'
import { getTechTeams } from '../../../api'
import Dropdown from '../../ui/Dropdown/Dropdown'
import TagBadge from '../../ui/TagBadge/TagBadge'
import styles from './CompanySelector.module.css'

/**
 * Props:
 *   selected    – string[]           currently selected companies
 *   onChange    – (companies: string[]) => void
 *   disabled    – boolean
 */
export default function CompanySelector({ selected, onChange, disabled }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [all, setAll] = useState([])
  const inputRef = useRef(null)

  useEffect(() => {
    getTechTeams().then(setAll).catch(() => {})
  }, [])

  const filtered = all.filter(
    (c) =>
      c.toLowerCase().includes(query.toLowerCase()) &&
      !selected.map((s) => s.toLowerCase()).includes(c.toLowerCase())
  )

  function handleSelect(company) {
    if (!selected.map((s) => s.toLowerCase()).includes(company.toLowerCase())) {
      onChange([...selected, company])
    }
    setQuery('')
    setOpen(false)
  }

  function handleRemove(company) {
    onChange(selected.filter((s) => s !== company))
  }

  const allSelected = all.length > 0 && all.every(c => selected.map(s => s.toLowerCase()).includes(c.toLowerCase()))

  function handleSelectAll() {
    onChange(allSelected ? [] : all)
  }

  return (
    <div className={styles.group}>
      <div className={styles.labelRow}>
        <label className={styles.label}>Select tech teams</label>
        {!disabled && all.length > 0 && (
          <button type="button" className={styles.selectAllBtn} onClick={handleSelectAll}>
            {allSelected ? 'Deselect all' : 'Select all'}
          </button>
        )}
      </div>

      {selected.length > 0 && (
        <div className={styles.tags}>
          {selected.map((c) => (
            <TagBadge key={c} label={c} onRemove={() => handleRemove(c)} />
          ))}
        </div>
      )}

      <div className={styles.relative}>
        <input
          ref={inputRef}
          id="company"
          type="text"
          className={`${styles.input} ${disabled ? styles.inputDisabled : ''}`}
          placeholder={disabled ? 'Check "Tech Teams" above to enable' : 'Search for a company…'}
          value={query}
          disabled={disabled}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          autoComplete="off"
        />
        {!disabled && <Dropdown items={filtered} onSelect={handleSelect} visible={open && filtered.length > 0} anchorRef={inputRef} />}
      </div>
    </div>
  )
}
