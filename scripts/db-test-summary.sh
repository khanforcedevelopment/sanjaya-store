#!/usr/bin/env bash
# Runs scripts/db-test.sh and prints a compact summary (passes counted, failures shown).
out=$("$(dirname "$0")/db-test.sh" 2>&1); code=$?
echo "$out" | grep -E "^(migrate|test) "
echo "passed assertions: $(echo "$out" | grep -c 'NOTICE:  ok - ')"
if [ $code -ne 0 ]; then echo "$out" | grep -E "ERROR|FAILED" | head -5; echo "$out" | grep -B2 -A3 "ERROR" | grep -E "CONTEXT|LINE|line" | head -6; fi
exit $code
