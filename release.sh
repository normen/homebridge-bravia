#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

for cmd in node git gh; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Missing required command: $cmd" >&2
    exit 1
  fi
done

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Working tree is not clean. Commit or stash changes before releasing." >&2
  exit 1
fi

version="$(node -p "require('./package.json').version")"
tag="v${version}"
branch="$(git branch --show-current)"

if [ -z "$branch" ]; then
  echo "Could not determine current branch." >&2
  exit 1
fi

echo "Releasing ${tag} from branch ${branch}"

if git rev-parse "$tag" >/dev/null 2>&1; then
  echo "Tag ${tag} already exists locally." >&2
  exit 1
fi

if gh release view "$tag" >/dev/null 2>&1; then
  echo "GitHub release ${tag} already exists." >&2
  exit 1
fi

git push origin "$branch"
git tag "$tag"
git push origin "$tag"
gh release create "$tag" --generate-notes --title "$tag"

echo "Release ${tag} created."
