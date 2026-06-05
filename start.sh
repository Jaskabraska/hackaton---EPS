#!/usr/bin/env bash
# Grid Pulse — one-command local launcher.
# Kills anything on the ports, starts backend + frontend, waits until both are healthy.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"
LOGDIR="$ROOT/.logs"
mkdir -p "$LOGDIR"

echo "→ Stopping anything on ports 8000 / 3000..."
lsof -ti :8000 | xargs kill -9 2>/dev/null || true
lsof -ti :3000 | xargs kill -9 2>/dev/null || true
sleep 1

echo "→ Starting backend (FastAPI :8000)..."
cd "$BACKEND"
source .venv/bin/activate
nohup uvicorn app.main:app --reload --port 8000 > "$LOGDIR/backend.log" 2>&1 &
BACKEND_PID=$!

echo "→ Starting frontend (Next.js :3000)..."
cd "$FRONTEND"
nohup npm run dev -- --port 3000 > "$LOGDIR/frontend.log" 2>&1 &
FRONTEND_PID=$!

# Wait for backend health
echo -n "→ Waiting for backend"
for _ in $(seq 1 30); do
  if curl -fs http://localhost:8000/health >/dev/null 2>&1; then break; fi
  echo -n "."; sleep 1
done
echo " ✓"

# Wait for frontend
echo -n "→ Waiting for frontend"
for _ in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null || echo 000)
  if [ "$code" = "200" ]; then break; fi
  echo -n "."; sleep 1
done
echo " ✓"

echo ""
echo "  Grid Pulse is up:"
echo "    Frontend  →  http://localhost:3000"
echo "    Backend   →  http://localhost:8000/health   (docs: /docs)"
echo ""
echo "  Logs:    tail -f $LOGDIR/backend.log $LOGDIR/frontend.log"
echo "  Stop:    $ROOT/stop.sh"
echo ""
echo "  (backend pid $BACKEND_PID, frontend pid $FRONTEND_PID — they keep running after this script exits)"
