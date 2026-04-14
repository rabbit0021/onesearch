import styles from './NotificationIcon.module.css'

/**
 * Fixed top-right hamburger icon that toggles the sidebar.
 * Props:
 *   hasDot    – boolean  show the red notification dot
 *   onClick   – () => void
 */
export default function NotificationIcon({ hasDot, onClick }) {
  return (
    <div className={styles.wrapper} onClick={onClick} role="button" aria-label="Open menu" tabIndex={0}>
      <i className="fas fa-bars" />
      {hasDot && <span className={styles.dot} />}
    </div>
  )
}
