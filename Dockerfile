FROM node:20-slim AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

FROM python:3.11-slim

# Add non-root user
RUN adduser --disabled-password --gecos "" appuser

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .

# Copy the React build from the frontend stage
COPY --from=frontend /app/frontend/dist ./frontend/dist

# Create writable dirs and set ownership before switching user
RUN mkdir -p /app/logs /app/tmp /app/hf_cache && chown -R appuser:appuser /app

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENV FLASK_ENV=production
ENV PORT=8000

USER appuser
ENTRYPOINT ["/entrypoint.sh"]
