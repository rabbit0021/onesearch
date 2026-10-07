import styles from './JevVerdict.module.css'

function scoreEmoji(score) {
  if (score >= 8) return '✅'
  if (score >= 6) return '😐'
  if (score >= 4) return '😬'
  return '💀'
}

export default function JevVerdict({ verdict, score }) {
  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <span className={styles.logo}>⚡ Jev's Verdict</span>
        <span className={styles.scoreEmoji}>{scoreEmoji(score)}</span>
      </div>
      <p className={styles.verdict}>"{verdict}"</p>
      <div className={styles.score}>
        Adult score: <strong>{score}/10</strong>
        <span className={styles.next}>Next confession in 5s...</span>
      </div>
    </div>
  )
}
