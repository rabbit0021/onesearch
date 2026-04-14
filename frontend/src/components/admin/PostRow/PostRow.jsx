import { useState } from 'react'
import { updatePost } from '../../../api'
import { useToast } from '../../../context/ToastContext'
import styles from './PostRow.module.css'

const TOPICS = [
  'Software Engineering',
  'Data Analytics',
  'Data Science',
  'Software Testing',
  'Product Management',
  'General',
]

/**
 * Props:
 *   post       – post object from API
 *   secretKey  – string
 *   onUpdated  – () => void
 */
export default function PostRow({ post, secretKey, onUpdated }) {
  const [topic, setTopic] = useState(post.topic || '')
  const [saving, setSaving] = useState(false)
  const { showToast } = useToast()

  async function handleUpdate() {
    setSaving(true)
    try {
      const res = await updatePost(post.id, topic, secretKey)
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
      <td className={styles.cell}>{post.tags || '—'}</td>
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
