#!/bin/bash
# ScriptForge - Start server
cd "$(dirname "$0")"

if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

if [ ! -d ".next" ]; then
  echo "Building for production..."
  npm run build
fi

echo "Starting ScriptForge on http://localhost:3000"
exec npx next start -p 3000