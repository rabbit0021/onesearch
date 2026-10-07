import styles from './ReportCard.module.css'

export default function ReportCard({ meters, finalReport, onRestart }) {
  const { dignity, chaos } = meters
  const loading = !finalReport

  const handleShare = () => {
    const { dignity, chaos } = meters
    const text = finalReport
      ? `I confessed to Jev ⚡\n\n${finalReport.outcome_title}\nArchetype: ${finalReport.archetype}\n\n"${finalReport.story}"\n\nDignity: ${Math.round(dignity)} | Chaos: ${Math.round(chaos)}\n\nConfess to Jev → typesafe.ai`
      : `I confessed to Jev ⚡\n\nDignity: ${Math.round(dignity)} | Chaos: ${Math.round(chaos)}\n\nConfess to Jev → typesafe.ai`
    navigator.clipboard.writeText(text).catch(() => {})
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <div className={styles.header}>Company Report Card</div>

        {loading ? (
          <div className={styles.loading}>
            <div className={styles.loadingDots}>
              <span /><span /><span />
            </div>
            <p className={styles.loadingText}>Jev is writing your legacy...</p>
          </div>
        ) : (
          <>
            <div className={styles.outcome}>
              <div className={styles.outcomeTitle}>{finalReport.outcome_title}</div>
            </div>

            <div className={styles.archetype}>
              <div className={styles.archetypeLabel}>Your CEO Archetype</div>
              <div className={styles.archetypeTitle}>{finalReport.archetype}</div>
            </div>

            <div className={styles.story}>
              <p>{finalReport.story}</p>
            </div>
          </>
        )}

        <div className={styles.meters}>
          {[
            { label: 'Dignity', icon: '🎩', value: dignity, color: '#00ff88' },
            { label: 'Chaos',   icon: '🌀', value: chaos,   color: '#ff4466' },
          ].map(({ label, icon, value, color }) => (
            <div key={label} className={styles.meterItem}>
              <span>{icon} {label}</span>
              <strong style={{ color }}>{Math.round(value)}</strong>
            </div>
          ))}
        </div>

        <div className={styles.poweredBy}>⚡ Decisions scored by Jev · typesafe.ai</div>
      </div>

      <div className={styles.actions}>
        <button className={styles.shareBtn} onClick={handleShare} disabled={loading}>Copy Result 📋</button>
        <button className={styles.restartBtn} onClick={onRestart}>Play Again 🔄</button>
      </div>
    </div>
  )
}
