#!/bin/sh
exec gunicorn -b 0.0.0.0:8000 --worker-tmp-dir /app/tmp app:app
