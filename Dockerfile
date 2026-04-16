FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends gosu && rm -rf /var/lib/apt/lists/*

# Add non-root user
RUN adduser --disabled-password --gecos "" appuser

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
RUN chown -R appuser /app
RUN mkdir -p /app/logs /app/tmp && chown -R appuser /app/logs /app/tmp

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENV FLASK_ENV=production
ENV PORT=8000
# Run as root so entrypoint can fix bind-mount permissions, then drops to appuser via gosu
ENTRYPOINT ["/entrypoint.sh"]
