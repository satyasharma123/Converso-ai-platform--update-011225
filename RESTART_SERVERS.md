# Restart Frontend and Backend Servers

## Quick Commands

### Option 1: Use the Restart Script (Recommended)

```bash
cd "/Users/satyasharma/Documents/Cursor Codes/Converso-AI-Platform"
chmod +x RESTART_SERVERS.sh
./RESTART_SERVERS.sh
```

### Option 2: Manual Commands

#### Stop Existing Servers

```bash
# Kill backend server (port 3001)
lsof -ti:3001 | xargs kill -9

# Kill frontend server (port 8082)
lsof -ti:8082 | xargs kill -9
```

#### Start Backend Server

```bash
cd "/Users/satyasharma/Documents/Cursor Codes/Converso-AI-Platform/Converso-backend"
npm run dev
```

*(Run this in a separate terminal or background)*

#### Start Frontend Server

```bash
cd "/Users/satyasharma/Documents/Cursor Codes/Converso-AI-Platform/Converso-frontend"
npm run dev -- --host 0.0.0.0 --port 8082
```

*(Run this in a separate terminal or background)*

### Option 3: Start in Background (All in One)

```bash
cd "/Users/satyasharma/Documents/Cursor Codes/Converso-AI-Platform"

# Kill existing servers
lsof -ti:3001 | xargs kill -9 2>/dev/null
lsof -ti:8082 | xargs kill -9 2>/dev/null

# Start backend in background
cd Converso-backend && npm run dev &

# Start frontend in background
cd ../Converso-frontend && npm run dev -- --host 0.0.0.0 --port 8082 &
```

## Server URLs

- **Backend API:** http://localhost:3001
- **Frontend App:** http://localhost:8082

## Stop Servers

```bash
# Stop all node processes
pkill -f "tsx watch"
pkill -f "vite"

# Or stop by port
lsof -ti:3001 | xargs kill -9
lsof -ti:8082 | xargs kill -9
```

## Check Server Status

```bash
# Check if servers are running
lsof -i:3001  # Backend
lsof -i:8082  # Frontend
```


