#!/usr/bin/env bash
set -euo pipefail

source_dir=$(pwd)
worktree="$RUNNER_TEMP/cfsmonond-dist"
message="$RUNNER_TEMP/cfsmonond-commit-message"
git log -1 --format=%B > "$message"
test -f "$source_dir/dist/index.html"
test -d "$source_dir/dist/assets"

status=0
git ls-remote --exit-code --heads origin refs/heads/dist >/dev/null || status=$?
case "$status" in
  0)
    git fetch origin refs/heads/dist:refs/remotes/origin/dist
    git worktree add --detach "$worktree" refs/remotes/origin/dist
    git -C "$worktree" rm -r --ignore-unmatch -- .
    ;;
  2)
    git worktree add --detach "$worktree" HEAD
    git -C "$worktree" switch --orphan "dist-build-$GITHUB_RUN_ID-$GITHUB_RUN_ATTEMPT"
    ;;
  *)
    exit "$status"
    ;;
esac

cp "$source_dir/dist/index.html" "$worktree/index.html"
cp -R "$source_dir/dist/assets" "$worktree/assets"
git -C "$worktree" add -- index.html assets
git -C "$worktree" -c user.name="github-actions[bot]" \
  -c user.email="41898282+github-actions[bot]@users.noreply.github.com" \
  commit --allow-empty --cleanup=verbatim --file "$message"
git -C "$worktree" push origin HEAD:refs/heads/dist
