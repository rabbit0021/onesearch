import styles from './Header.module.css'
import JiraHeaderButton from '../../jira/JiraHeaderButton/JiraHeaderButton'

export default function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.logoWrap}>
        <img src="/static/onesearch_logo_brand.svg" alt="OneSearch logo" className={styles.logo} />
        <JiraHeaderButton />
      </div>
    </header>
  )
}
