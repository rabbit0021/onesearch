import { useState, useEffect, useCallback } from 'react'
import { adminGetNewsBanners, adminCreateNewsBanner, adminUpdateNewsBanner, adminDeleteNewsBanner } from '../../../api'
import styles from './NewsBannersTab.module.css'

const EMPTY_FORM = {
  publisher: '',
  time_label: '',
  headline: '',
  tags: '',
  image_url: '',
  link: '',
  search_query: '',
  position: 0,
  visible: true,
}

function BannerForm({ form, setForm, onSubmit, onCancel, submitLabel, saving }) {
  return (
    <form className={styles.form} onSubmit={onSubmit}>
      <div className={styles.formGrid}>
        <label className={styles.fieldLabel}>
          Publisher *
          <input className={styles.input} value={form.publisher} onChange={e => setForm(f => ({ ...f, publisher: e.target.value }))} required />
        </label>
        <label className={styles.fieldLabel}>
          Time Label *
          <input className={styles.input} placeholder="e.g. 2h ago" value={form.time_label} onChange={e => setForm(f => ({ ...f, time_label: e.target.value }))} required />
        </label>
        <label className={`${styles.fieldLabel} ${styles.fullWidth}`}>
          Headline *
          <input className={styles.input} value={form.headline} onChange={e => setForm(f => ({ ...f, headline: e.target.value }))} required />
        </label>
        <label className={styles.fieldLabel}>
          Tags (comma-separated)
          <input className={styles.input} placeholder="AI/ML, Engineering" value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} />
        </label>
        <label className={styles.fieldLabel}>
          Image URL
          <input className={styles.input} placeholder="https://..." value={form.image_url} onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))} />
        </label>
        <label className={styles.fieldLabel}>
          Link (optional)
          <input className={styles.input} placeholder="https://..." value={form.link} onChange={e => setForm(f => ({ ...f, link: e.target.value }))} />
        </label>
        <label className={`${styles.fieldLabel} ${styles.fullWidth}`}>
          Search Query * <span className={styles.hint}>(what to search for when clicked)</span>
          <input className={styles.input} value={form.search_query} onChange={e => setForm(f => ({ ...f, search_query: e.target.value }))} required />
        </label>
        <label className={styles.fieldLabel}>
          Position (0–4)
          <input className={styles.input} type="number" min="0" max="4" value={form.position} onChange={e => setForm(f => ({ ...f, position: Number(e.target.value) }))} />
        </label>
        <label className={`${styles.fieldLabel} ${styles.checkboxLabel}`}>
          <input type="checkbox" checked={form.visible} onChange={e => setForm(f => ({ ...f, visible: e.target.checked }))} />
          Visible
        </label>
      </div>
      <div className={styles.formActions}>
        <button type="submit" className={styles.saveBtn} disabled={saving}>{saving ? 'Saving…' : submitLabel}</button>
        <button type="button" className={styles.cancelBtn} onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}

export default function NewsBannersTab({ secretKey }) {
  const [banners, setBanners] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState(null)
  const [editForm, setEditForm] = useState(null)

  const fetchBanners = useCallback(() => {
    setLoading(true)
    adminGetNewsBanners(secretKey)
      .then(setBanners)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [secretKey])

  useEffect(() => { fetchBanners() }, [fetchBanners])

  async function handleAdd(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await adminCreateNewsBanner(secretKey, { ...addForm, visible: addForm.visible ? 1 : 0 })
      setAddForm(EMPTY_FORM)
      setShowAdd(false)
      fetchBanners()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdate(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await adminUpdateNewsBanner(secretKey, editId, { ...editForm, visible: editForm.visible ? 1 : 0 })
      setEditId(null)
      setEditForm(null)
      fetchBanners()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this banner?')) return
    try {
      await adminDeleteNewsBanner(secretKey, id)
      fetchBanners()
    } catch (err) {
      setError(err.message)
    }
  }

  function startEdit(banner) {
    setEditId(banner.id)
    setEditForm({
      publisher: banner.publisher,
      time_label: banner.time_label,
      headline: banner.headline,
      tags: banner.tags || '',
      image_url: banner.image_url || '',
      link: banner.link || '',
      search_query: banner.search_query,
      position: banner.position,
      visible: !!banner.visible,
    })
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.topBar}>
        <h2 className={styles.title}>News Banners</h2>
        <button className={styles.addBtn} onClick={() => { setShowAdd(v => !v); setEditId(null) }}>
          {showAdd ? '− Cancel' : '+ Add Banner'}
        </button>
      </div>

      {error && <p className={styles.errorMsg}>{error}</p>}

      {showAdd && (
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>New Banner</h3>
          <BannerForm
            form={addForm}
            setForm={setAddForm}
            onSubmit={handleAdd}
            onCancel={() => setShowAdd(false)}
            submitLabel="Create Banner"
          />
        </div>
      )}

      {loading
        ? <p className={styles.hintText}>Loading…</p>
        : banners.length === 0
          ? <p className={styles.hintText}>No banners yet. Add one above.</p>
          : banners.map(banner => (
            <div key={banner.id} className={styles.card}>
              {editId === banner.id
                ? (
                  <>
                    <h3 className={styles.cardTitle}>Edit Banner</h3>
                    <BannerForm
                      form={editForm}
                      setForm={setEditForm}
                      onSubmit={handleUpdate}
                      onCancel={() => { setEditId(null); setEditForm(null) }}
                      submitLabel="Save Changes"
                    />
                  </>
                )
                : (
                  <div className={styles.bannerRow}>
                    <div className={styles.bannerInfo}>
                      <div className={styles.bannerMeta}>
                        <span className={styles.bannerPublisher}>{banner.publisher}</span>
                        <span className={styles.bannerTime}>{banner.time_label}</span>
                        <span className={`${styles.visibleBadge} ${banner.visible ? styles.visibleOn : styles.visibleOff}`}>
                          {banner.visible ? 'visible' : 'hidden'}
                        </span>
                        <span className={styles.positionBadge}>pos {banner.position}</span>
                      </div>
                      <p className={styles.bannerHeadline}>{banner.headline}</p>
                      <p className={styles.bannerQuery}>search: <em>{banner.search_query}</em></p>
                    </div>
                    <div className={styles.bannerActions}>
                      <button className={styles.editBtn} onClick={() => startEdit(banner)}>Edit</button>
                      <button className={styles.deleteBtn} onClick={() => handleDelete(banner.id)}>Delete</button>
                    </div>
                  </div>
                )
              }
            </div>
          ))
      }
    </div>
  )
}
