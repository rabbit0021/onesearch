import styles from './Header.module.css'

export default function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.logoWrap}>
        <img src="/static/nosearch_logo.jpeg" alt="OneSearch logo" className={styles.logo} />
      </div>
      <div className={styles.text}>
        <h1 className={styles.title}>OneSearch: Subscribe to Engineering Blogs</h1>
        <p className={styles.intro}>
          Stay up to date with the latest posts from top engineering blogs. Select your topic and
          favorite publisher, and we&apos;ll send you curated alerts.
        </p>
      </div>
    </header>
  )
}
