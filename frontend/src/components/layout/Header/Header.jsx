import styles from './Header.module.css'
import JiraHeaderButton from '../../jira/JiraHeaderButton/JiraHeaderButton'

export default function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.logoWrap}>
        <img src="/static/onesearch_logo_brand.svg" alt="OneSearch logo" className={styles.logo} />
        <JiraHeaderButton />
      </div>
      <div className={styles.text}>
        <h1 className={styles.title}>Subscribe to Engineering Blogs</h1>
        <p className={styles.intro}>
          Stay up to date with the latest posts from top engineering blogs. Select your <br/> topic  and
          favorite publisher, and we will send you curated alerts.
        </p>
      </div>
    </header>
  )
}
