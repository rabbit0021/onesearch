import PostRow from '../PostRow/PostRow'
import styles from './PostsTable.module.css'

/**
 * Props:
 *   posts      – post[]
 *   secretKey  – string
 *   onUpdated  – () => void
 */
export default function PostsTable({ posts, secretKey, onUpdated }) {
  if (posts.length === 0) {
    return <p className={styles.empty}>No posts found.</p>
  }

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            {['ID', 'Title', 'Topic', 'Publisher', 'Published', 'Tags', 'Labelled', 'Action'].map(
              (h) => (
                <th key={h} className={styles.th}>
                  {h}
                </th>
              )
            )}
          </tr>
        </thead>
        <tbody>
          {posts.map((post) => (
            <PostRow
              key={post.id}
              post={post}
              secretKey={secretKey}
              onUpdated={onUpdated}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}
