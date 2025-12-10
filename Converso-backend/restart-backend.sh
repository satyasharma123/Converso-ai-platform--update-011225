#!/bin/bash

# Kill any process using port 3001
echo "🔍 Checking for processes on port 3001..."
PID=$(lsof -ti:3001)

if [ -z "$PID" ]; then
  echo "✅ Port 3001 is free"
else
  echo "🔪 Killing process $PID on port 3001..."
  kill -9 $PID
  sleep 1
  echo "✅ Process killed"
fi

echo "🚀 Starting backend server..."
npm run dev
