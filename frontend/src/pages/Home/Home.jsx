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
  const [frequency, setFrequency] = useState(2)
  const [existingSubs, setExistingSubs] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [hasDot, setHasDot] = useState(true)
  const toggleRef = useRef(null)

  const formRef = useRef(null)
  const [atTop, setAtTop] = useState(true)
  useEffect(() => {
    const onScroll = () => setAtTop(window.scrollY <= 50)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  function handleSourceChange(id, checked) {
    setSources((prev) =>
      checked ? [...prev, id] : prev.filter((s) => s !== id)
    )
    if (id === 'techteams' && !checked) setCompanies([])
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
    if (sources.includes('techteams') && companies.length === 0)
      return showToast('Please select at least one tech team.')

    setSubmitting(true)
    try {
      const res = await subscribe({ email, techteams: companies, topic, frequency })
      if (res.status === 'success') {
        showToast('Subscribed! Check your inbox.')
        setTopic('')
        setCompanies([])
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
        <div className={styles.headerRow}>
          <Header />
          <div className={styles.topRight}>
            <div className={`${styles.topRightHideable} ${atTop && !sidebarOpen ? '' : styles.topRightHidden}`}>
              <JiraHeaderButton />
              <ThemeSwitcher />
            </div>
            <div className={styles.notifBtn}>
              <NotificationIcon open={sidebarOpen} hasDot={hasDot} onClick={handleSidebarToggle} btnRef={toggleRef} />
            </div>
          </div>
        </div>

        <div className={styles.layout}>
          <form ref={formRef} className={styles.form} onSubmit={handleSubmit} noValidate>
            <div className={styles.text}>
              <h1 className={styles.title}>Subscribe to Engineering Blogs</h1>
              <p className={styles.intro}>
                Stay up to date with the latest posts from top engineering blogs. Select your topic and favorite publisher, and we will send you curated alerts.
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

            <FrequencySlider value={frequency} onChange={setFrequency} />

            <button type="submit" className={styles.submitBtn} disabled={submitting}>
              {submitting ? <>subscribing<span className={styles.blink}>_</span></> : <><span className={styles.prompt}>&gt;_</span> subscribe</>}
            </button>
          </form>

          <BlogFeed formRef={formRef} />

          {/* <JiraIssuesSummary /> */}

          <div className={styles.sidebar}>
          </div>
        </div>

        {/* <Footer /> */}
      </main>
    </div>
  )
}
