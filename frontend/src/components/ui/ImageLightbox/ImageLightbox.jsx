import { useEffect } from 'react'
import styles from './ImageLightbox.module.css'

export default function ImageLightbox({ image, name, realName, website, likeCount, onClose }) {
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.box} onClick={e => e.stopPropagation()}>
        <button className={styles.close} onClick={onClose}>×</button>
        <img src={image} alt={name} className={styles.image} />
        <div className={styles.footer}>
          <div className={styles.nameWrap}>
            <span className={styles.name}>{name}</span>
            {realName && <span className={styles.realName}>{realName}</span>}
          </div>
          {typeof likeCount === 'number' && (
            <div className={styles.likeCount}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="#9a9a9a">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
              <span>{likeCount}</span>
            </div>
          )}
          {website && (
            <a href={website} target="_blank" rel="noopener noreferrer" className={styles.link}>
              Visit website ↗
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
