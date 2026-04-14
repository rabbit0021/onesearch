import styles from './FeatureCard.module.css'

/**
 * A card in the sidebar for a feature/action.
 *
 * Props:
 *   title       – string
 *   children    – ReactNode (body content / button)
 */
export default function FeatureCard({ title, children }) {
  return (
    <div className={styles.card}>
      <p className={styles.title}>{title}</p>
      <div className={styles.body}>{children}</div>
    </div>
  )
}
