FROM python:3.11-slim

# Add non-root user
RUN adduser --disabled-password --gecos "" appuser

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .

# Create writable dirs and set ownership before switching user
RUN mkdir -p /app/logs /app/tmp && chown -R appuser:appuser /app

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENV FLASK_ENV=production
ENV PORT=8000

USER appuser
ENTRYPOINT ["/entrypoint.sh"]
