import { useState, useEffect, useRef } from 'react'
import { startJob, getJob, cancelJob, getJobHistory } from '../../../api'
import styles from './JobsTab.module.css'

const JOBS = [
  { id: 'scrape', label: 'Scrape Publishers', description: 'Fetch new blog posts from all subscribed publishers and classify them.' },
  { id: 'notify', label: 'Queue Notifications', description: 'Match new labelled posts to subscriber preferences and queue notifications.' },
  { id: 'send',   label: 'Send Notifications', description: 'Send queued notification emails to subscribers whose frequency has matured.' },
]

function logLevel(line) {
  if (line.startsWith('ERROR'))   return 'error'
  if (line.startsWith('WARNING')) return 'warn'
  if (line.startsWith('DEBUG'))   return 'debug'
  return 'info'
}

function LogPanel({ logs, running }) {
  const containerRef = useRef(null)
  const bottomRef = useRef(null)

  useEffect(() => {
    const el = containerRef.current
    if (!running || !el || !bottomRef.current) return
    // only auto-scroll if user is within 80px of the bottom
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80
    if (nearBottom) bottomRef.current.scrollIntoView({ behavior: 'smooth' })
  }, [logs.length, running])

  return (
    <div className={styles.logPanel}>
      {logs.length === 0 && running && <p className={styles.waiting}>Waiting for output…</p>}
      {logs.length > 0 && (
        <div className={styles.logs} ref={containerRef}>
          {logs.map((line, i) => (
            <div key={i} className={`${styles.logLine} ${styles[`log_${logLevel(line)}`]}`}>
              {line}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  )
}

function PastRun({ run }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={styles.pastRun}>
      <div className={styles.pastRunHeader} onClick={() => setOpen(p => !p)}>
        <span className={run.status === 'done' ? styles.statusOk : run.status === 'cancelled' ? styles.statusCancelled : styles.statusErr}>
          {run.status === 'done' ? '✓' : run.status === 'cancelled' ? '◼' : '✗'}
        </span>
        <span className={styles.pastRunTime}>
          {new Date(run.started_at).toLocaleString()}
        </span>
        <span className={styles.pastRunLogs}>{run.logs.length} log lines</span>
        <span className={styles.pastRunId}>id: {run.job_id}</span>
        <span className={styles.toggle}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        run.logs?.length > 0
          ? <LogPanel logs={run.logs} running={false} />
          : <p className={styles.waiting}>No logs available</p>
      )}
    </div>
  )
}

function JobCard({ job, secretKey }) {
  const [running, setRunning]       = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [status, setStatus]         = useState(null)
  const [jobId, setJobId]           = useState(null)
  const [logs, setLogs]           = useState([])
  const [logsOpen, setLogsOpen]   = useState(true)
  const [history, setHistory]     = useState([])
  const [loadingHistory, setLoadingHistory] = useState(true)

  useEffect(() => {
    getJobHistory(job.id, secretKey)
      .then(setHistory)
      .catch(() => {})
      .finally(() => setLoadingHistory(false))
  }, [job.id, secretKey])

  async function handleRun() {
    setRunning(true)
    setStatus(null)
    setLogs([])
    setLogsOpen(true)
    setJobId(null)

    try {
      const { job_id, error } = await startJob(job.id, secretKey)
      if (error) throw new Error(error)
      setJobId(job_id)
      setCancelling(false)

      await new Promise((resolve) => {
        const poll = async () => {
          try {
            const data = await getJob(job_id, secretKey)
            setLogs(data.logs || [])
            if (data.status !== 'running') {
              setStatus(data.status)
              resolve()
            } else {
              setTimeout(poll, 500)
            }
          } catch {
            setStatus('error')
            resolve()
          }
        }
        setTimeout(poll, 300)
      })

      // refresh history after run
      getJobHistory(job.id, secretKey).then(setHistory).catch(() => {})
    } catch (e) {
      setLogs(prev => [...prev, `ERROR ${e.message}`])
      setStatus('error')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className={styles.jobCard}>
      <div className={styles.jobHeader}>
        <div>
          <div className={styles.jobLabel}>{job.label}</div>
          <div className={styles.jobDesc}>{job.description}</div>
          {jobId && <div className={styles.jobId}>job id: <code>{jobId}</code></div>}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {running && (
            <button
              className={styles.cancelBtn}
              onClick={async () => {
                setCancelling(true)
                await cancelJob(jobId, secretKey)
              }}
              disabled={cancelling}
            >
              {cancelling ? 'Cancelling…' : '✕ Cancel'}
            </button>
          )}
          <button
            className={styles.runBtn}
            onClick={handleRun}
            disabled={running}
          >
            {running ? <><span className={styles.spinner} /> Running…</> : '▶ Run'}
          </button>
        </div>
      </div>

      {/* Current run */}
      {(running || status) && (
        <div className={`${styles.logBox} ${status === 'error' ? styles.logBoxError : status === 'done' ? styles.logBoxOk : styles.logBoxRunning}`}>
          <div className={styles.logBoxHeader} onClick={() => setLogsOpen(p => !p)} style={{ cursor: 'pointer' }}>
            {running        && <span className={styles.statusRunning}><span className={styles.spinnerInline} /> {cancelling ? 'Cancelling…' : 'Running…'}</span>}
            {status === 'done'      && <span className={styles.statusOk}>✓ Completed</span>}
            {status === 'error'     && <span className={styles.statusErr}>✗ Failed</span>}
            {status === 'cancelled' && <span className={styles.statusCancelled}>◼ Cancelled</span>}
            <span className={styles.toggle} style={{ marginLeft: 'auto' }}>{logsOpen ? '▲' : '▼'}</span>
          </div>
          {logsOpen && <LogPanel logs={logs} running={running} />}
        </div>
      )}

      {/* Past runs */}
      {!loadingHistory && history.length > 0 && (
        <div className={styles.pastRuns}>
          <div className={styles.pastRunsLabel}>Past runs ({history.length})</div>
          {history.map(r => <PastRun key={r.job_id} run={r} />)}
        </div>
      )}
    </div>
  )
}

export default function JobsTab({ secretKey }) {
  return (
    <div className={styles.wrap}>
      <p className={styles.hint}>Run backend jobs manually. Logs stream in real time. Last 2 runs per job are stored.</p>
      {JOBS.map(job => <JobCard key={job.id} job={job} secretKey={secretKey} />)}
    </div>
  )
}
