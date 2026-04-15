import os
import secrets
import requests
from flask import Blueprint, redirect, request, session, jsonify

jira_bp = Blueprint('jira', __name__, url_prefix='/auth/jira')

ATLASSIAN_AUTH_URL = 'https://auth.atlassian.com/authorize'
ATLASSIAN_TOKEN_URL = 'https://auth.atlassian.com/oauth/token'
ATLASSIAN_RESOURCES_URL = 'https://api.atlassian.com/oauth/token/accessible-resources'
ATLASSIAN_API_BASE = 'https://api.atlassian.com/ex/jira'

JIRA_CLIENT_ID = os.environ.get('JIRA_CLIENT_ID')
JIRA_CLIENT_SECRET = os.environ.get('JIRA_CLIENT_SECRET')
JIRA_REDIRECT_URI = os.environ.get('JIRA_REDIRECT_URI', 'http://localhost:5000/auth/jira/callback')
FRONTEND_URL = os.environ.get('FRONTEND_URL', 'http://localhost:5173')
JIRA_SCOPES = 'read:jira-work read:me offline_access'


@jira_bp.route('/login')
def login():
    state = secrets.token_urlsafe(16)
    session['jira_oauth_state'] = state
    params = {
        'audience': 'api.atlassian.com',
        'client_id': JIRA_CLIENT_ID,
        'scope': JIRA_SCOPES,
        'redirect_uri': JIRA_REDIRECT_URI,
        'state': state,
        'response_type': 'code',
        'prompt': 'consent',
    }
    query = '&'.join(f'{k}={v}' for k, v in params.items())
    return redirect(f'{ATLASSIAN_AUTH_URL}?{query}')


@jira_bp.route('/callback')
def callback():
    code = request.args.get('code')
    state = request.args.get('state')
    error = request.args.get('error')

    if error or not code:
        print(f'[Jira OAuth] Error from Atlassian: {error} — {request.args.get("error_description")}')
        return redirect(f'{FRONTEND_URL}/?jira=error')

    if state != session.pop('jira_oauth_state', None):
        print('[Jira OAuth] State mismatch')
        return redirect(f'{FRONTEND_URL}/?jira=error')

    # Exchange code for access token
    token_res = requests.post(ATLASSIAN_TOKEN_URL, json={
        'grant_type': 'authorization_code',
        'client_id': JIRA_CLIENT_ID,
        'client_secret': JIRA_CLIENT_SECRET,
        'code': code,
        'redirect_uri': JIRA_REDIRECT_URI,
    })
    tokens = token_res.json()
    access_token = tokens.get('access_token')

    if not access_token:
        print(f'[Jira OAuth] Token exchange failed: {tokens}')
        return redirect(f'{FRONTEND_URL}/?jira=error')

    # Get the user's accessible Jira cloud sites
    resources_res = requests.get(
        ATLASSIAN_RESOURCES_URL,
        headers={'Authorization': f'Bearer {access_token}', 'Accept': 'application/json'},
    )
    resources = resources_res.json()

    session['jira_access_token'] = access_token
    session['jira_cloud_id'] = resources[0]['id'] if resources else None
    session['jira_site_name'] = resources[0]['name'] if resources else None

    # Fetch Atlassian account ID for use as a stable user identifier (e.g. likes)
    me_res = requests.get(
        'https://api.atlassian.com/me',
        headers={'Authorization': f'Bearer {access_token}', 'Accept': 'application/json'},
    )
    if me_res.ok:
        session['jira_account_id'] = me_res.json().get('account_id')

    return redirect(f'{FRONTEND_URL}/?jira=connected')


@jira_bp.route('/status')
def status():
    connected = bool(session.get('jira_access_token'))
    return jsonify({
        'connected': connected,
        'site': session.get('jira_site_name') if connected else None,
    })


@jira_bp.route('/issues')
def get_issues():
    token = session.get('jira_access_token')
    cloud_id = session.get('jira_cloud_id')

    if not token or not cloud_id:
        return jsonify({'error': 'Not authenticated with Jira'}), 401

    res = requests.get(
        f'{ATLASSIAN_API_BASE}/{cloud_id}/rest/api/3/search/jql',
        headers={'Authorization': f'Bearer {token}', 'Accept': 'application/json'},
        params={
            'fields': 'summary,description,status,priority',
            'maxResults': 50,
            'jql': 'assignee = currentUser() ORDER BY updated DESC',
        },
    )

    print(f'[Jira Issues] status={res.status_code} body={res.text[:500]}')

    if res.status_code == 401:
        session.pop('jira_access_token', None)
        return jsonify({'error': 'Jira session expired, please reconnect'}), 401

    data = res.json()
    issues = [
        {
            'key': issue['key'],
            'summary': issue['fields']['summary'],
            'description': _extract_description(issue['fields'].get('description')),
            'status': issue['fields']['status']['name'],
            'priority': issue['fields']['priority']['name'] if issue['fields'].get('priority') else None,
        }
        for issue in data.get('issues', [])
    ]

    return jsonify({'issues': issues, 'site': session.get('jira_site_name')})


@jira_bp.route('/logout', methods=['POST'])
def logout():
    session.pop('jira_access_token', None)
    session.pop('jira_cloud_id', None)
    session.pop('jira_site_name', None)
    session.pop('jira_account_id', None)
    return jsonify({'ok': True})


def _extract_description(desc):
    """Extract plain text from Atlassian Document Format (ADF)."""
    if not desc:
        return None
    if isinstance(desc, str):
        return desc
    texts = []
    def traverse(node):
        if isinstance(node, dict):
            if node.get('type') == 'text':
                texts.append(node.get('text', ''))
            for child in node.get('content', []):
                traverse(child)
    traverse(desc)
    return ' '.join(texts).strip() or None
