import { useState } from 'react'
import { updatePost } from '../../../api'
import { useToast } from '../../../context/ToastContext'
import TagBadge from '../../ui/TagBadge/TagBadge'
import styles from './PostRow.module.css'

const TOPICS = [
  'Software Engineering',
  'Data Analytics',
  'Data Science',
  'Software Testing',
  'Product Management',
  'General',
]

function parseTags(raw) {
  if (!raw) return []
  return raw.split(',').map((t) => t.trim()).filter(Boolean)
}

/**
 * Props:
 *   post       – post object from API
 *   secretKey  – string
 *   onUpdated  – () => void
 */
export default function PostRow({ post, secretKey, onUpdated }) {
  const [topic, setTopic] = useState(post.topic || '')
  const [tags, setTags] = useState(() => parseTags(post.tags))
  const [tagInput, setTagInput] = useState('')
  const [saving, setSaving] = useState(false)
  const { showToast } = useToast()

  function addTag(raw) {
    const trimmed = raw.trim()
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed])
    }
    setTagInput('')
  }

  function handleTagKeyDown(e) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag(tagInput)
    } else if (e.key === 'Backspace' && tagInput === '' && tags.length > 0) {
      setTags(tags.slice(0, -1))
    }
  }

  function removeTag(tag) {
    setTags(tags.filter((t) => t !== tag))
  }

  async function handleUpdate() {
    setSaving(true)
    try {
      const tagsValue = tags.length > 0 ? tags.join(',') : null
      const res = await updatePost(post.id, topic, tagsValue, secretKey)
      if (res.status === 'success') {
        showToast(`Post ${post.id} updated.`)
        onUpdated()
      } else {
        showToast(res.message || 'Update failed.')
      }
    } catch {
      showToast('Update failed.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <tr className={styles.row}>
      <td className={styles.cell}>{post.id}</td>
      <td className={styles.cell}>
        <a href={post.url} target="_blank" rel="noopener noreferrer" className={styles.link}>
          {post.title}
        </a>
      </td>
      <td className={styles.cell}>
        <select
          className={styles.select}
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
        >
          <option value="">— select —</option>
          {TOPICS.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </td>
      <td className={styles.cell}>{post.publisher}</td>
      <td className={styles.cell}>{post.published_at ? post.published_at.slice(0, 10) : '—'}</td>
      <td className={styles.cell}>
        <div className={styles.tagsCell}>
          {tags.map((tag) => (
            <TagBadge key={tag} label={tag} onRemove={() => removeTag(tag)} />
          ))}
          <input
            className={styles.tagInput}
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleTagKeyDown}
            onBlur={() => { if (tagInput.trim()) addTag(tagInput) }}
            placeholder={tags.length === 0 ? 'Add tag…' : ''}
          />
        </div>
      </td>
      <td className={styles.cell}>{post.labelled ? '✅' : '❌'}</td>
      <td className={styles.cell}>
        <button
          className={styles.btn}
          onClick={handleUpdate}
          disabled={saving || !topic}
        >
          {saving ? '…' : 'Update'}
        </button>
      </td>
    </tr>
  )
}
