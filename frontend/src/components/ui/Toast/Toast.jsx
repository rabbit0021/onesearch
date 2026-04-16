import styles from './Toast.module.css'

export default function Toast({ message, leaving }) {
  return (
    <div className={`${styles.toast} ${leaving ? styles.toastLeaving : ''}`}>
      {message}
    </div>
  )
}
