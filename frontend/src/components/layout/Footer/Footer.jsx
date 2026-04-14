import styles from './Footer.module.css'

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <p className={styles.seo}>
        OneSearch aggregates engineering blog posts from top tech companies like AWS, Netflix,
        LinkedIn, Uber, and more. Subscribe to get curated alerts by topic — Software Engineering,
        Data Science, Analytics, and beyond.
      </p>
      <p className={styles.copy}>&copy; {new Date().getFullYear()} OneSearch</p>
    </footer>
  )
}
