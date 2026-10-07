import { useState, useCallback, useRef, useEffect } from 'react'
import { checkJevAvailability, fetchNextChar, fetchFunnyScore, recordGame } from './gameApi'
import { DEFAULT_VOCAB } from './vocab'

const MAX_PICKS = 7
const MAX_PLAYS = 5
const UNLIMITED = import.meta.env.VITE_UNLIMITED_PLAYS === 'true'
const EOT = '<EOT>'
const DEVICE_KEY = 'jev_device_id'
const PLAYS_KEY = 'jev_plays_used'
const VOCAB_KEY = 'jev_vocab'

function getDeviceId() {
  let id = localStorage.getItem(DEVICE_KEY)
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now().toString(36)
    localStorage.setItem(DEVICE_KEY, id)
  }
  return id
}

function loadVocab() {
  try {
    const saved = localStorage.getItem(VOCAB_KEY)
    if (saved) return JSON.parse(saved)
  } catch {}
  return null
}

function saveVocab(vocab) {
  localStorage.setItem(VOCAB_KEY, JSON.stringify(vocab))
}

function getPlaysUsed() {
  return parseInt(localStorage.getItem(PLAYS_KEY) || '0', 10)
}

function incrementPlays() {
  const next = getPlaysUsed() + 1
  localStorage.setItem(PLAYS_KEY, String(next))
  return next
}

export function useGameEngine() {
  const [jevStatus, setJevStatus]   = useState('checking')
  const [phase, setPhase]           = useState('idle')  // idle | writing | done
  const [picked, setPicked]         = useState([])      // [{emoji, label}]
  const [seed, setSeed]             = useState('')
  const [joke, setJoke]             = useState('')
  const [funnyScore, setFunnyScore] = useState(5)
  const [isThinking, setIsThinking] = useState(false)
  const [charCount, setCharCount]   = useState(0)
  const [vocab, setVocab]           = useState(() => loadVocab() ?? [...DEFAULT_VOCAB])
  const [playsUsed, setPlaysUsed]   = useState(getPlaysUsed)

  const jokeRef    = useRef('')
  const scoreRef   = useRef(5)
  const labelsRef  = useRef([])
  const vocabRef   = useRef(vocab)
  const runningRef = useRef(false)

  useEffect(() => {
    vocabRef.current = vocab
    saveVocab(vocab)
  }, [vocab])

  useEffect(() => {
    getDeviceId() // ensure device ID exists
    checkJevAvailability().then(ok => setJevStatus(ok ? 'ok' : 'unavailable'))
  }, [])

  const toggleItem = useCallback(({ emoji, label }) => {
    setPicked(prev => {
      const exists = prev.find(p => p.emoji === emoji)
      if (exists) return prev.filter(p => p.emoji !== emoji)
      if (prev.length >= MAX_PICKS) return prev
      return [...prev, { emoji, label }]
    })
  }, [])

  const MAX_VOCAB = 254  // Jev hard cap (STOP takes the 255th slot)

  // Returns 'added' | 'exists'
  const addWord = useCallback((word) => {
    const w = word.trim().toLowerCase()
    if (!w) return 'added'
    let status = 'added'
    setVocab(prev => {
      if (prev.includes(w)) { status = 'exists'; return prev }
      const next = [...prev, w]
      return next.length > MAX_VOCAB ? next.slice(next.length - MAX_VOCAB) : next
    })
    return status
  }, [])

  const removeWord = useCallback((word) => {
    setVocab(prev => prev.filter(w => w !== word))
  }, [])

  const resetVocab = useCallback(() => {
    const v = [...DEFAULT_VOCAB]
    setVocab(v)
    saveVocab(v)
  }, [])

  const startWriting = useCallback(() => {
    if (!UNLIMITED && playsUsed >= MAX_PLAYS) return
    const initial = seed.trim()
    jokeRef.current = initial
    scoreRef.current = 5
    labelsRef.current = picked.map(p => p.label)
    runningRef.current = true
    setJoke(initial)
    setFunnyScore(5)
    setCharCount(initial.length)
    setPhase('writing')
  }, [picked, seed, playsUsed])

  // Main loop — word by word
  useEffect(() => {
    if (phase !== 'writing') return
    runningRef.current = true

    const plays = incrementPlays()
    setPlaysUsed(plays)

    function maybeRecord(score) {
      // Always log — email added later by UI if winner
      recordGame(getDeviceId(), jokeRef.current, score, labelsRef.current)
    }

    async function loop() {
      while (runningRef.current) {
        setIsThinking(true)

        const char = await fetchNextChar(labelsRef.current, jokeRef.current, scoreRef.current, vocabRef.current)
        if (!runningRef.current) break

        if (char === EOT || char.includes('EOT')) {
          setIsThinking(false)
          runningRef.current = false
          maybeRecord(scoreRef.current)
          setPhase('done')
          break
        }

        jokeRef.current = jokeRef.current + char
        setJoke(jokeRef.current)
        setCharCount(c => c + 1)

        const score = await fetchFunnyScore(labelsRef.current, jokeRef.current)
        if (!runningRef.current) break
        scoreRef.current = score
        setFunnyScore(score)
        setIsThinking(false)

        if (jokeRef.current.trim().split(/\s+/).length >= 25) {
          runningRef.current = false
          maybeRecord(scoreRef.current)
          setPhase('done')
          break
        }
      }
    }

    loop()
    return () => { runningRef.current = false }
  }, [phase])

  const stopWriting = useCallback(() => {
    runningRef.current = false
    setIsThinking(false)
    recordGame(getDeviceId(), jokeRef.current, scoreRef.current, labelsRef.current)
    setPhase('done')
  }, [])

  const restart = useCallback(() => {
    runningRef.current = false
    setPicked([])
    setSeed('')
    setJoke('')
    setFunnyScore(5)
    setCharCount(0)
    setIsThinking(false)
    setPhase('idle')
  }, [])

  return {
    jevStatus, phase,
    picked, toggleItem,
    seed, setSeed,
    joke, funnyScore, isThinking, charCount,
    startWriting, stopWriting, restart,
    maxPicks: MAX_PICKS,
    vocab, addWord, removeWord, resetVocab,
    playsUsed, maxPlays: MAX_PLAYS,
  }
}
