import { useEffect, useState } from 'react'
import { THEMES, useTheme } from '../../../context/ThemeContext'
import styles from './ThemeSwitcher.module.css'

export default function ThemeSwitcher() {
  const { themeKey, setThemeKey } = useTheme()
  const [atTop, setAtTop] = useState(true)

  useEffect(() => {
    function onScroll() {
      setAtTop(window.scrollY <= 50)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className={`${styles.switcher} ${atTop ? '' : styles.hidden}`}>
      {Object.entries(THEMES).map(([key, theme]) => (
        <button
          key={key}
          className={`${styles.swatch} ${themeKey === key ? styles.active : ''}`}
          style={{ background: theme.swatch }}
          onClick={() => setThemeKey(key)}
          title={theme.label}
          aria-label={`Switch to ${theme.label} theme`}
          aria-pressed={themeKey === key}
        />
      ))}
    </div>
  )
}