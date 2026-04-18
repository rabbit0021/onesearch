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

export async function getFeed(limit = 30) {
  const res = await fetch(`/feed?limit=${limit}`)
  if (!res.ok){
    console.error('Failed to fetch feed:', res.status, await res.text());
    throw new Error('Failed to fetch feed');
  } 
  return res.json()
}

export async function getPosts(secretKey) {
  const res = await fetch('/posts', {
    headers: { 'X-SECRET-KEY': secretKey },
  })
  if (res.status === 401) throw new Error('Unauthorized')
  return res.json()
}

export async function getSuggestedFeed(issues, limit = 100) {
  const res = await fetch(`/feed/suggested?limit=${limit}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ issues }),
  })
  if (!res.ok) throw new Error('Failed to fetch suggested feed')
  return res.json()
}

export async function likePost(id) {
  const res = await fetch(`/posts/${id}/like`, { method: 'POST' })
  if (!res.ok) throw new Error('Failed to like post')
  return res.json()
}

export async function getMostLikedFeed(limit = 50) {
  const res = await fetch(`/feed/most-liked?limit=${limit}`)
  if (!res.ok) throw new Error('Failed to fetch most liked feed')
  return res.json()
}

export async function getPendingNotifications(secretKey) {
  const res = await fetch('/admin/notifications/pending', {
    headers: { 'X-SECRET-KEY': secretKey },
  })
  if (res.status === 401) throw new Error('Unauthorized')
  return res.json()
}

export async function startJob(job, secretKey, email = null) {
  const res = await fetch(`/admin/jobs/${job}/run`, {
    method: 'POST',
    headers: { 'X-SECRET-KEY': secretKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(email ? { email } : {}),
  })
  return res.json()
}

export async function cancelJob(jobId, secretKey) {
  const res = await fetch(`/admin/jobs/${jobId}/cancel`, {
    method: 'POST',
    headers: { 'X-SECRET-KEY': secretKey },
  })
  return res.json()
}

export async function getJob(jobId, secretKey) {
  const res = await fetch(`/admin/jobs/${jobId}`, {
    headers: { 'X-SECRET-KEY': secretKey },
  })
  return res.json()
}

export async function getJobHistory(jobName, secretKey) {
  const res = await fetch(`/admin/jobs/history/${jobName}`, {
    headers: { 'X-SECRET-KEY': secretKey },
  })
  return res.json()
}

export async function getAdminSubscriptions(secretKey) {
  const res = await fetch('/subscriptions', {
    headers: { 'X-SECRET-KEY': secretKey },
  })
  if (res.status === 401) throw new Error('Unauthorized')
  return res.json()
}

export async function getPublishers(secretKey) {
  const res = await fetch('/publishers', {
    headers: { 'X-SECRET-KEY': secretKey },
  })
  if (res.status === 401) throw new Error('Unauthorized')
  return res.json()
}

export async function addPublisher(name, type, secretKey) {
  const res = await fetch('/publishers', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-SECRET-KEY': secretKey,
    },
    body: JSON.stringify({ publisher_name: name, publisher_type: type }),
  })
  return res.json()
}

export async function updatePost(id, topic, tags, secretKey) {
  const res = await fetch(`/posts/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'X-SECRET-KEY': secretKey,
    },
    body: JSON.stringify({ topic, tags }),
  })
  return res.json()
}
