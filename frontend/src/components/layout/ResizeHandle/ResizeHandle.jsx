import styles from './ResizeHandle.module.css'

export default function ResizeHandle({ onResizeStart, collapsed, onCollapse }) {
  return (
    <div className={styles.handle} onMouseDown={onResizeStart}>
      <div className={styles.track} />
      <button
        className={styles.collapseBtn}
        onMouseDown={e => e.stopPropagation()}
        onClick={onCollapse}
        title={collapsed ? 'Expand form' : 'Collapse form'}
        aria-label={collapsed ? 'Expand form' : 'Collapse form'}
      >
        <span className={`${styles.arrow} ${collapsed ? styles.arrowRight : styles.arrowLeft}`} />
      </button>
    </div>
  )
}
