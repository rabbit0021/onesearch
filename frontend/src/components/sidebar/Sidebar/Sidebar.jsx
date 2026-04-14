import { useEffect, useRef } from 'react'
import { postInterested } from '../../../api'
import { useToast } from '../../../context/ToastContext'
import FeatureCard from '../FeatureCard/FeatureCard'
import FeedbackForm from '../FeedbackForm/FeedbackForm'
import ChatWidget from '../ChatWidget/ChatWidget'
import styles from './Sidebar.module.css'

/**
 * Props:
 *   open      – boolean
 *   onClose   – () => void
 */
export default function Sidebar({ open, onClose }) {
  const ref = useRef(null)
  const { showToast } = useToast()

  // Close on outside click
  useEffect(() => {
    function handler(e) {
      if (open && ref.current && !ref.current.contains(e.target)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, onClose])

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
      <button className={styles.close} onClick={onClose} aria-label="Close">
        &times;
      </button>

      <div className={styles.content}>
        <FeatureCard title="New Feature in Beta 🚀">
          <p>Publisher recommendations based on your reading patterns.</p>
          <button className={styles.actionBtn} onClick={handleInterested}>
            I&apos;m interested!
          </button>
        </FeatureCard>

        <FeatureCard title="Send Feedback ✉️">
          <FeedbackForm />
        </FeatureCard>

        <FeatureCard title="Upcoming Improvements 🔧">
          <ul className={styles.list}>
            <li>Individual blogger subscriptions</li>
            <li>Community digest support</li>
            <li>Personalised feed ranking</li>
          </ul>
        </FeatureCard>

        <ChatWidget />
      </div>
    </aside>
  )
}
