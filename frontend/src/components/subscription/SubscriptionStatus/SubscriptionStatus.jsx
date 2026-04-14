import styles from './SubscriptionStatus.module.css'

/**
 * Shows existing subscriptions grouped by topic.
 *
 * Props:
 *   data  – { [topic: string]: string[] } | null
 */
export default function SubscriptionStatus({ data }) {
  if (!data || Object.keys(data).length === 0) return null

  return (
    <div className={styles.box}>
      <p className={styles.heading}>Your current subscriptions:</p>
      {Object.entries(data).map(([topic, publishers]) => (
        <div key={topic} className={styles.row}>
          <span className={styles.topic}>{topic}:</span>
          <span className={styles.pubs}>{publishers.join(', ')}</span>
        </div>
      ))}
    </div>
  )
}
