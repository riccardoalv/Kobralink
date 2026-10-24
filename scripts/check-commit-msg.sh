#!/bin/sh
# Validates a commit message against Conventional Commits (https://www.conventionalcommits.org).
# Used by the husky commit-msg hook; CI runs commitlint with the same rules (.commitlintrc.yml).
set -eu

msg_file="$1"
header=$(sed -n '1p' "$msg_file")

case "$header" in
  Merge\ *|Revert\ *|fixup!\ *|squash!\ *) exit 0 ;;
esac

types="feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert"
pattern="^($types)(\([a-z0-9._/-]+\))?!?: .+"

if ! printf '%s' "$header" | grep -Eq "$pattern"; then
  cat >&2 <<MSG
✖ Commit message does not follow Conventional Commits:

    $header

Expected:  <type>(<optional scope>): <description>
Types:     feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert
Examples:  feat(bridge): report the printer's real model
           fix(spoolman): split usage when the spool changes mid-print
           docs: explain the external spool slot

See CONTRIBUTING.md.
MSG
  exit 1
fi

if [ "${#header}" -gt 100 ]; then
  echo "✖ Commit header is longer than 100 characters (${#header})." >&2
  exit 1
fi
