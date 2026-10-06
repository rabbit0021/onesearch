import { useState, useEffect, useCallback, useRef } from 'react'
import { getComments, postComment, deleteComment, likeComment, getOrCreateDeviceId } from '../../api'
import { useAuth } from '../../context/AuthContext'
import styles from './Comments.module.css'

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr + 'Z').getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function CommentForm({ onSubmit, onCancel, loading, initialBody = '', autoFocus = false }) {
  const [body, setBody] = useState(initialBody)
  const [author, setAuthor] = useState(() => localStorage.getItem('comment_author') || '')
  const [nameError, setNameError] = useState(false)

  function handleSubmit(e) {
    e.preventDefault()
    if (!author.trim()) { setNameError(true); return }
    if (!body.trim()) return
    setNameError(false)
    localStorage.setItem('comment_author', author.trim())
    onSubmit({ body: body.trim(), author: author.trim() })
    setBody('')
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.authorRow}>
        <input
          className={`${styles.authorInput} ${nameError ? styles.inputError : ''}`}
          type="text"
          placeholder="Your name (required)"
          value={author}
          maxLength={50}
          onChange={e => { setAuthor(e.target.value); if (e.target.value.trim()) setNameError(false) }}
        />
        <span className={styles.charCount}>{body.length}/2000</span>
      </div>
      {nameError && <span className={styles.fieldError}>Name is required</span>}
      <textarea
        className={styles.textarea}
        placeholder="Write a comment…"
        value={body}
        onChange={e => setBody(e.target.value)}
        rows={3}
        maxLength={2000}
        autoFocus={autoFocus}
      />
      <div className={styles.formFooter}>
        {onCancel && (
          <button className={styles.cancelBtn} type="button" onClick={onCancel}>Cancel</button>
        )}
        <button className={styles.submitBtn} type="submit" disabled={loading || !body.trim()}>
          {loading ? 'Posting…' : 'Post'}
        </button>
      </div>
    </form>
  )
}

function CommentItem({ comment, deviceId, email, onReply, onDelete, onLike, isReply = false, rootParentId = null }) {
  const [replyOpen, setReplyOpen] = useState(false)
  const isOwn = (email && comment.email === email) || comment.device_id === deviceId

  return (
    <div className={`${styles.comment} ${isReply ? styles.replyComment : ''}`}>
      <div className={styles.commentHeader}>
        <span className={styles.commentAuthor}>{comment.author}</span>
        <span className={styles.commentTime}>{timeAgo(comment.created_at)}</span>
        <button className={styles.likeBtn} onClick={() => onLike(comment.id)} aria-label="Like">
          <span className={`${styles.heart} ${comment.liked ? styles.heartLiked : styles.heartEmpty}`}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
          </span>
          {comment.like_count > 0 && <span className={styles.likeCount}>{comment.like_count}</span>}
        </button>
        {isOwn && (
          <button className={styles.deleteBtn} onClick={() => onDelete(comment.id)}>Delete</button>
        )}
      </div>
      <p className={styles.commentBody}>{comment.body}</p>
      <div className={styles.commentActions}>
        <button className={styles.replyBtn} onClick={() => setReplyOpen(v => !v)}>
          {replyOpen ? 'Cancel' : 'Reply'}
        </button>
      </div>
      {replyOpen && (
        <div className={styles.replyForm}>
          <CommentForm
            autoFocus
            initialBody={`@${comment.author} `}
            onSubmit={({ body, author }) => {
              onReply({ body, author, parentId: rootParentId ?? comment.id })
              setReplyOpen(false)
            }}
            onCancel={() => setReplyOpen(false)}
          />
        </div>
      )}
    </div>
  )
}

export default function Comments({ postId }) {
  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const formRef = useRef(null)
  const deviceId = getOrCreateDeviceId()
  const { email } = useAuth()

  const load = useCallback(async () => {
    try {
      const data = await getComments(postId, getOrCreateDeviceId())
      setComments(data)
    } catch {
      setError('Failed to load comments.')
    } finally {
      setLoading(false)
    }
  }, [postId])

  useEffect(() => { load() }, [load])

  async function handleSubmit({ body, author, parentId = null }) {
    setSubmitting(true)
    setError(null)
    try {
      const c = await postComment(postId, { body, author, parentId, deviceId, email })
      setComments(prev => [...prev, c])
      setShowForm(false)
    } catch (e) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleLike(commentId) {
    try {
      const { liked, like_count } = await likeComment(commentId, deviceId)
      setComments(prev => prev.map(c => c.id === commentId ? { ...c, liked, like_count } : c))
    } catch { /* silent */ }
  }

  async function handleDelete(commentId) {
    try {
      await deleteComment(commentId, deviceId, email)
      setComments(prev => prev.filter(c => c.id !== commentId && c.parent_id !== commentId))
    } catch {
      setError('Failed to delete comment.')
    }
  }

  const topLevelIds = new Set(comments.filter(c => c.parent_id === null).map(c => c.id))
  const topLevel = comments.filter(c => c.parent_id === null)
  // Only show replies whose parent still exists
  const repliesFor = id => comments.filter(c => c.parent_id === id && topLevelIds.has(c.parent_id))
  const visibleCount = topLevel.length + topLevel.reduce((acc, c) => acc + repliesFor(c.id).length, 0)

  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <h2 className={styles.title}>
          Comments {visibleCount > 0 && <span className={styles.count}>{visibleCount}</span>}
        </h2>
        {!showForm && (
          <button className={styles.addBtn} onClick={() => {
            setShowForm(true)
            setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50)
          }}>Add Comment</button>
        )}
      </div>

      {showForm && (
        <div className={`${styles.topForm} ${topLevel.length > 0 ? styles.topFormDivider : ''}`} ref={formRef}>
          <CommentForm
            autoFocus
            loading={submitting}
            onSubmit={handleSubmit}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      {error && <p className={styles.error}>{error}</p>}

      {loading ? (
        <p className={styles.empty}>Loading…</p>
      ) : topLevel.length === 0 ? (
        <p className={styles.empty}>No comments yet. Be the first!</p>
      ) : (
        <div className={styles.list}>
          {topLevel.map(comment => (
            <div key={comment.id} className={styles.commentThread}>
              <CommentItem
                comment={comment}
                deviceId={deviceId}
                email={email}
                onReply={handleSubmit}
                onDelete={handleDelete}
                onLike={handleLike}
              />
              {repliesFor(comment.id).map(reply => (
                <CommentItem
                  key={reply.id}
                  comment={reply}
                  deviceId={deviceId}
                  email={email}
                  onReply={handleSubmit}
                  onDelete={handleDelete}
                  onLike={handleLike}
                  isReply
                  rootParentId={comment.id}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
