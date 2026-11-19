#!/usr/bin/env bash
set -euo pipefail

PACKAGE_PATH="${1:?Usage: mutation-changed.sh <package-path> <filter>}"
FILTER="${2:?Usage: mutation-changed.sh <package-path> <filter>}"

run_full() {
  echo "::notice::Running full mutation testing for ${FILTER}."
  pnpm exec turbo run test:mutation --filter="${FILTER}"
}

if [ "${STRYKER_FULL:-0}" = "1" ] || [ -z "${BASE_REF:-}" ]; then
  run_full
  exit 0
fi

if ! git rev-parse --verify --quiet "${BASE_REF}^{commit}" >/dev/null; then
  echo "::warning::Base ref '${BASE_REF}' is not a reachable commit; running full mutation testing."
  run_full
  exit 0
fi

CHANGED_FILES="$(git -C "${PACKAGE_PATH}" diff --name-only --relative --diff-filter=ACMR "${BASE_REF}...HEAD" || true)"

MUTATE=""
while IFS= read -r rel_path; do
  [ -n "${rel_path}" ] || continue
  case "${rel_path}" in
    *.ts | *.tsx) ;;
    *) continue ;;
  esac
  case "${rel_path}" in
    *__tests__/* | *.test.ts | *.test.tsx | *.spec.ts | *.spec.tsx | *.d.ts | */cypress/*) continue ;;
    next.config.* | jest.config.* | playwright.config.* | cypress.config.* | tailwind.config.* | postcss.config.* | vitest.config.* | stryker.config.*) continue ;;
  esac
  [ -f "${PACKAGE_PATH}/${rel_path}" ] || continue
  if [ -z "${MUTATE}" ]; then
    MUTATE="${rel_path}"
  else
    MUTATE="${MUTATE},${rel_path}"
  fi
done <<< "${CHANGED_FILES}"

if [ -z "${MUTATE}" ]; then
  echo "::notice::No mutable source changes in ${FILTER}; skipping mutation testing."
  exit 0
fi

echo "::notice::Mutating only changed source files for ${FILTER}."
echo "Changed source files: ${MUTATE}"

# Build only this workspace's dependencies so cross-package imports resolve,
# then scope Stryker to the files this change actually touched.
pnpm exec turbo run build --filter="${FILTER}^..."
pnpm --filter "${FILTER}" exec stryker run --mutate "${MUTATE}"
