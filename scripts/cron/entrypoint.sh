#!/bin/sh
# Entrypoint for the `cron` sidecar (alpine/busybox). Installs the schedule and
# runs crond in the foreground so Docker keeps the container alive.
set -e

: "${CRON_SECRET:?CRON_SECRET is not set — add it to .env.local}"

APP_URL="${SYNC_APP_URL:-http://affiliate-app:3000}"
# Default: twice a day at 03:00 and 15:00 (container timezone = UTC unless set).
SCHEDULE="${SYNC_SCHEDULE:-0 3,15 * * *}"

# PPC permission outreach schedules. Weekday mornings for the initial request,
# hourly through the working day for the single follow-up, once daily for the
# no-response sweep. Override any of them in docker-compose.yml.
PPC_SEND_SCHEDULE="${PPC_SEND_SCHEDULE:-0 8 * * 1-5}"
PPC_FOLLOWUP_SCHEDULE="${PPC_FOLLOWUP_SCHEDULE:-0 9-17 * * 1-5}"
PPC_SWEEP_SCHEDULE="${PPC_SWEEP_SCHEDULE:-30 7 * * *}"

# crond runs jobs with a bare environment, so persist the runtime config where
# run-sync.sh can source it. /cron is mounted read-only, so write to /tmp.
cat > /tmp/sync.env <<EOF
CRON_SECRET=${CRON_SECRET}
SYNC_APP_URL=${APP_URL}
EOF

# Install the crontab. Job output is redirected to PID 1's stdout so it shows
# up in `docker logs affiliate-cron`.
mkdir -p /etc/crontabs
cat > /etc/crontabs/root <<EOF
${SCHEDULE} /bin/sh /cron/run-sync.sh >> /proc/1/fd/1 2>&1
${PPC_SEND_SCHEDULE} /bin/sh /cron/run-ppc.sh send >> /proc/1/fd/1 2>&1
${PPC_FOLLOWUP_SCHEDULE} /bin/sh /cron/run-ppc.sh followup >> /proc/1/fd/1 2>&1
${PPC_SWEEP_SCHEDULE} /bin/sh /cron/run-ppc.sh sweep >> /proc/1/fd/1 2>&1
EOF

echo "[sync-cron] schedule installed:"
cat /etc/crontabs/root
echo "[sync-cron] target app: ${APP_URL}"

# -f foreground, -l 8 log level (execution logging to stderr).
exec crond -f -l 8
