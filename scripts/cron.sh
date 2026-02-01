#!/bin/bash

# The News App - Daily Fetch and Process Cron Script
# Add to crontab: 0 6 * * * /path/to/the-news-app/scripts/cron.sh

set -e

# Load environment variables
if [ -f ~/.env.news-app ]; then
  export $(cat ~/.env.news-app | xargs)
fi

BASE_URL="${APP_URL:-http://localhost:3000}"
CRON_SECRET="${CRON_SECRET}"

echo "[$(date)] Starting daily news fetch..."

# Fetch articles from all sources
curl -X POST "${BASE_URL}/api/cron/fetch" \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  -H "Content-Type: application/json"

echo "[$(date)] Fetch complete. Starting processing..."

# Process and deduplicate articles
curl -X POST "${BASE_URL}/api/cron/process" \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  -H "Content-Type: application/json"

echo "[$(date)] Daily news update complete."
