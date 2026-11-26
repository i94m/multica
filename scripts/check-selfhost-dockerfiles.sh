#!/usr/bin/env bash
# Reports drift between the upstream build files and the self-host copies used
# by docker-compose.selfhost.build.yml.
#
# The self-host copies exist only to add BuildKit cache mounts and an optional
# npm mirror; everything else must track upstream. Run this after merging an
# upstream release:
#
#   bash scripts/check-selfhost-dockerfiles.sh
#
# Exit status is non-zero when an upstream instruction is missing from the
# self-host copy, which means a build step changed and the copy needs the same
# change.
set -euo pipefail

cd "$(dirname "$0")/.."

status=0

# Flatten a Dockerfile into one comparable string: drop comments and blank
# lines, strip shell continuations and --mount flags, turn && into ;, collapse
# whitespace. Ordering is ignored because the self-host copy joins several
# upstream RUN steps into one.
flatten() {
  sed -e 's/[[:space:]]*\\$//' \
      -e 's/--mount=type=cache,[^ ]*[[:space:]]*//g' \
      -e 's/[[:space:]]*&&[[:space:]]*/ ; /g' \
      -e 's/[[:space:]]\+/ /g' \
      -e 's/^ //' \
      -e 's/ $//' \
      "$1" |
  grep -vE '^(#|$)' |
  grep -vE '^(ARG NPM_REGISTRY=|RUN if \[ -n "\$NPM_REGISTRY" \]; then pnpm config set registry "\$NPM_REGISTRY"; fi|ENV NEXT_TELEMETRY_DISABLED=1)$' |
  paste -sd' ' -
}

check() {
  local upstream="$1" selfhost="$2"
  local haystack
  haystack="$(flatten "$selfhost")"
  local missing=""

  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    # Compare the instruction payload, without the leading RUN.
    local payload="${line#RUN }"
    payload="${payload#cd server ; }"
    if [[ "$haystack" != *"$payload"* ]]; then
      missing+="  $line"$'\n'
    fi
  done < <(sed -e 's/[[:space:]]*\\$//' \
                -e 's/--mount=type=cache,[^ ]*[[:space:]]*//g' \
                -e 's/[[:space:]]*&&[[:space:]]*/ ; /g' \
                -e 's/[[:space:]]\+/ /g' \
                -e 's/^ //' \
                -e 's/ $//' \
                "$upstream" |
           grep -vE '^(#|$)' |
           grep -vE '^(ARG NPM_REGISTRY=|RUN if \[ -n "\$NPM_REGISTRY" \]; then pnpm config set registry "\$NPM_REGISTRY"; fi|ENV NEXT_TELEMETRY_DISABLED=1)$')

  if [[ -n "$missing" ]]; then
    printf '\n%s is missing instructions that %s has:\n\n%s\n' "$selfhost" "$upstream" "$missing"
    status=1
  else
    printf '%s tracks %s\n' "$selfhost" "$upstream"
  fi
}

check Dockerfile Dockerfile.selfhost
check Dockerfile.web Dockerfile.web.selfhost

exit "$status"
