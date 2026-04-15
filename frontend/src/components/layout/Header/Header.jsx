import styles from './Header.module.css'

export default function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.logoWrap}>
        <img src="/static/onesearch_logo_brand.svg" alt="OneSearch logo" className={styles.logo} />
      </div>
    </header>
  )
}
