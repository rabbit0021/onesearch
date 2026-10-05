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
      const vv = window.visualViewport
      const viewportHeight = vv?.height ?? window.innerHeight
      // visualViewport.offsetTop is how far the visual viewport has scrolled
      // inside the layout viewport (i.e. how much the keyboard pushed things up)
      const offsetTop = vv?.offsetTop ?? 0
      // r.top/bottom are relative to the layout viewport top,
      // so subtract offsetTop to get position within the visible area
      const inputTop = r.top - offsetTop
      const inputBottom = r.bottom - offsetTop
      const spaceBelow = viewportHeight - inputBottom
      const spaceAbove = inputTop
      const maxH = Math.min(180, Math.max(spaceBelow, spaceAbove) - 8)
      const showAbove = spaceBelow < 120 && spaceAbove > spaceBelow
      setPos({
        left: r.left,
        width: r.width,
        top: showAbove ? undefined : inputBottom + offsetTop + 2,
        bottom: showAbove ? (window.innerHeight - (inputTop + offsetTop) + 2) : undefined,
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
