import styles from './SourceSelector.module.css'

const SOURCES = [
  { id: 'techteams', label: 'Tech Teams', enabled: true },
  { id: 'individuals', label: 'Individuals', enabled: false, soon: true },
  { id: 'communities', label: 'Communities', enabled: false, soon: true },
]

/**
 * Props:
 *   selected  – string[]  ids of checked sources
 *   onChange  – (id: string, checked: boolean) => void
 */
export default function SourceSelector({ selected, onChange }) {
  return (
    <div className={styles.group}>
      <label className={styles.label}>Notification source</label>
      <div className={styles.row}>
        {SOURCES.map(({ id, label, enabled, soon }) => (
          <div key={id} className={styles.chipWrapper}>
            <label
              className={`${styles.chip} ${!enabled ? styles.disabled : ''} ${selected.includes(id) ? styles.checked : ''}`}
            >
              <input
                type="checkbox"
                className={styles.hidden}
                checked={selected.includes(id)}
                disabled={!enabled}
                onChange={(e) => enabled && onChange(id, e.target.checked)}
              />
              {label}
            </label>
            {soon && <span className={styles.tooltip}>Coming Soon...</span>}
          </div>
        ))}
      </div>
    </div>
  )
}
