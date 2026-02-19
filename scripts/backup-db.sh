#!/usr/bin/env bash
set -euo pipefail

# Backup the embedded PostgreSQL database to data/backups/
#
# Usage:
#   ./scripts/backup-db.sh          # default: custom format (.dump)
#   ./scripts/backup-db.sh --sql    # plain SQL format (.sql)
#
# Requires: pg_dump (brew install postgresql)
# The embedded postgres must be running (start with: pnpm dev)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKUP_DIR="$PROJECT_ROOT/data/backups"

# Read config for port, fall back to default
PORT=54329
CONFIG_FILE="$PROJECT_ROOT/.paperclip/config.json"
if [ -f "$CONFIG_FILE" ]; then
  CONFIGURED_PORT=$(python3 -c "
import json, sys
try:
    c = json.load(open('$CONFIG_FILE'))
    print(c.get('database', {}).get('embeddedPostgresPort', ''))
except: pass
" 2>/dev/null || true)
  if [ -n "$CONFIGURED_PORT" ]; then
    PORT="$CONFIGURED_PORT"
  fi
fi

DB_NAME="paperclip"
DB_USER="paperclip"
DB_HOST="127.0.0.1"

# Check pg_dump is available
if ! command -v pg_dump &>/dev/null; then
  echo "Error: pg_dump not found. Install with: brew install postgresql" >&2
  exit 1
fi

# Check the database is reachable
if ! PGPASSWORD="$DB_USER" pg_isready -h "$DB_HOST" -p "$PORT" -U "$DB_USER" &>/dev/null; then
  echo "Error: Cannot connect to embedded PostgreSQL on port $PORT." >&2
  echo "       Make sure the server is running (pnpm dev)." >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# Choose format
FORMAT="custom"
EXT="dump"
if [[ "${1:-}" == "--sql" ]]; then
  FORMAT="plain"
  EXT="sql"
fi

BACKUP_FILE="$BACKUP_DIR/paperclip-${TIMESTAMP}.${EXT}"

echo "Backing up database '$DB_NAME' on port $PORT..."

PGPASSWORD="$DB_USER" pg_dump \
  -h "$DB_HOST" \
  -p "$PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --format="$FORMAT" \
  --file="$BACKUP_FILE"

SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "Backup saved: $BACKUP_FILE ($SIZE)"

# Prune backups older than 30 days
PRUNED=0
find "$BACKUP_DIR" -name "paperclip-*" -mtime +30 -type f -print0 | while IFS= read -r -d '' old; do
  rm "$old"
  PRUNED=$((PRUNED + 1))
done
if [ "$PRUNED" -gt 0 ]; then
  echo "Pruned $PRUNED backup(s) older than 30 days."
fi
