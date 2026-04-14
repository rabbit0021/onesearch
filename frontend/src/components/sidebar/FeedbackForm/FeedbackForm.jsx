import { useState } from 'react'
import { postFeedback } from '../../../api'
import { useToast } from '../../../context/ToastContext'
import styles from './FeedbackForm.module.css'

export default function FeedbackForm() {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const { showToast } = useToast()

  async function handleSend() {
    if (!text.trim()) return
    setSending(true)
    try {
      const res = await postFeedback(text.trim())
      if (res.status === 'success') {
        showToast('Thanks for your feedback!')
        setText('')
      } else {
        showToast(res.message || 'Failed to send feedback.')
      }
    } catch {
      showToast('Failed to send feedback.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className={styles.form}>
      <textarea
        className={styles.textarea}
        placeholder="Your feedback…"
        value={text}
        maxLength={200}
        onChange={(e) => setText(e.target.value)}
        rows={3}
      />
      <button className={styles.btn} onClick={handleSend} disabled={sending || !text.trim()}>
        {sending ? 'Sending…' : 'Send'}
      </button>
    </div>
  )
}
