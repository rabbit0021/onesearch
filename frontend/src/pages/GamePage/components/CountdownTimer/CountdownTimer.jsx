import styles from './CountdownTimer.module.css'

const RADIUS = 22
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export default function CountdownTimer({ timeLeft, max = 15 }) {
  const progress = timeLeft / max
  const offset = CIRCUMFERENCE * (1 - progress)
  const urgent = timeLeft <= 5

  return (
    <div className={`${styles.wrapper} ${urgent ? styles.urgent : ''}`}>
      <svg width="60" height="60" viewBox="0 0 60 60">
        <circle cx="30" cy="30" r={RADIUS} className={styles.track} />
        <circle
          cx="30" cy="30" r={RADIUS}
          className={`${styles.ring} ${urgent ? styles.ringUrgent : ''}`}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          transform="rotate(-90 30 30)"
        />
      </svg>
      <span className={`${styles.count} ${urgent ? styles.countUrgent : ''}`}>{timeLeft}</span>
    </div>
  )
}
