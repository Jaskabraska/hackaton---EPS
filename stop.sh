#!/usr/bin/env bash
# Grid Pulse — stop both servers.
echo "→ Stopping backend (:8000) and frontend (:3000)..."
lsof -ti :8000 | xargs kill -9 2>/dev/null || true
lsof -ti :3000 | xargs kill -9 2>/dev/null || true
echo "✓ Stopped."
