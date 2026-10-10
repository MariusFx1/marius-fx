#!/bin/bash
cd /workspace/forex-ms-tools
for t in test-sim-engine test-seo test-rr-glosar test-quiz test-jurnal test-jurnal-open test-lectie test-premium test-calendar test-simulator test-workspace test-advanced test-draw test-stats; do
  out=$(timeout 900 node $t.js 2>&1); code=$?
  echo "== $t exit=$code :: $(echo "$out" | grep -Eio '[0-9]+ (passed|pass|ok)[^\n]*' | tail -1)"
  echo "$out" | grep -E "FAIL|✗|Error" | head -8
done
echo ALLDONE
