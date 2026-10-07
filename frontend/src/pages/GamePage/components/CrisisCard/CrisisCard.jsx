import styles from './CrisisCard.module.css'

export default function CrisisCard({ crisis, onChoice, disabled, round }) {
  if (!crisis) return null
  return (
    <div className={styles.card} key={round}>
      <div className={styles.emoji}>{crisis.emoji}</div>
      <p className={styles.scenario}>{crisis.scenario}</p>
      <div className={styles.options}>
        {crisis.options.map((option, i) => (
          <button
            key={i}
            className={styles.option}
            onClick={() => onChoice(i)}
            disabled={disabled}
          >
            <span className={styles.optionLetter}>{String.fromCharCode(65 + i)}</span>
            {option.text}
          </button>
        ))}
      </div>
    </div>
  )
}
