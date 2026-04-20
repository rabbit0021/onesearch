import { useState } from 'react'
import Dropdown from '../../ui/Dropdown/Dropdown'
import styles from './TopicSelector.module.css'

const TOPICS = [
  'Software Engineering',
  'Frontend Engineering',
  'Backend Engineering',
  'Mobile Engineering',
  'Platform & Infrastructure',
  'Data Engineering',
  'Data Science',
  'Machine Learning & AI',
  'Data Analytics',
  'Security Engineering',
  'QA & Testing',
  'Product Management',
]

/**
 * Props:
 *   value     – string
 *   onChange  – (topic: string) => void
 */
export default function TopicSelector({ value, onChange }) {
  const [query, setQuery] = useState(value)
  const [open, setOpen] = useState(false)

  const filtered = TOPICS.filter((t) => t.toLowerCase().includes(query.toLowerCase()))

  function handleSelect(topic) {
    setQuery(topic)
    onChange(topic)
    setOpen(false)
  }

  function handleChange(e) {
    setQuery(e.target.value)
    onChange('')
    setOpen(true)
  }

  return (
    <div className={styles.group}>
      <label className={styles.label}>
        What are you interested in?
      </label>
      <div className={styles.relative}>
        <input
          id="topic"
          type="text"
          className={styles.input}
          placeholder="e.g. Software Engineering"
          value={query}
          onChange={handleChange}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          autoComplete="off"
        />
        <Dropdown items={filtered} onSelect={handleSelect} visible={open} />
      </div>
    </div>
  )
}
