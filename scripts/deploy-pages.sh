#!/usr/bin/env bash
# Build the single-file page and publish it to the gh-pages branch (GitHub Pages).
# The Pages copy keeps data in each visitor's own browser. Sync only exists in the Claude artifact.
set -euo pipefail
cd "$(dirname "$0")/.."
npm run build
ORIGIN=$(git remote get-url origin)
TMP=$(mktemp -d)
cp dist/index.html "$TMP/index.html"
touch "$TMP/.nojekyll"
cd "$TMP"
git init -q -b gh-pages
git add -A
git commit -q -m "Deploy Trio"
git push "$ORIGIN" +gh-pages:gh-pages
echo "Deployed. https://augustas-armalis.github.io/trio/ updates in about a minute."
