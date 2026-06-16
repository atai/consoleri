#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

DRY_RUN=false
RUN_TESTS=true
BUMP=""

usage() {
  cat <<'EOF'
Usage: scripts/release.sh [--dry-run] [--no-test] <patch|minor|major>

Bump the semver version, update CHANGELOG.md, sync package.json files,
create a release commit, and annotate tag vX.Y.Z.

Options:
  --dry-run   Show the new version and changelog preview without writing
  --no-test   Skip "npm run test" before release

Environment:
  RELEASE_BRANCH   Override the required git branch (default: main or master)
EOF
}

die() {
  echo "release: $*" >&2
  exit 1
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    die "'$1' is not installed or not in PATH.

Install git-cliff:
  Windows:  scoop install git-cliff
            choco install git-cliff
  macOS:    brew install git-cliff
  Linux:    cargo install git-cliff"
  fi
}

require_clean_tree() {
  if [[ -n "$(git status --porcelain)" ]]; then
    die "Working tree is not clean. Commit or stash changes before releasing."
  fi
}

require_release_branch() {
  local branch
  branch="$(git rev-parse --abbrev-ref HEAD)"

  if [[ -n "${RELEASE_BRANCH:-}" ]]; then
    [[ "$branch" == "$RELEASE_BRANCH" ]] || die "Release must be run on branch '$RELEASE_BRANCH' (current: $branch)"
    return
  fi

  if [[ "$branch" != "main" && "$branch" != "master" ]]; then
    die "Release must be run on main or master (current: $branch). Set RELEASE_BRANCH to override."
  fi
}

require_valid_bump() {
  case "$BUMP" in
    patch | minor | major) ;;
    *) die "Invalid bump type '$BUMP'. Expected patch, minor, or major." ;;
  esac
}

require_tag_absent() {
  local tag="v$1"
  if git rev-parse "$tag" >/dev/null 2>&1; then
    die "Tag '$tag' already exists."
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --no-test)
      RUN_TESTS=false
      shift
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    patch | minor | major)
      if [[ -n "$BUMP" ]]; then
        die "Multiple bump types specified."
      fi
      BUMP="$1"
      shift
      ;;
    *)
      die "Unknown argument: $1"
      ;;
  esac
done

[[ -n "$BUMP" ]] || {
  usage
  exit 1
}

require_command git
require_command git-cliff
require_command node
require_clean_tree
require_release_branch
require_valid_bump

NEW_VERSION="$(node scripts/bump-version.mjs "$BUMP" --dry-run)"
require_tag_absent "$NEW_VERSION"

echo "Preparing release v${NEW_VERSION} (${BUMP})"

if [[ "$RUN_TESTS" == true ]]; then
  echo "Running tests..."
  npm run test
fi

if [[ "$DRY_RUN" == true ]]; then
  echo
  echo "Dry run — no files will be modified."
  echo "New version: ${NEW_VERSION}"
  echo
  echo "Changelog preview:"
  echo "------------------"
  git cliff --config cliff.toml --unreleased --tag "v${NEW_VERSION}"
  echo "------------------"
  echo
  echo "Would run:"
  echo "  git cliff --config cliff.toml --prepend CHANGELOG.md --tag v${NEW_VERSION}"
  echo "  node scripts/bump-version.mjs ${BUMP}"
  echo "  git commit -m \"chore(release): v${NEW_VERSION}\""
  echo "  git tag -a v${NEW_VERSION} -m \"Release v${NEW_VERSION}\""
  exit 0
fi

git cliff --config cliff.toml --prepend CHANGELOG.md --tag "v${NEW_VERSION}"
node scripts/bump-version.mjs "$BUMP" >/dev/null

git add CHANGELOG.md package.json apps/desktop/package.json packages/core/package.json
git commit -m "chore(release): v${NEW_VERSION}"
git tag -a "v${NEW_VERSION}" -m "Release v${NEW_VERSION}"

BRANCH="$(git rev-parse --abbrev-ref HEAD)"

echo
echo "Released v${NEW_VERSION}"
echo
echo "Push the release commit and tag:"
echo "  git push origin ${BRANCH}"
echo "  git push origin v${NEW_VERSION}"
