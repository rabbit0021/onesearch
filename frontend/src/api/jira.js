const ATLASSIAN_API_BASE = 'https://api.atlassian.com/ex/jira'

export async function getJiraStatus() {
  const res = await fetch('/auth/jira/status')
  return res.json()
}

export async function getJiraIssues() {
  const tokenRes = await fetch('/auth/jira/token')
  if (!tokenRes.ok) throw new Error('Not authenticated with Jira')
  const { access_token, cloud_id } = await tokenRes.json()

  const res = await fetch(
    `${ATLASSIAN_API_BASE}/${cloud_id}/rest/api/3/search/jql?` +
    new URLSearchParams({
      fields: 'summary,status,priority',
      maxResults: 50,
      jql: 'assignee = currentUser() ORDER BY updated DESC',
    }),
    { headers: { Authorization: `Bearer ${access_token}`, Accept: 'application/json' } }
  )

  if (res.status === 401) throw new Error('Jira session expired, please reconnect')
  if (!res.ok) throw new Error('Failed to fetch issues')

  const data = await res.json()
  const issues = data.issues.map(issue => ({
    key: issue.key,
    summary: issue.fields.summary,
    status: issue.fields.status.name,
    priority: issue.fields.priority?.name ?? null,
  }))

  return { issues }
}

export async function disconnectJira() {
  await fetch('/auth/jira/logout', { method: 'POST' })
}
