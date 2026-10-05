import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import styles from './Dropdown.module.css'

export default function Dropdown({ items, onSelect, visible, anchorRef }) {
  const [pos, setPos] = useState(null)

  useEffect(() => {
    if (!visible || !anchorRef?.current) { setPos(null); return }

    function updatePos() {
      const r = anchorRef.current?.getBoundingClientRect()
      if (!r) return
      // Available space below the input (accounting for virtual keyboard via visualViewport)
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight
      const spaceBelow = viewportHeight - r.bottom
      const spaceAbove = r.top
      const maxH = Math.min(180, Math.max(spaceBelow, spaceAbove) - 8)
      const showAbove = spaceBelow < 120 && spaceAbove > spaceBelow
      setPos({
        left: r.left,
        width: r.width,
        top: showAbove ? undefined : r.bottom + 2,
        bottom: showAbove ? (viewportHeight - r.top + 2) : undefined,
        maxHeight: maxH,
      })
    }

    updatePos()
    window.visualViewport?.addEventListener('resize', updatePos)
    window.visualViewport?.addEventListener('scroll', updatePos)
    window.addEventListener('scroll', updatePos, true)
    return () => {
      window.visualViewport?.removeEventListener('resize', updatePos)
      window.visualViewport?.removeEventListener('scroll', updatePos)
      window.removeEventListener('scroll', updatePos, true)
    }
  }, [visible, anchorRef])

  if (!visible || items.length === 0 || !pos) return null

  return createPortal(
    <ul
      className={styles.dropdown}
      role="listbox"
      style={{
        position: 'fixed',
        top: pos.top,
        bottom: pos.bottom,
        left: pos.left,
        width: pos.width,
        maxHeight: pos.maxHeight,
        zIndex: 99990,
      }}
    >
      {items.map((item) => (
        <li
          key={item}
          className={styles.item}
          role="option"
          onMouseDown={(e) => {
            e.preventDefault()
            onSelect(item)
          }}
        >
          {item}
        </li>
      ))}
    </ul>,
    document.body
  )
}
