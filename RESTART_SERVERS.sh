#!/bin/bash

# Restart Frontend and Backend Servers for Converso AI Platform

echo "🛑 Stopping existing servers..."

# Kill processes on backend port (3001)
lsof -ti:3001 | xargs kill -9 2>/dev/null || echo "No backend process found on port 3001"

# Kill processes on frontend port (8082)
lsof -ti:8082 | xargs kill -9 2>/dev/null || echo "No frontend process found on port 8082"

# Wait a moment for processes to fully terminate
sleep 2

echo ""
echo "🚀 Starting Backend Server..."
cd Converso-backend
npm run dev &
BACKEND_PID=$!
echo "Backend started (PID: $BACKEND_PID)"

echo ""
echo "🚀 Starting Frontend Server..."
cd ../Converso-frontend
npm run dev -- --host 0.0.0.0 --port 8082 &
FRONTEND_PID=$!
echo "Frontend started (PID: $FRONTEND_PID)"

echo ""
echo "✅ Servers are starting..."
echo ""
echo "📊 Server Status:"
echo "   Backend:  http://localhost:3001 (PID: $BACKEND_PID)"
echo "   Frontend: http://localhost:8082 (PID: $FRONTEND_PID)"
echo ""
echo "💡 To stop servers, run: kill $BACKEND_PID $FRONTEND_PID"
echo "   Or use: pkill -f 'tsx watch' && pkill -f 'vite'"

