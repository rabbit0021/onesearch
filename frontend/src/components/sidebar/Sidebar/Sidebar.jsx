import { useEffect, useRef } from 'react'
import { postInterested } from '../../../api'
import { useToast } from '../../../context/ToastContext'
import FeatureCard from '../FeatureCard/FeatureCard'
import ChatWidget from '../ChatWidget/ChatWidget'
import styles from './Sidebar.module.css'

/**
 * Props:
 *   open         – boolean
 *   onClose      – () => void
 *   toggleRef    – ref to the toggle button so outside-click excludes it
 */
export default function Sidebar({ open, onClose, toggleRef }) {
  const ref = useRef(null)
  const { showToast } = useToast()

  // Close when clicking outside, but not when clicking the toggle button
  // (the toggle button handles its own open/close)
  useEffect(() => {
    function handler(e) {
      if (
        open &&
        ref.current &&
        !ref.current.contains(e.target) &&
        !(toggleRef?.current && toggleRef.current.contains(e.target))
      ) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, onClose, toggleRef])

  async function handleInterested() {
    try {
      await postInterested()
      showToast("Thanks! We'll prioritize this feature.")
    } catch {
      showToast('Something went wrong.')
    }
  }

  return (
    <aside ref={ref} className={`${styles.sidebar} ${open ? styles.open : ''}`}>
      <div className={styles.content}>
        <FeatureCard title="Feature Poll 🚀">
          <p>Recommendations based on your reading patterns</p>
          <br />
          <button className={styles.actionBtn} onClick={handleInterested}>
            I&apos;m interested!
          </button>
        </FeatureCard>

        <FeatureCard title="Upcoming Features 🔧">
          <ul className={styles.list}>
            <li>Top individual blogger subscriptions</li>
            <li>Commenting 🤩</li>
          </ul>
        </FeatureCard>

        <ChatWidget />
      </div>
    </aside>
  )
}
