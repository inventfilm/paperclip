#!/usr/bin/env bash
# paperclip-skill-smoke.sh
#
# Verifies behavioural correctness of the Paperclip skill (SKILL.md) against a
# local Paperclip instance. Requires a running server and at least one
# claude_local agent.
#
# Usage:
#   ./scripts/smoke/paperclip-skill-smoke.sh [--api-base URL] [--company-prefix PREFIX]
#
# Options:
#   --api-base        Base URL of the Paperclip API  (default: http://localhost:3100)
#   --company-prefix  Issue prefix of the company to use (default: first company found)
#   --agent-id        Agent ID to use (default: first claude_local agent found)
#   --skip-cleanup    Leave test issues in place after the run
#
# Requires: curl, jq, npx (paperclipai)

set -euo pipefail

# ── Colours ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# ── Helpers ────────────────────────────────────────────────────────────────────
log()  { echo "  $*"; }
pass() { echo -e "  ${GREEN}✅ PASS${NC}  $*"; PASSES=$((PASSES + 1)); }
fail() { echo -e "  ${RED}❌ FAIL${NC}  $*"; FAILURES=$((FAILURES + 1)); }
warn() { echo -e "  ${YELLOW}⚠️  WARN${NC}  $*"; }
section() { echo; echo "──────────────────────────────────────────"; echo "  $*"; echo "──────────────────────────────────────────"; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || { echo "ERROR: missing required command: $1" >&2; exit 1; }
}

api() {
  local method="$1"; shift
  local path="$1"; shift
  curl -s -X "$method" "${API_BASE}${path}" \
    -H "Authorization: Bearer local-board" \
    -H "Content-Type: application/json" \
    "$@"
}

wait_for_run() {
  local run_id="$1"
  local max_wait="${2:-120}"
  local elapsed=0
  while [[ $elapsed -lt $max_wait ]]; do
    local status
    status=$(api GET "/api/runs/${run_id}" 2>/dev/null | jq -r '.status // empty' 2>/dev/null || true)
    case "$status" in
      succeeded|failed|cancelled) echo "$status"; return ;;
    esac
    sleep 2
    elapsed=$((elapsed + 2))
  done
  echo "timeout"
}

# ── Defaults ───────────────────────────────────────────────────────────────────
API_BASE="http://localhost:3100"
COMPANY_PREFIX=""
AGENT_ID=""
SKIP_CLEANUP=false
PASSES=0
FAILURES=0
CREATED_ISSUES=()

# ── Args ───────────────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --api-base)        API_BASE="$2";        shift 2 ;;
    --company-prefix)  COMPANY_PREFIX="$2";  shift 2 ;;
    --agent-id)        AGENT_ID="$2";        shift 2 ;;
    --skip-cleanup)    SKIP_CLEANUP=true;    shift ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

# ── Preflight ──────────────────────────────────────────────────────────────────
require_cmd curl
require_cmd jq
require_cmd npx

section "Preflight"

log "Checking server at ${API_BASE} ..."
if ! curl -sf "${API_BASE}/api/health" >/dev/null 2>&1; then
  echo "ERROR: Paperclip server not reachable at ${API_BASE}" >&2
  echo "       Start it with: pnpm dev" >&2
  exit 1
fi
log "Server OK"

# ── Resolve company ────────────────────────────────────────────────────────────
COMPANIES=$(api GET "/api/companies")

if [[ -n "$COMPANY_PREFIX" ]]; then
  COMPANY_ID=$(echo "$COMPANIES" | jq -r --arg p "$COMPANY_PREFIX" '.[] | select(.issuePrefix == $p) | .id' | head -1)
  [[ -n "$COMPANY_ID" ]] || { echo "ERROR: No company with prefix ${COMPANY_PREFIX}" >&2; exit 1; }
else
  COMPANY_ID=$(echo "$COMPANIES" | jq -r '.[0].id')
  COMPANY_PREFIX=$(echo "$COMPANIES" | jq -r '.[0].issuePrefix')
  [[ -n "$COMPANY_ID" ]] || { echo "ERROR: No companies found" >&2; exit 1; }
fi
log "Company: ${COMPANY_PREFIX} (${COMPANY_ID})"

# ── Resolve agent ──────────────────────────────────────────────────────────────
AGENTS=$(api GET "/api/companies/${COMPANY_ID}/agents")

if [[ -n "$AGENT_ID" ]]; then
  AGENT=$(echo "$AGENTS" | jq -r --arg id "$AGENT_ID" '.[] | select(.id == $id)')
else
  AGENT=$(echo "$AGENTS" | jq -r '[.[] | select(.adapterType | test("claude_local|codex_local"))] | .[0]')
fi

AGENT_ID=$(echo "$AGENT" | jq -r '.id')
AGENT_NAME=$(echo "$AGENT" | jq -r '.name')
[[ -n "$AGENT_ID" && "$AGENT_ID" != "null" ]] || {
  echo "ERROR: No claude_local or codex_local agent found. Pass --agent-id to specify one." >&2
  exit 1
}
log "Agent: ${AGENT_NAME} (${AGENT_ID})"

# ── Pause auto-heartbeat ───────────────────────────────────────────────────────
ORIGINAL_HB_ENABLED=$(echo "$AGENT" | jq -r '.runtimeConfig.heartbeat.enabled // true')
if [[ "$ORIGINAL_HB_ENABLED" == "true" ]]; then
  log "Pausing auto-heartbeat for duration of test ..."
  api PATCH "/api/agents/${AGENT_ID}" \
    -d '{"runtimeConfig": {"heartbeat": {"enabled": false}}}' >/dev/null
fi

restore_heartbeat() {
  if [[ "$ORIGINAL_HB_ENABLED" == "true" ]]; then
    api PATCH "/api/agents/${AGENT_ID}" \
      -d '{"runtimeConfig": {"heartbeat": {"enabled": true}}}' >/dev/null 2>&1 || true
  fi
}
trap restore_heartbeat EXIT

# ── Helper: create issue and trigger heartbeat ─────────────────────────────────
create_issue() {
  local title="$1"
  local description="$2"
  local result
  result=$(api POST "/api/companies/${COMPANY_ID}/issues" \
    -d "$(jq -n \
      --arg t "$title" \
      --arg d "$description" \
      --arg a "$AGENT_ID" \
      '{title: $t, description: $d, status: "todo", assigneeAgentId: $a}')")
  local issue_id
  issue_id=$(echo "$result" | jq -r '.id')
  CREATED_ISSUES+=("$issue_id")
  echo "$result"
}

run_heartbeat() {
  npx paperclipai heartbeat run \
    --agent-id "$AGENT_ID" \
    --api-base "$API_BASE" \
    --source assignment 2>&1
}

# Returns the run ID from the most recent run log for $AGENT_ID
latest_run_id() {
  local log_dir="$HOME/.paperclip/instances/default/data/run-logs/${COMPANY_ID}/${AGENT_ID}"
  ls -t "$log_dir"/*.ndjson 2>/dev/null | head -1 | xargs basename 2>/dev/null | sed 's/\.ndjson$//' || true
}

run_log_contains() {
  local run_id="$1"
  local pattern="$2"
  local log_file="$HOME/.paperclip/instances/default/data/run-logs/${COMPANY_ID}/${AGENT_ID}/${run_id}.ndjson"
  [[ -f "$log_file" ]] && grep -q "$pattern" "$log_file"
}

get_issue() {
  api GET "/api/issues/$1"
}

get_comments() {
  api GET "/api/issues/$1/comments"
}

# ─────────────────────────────────────────────────────────────────────────────
# TEST 1 — Comment style: ticket links and company-prefixed URLs
# ─────────────────────────────────────────────────────────────────────────────
section "Test 1: Comment style — ticket links and prefixed URLs"

ISSUE1=$(create_issue \
  "[skill-smoke] Comment style verification" \
  "Post a comment updating your progress. In that comment, reference issue ${COMPANY_PREFIX}-1 using a proper ticket link (not a bare ID). Then mark this issue as done.")
ISSUE1_ID=$(echo "$ISSUE1" | jq -r '.id')
ISSUE1_IDENT=$(echo "$ISSUE1" | jq -r '.identifier')
log "Created ${ISSUE1_IDENT} (${ISSUE1_ID})"

log "Running heartbeat ..."
run_heartbeat >/dev/null || true

ISSUE1_DATA=$(get_issue "$ISSUE1_ID")
ISSUE1_STATUS=$(echo "$ISSUE1_DATA" | jq -r '.status')
COMMENTS1=$(get_comments "$ISSUE1_ID")
COMMENT1_BODY=$(echo "$COMMENTS1" | jq -r '.[0].body // ""')

if [[ "$ISSUE1_STATUS" == "done" ]]; then
  pass "Issue marked done"
else
  fail "Issue status is '${ISSUE1_STATUS}', expected 'done'"
fi

# Check for a markdown link [XXX-N](/PREFIX/issues/XXX-N) — not a bare identifier
TICKET_LINK_PATTERN="\[${COMPANY_PREFIX}-[0-9]+\]\(/${COMPANY_PREFIX}/issues/${COMPANY_PREFIX}-[0-9]+\)"
if echo "$COMMENT1_BODY" | grep -qE "$TICKET_LINK_PATTERN"; then
  pass "Ticket reference is a markdown link (not bare ID)"
else
  fail "No properly formatted ticket link found in comment"
  log "Comment body was: ${COMMENT1_BODY}"
fi

# Check no unprefixed paths like /issues/XXX-N
if echo "$COMMENT1_BODY" | grep -qE '\(/issues/'; then
  fail "Comment contains unprefixed path (/issues/...) — should use /${COMPANY_PREFIX}/issues/..."
else
  pass "No unprefixed paths in comment"
fi

# ─────────────────────────────────────────────────────────────────────────────
# TEST 2 — Checkout before working
# ─────────────────────────────────────────────────────────────────────────────
section "Test 2: Checkout before working"

ISSUE2=$(create_issue \
  "[skill-smoke] Checkout verification" \
  "Check out this task, post a comment confirming what you did, then mark it done.")
ISSUE2_ID=$(echo "$ISSUE2" | jq -r '.id')
ISSUE2_IDENT=$(echo "$ISSUE2" | jq -r '.identifier')
log "Created ${ISSUE2_IDENT} (${ISSUE2_ID})"

log "Running heartbeat ..."
run_heartbeat >/dev/null || true
HB2_RUN_ID=$(latest_run_id)

ISSUE2_DATA=$(get_issue "$ISSUE2_ID")
ISSUE2_STATUS=$(echo "$ISSUE2_DATA" | jq -r '.status')

if [[ "$ISSUE2_STATUS" == "done" ]]; then
  pass "Issue marked done"
else
  fail "Issue status is '${ISSUE2_STATUS}', expected 'done'"
fi

# Verify checkout was called by inspecting the run log
if [[ -n "$HB2_RUN_ID" ]] && run_log_contains "$HB2_RUN_ID" "/checkout"; then
  pass "Checkout endpoint called during heartbeat"
else
  warn "Could not confirm checkout in run log — check manually: ~/.paperclip/instances/default/data/run-logs/${COMPANY_ID}/${AGENT_ID}/"
fi

# ─────────────────────────────────────────────────────────────────────────────
# TEST 3 — Blocked status reporting
# ─────────────────────────────────────────────────────────────────────────────
section "Test 3: Blocked status reporting"

ISSUE3=$(create_issue \
  "[skill-smoke] Blocked reporting" \
  "Try to fetch https://internal.corp.example.invalid/secret-data and report what you find. You will not be able to reach this URL. If you cannot complete this task, mark it as blocked with a comment explaining why and who needs to act.")
ISSUE3_ID=$(echo "$ISSUE3" | jq -r '.id')
ISSUE3_IDENT=$(echo "$ISSUE3" | jq -r '.identifier')
log "Created ${ISSUE3_IDENT} (${ISSUE3_ID})"

log "Running heartbeat ..."
run_heartbeat >/dev/null || true

ISSUE3_DATA=$(get_issue "$ISSUE3_ID")
ISSUE3_STATUS=$(echo "$ISSUE3_DATA" | jq -r '.status')
COMMENTS3=$(get_comments "$ISSUE3_ID")
COMMENT3_BODY=$(echo "$COMMENTS3" | jq -r '.[0].body // ""')

if [[ "$ISSUE3_STATUS" == "blocked" ]]; then
  pass "Issue marked blocked"
else
  fail "Issue status is '${ISSUE3_STATUS}', expected 'blocked'"
fi

if [[ -n "$COMMENT3_BODY" ]]; then
  pass "Blocked comment posted"
  log "Comment: $(echo "$COMMENT3_BODY" | head -3)"
else
  fail "No comment posted on blocked issue"
fi

# ─────────────────────────────────────────────────────────────────────────────
# TEST 4 — Blocked-task dedup (no repeat comment on second heartbeat)
# ─────────────────────────────────────────────────────────────────────────────
section "Test 4: Blocked-task dedup (no repeat comment on second heartbeat)"

log "Running second heartbeat against same blocked issue ..."
run_heartbeat >/dev/null || true

COMMENTS3_AFTER=$(get_comments "$ISSUE3_ID")
COMMENT_COUNT_AFTER=$(echo "$COMMENTS3_AFTER" | jq 'length')

if [[ "$COMMENT_COUNT_AFTER" -eq 1 ]]; then
  pass "No duplicate comment posted on second heartbeat"
else
  fail "Expected 1 comment, found ${COMMENT_COUNT_AFTER} — agent may have repeated blocked comment"
fi

# ─────────────────────────────────────────────────────────────────────────────
# TEST 5 — Clean exit when inbox is empty
# ─────────────────────────────────────────────────────────────────────────────
section "Test 5: Clean exit with empty inbox"

log "Running heartbeat with no assigned work ..."
HB5_OUTPUT=$(run_heartbeat || true)

if echo "$HB5_OUTPUT" | grep -qi "succeeded"; then
  pass "Heartbeat completed successfully with no work"
else
  fail "Heartbeat did not succeed cleanly"
fi

if echo "$HB5_OUTPUT" | grep -qiE "no assign|inbox.*empty|nothing to (do|act)|exit.*clean"; then
  pass "Agent reported clean exit"
else
  warn "Could not confirm clean-exit message in output (may still be fine)"
fi

# ─────────────────────────────────────────────────────────────────────────────
# Cleanup
# ─────────────────────────────────────────────────────────────────────────────
if [[ "$SKIP_CLEANUP" == false && ${#CREATED_ISSUES[@]} -gt 0 ]]; then
  section "Cleanup"
  for id in "${CREATED_ISSUES[@]}"; do
    api PATCH "/api/issues/${id}" -d '{"status": "cancelled"}' >/dev/null 2>&1 || true
    log "Cancelled ${id}"
  done
fi

# ─────────────────────────────────────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────────────────────────────────────
section "Results"
echo -e "  ${GREEN}Passed: ${PASSES}${NC}   ${RED}Failed: ${FAILURES}${NC}"
echo

if [[ $FAILURES -gt 0 ]]; then
  exit 1
fi
