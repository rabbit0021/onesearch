import styles from './ResizeHandle.module.css'

export default function ResizeHandle({ onResizeStart, collapsed, onCollapse, style }) {
  return (
    <div className={styles.handle} onMouseDown={onResizeStart} style={style}>
      <div className={styles.track} />
      {onCollapse && (
        <button
          className={styles.collapseBtn}
          onMouseDown={e => e.stopPropagation()}
          onClick={onCollapse}
          title={collapsed ? 'Expand form' : 'Collapse form'}
          aria-label={collapsed ? 'Expand form' : 'Collapse form'}
        >
          <span className={`${styles.arrow} ${collapsed ? styles.arrowRight : styles.arrowLeft}`} />
        </button>
      )}
    </div>
  )
}
