#!/usr/bin/env bash
# Runs a command in CI. If it fails, its last lines of output are repeated as an error
# annotation, which shows on the run page and through the API even where raw logs can't be read.
set -o pipefail
log=$(mktemp)
"$@" 2>&1 | tee "$log"
status=$?
if [ "$status" -ne 0 ]; then
  msg=$(grep -v '^npm warn' "$log" | sed 's/\x1b\[[0-9;]*m//g' | tail -n 30)
  msg=${msg//'%'/'%25'}
  msg=${msg//$'\r'/}
  msg=${msg//$'\n'/'%0A'}
  title=$(echo "$*" | cut -c1-80)
  title=${title//'%'/'%25'}; title=${title//':'/'%3A'}; title=${title//','/'%2C'}
  echo "::error title=$title (exit $status)::$msg"
fi
exit "$status"
