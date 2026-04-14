import styles from './Dropdown.module.css'

/**
 * Generic autocomplete dropdown list.
 * Rendered below its anchor via a portal-free absolute position.
 *
 * Props:
 *   items       – string[]
 *   onSelect    – (item: string) => void
 *   visible     – boolean
 */
export default function Dropdown({ items, onSelect, visible }) {
  if (!visible || items.length === 0) return null

  return (
    <ul className={styles.dropdown} role="listbox">
      {items.map((item) => (
        <li
          key={item}
          className={styles.item}
          role="option"
          onMouseDown={(e) => {
            e.preventDefault() // prevent blur before click
            onSelect(item)
          }}
        >
          {item}
        </li>
      ))}
    </ul>
  )
}
