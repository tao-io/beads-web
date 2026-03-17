#!/usr/bin/env bash
set -uo pipefail

# ── Configuration ──────────────────────────────────────────────────────────────
PORT="${PORT:-3008}"
BASE_URL="http://localhost:${PORT}"
SERVER_BIN="/app/server/target/release/beads-server"
PASSED=0
FAILED=0
SERVER_PID=""
PROJECT_DIR=""

# ── Helpers ────────────────────────────────────────────────────────────────────

cleanup() {
    if [[ -n "$SERVER_PID" ]]; then
        kill "$SERVER_PID" 2>/dev/null || true
        wait "$SERVER_PID" 2>/dev/null || true
    fi
    if [[ -n "$PROJECT_DIR" && -d "$PROJECT_DIR" ]]; then
        rm -rf "$PROJECT_DIR"
    fi
}
trap cleanup EXIT

pass() {
    local name="$1"
    PASSED=$((PASSED + 1))
    echo "  PASS: $name"
}

fail() {
    local name="$1"
    shift
    FAILED=$((FAILED + 1))
    echo "  FAIL: $name — $*"
}

# assert_status TEST_NAME ACTUAL EXPECTED
assert_status() {
    local name="$1" actual="$2" expected="$3"
    if [[ "$actual" == "$expected" ]]; then
        pass "$name"
    else
        fail "$name" "expected HTTP $expected, got $actual"
    fi
}

# parse_json INPUT — extracts JSON from bd output that may contain warnings before the JSON
parse_json() {
    python3 -c "
import sys, json
raw = sys.stdin.read()
idx = raw.find('[')
ib = raw.find('{')
if idx < 0 or (ib >= 0 and ib < idx):
    idx = ib
if idx < 0:
    print('{}')
else:
    print(raw[idx:])
"
}

# ── Setup: create a temporary git repo with beads ─────────────────────────────

echo "=== Setting up test project ==="
PROJECT_DIR=$(mktemp -d)
echo "  Project dir: $PROJECT_DIR"

cd "$PROJECT_DIR"
git init
git config user.email "test@test.com"
git config user.name "Test"
echo "test" > README.md
git add -A
git commit -m "init"

# Initialize beads (try --skip-agents first, fallback without)
if ! bd init --skip-agents 2>/dev/null; then
    bd init 2>/dev/null || true
fi

# Create 3 test beads
echo "  Creating test beads..."
BD_OUT1=$(bd create --title="Test task one" --type=task 2>&1) || true
BD_OUT2=$(bd create --title="Test bug two" --type=bug 2>&1) || true
BD_OUT3=$(bd create --title="Test epic three" --type=epic 2>&1) || true

# Extract bead IDs from bd output (format: "✓ Created issue: PREFIX-xxx — Title")
extract_bead_id() {
    echo "$1" | python3 -c "
import sys, re
text = sys.stdin.read()
m = re.search(r'Created issue:\s*(\S+)', text) or re.search(r'([a-zA-Z0-9_-]+-[a-zA-Z0-9]+)', text)
print(m.group(1) if m else '')
"
}
BEAD_ID1=$(extract_bead_id "$BD_OUT1")
BEAD_ID2=$(extract_bead_id "$BD_OUT2")
BEAD_ID3=$(extract_bead_id "$BD_OUT3")

echo "  Created beads: [$BEAD_ID1] [$BEAD_ID2] [$BEAD_ID3]"

# Verify beads exist
BD_LIST=$(bd list --json 2>&1 | parse_json)
BEAD_COUNT=$(echo "$BD_LIST" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")
echo "  Beads in project: $BEAD_COUNT"

# ── Start server ──────────────────────────────────────────────────────────────

echo "=== Starting beads-server on port $PORT ==="
PORT="$PORT" "$SERVER_BIN" &
SERVER_PID=$!
sleep 2

# Verify server is running
if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "FATAL: Server failed to start"
    exit 1
fi
echo "  Server running (PID $SERVER_PID)"

# ── Tests ─────────────────────────────────────────────────────────────────────

echo ""
echo "=== Running integration tests ==="

# Test 1: GET /api/beads — returns 200, has beads array >= 3
test_1_get_beads() {
    local name="GET /api/beads returns 200 with >= 3 beads"
    local status body
    status=$(curl -s -o /tmp/t1.json -w "%{http_code}" "${BASE_URL}/api/beads?path=${PROJECT_DIR}")
    if [[ "$status" != "200" ]]; then
        fail "$name" "expected HTTP 200, got $status"
        return
    fi
    local result
    result=$(python3 -c "
import json, sys
with open('/tmp/t1.json') as f:
    data = json.load(f)
beads = data.get('beads', [])
if len(beads) < 3:
    print('FAIL: expected >= 3 beads, got', len(beads), file=sys.stderr)
    sys.exit(1)
for b in beads:
    for field in ('id', 'title', 'status'):
        if field not in b:
            print(f'FAIL: bead missing field: {field}', file=sys.stderr)
            sys.exit(1)
" 2>&1)
    if [[ $? -eq 0 ]]; then
        pass "$name"
    else
        fail "$name" "$result"
    fi
}

# Test 2: GET /api/beads?updated_after=2099-01-01 — returns 0 beads
test_2_future_date() {
    local name="GET /api/beads with future updated_after returns 0 beads"
    local status
    status=$(curl -s -o /tmp/t2.json -w "%{http_code}" \
        "${BASE_URL}/api/beads?path=${PROJECT_DIR}&updated_after=2099-01-01T00:00:00Z")
    if [[ "$status" != "200" ]]; then
        fail "$name" "expected HTTP 200, got $status"
        return
    fi
    local result
    result=$(python3 -c "
import json, sys
with open('/tmp/t2.json') as f:
    data = json.load(f)
beads = data.get('beads', [])
if len(beads) != 0:
    print(f'expected 0 beads, got {len(beads)}', file=sys.stderr)
    sys.exit(1)
" 2>&1)
    if [[ $? -eq 0 ]]; then
        pass "$name"
    else
        fail "$name" "$result"
    fi
}

# Test 3: GET /api/beads?updated_after=2020-01-01 — returns >= 3
test_3_past_date() {
    local name="GET /api/beads with past updated_after returns >= 3 beads"
    local status
    status=$(curl -s -o /tmp/t3.json -w "%{http_code}" \
        "${BASE_URL}/api/beads?path=${PROJECT_DIR}&updated_after=2020-01-01T00:00:00Z")
    if [[ "$status" != "200" ]]; then
        fail "$name" "expected HTTP 200, got $status"
        return
    fi
    local result
    result=$(python3 -c "
import json, sys
with open('/tmp/t3.json') as f:
    data = json.load(f)
beads = data.get('beads', [])
if len(beads) < 3:
    print(f'expected >= 3 beads, got {len(beads)}', file=sys.stderr)
    sys.exit(1)
" 2>&1)
    if [[ $? -eq 0 ]]; then
        pass "$name"
    else
        fail "$name" "$result"
    fi
}

# Test 4: POST /api/beads/create with title+path — returns 201 with id
test_4_create_bead() {
    local name="POST /api/beads/create returns 201 with id"
    local status
    status=$(curl -s -o /tmp/t4.json -w "%{http_code}" \
        -X POST "${BASE_URL}/api/beads/create" \
        -H "Content-Type: application/json" \
        -d "{\"path\":\"${PROJECT_DIR}\",\"title\":\"Integration test bead\"}")
    if [[ "$status" != "201" ]]; then
        fail "$name" "expected HTTP 201, got $status"
        return
    fi
    python3 -c "
import json, sys
with open('/tmp/t4.json') as f:
    data = json.load(f)
if 'id' not in data or not data['id']:
    print('missing id in response', file=sys.stderr)
    sys.exit(1)
" 2>&1
    if [[ $? -eq 0 ]]; then
        pass "$name"
    else
        fail "$name" "validation failed"
    fi
}

# Test 5: POST /api/beads/create with empty title — returns 400
test_5_create_empty_title() {
    local name="POST /api/beads/create with empty title returns 400"
    local status
    status=$(curl -s -o /tmp/t5.json -w "%{http_code}" \
        -X POST "${BASE_URL}/api/beads/create" \
        -H "Content-Type: application/json" \
        -d "{\"path\":\"${PROJECT_DIR}\",\"title\":\"\"}")
    assert_status "$name" "$status" "400"
}

# Test 6: Created bead appears in subsequent GET
test_6_created_bead_visible() {
    local name="Created bead appears in subsequent GET"
    sleep 1
    local status
    status=$(curl -s -o /tmp/t6.json -w "%{http_code}" "${BASE_URL}/api/beads?path=${PROJECT_DIR}")
    if [[ "$status" != "200" ]]; then
        fail "$name" "expected HTTP 200, got $status"
        return
    fi
    local result
    result=$(python3 -c "
import json, sys
with open('/tmp/t6.json') as f:
    data = json.load(f)
beads = data.get('beads', [])
titles = [b.get('title','') for b in beads]
if 'Integration test bead' not in titles:
    print(f'created bead not found in list, titles: {titles}', file=sys.stderr)
    sys.exit(1)
" 2>&1)
    if [[ $? -eq 0 ]]; then
        pass "$name"
    else
        fail "$name" "$result"
    fi
}

# Test 7: PATCH /api/beads/update status to in_progress — returns 200
test_7_update_status() {
    local name="PATCH /api/beads/update status returns 200"
    # Get the ID of the bead we created in test 4
    local bead_id
    bead_id=$(python3 -c "import json; print(json.load(open('/tmp/t4.json')).get('id',''))" 2>/dev/null || echo "")
    if [[ -z "$bead_id" ]]; then
        fail "$name" "no bead ID from test 4"
        return
    fi
    local status
    status=$(curl -s -o /tmp/t7.json -w "%{http_code}" \
        -X PATCH "${BASE_URL}/api/beads/update" \
        -H "Content-Type: application/json" \
        -d "{\"path\":\"${PROJECT_DIR}\",\"id\":\"${bead_id}\",\"status\":\"in_progress\"}")
    assert_status "$name" "$status" "200"
}

# Test 8: Updated status reflected in subsequent GET
test_8_status_reflected() {
    local name="Updated status reflected in subsequent GET"
    sleep 1
    local bead_id
    bead_id=$(python3 -c "import json; print(json.load(open('/tmp/t4.json')).get('id',''))" 2>/dev/null || echo "")
    if [[ -z "$bead_id" ]]; then
        fail "$name" "no bead ID from test 4"
        return
    fi
    local status
    status=$(curl -s -o /tmp/t8.json -w "%{http_code}" "${BASE_URL}/api/beads?path=${PROJECT_DIR}")
    if [[ "$status" != "200" ]]; then
        fail "$name" "expected HTTP 200, got $status"
        return
    fi
    local result
    result=$(python3 -c "
import json, sys
bead_id = '${bead_id}'
with open('/tmp/t8.json') as f:
    data = json.load(f)
beads = data.get('beads', [])
found = [b for b in beads if b.get('id') == bead_id]
if not found:
    print(f'bead {bead_id} not found', file=sys.stderr)
    sys.exit(1)
if found[0].get('status') != 'in_progress':
    print(f'expected in_progress, got {found[0].get(\"status\")}', file=sys.stderr)
    sys.exit(1)
" 2>&1)
    if [[ $? -eq 0 ]]; then
        pass "$name"
    else
        fail "$name" "$result"
    fi
}

# Test 9: GET /api/beads with non-existent path — returns 404
test_9_nonexistent_path() {
    local name="GET /api/beads with non-existent path returns 404"
    local status
    status=$(curl -s -o /tmp/t9.json -w "%{http_code}" \
        "${BASE_URL}/api/beads?path=/root/nonexistent-project-path-12345")
    # Server returns 403 (path security) or 404 (not found) depending on validation
    if [[ "$status" == "404" || "$status" == "403" ]]; then
        pass "$name"
    else
        fail "$name" "expected HTTP 404 or 403, got $status"
    fi
}

# Test 10: GET /api/beads with path missing .beads — returns 404
test_10_missing_beads_dir() {
    local name="GET /api/beads with path missing .beads returns 404"
    local tmpdir
    tmpdir=$(mktemp -d)
    local status
    status=$(curl -s -o /tmp/t10.json -w "%{http_code}" \
        "${BASE_URL}/api/beads?path=${tmpdir}")
    rm -rf "$tmpdir"
    assert_status "$name" "$status" "404"
}

# ── Run all tests ─────────────────────────────────────────────────────────────

test_1_get_beads
test_2_future_date
test_3_past_date
test_4_create_bead
test_5_create_empty_title
test_6_created_bead_visible
test_7_update_status
test_8_status_reflected
test_9_nonexistent_path
test_10_missing_beads_dir

# ── Summary ───────────────────────────────────────────────────────────────────

echo ""
echo "=== Results ==="
TOTAL=$((PASSED + FAILED))
echo "  $PASSED passed, $FAILED failed (out of $TOTAL)"

if [[ "$FAILED" -gt 0 ]]; then
    exit 1
fi
echo "  All tests passed!"
exit 0
