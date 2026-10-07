export async function checkJevAvailability() {
  try {
    const res = await fetch('/api/game/health', { method: 'GET' })
    if (!res.ok) return false
    const data = await res.json()
    return data.available === true
  } catch {
    return false
  }
}

export async function fetchNextChar(envLabels, jokeSoFar, funnyScore, vocab) {
  try {
    const res = await fetch('/api/game/nextchar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ env_labels: envLabels, joke_so_far: jokeSoFar, funny_score: funnyScore, vocab }),
    })
    if (!res.ok) throw new Error()
    const data = await res.json()
    return data.char || 'a'
  } catch {
    const pool = 'abcdefghijklmnopqrstuvwxyz      .,!?'
    return pool[Math.floor(Math.random() * pool.length)]
  }
}

export async function submitWinnerEmail(deviceId, email) {
  try {
    await fetch('/api/game/winner-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_id: deviceId, email }),
    })
  } catch {}
}

export async function recordGame(deviceId, joke, score, envLabels, email = null) {
  try {
    await fetch('/api/game/record', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_id: deviceId, joke, score, env_labels: envLabels, email }),
    })
  } catch {}
}

export async function fetchFunnyScore(envLabels, jokeSoFar) {
  try {
    const res = await fetch('/api/game/funnyscore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ env_labels: envLabels, joke_so_far: jokeSoFar }),
    })
    if (!res.ok) throw new Error()
    const data = await res.json()
    return typeof data.score === 'number' ? data.score : 5
  } catch {
    return Math.floor(Math.random() * 5) + 2
  }
}
