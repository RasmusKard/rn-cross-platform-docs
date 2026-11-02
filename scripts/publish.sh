#!/usr/bin/env bash
# Publishes a draft release's attested tarballs to npm, un-drafts the release and moves its
# major tag (v1, ...), which the README's workflow examples pin. Usage: scripts/publish.sh 1.0.0
set -euo pipefail
version=${1:?usage: $0 X.Y.Z}
repo=RasmusKard/rn-cross-platform-docs
dir=$(mktemp -d)
trap 'rm -rf "$dir"' EXIT
gh release download "v$version" -p '*.tgz' -D "$dir" -R "$repo"
for pkg in cli zensical; do
  gh attestation verify "$dir/rn-cross-platform-docs-$pkg-$version.tgz" -R "$repo"
done
for pkg in cli zensical; do
  npm publish "$dir/rn-cross-platform-docs-$pkg-$version.tgz"
done
gh release edit "v$version" --draft=false -R "$repo"
sha=$(gh api "repos/$repo/commits/v$version" --jq .sha)
major=v${version%%.*}
gh api -X PATCH "repos/$repo/git/refs/tags/$major" -f sha="$sha" -F force=true >/dev/null 2>&1 ||
  gh api "repos/$repo/git/refs" -f ref="refs/tags/$major" -f sha="$sha" >/dev/null
