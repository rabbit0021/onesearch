import styles from './ChatWidget.module.css'

export default function ChatWidget() {
  return (
    <div className={styles.widget}>
      <img src="/static/cat.gif" alt="Cat mascot" className={styles.avatar} />
      <div className={styles.bubble}>
        Hey there! 👋 Enjoying OneSearch? Let us know what you&apos;d like to see next!
      </div>
    </div>
  )
}
