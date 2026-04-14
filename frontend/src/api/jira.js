export async function getJiraStatus() {
  const res = await fetch('/auth/jira/status')
  return res.json()
}

export async function getJiraIssues() {
  const res = await fetch('/auth/jira/issues')
  if (!res.ok) throw new Error('Failed to fetch issues')
  return res.json()
}

export async function disconnectJira() {
  await fetch('/auth/jira/logout', { method: 'POST' })
}
