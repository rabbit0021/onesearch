import styles from './Header.module.css'
import OneSearchLogo from '../OneSearchLogo'

export default function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.logoWrap}>
        <OneSearchLogo width={350} height={70} />
      </div>
    </header>
  )
}
