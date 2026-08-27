#!/bin/bash
# Finance Tracker — Robot Framework test runner
# Usage: bash tests/robot/run.sh [suite]
# Examples:
#   bash tests/robot/run.sh              # run all suites
#   bash tests/robot/run.sh 01_auth      # run only auth suite
#   bash tests/robot/run.sh --headed     # run with visible browser

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
VENV="$PROJECT_DIR/.venv-robot"
RESULTS="$SCRIPT_DIR/results"
SUITES="$SCRIPT_DIR/suites"

# Check venv
if [ ! -d "$VENV" ]; then
  echo "ERROR: .venv-robot not found. Run:"
  echo "  cd $PROJECT_DIR && uv venv .venv-robot && source .venv-robot/bin/activate && uv pip install robotframework robotframework-browser robotframework-requests && rfbrowser init"
  exit 1
fi

# Activate
source "$VENV/bin/activate"

mkdir -p "$RESULTS"

# Headless by default, --headed flag overrides
HEADLESS_VAR="-v HEADLESS:True"
SUITE_FILTER=""

for arg in "$@"; do
  if [ "$arg" = "--headed" ]; then
    HEADLESS_VAR="-v HEADLESS:False"
  else
    SUITE_FILTER="$SUITES/${arg}*.robot"
  fi
done

if [ -z "$SUITE_FILTER" ]; then
  SUITE_FILTER="$SUITES"
fi

echo "=============================="
echo "Finance Tracker Robot Tests"
echo "Target: $SUITE_FILTER"
echo "Results: $RESULTS"
echo "=============================="

python3 -m robot \
  --outputdir "$RESULTS" \
  --output output.xml \
  --report report.html \
  --log log.html \
  --loglevel INFO \
  $HEADLESS_VAR \
  $SUITE_FILTER

EXIT_CODE=$?

echo ""
echo "=============================="
if [ $EXIT_CODE -eq 0 ]; then
  echo "ALL TESTS PASSED"
else
  echo "SOME TESTS FAILED — check $RESULTS/report.html"
fi
echo "=============================="

exit $EXIT_CODE
