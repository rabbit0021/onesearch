FROM python:3.11-slim

# Add non-root user
RUN adduser --disabled-password --gecos "" appuser

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
RUN chown -R appuser /app
# Create logs dir with right permission
RUN mkdir -p /app/logs && chown -R appuser /app/logs
RUN mkdir -p /app/tmp && chmod 777 /app/tmp/

USER appuser

ENV FLASK_ENV=production
ENV PORT=8000
CMD ["gunicorn", "-b", "0.0.0.0:8000", "app:app"]
