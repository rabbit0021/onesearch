import styles from './FrequencySlider.module.css'

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
        Set how often you want the digest (0 = immediate as the blog is published)
      </p>
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
