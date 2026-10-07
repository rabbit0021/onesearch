import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import styles from './GamePage.module.css'
import { useGameEngine } from './useGameEngine'
import { EMOJI_OPTIONS } from './crises'
import SpinWheel from './SpinWheel'
import { submitWinnerEmail } from './gameApi'


function scoreLabel(score) {
  if (score >= 8) return { text: 'Actually funny', color: '#00ff88' }
  if (score >= 6) return { text: 'Mildly amusing', color: '#aaff44' }
  if (score >= 4) return { text: 'Mediocre', color: '#ffcc00' }
  if (score >= 2) return { text: 'Painful', color: '#ff8844' }
  return { text: 'Not a joke', color: '#ff4466' }
}

export default function GamePage() {
  const {
    jevStatus, phase,
    picked, toggleItem,
    seed, setSeed,
    joke, funnyScore, isThinking, charCount,
    startWriting, stopWriting, restart,
    maxPicks,
    vocab, addWord, removeWord, resetVocab,
    playsUsed, maxPlays,
  } = useGameEngine()

  const [tab, setTab] = useState('env')
  const [newWord, setNewWord] = useState('')
  const [wordMsg, setWordMsg] = useState(null)
  const [showResults, setShowResults] = useState(false)
  const [winEmail, setWinEmail] = useState('')
  const [emailSubmitted, setEmailSubmitted] = useState(false)

  useEffect(() => {
    if (phase === 'idle') { setShowResults(false); setWinEmail(''); setEmailSubmitted(false) }
  }, [phase])

  const pickedEmojis = picked.map(p => p.emoji)
  const label = scoreLabel(funnyScore)
  const playsLeft = maxPlays - playsUsed
  const unlimited = import.meta.env.VITE_UNLIMITED_PLAYS === 'true'
  const outOfPlays = !unlimited && playsUsed >= maxPlays
  const isWinner = funnyScore >= 10

  function handleSpinDone() { setShowResults(true) }

  function handleEmailSubmit() {
    if (!winEmail.trim()) return
    const deviceId = localStorage.getItem('jev_device_id') || 'unknown'
    submitWinnerEmail(deviceId, winEmail.trim())
    setEmailSubmitted(true)
  }

  return (
    <div className={styles.root}>
      <div className={styles.scanlines} />

      {/* ── Idle ── */}
      {phase === 'idle' && (
        <div className={styles.startScreen}>
          <div className={styles.jevBadge}>⚡ Powered by Onesearch</div>
          <h1 className={styles.title}>Help Jev write<br/>a Joke</h1>
          <p className={styles.tagline}>
            Pick up to 7 environment props · seed up to 3 words · Jev writes · if it is a joke · win a phone?
          </p>

          {jevStatus === 'checking' && <p className={styles.jevChecking}>Waking Jev up...</p>}

          {jevStatus === 'unavailable' && (
            <div className={styles.jevUnavailable}>
              <span className={styles.jevUnavailableIcon}>⚠️</span>
              <p>Jev is unavailable right now.</p>
            </div>
          )}

          {jevStatus === 'ok' && (
            <>
              <div className={styles.playCounter}>
                {outOfPlays
                  ? <span className={styles.playCounterOut}>You've used all {maxPlays} plays on this device.</span>
                  : <span className={styles.playCounterLeft}>{playsLeft} / {maxPlays} plays remaining</span>
                }
              </div>

              {!outOfPlays && (
                <>
                  <div className={styles.tabBar}>
                    <button className={`${styles.tabBtn} ${tab === 'env' ? styles.tabBtnActive : ''}`} onClick={() => setTab('env')}>
                      Environment <span className={styles.tabBadge}>{pickedEmojis.length} / max {maxPicks}</span>
                    </button>
                    <button className={`${styles.tabBtn} ${tab === 'vocab' ? styles.tabBtnActive : ''}`} onClick={() => setTab('vocab')}>
                      Vocab <span className={styles.tabBadge}>{vocab.length}</span>
                    </button>
                  </div>

                  {tab === 'env' && (
                    <div className={styles.tabPanel}>
                      <div className={styles.emojiGrid}>
                        {EMOJI_OPTIONS.map(({ emoji, label: lbl }) => (
                          <button key={emoji} className={`${styles.emojiBtn} ${pickedEmojis.includes(emoji) ? styles.emojiBtnSelected : ''}`} onClick={() => toggleItem({ emoji, label: lbl })}>
                            <span className={styles.emojiGlyph}>{emoji}</span>
                            <span className={styles.emojiLabel}>{lbl}</span>
                          </button>
                        ))}
                      </div>
                      <div className={styles.seedRow}>
                        <input className={styles.seedInput} type="text" placeholder='Optional: 3-word seed e.g. "Why did the"' value={seed}
                          onChange={e => {
                            const words = e.target.value.trim().split(/\s+/)
                            if (words.length <= 3) setSeed(e.target.value)
                            else setSeed(words.slice(0, 3).join(' '))
                          }} maxLength={40} />
                      </div>
                    </div>
                  )}

                  {tab === 'vocab' && (
                    <div className={styles.tabPanel}>
                      <div className={styles.vocabAddRow}>
                        <input className={styles.vocabAddInput} type="text" placeholder="Add a word..." value={newWord}
                          onChange={e => { setNewWord(e.target.value); setWordMsg(null) }}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && newWord.trim()) {
                              const status = addWord(newWord)
                              if (status === 'exists') setWordMsg('exists')
                              else { setNewWord(''); setWordMsg(null) }
                            }
                          }} maxLength={30} />
                        <button className={styles.vocabAddBtn} onClick={() => {
                          if (!newWord.trim()) return
                          const status = addWord(newWord)
                          if (status === 'exists') setWordMsg('exists')
                          else { setNewWord(''); setWordMsg(null) }
                        }}>+ Add</button>
                        <button className={styles.vocabResetBtn} onClick={resetVocab}>Reset</button>
                      </div>
                      {wordMsg === 'exists' && <p className={styles.vocabExists}>"{newWord}" already in vocab</p>}
                      <p className={styles.vocabHint}>Click a word to remove it.</p>
                      <div className={styles.vocabChips}>
                        {vocab.map(word => (
                          <button key={word} className={styles.vocabChip} onClick={() => removeWord(word)} title="Click to remove">{word} ×</button>
                        ))}
                      </div>
                    </div>
                  )}

                  <button className={styles.startBtn} onClick={startWriting} >
                    Let Jev Write →
                  </button>
                </>
              )}
            </>
          )}

          <Link to="/" className={styles.backLink}>← Back to OneSearch</Link>
        </div>
      )}

      {/* ── Writing ── */}
      {phase === 'writing' && (
        <div className={styles.writingScreen}>
          <div className={styles.writingHeader}>
            <div className={styles.envEmojis}>
              {picked.map(p => <span key={p.emoji} title={p.label}>{p.emoji}</span>)}
              <span className={styles.envLabels}>{picked.map(p => p.label).join(' · ')}</span>
            </div>
            <div className={styles.charCounter}>{charCount} words</div>
          </div>
          <div className={styles.jokeBox}>
            <span className={styles.jokeText}>{joke}</span>
            <span className={isThinking ? styles.cursorThinking : styles.cursor}>▋</span>
          </div>
          <div className={styles.writingFooter}>
            <p className={styles.jevStatusText}>{isThinking ? '⚡ Jev is thinking...' : '⚡ Jev is writing...'}</p>
            <button className={styles.stopBtn} onClick={stopWriting}>End it →</button>
          </div>
        </div>
      )}

      {/* ── Done: joke + wheel + results ── */}
      {phase === 'done' && (
        <div className={styles.wheelScreen}>
          <div className={styles.jevBadge}>⚡ Jev</div>

          {/* Always show the joke */}
          <div className={styles.jokeBox} style={{ width: '100%', marginBottom: '0.25rem' }}>
            <span className={styles.jokeText}>{joke}</span>
          </div>

          <p className={styles.spinTitle}>Score 10 and win a phone 📱</p>
          <SpinWheel score={funnyScore} onDone={handleSpinDone} />

          {showResults && (
            <>
              <div className={styles.finalScore} style={{ color: label.color }}>
                {funnyScore}/10 — {label.text}
              </div>
              <p className={styles.doneNote}>
                {funnyScore >= 7 ? 'Jev is quietly proud. It will not say so.'
                  : funnyScore >= 4 ? 'Jev chose to stop. This was mercy.'
                  : 'Jev has reviewed its own work. Jev is not okay.'}
              </p>

              {/* Winner email capture */}
              {isWinner && !emailSubmitted && (
                <div className={styles.winnerBox}>
                  <p className={styles.winnerTitle}>🎉 Score 10! You've won a phone!</p>
                  <p className={styles.winnerSub}>Leave your email and we'll contact you.</p>
                  <div className={styles.winnerEmailRow}>
                    <input
                      className={styles.winnerEmailInput}
                      type="email"
                      placeholder="your@email.com"
                      value={winEmail}
                      onChange={e => setWinEmail(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleEmailSubmit() }}
                    />
                    <button className={styles.winnerEmailBtn} onClick={handleEmailSubmit}>Submit</button>
                  </div>
                </div>
              )}
              {isWinner && emailSubmitted && (
                <div className={styles.winnerBox}>
                  <p className={styles.winnerTitle}>🎉 We've got your email!</p>
                  <p className={styles.winnerSub}>We'll be in touch soon.</p>
                </div>
              )}

              <div className={styles.actions}>
                <button className={styles.shareBtn} onClick={() => {
                  navigator.clipboard.writeText(`Jev wrote a joke (${funnyScore}/10):\n\n"${joke}"\n\nEnvironment: ${pickedEmojis.join(' ')}\n\n⚡ typesafe.ai`).catch(() => {})
                }}>Copy Joke 📋</button>
                <button className={styles.restartBtn} onClick={restart}>Try Again 🔄</button>
              </div>
              {!unlimited && playsUsed >= maxPlays && (
                <p className={styles.playCounterOut}>That was your last play. No more Jev for you.</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
