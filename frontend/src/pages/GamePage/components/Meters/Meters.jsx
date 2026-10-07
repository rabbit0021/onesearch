import styles from './Meters.module.css'

function Meter({ label, icon, value, color }) {
  return (
    <div className={styles.meter}>
      <div className={styles.label}>
        <span>{icon} {label}</span>
        <span className={styles.value}>{Math.round(value)}</span>
      </div>
      <div className={styles.track}>
        <div className={styles.fill} style={{ width: `${value}%`, background: color }} />
      </div>
    </div>
  )
}

export default function Meters({ dignity, chaos }) {
  return (
    <div className={styles.meters}>
      <Meter label="Dignity" icon="🎩" value={dignity} color="linear-gradient(90deg, #00ff88, #00cc70)" />
      <Meter label="Chaos"   icon="🌀" value={chaos}   color="linear-gradient(90deg, #ff4466, #cc0033)" />
    </div>
  )
}
