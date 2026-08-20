#!/bin/sh
# Runs the three sync endpoints in the required order:
#   advertisers -> deals -> transactions
# (deals' welcome/brand-deal generation reads the advertisers collection, so
#  advertisers must sync first.)
#
# Invoked by crond inside the `cron` sidecar container. crond runs with a
# minimal environment, so we source the values entrypoint.sh persisted.
. /tmp/sync.env 2>/dev/null || true

APP_URL="${SYNC_APP_URL:-http://affiliate-app:3000}"
SECRET="$CRON_SECRET"

log() { echo "[sync-cron $(date -u +%Y-%m-%dT%H:%M:%SZ)] $*"; }

# -T 900: the Awin deal sync now drains ~115 pages and can take a few minutes;
# give each request a generous read timeout so wget doesn't abort early.
hit() {
  name="$1"; path="$2"
  if wget -q -T 900 -O- "${APP_URL}${path}?secret=${SECRET}" >/dev/null 2>&1; then
    log "${name} OK"
  else
    log "${name} FAILED"
  fi
}

log "starting sync run"
hit "advertisers"  "/api/cron/sync-advertisers"
hit "deals"        "/api/cron/sync-deals"
hit "transactions" "/api/cron/sync-transactions"
log "sync run complete"
