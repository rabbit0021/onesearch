import { useState, useEffect, useMemo, useRef } from 'react'
import EmailInput from '../EmailInput/EmailInput'
import TopicSelector from '../TopicSelector/TopicSelector'
import SourceSelector from '../SourceSelector/SourceSelector'
import CompanySelector from '../CompanySelector/CompanySelector'
import IndividualsSelector from '../IndividualsSelector/IndividualsSelector'
import FrequencySlider from '../FrequencySlider/FrequencySlider'
import SubscriptionStatus from '../SubscriptionStatus/SubscriptionStatus'
import styles from './MobileSubscribeSheet.module.css'

const STEP_DEFS = [
  { id: 'email',       title: 'Your email',   subtitle: 'Step 1 — We\'ll send digests here' },
  { id: 'topic',       title: 'Topic',        subtitle: 'What are you interested in?' },
  { id: 'sources',     title: 'Sources',      subtitle: 'Where should we pull from?' },
  { id: 'companies',   title: 'Tech teams',   subtitle: 'Pick the companies to follow' },
  { id: 'individuals', title: 'Individuals',  subtitle: 'Pick the individuals to follow' },
  { id: 'frequency',   title: 'Frequency',    subtitle: 'How often should we send?' },
]

function StepContent({ stepId, email, setEmail, existingSubs, topic, setTopic, sources, onSourceChange, companies, setCompanies, individuals, setIndividuals, frequency, setFrequency }) {
  return (
    <div className={styles.stepContent}>
      {stepId === 'email' && (
        <>
          <EmailInput value={email} onChange={setEmail} />
          <SubscriptionStatus data={existingSubs} />
        </>
      )}
      {stepId === 'topic' && <TopicSelector value={topic} onChange={setTopic} />}
      {stepId === 'sources' && <SourceSelector selected={sources} onChange={onSourceChange} />}
      {stepId === 'companies' && <CompanySelector selected={companies} onChange={setCompanies} disabled={false} />}
      {stepId === 'individuals' && <IndividualsSelector selected={individuals} onChange={setIndividuals} disabled={false} />}
      {stepId === 'frequency' && <FrequencySlider value={frequency} onChange={setFrequency} />}
    </div>
  )
}

export default function MobileSubscribeSheet({
  open,
  onClose,
  email, setEmail,
  topic, setTopic,
  sources, onSourceChange,
  companies, setCompanies,
  individuals, setIndividuals,
  frequency, setFrequency,
  existingSubs,
  submitting,
  onSubmit,
  showToast,
}) {
  const [stepIndex, setStepIndex] = useState(0)
  const [showSuccess, setShowSuccess] = useState(false)

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  // Build active step list based on sources
  const steps = useMemo(() => {
    return STEP_DEFS.filter(s => {
      if (s.id === 'companies')   return sources.includes('techteams')
      if (s.id === 'individuals') return sources.includes('individuals')
      return true
    })
  }, [sources])

  const totalSteps = steps.length

  // Keep stepIndex in bounds when steps list changes
  useEffect(() => {
    if (stepIndex >= steps.length) {
      setStepIndex(steps.length - 1)
    }
  }, [steps.length]) // eslint-disable-line react-hooks/exhaustive-deps

  function validateStep(stepId) {
    if (stepId === 'email' && !email) { showToast('Please enter your email.'); return false }
    if (stepId === 'topic' && !topic) { showToast('Please select a topic.'); return false }
    if (stepId === 'companies' && companies.length === 0) { showToast('Please select at least one tech team.'); return false }
    if (stepId === 'individuals' && individuals.length === 0) { showToast('Please select at least one individual.'); return false }
    return true
  }

  function handleNext() {
    const currentStepId = (steps[stepIndex] ?? steps[steps.length - 1]).id
    if (!validateStep(currentStepId)) return
    setStepIndex(i => i + 1)
  }

  const isLastStep = stepIndex === totalSteps - 1
  const progress = totalSteps > 1 ? ((stepIndex + 1) / totalSteps) * 100 : 100

  async function handleSubmitWithSuccess() {
    const ok = await onSubmit()
    if (!ok) return
    setShowSuccess(true)
    setTimeout(() => {
      setShowSuccess(false)
      setStepIndex(0)
      onClose()
    }, 1600)
  }

  const stepProps = { email, setEmail, existingSubs, topic, setTopic, sources, onSourceChange, companies, setCompanies, individuals, setIndividuals, frequency, setFrequency }

  return (
    <>
      {/* Overlay */}
      <div
        className={`${styles.overlay} ${open ? styles.overlayVisible : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        className={`${styles.sheet} ${open ? styles.sheetOpen : styles.sheetClosed}`}
        role="dialog"
        aria-modal="true"
        aria-label="Subscribe"
      >
        {/* Drag handle */}
        <div className={styles.handle} />

        {/* Progress bar */}
        <div className={styles.progressTrack}>
          <div className={styles.progressBar} style={{ width: `${progress}%` }} />
        </div>

        {/* Step body — sliding track */}
        <div className={styles.stepBody}>
          {/* Track shifts left/right to reveal the active panel */}
          <div
            className={styles.stepTrack}
            style={{ transform: `translateX(calc(-${stepIndex} * 100%))` }}
          >
            {steps.map((step) => (
              <div key={step.id} className={styles.stepPanel}>
                <StepContent stepId={step.id} {...stepProps} />
              </div>
            ))}
          </div>
        </div>

        {/* Success overlay */}
        {showSuccess && (
          <div className={styles.successOverlay}>
            <svg className={styles.successTick} viewBox="0 0 52 52">
              <circle className={styles.successRing} cx="26" cy="26" r="23" />
              <path className={styles.successCheck} d="M14 26 l9 9 l15 -15" />
            </svg>
            <p className={styles.successMsg}>subscribed!</p>
          </div>
        )}

        {/* Nav */}
        <div className={styles.nav}>
          <button
            type="button"
            className={styles.backBtn}
            onClick={stepIndex > 0 ? () => setStepIndex(i => i - 1) : onClose}
          >
            {stepIndex > 0 ? 'Back' : 'Cancel'}
          </button>

          {isLastStep ? (
            <button
              type="button"
              className={styles.nextBtn}
              onClick={handleSubmitWithSuccess}
              disabled={submitting}
            >
              {submitting
                ? 'Subscribing…'
                : <><span className={styles.prompt}>&gt;_</span> subscribe</>
              }
            </button>
          ) : (
            <button
              type="button"
              className={styles.nextBtn}
              onClick={handleNext}
            >
              Next
            </button>
          )}
        </div>
      </div>
    </>
  )
}
