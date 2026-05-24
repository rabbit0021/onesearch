import { useEffect, useRef, useState, useCallback } from 'react'

export const voiceCommandsSupported =
  typeof window !== 'undefined' &&
  !!(window.SpeechRecognition || window.webkitSpeechRecognition)

export function useVoiceCommands({ ttsState, onQuestion }) {
  const [lastCommand]              = useState(null)
  const [listening, setListening]  = useState(false)

  const recognitionRef  = useRef(null)
  const restartTimerRef = useRef(null)
  const shouldListenRef = useRef(false)
  const genRef          = useRef(0)  // incremented on every stop — stale onend callbacks check this
  const onQuestionRef   = useRef(onQuestion)

  useEffect(() => { onQuestionRef.current = onQuestion }, [onQuestion])

  const handleTranscript = useCallback((transcript) => {
    const text = transcript.trim()
    if (!text) return
    console.log('[VoiceCmd] heard:', JSON.stringify(text))
    onQuestionRef.current?.(text)
  }, [])

  function stopRecognition() {
    genRef.current++                          // invalidate any pending restart
    clearTimeout(restartTimerRef.current)
    if (recognitionRef.current) {
      try { recognitionRef.current.abort() } catch (_) {}
      recognitionRef.current = null
    }
    setListening(false)
  }

  function startRecognition() {
    if (recognitionRef.current) return
    if (document.visibilityState !== 'visible') return  // don't fight other tabs
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return

    const myGen = genRef.current              // capture generation at start time

    const r = new SR()
    r.continuous     = true
    r.interimResults = false
    r.lang           = 'en-US'

    r.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) handleTranscript(e.results[i][0].transcript)
      }
    }

    r.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return
      console.warn('[VoiceCmd] recognition error:', e.error)
      recognitionRef.current = null
      setListening(false)
    }

    r.onend = () => {
      recognitionRef.current = null
      setListening(false)
      // Only restart if this session is still current, tab is visible, and we should be listening
      if (shouldListenRef.current && genRef.current === myGen && document.visibilityState === 'visible') {
        restartTimerRef.current = setTimeout(startRecognition, 300)
      }
    }

    recognitionRef.current = r
    try {
      r.start()
      setListening(true)
      console.log('[VoiceCmd] recognition started')
    } catch (e) {
      console.warn('[VoiceCmd] start failed:', e)
      recognitionRef.current = null
    }
  }

  // Start/stop based on TTS state
  useEffect(() => {
    const active = ttsState === 'idle' || ttsState === 'paused'
    shouldListenRef.current = active
    if (active) {
      startRecognition()
    } else {
      stopRecognition()
    }
    return stopRecognition
  }, [ttsState])

  // Pause recognition when tab is hidden, resume when visible again
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        if (shouldListenRef.current) startRecognition()
      } else {
        // Stop without changing shouldListenRef so it restarts on focus
        clearTimeout(restartTimerRef.current)
        genRef.current++
        if (recognitionRef.current) {
          try { recognitionRef.current.abort() } catch (_) {}
          recognitionRef.current = null
        }
        setListening(false)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  return { lastCommand, listening }
}
