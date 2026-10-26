#!/usr/bin/env bash
# Builds the app twice with the same SOURCE_DATE_EPOCH and checks the outputs are identical.
# Usage: scripts/check-reproducible.sh   (uses the last commit time)
set -euo pipefail
export SOURCE_DATE_EPOCH="${SOURCE_DATE_EPOCH:-$(git log -1 --format=%ct)}"
hash_dist() { (cd dist && find . -type f -print0 | sort -z | xargs -0 sha256sum) | sha256sum | cut -d' ' -f1; }
npx vite build --logLevel error >/dev/null
first=$(hash_dist); first_sw=$(sha256sum dist/sw.js | cut -d' ' -f1)
rm -rf dist
npx vite build --logLevel error >/dev/null
second=$(hash_dist)
if [ "$first" != "$second" ]; then
  echo "✖ Builds differ (SOURCE_DATE_EPOCH=$SOURCE_DATE_EPOCH)"; exit 1
fi
echo "✔ Reproducible build: dist hash $first (sw.js $first_sw)"
