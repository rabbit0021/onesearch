import styles from './NotificationIcon.module.css'

/**
 * Fixed top-right toggle button.
 * Shows a hamburger when the sidebar is closed, an ✕ when open.
 *
 * Props:
 *   open      – boolean  sidebar open state
 *   hasDot    – boolean  show the red notification dot (only when closed)
 *   onClick   – () => void
 *   btnRef    – ref forwarded so Sidebar can exclude it from outside-click detection
 */
export default function NotificationIcon({ open, hasDot, onClick, btnRef }) {
  return (
    <button
      ref={btnRef}
      className={`${styles.wrapper} ${open ? styles.active : ''}`}
      onClick={onClick}
      aria-label={open ? 'Close menu' : 'Open menu'}
      aria-expanded={open}
    >
      {open
        ? <i key="close" className={`fas fa-times ${styles.closeIcon}`} />
        : <i key="open" className="fas fa-bars" />
      }
      {!open && hasDot && <span className={styles.dot} />}
    </button>
  )
}
