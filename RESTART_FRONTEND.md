# Frontend Restart Instructions

## Quick Restart

### Option 1: Quick Manual Restart

```bash
# Kill existing frontend server (port 8082)
lsof -ti:8082 | xargs kill -9 2>/dev/null

# Navigate to frontend directory
cd "/Users/satyasharma/Documents/Cursor Codes/Converso-AI-Platform/Converso-frontend"

# Start frontend server
npm run dev
```

### Option 2: Using the Restart Script

Create a restart script (see below) or use:

```bash
cd "/Users/satyasharma/Documents/Cursor Codes/Converso-AI-Platform"
chmod +x RESTART_FRONTEND.sh
./RESTART_FRONTEND.sh
```

## Detailed Steps

### Step 1: Stop the Frontend Server

```bash
# Kill any process running on port 8082
lsof -ti:8082 | xargs kill -9 2>/dev/null

# Or check what's running first
lsof -i:8082
```

### Step 2: Navigate to Frontend Directory

```bash
cd "/Users/satyasharma/Documents/Cursor Codes/Converso-AI-Platform/Converso-frontend"
```

### Step 3: Start the Frontend Server

```bash
npm run dev
```

The frontend will start on: **http://localhost:8082**

## Alternative: Restart Script

Save the following as `RESTART_FRONTEND.sh` in the project root:

```bash
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
```

Then run:
```bash
chmod +x RESTART_FRONTEND.sh
./RESTART_FRONTEND.sh
```

## Troubleshooting

### Port Already in Use

If you see "port 8082 already in use":

```bash
# Find what's using the port
lsof -i:8082

# Kill it
lsof -ti:8082 | xargs kill -9
```

### Frontend Not Starting

1. **Check if dependencies are installed:**
   ```bash
   cd Converso-frontend
   npm install
   ```

2. **Check for errors in the terminal:**
   - Look for TypeScript errors
   - Check for missing dependencies
   - Verify Node.js version (should be 18+)

3. **Clear cache and restart:**
   ```bash
   cd Converso-frontend
   rm -rf node_modules/.vite
   npm run dev
   ```

### Check Server Status

```bash
# Check if frontend is running
lsof -i:8082

# Check if backend is running (required for frontend)
lsof -i:3001
```

## Server Information

- **Frontend URL:** http://localhost:8082
- **Backend URL:** http://localhost:3001 (required for API calls)
- **Port:** 8082
- **Build Tool:** Vite
- **Framework:** React + TypeScript

## Notes

- The frontend requires the backend to be running for API calls
- Hot reload is enabled automatically in development mode
- Changes to code will automatically refresh the browser

---

**Last Updated:** December 2, 2025

