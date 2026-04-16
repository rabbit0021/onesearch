import { THEMES, useTheme } from '../../../context/ThemeContext'
import styles from './ThemeSwitcher.module.css'

export default function ThemeSwitcher() {
  const { themeKey, setThemeKey, darkMode, toggleDarkMode } = useTheme()

  return (
    <div className={styles.switcher}>
      <button
        className={styles.darkToggle}
        onClick={toggleDarkMode}
        title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        aria-pressed={darkMode}
      >
        {darkMode ? 'light' : 'dark'}
      </button>
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
