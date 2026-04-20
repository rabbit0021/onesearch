import styles from './EmailInput.module.css'

/**
 * Props:
 *   value      – string
 *   onChange   – (val: string) => void
 *   onBlur     – () => void  (triggered to load existing subscriptions)
 */
export default function EmailInput({ value, onChange, onBlur }) {
  return (
    <div className={styles.group}>
      <label className={styles.label} htmlFor="email">
        Your email address
      </label>
      <input
        id="email"
        type="email"
        className={styles.input}
        placeholder="you@example.com"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        autoComplete="email"
      />
    </div>
  )
}
