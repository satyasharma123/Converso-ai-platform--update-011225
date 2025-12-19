#!/bin/bash
# Quick script to restart the frontend

cd "$(dirname "$0")/Converso-frontend"

echo "🔄 Restarting frontend..."

# Kill any process on port 8082
lsof -ti:8082 | xargs kill -9 2>/dev/null

# Wait a moment
sleep 1

# Start frontend
echo "✅ Starting frontend on port 8082..."
npm run dev

# Quick script to restart the frontend

cd "$(dirname "$0")/Converso-frontend"

echo "🔄 Restarting frontend..."

# Kill any process on port 8082
lsof -ti:8082 | xargs kill -9 2>/dev/null

# Wait a moment
sleep 1

# Start frontend
echo "✅ Starting frontend on port 8082..."
npm run dev









