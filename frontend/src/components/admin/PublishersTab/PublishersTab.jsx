import { useState, useEffect } from 'react'
import { getPublishers, addPublisher } from '../../../api'
import styles from './PublishersTab.module.css'

const TYPES = ['techteam', 'individual', 'community']

export default function PublishersTab({ secretKey }) {
  const [publishers, setPublishers] = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')
  const [name, setName]             = useState('')
  const [type, setType]             = useState('techteam')
  const [adding, setAdding]         = useState(false)
  const [addError, setAddError]     = useState('')
  const [search, setSearch]         = useState('')

  async function load() {
    setLoading(true)
    try {
      const data = await getPublishers(secretKey)
      setPublishers(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleAdd(e) {
    e.preventDefault()
    if (!name.trim()) return
    setAdding(true)
    setAddError('')
    try {
      const res = await addPublisher(name.trim(), type, secretKey)
      if (res.status === 'success') {
        setName('')
        await load()
      } else {
        setAddError(res.message || 'Failed to add publisher.')
      }
    } catch (e) {
      setAddError(e.message)
    } finally {
      setAdding(false)
    }
  }

  const filtered = publishers.filter(p =>
    p.publisher_name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className={styles.wrap}>
      {/* Add publisher form */}
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Add Publisher</h2>
        <form className={styles.form} onSubmit={handleAdd}>
          <input
            className={styles.input}
            type="text"
            placeholder="Publisher name"
            value={name}
            onChange={e => setName(e.target.value)}
            required
          />
          <select
            className={styles.select}
            value={type}
            onChange={e => setType(e.target.value)}
          >
            {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <button className={styles.addBtn} type="submit" disabled={adding}>
            {adding ? 'Adding…' : '+ Add'}
          </button>
        </form>
        {addError && <p className={styles.addError}>{addError}</p>}
      </div>

      {/* Publishers list */}
      <div className={styles.card}>
        <div className={styles.listHeader}>
          <h2 className={styles.cardTitle}>Publishers ({publishers.length})</h2>
          <input
            className={styles.search}
            type="text"
            placeholder="Search…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <p className={styles.hint}>Loading…</p>
        ) : error ? (
          <p className={styles.errorMsg}>{error}</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Type</th>
                <th>Last Scraped</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id}>
                  <td className={styles.idCell}>{p.id}</td>
                  <td>{p.publisher_name}</td>
                  <td><span className={`${styles.badge} ${styles[p.publisher_type]}`}>{p.publisher_type}</span></td>
                  <td className={styles.muted}>{p.last_scraped_at ? new Date(p.last_scraped_at).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={4} className={styles.hint}>No publishers found.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
