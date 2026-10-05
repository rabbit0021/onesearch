import styles from './FrequencySlider.module.css'

const PRESETS = [
  { label: 'Immediate', value: 0 },
  { label: '2 days',    value: 2 },
  { label: '1 week',    value: 7 },
]

/**
 * Props:
 *   value     – number  (0–30)
 *   onChange  – (val: number) => void
 */
export default function FrequencySlider({ value, onChange }) {
  return (
    <div className={styles.group}>
      <label className={styles.label} htmlFor="frequency">
        Make it a digest
      </label>
      <p className={styles.hint}>
        How often should we send your digest?
      </p>
      <div className={styles.presets}>
        {PRESETS.map(p => (
          <button
            key={p.value}
            type="button"
            className={`${styles.presetBtn} ${value === p.value ? styles.presetActive : ''}`}
            onClick={() => onChange(p.value)}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className={styles.row}>
        <input
          id="frequency"
          type="range"
          className={styles.slider}
          min={0}
          max={30}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <output className={styles.output}>
          {value === 0 ? 'Immediate' : `Every ${value} day${value === 1 ? '' : 's'}`}
        </output>
      </div>
    </div>
  )
}
