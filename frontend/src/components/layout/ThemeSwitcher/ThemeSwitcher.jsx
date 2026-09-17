import { useState } from 'react'
import { THEMES, useTheme } from '../../../context/ThemeContext'
import styles from './ThemeSwitcher.module.css'

export default function ThemeSwitcher({ bare = false }) {
  const { themeKey, setThemeKey, darkMode, toggleDarkMode } = useTheme()
  const [paletteOpen, setPaletteOpen] = useState(true)

  return (
    <div className={styles.switcher} style={bare ? { border: 'none', borderTop: 'none', boxShadow: 'none', padding: '0', background: 'transparent' } : {}}>
      <button
        className={styles.darkToggle}
        onClick={toggleDarkMode}
        title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        aria-pressed={darkMode}
        style={bare ? { color: 'inherit' } : {}}
      >
        {darkMode ? 'light' : 'dark'}
      </button>
      {!bare && (
        <button
          className={styles.paletteToggle}
          onClick={() => setPaletteOpen(prev => !prev)}
          title={paletteOpen ? 'Hide palette' : 'Show palette'}
          aria-label={paletteOpen ? 'Hide colour palette' : 'Show colour palette'}
        >
          {paletteOpen ? '▽' : '▷'}
        </button>
      )}
      <div className={`${styles.palette} ${(!bare && paletteOpen) ? styles.paletteOpen : ''}`}>
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
    </div>
  )
}
