import { useState, useEffect, useRef } from 'react'

// ── Constants ────────────────────────────────────────────────────────────────

const LINE_OFFSET = 48 // px — spoken word kept this far below container top

const PREFERRED_VOICES = [
  'Samantha', 'Karen', 'Moira', 'Tessa', 'Fiona', 'Ava',
  'Microsoft Jenny Online (Natural)', 'Microsoft Aria Online (Natural)',
  'Google US English', 'Google UK English Female',
]
const CHARS_PER_SEC = 16.5 // Web Speech fallback: ~180 wpm × 5.5 chars ÷ 60

// ── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useArticleReader
 *
 * Drives TTS reading for a rendered article.
 * - If `postId` is provided: uses Google Cloud TTS (high-quality Neural2 voice,
 *   accurate word timings, works on all browsers including Android).
 * - Fallback: Web Speech API (free, client-side, lower quality).
 *
 * @param {object}          opts
 * @param {React.RefObject} opts.contentRef         - ref to article content DOM element
 * @param {React.RefObject} opts.scrollContainerRef - ref to scrollable wrapper
 * @param {string}          opts.highlightClass     - CSS class for <mark> fallback highlight
 * @param {number|null}     opts.postId             - post ID for Google TTS (optional)
 *
 * @returns {{ state: string, play, pause, resume, stop }}
 *   state: 'idle' | 'loading' | 'playing' | 'paused'
 */
export function useArticleReader({ contentRef, scrollContainerRef, highlightClass, postId }) {
  const [state, setState]   = useState('idle')
  const stateRef            = useRef('idle')
  const textNodesRef        = useRef([])
  const markRef             = useRef(null)
  const wakeLockRef         = useRef(null)
  // Web Speech refs
  const fallbackRef         = useRef(null)
  const keepAliveRef        = useRef(null)
  // Google TTS refs
  const audioRef            = useRef(null)
  const timingIntervalRef   = useRef(null)
  const wordTimingsRef      = useRef([])   // [{ wordIndex, word, time }]
  const wordCharMapRef      = useRef([])   // wordCharMap[wordIndex] = charStart in fullText
  const fullTextRef         = useRef('')

  const useCssHighlights = typeof CSS !== 'undefined' && !!CSS.highlights

  function setSt(s) { stateRef.current = s; setState(s) }

  // ── Wake Lock ──────────────────────────────────────────────────────────────

  async function acquireWakeLock() {
    try {
      if ('wakeLock' in navigator && document.visibilityState === 'visible')
        wakeLockRef.current = await navigator.wakeLock.request('screen')
    } catch (_) {}
  }
  function releaseWakeLock() {
    wakeLockRef.current?.release().catch(() => {})
    wakeLockRef.current = null
  }
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === 'visible' && stateRef.current === 'playing')
        acquireWakeLock()
    }
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }, [])

  // ── Timer helpers ──────────────────────────────────────────────────────────

  function clearFallback() {
    if (fallbackRef.current) { clearInterval(fallbackRef.current); fallbackRef.current = null }
  }
  function clearKeepAlive() {
    if (keepAliveRef.current) { clearInterval(keepAliveRef.current); keepAliveRef.current = null }
  }
  function clearTimingInterval() {
    if (timingIntervalRef.current) { clearInterval(timingIntervalRef.current); timingIntervalRef.current = null }
  }
  function startKeepAlive() {
    keepAliveRef.current = setInterval(() => {
      if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
        window.speechSynthesis.pause(); window.speechSynthesis.resume()
      }
    }, 10000)
  }

  // ── Unmount cleanup ────────────────────────────────────────────────────────

  useEffect(() => () => {
    window.speechSynthesis?.cancel()
    clearFallback(); clearKeepAlive(); clearTimingInterval(); releaseWakeLock()
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
  }, [])

  // ── Text node map ──────────────────────────────────────────────────────────

  function buildTextNodeMap() {
    if (!contentRef.current) return []
    const walker = document.createTreeWalker(contentRef.current, NodeFilter.SHOW_TEXT)
    const nodes = []
    let pos = 0, node
    while ((node = walker.nextNode())) {
      const len = node.textContent.length
      nodes.push({ node, start: pos, end: pos + len })
      pos += len
    }
    return nodes
  }

  // ── Highlight ──────────────────────────────────────────────────────────────

  function clearHighlight() {
    if (useCssHighlights) { CSS.highlights.delete('tts-word'); return }
    const mark = markRef.current
    if (!mark?.parentNode) { markRef.current = null; return }
    const parent = mark.parentNode
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark)
    parent.removeChild(mark)
    parent.normalize()
    markRef.current = null
    textNodesRef.current = buildTextNodeMap()
  }

  function applyHighlight(target, offsetInNode, wordLen) {
    if (!target) return
    try {
      const range = document.createRange()
      range.setStart(target, offsetInNode)
      range.setEnd(target, Math.min(offsetInNode + wordLen, target.textContent.length))
      if (useCssHighlights) {
        CSS.highlights.set('tts-word', new Highlight(range))
      } else {
        const mark = document.createElement('mark')
        mark.className = highlightClass
        range.surroundContents(mark)
        markRef.current = mark
      }
    } catch (_) {}
  }

  // ── Shared: find node + highlight + scroll for a char position ────────────

  function highlightAndScrollToChar(absPos, wordLen) {
    const el = scrollContainerRef.current
    clearHighlight()
    let target = null, offsetInNode = 0
    for (const { node, start, end } of textNodesRef.current) {
      if (absPos >= start && absPos < end) { target = node; offsetInNode = absPos - start; break }
    }
    applyHighlight(target, offsetInNode, wordLen || 1)
    if (target && el) {
      try {
        const range = document.createRange()
        range.setStart(target, offsetInNode)
        range.setEnd(target, Math.min(offsetInNode + (wordLen || 1), target.textContent.length))
        const wordRect      = range.getBoundingClientRect()
        const containerRect = el.getBoundingClientRect()
        const targetTop     = el.scrollTop + (wordRect.top - containerRect.top) - LINE_OFFSET
        el.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' })
      } catch (_) {}
    }
  }

  // ── Word char map (for Google TTS path) ───────────────────────────────────
  // Maps wordIndex → charStart in fullText by sequentially matching word text.

  function buildWordCharMap(fullText, timings) {
    const map = []
    let searchFrom = 0
    for (const { word } of timings) {
      const idx = fullText.indexOf(word, searchFrom)
      if (idx === -1) {
        map.push(searchFrom)
      } else {
        map.push(idx)
        searchFrom = idx + word.length
      }
    }
    return map
  }

  // ── Start char detection (shared) ─────────────────────────────────────────

  function getStartChar(nodes) {
    const el = scrollContainerRef.current
    if (!el) return 0
    const containerTop = el.getBoundingClientRect().top + LINE_OFFSET
    for (const { node, start } of nodes) {
      try {
        const range = document.createRange()
        range.selectNodeContents(node)
        const rect = range.getBoundingClientRect()
        if (rect.bottom <= containerTop) continue
        if (rect.top < containerTop) {
          const ratio = (containerTop - rect.top) / (rect.bottom - rect.top)
          return start + Math.round(ratio * node.textContent.length)
        }
        return start
      } catch (_) { continue }
    }
    return 0
  }

  // ── Voice selection (Web Speech) ──────────────────────────────────────────

  function getBestVoice() {
    const voices = window.speechSynthesis.getVoices()
    for (const name of PREFERRED_VOICES) {
      const v = voices.find(v => v.name === name)
      if (v) return v
    }
    return voices.find(v => v.lang?.startsWith('en')) || voices[0] || null
  }

  // ── Google TTS path ───────────────────────────────────────────────────────

  async function playGoogleTts() {
    setSt('loading')
    let audioUrl, timings
    try {
      const res  = await fetch(`/api/tts/${postId}`, { method: 'POST' })
      if (!res.ok) throw new Error(`TTS API error ${res.status}`)
      const data = await res.json()
      audioUrl   = data.audioUrl
      timings    = data.timings
    } catch (err) {
      console.warn('Google TTS failed, falling back to Web Speech:', err)
      setSt('idle')
      playWebSpeech()
      return
    }

    const nodes    = buildTextNodeMap()
    textNodesRef.current = nodes
    const fullText = contentRef.current?.textContent || ''
    fullTextRef.current  = fullText
    wordTimingsRef.current  = timings
    wordCharMapRef.current  = buildWordCharMap(fullText, timings)

    const audio = new Audio(audioUrl)
    audioRef.current = audio

    // Find the timing index for the start char
    const startChar  = getStartChar(nodes)
    const startTiming = timings.findIndex(t => (wordCharMapRef.current[t.wordIndex] ?? 0) >= startChar)
    const startTime   = startTiming > 0 ? timings[startTiming].time : 0
    audio.currentTime = startTime

    let lastWordIdx = -1
    timingIntervalRef.current = setInterval(() => {
      const ct      = audio.currentTime
      // Find last timing whose time <= ct
      const tArr    = wordTimingsRef.current
      let lo = 0, hi = tArr.length - 1, found = -1
      while (lo <= hi) {
        const mid = (lo + hi) >> 1
        if (tArr[mid].time <= ct) { found = mid; lo = mid + 1 } else hi = mid - 1
      }
      if (found < 0 || tArr[found].wordIndex === lastWordIdx) return
      lastWordIdx = tArr[found].wordIndex
      const charPos = wordCharMapRef.current[lastWordIdx] ?? 0
      highlightAndScrollToChar(charPos, tArr[found].word?.length || 1)
    }, 80)

    const cleanup = () => {
      clearTimingInterval(); releaseWakeLock(); clearHighlight()
      audioRef.current = null
    }
    audio.addEventListener('ended',  () => { cleanup(); setSt('idle') })
    audio.addEventListener('error',  () => { cleanup(); setSt('idle') })
    audio.play()
    acquireWakeLock()
    setSt('playing')
  }

  // ── Web Speech path ───────────────────────────────────────────────────────

  function playWebSpeech() {
    if (!contentRef.current) return
    window.speechSynthesis.cancel()
    clearHighlight()
    const el       = scrollContainerRef.current
    const fullText = contentRef.current.textContent || ''
    const nodes    = buildTextNodeMap()
    textNodesRef.current = nodes
    const startChar  = getStartChar(nodes)
    const spokenText = fullText.substring(startChar)

    const utterance  = new SpeechSynthesisUtterance(spokenText)
    utterance.rate   = 1
    utterance.pitch  = 1
    utterance.volume = 1
    const voice = getBestVoice()
    if (voice) utterance.voice = voice

    let boundaryFired = false
    const speakStart  = Date.now()

    utterance.onboundary = (e) => {
      if (!boundaryFired) boundaryFired = true
      if (e.name !== 'word') return
      const absPos  = startChar + e.charIndex
      const wordLen = e.charLength || 1
      highlightAndScrollToChar(absPos, wordLen)
    }

    const fallbackDelay = setTimeout(() => {
      if (boundaryFired) return
      fallbackRef.current = setInterval(() => {
        const elapsed   = (Date.now() - speakStart) / 1000
        const estimated = startChar + Math.min(Math.round(elapsed * CHARS_PER_SEC), spokenText.length)
        if (el) {
          const ratio = estimated / fullText.length
          const max   = el.scrollHeight - el.clientHeight
          el.scrollTo({ top: Math.max(0, Math.round(ratio * max) - LINE_OFFSET), behavior: 'smooth' })
        }
        if (estimated >= startChar + spokenText.length) clearFallback()
      }, 800)
    }, 1500)

    startKeepAlive()

    const cleanup = () => {
      clearTimeout(fallbackDelay); clearFallback(); clearKeepAlive()
      releaseWakeLock(); clearHighlight()
    }
    utterance.onend   = () => { cleanup(); setSt('idle') }
    utterance.onerror = () => { cleanup(); setSt('idle') }

    window.speechSynthesis.speak(utterance)
    acquireWakeLock()
    setSt('playing')
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  function play() {
    if (!contentRef.current) return
    if (postId) {
      playGoogleTts()
    } else {
      playWebSpeech()
    }
  }

  function pause() {
    if (audioRef.current) {
      audioRef.current.pause()
      clearTimingInterval()
    } else {
      window.speechSynthesis.pause()
      clearKeepAlive()
    }
    setSt('paused')
  }

  function resume() {
    if (audioRef.current) {
      // Restart timing interval for Google TTS
      const audio = audioRef.current
      let lastWordIdx = -1
      timingIntervalRef.current = setInterval(() => {
        const ct   = audio.currentTime
        const tArr = wordTimingsRef.current
        let lo = 0, hi = tArr.length - 1, found = -1
        while (lo <= hi) {
          const mid = (lo + hi) >> 1
          if (tArr[mid].time <= ct) { found = mid; lo = mid + 1 } else hi = mid - 1
        }
        if (found < 0 || tArr[found].wordIndex === lastWordIdx) return
        lastWordIdx = tArr[found].wordIndex
        const charPos = wordCharMapRef.current[lastWordIdx] ?? 0
        highlightAndScrollToChar(charPos, tArr[found].word?.length || 1)
      }, 80)
      audio.play()
    } else {
      window.speechSynthesis.resume()
      startKeepAlive()
    }
    setSt('playing')
  }

  function stop() {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    } else {
      window.speechSynthesis.cancel()
      clearFallback(); clearKeepAlive()
    }
    clearTimingInterval(); releaseWakeLock(); clearHighlight()
    setSt('idle')
  }

  return { state, play, pause, resume, stop }
}
