import { useTheme, THEMES } from '../../context/ThemeContext'

/**
 * Inline SVG logo that adapts to the active color-primary theme color.
 * Primary color (#d97757) → var(--color-primary)
 * Dark strokes (#1a1a1a)  → var(--text-strong)
 */
export default function OneSearchLogo({ width = 350, height = 70 }) {
  const { themeKey } = useTheme()
  const primary = THEMES[themeKey]?.['--color-primary'] || '#d97757'

  // dark stroke adapts to text-strong via CSS var — use currentColor trick via style
  const dark = 'var(--text-strong)'

  return (
    <svg
      width={width}
      height={height}
      viewBox="25 0 655 180"
      role="img"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="OneSearch logo"
    >
      <defs>
        <mask id="os-logo-mask" maskUnits="userSpaceOnUse">
          <rect x="0" y="0" width="680" height="180" fill="white"/>
          <rect x="95.5" y="57.64" width="87.31" height="76.72" fill="black" rx="2"/>
          <rect x="97.5" y="55.64" width="87.31" height="76.72" fill="black" rx="2"/>
          <rect x="224" y="57.64" width="244.43" height="76.72" fill="black" rx="2"/>
          <rect x="222" y="59.64" width="244.43" height="76.72" fill="black" rx="2"/>
        </mask>
      </defs>

      {/* Grid lines */}
      {[20, 40, 140, 160].map(y => (
        <line key={y} x1="0" y1={y} x2="680" y2={y} stroke={primary} strokeWidth="0.4" strokeOpacity="0.1"/>
      ))}
      {[60, 80, 100, 120].map(y => (
        <line key={y} x1="0" y1={y} x2="680" y2={y} stroke={primary} strokeWidth="0.4" strokeOpacity="0.1" mask="url(#os-logo-mask)"/>
      ))}

      {/* Magnifying glass circle (outer) */}
      <circle cx="58" cy="82" r="30" fill="none" stroke={dark} strokeWidth="5"/>
      {/* Magnifying glass inner dashed ring */}
      <circle cx="58" cy="82" r="20" fill="none" stroke={primary} strokeWidth="1.5" strokeDasharray="5 3"/>
      {/* Crosshair lines */}
      <line x1="44" y1="82" x2="72" y2="82" stroke={primary} strokeWidth="1.5" strokeOpacity="0.7"/>
      <line x1="58" y1="68" x2="58" y2="96" stroke={primary} strokeWidth="1.5" strokeOpacity="0.7"/>
      {/* Center dot */}
      <circle cx="58" cy="82" r="4" fill={primary}/>
      {/* Handle */}
      <line x1="80" y1="104" x2="104" y2="128" stroke={dark} strokeWidth="7" strokeLinecap="square" mask="url(#os-logo-mask)"/>

      {/* NE text */}
      <text x="100" y="113" fontFamily="'Courier New', Courier, monospace" fontSize="64" fontWeight="900" fill={dark} letterSpacing="1">NE</text>
      <text x="102" y="111" fontFamily="'Courier New', Courier, monospace" fontSize="64" fontWeight="900" fill={primary} letterSpacing="1" opacity="0.18">NE</text>

      {/* SEARCH text */}
      <text x="228" y="113" fontFamily="'Courier New', Courier, monospace" fontSize="64" fontWeight="900" fill={primary} letterSpacing="1">SEARCH</text>
      <text x="226" y="115" fontFamily="'Courier New', Courier, monospace" fontSize="64" fontWeight="900" fill={dark} letterSpacing="1" opacity="0.12">SEARCH</text>

      {/* Blinking cursor */}
      <rect x="500" y="55" width="18" height="62" fill={primary} opacity="0.074">
        <animate attributeName="opacity" values="1;0;1" dur="0.9s" repeatCount="indefinite"/>
      </rect>
    </svg>
  )
}
