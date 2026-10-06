import { createContext, useContext, useEffect, useState } from 'react'

export const THEMES = {
  emerald: {
    label: 'Emerald',
    swatch: '#0fa341',
    '--color-primary':       '#0fa341',
    '--color-primary-hover': '#0b8a37',
    '--color-primary-text':  '#065523',
    '--color-primary-tint':  '#e1f9eb',
    '--bg-feed':             'rgb(220, 230, 223)',
  },
  ocean: {
    label: 'Ocean',
    swatch: '#2196f3',
    '--color-primary':       '#2196f3',
    '--color-primary-hover': '#1976d2',
    '--color-primary-text':  '#0d47a1',
    '--color-primary-tint':  '#e3f2fd',
    '--bg-feed':             'rgb(224, 233, 240)',
  },
  lavender: {
    label: 'Lavender',
    swatch: '#7c3aed',
    '--color-primary':       '#7c3aed',
    '--color-primary-hover': '#6d28d9',
    '--color-primary-text':  '#4c1d95',
    '--color-primary-tint':  '#ede9fe',
    '--bg-feed':             'rgb(237, 231, 240)',
  },
  rose: {
    label: 'Rose',
    swatch: '#e91e8c',
    '--color-primary':       '#e91e8c',
    '--color-primary-hover': '#c2177a',
    '--color-primary-text':  '#880e4f',
    '--color-primary-tint':  '#fce4f3',
    '--bg-feed':             'rgb(239, 229, 236)',
  },
  claude: {
    label: 'Claude',
    swatch: '#d97757',
    '--color-primary':       '#d97757',
    '--color-primary-hover': '#9c4d33',
    '--color-primary-text':  '#7a3520',
    '--color-primary-tint':  '#fdf0eb',
    '--bg-feed':             'rgb(238, 229, 225)',
  },
  cobalt: {
    label: 'Cobalt',
    swatch: '#024ac6',
    '--color-primary':       '#1557c9',
    '--color-primary-hover': '#0035cc',
    '--color-primary-text':  '#00228a',
    '--color-primary-tint':  '#e6eeff',
    '--bg-feed':             'rgb(227, 230, 236)',
  },
}

const ThemeContext = createContext(null)

const LIGHT_ONLY_VARS = new Set(['--bg-feed'])

// Parse "#rrggbb" or "#rgb" → [r, g, b]
function hexToRgb(hex) {
  const h = hex.replace('#', '')
  if (h.length === 3) {
    return [
      parseInt(h[0] + h[0], 16),
      parseInt(h[1] + h[1], 16),
      parseInt(h[2] + h[2], 16),
    ]
  }
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

function darkTint(hex) {
  const [r, g, b] = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, 0.15)`
}

function darkPrimaryText(hex) {
  const [r, g, b] = hexToRgb(hex)
  // lighten toward white for readability on dark bg
  const lighten = (c) => Math.round(c + (255 - c) * 0.55)
  return `rgb(${lighten(r)}, ${lighten(g)}, ${lighten(b)})`
}

// Darken + desaturate primary for dark mode: pull toward a dark neutral
function darkPrimary(hex, hoverShift = 0) {
  const [r, g, b] = hexToRgb(hex)
  const darken = (c) => Math.round(c * 0.40 + hoverShift)
  return `rgb(${darken(r)}, ${darken(g)}, ${darken(b)})`
}

function applyTheme(theme, darkMode = false) {
  const root = document.documentElement
  Object.entries(theme).forEach(([key, val]) => {
    if (!key.startsWith('--')) return
    if (LIGHT_ONLY_VARS.has(key)) {
      if (!darkMode) root.style.setProperty(key, val)
      else root.style.removeProperty(key)
    } else if (darkMode && key === '--color-primary') {
      root.style.setProperty(key, darkPrimary(val))
    } else if (darkMode && key === '--color-primary-hover') {
      root.style.setProperty(key, darkPrimary(theme['--color-primary'], -8))
    } else if (darkMode && key === '--color-primary-tint') {
      root.style.setProperty(key, darkTint(theme['--color-primary']))
    } else if (darkMode && key === '--color-primary-text') {
      root.style.setProperty(key, darkPrimaryText(theme['--color-primary']))
    } else {
      root.style.setProperty(key, val)
    }
  })
}

export function ThemeProvider({ children }) {
  const [themeKey, setThemeKey] = useState(
    () => localStorage.getItem('theme5') || 'ocean'
  )

  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem('darkMode') === 'true'
  )

  useEffect(() => {
    applyTheme(THEMES[themeKey] || THEMES.rose, darkMode)
    localStorage.setItem('theme5', themeKey)
  }, [themeKey, darkMode])

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
