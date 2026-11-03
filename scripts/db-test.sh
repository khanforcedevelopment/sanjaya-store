#!/usr/bin/env bash
# Runs every migration on a fresh local PostgreSQL database, then the SQL test files.
# Usage: PGHOST=/tmp/pg PGPORT=54329 scripts/db-test.sh
set -euo pipefail
cd "$(dirname "$0")/.."
DB=${TEST_DB:-sanjaya_test}
PSQL="psql -U ${PGUSER:-postgres} -v ON_ERROR_STOP=1 -q -X"
$PSQL -d postgres -c "drop database if exists $DB" -c "create database $DB" >/dev/null
$PSQL -d "$DB" -f supabase/tests/supabase_shim.sql >/dev/null
for f in supabase/migrations/*.sql; do
  echo "migrate  $(basename "$f")"
  $PSQL -d "$DB" -f "$f" >/dev/null
done
for f in supabase/tests/[0-9]*.sql; do
  echo "test     $(basename "$f")"
  $PSQL -d "$DB" -f "$f"
done
echo "All database tests passed."
