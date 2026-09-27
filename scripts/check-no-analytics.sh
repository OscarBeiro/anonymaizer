#!/bin/sh
# P21/P22: fail if a build output contains analytics code. Run against every
# output that was built without ANONYMAIZER_ANALYTICS=1 — the portable build
# always, preview builds, and a local `npm run build`.
#   scripts/check-no-analytics.sh dist-portable
# POSIX find/grep only (runs in the Alpine dev container and on CI). A grep
# error (exit >1) fails the check rather than passing it.
set -u
dir="${1:?usage: check-no-analytics.sh <build-dir>}"
[ -d "$dir" ] || { echo "error: $dir does not exist" >&2; exit 2; }
pattern='googletagmanager|google-analytics\.com|analytics\.google\.com|metricool\.com|gtag\(|beTracker'
found=$(find "$dir" -type f \( -name '*.js' -o -name '*.html' -o -name '_headers' \) -exec grep -lE "$pattern" {} +)
status=$?
if [ -n "$found" ]; then
  echo "$found"
  echo "error: analytics code found in $dir (files above)" >&2
  exit 1
fi
# find reports grep's "no match" (1) as a non-zero status too; only >1 is an error.
if [ "$status" -gt 1 ]; then
  echo "error: search failed in $dir" >&2
  exit 2
fi
echo "ok: no analytics code in $dir"
