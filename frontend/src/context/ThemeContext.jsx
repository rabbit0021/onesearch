import { createContext, useContext, useEffect, useState } from 'react'

export const THEMES = {
  emerald: {
    label: 'Emerald',
    swatch: '#0fa341',
    '--color-primary':       '#0fa341',
    '--color-primary-hover': '#0b8a37',
    '--color-primary-text':  '#065523',
    '--color-primary-tint':  '#e1f9eb',
  },
  ocean: {
    label: 'Ocean',
    swatch: '#2196f3',
    '--color-primary':       '#2196f3',
    '--color-primary-hover': '#1976d2',
    '--color-primary-text':  '#0d47a1',
    '--color-primary-tint':  '#e3f2fd',
  },
  lavender: {
    label: 'Lavender',
    swatch: '#7c3aed',
    '--color-primary':       '#7c3aed',
    '--color-primary-hover': '#6d28d9',
    '--color-primary-text':  '#4c1d95',
    '--color-primary-tint':  '#ede9fe',
  },
  rose: {
    label: 'Rose',
    swatch: '#e91e8c',
    '--color-primary':       '#e91e8c',
    '--color-primary-hover': '#c2177a',
    '--color-primary-text':  '#880e4f',
    '--color-primary-tint':  '#fce4f3',
  },
  claude: {
    label: 'Claude',
    swatch: '#d97757',
    '--color-primary':       '#d97757',
    '--color-primary-hover': '#9c4d33',
    '--color-primary-text':  '#7a3520',
    '--color-primary-tint':  '#fdf0eb',
  },
}

const ThemeContext = createContext(null)

function applyTheme(theme) {
  const root = document.documentElement
  Object.entries(theme).forEach(([key, val]) => {
    if (key.startsWith('--')) root.style.setProperty(key, val)
  })
}

export function ThemeProvider({ children }) {
  const [themeKey, setThemeKey] = useState(
    () => localStorage.getItem('theme5') || 'claude'
  )

  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem('darkMode') === 'claude'
  )

  useEffect(() => {
    applyTheme(THEMES[themeKey] || THEMES.rose)
    localStorage.setItem('theme5', themeKey)
  }, [themeKey])

  useEffect(() => {
    if (darkMode) {
      document.documentElement.setAttribute('data-theme', 'dark')
    } else {
      document.documentElement.removeAttribute('data-theme')
    }
    localStorage.setItem('darkMode', String(darkMode))
  }, [darkMode])

  function toggleDarkMode() {
    setDarkMode(prev => !prev)
  }

  return (
    <ThemeContext.Provider value={{ themeKey, setThemeKey, darkMode, toggleDarkMode }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
