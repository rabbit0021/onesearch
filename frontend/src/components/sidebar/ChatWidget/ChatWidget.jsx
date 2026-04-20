import styles from './ChatWidget.module.css'
import FeedbackForm from '../FeedbackForm/FeedbackForm'
import FeatureCard from '../FeatureCard/FeatureCard'

export default function ChatWidget() {
  return (
    <div className={styles.widget}>
<div className={styles.bubble}>
        Hey there! 👋 Enjoying Onesearch? Let us know what you&apos;d like to see next!
      </div>

        <FeatureCard title="Send Feedback ✉️">
          <FeedbackForm />
        </FeatureCard>
    </div>
  )
}
