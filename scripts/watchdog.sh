#!/bin/bash
cd /home/z/my-project/.next/standalone
while true; do
  echo "[$(date)] Starting server..."
  node server.js -p 3000 -H 0.0.0.0 2>&1 &
  SERVER_PID=$!
  echo "[$(date)] Server PID: $SERVER_PID"
  wait $SERVER_PID 2>/dev/null
  EXIT_CODE=$?
  echo "[$(date)] Server exited with code: $EXIT_CODE"
  sleep 2
done
