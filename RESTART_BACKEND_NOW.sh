#!/bin/bash

echo "🔪 Killing old backend process on port 3001..."
kill -9 $(lsof -ti:3001) 2>/dev/null

echo "⏳ Waiting 2 seconds..."
sleep 2

echo "🚀 Starting backend server..."
cd "$(dirname "$0")/Converso-backend"
npm run dev
