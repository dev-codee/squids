#!/bin/sh
# PPC permission outreach. Invoked by crond inside the `cron` sidecar container.
#
# Takes the task as $1:
#   send      initial permission request for READY records (weekday mornings)
#   followup  the single follow-up, once its window has elapsed (hourly)
#   sweep     close unanswered follow-ups as NO_RESPONSE (daily, sends nothing)
#
# crond runs with a minimal environment, so we source what entrypoint.sh
# persisted — same as run-sync.sh.
. /tmp/sync.env 2>/dev/null || true

APP_URL="${SYNC_APP_URL:-http://affiliate-app:3000}"
SECRET="$CRON_SECRET"
TASK="${1:-send}"

log() { echo "[ppc-cron $(date -u +%Y-%m-%dT%H:%M:%SZ)] $*"; }

log "running task=${TASK}"
# -T 120 matches the route's maxDuration. Unlike run-sync.sh we keep the body:
# the JSON summary (sent/skipped/failed per merchant) is the only record of what
# the job decided, and `docker logs affiliate-cron` is where you read it back.
if body=$(wget -q -T 120 -O- "${APP_URL}/api/cron/ppc-outreach?task=${TASK}&secret=${SECRET}" 2>/dev/null); then
  log "task=${TASK} OK ${body}"
else
  log "task=${TASK} FAILED"
fi
