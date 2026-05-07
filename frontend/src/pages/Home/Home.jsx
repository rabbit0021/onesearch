import { useState, useCallback, useRef, useEffect } from 'react'
import { subscribe, getSubscriptionsForEmail } from '../../api'
import { useToast } from '../../context/ToastContext'

import Header from '../../components/layout/Header/Header'
import Footer from '../../components/layout/Footer/Footer'
import NotificationIcon from '../../components/layout/NotificationIcon/NotificationIcon'
import ThemeSwitcher from '../../components/layout/ThemeSwitcher/ThemeSwitcher'
import JiraHeaderButton from '../../components/jira/JiraHeaderButton/JiraHeaderButton'
import Sidebar from '../../components/sidebar/Sidebar/Sidebar'

import EmailInput from '../../components/subscription/EmailInput/EmailInput'
import TopicSelector from '../../components/subscription/TopicSelector/TopicSelector'
import SourceSelector from '../../components/subscription/SourceSelector/SourceSelector'
import CompanySelector from '../../components/subscription/CompanySelector/CompanySelector'
import IndividualsSelector from '../../components/subscription/IndividualsSelector/IndividualsSelector'
import FrequencySlider from '../../components/subscription/FrequencySlider/FrequencySlider'
import SubscriptionStatus from '../../components/subscription/SubscriptionStatus/SubscriptionStatus'

import JiraIssuesSummary from '../../components/jira/JiraIssuesSummary/JiraIssuesSummary'
import BlogFeed from '../../components/feed/BlogFeed/BlogFeed'
import styles from './Home.module.css'

export default function Home() {
  const { showToast } = useToast()

  // Form state
  const [email, setEmail] = useState('')
  const [topic, setTopic] = useState('')
  const [sources, setSources] = useState(['techteams'])
  const [companies, setCompanies] = useState([])
  const [individuals, setIndividuals] = useState([])
  const [frequency, setFrequency] = useState(2)
  const [existingSubs, setExistingSubs] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [hasDot, setHasDot] = useState(true)
  const toggleRef = useRef(null)

  const formRef = useRef(null)
  const feedWrapperRef = useRef(null)
  const [atTop, setAtTop] = useState(true)

  useEffect(() => {
    const el = feedWrapperRef.current
    if (!el) return
    const onScroll = () => setAtTop(el.scrollTop <= 50)
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  function handleSourceChange(id, checked) {
    setSources((prev) =>
      checked ? [...prev, id] : prev.filter((s) => s !== id)
    )
    if (id === 'techteams' && !checked) setCompanies([])
    if (id === 'individuals' && !checked) setIndividuals([])
  }

  async function handleEmailBlur(email) {
    setEmail(email)
    if (!email || !email.includes('@')) {
      setExistingSubs(null)
      return
    }
    try {
      const data = await getSubscriptionsForEmail(email)
      setExistingSubs(Object.keys(data).length > 0 ? data : null)
    } catch {
      // silently ignore
    }
  }

  function handleSidebarToggle() {
    setSidebarOpen((prev) => !prev)
    setHasDot(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()

    if (!email) return showToast('Please enter your email.')
    if (!topic) return showToast('Please select a topic.')
    if (sources.includes('techteams') && companies.length === 0 && !sources.includes('individuals'))
      return showToast('Please select at least one tech team.')
    if (sources.includes('individuals') && individuals.length === 0 && !sources.includes('techteams'))
      return showToast('Please select at least one individual.')

    setSubmitting(true)
    try {
      const res = await subscribe({ email, techteams: companies, individuals, topic, frequency })
      if (res.status === 'success') {
        showToast('Subscribed!')
        setTopic('')
        setCompanies([])
        setIndividuals([])
        setFrequency(2)
      } else {
        showToast(res.message || 'Subscription failed. Try again.')
      }
    } catch {
      showToast('Something went wrong. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const closeSidebar = useCallback(() => setSidebarOpen(false), [])

  return (
    <div className={styles.page}>
      <Sidebar open={sidebarOpen} onClose={closeSidebar} toggleRef={toggleRef} />

      <main className={styles.container}>
        <div className={styles.layout}>
          <div className={styles.formWrapper}>
            {/* Mobile: header + action buttons inline */}
            <div className={styles.mobileHeaderRow}>
              <Header />
              <div className={styles.mobileActions}>
                <JiraHeaderButton />
                <ThemeSwitcher />
              </div>
            </div>
            <form ref={formRef} className={styles.form} onSubmit={handleSubmit} noValidate>
              <div className={styles.text}>
                <h1 className={styles.title}>Subscribe to what you need</h1>
                <p className={styles.intro}>
                  Onesearch aggregates insights from top tech publishers — so you always know what the industry is building, breaking,
                  and shipping.
                </p>
              </div>
              <EmailInput
                value={email}
                onChange={handleEmailBlur}
              />

              <SubscriptionStatus data={existingSubs} />

              <TopicSelector value={topic} onChange={setTopic} />

              <SourceSelector selected={sources} onChange={handleSourceChange} />

              <CompanySelector
                selected={companies}
                onChange={setCompanies}
                disabled={!sources.includes('techteams')}
              />

              <IndividualsSelector
                selected={individuals}
                onChange={setIndividuals}
                disabled={!sources.includes('individuals')}
              />

              <FrequencySlider value={frequency} onChange={setFrequency} />

              <button type="submit" className={styles.submitBtn} disabled={submitting}>
                {submitting ? <>subscribing<span className={styles.blink}>_</span></> : <><span className={styles.prompt}>&gt;_</span> subscribe</>}
              </button>
            </form>
          </div>

          <div className={styles.feedWrapper} ref={feedWrapperRef}>
            <BlogFeed formRef={formRef} />

            {/* <JiraIssuesSummary /> */}
          </div>
        </div>

        {/* <Footer /> */}
      </main>

      {/* Fixed top-right corner — desktop: all buttons; mobile: notif only */}
      <div className={`${styles.topRight} ${atTop ? '' : styles.topRightHidden}`}>
        <div className={`${styles.topRightHideable} ${atTop ? '' : styles.topRightHidden}`}>
          <JiraHeaderButton />
          <ThemeSwitcher />
        </div>
        <NotificationIcon open={sidebarOpen} hasDot={hasDot} onClick={handleSidebarToggle} btnRef={toggleRef} />
      </div>
    </div>
  )
}
