#!/bin/sh
# Fix permissions on bind-mounted directories, then drop to appuser
chown -R appuser:appuser /app/logs /app/data
exec gosu appuser gunicorn -b 0.0.0.0:8000 --worker-tmp-dir /app/tmp app:app
