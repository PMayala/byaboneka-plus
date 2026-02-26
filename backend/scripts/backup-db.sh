#!/bin/bash
# ============================================
# DATABASE BACKUP SCRIPT
# File: scripts/backup-db.sh
# Gap Fix #15: No database backup strategy
#
# Usage:
#   chmod +x scripts/backup-db.sh
#   ./scripts/backup-db.sh
#
# Cron (daily at 4 AM):
#   0 4 * * * /path/to/byaboneka-backend/scripts/backup-db.sh >> /var/log/byaboneka-backup.log 2>&1
# ============================================

set -euo pipefail

# Configuration (override via environment)
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-byaboneka}"
DB_USER="${DB_USER:-postgres}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

# Timestamp for filename
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/byaboneka_${TIMESTAMP}.sql.gz"

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

echo "🗄️  Byaboneka+ Database Backup"
echo "   Time: $(date)"
echo "   Database: ${DB_NAME}@${DB_HOST}:${DB_PORT}"
echo "   Output: ${BACKUP_FILE}"
echo ""

# Run pg_dump with compression
echo "📦 Creating backup..."
PGPASSWORD="${DB_PASSWORD:-}" pg_dump \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --no-owner \
  --no-privileges \
  --clean \
  --if-exists \
  --format=custom \
  --compress=9 \
  -f "${BACKUP_DIR}/byaboneka_${TIMESTAMP}.dump" 2>&1

# Also create a plain SQL backup (gzipped) for portability
pg_dump \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --no-owner \
  --no-privileges \
  | gzip > "$BACKUP_FILE" 2>&1

# Get backup size
DUMP_SIZE=$(du -sh "${BACKUP_DIR}/byaboneka_${TIMESTAMP}.dump" | cut -f1)
SQL_SIZE=$(du -sh "$BACKUP_FILE" | cut -f1)
echo "✅ Backup complete: ${DUMP_SIZE} (custom) + ${SQL_SIZE} (sql.gz)"

# Clean up old backups
echo "🧹 Cleaning backups older than ${RETENTION_DAYS} days..."
DELETED=$(find "$BACKUP_DIR" -name "byaboneka_*.dump" -o -name "byaboneka_*.sql.gz" -mtime +${RETENTION_DAYS} -delete -print | wc -l)
echo "   Removed: ${DELETED} old backup files"

# Verify backup integrity
echo "🔍 Verifying backup..."
if pg_restore --list "${BACKUP_DIR}/byaboneka_${TIMESTAMP}.dump" > /dev/null 2>&1; then
  echo "✅ Backup verified successfully"
else
  echo "❌ WARNING: Backup verification failed!"
  exit 1
fi

echo ""
echo "📊 Current backups:"
ls -lh "$BACKUP_DIR"/byaboneka_*.dump 2>/dev/null | tail -5
echo ""
echo "Done."


# ============================================
# RESTORE INSTRUCTIONS:
# ============================================
# 
# From custom dump (recommended):
#   pg_restore -h localhost -U postgres -d byaboneka --clean --if-exists backups/byaboneka_XXXXXX.dump
#
# From SQL gzip:
#   gunzip -c backups/byaboneka_XXXXXX.sql.gz | psql -h localhost -U postgres -d byaboneka
#
# ============================================
# DOCKER USAGE:
# ============================================
#
# Backup from Docker:
#   docker exec byaboneka-db pg_dump -U postgres byaboneka | gzip > backup.sql.gz
#
# Restore to Docker:
#   gunzip -c backup.sql.gz | docker exec -i byaboneka-db psql -U postgres byaboneka
