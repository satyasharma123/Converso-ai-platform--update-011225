#!/bin/bash

# Start Converso Development Servers
# Run this script from the project root

echo "🚀 Starting Converso Development Servers..."
echo ""

# Kill any existing processes
echo "Cleaning up existing processes..."
lsof -ti:3001 | xargs kill -9 2>/dev/null || true
lsof -ti:8082 | xargs kill -9 2>/dev/null || true
sleep 1

# Start Backend
echo "📦 Starting Backend (port 3001)..."
cd Converso-backend
npm run dev &
BACKEND_PID=$!
cd ..

# Wait a moment for backend to start
sleep 3

# Start Frontend
echo "🎨 Starting Frontend (port 8082)..."
cd Converso-frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "✅ Servers starting..."
echo ""
echo "Backend:  http://localhost:3001"
echo "Frontend: http://localhost:8082"
echo ""
echo "Press Ctrl+C to stop both servers"
echo ""

# Wait for user interrupt
wait








