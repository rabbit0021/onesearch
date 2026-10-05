import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import styles from './Dropdown.module.css'

/**
 * Generic autocomplete dropdown list.
 * Uses a portal so it's never clipped by overflow:hidden ancestors.
 *
 * Props:
 *   items       – string[]
 *   onSelect    – (item: string) => void
 *   visible     – boolean
 *   anchorRef   – ref to the input element for positioning
 */
export default function Dropdown({ items, onSelect, visible, anchorRef }) {
  const [rect, setRect] = useState(null)

  useEffect(() => {
    if (!visible || !anchorRef?.current) return
    const el = anchorRef.current
    const r = el.getBoundingClientRect()
    setRect(r)
  }, [visible, anchorRef])

  if (!visible || items.length === 0 || !rect) return null

  return createPortal(
    <ul
      className={styles.dropdown}
      role="listbox"
      style={{
        position: 'fixed',
        top: rect.bottom + 2,
        left: rect.left,
        width: rect.width,
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
