import styles from './TagBadge.module.css'

/**
 * A removable tag chip.
 * Props:
 *   label     – string
 *   onRemove  – () => void  (omit to render without remove button)
 */
export default function TagBadge({ label, onRemove }) {
  return (
    <span className={styles.tag}>
      {label}
      {onRemove && (
        <button
          className={styles.remove}
          onClick={onRemove}
          aria-label={`Remove ${label}`}
          type="button"
        >
          &times;
        </button>
      )}
    </span>
  )
}
