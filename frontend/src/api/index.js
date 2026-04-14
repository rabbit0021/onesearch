/**
 * API service layer — all fetch calls go through here.
 * To change an endpoint or add auth headers globally, edit this file.
 */

export async function getTechTeams(search = '') {
  const res = await fetch(`/techteams?search=${encodeURIComponent(search)}`)
  if (!res.ok) throw new Error('Failed to fetch tech teams')
  return res.json()
}

export async function getSubscriptionsForEmail(email) {
  const res = await fetch(`/subscriptions_for_email?email=${encodeURIComponent(email)}`)
  if (!res.ok) throw new Error('Failed to fetch subscriptions')
  return res.json()
}

/**
 * @param {{ email: string, techteams: string[], topic: string, frequency: number }} params
 */
export async function subscribe({ email, techteams, topic, frequency }) {
  const body = new URLSearchParams()
  body.set('email', email)
  body.set('topic', topic)
  body.set('techteams', techteams.join(','))
  body.set('frquency', String(frequency)) // note: typo preserved to match Flask backend
  const res = await fetch('/subscribe', { method: 'POST', body })
  return res.json()
}

export async function postInterested() {
  const res = await fetch('/interested', { method: 'POST' })
  return res.json()
}

export async function postFeedback(feedback) {
  const res = await fetch('/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ feedback }),
  })
  return res.json()
}

export async function getPosts(secretKey) {
  const res = await fetch('/posts', {
    headers: { 'X-SECRET-KEY': secretKey },
  })
  if (res.status === 401) throw new Error('Unauthorized')
  return res.json()
}

export async function updatePost(id, topic, secretKey) {
  const res = await fetch(`/posts/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'X-SECRET-KEY': secretKey,
    },
    body: JSON.stringify({ topic }),
  })
  return res.json()
}
