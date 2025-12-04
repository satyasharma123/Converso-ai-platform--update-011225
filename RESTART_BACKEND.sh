#!/bin/bash
# Quick script to restart the backend

cd "$(dirname "$0")/Converso-backend"

echo "🔄 Restarting backend..."

# Kill any process on port 3001
lsof -ti:3001 | xargs kill -9 2>/dev/null

# Wait a moment
sleep 1

# Start backend
echo "✅ Starting backend on port 3001..."
npm run dev



