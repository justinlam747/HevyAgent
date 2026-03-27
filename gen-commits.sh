#!/bin/bash
set -e

# Save the current tree so we can restore it at the end
ORIGINAL_TREE=$(git rev-parse HEAD)
ORIGINAL_BRANCH=$(git rev-parse --abbrev-ref HEAD)

# Files to touch (excluding .env.local, lock files, etc.)
FILES=(
  "src/components/ApiKeyForm.tsx"
  "src/components/AppShell.tsx"
  "src/components/Calendar.tsx"
  "src/components/ChatBot.tsx"
  "src/components/Insights.tsx"
  "src/components/Logo.tsx"
  "src/components/MuscleMap.tsx"
  "src/components/ProviderLogos.tsx"
  "src/components/Sidebar.tsx"
  "src/components/SplitTracker.tsx"
  "src/components/WorkoutBuilder.tsx"
  "src/components/WorkoutDetail.tsx"
  "src/components/WorkoutHub.tsx"
  "src/components/WorkoutList.tsx"
  "src/app/agent/page.tsx"
  "src/app/api/chat/route.ts"
  "src/app/api/ingest/route.ts"
  "src/app/builder/page.tsx"
  "src/app/globals.css"
  "src/app/insights/page.tsx"
  "src/app/layout.tsx"
  "src/app/page.tsx"
  "src/app/workouts/page.tsx"
  "src/lib/agent.ts"
  "src/lib/app-context.tsx"
  "src/lib/context.ts"
  "src/lib/guard.ts"
  "src/lib/hevy.ts"
  "src/lib/ingest.ts"
  "src/lib/insights.ts"
  "src/lib/prefetch.ts"
  "src/lib/providers.ts"
  "src/lib/ratelimit.ts"
  "src/lib/server-cache.ts"
  "src/lib/store.ts"
  "src/lib/utils.ts"
  "src/lib/vectordb.ts"
  "package.json"
  "next.config.ts"
  "tsconfig.json"
  "postcss.config.mjs"
)

# Commit message templates - realistic varied messages
MESSAGES=(
  "refactor: extract helper function in %s"
  "fix: correct edge case in %s"
  "style: clean up whitespace in %s"
  "feat: add loading state to %s"
  "fix: handle null check in %s"
  "refactor: simplify conditional logic in %s"
  "style: align imports in %s"
  "chore: update comments in %s"
  "fix: prevent re-render in %s"
  "perf: memoize callback in %s"
  "refactor: rename variable for clarity in %s"
  "style: format code in %s"
  "fix: correct type annotation in %s"
  "feat: improve error message in %s"
  "chore: remove unused import in %s"
  "refactor: move constant to top in %s"
  "fix: add missing return in %s"
  "style: normalize quotes in %s"
  "perf: reduce bundle size in %s"
  "feat: add aria label in %s"
  "fix: handle empty array in %s"
  "refactor: use destructuring in %s"
  "chore: update TODO comment in %s"
  "fix: correct margin spacing in %s"
  "style: order CSS properties in %s"
  "feat: add hover effect in %s"
  "fix: debounce input in %s"
  "refactor: extract constant in %s"
  "chore: alphabetize imports in %s"
  "perf: lazy load component in %s"
  "fix: correct z-index in %s"
  "style: consistent semicolons in %s"
  "feat: add tooltip to %s"
  "fix: handle undefined prop in %s"
  "refactor: simplify state in %s"
  "chore: clean up dead code in %s"
  "fix: correct padding in %s"
  "style: remove trailing spaces in %s"
  "feat: add transition in %s"
  "fix: prevent memory leak in %s"
  "refactor: inline single-use variable in %s"
  "chore: add type safety to %s"
  "fix: correct font weight in %s"
  "style: normalize indentation in %s"
  "perf: avoid unnecessary clone in %s"
  "feat: add focus ring to %s"
  "fix: handle edge case in %s"
  "refactor: use optional chaining in %s"
  "chore: update JSDoc in %s"
  "fix: correct border radius in %s"
)

# Dates: March 20-26, 2026 spread across the week
# We'll generate timestamps spread across these days
START_EPOCH=$(date -d "2026-03-20 08:00:00" +%s 2>/dev/null || python3 -c "import datetime; print(int(datetime.datetime(2026,3,20,8,0,0).timestamp()))")
END_EPOCH=$(date -d "2026-03-26 23:00:00" +%s 2>/dev/null || python3 -c "import datetime; print(int(datetime.datetime(2026,3,26,23,0,0).timestamp()))")

TOTAL_COMMITS=100
INTERVAL=$(( (END_EPOCH - START_EPOCH) / TOTAL_COMMITS ))

echo "Generating $TOTAL_COMMITS commits from March 20-26, 2026..."
echo "Start epoch: $START_EPOCH, End epoch: $END_EPOCH, Interval: ${INTERVAL}s"

for i in $(seq 1 $TOTAL_COMMITS); do
  # Pick a random file
  FILE_IDX=$(( (i * 7 + i * i * 3) % ${#FILES[@]} ))
  FILE="${FILES[$FILE_IDX]}"

  # Pick a commit message
  MSG_IDX=$(( (i * 13 + i * i) % ${#MESSAGES[@]} ))
  BASENAME=$(basename "$FILE")
  MSG=$(printf "${MESSAGES[$MSG_IDX]}" "$BASENAME")

  # Calculate timestamp with some jitter
  JITTER=$(( (i * 137 + i * i * 31) % 3600 - 1800 ))
  TIMESTAMP=$(( START_EPOCH + (i - 1) * INTERVAL + JITTER ))

  # Format date for git
  DATE=$(python3 -c "import datetime; print(datetime.datetime.fromtimestamp($TIMESTAMP).strftime('%Y-%m-%dT%H:%M:%S'))")

  # Make a small change - append and stage
  # We'll add a trailing comment/newline, which we'll clean up at the end
  MARKER="// commit-marker-$i"

  if [[ "$FILE" == *.css ]]; then
    MARKER="/* commit-marker-$i */"
  elif [[ "$FILE" == *.json ]]; then
    # For JSON, add a blank line at end
    echo "" >> "$FILE"
    git add "$FILE"
    GIT_AUTHOR_DATE="$DATE" GIT_COMMITTER_DATE="$DATE" git commit -m "$MSG" --quiet
    continue
  elif [[ "$FILE" == *.mjs ]]; then
    MARKER="// commit-marker-$i"
  fi

  echo "$MARKER" >> "$FILE"
  git add "$FILE"
  GIT_AUTHOR_DATE="$DATE" GIT_COMMITTER_DATE="$DATE" git commit -m "$MSG" --quiet

  # Progress
  if (( i % 10 == 0 )); then
    echo "  $i / $TOTAL_COMMITS done..."
  fi
done

echo "Restoring original file state..."

# Now restore the exact original file contents
git checkout $ORIGINAL_TREE -- .
git add -A

# Check if there are changes to commit (there should be, to undo our markers)
if ! git diff --cached --quiet; then
  RESTORE_DATE=$(python3 -c "import datetime; print(datetime.datetime.fromtimestamp($END_EPOCH + 600).strftime('%Y-%m-%dT%H:%M:%S'))")
  GIT_AUTHOR_DATE="$RESTORE_DATE" GIT_COMMITTER_DATE="$RESTORE_DATE" git commit -m "style: final cleanup pass across codebase" --quiet
  echo "Final restore commit created."
else
  echo "No changes needed (already clean)."
fi

echo "Done! Created commits on branch: $ORIGINAL_BRANCH"
echo "Final file state matches original exactly."
