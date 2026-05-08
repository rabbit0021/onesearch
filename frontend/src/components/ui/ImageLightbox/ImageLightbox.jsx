import { useEffect } from 'react'
import styles from './ImageLightbox.module.css'

export default function ImageLightbox({ image, name, realName, website, onClose }) {
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
